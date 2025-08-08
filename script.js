// グローバル変数
let todos = [];
let clockInterval;
let syncInterval;
let schedules = []; // スケジュール（繰り返しタスク）の配列

// カウントダウンのみを更新する関数
let animationFrameId = null;

function updateCountdownsOnly() {
    const countdownElements = document.querySelectorAll('.todo-card .countdown-time');
    
    countdownElements.forEach(element => {
        const todoCard = element.closest('.todo-card');
        const todoId = todoCard?.dataset.todoId;
        
        if (!todoId) return;
        
        const todo = todos.find(t => t.id === parseInt(todoId));
        if (!todo || todo.archived) return;
        
        const timeInfo = formatTimeRemaining(
            todo.deadline, 
            todo.startType, 
            todo.startedAt,
            todo.isAnimating,
            todo.animationStartTime,
            todo.animationPhase,
            todo.originalOverdueTime,
            todo.animationDuration
        );
        
        // カウントダウンのテキストのみを更新
        element.textContent = timeInfo.expired && todo.animationPhase !== 'white' ? 
            `-${timeInfo.showSeconds ? 
                `${String(timeInfo.minutes).padStart(2, '0')}:${String(timeInfo.seconds).padStart(2, '0')}.${String(Math.floor(timeInfo.milliseconds / 10)).padStart(2, '0')}` :
                `${String(timeInfo.days).padStart(2, '0')}d${String(timeInfo.hours).padStart(2, '0')}h${String(timeInfo.minutes).padStart(2, '0')}m`
            }` :
            `+${timeInfo.showSeconds ? 
                `${String(timeInfo.minutes).padStart(2, '0')}:${String(timeInfo.seconds).padStart(2, '0')}.${String(Math.floor(timeInfo.milliseconds / 10)).padStart(2, '0')}` :
                `${String(timeInfo.days).padStart(2, '0')}d${String(timeInfo.hours).padStart(2, '0')}h${String(timeInfo.minutes).padStart(2, '0')}m`
            }`;
        
        // クラスの更新（期限切れ状態の変化時のみ）
        if (timeInfo.expired && !element.classList.contains('expired')) {
            element.classList.add('expired');
        } else if (!timeInfo.expired && element.classList.contains('expired')) {
            element.classList.remove('expired');
        }
    });
    
    // requestAnimationFrameで次フレームの更新をスケジュール
    if (window.isCountdownAnimationActive) {
        animationFrameId = requestAnimationFrame(updateCountdownsOnly);
    }
}
let lastSyncTime = null;
let notifiedTodos = new Set(); // 通知済みのTodoIDを記録
let preNotifiedTodos = new Set(); // 事前通知済みのTodoIDを記録
let currentFilter = 'active'; // 現在のフィルター状態
let userStats = null; // ユーザー統計情報
let presets = []; // プリセット一覧
let weeklyViewContainer;
let scheduleContainer;

// DOM要素
const todoContainer = document.getElementById('todoContainer');
const statsContainer = document.getElementById('statsContainer');
const currentTimeElement = document.getElementById('currentTime');
const currentDateElement = document.getElementById('currentDate');

// モーダル関連の要素
const openModalBtn = document.getElementById('openModal');
const modalOverlay = document.getElementById('modalOverlay');
const closeModalBtn = document.getElementById('closeModal');
const cancelModalBtn = document.getElementById('cancelModal');
const createTodoBtn = document.getElementById('createTodo');
const modalTodoTitleInput = document.getElementById('modalTodoTitle');
const modalTodoDeadlineInput = document.getElementById('modalTodoDeadline');
const modalTodoTimeInput = document.getElementById('modalTodoTime');

// タスクタイプ関連の要素
const taskTypeNormalBtn = document.getElementById('taskTypeNormal');
const taskTypeStartNowBtn = document.getElementById('taskTypeStartNow');
const normalDeadlineField = document.getElementById('normalDeadlineField');
const startNowDeadlineField = document.getElementById('startNowDeadlineField');
const customDurationInput = document.getElementById('customDuration');
let selectedTaskType = 'normal';
let selectedDuration = null;

// カレンダー関連の要素
const prevMonthBtn = document.getElementById('prevMonth');
const nextMonthBtn = document.getElementById('nextMonth');
const currentMonthYearElement = document.getElementById('currentMonthYear');
const calendarGrid = document.getElementById('calendarGrid');

// カレンダーの状態
let currentCalendarDate = new Date();
let selectedDate = new Date();

// 編集モーダル関連の要素
const editModalOverlay = document.getElementById('editModalOverlay');
const closeEditModalBtn = document.getElementById('closeEditModal');
const editTodoTitleInput = document.getElementById('editTodoTitle');
const editTodoDeadlineInput = document.getElementById('editTodoDeadline');
const updateTodoBtn = document.getElementById('updateTodo');
const deleteTodoBtn = document.getElementById('deleteEditTodo');
const doneTodoBtn = document.getElementById('doneTodo');
let editingTodoId = null;

// 初期化
function init() {
    // DOM要素を取得
    weeklyViewContainer = document.getElementById('weeklyViewContainer');
    scheduleContainer = document.getElementById('scheduleContainer');
    
    // サーバーからデータを取得
    syncWithServer();
    loadUserStats();
    loadPresets();
    loadSchedules();
    
    // 定期的な同期を開始（5秒ごと）
    syncInterval = setInterval(syncWithServer, 5000);
    
    startClock();
    setInterval(() => {
        renderTodos();
        
        // 1分以内のタスクまたはアニメーション中のタスクがある場合は高速更新
        const hasNearDeadline = todos.some(todo => {
            if (todo.archived) return false;
            if (todo.isAnimating) return true; // アニメーション中は常に高速更新
            const now = new Date();
            const diff = todo.deadline.getTime() - now.getTime();
            return Math.abs(diff) < 60000; // 残り1分以内または期限切れ1分以内
        });
        
        if (hasNearDeadline && !window.isCountdownAnimationActive) {
            // requestAnimationFrame による滑らかなカウントダウン更新
            window.isCountdownAnimationActive = true;
            updateCountdownsOnly();
        } else if (!hasNearDeadline && window.isCountdownAnimationActive) {
            // 高速更新を停止
            window.isCountdownAnimationActive = false;
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
            }
        }
    }, 1000); // 1秒ごとにチェック
    setupModalEvents();
    setupEditModalEvents();
    setupCalendar();
    setupFilterTabs();
    setupNotificationButton();
    setupTaskTypeSelector();
    
    // 同期状態表示を追加
    addSyncIndicator();
    
    // ゲーミフィケーション表示を追加（削除）
    // addGameStats();
    
    // 通知許可状態を更新
    updateNotificationButtonState();
}

// ユーザー統計を読み込む
async function loadUserStats() {
    try {
        const response = await fetch('/api/stats');
        if (response.ok) {
            userStats = await response.json();
            // updateGameStats(); // 削除
        }
    } catch (error) {
        console.error('統計読み込みエラー:', error);
    }
}

// プリセットを読み込む
async function loadPresets() {
    try {
        const response = await fetch('/api/presets');
        if (response.ok) {
            presets = await response.json();
        }
    } catch (error) {
        console.error('プリセット読み込みエラー:', error);
    }
}

// ゲーミフィケーション表示を追加（現在は未使用）
/* function addGameStats() {
    // 統計タブ内に移動したため未使用
}

function updateGameStats() {
    // 統計タブ内に移動したため未使用
} */

// バッジアイコンを取得
function getBadgeIcon(badgeId) {
    const badges = {
        'first_complete': { icon: '🎯', name: '初回完了' },
        'complete_10': { icon: '⭐', name: '10タスク達成' },
        'complete_50': { icon: '🌟', name: '50タスク達成' },
        'complete_100': { icon: '💫', name: '100タスク達成' },
        'streak_7': { icon: '🔥', name: '7日連続' },
        'streak_30': { icon: '💥', name: '30日連続' },
        'level_10': { icon: '🏆', name: 'レベル10' },
        'deadline_master': { icon: '⚡', name: 'デッドラインマスター' },
        'early_bird': { icon: '🌅', name: '早起き戦士' },
        'night_owl': { icon: '🦉', name: '夜型戦士' }
    };
    
    const badge = badges[badgeId] || { icon: '🏅', name: '未知のバッジ' };
    return `<span title="${badge.name}" style="font-size: 20px; cursor: help;">${badge.icon}</span>`;
}

// 同期インジケーターを追加
function addSyncIndicator() {
    const indicator = document.createElement('div');
    indicator.id = 'syncIndicator';
    indicator.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        padding: 6px 12px;
        background: #10b981;
        color: white;
        border-radius: 5px;
        font-size: 12px;
        z-index: 9999;
        min-width: 80px;
        text-align: center;
    `;
    indicator.textContent = '同期中...';
    document.body.appendChild(indicator);
}

// 同期状態を更新
function updateSyncIndicator(status) {
    const indicator = document.getElementById('syncIndicator');
    if (!indicator) return;
    
    switch(status) {
        case 'syncing':
            indicator.style.background = '#3b82f6';
            indicator.textContent = '同期中...';
            break;
        case 'success':
            indicator.style.background = '#10b981';
            indicator.textContent = '同期完了';
            break;
        case 'error':
            indicator.style.background = '#ef4444';
            indicator.textContent = '同期エラー';
            break;
    }
}

// サーバーと同期
async function syncWithServer() {
    updateSyncIndicator('syncing');
    
    try {
        const response = await fetch('/api/todos');
        const data = await response.json();
        
        if (data.todos) {
            // アニメーション中のタスクを保存
            const animatingTasks = todos.filter(t => t.isAnimating);
            
            todos = data.todos.map(todo => ({
                ...todo,
                deadline: new Date(todo.deadline),
                createdAt: new Date(todo.createdAt)
            }));
            
            // アニメーション中のタスクを復元
            todos.push(...animatingTasks);
            
            // 削除されたTodoの通知IDもクリア
            const currentTodoIds = new Set(todos.map(t => t.id));
            notifiedTodos.forEach(id => {
                if (!currentTodoIds.has(id)) {
                    notifiedTodos.delete(id);
                }
            });
            
            lastSyncTime = new Date();
            renderTodos();
            updateSyncIndicator('success');
        }
    } catch (error) {
        console.error('同期エラー:', error);
        updateSyncIndicator('error');
    }
}

// 時計を開始
function startClock() {
    updateClock();
    clockInterval = setInterval(updateClock, 1000);
}

// 時計を更新
function updateClock() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('ja-JP', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    const dateString = now.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        weekday: 'short'
    });
    
    currentTimeElement.textContent = timeString;
    currentDateElement.textContent = dateString;
}

// モーダルイベントをセットアップ
function setupModalEvents() {
    // モーダルを開く
    openModalBtn.addEventListener('click', openModal);
    
    // モーダルを閉じる
    closeModalBtn.addEventListener('click', closeModal);
    cancelModalBtn.addEventListener('click', closeModal);
    
    // オーバーレイクリックで閉じる
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            closeModal();
        }
    });
    
    // Todoを作成
    createTodoBtn.addEventListener('click', createTodoFromModal);
    
    // Enterキーで作成
    modalTodoTitleInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            createTodoFromModal();
        }
    });
}

// モーダルを開く
function openModal() {
    modalOverlay.classList.add('active');
    
    // 初期値設定
    modalTodoTitleInput.value = '';
    document.getElementById('modalTodoMemo').value = '';
    selectedDate = new Date();
    currentCalendarDate = new Date();
    modalTodoTimeInput.value = '12:00';
    
    // タスクタイプをリセット
    selectedTaskType = 'normal';
    selectedDuration = null;
    taskTypeNormalBtn.classList.add('active');
    taskTypeStartNowBtn.classList.remove('active');
    normalDeadlineField.style.display = 'block';
    startNowDeadlineField.style.display = 'none';
    
    // 作業時間ボタンのアクティブ状態をリセット
    document.querySelectorAll('.duration-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    customDurationInput.value = '';
    
    // 複数タスク入力フィールドの初期化（PCのみ）
    const multiTaskField = document.getElementById('multiTaskField');
    const multiTaskInput = document.getElementById('multiTaskInput');
    if (multiTaskField && window.innerWidth > 768) {
        multiTaskField.style.display = 'block';
        multiTaskInput.value = '';
    }
    
    // カレンダーを更新
    updateCalendar();
    updateSelectedDateTime();
    
    // フォーカス
    setTimeout(() => modalTodoTitleInput.focus(), 100);
}

// モーダルを閉じる
function closeModal() {
    modalOverlay.classList.remove('active');
}

// モーダルからTodoを作成
async function createTodoFromModal() {
    const singleTitle = modalTodoTitleInput.value.trim();
    const memo = document.getElementById('modalTodoMemo').value.trim();
    const repeat = document.getElementById('modalTodoRepeat').value;
    const notify = document.getElementById('modalTodoNotify').value;
    
    let deadline;
    let startType = 'normal';
    let startedAt = null;
    
    if (selectedTaskType === 'start-now') {
        // 今から始めるタスクの場合
        if (!selectedDuration && !customDurationInput.value) {
            alert('作業時間を選択してください');
            return;
        }
        
        const duration = selectedDuration || parseInt(customDurationInput.value);
        const now = new Date();
        startedAt = now.toISOString();
        
        // 現在時刻 + 作業時間を期限とする
        const deadlineDate = new Date(now.getTime() + duration * 60 * 1000);
        deadline = deadlineDate.toISOString();
        startType = 'start-now';
    } else {
        // 通常のタスクの場合
        deadline = modalTodoDeadlineInput.value;
        if (!deadline) {
            alert('期限を設定してください');
            return;
        }
    }
    
    // 複数タスク入力を確認（PCのみ）
    const multiTaskInput = document.getElementById('multiTaskInput');
    let taskTitles = [];
    
    if (multiTaskInput && window.innerWidth > 768 && multiTaskInput.value.trim()) {
        // 複数タスク入力がある場合は、改行で分割
        taskTitles = multiTaskInput.value.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);
    } else if (singleTitle) {
        // 単一タスクの場合
        taskTitles = [singleTitle];
    }
    
    if (taskTitles.length === 0) {
        alert('タスク名を入力してください');
        return;
    }
    
    // 複数のタスクを作成
    const todos = taskTitles.map(title => ({
        title: title,
        deadline: deadline,
        memo: memo,
        repeat: repeat,
        notify: notify ? parseInt(notify) : null,
        createdAt: new Date().toISOString(),
        startType: startType,
        startedAt: startedAt
    }));
    
    try {
        // 各タスクを順番に作成
        for (const todo of todos) {
            const response = await fetch('/api/todos', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(todo)
            });
            
            if (!response.ok) {
                alert(`エラーが発生しました: ${todo.title}`);
                return;
            }
        }
        
        closeModal();
        await syncWithServer(); // 即座に同期
        
        if (todos.length > 1) {
            // 複数タスクが作成された場合は通知
            const notification = document.createElement('div');
            notification.className = 'notification-popup success';
            notification.textContent = `${todos.length}件のタスクを作成しました`;
            document.getElementById('notificationContainer').appendChild(notification);
            setTimeout(() => notification.remove(), 3000);
        }
    } catch (error) {
        console.error('作成エラー:', error);
        alert('サーバーに接続できません');
    }
}

// 編集モーダルイベントをセットアップ
function setupEditModalEvents() {
    // モーダルを閉じる
    closeEditModalBtn.addEventListener('click', closeEditModal);
    
    // オーバーレイクリックで閉じる
    editModalOverlay.addEventListener('click', (e) => {
        if (e.target === editModalOverlay) {
            closeEditModal();
        }
    });
    
    // 更新ボタン
    updateTodoBtn.addEventListener('click', updateTodo);
    
    // 削除ボタン
    deleteTodoBtn.addEventListener('click', async () => {
        if (editingTodoId && confirm('このタスクを削除しますか？')) {
            await deleteTodo(editingTodoId);
            closeEditModal();
        }
    });
    
    // 完了/復元ボタン
    doneTodoBtn.addEventListener('click', async () => {
        if (editingTodoId) {
            const todoId = editingTodoId; // IDを保存
            const todo = todos.find(t => t.id === todoId);
            
            if (!todo) {
                console.error('Todo not found:', todoId);
                closeEditModal();
                return;
            }
            
            closeEditModal(); // 先にモーダルを閉じる
            
            // 少し遅延を入れてからアクションを実行
            setTimeout(async () => {
                if (todo.archived) {
                    await restoreTodo(todoId);
                } else {
                    await completeTodo(todoId);
                }
            }, 100);
        }
    });
    
    // 時間調整ボタン
    document.querySelectorAll('.time-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const adjust = parseInt(e.target.dataset.adjust);
            adjustDeadline(adjust);
        });
    });
    
    // メモ入力時のプレビュー更新
    const editMemoTextarea = document.getElementById('editTodoMemo');
    editMemoTextarea.addEventListener('input', updateMemoPreview);
}

// メモのMarkdownを解析してHTMLに変換
function parseMemoMarkdown(memo) {
    if (!memo) return '';
    
    // エスケープ処理
    let html = memo
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    
    // URLをリンクに変換（httpまたはhttpsで始まるURL）
    html = html.replace(
        /(https?:\/\/[^\s<]+)/g,
        '<a href="$1" target="_blank" rel="noopener noreferrer" class="memo-link">$1</a>'
    );
    
    // 改行を<br>に変換
    html = html.replace(/\n/g, '<br>');
    
    return html;
}

// 編集モーダルを開く
function openEditModal(id) {
    const todo = todos.find(t => t.id === id);
    if (!todo) return;
    
    editingTodoId = id;
    editTodoTitleInput.value = todo.title;
    const memoTextarea = document.getElementById('editTodoMemo');
    memoTextarea.value = todo.memo || '';
    
    // 繰り返し設定
    const repeatSelect = document.getElementById('editTodoRepeat');
    repeatSelect.value = todo.repeat || '';
    
    // 通知設定
    const notifySelect = document.getElementById('editTodoNotify');
    notifySelect.value = todo.notify || '';
    
    // メモプレビューを更新
    updateMemoPreview();
    
    // タブの初期化
    setupTabs();
    
    // スマホの場合とメモがある場合の判定
    const isMobile = window.innerWidth <= 768;
    
    // スマホでメモがある場合、またはPC/タブレットでもメモがある場合はメモタブを優先
    if (todo.memo && (isMobile || todo.memo.length > 50)) {
        switchToTab('memo');
    } else {
        switchToTab('edit');
    }
    
    // 日時を入力フィールドの形式に変換
    const deadline = new Date(todo.deadline);
    deadline.setMinutes(deadline.getMinutes() - deadline.getTimezoneOffset());
    editTodoDeadlineInput.value = deadline.toISOString().slice(0, 16);
    
    // アーカイブ済みの場合、完了ボタンを復元ボタンに変更
    const doneBtn = document.getElementById('doneTodo');
    if (todo.archived) {
        doneBtn.textContent = '復元';
        doneBtn.classList.add('btn-restore');
        doneBtn.classList.remove('btn-done');
    } else {
        doneBtn.textContent = '完了';
        doneBtn.classList.remove('btn-restore');
        doneBtn.classList.add('btn-done');
    }
    
    editModalOverlay.classList.add('active');
    setTimeout(() => editTodoTitleInput.focus(), 100);
}

// 編集モーダルを閉じる
function closeEditModal() {
    editModalOverlay.classList.remove('active');
    editingTodoId = null;
}

// Todo更新
async function updateTodo() {
    if (!editingTodoId) return;
    
    const title = editTodoTitleInput.value.trim();
    const deadline = editTodoDeadlineInput.value;
    const memo = document.getElementById('editTodoMemo').value.trim();
    const repeat = document.getElementById('editTodoRepeat').value;
    const notify = document.getElementById('editTodoNotify').value;
    
    if (!title || !deadline) {
        alert('タスク名と期限を入力してください');
        return;
    }
    
    const todo = todos.find(t => t.id === editingTodoId);
    if (!todo) return;
    
    try {
        const response = await fetch(`/api/todos/${editingTodoId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title: title,
                deadline: new Date(deadline).toISOString(),
                memo: memo,
                repeat: repeat,
                notify: notify ? parseInt(notify) : null
            })
        });
        
        if (response.ok) {
            closeEditModal();
            await syncWithServer();
        } else {
            alert('更新に失敗しました');
        }
    } catch (error) {
        console.error('更新エラー:', error);
        alert('サーバーに接続できません');
    }
}

