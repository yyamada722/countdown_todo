# Unit Tests for Countdown Todo

This directory contains comprehensive unit tests for the Countdown Todo application, specifically focusing on the new features and modifications in the current branch.

## Test Coverage

### 1. Weather Functionality (`weather.test.js`)
Tests for the new weather feature including:
- Weather code mapping (sunny, rainy, snowy, thunder, etc.)
- Settings management (save, load, clear)
- API integration with Open-Meteo
- Geolocation support
- Preset locations (Tokyo, Osaka, Nagoya, Sapporo, Fukuoka)
- Coordinate validation (latitude: -90 to 90, longitude: -180 to 180)
- Weather code frequency analysis for morning/afternoon periods
- Weather display updates

**Key Features Tested:**
- Correct weather icon mapping for all weather codes (0-99)
- LocalStorage persistence
- API URL construction
- Error handling for fetch failures
- Geolocation permissions and errors
- Temperature formatting and rounding
- Hourly data slicing for time periods

### 2. Countdown and Animation (`countdown-animation.test.js`)
Tests for the improved countdown display with requestAnimationFrame:
- Animation frame scheduling and cancellation
- Time formatting with millisecond precision
- Countdown sign display (+ for active, - for expired)
- Animation phase transitions (red → white)
- Near deadline detection (within 1 minute)
- High-frequency updates for accurate display
- Todo ID comparison (numeric vs string)

**Key Features Tested:**
- RequestAnimationFrame integration
- Millisecond calculation for smooth animations
- Animation start time tracking
- Phase transitions at 3-second intervals
- Countdown element updates in DOM
- Number padding for display formatting

### 3. Server API (`server.test.js`)
Tests for modified server endpoints:
- Todo ID parsing with parseFloat (supports animation IDs)
- Archive operation instead of deletion
- HTTP response handling (200, 404, 500)
- Database structure preservation
- URL pathname parsing
- Date/time ISO string handling

**Key Features Tested:**
- DELETE endpoint archives instead of deleting
- ArchivedAt timestamp creation
- Float ID support for animating tasks
- Error response formats
- Todo update operations
- Database integrity

### 4. Completed Tasks Display (`completed-tasks.test.js`)
Tests for the improved completed tasks view:
- Date-based grouping of completed tasks
- Descending date sort (newest first)
- Time formatting for completion and deadline
- DOM structure for completed items
- Click event handling
- Task filtering by archived status

**Key Features Tested:**
- Grouping by archivedAt date
- Date key normalization for sorting
- Japanese locale date formatting
- Task count per date
- Fallback for missing archivedAt
- Visual structure (check mark, times, etc.)

### 5. Edge Cases and Integration (`edge-cases.test.js`)
Comprehensive edge case testing:
- Millisecond display overflow and boundaries
- Date boundaries (year, leap year, DST)
- Coordinate validation at exact boundaries
- Weather code boundary conditions
- Array slicing edge cases
- String to number conversion
- JSON serialization with special values
- Empty and null handling

**Key Features Tested:**
- Boundary value testing
- Error condition handling
- Type conversion edge cases
- Array method edge cases
- Timestamp comparison
- Empty data structures

## Running Tests

### Install Dependencies
```bash
npm install
```

### Run All Tests
```bash
npm test
```

### Run Tests in Watch Mode
```bash
npm test:watch
```

### Generate Coverage Report
```bash
npm test:coverage
```

## Test Structure

Each test file follows this structure:
- **describe blocks**: Group related tests by functionality
- **test blocks**: Individual test cases
- **beforeEach/afterEach**: Setup and teardown
- **Mocks**: Jest mocks for DOM, localStorage, fetch, etc.

## Mocked Dependencies

The following are mocked in `jest.setup.js`:
- `localStorage` - For settings persistence
- `fetch` - For API calls
- `requestAnimationFrame` / `cancelAnimationFrame` - For animations
- `navigator.geolocation` - For location services

## Test Philosophy

1. **Comprehensive Coverage**: Test happy paths, edge cases, and failure conditions
2. **Pure Function Focus**: Many tests focus on pure functions with predictable outputs
3. **Integration Testing**: Some tests verify interactions between components
4. **Real-World Scenarios**: Tests simulate actual user workflows
5. **Boundary Testing**: Extensive testing of boundary conditions

## Key Testing Patterns

### Weather API Testing
```javascript
test('should fetch weather data successfully', async () => {
  fetch.mockResolvedValue({
    ok: true,
    json: async () => mockWeatherData
  });
  
  const response = await fetch('...');
  const data = await response.json();
  
  expect(data).toEqual(mockWeatherData);
});
```

### Animation Frame Testing
```javascript
test('should schedule animation frame', () => {
  const callback = jest.fn();
  const id = requestAnimationFrame(callback);
  
  expect(requestAnimationFrame).toHaveBeenCalled();
});
```

### Time Calculation Testing
```javascript
test('should format time correctly', () => {
  const now = new Date('2024-01-01T12:00:00');
  const deadline = new Date('2024-01-01T12:30:00');
  const diff = deadline.getTime() - now.getTime();
  
  const minutes = Math.floor(diff / (1000 * 60));
  expect(minutes).toBe(30);
});
```

## Coverage Goals

- **Statements**: > 80%
- **Branches**: > 75%
- **Functions**: > 80%
- **Lines**: > 80%

## Contributing Tests

When adding new features, please:
1. Create tests before implementing (TDD approach preferred)
2. Cover happy path, edge cases, and error conditions
3. Use descriptive test names
4. Group related tests in describe blocks
5. Mock external dependencies
6. Keep tests isolated and independent

## Test File Naming

- `*.test.js` - Unit tests
- `*.spec.js` - Specification tests (alternative)
- Place tests in `__tests__` directory

## Common Assertions

```javascript
// Equality
expect(value).toBe(expected);
expect(object).toEqual(expected);

// Truthiness
expect(value).toBeTruthy();
expect(value).toBeFalsy();
expect(value).toBeNull();
expect(value).toBeUndefined();
expect(value).toBeDefined();

// Numbers
expect(number).toBeGreaterThan(3);
expect(number).toBeLessThan(5);
expect(number).toBeCloseTo(4.2, 1);

// Strings
expect(string).toMatch(/pattern/);
expect(string).toContain('substring');

// Arrays
expect(array).toContain(item);
expect(array.length).toBe(3);

// Async
await expect(promise).resolves.toBe(value);
await expect(promise).rejects.toThrow();
```

## Debugging Tests

```bash
# Run specific test file
npm test weather.test.js

# Run tests matching pattern
npm test -- --testNamePattern="weather"

# Verbose output
npm test -- --verbose

# Run with debugger
node --inspect-brk node_modules/.bin/jest --runInBand
```

## Performance Considerations

- Tests run in parallel by default
- Use `--runInBand` for serial execution
- Mock heavy operations (API calls, timers)
- Keep tests fast (< 5s per file)

## Future Test Areas

Potential areas for expanded testing:
1. Integration tests with real DOM
2. End-to-end tests with Playwright
3. Performance benchmarking
4. Accessibility testing
5. Visual regression testing for CSS changes
6. API contract testing

## Resources

- [Jest Documentation](https://jestjs.io/)
- [Testing Library](https://testing-library.com/)
- [JavaScript Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)