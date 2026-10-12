const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 8080;
// 既定はこのPCからのみアクセス可。LAN内の他端末から使う場合は HOST=0.0.0.0 で起動する
const HOST = process.env.HOST || '127.0.0.1';
const ROOT_DIR = __dirname;
const DB_FILE = path.join(ROOT_DIR, 'data', 'todos.json');
const MAX_BODY_BYTES = 1024 * 1024;

// 配信を許可する静的ファイル（これ以外はリポジトリ内のファイルでも返さない）
const STATIC_FILES = new Set([
    '/index.html',
    '/script.js',
    '/style.css',
    '/service-worker.js',
    '/manifest.json',
    '/icon-192.png',
    '/icon-512.png',
    '/fonts/Nosutaru-dotMPlusH-10-Regular.ttf'
]);

class BadRequestError extends Error {}
class DatabaseError extends Error {}

// MIMEタイプの定義
const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.webmanifest': 'application/manifest+json',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2'
};

// データベースファイルの初期化
function initDatabase() {
    const dir = path.dirname(DB_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    
    if (!fs.existsSync(DB_FILE)) {
        const initialData = {
            todos: [],
            userStats: {
                level: 1,
                exp: 0,
                totalCompleted: 0,
                badges: [],
                streakDays: 0,
                lastCompletionDate: null,
                rank: "見習い"
            },
            presets: [],
            schedules: [],
            lastUpdated: new Date().toISOString()
        };
        fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
    }
}

// JSONデータベースの読み込み
// 読めない・壊れている場合は空データで続行せず例外にする（空データで上書き保存して全消去するのを防ぐ）
function readDatabase() {
    let parsedData;
    try {
        parsedData = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch (error) {
        console.error('Database read error:', error);
        throw new DatabaseError(`Cannot read database: ${error.message}`);
    }
    if (!parsedData || !Array.isArray(parsedData.todos)) {
        throw new DatabaseError('Database file has an unexpected format');
    }

    // presetsフィールドがない場合は追加
    if (!parsedData.presets) {
        parsedData.presets = [];
    }

    // schedulesフィールドがない場合は追加
    if (!parsedData.schedules) {
        parsedData.schedules = [];
    }

    return parsedData;
}

// JSONデータベースへの書き込み
// 一時ファイルに書いてから置き換えるので、書き込み途中で落ちても元のファイルは壊れない
function writeDatabase(data) {
    const tmpFile = `${DB_FILE}.tmp`;
    try {
        data.lastUpdated = new Date().toISOString();
        fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2));
        fs.renameSync(tmpFile, DB_FILE);
        return true;
    } catch (error) {
        console.error('Database write error:', error);
        return false;
    }
}

// リクエストボディを解析
function parseRequestBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let size = 0;
        req.on('data', chunk => {
            size += chunk.length;
            if (size > MAX_BODY_BYTES) {
                reject(new BadRequestError('Request body too large'));
                req.destroy();
                return;
            }
            chunks.push(chunk);
        });
        req.on('end', () => {
            try {
                resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
            } catch (error) {
                reject(new BadRequestError('Invalid JSON'));
            }
        });
        req.on('error', reject);
    });
}

// 別サイトからのリクエスト（CSRF）とDNSリバインディングを拒否する
function isAllowedRequest(req) {
    const host = req.headers.host || '';
    const hostname = host.replace(/:\d+$/, '').replace(/^\[|\]$/g, '');

    // ローカル専用モードでは、Hostヘッダーがローカルを指していることを確認
    if (HOST === '127.0.0.1' || HOST === 'localhost') {
        if (!['localhost', '127.0.0.1', '::1'].includes(hostname)) {
            return false;
        }
    }

    // ブラウザが付けるOriginが自分自身でなければ拒否（同一オリジンのGETではOriginが付かないこともある）
    const origin = req.headers.origin;
    if (origin) {
        try {
            if (new URL(origin).host !== host) {
                return false;
            }
        } catch (e) {
            return false;
        }
    }
    return true;
}