// 期限を調整
function adjustDeadline(minutes) {
    const currentValue = editTodoDeadlineInput.value;
    if (!currentValue) return;
    
    const deadline = new Date(currentValue);
    deadline.setMinutes(deadline.getMinutes() + minutes);
    deadline.setMinutes(deadline.getMinutes() - deadline.getTimezoneOffset());
    editTodoDeadlineInput.value = deadline.toISOString().slice(0, 16);
}

// Todo完了
async function completeTodo(id) {
    const todo = todos.find(t => t.id === id || t.id === parseInt(id));
    if (!todo) return;
    
    // EXPを獲得
    await earnExpForCompletion(todo);
    
    // 期限切れタスクの場合はアニメーション
    const now = new Date();
    const todoDeadline = new Date(todo.deadline);
    const isOverdue = todoDeadline.getTime() < now.getTime();
    
    if (isOverdue && !todo.archived) {
        // 現在の期限切れ時間を記録
        const overdueTime = now.getTime() - todoDeadline.getTime();
        
        // アニメーション用の一時的なタスクを作成
        const animatingTodo = {
            id: `animating-${Date.now()}`,
            title: todo.title,
            deadline: todoDeadline,
            isAnimating: true,
            animationStartTime: now.getTime(),
            originalOverdueTime: overdueTime,
            animationDuration: 3000, // 全体3秒（1.5秒で+5秒まで、1.5秒で0まで）
            phaseDuration: 3000, // 白フェーズは3秒
            archived: false,
            createdAt: todo.createdAt || new Date().toISOString(),
            startType: todo.startType || 'normal',
            startedAt: todo.startedAt || null
        };
        
        // 繰り返しタスクの場合は先に次回タスクを作成
        if (todo.repeat) {
            await createNextRepeatTask(todo);
        }
        
        // 元のタスクを削除（todosから直接削除）
        const index = todos.findIndex(t => t.id === id || t.id === parseInt(id));
        if (index !== -1) {
            todos.splice(index, 1);
        }
        
        // アニメーション用タスクを追加
        todos.push(animatingTodo);
        
        // 即座に再描画
        renderTodos();
        
        // サーバーと同期（アーカイブ処理）
        try {
            const response = await fetch(`/api/todos/${id}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                console.error('Archive failed');
                // エラーが発生した場合は元に戻す
                todos = todos.filter(t => t.id !== animatingTodo.id);
                todos.push(todo);
                renderTodos();
                return;
            }
        } catch (error) {
            console.error('Archive error:', error);
            // エラーが発生した場合は元に戻す
            todos = todos.filter(t => t.id !== animatingTodo.id);
            todos.push(todo);
            renderTodos();
            return;
        }
        
        // アニメーションフェーズの管理
        const checkAnimationPhase = () => {
            const animTodo = todos.find(t => t.id === animatingTodo.id);
            if (!animTodo) return;
            
            const elapsed = Date.now() - animTodo.animationStartTime;
            
            if (elapsed >= 3000 && !animTodo.animationPhase) {
                // 3秒経過後、白背景フェーズへ
                animTodo.animationPhase = 'white';
                animTodo.animationStartTime = Date.now();
                playTimeChime(); // 0秒になった時に時報を再生
                renderTodos();
                
                // 白背景フェーズの終了をチェック
                setTimeout(() => {
                    const checkWhitePhase = () => {
                        const animTodo = todos.find(t => t.id === animatingTodo.id);
                        if (!animTodo) return;
                        
                        const whiteElapsed = Date.now() - animTodo.animationStartTime;
                        if (whiteElapsed >= 3000) {
                            // アニメーション用タスクを削除
                            todos = todos.filter(t => t.id !== animatingTodo.id);
                            renderTodos();
                        } else {
                            requestAnimationFrame(checkWhitePhase);
                        }
                    };
                    checkWhitePhase();
                }, 100);
            } else if (!animTodo.animationPhase) {
                requestAnimationFrame(checkAnimationPhase);
            }
        };
        
        // アニメーションフェーズのチェックを開始
        requestAnimationFrame(checkAnimationPhase);
    } else {
        // 通常の完了処理
        if (todo.repeat) {
            await createNextRepeatTask(todo);
        }
        await archiveTodo(id);
    }
}

// 次の繰り返しタスクを作成
async function createNextRepeatTask(todo) {
    const nextDeadline = calculateNextDeadline(new Date(todo.deadline), todo.repeat);
    
    const newTodo = {
        title: todo.title,
        deadline: nextDeadline.toISOString(),
        memo: todo.memo,
        repeat: todo.repeat,
        notify: todo.notify,
        createdAt: new Date().toISOString()
    };
    
    try {
        await fetch('/api/todos', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(newTodo)
        });
    } catch (error) {
        console.error('繰り返しタスク作成エラー:', error);
    }
}

// 繰り返しタイプのテキストを取得
function getRepeatText(repeatType) {
    const repeatTexts = {
        'daily': '毎日',
        'weekly': '毎週',
        'biweekly': '隔週',
        'monthly': '毎月',
        'weekdays': '平日'
    };
    return repeatTexts[repeatType] || '';
}

// 次回の期限を計算
function calculateNextDeadline(currentDeadline, repeatType) {
    const next = new Date(currentDeadline);
    
    switch (repeatType) {
        case 'daily':
            next.setDate(next.getDate() + 1);
            break;
        case 'weekly':
            next.setDate(next.getDate() + 7);
            break;
        case 'biweekly':
            next.setDate(next.getDate() + 14);
            break;
        case 'monthly':
            next.setMonth(next.getMonth() + 1);
            break;
        case 'weekdays':
            do {
                next.setDate(next.getDate() + 1);
            } while (next.getDay() === 0 || next.getDay() === 6); // 土日をスキップ
            break;
    }
    
    return next;
}

// Todo復元
async function restoreTodo(id) {
    const todo = todos.find(t => t.id === id || t.id === parseInt(id));
    if (!todo) return;
    
    try {
        const response = await fetch(`/api/todos/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ...todo,
                archived: false,
                archivedAt: null
            })
        });
        
        if (response.ok) {
            await syncWithServer();
        } else {
            alert('復元に失敗しました');
        }
    } catch (error) {
        console.error('復元エラー:', error);
        alert('サーバーに接続できません');
    }
}

// Todoアーカイブ
async function archiveTodo(id) {
    try {
        const response = await fetch(`/api/todos/${id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            await syncWithServer();
        } else {
            alert('アーカイブに失敗しました');
        }
    } catch (error) {
        console.error('アーカイブエラー:', error);
        alert('サーバーに接続できません');
        throw error;
    }
}

// Todoを削除（アーカイブ）
async function deleteTodo(id) {
    try {
        const response = await fetch(`/api/todos/${id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            await syncWithServer();
        } else {
            alert('削除に失敗しました');
        }
    } catch (error) {
        console.error('削除エラー:', error);
        alert('サーバーに接続できません');
    }
}

// 時間情報を計算
function formatTimeRemaining(deadline, startType, startedAt, isAnimating, animationStartTime, animationPhase, originalOverdueTime, animationDuration) {
    const now = new Date();
    let diff = deadline.getTime() - now.getTime();
    
    // アニメーション中の特別な処理
    if (isAnimating && animationStartTime) {
        const animationElapsed = now.getTime() - animationStartTime;
        if (animationPhase === 'white') {
            // 白背景フェーズ：0から-5秒までの通常カウントダウン
            diff = -animationElapsed;
        } else {
            // 赤背景フェーズ：2段階のカウントダウン
            const duration = animationDuration || 3000;
            const fastPhaseEnd = 1500; // 1.5秒で+5秒まで
            const slowPhaseStart = 1500; // 残り1.5秒で0まで
            
            if (animationElapsed <= fastPhaseEnd) {
                // 高速フェーズ：1.5秒で+5秒まで（段階的に減速）
                const fastProgress = animationElapsed / fastPhaseEnd;
                const targetDiff = 5000; // +5秒の位置
                
                // イージング関数で減速効果を追加
                const easedProgress = 1 - Math.pow(1 - fastProgress, 2);
                
                if (originalOverdueTime > targetDiff) {
                    diff = -originalOverdueTime + (originalOverdueTime - targetDiff) * easedProgress;
                } else {
                    // 元々5秒以下の場合はそのまま
                    diff = -originalOverdueTime;
                }
            } else {
                // 低速フェーズ：1.5秒で+5秒から0まで
                const slowProgress = (animationElapsed - slowPhaseStart) / (duration - slowPhaseStart);
                diff = -5000 * (1 - slowProgress);
            }
        }
    }
    
    // 今から始めるタスクの場合、開始からの経過時間も計算
    let elapsedTime = null;
    if (startType === 'start-now' && startedAt) {
        const started = new Date(startedAt);
        elapsedTime = now.getTime() - started.getTime();
    }
    
    if (diff <= 0) {
        const overdue = Math.abs(diff);
        const days = Math.floor(overdue / (1000 * 60 * 60 * 24));
        const hours = Math.floor((overdue % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((overdue % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((overdue % (1000 * 60)) / 1000);
        const milliseconds = Math.floor(overdue % 1000);
        
        // 期限切れでも1分以内またはアニメーション中の場合は秒数表示
        const showSeconds = (overdue < 60000) || isAnimating;
        
        return {
            expired: true,
            days: days,
            hours: hours,
            minutes: minutes,
            seconds: seconds,
            milliseconds: milliseconds,
            status: "OVERDUE",
            statusClass: "status-overdue",
            cardClass: "overdue",
            elapsedTime: elapsedTime,
            showSeconds: showSeconds
        };
    }
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    const milliseconds = Math.floor(diff % 1000);
    
    // 1分以内またはアニメーション中の場合は秒数も表示
    const showSeconds = (diff < 60000) || isAnimating;
    
    let status = "ON TIME";
    let statusClass = "status-ontime";
    
    if (isAnimating) {
        // アニメーション中の特別なステータス
        status = animationPhase === 'white' ? "COMPLETING" : "FINISHING";
        statusClass = "status-overdue";
    } else if (startType === 'start-now') {
        // 今から始めるタスクは常に "IN PROGRESS" 状態
        status = "IN PROGRESS";
        statusClass = "status-inprogress";
    } else if (days > 0) {
        status = "SCHEDULED";
        statusClass = "status-scheduled";
    } else if (hours > 0) {
        if (hours < 2) {
            status = "URGENT";
            statusClass = "status-urgent";
        } else if (hours < 6) {
            status = "SOON";
            statusClass = "status-soon";
        }
    } else {
        status = "CRITICAL";
        statusClass = "status-critical";
    }
    
    return {
        expired: false,
        days: days,
        hours: hours,
        minutes: minutes,
        seconds: seconds,
        milliseconds: milliseconds,
        status: status,
        statusClass: statusClass,
        cardClass: startType === 'start-now' ? "start-now" : "",
        elapsedTime: elapsedTime,
        showSeconds: showSeconds
    };
}

// プログレスを計算
function calculateProgress(todo) {
    const now = new Date().getTime();
    const deadline = todo.deadline.getTime();
    const created = todo.createdAt.getTime();
    
    const totalDuration = deadline - created;
    const elapsed = now - created;
    const progress = (elapsed / totalDuration) * 100;
    
    // 時間ベースの色分け
    const diff = deadline - now;
    const hoursRemaining = diff / (1000 * 60 * 60);
    const daysRemaining = diff / (1000 * 60 * 60 * 24);
    
    let color = "bg-green";
    if (daysRemaining < 0) {
        color = "bg-red";
    } else if (hoursRemaining < 2) {
        color = "bg-red";
    } else if (hoursRemaining < 6) {
        color = "bg-orange";
    } else if (daysRemaining < 1) {
        color = "bg-yellow";
    } else {
        color = "bg-green";
    }
    
    // 期限切れの場合
    if (now > deadline) {
        const overdue = now - deadline;
        const overdueProgress = Math.min(50, (overdue / totalDuration) * 100);
        return {
            progress: 100 + overdueProgress,
            isOverdue: true,
            color: "bg-red"
        };
    }
    
    return {
        progress: Math.min(100, progress),
        isOverdue: false,
        color: color
    };
}

// 通知音を再生
function playNotificationSound() {
    // Web Audio APIを使用してシンプルな通知音を生成
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // 音の設定
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime); // 800Hz
    oscillator.type = 'sine';
    
    // 音量の設定（フェードイン・フェードアウト）
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.1);
    gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.5);
    
    // 再生
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
}

// NHK時報音（880Hz）を再生
function playTimeChime() {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // NHK時報の周波数（880Hz）
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
    oscillator.type = 'sine';
    
    // 音量の設定（2秒かけてフェードアウト）
    gainNode.gain.setValueAtTime(0.4, audioContext.currentTime);
    gainNode.gain.setValueAtTime(0.4, audioContext.currentTime + 0.5); // 0.5秒間は最大音量を維持
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 2.0); // 1.5秒かけてフェードアウト
    
    // 2秒間再生
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 2.0);
}

