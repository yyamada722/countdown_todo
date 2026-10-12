#!/usr/bin/env node
// Todo Countdown のサーバーをバックグラウンドで起動・停止し、ログイン時の自動起動を設定するツール
//
//   node scripts/launcher.js start [--open] [--lan] [--port N]   起動（起動済みなら何もしない）
//   node scripts/launcher.js stop                                 停止
//   node scripts/launcher.js restart [--open] [--lan|--local]     再起動（指定がなければ今のモードのまま）
//   node scripts/launcher.js status                               状態表示
//   node scripts/launcher.js logs                                 ログの末尾を表示
//   node scripts/launcher.js autostart on|off|status [--lan]      ログイン時の自動起動（Windowsのみ）

const { spawn, execFile } = require('child_process');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const SERVER_FILE = path.join(ROOT_DIR, 'server.js');
const LOG_DIR = path.join(ROOT_DIR, 'logs');
const LOG_FILE = path.join(LOG_DIR, 'server.log');
const MAX_LOG_BYTES = 1024 * 1024;
const DEFAULT_PORT = 8080;
const STARTUP_TIMEOUT_MS = 10000;
const SHUTDOWN_TIMEOUT_MS = 5000;
const SHORTCUT_NAME = 'Todo Countdown.lnk';

class LauncherError extends Error {}

