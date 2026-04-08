// Mock localStorage for packages that try to access it in Node.js (e.g., docx)
// This must be loaded before any other modules via --require flag
// In Node.js 25+, localStorage has a native implementation that requires --localstorage-file
// We need to provide a mock that satisfies the docx package

const storage = {};
const localStorageMock = {
  getItem: (key) => storage[key] ?? null,
  setItem: (key, value) => { storage[key] = String(value); },
  removeItem: (key) => { delete storage[key]; },
  clear: () => { for (const k in storage) delete storage[k]; },
  get length() { return Object.keys(storage).length; },
  key: (i) => Object.keys(storage)[i] ?? null,
};

// Override both global and globalThis
try {
  // Delete the native localStorage first (if it exists)
  delete global.localStorage;
  delete globalThis.localStorage;
} catch (e) {
  // Ignore errors if property is not configurable
}

// Define our mock
Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
  configurable: true,
  enumerable: true,
});

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
  configurable: true,
  enumerable: true,
});