// 期限切れをチェックして通知
function checkDeadlines() {
    const now = new Date();
    
    todos.forEach(todo => {
        if (todo.archived) return;
        
        const timeRemaining = todo.deadline.getTime() - now.getTime();
        
        // 事前通知をチェック
        if (todo.notify && !preNotifiedTodos.has(todo.id)) {
            const notifyTime = todo.notify * 60 * 1000; // 分をミリ秒に変換
            if (timeRemaining > 0 && timeRemaining <= notifyTime && timeRemaining > notifyTime - 60000) {
                preNotifiedTodos.add(todo.id);
                showPreNotification(todo, Math.floor(timeRemaining / 60000));
            }
        }
        
        // 期限切れになったばかりのタスクをチェック（±2秒の範囲）
        if (timeRemaining <= 0 && timeRemaining > -2000 && !notifiedTodos.has(todo.id)) {
            notifiedTodos.add(todo.id);
            playNotificationSound();
        }
    });
}

// Todoをレンダリング
function renderTodos() {
    // 期限切れチェック
    checkDeadlines();
    
    // フィルタリング
    let filteredTodos = [...todos];
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // アニメーション中のタスクは別処理（フィルタリング前に抽出）
    const animatingTodos = todos.filter(todo => todo.isAnimating);
    
    // 通常のタスクのみフィルタリング
    filteredTodos = filteredTodos.filter(todo => !todo.isAnimating);
    
    switch (currentFilter) {
        case 'active':
            filteredTodos = filteredTodos.filter(todo => !todo.archived);
            break;
        case 'today':
            filteredTodos = filteredTodos.filter(todo => {
                if (todo.archived) return false;
                const deadline = new Date(todo.deadline);
                return deadline >= today && deadline < tomorrow;
            });
            break;
        case 'tomorrow':
            const dayAfterTomorrow = new Date(tomorrow);
            dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);
            filteredTodos = filteredTodos.filter(todo => {
                if (todo.archived) return false;
                const deadline = new Date(todo.deadline);
                return deadline >= tomorrow && deadline < dayAfterTomorrow;
            });
            break;
        case 'completed':
            filteredTodos = filteredTodos.filter(todo => todo.archived);
            // 完了日時でソート（新しい順）
            filteredTodos.sort((a, b) => {
                const aDate = a.archivedAt ? new Date(a.archivedAt) : new Date();
                const bDate = b.archivedAt ? new Date(b.archivedAt) : new Date();
                return bDate - aDate;
            });
            break;
    }
    
    // 期限でソート（期限切れを最上部に、時間が過ぎているものほど上に）
    const sortedTodos = filteredTodos.sort((a, b) => {
        const aTime = formatTimeRemaining(a.deadline);
        const bTime = formatTimeRemaining(b.deadline);
        
        // 両方期限切れの場合、より過去のものを上に
        if (aTime.expired && bTime.expired) {
            return a.deadline.getTime() - b.deadline.getTime();
        }
        
        // 片方だけ期限切れの場合、期限切れを上に
        if (aTime.expired && !bTime.expired) return -1;
        if (!aTime.expired && bTime.expired) return 1;
        
        // 両方期限前の場合、期限が近いものを上に
        return a.deadline.getTime() - b.deadline.getTime();
    });
    
    todoContainer.innerHTML = '';
    
    // 完了済みタブの場合は日付ごとにグループ化して表示
    if (currentFilter === 'completed') {
        // 日付ごとにグループ化
        const groupedByDate = {};
        filteredTodos.forEach(todo => {
            const archivedDate = todo.archivedAt ? new Date(todo.archivedAt) : new Date();
            const dateKey = archivedDate.toLocaleDateString('ja-JP');
            if (!groupedByDate[dateKey]) {
                groupedByDate[dateKey] = [];
            }
            groupedByDate[dateKey].push(todo);
        });
        
        // 日付ごとに表示（新しい日付順にソート）
        const sortedDates = Object.entries(groupedByDate).sort((a, b) => {
            // 日付文字列を比較用のDateオブジェクトに変換
            const dateA = new Date(a[0].replace(/\//g, '-'));
            const dateB = new Date(b[0].replace(/\//g, '-'));
            return dateB - dateA; // 新しい日付が先
        });
        
        sortedDates.forEach(([dateKey, tasks]) => {
            const section = document.createElement('div');
            section.className = 'completed-date-section';
            
            const header = document.createElement('h3');
            header.className = 'completed-date-header';
            header.textContent = `${dateKey}（${tasks.length}件）`;
            section.appendChild(header);
            
            const taskList = document.createElement('div');
            taskList.className = 'completed-task-list';
            
            tasks.forEach(task => {
                const completedTime = task.archivedAt ? new Date(task.archivedAt) : new Date();
                const timeStr = `${String(completedTime.getHours()).padStart(2, '0')}:${String(completedTime.getMinutes()).padStart(2, '0')}`;
                const originalDeadline = new Date(task.deadline);
                const deadlineStr = `${String(originalDeadline.getHours()).padStart(2, '0')}:${String(originalDeadline.getMinutes()).padStart(2, '0')}`;
                
                const taskItem = document.createElement('div');
                taskItem.className = 'completed-task-item';
                taskItem.dataset.todoId = task.id;
                taskItem.innerHTML = `
                    <div class="completed-task-info">
                        <span class="completed-check">✓</span>
                        <span class="completed-task-title">${escapeHtml(task.title)}</span>
                    </div>
                    <div class="completed-task-times">
                        <span class="deadline-time">期限: ${deadlineStr}</span>
                        <span class="completed-time">完了: ${timeStr}</span>
                    </div>
                `;
                
                // クリックイベントを追加
                taskItem.addEventListener('click', () => {
                    openEditModal(task.id);
                });
                
                taskList.appendChild(taskItem);
            });
            
            section.appendChild(taskList);
            todoContainer.appendChild(section);
        });
        return;
    }
    
    // アニメーション中のタスクを最初に表示
    animatingTodos.forEach(todo => {
        const timeInfo = formatTimeRemaining(
            todo.deadline, 
            todo.startType, 
            todo.startedAt,
            todo.isAnimating,
            todo.animationStartTime,
            todo.animationPhase,
            todo.originalOverdueTime,
            todo.animationDuration
        );
        const progressInfo = calculateProgress(todo);
        
        const todoCard = document.createElement('div');
        let cardClasses = `todo-card ${timeInfo.cardClass} ${todo.archived ? 'archived' : ''}`;
        
        // ルーティンタスクのクラス
        if (todo.isRoutine) {
            cardClasses += ' routine-task';
        }
        
        // アニメーション中の特別なクラス
        if (todo.isAnimating) {
            cardClasses += ' animating';
            if (todo.animationPhase === 'white') {
                cardClasses += ' animation-white';
            }
        }
        
        todoCard.className = cardClasses;
        todoCard.dataset.todoId = todo.id;
        
        // アニメーション中のタスクの表示
        const deadline = new Date(todo.deadline);
        todoCard.innerHTML = `
            <!-- カード上部 -->
            <div class="todo-header">
                <div class="todo-header-left">
                    <h3 class="todo-title">${todo.title}</h3>
                    <span class="todo-status ${timeInfo.statusClass}">${timeInfo.status}</span>
                </div>
                <div class="todo-deadline">
                    ${deadline.toLocaleDateString('ja-JP', {
                        month: '2-digit',
                        day: '2-digit'
                    })} ${deadline.toLocaleTimeString('ja-JP', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false
                    })}
                </div>
            </div>
            
            <!-- カウントダウン表示 -->
            <div class="countdown-display">
                <div class="countdown-time ${timeInfo.expired ? 'expired' : ''}">
                    ${timeInfo.expired && todo.animationPhase !== 'white' ? '-' : '+'}${timeInfo.showSeconds ? 
                        `${String(timeInfo.minutes).padStart(2, '0')}:${String(timeInfo.seconds).padStart(2, '0')}.${String(Math.floor(timeInfo.milliseconds / 10)).padStart(2, '0')}` :
                        `${String(timeInfo.days).padStart(2, '0')}d${String(timeInfo.hours).padStart(2, '0')}h${String(timeInfo.minutes).padStart(2, '0')}m`
                    }
                </div>
            </div>
        `;
        
        todoContainer.appendChild(todoCard);
    });
    
    // 通常のタスクを表示
    sortedTodos.forEach(todo => {
        const timeInfo = formatTimeRemaining(
            todo.deadline, 
            todo.startType, 
            todo.startedAt,
            false, // isAnimating
            null,  // animationStartTime
            null,  // animationPhase
            null,  // originalOverdueTime
            null   // animationDuration
        );
        const progressInfo = calculateProgress(todo);
        
        const todoCard = document.createElement('div');
        let cardClasses = `todo-card ${timeInfo.cardClass} ${todo.archived ? 'archived' : ''}`;
        
        // ルーティンタスクのクラス
        if (todo.isRoutine) {
            cardClasses += ' routine-task';
        }
        
        // アニメーション中の特別なクラス
        if (todo.isAnimating) {
            cardClasses += ' animating';
            if (todo.animationPhase === 'white') {
                cardClasses += ' animation-white';
            }
        }
        
        todoCard.className = cardClasses;
        todoCard.dataset.todoId = todo.id;
        
        // アニメーション中はクリックを無効化
        if (!todo.isAnimating) {
            todoCard.addEventListener('click', (e) => {
                // カウントダウン表示部分のクリックを無視
                if (e.target.closest('.countdown-display')) {
                    e.stopPropagation();
                    return;
                }
                openEditModal(todo.id);
            });
        }
        
        if (todo.archived) {
            // アーカイブ済みタスクの表示
            todoCard.innerHTML = `
                <!-- カード上部 -->
                <div class="todo-header">
                    <div class="todo-header-left">
                        <h3 class="todo-title">${todo.title}</h3>
                        ${todo.repeat ? `<span class="todo-repeat-tag">${getRepeatText(todo.repeat)}</span>` : ''}
                        ${todo.notify ? '<span class="todo-notify-tag">通知</span>' : ''}
                        ${todo.memo ? '<span class="todo-memo-tag">MEMO</span>' : ''}
                    </div>
                    <div class="todo-deadline">
                        ${todo.deadline.toLocaleDateString('ja-JP', {
                            month: '2-digit',
                            day: '2-digit'
                        })} ${todo.deadline.toLocaleTimeString('ja-JP', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false
                        })}
                    </div>
                </div>
            `;
        } else {
            // アクティブタスクの表示
            todoCard.innerHTML = `
                <!-- カード上部 -->
                <div class="todo-header">
                    <div class="todo-header-left">
                        <h3 class="todo-title">${todo.title}</h3>
                        <span class="todo-status ${timeInfo.statusClass}">${timeInfo.status}</span>
                        ${todo.repeat ? `<span class="todo-repeat-tag">${getRepeatText(todo.repeat)}</span>` : ''}
                        ${todo.notify ? '<span class="todo-notify-tag">通知</span>' : ''}
                        ${todo.memo ? '<span class="todo-memo-tag">MEMO</span>' : ''}
                    </div>
                    <div class="todo-deadline">
                        ${todo.deadline.toLocaleDateString('ja-JP', {
                            month: '2-digit',
                            day: '2-digit'
                        })} ${todo.deadline.toLocaleTimeString('ja-JP', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false
                        })}
                    </div>
                </div>
                
                <!-- プログレスバー -->
                <div class="progress-container">
                    <div class="progress-bar">
                        <div class="progress-fill ${progressInfo.color}"
                             style="width: ${Math.min(100, progressInfo.progress)}%"></div>
                    </div>
                </div>
                
                <!-- カウントダウン表示 -->
                <div class="countdown-display">
                    <div class="countdown-time ${timeInfo.expired ? 'expired' : ''}">
                        ${timeInfo.expired ? '-' : '+'}${timeInfo.showSeconds ? 
                            `${String(timeInfo.minutes).padStart(2, '0')}:${String(timeInfo.seconds).padStart(2, '0')}.${String(Math.floor(timeInfo.milliseconds / 10)).padStart(2, '0')}` :
                            `${String(timeInfo.days).padStart(2, '0')}d${String(timeInfo.hours).padStart(2, '0')}h${String(timeInfo.minutes).padStart(2, '0')}m`
                        }
                    </div>
                    ${todo.startType === 'start-now' && todo.startedAt ? `
                        <div class="todo-started-at">
                            開始: ${new Date(todo.startedAt).toLocaleTimeString('ja-JP', {
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: false
                            })}
                        </div>
                    ` : ''}
                </div>
            `;
        }
        
        todoContainer.appendChild(todoCard);
    });
    
}

// カレンダーをセットアップ
function setupCalendar() {
    // 前月ボタン
    prevMonthBtn.addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
        updateCalendar();
    });
    
    // 次月ボタン
    nextMonthBtn.addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
        updateCalendar();
    });
    
    // 時間変更時
    modalTodoTimeInput.addEventListener('change', updateSelectedDateTime);
    
    // 現在の日時ボタン
    const setNowBtn = document.getElementById('setNowDateTime');
    setNowBtn.addEventListener('click', () => {
        const now = new Date();
        selectedDate = new Date(now);
        currentCalendarDate = new Date(now);
        
        // 時刻を設定
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        modalTodoTimeInput.value = `${hours}:${minutes}`;
        
        updateCalendar();
        updateSelectedDateTime();
    });
    
    // 今日20時ボタン
    const setToday20Btn = document.getElementById('setToday20');
    setToday20Btn.addEventListener('click', () => {
        const now = new Date();
        selectedDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        currentCalendarDate = new Date(selectedDate);
        
        // 時刻を20:00に設定
        modalTodoTimeInput.value = '20:00';
        
        updateCalendar();
        updateSelectedDateTime();
    });
    
    // 時間追加ボタン
    document.querySelectorAll('.time-add-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const minutesToAdd = parseInt(e.target.dataset.minutes);
            addTimeToDeadline(minutesToAdd);
        });
    });
}