function parseArgs(argv) {
    const [command = 'status', ...rest] = argv;
    const options = { command, mode: null, open: false, port: Number(process.env.PORT) || DEFAULT_PORT, action: null };
    for (let i = 0; i < rest.length; i++) {
        const arg = rest[i];
        if (arg === '--lan') options.mode = 'lan';
        else if (arg === '--local') options.mode = 'local';
        else if (arg === '--open') options.open = true;
        else if (arg === '--port') options.port = Number(rest[++i]);
        else if (command === 'autostart' && !options.action) options.action = arg;
        else throw new LauncherError(`Unknown option: ${arg}`);
    }
    if (!Number.isInteger(options.port) || options.port < 1 || options.port > 65535) {
        throw new LauncherError('Port must be an integer between 1 and 65535');
    }
    return options;
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// 指定ポートの状態を返す: null=何も動いていない / { foreign: true }=別のプログラム / それ以外=このアプリのサーバー情報
function getHealth(port) {
    return new Promise(resolve => {
        const req = http.get({ host: '127.0.0.1', port, path: '/api/health', timeout: 1500 }, res => {
            let body = '';
            res.on('data', chunk => { body += chunk; });
            res.on('end', () => {
                try {
                    const info = JSON.parse(body);
                    resolve(info && info.app === 'countdown-todo' ? info : { foreign: true });
                } catch (e) {
                    resolve({ foreign: true });
                }
            });
        });
        req.on('timeout', () => req.destroy(new Error('timeout')));
        req.on('error', error => resolve(error.code === 'ECONNREFUSED' ? null : { foreign: true }));
    });
}

function isLanMode(info) {
    return info.host !== '127.0.0.1' && info.host !== 'localhost';
}

// 仮想マシン用アダプタなど、他の端末からは通常つながらないインターフェース名
const VIRTUAL_ADAPTER_PATTERN = /vmware|virtualbox|vethernet|hyper-v|wsl|docker|loopback/i;

// 有線LAN・Wi-Fi・VPN(Tailscale等)など、他の端末から到達できそうなIPv4アドレスを返す
function getNetworkAddresses() {
    const result = [];
    for (const [name, addresses] of Object.entries(os.networkInterfaces())) {
        if (VIRTUAL_ADAPTER_PATTERN.test(name)) continue;
        for (const address of addresses) {
            // 169.254.x.x はDHCPで取得できなかった時の自動割当てで、通信には使えない
            if (address.family === 'IPv4' && !address.internal && !address.address.startsWith('169.254.')) {
                result.push({ name, address: address.address });
            }
        }
    }
    return result;
}

function describeUrls(info) {
    const lines = [`  This PC : http://localhost:${info.port}`];
    if (isLanMode(info)) {
        const addresses = getNetworkAddresses();
        if (addresses.length === 0) {
            lines.push('  Network : (no network address found)');
        }
        for (const { name, address } of addresses) {
            lines.push(`  Network : http://${address}:${info.port}  (${name})`);
        }
    }
    return lines.join('\n');
}

function openBrowser(url) {
    let command, args;
    if (process.platform === 'win32') {
        command = 'rundll32';
        args = ['url.dll,FileProtocolHandler', url];
    } else if (process.platform === 'darwin') {
        command = 'open';
        args = [url];
    } else {
        command = 'xdg-open';
        args = [url];
    }
    spawn(command, args, { detached: true, stdio: 'ignore', windowsHide: true }).unref();
}

function rotateLog() {
    try {
        if (fs.statSync(LOG_FILE).size > MAX_LOG_BYTES) {
            fs.renameSync(LOG_FILE, `${LOG_FILE}.1`);
        }
    } catch (e) {
        // ログがまだ無い場合など
    }
}

function tailLog(lineCount) {
    try {
        return fs.readFileSync(LOG_FILE, 'utf8').trimEnd().split(/\r?\n/).slice(-lineCount).join('\n');
    } catch (e) {
        return '(no log yet)';
    }
}

async function start(options) {
    const running = await getHealth(options.port);
    if (running && running.foreign) {
        throw new LauncherError(
            `Port ${options.port} is used by another program (or an old version of this server).\n` +
            `Stop it first, or use a different port: --port 3000`
        );
    }

    let info = running;
    if (running) {
        console.log(`Already running (${isLanMode(running) ? 'LAN mode' : 'this PC only'}, pid ${running.pid}).`);
        if (options.mode && (options.mode === 'lan') !== isLanMode(running)) {
            console.log(`To switch modes, run: restart ${options.mode === 'lan' ? '--lan' : '--local'}`);
        }
    } else {
        fs.mkdirSync(LOG_DIR, { recursive: true });
        rotateLog();
        const logFd = fs.openSync(LOG_FILE, 'a');
        const child = spawn(process.execPath, [SERVER_FILE], {
            cwd: ROOT_DIR,
            detached: true,
            windowsHide: true,
            stdio: ['ignore', logFd, logFd],
            env: { ...process.env, PORT: String(options.port), HOST: options.mode === 'lan' ? '0.0.0.0' : '127.0.0.1' }
        });
        fs.closeSync(logFd);

        let exitCode = null;
        child.on('exit', code => { exitCode = code; });
        child.unref();

        const deadline = Date.now() + STARTUP_TIMEOUT_MS;
        while (!info || info.foreign) {
            if (exitCode !== null) {
                throw new LauncherError(`Server exited during startup (code ${exitCode}). Last log lines:\n${tailLog(15)}`);
            }
            if (Date.now() > deadline) {
                throw new LauncherError(`Server did not respond within ${STARTUP_TIMEOUT_MS / 1000}s. Last log lines:\n${tailLog(15)}`);
            }
            await sleep(200);
            info = await getHealth(options.port);
        }
        console.log(`Started in the background (${isLanMode(info) ? 'LAN mode' : 'this PC only'}, pid ${info.pid}).`);
    }

    console.log(describeUrls(info));
    if (options.open) {
        openBrowser(`http://localhost:${info.port}`);
    }
    return info;
}

async function stop(options) {
    const running = await getHealth(options.port);
    if (!running) {
        console.log('Not running.');
        return null;
    }
    if (running.foreign) {
        throw new LauncherError(`Port ${options.port} is used by another program; not stopping it.`);
    }

    process.kill(running.pid);
    const deadline = Date.now() + SHUTDOWN_TIMEOUT_MS;
    while (await getHealth(options.port)) {
        if (Date.now() > deadline) {
            throw new LauncherError(`Server (pid ${running.pid}) did not stop within ${SHUTDOWN_TIMEOUT_MS / 1000}s.`);
        }
        await sleep(200);
    }
    console.log(`Stopped (pid ${running.pid}).`);
    return running;
}

async function restart(options) {
    const previous = await stop(options);
    const mode = options.mode || (previous && isLanMode(previous) ? 'lan' : 'local');
    return start({ ...options, mode });
}

async function status(options) {
    const running = await getHealth(options.port);
    if (!running) {
        console.log(`Server : not running (port ${options.port})`);
    } else if (running.foreign) {
        console.log(`Server : port ${options.port} is used by another program`);
    } else {
        console.log(`Server : running (${isLanMode(running) ? 'LAN mode' : 'this PC only'}, pid ${running.pid}, since ${new Date(running.startedAt).toLocaleString()})`);
        console.log(describeUrls(running));
    }
    if (process.platform === 'win32') {
        console.log(`Autostart at login : ${fs.existsSync(getShortcutPath()) ? 'ON' : 'OFF'}`);
    }
    console.log(`Log    : ${LOG_FILE}`);
    console.log(`Backup : ${path.join(ROOT_DIR, 'data', 'backups')}`);
}

function getShortcutPath() {
    return path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup', SHORTCUT_NAME);
}

function runPowerShell(script, env) {
    return new Promise((resolve, reject) => {
        execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
            { env: { ...process.env, ...env }, windowsHide: true },
            (error, stdout, stderr) => (error ? reject(new LauncherError(stderr || error.message)) : resolve(stdout)));
    });
}