// APIエンドポイントの処理
async function handleAPI(req, res, pathname) {
    const method = req.method;

    // CORSヘッダーは付けない（同一オリジンのこのアプリからだけ使う）

    // GET /api/todos - 全てのTodoを取得
    if (method === 'GET' && pathname === '/api/todos') {
        const data = readDatabase();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
        return;
    }
    
    // POST /api/todos - 新しいTodoを作成
    if (method === 'POST' && pathname === '/api/todos') {
        try {
            const newTodo = await parseRequestBody(req);
            const data = readDatabase();
            
            // IDが設定されていない場合は自動生成
            if (!newTodo.id) {
                newTodo.id = Date.now();
            }
            
            // archivedフィールドがない場合はfalseを設定
            if (newTodo.archived === undefined) {
                newTodo.archived = false;
            }
            
            data.todos.push(newTodo);
            
            if (writeDatabase(data)) {
                res.writeHead(201, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(newTodo));
            } else {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Failed to save todo' }));
            }
        } catch (error) {
            if (error instanceof DatabaseError) throw error;
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid request body' }));
        }
        return;
    }
    
    // PUT /api/todos/:id - Todoを更新
    if (method === 'PUT' && pathname.startsWith('/api/todos/')) {
        try {
            const todoId = parseFloat(pathname.split('/')[3]);
            const updateData = await parseRequestBody(req);
            const data = readDatabase();
            
            const index = data.todos.findIndex(todo => todo.id === todoId);
            if (index !== -1) {
                data.todos[index] = { ...data.todos[index], ...updateData };
                
                if (writeDatabase(data)) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(data.todos[index]));
                } else {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Failed to update todo' }));
                }
            } else {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Todo not found' }));
            }
        } catch (error) {
            if (error instanceof DatabaseError) throw error;
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid request body' }));
        }
        return;
    }
    
    
    // DELETE /api/todos/:id - Todoを削除（アーカイブに変更）
    if (method === 'DELETE' && pathname.startsWith('/api/todos/')) {
        const todoId = parseFloat(pathname.split('/')[3]);
        const data = readDatabase();
        
        const index = data.todos.findIndex(todo => todo.id === todoId);
        if (index !== -1) {
            // 削除ではなくアーカイブフラグを立てる
            data.todos[index].archived = true;
            data.todos[index].archivedAt = new Date().toISOString();
            
            if (writeDatabase(data)) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(data.todos[index]));
            } else {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Failed to archive todo' }));
            }
        } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Todo not found' }));
        }
        return;
    }
    
    // POST /api/todos/sync - 全てのTodoを同期（置き換え）
    if (method === 'POST' && pathname === '/api/todos/sync') {
        try {
            const syncData = await parseRequestBody(req);
            const data = readDatabase();
            
            data.todos = syncData.todos || [];
            
            if (writeDatabase(data)) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(data));
            } else {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Failed to sync todos' }));
            }
        } catch (error) {
            if (error instanceof DatabaseError) throw error;
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid request body' }));
        }
        return;
    }
    
    // GET /api/stats - ユーザー統計を取得
    if (method === 'GET' && pathname === '/api/stats') {
        const data = readDatabase();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data.userStats || {}));
        return;
    }
    
    // POST /api/stats/complete - タスク完了時の統計更新
    if (method === 'POST' && pathname === '/api/stats/complete') {
        try {
            const { taskData } = await parseRequestBody(req);
            const data = readDatabase();
            
            // userStatsが存在しない場合は初期化
            if (!data.userStats) {
                data.userStats = {
                    level: 1,
                    exp: 0,
                    totalCompleted: 0,
                    badges: [],
                    streakDays: 0,
                    lastCompletionDate: null,
                    rank: "見習い"
                };
            }
            
            // EXP計算
            let earnedExp = calculateExp(taskData);
            data.userStats.exp += earnedExp;
            data.userStats.totalCompleted++;
            
            // レベルアップ判定
            const newLevel = calculateLevel(data.userStats.exp);
            const levelUp = newLevel > data.userStats.level;
            if (levelUp) {
                data.userStats.level = newLevel;
                data.userStats.rank = getRank(newLevel);
            }
            
            // ストリーク更新
            updateStreak(data.userStats);
            
            // バッジ判定
            checkAndAwardBadges(data.userStats, taskData);
            
            if (writeDatabase(data)) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    earnedExp,
                    userStats: data.userStats,
                    levelUp
                }));
            } else {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Failed to update stats' }));
            }
        } catch (error) {
            if (error instanceof DatabaseError) throw error;
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid request body' }));
        }
        return;
    }
    
    // GET /api/presets - プリセット一覧を取得
    if (method === 'GET' && pathname === '/api/presets') {
        const data = readDatabase();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data.presets || []));
        return;
    }
    
    // POST /api/presets - 新しいプリセットを作成
    if (method === 'POST' && pathname === '/api/presets') {
        try {
            const preset = await parseRequestBody(req);
            const data = readDatabase();
            
            // プリセットIDを生成
            const newPreset = {
                id: Date.now(),
                name: preset.name,
                tasks: preset.tasks || [],
                createdAt: new Date().toISOString(),
                lastUsed: null
            };
            
            data.presets.push(newPreset);
            
            if (writeDatabase(data)) {
                res.writeHead(201, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(newPreset));
            } else {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Failed to create preset' }));
            }
        } catch (error) {
            if (error instanceof DatabaseError) throw error;
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid request body' }));
        }
        return;
    }
    
    // PUT /api/presets/:id - プリセットを更新
    if (method === 'PUT' && pathname.startsWith('/api/presets/')) {
        const presetId = parseFloat(pathname.split('/')[3]);
        
        try {
            const updates = await parseRequestBody(req);
            const data = readDatabase();
            
            const index = data.presets.findIndex(preset => preset.id === presetId);
            if (index !== -1) {
                data.presets[index] = {
                    ...data.presets[index],
                    name: updates.name || data.presets[index].name,
                    tasks: updates.tasks || data.presets[index].tasks
                };
                
                if (writeDatabase(data)) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(data.presets[index]));
                } else {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Failed to update preset' }));
                }
            } else {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Preset not found' }));
            }
        } catch (error) {
            if (error instanceof DatabaseError) throw error;
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid request body' }));
        }
        return;
    }
    
    // DELETE /api/presets/:id - プリセットを削除
    if (method === 'DELETE' && pathname.startsWith('/api/presets/')) {
        const presetId = parseFloat(pathname.split('/')[3]);
        const data = readDatabase();
        
        const index = data.presets.findIndex(preset => preset.id === presetId);
        if (index !== -1) {
            data.presets.splice(index, 1);
            
            if (writeDatabase(data)) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } else {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Failed to delete preset' }));
            }
        } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Preset not found' }));
        }
        return;
    }
    
    // POST /api/presets/:id/apply - プリセットを今日に適用
    if (method === 'POST' && pathname.match(/^\/api\/presets\/\d+\/apply$/)) {
        const presetId = parseFloat(pathname.split('/')[3]);
        
        try {
            // リクエストボディを取得
            let targetDate = 'today';
            try {
                const body = await parseRequestBody(req);
                if (body.targetDate) {
                    targetDate = body.targetDate;
                }
            } catch (e) {
                // ボディがない場合はデフォルトで今日
            }
            
            const data = readDatabase();
            const preset = data.presets.find(p => p.id === presetId);
            
            if (!preset) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Preset not found' }));
                return;
            }
            
            // 対象日を決定
            const baseDate = new Date();
            if (targetDate === 'tomorrow') {
                baseDate.setDate(baseDate.getDate() + 1);
            }
            const createdTodos = [];
            
            // プリセットのタスクをtodoとして作成
            for (const task of preset.tasks) {
                const [hours, minutes] = task.time.split(':').map(Number);
                const deadline = new Date(baseDate);
                deadline.setHours(hours, minutes, 0, 0);
                
                // 今日の場合で既に過ぎた時間の場合は明日に設定
                if (targetDate === 'today' && deadline < new Date()) {
                    deadline.setDate(deadline.getDate() + 1);
                }
                
                const newTodo = {
                    id: Date.now() + Math.random(),
                    title: task.title,
                    deadline: deadline.toISOString(),
                    createdAt: new Date().toISOString(),
                    archived: false
                };
                
                data.todos.push(newTodo);
                createdTodos.push(newTodo);
            }
            
            // プリセットの最終使用日を更新
            preset.lastUsed = new Date().toISOString();
            
            if (writeDatabase(data)) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, createdTodos }));
            } else {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Failed to apply preset' }));
            }
        } catch (error) {
            if (error instanceof DatabaseError) throw error;
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to apply preset' }));
        }
        return;
    }
    
    // GET /api/schedules - スケジュール一覧を取得
    if (method === 'GET' && pathname === '/api/schedules') {
        const data = readDatabase();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data.schedules || []));
        return;
    }
    
    // POST /api/schedules - 新しいスケジュールを作成
    if (method === 'POST' && pathname === '/api/schedules') {
        try {
            const schedule = await parseRequestBody(req);
            const data = readDatabase();
            
            // スケジュールIDを生成
            const newSchedule = {
                id: Date.now(),
                title: schedule.title,
                time: schedule.time,
                repeat: schedule.repeat,
                memo: schedule.memo || '',
                createdAt: new Date().toISOString()
            };
            
            data.schedules.push(newSchedule);
            
            if (writeDatabase(data)) {
                res.writeHead(201, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(newSchedule));
            } else {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Failed to save schedule' }));
            }
        } catch (error) {
            if (error instanceof DatabaseError) throw error;
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid request' }));
        }
        return;
    }
    
    // PUT /api/schedules/:id - スケジュールを更新
    if (method === 'PUT' && pathname.match(/^\/api\/schedules\/\d+$/)) {
        const scheduleId = parseFloat(pathname.split('/')[3]);
        
        try {
            const updates = await parseRequestBody(req);
            const data = readDatabase();
            
            const index = data.schedules.findIndex(schedule => schedule.id === scheduleId);
            if (index !== -1) {
                data.schedules[index] = {
                    ...data.schedules[index],
                    ...updates,
                    id: scheduleId,
                    updatedAt: new Date().toISOString()
                };
                
                if (writeDatabase(data)) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(data.schedules[index]));
                } else {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Failed to update schedule' }));
                }
            } else {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Schedule not found' }));
            }
        } catch (error) {
            if (error instanceof DatabaseError) throw error;
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid request' }));
        }
        return;
    }
    
    // DELETE /api/schedules/:id - スケジュールを削除
    if (method === 'DELETE' && pathname.match(/^\/api\/schedules\/\d+$/)) {
        const scheduleId = parseFloat(pathname.split('/')[3]);
        const data = readDatabase();
        
        const index = data.schedules.findIndex(schedule => schedule.id === scheduleId);
        if (index !== -1) {
            data.schedules.splice(index, 1);
            
            if (writeDatabase(data)) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } else {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Failed to delete schedule' }));
            }
        } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Schedule not found' }));
        }
        return;
    }
    
    // POST /api/schedules/batch-create - スケジュールから一括でタスクを作成
    if (method === 'POST' && pathname === '/api/schedules/batch-create') {
        try {
            const request = await parseRequestBody(req);
            const { scheduleIds, targetDate } = request;
            const data = readDatabase();
            
            // 対象日を決定
            const now = new Date();
            let targetDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            if (targetDate === 'tomorrow') {
                targetDay.setDate(targetDay.getDate() + 1);
            }
            
            // 曜日を取得（日曜=0, 月曜=1, ...）
            const dayOfWeek = targetDay.getDay();
            const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
            
            let createdCount = 0;
            const createdTodos = [];
            
            for (const scheduleId of scheduleIds) {
                const schedule = data.schedules.find(s => s.id === scheduleId);
                if (!schedule) continue;
                
                // 繰り返し条件をチェック
                if (schedule.repeat === 'weekdays' && !isWeekday) {
                    continue; // 平日のみの場合、週末はスキップ
                }
                
                // タスクの期限を計算
                const [hours, minutes] = schedule.time.split(':').map(Number);
                const deadline = new Date(targetDay);
                deadline.setHours(hours, minutes, 0, 0);
                
                // 新しいタスクを作成
                const newTodo = {
                    id: Date.now() + Math.random(),
                    title: schedule.title,
                    deadline: deadline.toISOString(),
                    repeat: '',
                    notifyBefore: null,
                    memo: schedule.memo || '',
                    completed: false,
                    archived: false,
                    order: data.todos.length,
                    createdAt: new Date().toISOString(),
                    startType: 'normal',
                    scheduleId: schedule.id
                };
                
                data.todos.push(newTodo);
                createdTodos.push(newTodo);
                createdCount++;
            }
            
            if (writeDatabase(data)) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ createdCount, createdTodos }));
            } else {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Failed to create tasks' }));
            }
        } catch (error) {
            if (error instanceof DatabaseError) throw error;
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid request' }));
        }
        return;
    }
    
    // 404 Not Found
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'API endpoint not found' }));
}