// カレンダーを更新
function updateCalendar() {
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    
    // 月年を表示
    currentMonthYearElement.textContent = `${year}年${month + 1}月`;
    
    // カレンダーグリッドをクリア
    calendarGrid.innerHTML = '';
    
    // 曜日ヘッダー
    const weekDays = ['日', '月', '火', '水', '木', '金', '土'];
    weekDays.forEach(day => {
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day header';
        dayElement.textContent = day;
        calendarGrid.appendChild(dayElement);
    });
    
    // 月の最初の日と最後の日を取得
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const prevLastDay = new Date(year, month, 0);
    
    // 前月の日付を埋める
    const firstDayOfWeek = firstDay.getDay();
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
        const day = prevLastDay.getDate() - i;
        const dayElement = createDayElement(new Date(year, month - 1, day), true);
        calendarGrid.appendChild(dayElement);
    }
    
    // 今月の日付
    const today = new Date();
    for (let day = 1; day <= lastDay.getDate(); day++) {
        const date = new Date(year, month, day);
        const dayElement = createDayElement(date, false);
        
        // 今日の日付をハイライト
        if (date.toDateString() === today.toDateString()) {
            dayElement.classList.add('today');
        }
        
        // 選択された日付をハイライト
        if (date.toDateString() === selectedDate.toDateString()) {
            dayElement.classList.add('selected');
        }
        
        calendarGrid.appendChild(dayElement);
    }
    
    // 次月の日付を埋める
    const remainingDays = 42 - calendarGrid.children.length + 7; // 曜日ヘッダー分を引く
    for (let day = 1; day <= remainingDays; day++) {
        const dayElement = createDayElement(new Date(year, month + 1, day), true);
        calendarGrid.appendChild(dayElement);
    }
}

// 日付要素を作成
function createDayElement(date, isOtherMonth) {
    const dayElement = document.createElement('div');
    dayElement.className = 'calendar-day';
    if (isOtherMonth) {
        dayElement.classList.add('other-month');
    }
    dayElement.textContent = date.getDate();
    
    dayElement.addEventListener('click', () => {
        selectedDate = new Date(date);
        updateCalendar();
        updateSelectedDateTime();
    });
    
    return dayElement;
}

// 選択された日時を更新
function updateSelectedDateTime() {
    const time = modalTodoTimeInput.value;
    const [hours, minutes] = time.split(':');
    
    const deadline = new Date(selectedDate);
    deadline.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    
    modalTodoDeadlineInput.value = deadline.toISOString();
}

// 期限に時間を追加
function addTimeToDeadline(minutes) {
    // 現在の選択された日時を取得
    const time = modalTodoTimeInput.value;
    const [hours, mins] = time.split(':');
    
    const deadline = new Date(selectedDate);
    deadline.setHours(parseInt(hours), parseInt(mins), 0, 0);
    
    // 時間を追加
    deadline.setMinutes(deadline.getMinutes() + minutes);
    
    // 日付が変わった場合は選択日付も更新
    if (deadline.toDateString() !== selectedDate.toDateString()) {
        selectedDate = new Date(deadline);
        currentCalendarDate = new Date(deadline);
        updateCalendar();
    }
    
    // 時刻フィールドを更新
    const newHours = String(deadline.getHours()).padStart(2, '0');
    const newMinutes = String(deadline.getMinutes()).padStart(2, '0');
    modalTodoTimeInput.value = `${newHours}:${newMinutes}`;
    
    // 隠しフィールドを更新
    modalTodoDeadlineInput.value = deadline.toISOString();
}

// メモプレビューを更新
function updateMemoPreview() {
    const memoText = document.getElementById('editTodoMemo').value;
    const preview = document.getElementById('editMemoPreview');
    
    if (memoText) {
        preview.innerHTML = parseMemoMarkdown(memoText);
    } else {
        preview.innerHTML = '<p style="color: #666; text-align: center;">メモがありません</p>';
    }
}

// タブの初期化
function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.getAttribute('data-tab');
            switchToTab(tabName);
        });
    });
}

// タブ切り替え
function switchToTab(tabName) {
    // タブボタンの切り替え
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
    });
    
    // タブコンテンツの切り替え
    document.getElementById('editTab').classList.toggle('active', tabName === 'edit');
    document.getElementById('memoTab').classList.toggle('active', tabName === 'memo');
    
    // メモタブが選択された時はプレビューを更新
    if (tabName === 'memo') {
        updateMemoPreview();
    }
}

// ページ離脱時の処理
window.addEventListener('beforeunload', () => {
    if (syncInterval) {
        clearInterval(syncInterval);
    }
    if (window.isCountdownAnimationActive) {
        window.isCountdownAnimationActive = false;
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }
    }
});

// フィルタータブのセットアップ
function setupFilterTabs() {
    const filterTabs = document.querySelectorAll('.filter-tab');
    
    filterTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            // アクティブタブの切り替え
            filterTabs.forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            
            // フィルターを更新
            currentFilter = e.target.dataset.filter;
            
            // 表示の切り替え
            if (currentFilter === 'stats') {
                todoContainer.style.display = 'none';
                statsContainer.style.display = 'block';
                weeklyViewContainer.style.display = 'none';
                scheduleContainer.style.display = 'none';
                // 統計タブを開いた時に最新の統計情報を読み込む
                loadUserStats().then(() => renderStats());
            } else if (currentFilter === 'weekly') {
                todoContainer.style.display = 'none';
                statsContainer.style.display = 'none';
                weeklyViewContainer.style.display = 'block';
                scheduleContainer.style.display = 'none';
                renderWeeklyView();
            } else if (currentFilter === 'schedule') {
                todoContainer.style.display = 'none';
                statsContainer.style.display = 'none';
                weeklyViewContainer.style.display = 'none';
                scheduleContainer.style.display = 'block';
                loadPresets().then(() => renderScheduleView());
            } else {
                todoContainer.style.display = 'flex';
                statsContainer.style.display = 'none';
                weeklyViewContainer.style.display = 'none';
                scheduleContainer.style.display = 'none';
                renderTodos();
            }
        });
    });
}