async function autostart(options) {
    if (process.platform !== 'win32') {
        throw new LauncherError('Autostart is only supported on Windows.');
    }
    const shortcutPath = getShortcutPath();

    if (options.action === 'on') {
        const args = [`"${path.join(ROOT_DIR, 'scripts', 'launcher.js')}"`, 'start'];
        if (options.mode === 'lan') args.push('--lan');
        if (options.port !== DEFAULT_PORT) args.push('--port', String(options.port));
        // パスは環境変数で渡し、PowerShellのコマンド文字列には埋め込まない
        await runPowerShell(
            '$s = (New-Object -ComObject WScript.Shell).CreateShortcut($env:LNK_PATH);' +
            '$s.TargetPath = $env:LNK_TARGET; $s.Arguments = $env:LNK_ARGS; $s.WorkingDirectory = $env:LNK_DIR;' +
            '$s.WindowStyle = 7; $s.Description = \'Start Todo Countdown server in the background\'; $s.Save()',
            { LNK_PATH: shortcutPath, LNK_TARGET: process.execPath, LNK_ARGS: args.join(' '), LNK_DIR: ROOT_DIR }
        );
        console.log(`Autostart ON${options.mode === 'lan' ? ' (LAN mode)' : ''}: the server will start in the background when you log in.`);
        console.log(`Shortcut: ${shortcutPath}`);
    } else if (options.action === 'off') {
        if (fs.existsSync(shortcutPath)) {
            fs.unlinkSync(shortcutPath);
            console.log('Autostart OFF.');
        } else {
            console.log('Autostart was already OFF.');
        }
    } else if (!options.action || options.action === 'status') {
        console.log(`Autostart at login : ${fs.existsSync(shortcutPath) ? 'ON' : 'OFF'}`);
    } else {
        throw new LauncherError('Usage: autostart on|off|status [--lan]');
    }
}

const COMMANDS = {
    start,
    stop,
    restart,
    status,
    autostart,
    logs: async () => console.log(tailLog(40))
};

async function main() {
    const options = parseArgs(process.argv.slice(2));
    const command = COMMANDS[options.command];
    if (!command) {
        throw new LauncherError(`Unknown command: ${options.command}\nCommands: ${Object.keys(COMMANDS).join(', ')}`);
    }
    await command(options);
}

main().catch(error => {
    console.error(error instanceof LauncherError ? `ERROR: ${error.message}` : error);
    process.exit(1);
});
