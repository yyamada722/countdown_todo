/**
 * Completed Tasks Display Tests
 * Tests for the improved completed tasks view with date grouping
 */

const { describe, test, expect, beforeEach } = require('@jest/globals');

describe('Completed Tasks Date Grouping', () => {
  let completedTodos;

  beforeEach(() => {
    completedTodos = [
      {
        id: 1,
        title: 'Task 1',
        archived: true,
        archivedAt: '2024-01-01T10:30:00Z',
        deadline: '2024-01-01T10:00:00Z'
      },
      {
        id: 2,
        title: 'Task 2',
        archived: true,
        archivedAt: '2024-01-01T14:20:00Z',
        deadline: '2024-01-01T14:00:00Z'
      },
      {
        id: 3,
        title: 'Task 3',
        archived: true,
        archivedAt: '2024-01-02T09:15:00Z',
        deadline: '2024-01-02T09:00:00Z'
      },
      {
        id: 4,
        title: 'Task 4',
        archived: true,
        archivedAt: '2024-01-02T16:45:00Z',
        deadline: '2024-01-02T16:30:00Z'
      }
    ];
  });

  test('should group tasks by date', () => {
    const groupedByDate = {};
    
    completedTodos.forEach(todo => {
      const archivedDate = new Date(todo.archivedAt);
      const dateKey = archivedDate.toLocaleDateString('ja-JP');
      
      if (!groupedByDate[dateKey]) {
        groupedByDate[dateKey] = [];
      }
      groupedByDate[dateKey].push(todo);
    });
    
    expect(Object.keys(groupedByDate).length).toBe(2);
    expect(groupedByDate['2024/1/1'].length).toBe(2);
    expect(groupedByDate['2024/1/2'].length).toBe(2);
  });

  test('should sort dates in descending order', () => {
    const groupedByDate = {
      '2024/1/1': [completedTodos[0], completedTodos[1]],
      '2024/1/2': [completedTodos[2], completedTodos[3]]
    };
    
    const sortedDates = Object.entries(groupedByDate).sort((a, b) => {
      const dateA = new Date(a[0].replace(/\//g, '-'));
      const dateB = new Date(b[0].replace(/\//g, '-'));
      return dateB - dateA;
    });
    
    expect(sortedDates[0][0]).toBe('2024/1/2'); // Most recent first
    expect(sortedDates[1][0]).toBe('2024/1/1');
  });

  test('should sort completed todos by archivedAt descending', () => {
    const sorted = [...completedTodos].sort((a, b) => {
      const aDate = new Date(a.archivedAt);
      const bDate = new Date(b.archivedAt);
      return bDate - aDate;
    });
    
    expect(sorted[0].id).toBe(4); // Most recent
    expect(sorted[1].id).toBe(3);
    expect(sorted[2].id).toBe(2);
    expect(sorted[3].id).toBe(1); // Oldest
  });

  test('should count tasks per date', () => {
    const groupedByDate = {
      '2024/1/1': [completedTodos[0], completedTodos[1]],
      '2024/1/2': [completedTodos[2], completedTodos[3]]
    };
    
    Object.entries(groupedByDate).forEach(([dateKey, tasks]) => {
      expect(tasks.length).toBeGreaterThan(0);
      if (dateKey === '2024/1/1') {
        expect(tasks.length).toBe(2);
      } else if (dateKey === '2024/1/2') {
        expect(tasks.length).toBe(2);
      }
    });
  });

  test('should handle tasks without archivedAt', () => {
    const todoWithoutDate = {
      id: 5,
      title: 'Task 5',
      archived: true
    };
    
    const archivedDate = todoWithoutDate.archivedAt ? 
      new Date(todoWithoutDate.archivedAt) : 
      new Date();
    
    expect(archivedDate).toBeInstanceOf(Date);
    expect(archivedDate.getTime()).toBeGreaterThan(0);
  });
});

describe('Time Formatting for Completed Tasks', () => {
  test('should format completion time', () => {
    const completedTime = new Date('2024-01-01T14:25:30Z');
    const hours = String(completedTime.getHours()).padStart(2, '0');
    const minutes = String(completedTime.getMinutes()).padStart(2, '0');
    const timeStr = `${hours}:${minutes}`;
    
    expect(timeStr).toBe('14:25');
  });

  test('should format deadline time', () => {
    const deadline = new Date('2024-01-01T09:05:00Z');
    const hours = String(deadline.getHours()).padStart(2, '0');
    const minutes = String(deadline.getMinutes()).padStart(2, '0');
    const timeStr = `${hours}:${minutes}`;
    
    expect(timeStr).toBe('09:05');
  });

  test('should pad single digit hours and minutes', () => {
    const time = new Date('2024-01-01T03:07:00Z');
    const hours = String(time.getHours()).padStart(2, '0');
    const minutes = String(time.getMinutes()).padStart(2, '0');
    
    expect(hours).toBe('03');
    expect(minutes).toBe('07');
  });

  test('should handle midnight time', () => {
    const time = new Date('2024-01-01T00:00:00Z');
    const hours = String(time.getHours()).padStart(2, '0');
    const minutes = String(time.getMinutes()).padStart(2, '0');
    const timeStr = `${hours}:${minutes}`;
    
    expect(timeStr).toBe('00:00');
  });
});

describe('Completed Task Item Structure', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div class="completed-task-item" data-todo-id="1">
        <div class="completed-task-info">
          <span class="completed-check">✓</span>
          <span class="completed-task-title">Task 1</span>
        </div>
        <div class="completed-task-times">
          <span class="deadline-time">期限: 10:00</span>
          <span class="completed-time">完了: 10:30</span>
        </div>
      </div>
    `;
  });

  test('should have correct DOM structure', () => {
    const taskItem = document.querySelector('.completed-task-item');
    const taskInfo = taskItem.querySelector('.completed-task-info');
    const taskTimes = taskItem.querySelector('.completed-task-times');
    
    expect(taskItem).toBeTruthy();
    expect(taskInfo).toBeTruthy();
    expect(taskTimes).toBeTruthy();
  });

  test('should display check mark', () => {
    const checkMark = document.querySelector('.completed-check');
    
    expect(checkMark).toBeTruthy();
    expect(checkMark.textContent).toBe('✓');
  });

  test('should display task title', () => {
    const title = document.querySelector('.completed-task-title');
    
    expect(title).toBeTruthy();
    expect(title.textContent).toBe('Task 1');
  });

  test('should display deadline time', () => {
    const deadlineTime = document.querySelector('.deadline-time');
    
    expect(deadlineTime).toBeTruthy();
    expect(deadlineTime.textContent).toContain('10:00');
  });

  test('should display completed time', () => {
    const completedTime = document.querySelector('.completed-time');
    
    expect(completedTime).toBeTruthy();
    expect(completedTime.textContent).toContain('10:30');
  });

  test('should have todo ID as data attribute', () => {
    const taskItem = document.querySelector('.completed-task-item');
    
    expect(taskItem.dataset.todoId).toBe('1');
  });

  test('should be clickable', () => {
    const taskItem = document.querySelector('.completed-task-item');
    const clickHandler = jest.fn();
    
    taskItem.addEventListener('click', clickHandler);
    taskItem.click();
    
    expect(clickHandler).toHaveBeenCalled();
  });
});

describe('Filter Completed Tasks', () => {
  let todos;

  beforeEach(() => {
    todos = [
      { id: 1, title: 'Active Task', archived: false },
      { id: 2, title: 'Completed Task 1', archived: true, archivedAt: '2024-01-01T10:00:00Z' },
      { id: 3, title: 'Another Active', archived: false },
      { id: 4, title: 'Completed Task 2', archived: true, archivedAt: '2024-01-02T15:00:00Z' }
    ];
  });

  test('should filter only completed tasks', () => {
    const completed = todos.filter(todo => todo.archived);
    
    expect(completed.length).toBe(2);
    expect(completed[0].title).toBe('Completed Task 1');
    expect(completed[1].title).toBe('Completed Task 2');
  });

  test('should exclude active tasks', () => {
    const completed = todos.filter(todo => todo.archived);
    const hasActive = completed.some(todo => !todo.archived);
    
    expect(hasActive).toBe(false);
  });

  test('should handle empty completed list', () => {
    const allActive = [
      { id: 1, title: 'Task 1', archived: false },
      { id: 2, title: 'Task 2', archived: false }
    ];
    
    const completed = allActive.filter(todo => todo.archived);
    
    expect(completed.length).toBe(0);
  });
});

describe('Date Locale Formatting', () => {
  test('should format date in Japanese locale', () => {
    const date = new Date('2024-01-15T12:00:00Z');
    const formatted = date.toLocaleDateString('ja-JP');
    
    expect(formatted).toMatch(/2024/);
    expect(formatted).toMatch(/1/);
    expect(formatted).toMatch(/15/);
  });

  test('should create consistent date keys', () => {
    const date1 = new Date('2024-01-01T08:00:00Z');
    const date2 = new Date('2024-01-01T20:00:00Z');
    
    const key1 = date1.toLocaleDateString('ja-JP');
    const key2 = date2.toLocaleDateString('ja-JP');
    
    expect(key1).toBe(key2); // Same day, different times
  });

  test('should handle date string replacement for sorting', () => {
    const dateKey = '2024/1/15';
    const normalized = dateKey.replace(/\//g, '-');
    
    expect(normalized).toBe('2024-1-15');
    
    const date = new Date(normalized);
    expect(date.getFullYear()).toBe(2024);
  });
});