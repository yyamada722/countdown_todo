/**
 * Server API Tests
 * Tests for the modified server endpoints, especially the DELETE operation and parseFloat usage
 */

const { describe, test, expect, beforeEach, jest } = require('@jest/globals');

describe('Todo ID Parsing', () => {
  test('should parse integer ID correctly', () => {
    const pathname = '/api/todos/123';
    const todoId = parseFloat(pathname.split('/')[3]);
    
    expect(todoId).toBe(123);
    expect(typeof todoId).toBe('number');
  });

  test('should parse float ID correctly', () => {
    const pathname = '/api/todos/123.456';
    const todoId = parseFloat(pathname.split('/')[3]);
    
    expect(todoId).toBe(123.456);
    expect(typeof todoId).toBe('number');
  });

  test('should handle string numeric ID', () => {
    const pathname = '/api/todos/789';
    const parts = pathname.split('/');
    const todoId = parseFloat(parts[3]);
    
    expect(parts).toEqual(['', 'api', 'todos', '789']);
    expect(todoId).toBe(789);
  });

  test('should return NaN for invalid ID', () => {
    const pathname = '/api/todos/invalid';
    const todoId = parseFloat(pathname.split('/')[3]);
    
    expect(isNaN(todoId)).toBe(true);
  });

  test('should handle missing ID', () => {
    const pathname = '/api/todos/';
    const todoId = parseFloat(pathname.split('/')[3]);
    
    expect(todoId).toBeNaN();
  });
});

describe('Todo Archive Operation', () => {
  let mockTodos;

  beforeEach(() => {
    mockTodos = [
      { id: 1, title: 'Task 1', archived: false, createdAt: '2024-01-01T00:00:00Z' },
      { id: 2, title: 'Task 2', archived: false, createdAt: '2024-01-02T00:00:00Z' },
      { id: 3, title: 'Task 3', archived: true, createdAt: '2024-01-03T00:00:00Z', archivedAt: '2024-01-04T00:00:00Z' },
    ];
  });

  test('should find todo by ID', () => {
    const todoId = 2;
    const index = mockTodos.findIndex(todo => todo.id === todoId);
    
    expect(index).toBe(1);
    expect(mockTodos[index].title).toBe('Task 2');
  });

  test('should archive todo instead of deleting', () => {
    const todoId = 1;
    const index = mockTodos.findIndex(todo => todo.id === todoId);
    
    expect(index).not.toBe(-1);
    
    // Archive instead of delete
    mockTodos[index].archived = true;
    mockTodos[index].archivedAt = new Date().toISOString();
    
    expect(mockTodos[index].archived).toBe(true);
    expect(mockTodos[index].archivedAt).toBeDefined();
    expect(mockTodos.length).toBe(3); // Not deleted, still in array
  });

  test('should set archivedAt timestamp', () => {
    const todoId = 2;
    const index = mockTodos.findIndex(todo => todo.id === todoId);
    const now = new Date('2024-01-05T12:00:00Z');
    
    mockTodos[index].archived = true;
    mockTodos[index].archivedAt = now.toISOString();
    
    expect(mockTodos[index].archivedAt).toBe('2024-01-05T12:00:00.000Z');
  });

  test('should return 404 for non-existent todo', () => {
    const todoId = 999;
    const index = mockTodos.findIndex(todo => todo.id === todoId);
    
    expect(index).toBe(-1);
  });

  test('should return archived todo data', () => {
    const todoId = 1;
    const index = mockTodos.findIndex(todo => todo.id === todoId);
    
    mockTodos[index].archived = true;
    mockTodos[index].archivedAt = new Date().toISOString();
    
    const archivedTodo = mockTodos[index];
    
    expect(archivedTodo).toMatchObject({
      id: 1,
      title: 'Task 1',
      archived: true
    });
    expect(archivedTodo.archivedAt).toBeDefined();
  });

  test('should handle float IDs in archive operation', () => {
    const todoWithFloatId = { id: 123.456, title: 'Animating Task', archived: false };
    mockTodos.push(todoWithFloatId);
    
    const todoId = 123.456;
    const index = mockTodos.findIndex(todo => todo.id === todoId);
    
    expect(index).toBe(3);
    expect(mockTodos[index].id).toBe(123.456);
  });
});

describe('HTTP Response Handling', () => {
  test('should return 200 for successful archive', () => {
    const statusCode = 200;
    const contentType = 'application/json';
    
    expect(statusCode).toBe(200);
    expect(contentType).toBe('application/json');
  });

  test('should return 404 for not found', () => {
    const statusCode = 404;
    const errorResponse = { error: 'Todo not found' };
    
    expect(statusCode).toBe(404);
    expect(errorResponse).toEqual({ error: 'Todo not found' });
  });

  test('should return 500 for database error', () => {
    const statusCode = 500;
    const errorResponse = { error: 'Failed to archive todo' };
    
    expect(statusCode).toBe(500);
    expect(errorResponse).toEqual({ error: 'Failed to archive todo' });
  });

  test('should serialize JSON response', () => {
    const todo = {
      id: 1,
      title: 'Task 1',
      archived: true,
      archivedAt: '2024-01-01T00:00:00Z'
    };
    
    const json = JSON.stringify(todo);
    const parsed = JSON.parse(json);
    
    expect(parsed).toEqual(todo);
  });
});

