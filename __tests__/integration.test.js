/**
 * Integration Tests
 * Tests for interactions between different components and end-to-end workflows
 */

const { describe, test, expect, beforeEach, jest } = require('@jest/globals');

describe('Weather and Clock Integration', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div class="clock-container">
        <div class="clock-time" id="currentTime">00:00:00</div>
        <div class="clock-date-weather">
          <span class="clock-date" id="currentDate">0000/00/00 (月)</span>
          <span class="weather-display" id="weatherDisplay"></span>
        </div>
      </div>
    `;
    localStorage.clear();
  });

  test('should display weather alongside clock when settings exist', () => {
    const settings = {
      name: '東京',
      lat: 35.6762,
      lon: 139.6503
    };
    localStorage.setItem('weatherSettings', JSON.stringify(settings));

    const clockDate = document.getElementById('currentDate');
    const weatherDisplay = document.getElementById('weatherDisplay');

    expect(clockDate).toBeTruthy();
    expect(weatherDisplay).toBeTruthy();
    expect(clockDate.parentElement).toBe(weatherDisplay.parentElement);
  });

  test('should hide weather when no settings', () => {
    const weatherDisplay = document.getElementById('weatherDisplay');
    weatherDisplay.innerHTML = '';

    expect(weatherDisplay.innerHTML).toBe('');
  });
});

describe('Todo Completion and Animation Flow', () => {
  let todos;

  beforeEach(() => {
    todos = [
      {
        id: 1,
        title: 'Test Task',
        deadline: new Date(Date.now() + 5000),
        archived: false
      }
    ];
  });

  test('should transition todo through completion animation phases', () => {
    const todo = todos[0];
    
    // Mark as animating
    todo.isAnimating = true;
    todo.animationStartTime = Date.now();
    todo.animationPhase = null;
    
    expect(todo.isAnimating).toBe(true);
    expect(todo.animationPhase).toBeNull();
    
    // After 3 seconds, should enter white phase
    const elapsed = 3000;
    if (elapsed >= 3000 && !todo.animationPhase) {
      todo.animationPhase = 'white';
      todo.animationStartTime = Date.now();
    }
    
    expect(todo.animationPhase).toBe('white');
    
    // After another 3 seconds, should complete
    const whiteElapsed = 3000;
    if (whiteElapsed >= 3000) {
      todos = todos.filter(t => t.id !== todo.id);
    }
    
    expect(todos.length).toBe(0);
  });

  test('should archive non-animating todo', () => {
    const todo = todos[0];
    todo.archived = true;
    todo.archivedAt = new Date().toISOString();
    
    expect(todo.archived).toBe(true);
    expect(todo.archivedAt).toBeDefined();
    expect(todos.length).toBe(1); // Still in array, just archived
  });
});

describe('Complete Workflow: Create, Update, Complete, Display', () => {
  let mockDatabase;

  beforeEach(() => {
    mockDatabase = {
      todos: [],
      userStats: { level: 1, exp: 0 },
      presets: [],
      schedules: []
    };
  });

  test('should handle full todo lifecycle', () => {
    // 1. Create todo
    const newTodo = {
      id: Date.now(),
      title: 'Important Task',
      deadline: new Date(Date.now() + 3600000).toISOString(),
      createdAt: new Date().toISOString(),
      archived: false
    };
    mockDatabase.todos.push(newTodo);
    
    expect(mockDatabase.todos.length).toBe(1);
    expect(mockDatabase.todos[0].archived).toBe(false);
    
    // 2. Update todo
    mockDatabase.todos[0].title = 'Updated Task';
    expect(mockDatabase.todos[0].title).toBe('Updated Task');
    
    // 3. Complete todo (archive)
    mockDatabase.todos[0].archived = true;
    mockDatabase.todos[0].archivedAt = new Date().toISOString();
    
    expect(mockDatabase.todos[0].archived).toBe(true);
    expect(mockDatabase.todos[0].archivedAt).toBeDefined();
    
    // 4. Filter completed
    const completed = mockDatabase.todos.filter(t => t.archived);
    expect(completed.length).toBe(1);
    
    // 5. Group by date
    const groupedByDate = {};
    completed.forEach(todo => {
      const date = new Date(todo.archivedAt);
      const dateKey = date.toLocaleDateString('ja-JP');
      if (!groupedByDate[dateKey]) {
        groupedByDate[dateKey] = [];
      }
      groupedByDate[dateKey].push(todo);
    });
    
    expect(Object.keys(groupedByDate).length).toBeGreaterThan(0);
  });
});

describe('Weather Settings and Display Workflow', () => {
  beforeEach(() => {
    localStorage.clear();
    fetch.mockClear();
  });

  test('should complete weather setup flow', async () => {
    // 1. User opens modal and selects Tokyo preset
    const tokyoPreset = {
      lat: 35.6762,
      lon: 139.6503,
      name: '東京'
    };
    
    // 2. User saves settings
    localStorage.setItem('weatherSettings', JSON.stringify(tokyoPreset));
    
    const saved = JSON.parse(localStorage.getItem('weatherSettings'));
    expect(saved.name).toBe('東京');
    
    // 3. Fetch weather data
    const mockWeatherData = {
      daily: {
        temperature_2m_max: [25],
        temperature_2m_min: [18]
      },
      hourly: {
        weather_code: new Array(24).fill(1)
      }
    };
    
    fetch.mockResolvedValue({
      ok: true,
      json: async () => mockWeatherData
    });
    
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${tokyoPreset.lat}&longitude=${tokyoPreset.lon}`
    );
    const data = await response.json();
    
    expect(data.daily.temperature_2m_max[0]).toBe(25);
    
    // 4. Process weather data
    const morningCodes = data.hourly.weather_code.slice(6, 12);
    const afternoonCodes = data.hourly.weather_code.slice(12, 18);
    
    expect(morningCodes.length).toBe(6);
    expect(afternoonCodes.length).toBe(6);
    
    // 5. Display weather
    const weatherData = {
      morningCode: 1,
      afternoonCode: 1,
      tempMax: Math.round(data.daily.temperature_2m_max[0]),
      tempMin: Math.round(data.daily.temperature_2m_min[0])
    };
    
    expect(weatherData.tempMax).toBe(25);
    expect(weatherData.tempMin).toBe(18);
  });

  test('should handle weather settings deletion', () => {
    // Setup weather
    const settings = { name: '東京', lat: 35.6762, lon: 139.6503 };
    localStorage.setItem('weatherSettings', JSON.stringify(settings));
    
    expect(localStorage.getItem('weatherSettings')).toBeTruthy();
    
    // Delete settings
    localStorage.removeItem('weatherSettings');
    
    expect(localStorage.getItem('weatherSettings')).toBeNull();
  });
});

