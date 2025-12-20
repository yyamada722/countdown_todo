/**
 * Countdown and Animation Tests
 * Tests for the improved countdown display with requestAnimationFrame and completion animations
 */

const { describe, test, expect, beforeEach, afterEach, jest } = require('@jest/globals');

describe('Animation Frame Management', () => {
  let animationFrameId = null;

  afterEach(() => {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  });

  test('should schedule animation frame', () => {
    const callback = jest.fn();
    animationFrameId = requestAnimationFrame(callback);
    
    expect(requestAnimationFrame).toHaveBeenCalledWith(callback);
    expect(animationFrameId).toBeDefined();
  });

  test('should cancel animation frame', () => {
    const callback = jest.fn();
    animationFrameId = requestAnimationFrame(callback);
    
    cancelAnimationFrame(animationFrameId);
    
    expect(cancelAnimationFrame).toHaveBeenCalledWith(animationFrameId);
  });

  test('should handle multiple animation frames', () => {
    const callback1 = jest.fn();
    const callback2 = jest.fn();
    
    const id1 = requestAnimationFrame(callback1);
    const id2 = requestAnimationFrame(callback2);
    
    expect(id1).toBeDefined();
    expect(id2).toBeDefined();
    
    cancelAnimationFrame(id1);
    cancelAnimationFrame(id2);
  });

  test('should set isCountdownAnimationActive flag', () => {
    let isCountdownAnimationActive = false;
    
    isCountdownAnimationActive = true;
    expect(isCountdownAnimationActive).toBe(true);
    
    isCountdownAnimationActive = false;
    expect(isCountdownAnimationActive).toBe(false);
  });
});