// 統計を計算して表示
function renderStats() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    
    // 全タスクの統計
    const totalTasks = todos.length;
    const activeTasks = todos.filter(t => !t.archived).length;
    const completedTasks = todos.filter(t => t.archived).length;
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    
    // 期限切れタスク
    const overdueTasks = todos.filter(t => !t.archived && new Date(t.deadline) < now).length;
    
    // 今日のタスク
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const todayTasks = todos.filter(t => {
        const deadline = new Date(t.deadline);
        return !t.archived && deadline >= today && deadline < tomorrow;
    }).length;
    
    // 明日のタスク数
    const dayAfterTomorrow = new Date(tomorrow);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);
    const tomorrowTasks = todos.filter(t => {
        const deadline = new Date(t.deadline);
        return !t.archived && deadline >= tomorrow && deadline < dayAfterTomorrow;
    }).length;
    
    // 期間別の完了数
    const completedThisWeek = todos.filter(t => {
        if (!t.archived || !t.archivedAt) return false;
        const archivedDate = new Date(t.archivedAt);
        return archivedDate >= weekAgo;
    }).length;
    
    const completedThisMonth = todos.filter(t => {
        if (!t.archived || !t.archivedAt) return false;
        const archivedDate = new Date(t.archivedAt);
        return archivedDate >= monthAgo;
    }).length;
    
    // 繰り返しタスクの統計
    const repeatTasks = todos.filter(t => t.repeat).length;
    const repeatTypes = {};
    todos.filter(t => t.repeat).forEach(t => {
        repeatTypes[t.repeat] = (repeatTypes[t.repeat] || 0) + 1;
    });
    
    // 平均タスク完了時間（作成から完了まで）
    const completedTasksWithTime = todos.filter(t => t.archived && t.archivedAt && t.createdAt);
    const avgCompletionTime = completedTasksWithTime.length > 0 
        ? completedTasksWithTime.reduce((sum, t) => {
            const created = new Date(t.createdAt);
            const archived = new Date(t.archivedAt);
            return sum + (archived - created);
        }, 0) / completedTasksWithTime.length
        : 0;
    const avgCompletionDays = Math.round(avgCompletionTime / (1000 * 60 * 60 * 24) * 10) / 10;
    
    // 遅延率（期限後に完了したタスクの割合）
    const delayedCompletions = completedTasksWithTime.filter(t => {
        const deadline = new Date(t.deadline);
        const archived = new Date(t.archivedAt);
        return archived > deadline;
    }).length;
    const delayRate = completedTasksWithTime.length > 0 
        ? Math.round((delayedCompletions / completedTasksWithTime.length) * 100)
        : 0;
    
    // メモ付きタスクの割合
    const tasksWithMemo = todos.filter(t => t.memo && t.memo.trim()).length;
    const memoRate = totalTasks > 0 ? Math.round((tasksWithMemo / totalTasks) * 100) : 0;
    
    // 通知設定の利用率
    const tasksWithNotify = todos.filter(t => t.notify).length;
    const notifyRate = totalTasks > 0 ? Math.round((tasksWithNotify / totalTasks) * 100) : 0;
    
    // 今週の残タスク時間合計
    const weekFromNow = new Date(today);
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    const upcomingWeekTasks = todos.filter(t => {
        const deadline = new Date(t.deadline);
        return !t.archived && deadline >= now && deadline <= weekFromNow;
    }).length;
    
    // 時間帯別の完了統計
    const completionsByHour = new Array(24).fill(0);
    const completionsByDayOfWeek = new Array(7).fill(0);
    
    completedTasksWithTime.forEach(t => {
        const archived = new Date(t.archivedAt);
        completionsByHour[archived.getHours()]++;
        completionsByDayOfWeek[archived.getDay()]++;
    });
    
    // 最も生産的な時間帯
    const maxHourCompletions = Math.max(...completionsByHour);
    const mostProductiveHour = completionsByHour.indexOf(maxHourCompletions);
    const timeRanges = {
        morning: completionsByHour.slice(5, 9).reduce((a, b) => a + b, 0),   // 5-9時
        daytime: completionsByHour.slice(9, 17).reduce((a, b) => a + b, 0),  // 9-17時
        evening: completionsByHour.slice(17, 22).reduce((a, b) => a + b, 0), // 17-22時
        night: completionsByHour.slice(22, 24).concat(completionsByHour.slice(0, 5)).reduce((a, b) => a + b, 0) // 22-5時
    };
    
    // 最も生産的な曜日
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    const maxDayCompletions = Math.max(...completionsByDayOfWeek);
    const mostProductiveDay = completionsByDayOfWeek.indexOf(maxDayCompletions);
    
    // 連続完了日数（ストリーク）の計算
    let currentStreak = 0;
    let longestStreak = 0;
    let lastCompletionDate = null;
    
    // 完了タスクを日付順にソート
    const sortedCompletions = completedTasksWithTime
        .sort((a, b) => new Date(a.archivedAt) - new Date(b.archivedAt));
    
    sortedCompletions.forEach(t => {
        const archivedDate = new Date(t.archivedAt);
        const dateOnly = new Date(archivedDate.getFullYear(), archivedDate.getMonth(), archivedDate.getDate());
        
        if (!lastCompletionDate) {
            currentStreak = 1;
            lastCompletionDate = dateOnly;
        } else {
            const dayDiff = Math.floor((dateOnly - lastCompletionDate) / (1000 * 60 * 60 * 24));
            
            if (dayDiff === 0) {
                // 同じ日
            } else if (dayDiff === 1) {
                // 連続
                currentStreak++;
            } else {
                // 連続が途切れた
                longestStreak = Math.max(longestStreak, currentStreak);
                currentStreak = 1;
            }
            lastCompletionDate = dateOnly;
        }
    });
    longestStreak = Math.max(longestStreak, currentStreak);
    
    // 今日完了したかチェック（現在のストリーク計算用）
    const todayCompleted = sortedCompletions.some(t => {
        const archivedDate = new Date(t.archivedAt);
        return archivedDate >= today && archivedDate < tomorrow;
    });
    
    // 昨日完了したかチェック
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayCompleted = sortedCompletions.some(t => {
        const archivedDate = new Date(t.archivedAt);
        return archivedDate >= yesterday && archivedDate < today;
    });
    
    // 現在のストリークを計算
    let activeStreak = 0;
    if (todayCompleted || yesterdayCompleted) {
        activeStreak = 1;
        let checkDate = new Date(today);
        if (!todayCompleted) {
            checkDate = yesterday;
        }
        
        // 過去に遡ってストリークを数える
        for (let i = 1; i < 365; i++) {
            checkDate.setDate(checkDate.getDate() - 1);
            const hasCompletion = sortedCompletions.some(t => {
                const archivedDate = new Date(t.archivedAt);
                const dateOnly = new Date(archivedDate.getFullYear(), archivedDate.getMonth(), archivedDate.getDate());
                return dateOnly.getTime() === checkDate.getTime();
            });
            
            if (hasCompletion) {
                activeStreak++;
            } else {
                break;
            }
        }
    }
    
    // タスクの緊急度分布
    const urgencyDistribution = {
        overdue: overdueTasks,
        today: todayTasks,
        tomorrow: tomorrowTasks,
        thisWeek: upcomingWeekTasks - todayTasks - tomorrowTasks,
        later: activeTasks - overdueTasks - upcomingWeekTasks
    };
    
    // タスク分析
    const taskAnalysis = analyzeTaskNames(todos);
    const wordFrequency = taskAnalysis.wordFrequency;
    const avgLength = taskAnalysis.avgLength;
    const longestTask = taskAnalysis.longest;
    const shortestTask = taskAnalysis.shortest;
    const taskCategories = taskAnalysis.categories;
    
    // グラフ描画関数
    function renderWeeklyGraph() {
        // 過去7日間の完了数を計算
        const completionsByDay = new Array(7).fill(0);
        const dayLabels = [];
        
        for (let i = 6; i >= 0; i--) {
            const checkDate = new Date(today);
            checkDate.setDate(checkDate.getDate() - i);
            const nextDate = new Date(checkDate);
            nextDate.setDate(nextDate.getDate() + 1);
            
            const dayCompletions = completedTasksWithTime.filter(t => {
                const archived = new Date(t.archivedAt);
                return archived >= checkDate && archived < nextDate;
            }).length;
            
            completionsByDay[6 - i] = dayCompletions;
            dayLabels[6 - i] = `${checkDate.getDate()}`;
        }
        
        const maxValue = Math.max(...completionsByDay, 1);
        const barHeight = 4;
        
        let graph = '<div class="ascii-graph">';
        
        // グラフ本体
        for (let h = barHeight; h > 0; h--) {
            graph += '<div class="graph-row">';
            for (let d = 0; d < 7; d++) {
                const value = completionsByDay[d];
                const barLevel = Math.ceil((value / maxValue) * barHeight);
                if (barLevel >= h) {
                    graph += '<span class="bar-filled">█</span>';
                } else {
                    graph += '<span class="bar-empty">░</span>';
                }
            }
            graph += '</div>';
        }
        
        // 日付ラベル
        graph += '<div class="graph-labels">';
        dayLabels.forEach(label => {
            graph += `<span class="graph-label">${label}</span>`;
        });
        graph += '</div>';
        
        // 値表示
        graph += '<div class="graph-values">';
        completionsByDay.forEach(val => {
            graph += `<span class="graph-value">${val}</span>`;
        });
        graph += '</div>';
        
        graph += '</div>';
        return graph;
    }
    
    function renderDeadlineChart(distribution) {
        const total = Object.values(distribution).reduce((a, b) => a + b, 0);
        if (total === 0) return '<div class="no-data">データなし</div>';
        
        let chart = '<div class="deadline-chart">';
        
        const items = [
            { label: '期限切れ', value: distribution.overdue, color: 'chart-red' },
            { label: '今日', value: distribution.today, color: 'chart-orange' },
            { label: '明日', value: distribution.tomorrow, color: 'chart-yellow' },
            { label: '今週', value: distribution.thisWeek, color: 'chart-green' },
            { label: 'それ以降', value: distribution.later, color: 'chart-blue' }
        ];
        
        items.forEach(item => {
            if (item.value > 0) {
                const percentage = Math.round((item.value / total) * 100);
                const barWidth = Math.round((item.value / total) * 15);
                
                chart += '<div class="chart-item">';
                chart += `<span class="chart-label">${item.label}:</span>`;
                chart += `<span class="chart-bar ${item.color}">`;
                chart += '█'.repeat(barWidth) + '░'.repeat(15 - barWidth);
                chart += '</span>';
                chart += `<span class="chart-percent">${percentage}%</span>`;
                chart += '</div>';
            }
        });
        
        chart += '</div>';
        return chart;
    }
    
    function renderProgressMeter(rate, active, completed) {
        const meterWidth = 15;
        const filledWidth = Math.round((rate / 100) * meterWidth);
        
        let meter = '<div class="progress-meter">';
        
        // 大きな数字で完了率を表示
        meter += `<div class="big-percentage">${rate}%</div>`;
        
        // プログレスバー
        meter += '<div class="meter-bar">';
        meter += '<span class="meter-filled">' + '█'.repeat(filledWidth) + '</span>';
        meter += '<span class="meter-empty">' + '░'.repeat(meterWidth - filledWidth) + '</span>';
        meter += '</div>';
        
        // 詳細情報
        meter += '<div class="meter-details">';
        meter += `<span class="detail-item">完了: ${completed}</span>`;
        meter += `<span class="detail-separator">|</span>`;
        meter += `<span class="detail-item">残り: ${active}</span>`;
        meter += '</div>';
        
        // モチベーションメッセージ
        let message = '';
        if (rate >= 80) {
            message = '素晴らしい達成率です！';
        } else if (rate >= 60) {
            message = '順調に進んでいます！';
        } else if (rate >= 40) {
            message = 'その調子で頑張りましょう！';
        } else if (rate >= 20) {
            message = '一歩ずつ前進しています！';
        } else {
            message = '今日から始めましょう！';
        }
        meter += `<div class="motivation-message">${message}</div>`;
        
        meter += '</div>';
        return meter;
    }
    
    // HTML生成
    statsContainer.innerHTML = `
        <div class="stats-grid">
            ${userStats ? `
            <div class="stat-card" style="grid-column: span 2;">
                <h3 class="stat-title">🎮 ゲーミフィケーション</h3>
                <div class="stat-content">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;">
                        <div>
                            <div style="font-size: 32px; font-weight: bold;">Lv.${userStats.level}</div>
                            <div style="font-size: 18px; color: #fbbf24;">${userStats.rank}</div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 14px; color: #888;">次のレベルまで</div>
                            <div style="font-size: 20px; font-weight: bold;">${Math.pow(userStats.level, 2) * 50 - userStats.exp} EXP</div>
                        </div>
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <div style="display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 5px; font-family: monospace;">
                            <span>EXP: ${userStats.exp}</span>
                            <span>${Math.pow(userStats.level, 2) * 50}</span>
                        </div>
                        <div style="
                            background: #1a1a1a;
                            height: 24px;
                            border: 3px solid #333;
                            position: relative;
                            image-rendering: pixelated;
                            image-rendering: -moz-crisp-edges;
                            image-rendering: crisp-edges;
                            box-shadow: 
                                0 0 0 1px #000,
                                inset 0 0 0 1px rgba(255,255,255,0.1);
                        ">
                            <div style="
                                background: repeating-linear-gradient(
                                    90deg,
                                    #60a5fa 0px,
                                    #60a5fa 3px,
                                    #3b82f6 3px,
                                    #3b82f6 6px,
                                    #2563eb 6px,
                                    #2563eb 9px,
                                    #3b82f6 9px,
                                    #3b82f6 12px
                                );
                                height: 100%;
                                width: ${((userStats.exp - Math.pow(userStats.level - 1, 2) * 50) / (Math.pow(userStats.level, 2) * 50 - Math.pow(userStats.level - 1, 2) * 50)) * 100}%;
                                transition: width 0.3s;
                                position: relative;
                            ">
                                <div style="
                                    position: absolute;
                                    top: 0;
                                    left: 0;
                                    right: 0;
                                    height: 3px;
                                    background: linear-gradient(to bottom, rgba(255,255,255,0.5), transparent);
                                "></div>
                                <div style="
                                    position: absolute;
                                    bottom: 0;
                                    left: 0;
                                    right: 0;
                                    height: 3px;
                                    background: linear-gradient(to top, rgba(0,0,0,0.5), transparent);
                                "></div>
                                <div style="
                                    position: absolute;
                                    right: 0;
                                    top: 0;
                                    bottom: 0;
                                    width: 6px;
                                    background: linear-gradient(to left, rgba(255,255,255,0.6), transparent);
                                    animation: expBarGlow 2s ease-in-out infinite;
                                "></div>
                            </div>
                            ${Array.from({length: 20}, (_, i) => `
                                <div style="
                                    position: absolute;
                                    left: ${i * 5}%;
                                    top: 0;
                                    bottom: 0;
                                    width: 1px;
                                    background: rgba(0,0,0,0.2);
                                    ${i === 0 ? 'display: none;' : ''}
                                "></div>
                            `).join('')}
                        </div>
                    </div>
                    
                    <div class="stat-item">
                        <span class="stat-label">🔥 連続記録:</span>
                        <span class="stat-value">${userStats.streakDays}日</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">✅ 総完了数:</span>
                        <span class="stat-value">${userStats.totalCompleted}タスク</span>
                    </div>
                    
                    ${userStats.badges && userStats.badges.length > 0 ? `
                        <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                            <div style="font-size: 16px; font-weight: bold; margin-bottom: 10px;">獲得バッジ (${userStats.badges.length}個)</div>
                            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(60px, 1fr)); gap: 10px;">
                                ${userStats.badges.map(badge => {
                                    const info = getBadgeInfo(badge);
                                    return `<div title="${info.name}\n${info.description}" style="text-align: center; cursor: help;">
                                        <span style="font-size: 32px;">${info.icon}</span>
                                    </div>`;
                                }).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
            ` : ''}
            
            <div class="stat-card">
                <h3 class="stat-title">全体の統計</h3>
                <div class="stat-content">
                    <div class="stat-item">
                        <span class="stat-label">総タスク数:</span>
                        <span class="stat-value">${totalTasks}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">アクティブ:</span>
                        <span class="stat-value">${activeTasks}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">完了済み:</span>
                        <span class="stat-value">${completedTasks}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">完了率:</span>
                        <span class="stat-value">${completionRate}%</span>
                    </div>
                </div>
            </div>
            
            <div class="stat-card">
                <h3 class="stat-title">期限の統計</h3>
                <div class="stat-content">
                    <div class="stat-item">
                        <span class="stat-label">期限切れ:</span>
                        <span class="stat-value ${overdueTasks > 0 ? 'text-red' : ''}">${overdueTasks}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">今日の期限:</span>
                        <span class="stat-value">${todayTasks}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">明日の期限:</span>
                        <span class="stat-value">${tomorrowTasks}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">今週の予定:</span>
                        <span class="stat-value">${upcomingWeekTasks}</span>
                    </div>
                </div>
            </div>
            
            <div class="stat-card">
                <h3 class="stat-title">📝 タスク分析</h3>
                <div class="stat-content">
                    ${wordFrequency.length > 0 ? `
                    <div style="margin-bottom: 15px;">
                        <div style="font-size: 14px; font-weight: bold; margin-bottom: 8px;">よく使う単語 TOP5</div>
                        <div style="font-size: 12px;">
                            ${wordFrequency.map((item, index) => `
                                <div style="display: flex; justify-content: space-between; padding: 3px 0;">
                                    <span>${index + 1}. ${item.word}</span>
                                    <span style="color: #888;">${item.count}回</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    ` : '<div style="color: #888; font-size: 12px;">データが不足しています</div>'}
                    
                    <div class="stat-item">
                        <span class="stat-label">平均文字数:</span>
                        <span class="stat-value">${avgLength}文字</span>
                    </div>
                    
                    ${longestTask ? `
                    <div style="margin-top: 10px; padding: 8px; background: rgba(0,0,0,0.1); border-radius: 5px;">
                        <div style="font-size: 12px; color: #888; margin-bottom: 3px;">最長タスク名 (${longestTask.length}文字)</div>
                        <div style="font-size: 11px; word-break: break-all;">${longestTask}</div>
                    </div>
                    ` : ''}
                    
                    ${taskCategories.totalTasks > 0 ? `
                    <div style="margin-top: 15px;">
                        <div style="font-size: 14px; font-weight: bold; margin-bottom: 8px;">カテゴリ推定</div>
                        <div style="font-size: 12px;">
                            ${taskCategories.work > 0 ? `<div>💼 仕事: ${taskCategories.work}個</div>` : ''}
                            ${taskCategories.personal > 0 ? `<div>🏠 個人: ${taskCategories.personal}個</div>` : ''}
                            ${taskCategories.study > 0 ? `<div>📚 学習: ${taskCategories.study}個</div>` : ''}
                            ${taskCategories.health > 0 ? `<div>💪 健康: ${taskCategories.health}個</div>` : ''}
                            ${taskCategories.other > 0 ? `<div>📌 その他: ${taskCategories.other}個</div>` : ''}
                        </div>
                    </div>
                    ` : ''}
                </div>
            </div>
            
            <div class="stat-card">
                <h3 class="stat-title">作業効率</h3>
                <div class="stat-content">
                    <div class="stat-item">
                        <span class="stat-label">平均完了日数:</span>
                        <span class="stat-value">${avgCompletionDays}日</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">遅延率:</span>
                        <span class="stat-value ${delayRate > 30 ? 'text-red' : ''}">${delayRate}%</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">メモ利用率:</span>
                        <span class="stat-value">${memoRate}%</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">通知利用率:</span>
                        <span class="stat-value">${notifyRate}%</span>
                    </div>
                </div>
            </div>
            
            <div class="stat-card">
                <h3 class="stat-title">完了実績</h3>
                <div class="stat-content">
                    <div class="stat-item">
                        <span class="stat-label">今週:</span>
                        <span class="stat-value">${completedThisWeek}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">今月:</span>
                        <span class="stat-value">${completedThisMonth}</span>
                    </div>
                </div>
            </div>
            
            <div class="stat-card">
                <h3 class="stat-title">繰り返しタスク</h3>
                <div class="stat-content">
                    <div class="stat-item">
                        <span class="stat-label">総数:</span>
                        <span class="stat-value">${repeatTasks}</span>
                    </div>
                    ${Object.entries(repeatTypes).map(([type, count]) => `
                        <div class="stat-item">
                            <span class="stat-label">${getRepeatText(type)}:</span>
                            <span class="stat-value">${count}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div class="stat-card">
                <h3 class="stat-title">週間完了グラフ</h3>
                <div class="stat-content">
                    ${renderWeeklyGraph()}
                </div>
            </div>
            
            <div class="stat-card">
                <h3 class="stat-title">期限分布チャート</h3>
                <div class="stat-content">
                    ${renderDeadlineChart(urgencyDistribution)}
                </div>
            </div>
            
            <div class="stat-card">
                <h3 class="stat-title">進捗メーター</h3>
                <div class="stat-content">
                    ${renderProgressMeter(completionRate, activeTasks, completedTasks)}
                </div>
            </div>
            
            <div class="stat-card">
                <h3 class="stat-title">時間帯分析</h3>
                <div class="stat-content">
                    <div class="stat-item">
                        <span class="stat-label">最も活発な時間:</span>
                        <span class="stat-value">${maxHourCompletions > 0 ? `${mostProductiveHour}時台` : 'データなし'}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">早朝(5-9時):</span>
                        <span class="stat-value">${timeRanges.morning}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">日中(9-17時):</span>
                        <span class="stat-value">${timeRanges.daytime}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">夜間(17-22時):</span>
                        <span class="stat-value">${timeRanges.evening}</span>
                    </div>
                </div>
            </div>
            
            <div class="stat-card">
                <h3 class="stat-title">曜日別分析</h3>
                <div class="stat-content">
                    <div class="stat-item">
                        <span class="stat-label">最も生産的:</span>
                        <span class="stat-value">${maxDayCompletions > 0 ? `${dayNames[mostProductiveDay]}曜日` : 'データなし'}</span>
                    </div>
                    ${dayNames.map((day, index) => `
                        <div class="stat-item">
                            <span class="stat-label">${day}曜日:</span>
                            <span class="stat-value">${completionsByDayOfWeek[index]}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div class="stat-card">
                <h3 class="stat-title">連続記録</h3>
                <div class="stat-content">
                    <div class="stat-item">
                        <span class="stat-label">現在のストリーク:</span>
                        <span class="stat-value ${activeStreak > 0 ? 'text-green' : ''}">${activeStreak}日</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">最長ストリーク:</span>
                        <span class="stat-value">${longestStreak}日</span>
                    </div>
                </div>
            </div>
            
            <div class="stat-card">
                <h3 class="stat-title">緊急度分布</h3>
                <div class="stat-content">
                    ${urgencyDistribution.overdue > 0 ? `
                    <div class="stat-item">
                        <span class="stat-label">期限切れ:</span>
                        <span class="stat-value text-red">${urgencyDistribution.overdue}</span>
                    </div>` : ''}
                    <div class="stat-item">
                        <span class="stat-label">今日:</span>
                        <span class="stat-value">${urgencyDistribution.today}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">明日:</span>
                        <span class="stat-value">${urgencyDistribution.tomorrow}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">今週中:</span>
                        <span class="stat-value">${urgencyDistribution.thisWeek}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">それ以降:</span>
                        <span class="stat-value">${urgencyDistribution.later}</span>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// 事前通知を表示
function showPreNotification(todo, remainingMinutes) {
    const container = document.getElementById('notificationContainer');
    const notificationId = `notif-${todo.id}`;
    
    // 通知音を再生（優しい音）
    playPreNotificationSound();
    
    // ブラウザ通知（許可されている場合）
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(`タスクの期限が近づいています`, {
            body: `${todo.title} - あと${remainingMinutes}分`,
            icon: '/favicon.ico',
            tag: notificationId
        });
    }
    
    // 画面内通知
    const notification = document.createElement('div');
    notification.className = 'notification-popup';
    notification.id = notificationId;
    notification.innerHTML = `
        <div class="notification-header">
            <div class="notification-title">期限が近づいています</div>
            <button class="notification-close" onclick="dismissNotification('${notificationId}')">&times;</button>
        </div>
        <div class="notification-body">
            <div class="notification-task">${todo.title}</div>
            <div class="notification-time">あと${remainingMinutes}分</div>
        </div>
        <div class="notification-actions">
            <button class="notification-btn primary" onclick="dismissNotification('${notificationId}')">確認</button>
            <button class="notification-btn" onclick="snoozeNotification('${todo.id}', '${notificationId}')">10分後に再通知</button>
        </div>
    `;
    
    container.appendChild(notification);
    
    // 10秒後に自動的に消える
    setTimeout(() => {
        if (document.getElementById(notificationId)) {
            dismissNotification(notificationId);
        }
    }, 10000);
}

// 事前通知音を再生
function playPreNotificationSound() {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // 優しい通知音（高めの音）
    oscillator.frequency.setValueAtTime(1200, audioContext.currentTime);
    oscillator.type = 'sine';
    
    // 音量の設定（優しく）
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + 0.05);
    gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.3);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
}

// 通知を閉じる
function dismissNotification(notificationId) {
    const notification = document.getElementById(notificationId);
    if (notification) {
        notification.classList.add('fade-out');
        setTimeout(() => notification.remove(), 300);
    }
}

// スヌーズ
function snoozeNotification(todoId, notificationId) {
    dismissNotification(notificationId);
    
    // 10分後に再通知するため、一時的に通知済みリストから削除
    setTimeout(() => {
        preNotifiedTodos.delete(parseInt(todoId));
    }, 10 * 60 * 1000);
}

// ブラウザ通知の許可を要求
async function requestNotificationPermission() {
    if ('Notification' in window) {
        console.log('現在の通知許可状態:', Notification.permission);
        
        if (Notification.permission === 'default') {
            try {
                const permission = await Notification.requestPermission();
                console.log('通知許可結果:', permission);
                
                if (permission === 'granted') {
                    // 許可された場合、テスト通知を表示
                    new Notification('通知が有効になりました', {
                        body: 'タスクの期限が近づくとお知らせします',
                        icon: '/icon-192.png'
                    });
                }
            } catch (error) {
                console.error('通知許可エラー:', error);
            }
        }
    } else {
        console.log('このブラウザは通知をサポートしていません');
    }
}

// Service Workerの登録
async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('/service-worker.js');
            console.log('Service Worker登録成功:', registration);
        } catch (error) {
            console.log('Service Worker登録失敗:', error);
        }
    }
}

// iOS向け通知サポートの改善
function setupIOSNotifications() {
    // iOSでWeb App として実行されているかチェック
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
    
    if (isIOS && !isStandalone) {
        // ホーム画面に追加するよう促す
        console.log('iOSユーザーにホーム画面追加を促す');
    }
}

// 通知ボタンの設定
function setupNotificationButton() {
    const notificationBtn = document.getElementById('notificationSettings');
    console.log('通知ボタン要素:', notificationBtn);
    
    if (notificationBtn) {
        console.log('通知ボタンが見つかりました');
        notificationBtn.addEventListener('click', async () => {
            console.log('通知ボタンがクリックされました');
            await requestNotificationPermission();
            updateNotificationButtonState();
        });
    } else {
        console.error('通知ボタンが見つかりません');
    }
}

// 通知ボタンの状態を更新
function updateNotificationButtonState() {
    const notificationBtn = document.getElementById('notificationSettings');
    if (!notificationBtn) return;
    
    if ('Notification' in window) {
        const permission = Notification.permission;
        notificationBtn.classList.remove('granted', 'denied');
        
        if (permission === 'granted') {
            notificationBtn.classList.add('granted');
            notificationBtn.title = '通知: 有効';
        } else if (permission === 'denied') {
            notificationBtn.classList.add('denied');
            notificationBtn.title = '通知: ブロック済み';
        } else {
            notificationBtn.title = '通知: クリックして有効化';
        }
    } else {
        notificationBtn.style.display = 'none';
    }
}

// 初期化実行
init();

// Service Worker登録
registerServiceWorker();

// iOS通知設定
setupIOSNotifications();

// タスクタイプセレクターのセットアップ
function setupTaskTypeSelector() {
    // タスクタイプボタンのイベント
    taskTypeNormalBtn.addEventListener('click', () => {
        selectedTaskType = 'normal';
        taskTypeNormalBtn.classList.add('active');
        taskTypeStartNowBtn.classList.remove('active');
        normalDeadlineField.style.display = 'block';
        startNowDeadlineField.style.display = 'none';
    });
    
    taskTypeStartNowBtn.addEventListener('click', () => {
        selectedTaskType = 'start-now';
        taskTypeStartNowBtn.classList.add('active');
        taskTypeNormalBtn.classList.remove('active');
        normalDeadlineField.style.display = 'none';
        startNowDeadlineField.style.display = 'block';
    });
    
    // 作業時間ボタンのイベント
    document.querySelectorAll('.duration-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            // 他のボタンのアクティブ状態を解除
            document.querySelectorAll('.duration-btn').forEach(b => {
                b.classList.remove('active');
            });
            
            // クリックされたボタンをアクティブに
            e.target.classList.add('active');
            selectedDuration = parseInt(e.target.dataset.minutes);
            
            // カスタム入力をクリア
            customDurationInput.value = '';
        });
    });
    
    // カスタム時間入力のイベント
    customDurationInput.addEventListener('input', () => {
        // 作業時間ボタンのアクティブ状態を解除
        document.querySelectorAll('.duration-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        if (customDurationInput.value) {
            selectedDuration = parseInt(customDurationInput.value);
        } else {
            selectedDuration = null;
        }
    });
}

// EXPを獲得
async function earnExpForCompletion(todo) {
    try {
        const response = await fetch('/api/stats/complete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ taskData: todo })
        });
        
        if (response.ok) {
            const result = await response.json();
            userStats = result.userStats;
            // updateGameStats(); // 削除
            
            // EXP獲得アニメーション
            showExpAnimation(result.earnedExp);
            
            // レベルアップした場合
            if (result.levelUp) {
                showLevelUpAnimation();
            }
            
            // 新しいバッジを獲得した場合
            checkNewBadges(result.userStats.badges);
        }
    } catch (error) {
        console.error('EXP獲得エラー:', error);
    }
}

// EXP獲得アニメーション
function showExpAnimation(exp) {
    const animation = document.createElement('div');
    animation.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 32px;
        font-weight: bold;
        color: #fbbf24;
        z-index: 10000;
        pointer-events: none;
        animation: expFloat 2s ease-out forwards;
    `;
    animation.textContent = `+${exp} EXP`;
    
    // アニメーション用のCSS
    const style = document.createElement('style');
    style.textContent = `
        @keyframes expFloat {
            0% {
                opacity: 1;
                transform: translate(-50%, -50%) scale(0.5);
            }
            50% {
                transform: translate(-50%, -70%) scale(1.2);
            }
            100% {
                opacity: 0;
                transform: translate(-50%, -100%) scale(1);
            }
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(animation);
    setTimeout(() => animation.remove(), 2000);
}

// レベルアップアニメーション
function showLevelUpAnimation() {
    const levelUp = document.createElement('div');
    levelUp.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 30px 50px;
        border-radius: 20px;
        font-size: 36px;
        font-weight: bold;
        z-index: 10001;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
        animation: levelUpBounce 1s ease-out;
    `;
    levelUp.innerHTML = `
        <div>LEVEL UP!</div>
        <div style="font-size: 48px; margin-top: 10px;">Lv.${userStats.level}</div>
        <div style="font-size: 20px; margin-top: 10px; color: #fbbf24;">${userStats.rank}</div>
    `;
    
    // アニメーション用のCSS
    const style = document.createElement('style');
    style.textContent = `
        @keyframes levelUpBounce {
            0% {
                opacity: 0;
                transform: translate(-50%, -50%) scale(0.3);
            }
            50% {
                transform: translate(-50%, -50%) scale(1.1);
            }
            100% {
                transform: translate(-50%, -50%) scale(1);
            }
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(levelUp);
    
    // レベルアップ音
    playLevelUpSound();
    
    setTimeout(() => levelUp.remove(), 3000);
}

// レベルアップ音を再生
function playLevelUpSound() {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // 上昇音を3つ連続で再生
    const frequencies = [523, 659, 784]; // ドミソ
    frequencies.forEach((freq, index) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(freq, audioContext.currentTime + index * 0.1);
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0, audioContext.currentTime + index * 0.1);
        gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + index * 0.1 + 0.05);
        gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + index * 0.1 + 0.3);
        
        oscillator.start(audioContext.currentTime + index * 0.1);
        oscillator.stop(audioContext.currentTime + index * 0.1 + 0.3);
    });
}

// 新しいバッジをチェック
let previousBadges = [];
function checkNewBadges(currentBadges) {
    if (!previousBadges.length) {
        previousBadges = currentBadges || [];
        return;
    }
    
    const newBadges = currentBadges.filter(badge => !previousBadges.includes(badge));
    
    newBadges.forEach(badgeId => {
        showBadgeAnimation(badgeId);
    });
    
    previousBadges = currentBadges;
}

// バッジ獲得アニメーション
function showBadgeAnimation(badgeId) {
    const badgeInfo = getBadgeInfo(badgeId);
    
    const badgeAnimation = document.createElement('div');
    badgeAnimation.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%);
        color: white;
        padding: 20px;
        border-radius: 15px;
        z-index: 10000;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        animation: slideInRight 0.5s ease-out;
        max-width: 300px;
    `;
    badgeAnimation.innerHTML = `
        <div style="font-size: 18px; font-weight: bold; margin-bottom: 10px;">新しいバッジ獲得！</div>
        <div style="display: flex; align-items: center; gap: 15px;">
            <span style="font-size: 48px;">${badgeInfo.icon}</span>
            <div>
                <div style="font-size: 16px; font-weight: bold;">${badgeInfo.name}</div>
                <div style="font-size: 14px; opacity: 0.9;">${badgeInfo.description}</div>
            </div>
        </div>
    `;
    
    // アニメーション用のCSS
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideInRight {
            from {
                opacity: 0;
                transform: translateX(100%);
            }
            to {
                opacity: 1;
                transform: translateX(0);
            }
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(badgeAnimation);
    
    // バッジ獲得音
    playBadgeSound();
    
    setTimeout(() => badgeAnimation.remove(), 5000);
}

// バッジ情報を取得
function getBadgeInfo(badgeId) {
    const badges = {
        'first_complete': { 
            icon: '🎯', 
            name: '初回完了', 
            description: '最初のタスクを完了しました！' 
        },
        'complete_10': { 
            icon: '⭐', 
            name: '10タスク達成', 
            description: '10個のタスクを完了しました！' 
        },
        'complete_50': { 
            icon: '🌟', 
            name: '50タスク達成', 
            description: '50個のタスクを完了しました！' 
        },
        'complete_100': { 
            icon: '💫', 
            name: '100タスク達成', 
            description: '100個のタスクを完了しました！' 
        },
        'streak_7': { 
            icon: '🔥', 
            name: '7日連続', 
            description: '7日連続でタスクを完了しました！' 
        },
        'streak_30': { 
            icon: '💥', 
            name: '30日連続', 
            description: '30日連続でタスクを完了しました！' 
        },
        'level_10': { 
            icon: '🏆', 
            name: 'レベル10', 
            description: 'レベル10に到達しました！' 
        },
        'deadline_master': { 
            icon: '⚡', 
            name: 'デッドラインマスター', 
            description: '締切ギリギリの達人です！' 
        },
        'early_bird': { 
            icon: '🌅', 
            name: '早起き戦士', 
            description: '早朝にタスクを完了しました！' 
        },
        'night_owl': { 
            icon: '🦉', 
            name: '夜型戦士', 
            description: '深夜にタスクを完了しました！' 
        }
    };
    
    return badges[badgeId] || { 
        icon: '🏅', 
        name: '未知のバッジ', 
        description: '新しいバッジを獲得しました！' 
    };
}

// バッジ獲得音を再生
function playBadgeSound() {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // キラキラ音
    const frequencies = [1047, 1319, 1568, 1319]; // 高いドミソミ
    frequencies.forEach((freq, index) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(freq, audioContext.currentTime + index * 0.05);
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0, audioContext.currentTime + index * 0.05);
        gainNode.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + index * 0.05 + 0.02);
        gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + index * 0.05 + 0.2);
        
        oscillator.start(audioContext.currentTime + index * 0.05);
        oscillator.stop(audioContext.currentTime + index * 0.05 + 0.2);
    });
}