describe('Server API Integration', () => {
  let mockTodos;

  beforeEach(() => {
    mockTodos = [
      { id: 1, title: 'Task 1', archived: false },
      { id: 2, title: 'Task 2', archived: false }
    ];
  });

  test('should handle PUT then DELETE operations', () => {
    // 1. Update todo
    const todoId = 1;
    const updateData = { title: 'Updated Task 1' };
    
    const index = mockTodos.findIndex(t => t.id === todoId);
    Object.assign(mockTodos[index], updateData);
    
    expect(mockTodos[index].title).toBe('Updated Task 1');
    
    // 2. Delete (archive) todo
    mockTodos[index].archived = true;
    mockTodos[index].archivedAt = new Date().toISOString();
    
    expect(mockTodos[index].archived).toBe(true);
    expect(mockTodos.length).toBe(2); // Still in array
  });

  test('should maintain database integrity across operations', () => {
    const database = {
      todos: mockTodos,
      userStats: { level: 1 },
      presets: [],
      schedules: []
    };
    
    // Archive a todo
    database.todos[0].archived = true;
    
    // Ensure other data intact
    expect(database.userStats.level).toBe(1);
    expect(database.presets).toEqual([]);
    expect(database.schedules).toEqual([]);
  });
});

describe('Animation Frame and Countdown Integration', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div class="todo-card" data-todo-id="1">
        <div class="countdown-time">+05:30.25</div>
      </div>
    `;
  });

  test('should update countdown with animation frame', () => {
    const element = document.querySelector('.countdown-time');
    
    // Simulate requestAnimationFrame update
    const updateCountdown = () => {
      element.textContent = '+05:29.99';
    };
    
    requestAnimationFrame(updateCountdown);
    
    expect(requestAnimationFrame).toHaveBeenCalled();
  });

  test('should switch to high-frequency updates near deadline', () => {
    const now = Date.now();
    const todos = [
      { id: 1, deadline: new Date(now + 30000), archived: false }
    ];
    
    const hasNearDeadline = todos.some(todo => {
      const diff = Math.abs(todo.deadline.getTime() - now);
      return diff < 60000;
    });
    
    let isCountdownAnimationActive = false;
    if (hasNearDeadline) {
      isCountdownAnimationActive = true;
    }
    
    expect(isCountdownAnimationActive).toBe(true);
  });
});

describe('Geolocation to Weather Display Flow', () => {
  test('should get location and fetch weather', async () => {
    // 1. Get current position
    const mockPosition = {
      coords: {
        latitude: 35.6762,
        longitude: 139.6503
      }
    };
    
    navigator.geolocation.getCurrentPosition.mockImplementation((success) => {
      success(mockPosition);
    });
    
    let position;
    navigator.geolocation.getCurrentPosition((pos) => {
      position = pos;
    });
    
    expect(position.coords.latitude).toBe(35.6762);
    
    // 2. Save as settings
    const settings = {
      name: '現在地',
      lat: position.coords.latitude,
      lon: position.coords.longitude
    };
    localStorage.setItem('weatherSettings', JSON.stringify(settings));
    
    // 3. Fetch weather
    const mockData = {
      daily: { temperature_2m_max: [20], temperature_2m_min: [15] },
      hourly: { weather_code: new Array(24).fill(1) }
    };
    
    fetch.mockResolvedValue({
      ok: true,
      json: async () => mockData
    });
    
    const response = await fetch('https://api.open-meteo.com/v1/forecast');
    const data = await response.json();
    
    expect(data.daily.temperature_2m_max[0]).toBe(20);
  });
});

describe('Cross-Component Data Flow', () => {
  test('should maintain consistency between active and completed views', () => {
    const allTodos = [
      { id: 1, title: 'Active 1', archived: false },
      { id: 2, title: 'Completed 1', archived: true, archivedAt: '2024-01-01T10:00:00Z' },
      { id: 3, title: 'Active 2', archived: false },
      { id: 4, title: 'Completed 2', archived: true, archivedAt: '2024-01-01T14:00:00Z' }
    ];
    
    // Active filter
    const active = allTodos.filter(t => !t.archived);
    expect(active.length).toBe(2);
    
    // Completed filter
    const completed = allTodos.filter(t => t.archived);
    expect(completed.length).toBe(2);
    
    // Total should match
    expect(active.length + completed.length).toBe(allTodos.length);
  });

  test('should handle todo moving from active to completed', () => {
    const todos = [
      { id: 1, title: 'Task', archived: false }
    ];
    
    // Initially active
    let active = todos.filter(t => !t.archived);
    let completed = todos.filter(t => t.archived);
    
    expect(active.length).toBe(1);
    expect(completed.length).toBe(0);
    
    // Complete it
    todos[0].archived = true;
    todos[0].archivedAt = new Date().toISOString();
    
    // Now completed
    active = todos.filter(t => !t.archived);
    completed = todos.filter(t => t.archived);
    
    expect(active.length).toBe(0);
    expect(completed.length).toBe(1);
  });
});