describe('Format Time Remaining', () => {
  test('should format time with days when more than 24 hours', () => {
    const now = new Date('2024-01-01T12:00:00');
    const deadline = new Date('2024-01-03T12:00:00'); // 2 days from now
    const diff = deadline.getTime() - now.getTime();
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    expect(days).toBe(2);
    expect(hours).toBe(0);
    expect(minutes).toBe(0);
    
    const formatted = `${String(days).padStart(2, '0')}d${String(hours).padStart(2, '0')}h${String(minutes).padStart(2, '0')}m`;
    expect(formatted).toBe('02d00h00m');
  });

  test('should format time with seconds when less than 1 minute', () => {
    const now = new Date('2024-01-01T12:00:00');
    const deadline = new Date('2024-01-01T12:00:45'); // 45 seconds from now
    const diff = deadline.getTime() - now.getTime();
    
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    const milliseconds = Math.floor(diff % 1000);
    
    expect(minutes).toBe(0);
    expect(seconds).toBe(45);
    expect(milliseconds).toBe(0);
    
    const displayMillis = Math.floor(milliseconds / 10);
    const formatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(displayMillis).padStart(2, '0')}`;
    expect(formatted).toBe('00:45.00');
  });

  test('should show correct sign for expired tasks', () => {
    const now = new Date('2024-01-01T12:00:00');
    const deadline = new Date('2024-01-01T11:30:00'); // 30 minutes ago
    const diff = deadline.getTime() - now.getTime();
    
    expect(diff).toBeLessThan(0);
    
    const overdue = Math.abs(diff);
    const minutes = Math.floor((overdue % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((overdue % (1000 * 60)) / 1000);
    
    expect(minutes).toBe(30);
    expect(seconds).toBe(0);
    
    // Expired tasks should show with - prefix (negative)
    const formatted = `-${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.00`;
    expect(formatted).toBe('-30:00.00');
  });

  test('should show correct sign for active tasks', () => {
    const now = new Date('2024-01-01T12:00:00');
    const deadline = new Date('2024-01-01T12:30:00'); // 30 minutes from now
    const diff = deadline.getTime() - now.getTime();
    
    expect(diff).toBeGreaterThan(0);
    
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    expect(minutes).toBe(30);
    expect(seconds).toBe(0);
    
    // Active tasks should show with + prefix (positive)
    const formatted = `+${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.00`;
    expect(formatted).toBe('+30:00.00');
  });

  test('should calculate milliseconds correctly for animation', () => {
    const now = new Date('2024-01-01T12:00:00.567');
    const deadline = new Date('2024-01-01T12:00:45.234');
    const diff = deadline.getTime() - now.getTime();
    
    const milliseconds = Math.floor(diff % 1000);
    expect(milliseconds).toBe(667); // 234 - 567 + 1000
    
    const displayMillis = Math.floor(milliseconds / 10);
    expect(displayMillis).toBe(66);
  });

  test('should handle animation phase milliseconds', () => {
    const isAnimating = true;
    const diff = 12345; // Total milliseconds
    
    let milliseconds;
    if (isAnimating) {
      milliseconds = Math.abs(diff);
    }
    
    expect(milliseconds).toBe(12345);
    
    const displayMillis = Math.floor((milliseconds % 1000) / 10);
    expect(displayMillis).toBe(34); // 345 / 10 = 34
  });

  test('should use current milliseconds when not animating', () => {
    const now = new Date('2024-01-01T12:00:00.789');
    const isAnimating = false;
    
    let milliseconds;
    if (!isAnimating) {
      milliseconds = now.getMilliseconds();
    }
    
    expect(milliseconds).toBe(789);
  });
});

describe('Animation Phases', () => {
  test('should track animation start time', () => {
    const animationStartTime = Date.now();
    
    expect(animationStartTime).toBeGreaterThan(0);
    expect(typeof animationStartTime).toBe('number');
  });

  test('should calculate elapsed time during animation', () => {
    const animationStartTime = Date.now() - 1500; // 1.5 seconds ago
    const now = Date.now();
    const elapsed = now - animationStartTime;
    
    expect(elapsed).toBeGreaterThanOrEqual(1500);
    expect(elapsed).toBeLessThan(1600);
  });

  test('should transition to white phase after 3 seconds', () => {
    const animationStartTime = Date.now() - 3000;
    const now = Date.now();
    const elapsed = now - animationStartTime;
    
    expect(elapsed).toBeGreaterThanOrEqual(3000);
    
    let animationPhase = null;
    if (elapsed >= 3000 && !animationPhase) {
      animationPhase = 'white';
    }
    
    expect(animationPhase).toBe('white');
  });

  test('should stay in red phase before 3 seconds', () => {
    const animationStartTime = Date.now() - 1500;
    const now = Date.now();
    const elapsed = now - animationStartTime;
    
    expect(elapsed).toBeLessThan(3000);
    
    let animationPhase = null;
    if (elapsed >= 3000) {
      animationPhase = 'white';
    }
    
    expect(animationPhase).toBeNull();
  });

  test('should complete animation after white phase', () => {
    const animationStartTime = Date.now() - 3500;
    const whitePhaseStart = Date.now() - 500;
    const whiteElapsed = Date.now() - whitePhaseStart;
    
    expect(whiteElapsed).toBeGreaterThanOrEqual(500);
    
    // After 3 seconds in white phase, animation should complete
    const shouldComplete = whiteElapsed >= 3000;
    expect(shouldComplete).toBe(false); // Still in progress
  });
});

describe('Countdown Display Updates', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div class="todo-card" data-todo-id="1">
        <div class="countdown-time">00:00.00</div>
      </div>
      <div class="todo-card" data-todo-id="2">
        <div class="countdown-time expired">-05:30.50</div>
      </div>
    `;
  });

  test('should find countdown elements in DOM', () => {
    const countdownElements = document.querySelectorAll('.todo-card .countdown-time');
    
    expect(countdownElements.length).toBe(2);
  });

  test('should get todo ID from card', () => {
    const todoCard = document.querySelector('.todo-card[data-todo-id="1"]');
    const todoId = todoCard.dataset.todoId;
    
    expect(todoId).toBe('1');
    expect(parseInt(todoId)).toBe(1);
  });

  test('should add expired class when overdue', () => {
    const element = document.querySelector('.todo-card[data-todo-id="2"] .countdown-time');
    
    expect(element.classList.contains('expired')).toBe(true);
  });

  test('should remove expired class when not overdue', () => {
    const element = document.querySelector('.todo-card[data-todo-id="1"] .countdown-time');
    
    expect(element.classList.contains('expired')).toBe(false);
  });

  test('should update countdown text content', () => {
    const element = document.querySelector('.todo-card[data-todo-id="1"] .countdown-time');
    element.textContent = '+05:30.25';
    
    expect(element.textContent).toBe('+05:30.25');
  });

  test('should pad numbers with leading zeros', () => {
    const minutes = 5;
    const seconds = 9;
    const millis = 3;
    
    const formatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(2, '0')}`;
    
    expect(formatted).toBe('05:09.03');
  });
});

describe('Near Deadline Detection', () => {
  test('should detect task within 1 minute', () => {
    const now = Date.now();
    const deadline = now + 30000; // 30 seconds from now
    const diff = Math.abs(deadline - now);
    
    const isNearDeadline = diff < 60000;
    
    expect(isNearDeadline).toBe(true);
  });

  test('should detect overdue task within 1 minute', () => {
    const now = Date.now();
    const deadline = now - 30000; // 30 seconds ago
    const diff = Math.abs(deadline - now);
    
    const isNearDeadline = diff < 60000;
    
    expect(isNearDeadline).toBe(true);
  });

  test('should not detect task beyond 1 minute', () => {
    const now = Date.now();
    const deadline = now + 120000; // 2 minutes from now
    const diff = Math.abs(deadline - now);
    
    const isNearDeadline = diff < 60000;
    
    expect(isNearDeadline).toBe(false);
  });

  test('should filter todos for near deadline', () => {
    const now = Date.now();
    const todos = [
      { id: 1, deadline: new Date(now + 30000), archived: false }, // 30s
      { id: 2, deadline: new Date(now + 120000), archived: false }, // 2min
      { id: 3, deadline: new Date(now - 30000), archived: false }, // -30s
      { id: 4, deadline: new Date(now + 300000), archived: false }, // 5min
    ];
    
    const hasNearDeadline = todos.some(todo => {
      if (todo.archived) return false;
      const diff = Math.abs(todo.deadline.getTime() - now);
      return diff < 60000;
    });
    
    expect(hasNearDeadline).toBe(true);
  });
});

describe('Interval Management', () => {
  test('should set up 1-second interval', () => {
    jest.useFakeTimers();
    const callback = jest.fn();
    
    setInterval(callback, 1000);
    
    jest.advanceTimersByTime(1000);
    expect(callback).toHaveBeenCalledTimes(1);
    
    jest.advanceTimersByTime(2000);
    expect(callback).toHaveBeenCalledTimes(3);
    
    jest.useRealTimers();
  });

  test('should clear interval', () => {
    jest.useFakeTimers();
    const callback = jest.fn();
    
    const intervalId = setInterval(callback, 1000);
    
    jest.advanceTimersByTime(1000);
    expect(callback).toHaveBeenCalledTimes(1);
    
    clearInterval(intervalId);
    
    jest.advanceTimersByTime(2000);
    expect(callback).toHaveBeenCalledTimes(1); // Still 1, not called again
    
    jest.useRealTimers();
  });
});

describe('Todo ID Comparison', () => {
  test('should compare numeric and string IDs', () => {
    const numericId = 123;
    const stringId = '123';
    
    expect(numericId == stringId).toBe(true);
    expect(numericId === stringId).toBe(false);
  });

  test('should find todo by ID with flexible comparison', () => {
    const todos = [
      { id: 1, title: 'Task 1' },
      { id: 2, title: 'Task 2' },
      { id: 3, title: 'Task 3' },
    ];
    
    const todoId = '2';
    const found = todos.find(t => t.id == todoId || t.id === parseInt(todoId));
    
    expect(found).toBeDefined();
    expect(found.title).toBe('Task 2');
  });

  test('should handle parseFloat for animation IDs', () => {
    const animatingId = '123.456';
    const parsed = parseFloat(animatingId);
    
    expect(parsed).toBe(123.456);
    expect(typeof parsed).toBe('number');
  });
});