// EXP計算関数
function calculateExp(taskData) {
    let baseExp = 10;
    
    // 期限内に完了した場合ボーナス
    const now = new Date();
    const deadline = new Date(taskData.deadline);
    if (now <= deadline) {
        baseExp += 5;
    }
    
    // 期限が迫っていたタスクにボーナス
    const timeRemaining = deadline - now;
    const hoursRemaining = timeRemaining / (1000 * 60 * 60);
    if (hoursRemaining < 2 && hoursRemaining > 0) {
        baseExp += 10; // ギリギリセーフボーナス
    }
    
    // 繰り返しタスクボーナス
    if (taskData.repeat) {
        baseExp += 3;
    }
    
    // 期限切れペナルティ
    if (now > deadline) {
        baseExp = Math.max(3, baseExp - 5);
    }
    
    return baseExp;
}

// レベル計算関数
function calculateLevel(totalExp) {
    // レベル = √(EXP / 50) + 1
    return Math.floor(Math.sqrt(totalExp / 50)) + 1;
}

// ランク取得関数
function getRank(level) {
    if (level >= 50) return "伝説";
    if (level >= 30) return "達人";
    if (level >= 20) return "エキスパート";
    if (level >= 10) return "一人前";
    if (level >= 5) return "中級者";
    return "見習い";
}

