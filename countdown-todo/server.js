const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';
const DB_FILE = './data/todos.json';

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
            lastUpdated: new Date().toISOString()
        };
        fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
    }
}

// JSONデータベースの読み込み
function readDatabase() {
    try {
        const data = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Database read error:', error);
        return { todos: [], lastUpdated: new Date().toISOString() };
    }
}

// JSONデータベースへの書き込み
function writeDatabase(data) {
    try {
        data.lastUpdated = new Date().toISOString();
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Database write error:', error);
        return false;
    }
}

// リクエストボディを解析
function parseRequestBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                resolve(JSON.parse(body));
            } catch (error) {
                reject(error);
            }
        });
    });
}

// APIエンドポイントの処理
async function handleAPI(req, res, pathname) {
    const method = req.method;
    
    // CORS設定
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // OPTIONSリクエストの処理
    if (method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
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
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid request body' }));
        }
        return;
    }
    
    // PUT /api/todos/:id - Todoを更新
    if (method === 'PUT' && pathname.startsWith('/api/todos/')) {
        try {
            const todoId = parseInt(pathname.split('/')[3]);
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
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid request body' }));
        }
        return;
    }
    
    // DELETE /api/todos/:id/permanent - Todoを完全に削除（先にチェック）
    if (method === 'DELETE' && pathname.match(/^\/api\/todos\/\d+\/permanent$/)) {
        const todoId = parseInt(pathname.split('/')[3]);
        const data = readDatabase();
        
        const index = data.todos.findIndex(todo => todo.id === todoId);
        if (index !== -1) {
            data.todos.splice(index, 1);
            
            if (writeDatabase(data)) {
                res.writeHead(204);
                res.end();
            } else {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Failed to delete todo permanently' }));
            }
        } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Todo not found' }));
        }
        return;
    }
    
    // DELETE /api/todos/:id - Todoを削除（アーカイブに変更）
    if (method === 'DELETE' && pathname.startsWith('/api/todos/')) {
        const todoId = parseInt(pathname.split('/')[3]);
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
            if (newLevel > data.userStats.level) {
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
                    levelUp: newLevel > data.userStats.level
                }));
            } else {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Failed to update stats' }));
            }
        } catch (error) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid request body' }));
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
    
    console.log(`${new Date().toISOString()} - ${req.method} ${pathname}`);
    
    // APIリクエストの処理
    if (pathname.startsWith('/api/')) {
        await handleAPI(req, res, pathname);
        return;
    }
    
    // 静的ファイルの処理
    let filePath = '.' + pathname;
    if (filePath === './') {
        filePath = './index.html';
    }
    
    const extname = String(path.extname(filePath)).toLowerCase();
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
            res.writeHead(200, { 
                'Content-Type': contentType,
                'Access-Control-Allow-Origin': '*'
            });
            res.end(content, 'utf-8');
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
  http://${getNetworkIP()}:${PORT}

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