// タスク名を分析する関数
function analyzeTaskNames(todos) {
    // ストップワード（分析から除外する一般的な単語）
    const stopWords = new Set(['の', 'を', 'に', 'が', 'で', 'と', 'は', 'から', 'まで', 'へ', 'や', 'する', 'こと', 'もの']);
    
    // 全タスクのタイトルを収集
    const allTitles = todos.map(t => t.title);
    
    // 単語頻度分析
    const wordCount = {};
    let totalWords = 0;
    let totalLength = 0;
    
    allTitles.forEach(title => {
        totalLength += title.length;
        
        // 日本語の単語分割（簡易版）
        // より正確な分析には形態素解析が必要だが、ここでは簡易的に実装
        const words = title.match(/[一-龯ぁ-んァ-ヶー]+|[a-zA-Z]+|[0-9]+/g) || [];
        
        words.forEach(word => {
            if (word.length > 1 && !stopWords.has(word)) {
                wordCount[word] = (wordCount[word] || 0) + 1;
                totalWords++;
            }
        });
    });
    
    // 頻出単語TOP5
    const topWords = Object.entries(wordCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([word, count]) => ({ word, count }));
    
    // 最長・最短タスク
    const sortedByLength = [...allTitles].sort((a, b) => b.length - a.length);
    const longest = sortedByLength[0] || '';
    const shortest = sortedByLength[sortedByLength.length - 1] || '';
    
    // カテゴリ推定（キーワードベース）
    const categories = {
        work: 0,
        personal: 0,
        study: 0,
        health: 0,
        other: 0
    };
    
    const categoryKeywords = {
        work: ['会議', 'ミーティング', '資料', 'メール', '仕事', '業務', '報告', '提出', 'プレゼン', '打ち合わせ'],
        personal: ['買い物', '掃除', '洗濯', '家事', '支払い', '予約', '準備', '片付け'],
        study: ['勉強', '学習', '宿題', '課題', '試験', 'テスト', '練習', '復習', '予習'],
        health: ['運動', 'ジム', 'ランニング', '散歩', '病院', '薬', '健康', 'ダイエット', '筋トレ']
    };
    
    allTitles.forEach(title => {
        let categorized = false;
        for (const [category, keywords] of Object.entries(categoryKeywords)) {
            if (keywords.some(keyword => title.includes(keyword))) {
                categories[category]++;
                categorized = true;
                break;
            }
        }
        if (!categorized) {
            categories.other++;
        }
    });
    
    return {
        wordFrequency: topWords,
        avgLength: allTitles.length > 0 ? Math.round(totalLength / allTitles.length) : 0,
        longest: longest,
        shortest: shortest,
        categories: categories,
        totalTasks: allTitles.length
    };
}