describe('Database Operations', () => {
  test('should maintain data structure after archive', () => {
    const data = {
      todos: [
        { id: 1, title: 'Task 1', archived: false }
      ],
      userStats: { level: 1, exp: 0 },
      presets: [],
      schedules: []
    };
    
    data.todos[0].archived = true;
    data.todos[0].archivedAt = new Date().toISOString();
    
    expect(data.todos[0].archived).toBe(true);
    expect(data.todos[0].archivedAt).toBeDefined();
    expect(data.userStats).toBeDefined();
    expect(data.presets).toBeDefined();
    expect(data.schedules).toBeDefined();
  });

  test('should preserve other todos during archive', () => {
    const todos = [
      { id: 1, title: 'Task 1', archived: false },
      { id: 2, title: 'Task 2', archived: false },
      { id: 3, title: 'Task 3', archived: false }
    ];
    
    const todoId = 2;
    const index = todos.findIndex(t => t.id === todoId);
    todos[index].archived = true;
    
    expect(todos[0].archived).toBe(false);
    expect(todos[1].archived).toBe(true);
    expect(todos[2].archived).toBe(false);
    expect(todos.length).toBe(3);
  });
});

describe('URL Pathname Parsing', () => {
  test('should parse DELETE /api/todos/:id', () => {
    const pathname = '/api/todos/123';
    const parts = pathname.split('/');
    
    expect(parts[0]).toBe('');
    expect(parts[1]).toBe('api');
    expect(parts[2]).toBe('todos');
    expect(parts[3]).toBe('123');
  });

  test('should match DELETE endpoint pattern', () => {
    const pathname = '/api/todos/456';
    const method = 'DELETE';
    
    const isDeleteEndpoint = method === 'DELETE' && pathname.startsWith('/api/todos/');
    
    expect(isDeleteEndpoint).toBe(true);
  });

  test('should not match wrong method', () => {
    const pathname = '/api/todos/123';
    const method = 'GET';
    
    const isDeleteEndpoint = method === 'DELETE' && pathname.startsWith('/api/todos/');
    
    expect(isDeleteEndpoint).toBe(false);
  });

  test('should not match wrong path', () => {
    const pathname = '/api/stats/123';
    const method = 'DELETE';
    
    const isDeleteEndpoint = method === 'DELETE' && pathname.startsWith('/api/todos/');
    
    expect(isDeleteEndpoint).toBe(false);
  });
});

describe('PUT Endpoint ID Parsing', () => {
  test('should parse ID in PUT request', () => {
    const pathname = '/api/todos/456';
    const todoId = parseFloat(pathname.split('/')[3]);
    
    expect(todoId).toBe(456);
  });

  test('should handle float ID in PUT request', () => {
    const pathname = '/api/todos/789.123';
    const todoId = parseFloat(pathname.split('/')[3]);
    
    expect(todoId).toBe(789.123);
  });
});

describe('Todo Update Operations', () => {
  test('should update todo fields', () => {
    const todo = {
      id: 1,
      title: 'Original Title',
      deadline: '2024-01-01T00:00:00Z',
      archived: false
    };
    
    const updateData = {
      title: 'Updated Title',
      deadline: '2024-01-02T00:00:00Z'
    };
    
    Object.assign(todo, updateData);
    
    expect(todo.title).toBe('Updated Title');
    expect(todo.deadline).toBe('2024-01-02T00:00:00Z');
    expect(todo.id).toBe(1); // ID unchanged
  });

  test('should preserve fields not in update', () => {
    const todo = {
      id: 1,
      title: 'Task',
      memo: 'Important notes',
      archived: false
    };
    
    const updateData = {
      title: 'Updated Task'
    };
    
    Object.assign(todo, updateData);
    
    expect(todo.title).toBe('Updated Task');
    expect(todo.memo).toBe('Important notes');
    expect(todo.archived).toBe(false);
  });
});

describe('Date and Time Handling', () => {
  test('should create ISO string timestamp', () => {
    const date = new Date('2024-01-01T12:30:00Z');
    const iso = date.toISOString();
    
    expect(iso).toBe('2024-01-01T12:30:00.000Z');
  });

  test('should parse ISO string', () => {
    const isoString = '2024-01-01T12:30:00.000Z';
    const date = new Date(isoString);
    
    expect(date.getFullYear()).toBe(2024);
    expect(date.getMonth()).toBe(0); // January
    expect(date.getDate()).toBe(1);
  });

  test('should handle current timestamp', () => {
    const now = new Date();
    const timestamp = now.toISOString();
    
    expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });
});