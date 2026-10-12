// Mock localStorage（呼び出しを検証できるjest.fnだが、実際に値も保存する）
let localStorageStore = {};
const localStorageMock = {
  getItem: jest.fn((key) => (key in localStorageStore ? localStorageStore[key] : null)),
  setItem: jest.fn((key, value) => { localStorageStore[key] = String(value); }),
  removeItem: jest.fn((key) => { delete localStorageStore[key]; }),
  clear: jest.fn(() => { localStorageStore = {}; }),
};
// jsdom の window.localStorage は代入では差し替えられないため defineProperty で上書きする
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  configurable: true,
  writable: true,
});

// Mock fetch
global.fetch = jest.fn();

// Mock requestAnimationFrame
global.requestAnimationFrame = jest.fn((cb) => {
  setTimeout(cb, 16);
  return 1;
});

global.cancelAnimationFrame = jest.fn();

// Mock navigator.geolocation
global.navigator.geolocation = {
  getCurrentPosition: jest.fn(),
  watchPosition: jest.fn(),
  clearWatch: jest.fn(),
};

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  // テストが mockReturnValue で上書きしても次のテストに持ち越さないよう、毎回実装を戻す
  localStorageStore = {};
  localStorage.getItem.mockImplementation((key) => (key in localStorageStore ? localStorageStore[key] : null));
  fetch.mockResolvedValue({
    ok: true,
    json: async () => ({}),
  });
});