// 週間ビューの表示
function renderWeeklyView() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekDays = ['日', '月', '火', '水', '木', '金', '土'];
    
    // PC判定
    const isPC = window.innerWidth >= 768 && !('ontouchstart' in window);
    
    // 今日から7日間のタスクを取得
    const weekTasks = [];
    for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        const nextDate = new Date(date);
        nextDate.setDate(date.getDate() + 1);
        
        const dayTasks = todos.filter(todo => {
            if (todo.archived) return false;
            const todoDate = new Date(todo.deadline);
            return todoDate >= date && todoDate < nextDate;
        });
        
        weekTasks.push({
            date: date,
            tasks: dayTasks,
            dayName: weekDays[date.getDay()],
            isToday: i === 0,
            dateStr: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` // YYYY-MM-DD形式（ローカル時間）
        });
    }
    
    // 1週間より後のタスクを取得
    const futureDate = new Date(today);
    futureDate.setDate(today.getDate() + 7);
    const futureTasks = todos.filter(todo => {
        if (todo.archived) return false;
        return new Date(todo.deadline) >= futureDate;
    });
    
    // 今日完了したタスクを取得
    const todayStart = new Date(today);
    const todayEnd = new Date(today);
    todayEnd.setDate(todayEnd.getDate() + 1);
    
    const completedTodayTasks = todos.filter(todo => {
        if (!todo.archived || !todo.archivedAt) return false;
        const archivedDate = new Date(todo.archivedAt);
        return archivedDate >= todayStart && archivedDate < todayEnd;
    }).sort((a, b) => new Date(b.archivedAt) - new Date(a.archivedAt));
    
    // HTMLを生成
    let html = '<div class="weekly-view">';
    
    // 週間タスクの表示
    html += '<div class="week-grid">';
    weekTasks.forEach(day => {
        const dateStr = `${day.date.getMonth() + 1}/${day.date.getDate()}`;
        html += `
            <div class="day-column ${day.isToday ? 'today' : ''}" data-date="${day.dateStr}">
                <div class="day-header">
                    <div class="day-name">${day.dayName}</div>
                    <div class="day-date">${dateStr}</div>
                    <div class="day-count">${day.tasks.length}件</div>
                </div>
                <div class="day-tasks ${isPC ? 'droppable' : ''}">
        `;
        
        if (day.tasks.length === 0) {
            html += '<div class="no-tasks">タスクなし</div>';
        } else {
            day.tasks.forEach(task => {
                const time = new Date(task.deadline);
                const timeStr = `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`;
                html += `
                    <div class="week-task-item${isPC ? ' draggable' : ''}" data-task-id="${task.id}" ${isPC ? 'draggable="true"' : ''}>
                        <div class="week-task-time">${timeStr}</div>
                        <div class="week-task-title">${escapeHtml(task.title)}</div>
                    </div>
                `;
            });
        }
        
        html += '</div></div>';
    });
    html += '</div>';
    
    // 1週間より後のタスクの表示
    if (futureTasks.length > 0) {
        html += '<div class="future-tasks-section">';
        html += `<h3 class="future-tasks-header">1週間以降のタスク（${futureTasks.length}件）</h3>`;
        html += '<div class="future-tasks-list">';
        
        // 日付ごとにグループ化
        const groupedFutureTasks = {};
        futureTasks.forEach(task => {
            const date = new Date(task.deadline);
            const dateKey = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
            if (!groupedFutureTasks[dateKey]) {
                groupedFutureTasks[dateKey] = [];
            }
            groupedFutureTasks[dateKey].push(task);
        });
        
        // 日付順にソート
        const sortedDates = Object.keys(groupedFutureTasks).sort();
        sortedDates.forEach(dateKey => {
            const tasks = groupedFutureTasks[dateKey];
            const date = new Date(dateKey);
            const dayName = weekDays[date.getDay()];
            html += `
                <div class="future-date-group">
                    <div class="future-date-header">${dateKey} (${dayName}) - ${tasks.length}件</div>
                `;
            tasks.forEach(task => {
                const time = new Date(task.deadline);
                const timeStr = `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`;
                html += `<div class="future-task-item">${timeStr} ${escapeHtml(task.title)}</div>`;
            });
            html += '</div>';
        });
        
        html += '</div></div>';
    }
    
    // 今日完了したタスクの表示
    if (completedTodayTasks.length > 0) {
        html += '<div class="completed-today-section">';
        html += `<h3 class="completed-today-header">今日完了したタスク（${completedTodayTasks.length}件）</h3>`;
        html += '<div class="completed-today-list">';
        
        completedTodayTasks.forEach(task => {
            const completedTime = new Date(task.archivedAt);
            const timeStr = `${String(completedTime.getHours()).padStart(2, '0')}:${String(completedTime.getMinutes()).padStart(2, '0')}`;
            const originalDeadline = new Date(task.deadline);
            const deadlineStr = `${String(originalDeadline.getHours()).padStart(2, '0')}:${String(originalDeadline.getMinutes()).padStart(2, '0')}`;
            
            html += `
                <div class="completed-task-item">
                    <div class="completed-task-info">
                        <span class="completed-check">✓</span>
                        <span class="completed-task-title">${escapeHtml(task.title)}</span>
                    </div>
                    <div class="completed-task-times">
                        <span class="deadline-time">期限: ${deadlineStr}</span>
                        <span class="completed-time">完了: ${timeStr}</span>
                    </div>
                </div>
            `;
        });
        
        html += '</div></div>';
    }
    
    html += '</div>';
    
    weeklyViewContainer.innerHTML = html;
    
    // PCの場合はドラッグアンドドロップを設定
    if (isPC) {
        setupWeeklyDragAndDrop();
    }
}

// HTMLエスケープ関数
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// スケジュールビューをレンダリング
function renderScheduleView() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);
    
    // HTMLを生成
    let html = '<div class="schedule-view">';
    
    // プリセット一覧セクション
    html += '<div class="preset-list-section">';
    html += '<h3 class="preset-list-header">プリセット一覧</h3>';
    html += '<div class="preset-cards-container">';
    
    if (presets.length > 0) {
        presets.forEach(preset => {
            html += `
                <div class="preset-card">
                    <div class="preset-card-header">
                        <h4>${escapeHtml(preset.name)}</h4>
                        <div class="preset-card-actions">
                            <button class="preset-btn edit" onclick="openPresetEditModal(${preset.id})">編集</button>
                            <button class="preset-btn delete" onclick="deletePreset(${preset.id})">削除</button>
                        </div>
                    </div>
                    <div class="preset-task-list">
            `;
            
            // プリセット内のタスクを表示
            if (preset.tasks && preset.tasks.length > 0) {
                preset.tasks.forEach(task => {
                    html += `
                        <div class="preset-task-item">
                            <span class="preset-task-time">${task.time}</span>
                            <span class="preset-task-title">${escapeHtml(task.title)}</span>
                        </div>
                    `;
                });
            }
            
            html += `
                    </div>
                    <div class="preset-card-footer">
                        <button class="preset-apply-btn" onclick="applyPreset(false, ${preset.id})">今日に適用</button>
                        <button class="preset-apply-btn" onclick="applyPreset(true, ${preset.id})">明日に適用</button>
                    </div>
                </div>
            `;
        });
    } else {
        html += '<p class="no-presets">登録されたプリセットがありません</p>';
    }
    
    html += '</div>';
    html += '<button class="preset-create-btn" id="createNewPresetBtn">新規プリセット作成</button>';
    html += '</div>';
    
    // テンプレートタスクセクション
    html += '<div class="template-tasks-section">';
    html += '<h3 class="template-tasks-header">テンプレートタスク</h3>';
    
    // よくあるテンプレートタスクを定義
    const templateTasks = [
        { time: '06:00', title: '起床' },
        { time: '06:30', title: '朝食' },
        { time: '07:00', title: '運動・ランニング' },
        { time: '08:00', title: '仕事開始' },
        { time: '09:00', title: 'メールチェック' },
        { time: '10:00', title: '重要なタスク' },
        { time: '12:00', title: '昼食' },
        { time: '13:00', title: '午後の作業' },
        { time: '15:00', title: '休憩' },
        { time: '17:00', title: '日報作成' },
        { time: '18:00', title: '仕事終了' },
        { time: '19:00', title: '夕食' },
        { time: '20:00', title: '自由時間' },
        { time: '21:00', title: '勉強・読書' },
        { time: '22:00', title: '入浴' },
        { time: '23:00', title: '就寝準備' }
    ];
    
    html += '<div class="template-task-list">';
    templateTasks.forEach((task, index) => {
        html += `
            <div class="template-task-item" data-template-index="${index}">
                <input type="checkbox" class="template-checkbox" id="template-${index}">
                <div class="template-task-content">
                    <input type="time" class="template-time-input" value="${task.time}" 
                           id="template-time-${index}">
                    <input type="text" class="template-title-input" value="${escapeHtml(task.title)}" 
                           placeholder="タスク名" id="template-title-${index}">
                </div>
            </div>
        `;
    });
    html += '</div>';
    
    html += '<div class="template-actions">';
    html += '<button class="template-action-btn" id="addTemplatesToday">選択したタスクを今日に追加</button>';
    html += '<button class="template-action-btn" id="addTemplatesTomorrow">選択したタスクを明日に追加</button>';
    html += '</div>';
    
    html += '</div>';
    html += '</div>';
    
    scheduleContainer.innerHTML = html;
    
    // 新規プリセット作成ボタンのイベント
    const createNewPresetBtn = document.getElementById('createNewPresetBtn');
    if (createNewPresetBtn) {
        createNewPresetBtn.addEventListener('click', () => openPresetEditModal());
    }
    
    // テンプレートタスクを今日に追加ボタンのイベント
    const addTemplatesTodayBtn = document.getElementById('addTemplatesToday');
    if (addTemplatesTodayBtn) {
        addTemplatesTodayBtn.addEventListener('click', () => addTemplateTasksToDate(false));
    }
    
    // テンプレートタスクを明日に追加ボタンのイベント
    const addTemplatesTomorrowBtn = document.getElementById('addTemplatesTomorrow');
    if (addTemplatesTomorrowBtn) {
        addTemplatesTomorrowBtn.addEventListener('click', () => addTemplateTasksToDate(true));
    }
}

// プリセットを適用
async function applyPreset(isTomorrow = false, presetId = null) {
    // presetIdが指定されていない場合は、セレクトボックスから取得
    if (!presetId) {
        const presetSelect = document.getElementById('presetSelect');
        if (presetSelect) {
            presetId = parseInt(presetSelect.value);
        }
    }
    
    if (!presetId) {
        alert('プリセットを選択してください');
        return;
    }
    
    // 選択されたプリセットを取得
    const preset = presets.find(p => p.id === presetId);
    if (!preset) return;
    
    // 確認ダイアログ
    const targetDay = isTomorrow ? '明日' : '今日';
    const message = `「${preset.name}」を${targetDay}のスケジュールに適用しますか？\n\n含まれるタスク：\n${preset.tasks.map(t => `・${t.time} ${t.title}`).join('\n')}`;
    
    if (!confirm(message)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/presets/${presetId}/apply`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                targetDate: isTomorrow ? 'tomorrow' : 'today'
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            await syncWithServer();
            await loadPresets(); // プリセットの最終使用日を更新
            renderScheduleView();
            
            // 成功通知
            const notification = document.createElement('div');
            notification.className = 'notification-popup success';
            notification.textContent = `${targetDay}に${result.createdTodos.length}個のタスクを作成しました`;
            document.getElementById('notificationContainer').appendChild(notification);
            setTimeout(() => notification.remove(), 3000);
        } else {
            alert('プリセットの適用に失敗しました');
        }
    } catch (error) {
        console.error('プリセット適用エラー:', error);
        alert('エラーが発生しました');
    }
}

// プリセット管理モーダルを開く
function openPresetModal() {
    // 既存のモーダルを削除
    const existingModal = document.getElementById('presetModalOverlay');
    if (existingModal) {
        existingModal.remove();
    }
    
    // プリセット管理モーダルのHTMLを作成
    const modalHtml = `
        <div class="modal-overlay" id="presetModalOverlay">
            <div class="modal preset-modal">
                <div class="modal-header">
                    <h2>プリセット管理</h2>
                    <button class="modal-close" id="closePresetModal">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="preset-list" id="presetList"></div>
                    <button class="btn-create" id="createNewPreset">新規プリセット作成</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // モーダルを表示
    const modal = document.getElementById('presetModalOverlay');
    if (modal) {
        modal.classList.add('active');
    }
    
    // プリセット一覧を表示
    renderPresetList();
    
    // イベントリスナー設定
    document.getElementById('closePresetModal').addEventListener('click', closePresetModal);
    document.getElementById('presetModalOverlay').addEventListener('click', (e) => {
        if (e.target.id === 'presetModalOverlay') {
            closePresetModal();
        }
    });
    document.getElementById('createNewPreset').addEventListener('click', () => {
        closePresetModal();
        openPresetEditModal();
    });
}

// プリセット管理モーダルを閉じる
function closePresetModal() {
    const modal = document.getElementById('presetModalOverlay');
    if (modal) {
        modal.remove();
    }
}

// プリセット一覧をレンダリング
function renderPresetList() {
    const presetListEl = document.getElementById('presetList');
    if (!presetListEl) return;
    
    if (presets.length === 0) {
        presetListEl.innerHTML = '<p class="no-presets">プリセットがありません</p>';
        return;
    }
    
    let html = '';
    presets.forEach(preset => {
        html += `
            <div class="preset-item">
                <div class="preset-info">
                    <h4>${escapeHtml(preset.name)}</h4>
                    <p class="preset-tasks">${preset.tasks.length}個のタスク</p>
                </div>
                <div class="preset-actions">
                    <button class="preset-btn edit" onclick="openPresetEditModal(${preset.id})">編集</button>
                    <button class="preset-btn delete" onclick="deletePreset(${preset.id})">削除</button>
                </div>
            </div>
        `;
    });
    
    presetListEl.innerHTML = html;
}

// プリセット削除
async function deletePreset(presetId) {
    if (!confirm('このプリセットを削除しますか？')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/presets/${presetId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            await loadPresets();
            renderPresetList();
            renderScheduleView();
        } else {
            alert('プリセットの削除に失敗しました');
        }
    } catch (error) {
        console.error('プリセット削除エラー:', error);
        alert('エラーが発生しました');
    }
}

// プリセット編集モーダルを開く
function openPresetEditModal(presetId) {
    const preset = presetId ? presets.find(p => p.id === presetId) : null;
    const isNew = !preset;
    
    // 既存の編集モーダルを削除
    const existingModal = document.getElementById('presetEditModalOverlay');
    if (existingModal) {
        existingModal.remove();
    }
    
    // プリセット編集モーダルのHTMLを作成
    const modalHtml = `
        <div class="modal-overlay" id="presetEditModalOverlay">
            <div class="modal preset-edit-modal">
                <div class="modal-header">
                    <h2>${isNew ? '新規プリセット作成' : 'プリセット編集'}</h2>
                    <button class="modal-close" id="closePresetEditModal">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-field">
                        <label for="presetName">プリセット名</label>
                        <input type="text" id="presetName" class="modal-input" 
                               placeholder="例: 平日ルーティン" 
                               value="${preset ? escapeHtml(preset.name) : ''}">
                    </div>
                    <div class="form-field">
                        <label>タスク一覧</label>
                        <div id="presetTaskList" class="preset-task-list"></div>
                        <button class="btn-add-task" id="addPresetTask">タスクを追加</button>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-cancel" id="cancelPresetEdit">キャンセル</button>
                    <button class="btn-create" id="savePreset">${isNew ? '作成' : '更新'}</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // モーダルを表示
    const modal = document.getElementById('presetEditModalOverlay');
    if (modal) {
        modal.classList.add('active');
    }
    
    // 既存タスクを表示
    if (preset && preset.tasks) {
        preset.tasks.forEach(task => {
            addPresetTaskRow(task);
        });
    } else {
        // 新規の場合は空のタスクを1つ追加
        addPresetTaskRow();
    }
    
    // イベントリスナー設定
    document.getElementById('closePresetEditModal').addEventListener('click', closePresetEditModal);
    document.getElementById('presetEditModalOverlay').addEventListener('click', (e) => {
        if (e.target.id === 'presetEditModalOverlay') {
            closePresetEditModal();
        }
    });
    document.getElementById('cancelPresetEdit').addEventListener('click', closePresetEditModal);
    document.getElementById('addPresetTask').addEventListener('click', () => addPresetTaskRow());
    document.getElementById('savePreset').addEventListener('click', () => savePreset(presetId));
}

// プリセット編集モーダルを閉じる
function closePresetEditModal() {
    const modal = document.getElementById('presetEditModalOverlay');
    if (modal) {
        modal.remove();
    }
}

// プリセットタスク行を追加
function addPresetTaskRow(task = null) {
    const taskList = document.getElementById('presetTaskList');
    const taskId = Date.now() + Math.random();
    
    const taskRow = document.createElement('div');
    taskRow.className = 'preset-task-row';
    taskRow.dataset.taskId = taskId;
    taskRow.innerHTML = `
        <input type="time" class="preset-task-time" value="${task ? task.time : '09:00'}">
        <input type="text" class="preset-task-title" placeholder="タスク名" 
               value="${task ? escapeHtml(task.title) : ''}">
        <button class="preset-task-remove" onclick="removePresetTaskRow(${taskId})">×</button>
    `;
    
    taskList.appendChild(taskRow);
}

// プリセットタスク行を削除
function removePresetTaskRow(taskId) {
    const taskRow = document.querySelector(`[data-task-id="${taskId}"]`);
    if (taskRow) {
        taskRow.remove();
    }
}