// ストリーク更新関数
function updateStreak(userStats) {
    const today = new Date().toDateString();
    const lastCompletion = userStats.lastCompletionDate ? new Date(userStats.lastCompletionDate).toDateString() : null;
    
    if (!lastCompletion) {
        // 初回完了
        userStats.streakDays = 1;
    } else if (lastCompletion === today) {
        // 今日すでに完了している
        // ストリークは変更なし
    } else {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        if (lastCompletion === yesterday.toDateString()) {
            // 連続している
            userStats.streakDays++;
        } else {
            // 連続が途切れた
            userStats.streakDays = 1;
        }
    }
    
    userStats.lastCompletionDate = new Date().toISOString();
}

// バッジ判定関数
function checkAndAwardBadges(userStats, taskData) {
    const badges = userStats.badges || [];
    
    // 初回完了バッジ
    if (userStats.totalCompleted === 1 && !badges.includes('first_complete')) {
        badges.push('first_complete');
    }
    
    // 10タスク完了バッジ
    if (userStats.totalCompleted >= 10 && !badges.includes('complete_10')) {
        badges.push('complete_10');
    }
    
    // 50タスク完了バッジ
    if (userStats.totalCompleted >= 50 && !badges.includes('complete_50')) {
        badges.push('complete_50');
    }
    
    // 100タスク完了バッジ
    if (userStats.totalCompleted >= 100 && !badges.includes('complete_100')) {
        badges.push('complete_100');
    }
    
    // 7日連続バッジ
    if (userStats.streakDays >= 7 && !badges.includes('streak_7')) {
        badges.push('streak_7');
    }
    
    // 30日連続バッジ
    if (userStats.streakDays >= 30 && !badges.includes('streak_30')) {
        badges.push('streak_30');
    }
    
    // レベル10達成バッジ
    if (userStats.level >= 10 && !badges.includes('level_10')) {
        badges.push('level_10');
    }
    
    // 期限ギリギリマスターバッジ（締切2時間以内に完了）
    const now = new Date();
    const deadline = new Date(taskData.deadline);
    const hoursRemaining = (deadline - now) / (1000 * 60 * 60);
    if (hoursRemaining < 2 && hoursRemaining > 0 && !badges.includes('deadline_master')) {
        if (userStats.totalCompleted >= 20) { // 20回以上のギリギリ完了で獲得
            badges.push('deadline_master');
        }
    }
    
    // 早朝戦士バッジ（5-7時に完了）
    const completionHour = now.getHours();
    if (completionHour >= 5 && completionHour < 7 && !badges.includes('early_bird')) {
        badges.push('early_bird');
    }
    
    // 夜型戦士バッジ（22-24時に完了）
    if (completionHour >= 22 && !badges.includes('night_owl')) {
        badges.push('night_owl');
    }
    
    userStats.badges = badges;
}