// プリセットを保存
async function savePreset(presetId) {
    const name = document.getElementById('presetName').value.trim();
    if (!name) {
        alert('プリセット名を入力してください');
        return;
    }
    
    // タスクを収集
    const tasks = [];
    const taskRows = document.querySelectorAll('.preset-task-row');
    
    for (const row of taskRows) {
        const time = row.querySelector('.preset-task-time').value;
        const title = row.querySelector('.preset-task-title').value.trim();
        
        if (title) {
            tasks.push({ time, title });
        }
    }
    
    if (tasks.length === 0) {
        alert('少なくとも1つのタスクを追加してください');
        return;
    }
    
    // タスクを時間順にソート
    tasks.sort((a, b) => a.time.localeCompare(b.time));
    
    try {
        const url = presetId ? `/api/presets/${presetId}` : '/api/presets';
        const method = presetId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, tasks })
        });
        
        if (response.ok) {
            await loadPresets();
            closePresetEditModal();
            
            // プリセット管理モーダルが開いている場合は更新
            if (document.getElementById('presetList')) {
                renderPresetList();
            }
            
            // スケジュールビューを更新
            if (currentFilter === 'schedule') {
                renderScheduleView();
            }
        } else {
            alert('プリセットの保存に失敗しました');
        }
    } catch (error) {
        console.error('プリセット保存エラー:', error);
        alert('エラーが発生しました');
    }
}

// スケジュールを読み込む
async function loadSchedules() {
    try {
        const response = await fetch('/api/schedules');
        if (response.ok) {
            schedules = await response.json();
        }
    } catch (error) {
        console.error('スケジュール読み込みエラー:', error);
        schedules = [];
    }
}

// 繰り返しタイプのテキストを取得
function getRepeatText(repeat) {
    const repeatMap = {
        'daily': '毎日',
        'weekly': '毎週',
        'biweekly': '隔週',
        'monthly': '毎月',
        'weekdays': '平日のみ'
    };
    return repeatMap[repeat] || 'なし';
}

// スケジュール登録モーダルを開く
function openScheduleModal() {
    // 既存のモーダルを削除
    const existingModal = document.getElementById('scheduleModalOverlay');
    if (existingModal) {
        existingModal.remove();
    }
    
    const modalHtml = `
        <div class="modal-overlay" id="scheduleModalOverlay">
            <div class="modal">
                <div class="modal-header">
                    <h2>新規スケジュール登録</h2>
                    <button class="modal-close" id="closeScheduleModal">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-field">
                        <label for="scheduleTitle">タスク名</label>
                        <input type="text" id="scheduleTitle" placeholder="タスク名を入力" class="modal-input">
                    </div>
                    <div class="form-field">
                        <label for="scheduleTime">実行時刻</label>
                        <input type="time" id="scheduleTime" class="modal-input" value="09:00">
                    </div>
                    <div class="form-field">
                        <label for="scheduleRepeat">繰り返し</label>
                        <select id="scheduleRepeat" class="modal-select">
                            <option value="daily">毎日</option>
                            <option value="weekly">毎週</option>
                            <option value="biweekly">隔週</option>
                            <option value="monthly">毎月</option>
                            <option value="weekdays">平日のみ</option>
                        </select>
                    </div>
                    <div class="form-field">
                        <label for="scheduleMemo">メモ（任意）</label>
                        <textarea id="scheduleMemo" placeholder="メモを入力..." class="modal-textarea" rows="3"></textarea>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-cancel" id="cancelSchedule">キャンセル</button>
                    <button class="btn-create" id="createSchedule">登録</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // モーダルを表示
    const modal = document.getElementById('scheduleModalOverlay');
    if (modal) {
        modal.classList.add('active');
    }
    
    // イベントリスナー設定
    document.getElementById('closeScheduleModal').addEventListener('click', closeScheduleModal);
    document.getElementById('scheduleModalOverlay').addEventListener('click', (e) => {
        if (e.target.id === 'scheduleModalOverlay') {
            closeScheduleModal();
        }
    });
    document.getElementById('cancelSchedule').addEventListener('click', closeScheduleModal);
    document.getElementById('createSchedule').addEventListener('click', createSchedule);
}

// スケジュール登録モーダルを閉じる
function closeScheduleModal() {
    const modal = document.getElementById('scheduleModalOverlay');
    if (modal) {
        modal.remove();
    }
}

// スケジュールを作成
async function createSchedule() {
    const title = document.getElementById('scheduleTitle').value.trim();
    const time = document.getElementById('scheduleTime').value;
    const repeat = document.getElementById('scheduleRepeat').value;
    const memo = document.getElementById('scheduleMemo').value.trim();
    
    if (!title) {
        alert('タスク名を入力してください');
        return;
    }
    
    try {
        const response = await fetch('/api/schedules', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ title, time, repeat, memo })
        });
        
        if (response.ok) {
            await loadSchedules();
            closeScheduleModal();
            renderScheduleView();
        } else {
            alert('スケジュールの登録に失敗しました');
        }
    } catch (error) {
        console.error('スケジュール作成エラー:', error);
        alert('エラーが発生しました');
    }
}

// スケジュールを編集
async function editSchedule(scheduleId) {
    const schedule = schedules.find(s => s.id === scheduleId);
    if (!schedule) return;
    
    // 既存の編集モーダルを削除
    const existingModal = document.getElementById('scheduleEditModalOverlay');
    if (existingModal) {
        existingModal.remove();
    }
    
    const modalHtml = `
        <div class="modal-overlay" id="scheduleEditModalOverlay">
            <div class="modal">
                <div class="modal-header">
                    <h2>スケジュール編集</h2>
                    <button class="modal-close" id="closeScheduleEditModal">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-field">
                        <label for="editScheduleTitle">タスク名</label>
                        <input type="text" id="editScheduleTitle" value="${escapeHtml(schedule.title)}" class="modal-input">
                    </div>
                    <div class="form-field">
                        <label for="editScheduleTime">実行時刻</label>
                        <input type="time" id="editScheduleTime" value="${schedule.time}" class="modal-input">
                    </div>
                    <div class="form-field">
                        <label for="editScheduleRepeat">繰り返し</label>
                        <select id="editScheduleRepeat" class="modal-select">
                            <option value="daily" ${schedule.repeat === 'daily' ? 'selected' : ''}>毎日</option>
                            <option value="weekly" ${schedule.repeat === 'weekly' ? 'selected' : ''}>毎週</option>
                            <option value="biweekly" ${schedule.repeat === 'biweekly' ? 'selected' : ''}>隔週</option>
                            <option value="monthly" ${schedule.repeat === 'monthly' ? 'selected' : ''}>毎月</option>
                            <option value="weekdays" ${schedule.repeat === 'weekdays' ? 'selected' : ''}>平日のみ</option>
                        </select>
                    </div>
                    <div class="form-field">
                        <label for="editScheduleMemo">メモ（任意）</label>
                        <textarea id="editScheduleMemo" class="modal-textarea" rows="3">${escapeHtml(schedule.memo || '')}</textarea>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-cancel" id="cancelEditSchedule">キャンセル</button>
                    <button class="btn-create" id="updateSchedule">更新</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // モーダルを表示
    const modal = document.getElementById('scheduleEditModalOverlay');
    if (modal) {
        modal.classList.add('active');
    }
    
    // イベントリスナー設定
    document.getElementById('closeScheduleEditModal').addEventListener('click', closeScheduleEditModal);
    document.getElementById('scheduleEditModalOverlay').addEventListener('click', (e) => {
        if (e.target.id === 'scheduleEditModalOverlay') {
            closeScheduleEditModal();
        }
    });
    document.getElementById('cancelEditSchedule').addEventListener('click', closeScheduleEditModal);
    document.getElementById('updateSchedule').addEventListener('click', () => updateSchedule(scheduleId));
}

// スケジュール編集モーダルを閉じる
function closeScheduleEditModal() {
    const modal = document.getElementById('scheduleEditModalOverlay');
    if (modal) {
        modal.remove();
    }
}

// スケジュールを更新
async function updateSchedule(scheduleId) {
    const title = document.getElementById('editScheduleTitle').value.trim();
    const time = document.getElementById('editScheduleTime').value;
    const repeat = document.getElementById('editScheduleRepeat').value;
    const memo = document.getElementById('editScheduleMemo').value.trim();
    
    if (!title) {
        alert('タスク名を入力してください');
        return;
    }
    
    try {
        const response = await fetch(`/api/schedules/${scheduleId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ title, time, repeat, memo })
        });
        
        if (response.ok) {
            await loadSchedules();
            closeScheduleEditModal();
            renderScheduleView();
        } else {
            alert('スケジュールの更新に失敗しました');
        }
    } catch (error) {
        console.error('スケジュール更新エラー:', error);
        alert('エラーが発生しました');
    }
}

// スケジュールを削除
async function deleteSchedule(scheduleId) {
    if (!confirm('このスケジュールを削除しますか？')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/schedules/${scheduleId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            await loadSchedules();
            renderScheduleView();
        } else {
            alert('スケジュールの削除に失敗しました');
        }
    } catch (error) {
        console.error('スケジュール削除エラー:', error);
        alert('エラーが発生しました');
    }
}

// タスクを一括生成
async function batchCreateTasks(isTomorrow = false) {
    const scheduleSelect = document.getElementById('scheduleSelect');
    const selectedValue = scheduleSelect.value;
    
    if (!selectedValue) {
        alert('スケジュールを選択してください');
        return;
    }
    
    // 選択されたスケジュールを取得
    let selectedSchedules = [];
    if (selectedValue === 'all') {
        selectedSchedules = schedules;
    } else {
        const schedule = schedules.find(s => s.id === parseInt(selectedValue));
        if (schedule) {
            selectedSchedules = [schedule];
        }
    }
    
    if (selectedSchedules.length === 0) {
        alert('スケジュールが見つかりません');
        return;
    }
    
    // 確認ダイアログ
    const targetDay = isTomorrow ? '明日' : '今日';
    const taskCount = selectedSchedules.length;
    const message = `${targetDay}に${taskCount}個のタスクを作成しますか？\n\n作成されるタスク：\n${selectedSchedules.map(s => `・${s.time} ${s.title}`).join('\n')}`;
    
    if (!confirm(message)) {
        return;
    }
    
    try {
        const response = await fetch('/api/schedules/batch-create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                scheduleIds: selectedSchedules.map(s => s.id),
                targetDate: isTomorrow ? 'tomorrow' : 'today'
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            await syncWithServer();
            renderScheduleView();
            
            // 成功通知
            const notification = document.createElement('div');
            notification.className = 'notification-popup success';
            notification.textContent = `${targetDay}に${result.createdCount}個のタスクを作成しました`;
            document.getElementById('notificationContainer').appendChild(notification);
            setTimeout(() => notification.remove(), 3000);
        } else {
            alert('タスクの作成に失敗しました');
        }
    } catch (error) {
        console.error('タスク一括生成エラー:', error);
        alert('エラーが発生しました');
    }
}

// 週間ビューのドラッグアンドドロップを設定
function setupWeeklyDragAndDrop() {
    let draggedElement = null;
    let draggedTaskId = null;
    
    // ドラッグ可能な要素
    const draggables = document.querySelectorAll('.week-task-item.draggable');
    
    draggables.forEach(draggable => {
        draggable.addEventListener('dragstart', (e) => {
            draggedElement = e.target;
            draggedTaskId = parseInt(e.target.dataset.taskId);
            e.target.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/html', e.target.innerHTML);
        });
        
        draggable.addEventListener('dragend', (e) => {
            e.target.classList.remove('dragging');
        });
    });
    
    // ドロップ可能なエリア
    const droppables = document.querySelectorAll('.day-tasks.droppable');
    
    droppables.forEach(droppable => {
        droppable.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            droppable.classList.add('drag-over');
        });
        
        droppable.addEventListener('dragleave', () => {
            droppable.classList.remove('drag-over');
        });
        
        droppable.addEventListener('drop', async (e) => {
            e.preventDefault();
            droppable.classList.remove('drag-over');
            
            if (!draggedTaskId) return;
            
            // ドロップ先の日付を取得
            const dayColumn = droppable.closest('.day-column');
            const targetDate = dayColumn.dataset.date;
            
            // タスクを取得
            const task = todos.find(t => t.id === draggedTaskId);
            if (!task) return;
            
            // 新しい期限を計算（時間は保持）
            const oldDeadline = new Date(task.deadline);
            const [year, month, day] = targetDate.split('-').map(Number);
            const newDate = new Date(year, month - 1, day);
            newDate.setHours(oldDeadline.getHours());
            newDate.setMinutes(oldDeadline.getMinutes());
            newDate.setSeconds(0);
            newDate.setMilliseconds(0);
            
            // タスクを更新
            try {
                const response = await fetch(`/api/todos/${draggedTaskId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        ...task,
                        deadline: newDate.toISOString()
                    })
                });
                
                if (response.ok) {
                    await syncWithServer();
                    renderWeeklyView();
                    
                    // 成功通知
                    const notification = document.createElement('div');
                    notification.className = 'notification-popup success';
                    notification.textContent = 'タスクを移動しました';
                    document.getElementById('notificationContainer').appendChild(notification);
                    setTimeout(() => notification.remove(), 2000);
                } else {
                    alert('タスクの移動に失敗しました');
                }
            } catch (error) {
                console.error('タスク移動エラー:', error);
                alert('エラーが発生しました');
            }
        });
    });
}

// テンプレートタスクを日付に追加
async function addTemplateTasksToDate(isTomorrow = false) {
    const selectedTasks = [];
    const checkboxes = document.querySelectorAll('.template-checkbox:checked');
    
    if (checkboxes.length === 0) {
        alert('タスクを選択してください');
        return;
    }
    
    // 基準日を設定
    const baseDate = new Date();
    if (isTomorrow) {
        baseDate.setDate(baseDate.getDate() + 1);
    }
    baseDate.setHours(0, 0, 0, 0);
    
    // 選択されたタスクを収集
    checkboxes.forEach(checkbox => {
        const templateItem = checkbox.closest('.template-task-item');
        const index = templateItem.dataset.templateIndex;
        
        // 編集された値を取得
        const timeInput = document.getElementById(`template-time-${index}`);
        const titleInput = document.getElementById(`template-title-${index}`);
        
        const time = timeInput.value;
        const title = titleInput.value.trim();
        
        if (!title) return; // タイトルが空の場合はスキップ
        
        const [hours, minutes] = time.split(':').map(Number);
        
        const deadline = new Date(baseDate);
        deadline.setHours(hours, minutes, 0, 0);
        
        selectedTasks.push({
            title: title,
            deadline: deadline.toISOString()
        });
    });
    
    // 確認メッセージ
    const targetDay = isTomorrow ? '明日' : '今日';
    const message = `${targetDay}に${selectedTasks.length}個のタスクを追加しますか？`;
    
    if (!confirm(message)) {
        return;
    }
    
    try {
        // タスクを一括作成
        for (const task of selectedTasks) {
            const response = await fetch('/api/todos', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(task)
            });
            
            if (!response.ok) {
                throw new Error('タスクの作成に失敗しました');
            }
        }
        
        await syncWithServer();
        
        // 成功通知
        const notification = document.createElement('div');
        notification.className = 'notification-popup success';
        notification.textContent = `${targetDay}に${selectedTasks.length}個のタスクを追加しました`;
        document.getElementById('notificationContainer').appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
        
        // チェックボックスをリセット
        checkboxes.forEach(checkbox => checkbox.checked = false);
        
        // アクティブタブに切り替え
        document.querySelector('.filter-tab[data-filter="active"]').click();
        
    } catch (error) {
        console.error('タスク追加エラー:', error);
        alert('エラーが発生しました');
    }
}

// グローバルに関数を公開
window.dismissNotification = dismissNotification;
window.snoozeNotification = snoozeNotification;
window.openPresetEditModal = openPresetEditModal;
window.deletePreset = deletePreset;
window.removePresetTaskRow = removePresetTaskRow;
window.editSchedule = editSchedule;
window.deleteSchedule = deleteSchedule;
window.batchCreateTasks = batchCreateTasks;
window.openScheduleModal = openScheduleModal;
window.applyPreset = applyPreset;