// サーバー作成
const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url);
    const pathname = parsedUrl.pathname;
    const method = req.method;
    
    console.log(`${new Date().toISOString()} - ${req.method} ${pathname}`);

    if (!isAllowedRequest(req)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('403 Forbidden');
        return;
    }

    // APIリクエストの処理
    if (pathname.startsWith('/api/')) {
        try {
            await handleAPI(req, res, pathname);
        } catch (error) {
            console.error('API error:', error);
            if (!res.headersSent) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    error: error instanceof DatabaseError ? 'Database is unreadable; nothing was saved' : 'Internal server error'
                }));
            }
        }
        return;
    }

    // 静的ファイルの処理（許可リストにあるものだけ返す）
    const requestPath = pathname === '/' ? '/index.html' : pathname;
    if (!STATIC_FILES.has(requestPath)) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found', 'utf-8');
        return;
    }

    const filePath = path.join(ROOT_DIR, requestPath);
    const extname = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('404 Not Found', 'utf-8');
            } else {
                res.writeHead(500);
                res.end(`Server Error: ${error.code}`, 'utf-8');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        }
    });
});

// データベース初期化
initDatabase();

// サーバー起動
server.listen(PORT, HOST, () => {
    console.log(`
========================================
Todo Countdown Server with API is running!
========================================

Local access:
  http://localhost:${PORT}

Network access:
  ${HOST === '127.0.0.1' || HOST === 'localhost'
      ? 'disabled (start with HOST=0.0.0.0 to allow other devices on your LAN)'
      : `http://${getNetworkIP()}:${PORT}`}

API Endpoints:
  GET    /api/todos       - Get all todos
  POST   /api/todos       - Create new todo
  PUT    /api/todos/:id   - Update todo
  DELETE /api/todos/:id   - Delete todo
  POST   /api/todos/sync  - Sync all todos

Database location:
  ${path.resolve(DB_FILE)}

Press Ctrl+C to stop the server
========================================
    `);
});

// ネットワークIPアドレスを取得
function getNetworkIP() {
    const os = require('os');
    const interfaces = os.networkInterfaces();
    
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}