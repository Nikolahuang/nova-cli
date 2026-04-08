#!/usr/bin/env node

// Mock localStorage for packages that try to access it in Node.js (e.g., docx)
// This must be done before any imports that might trigger the issue
if (typeof globalThis.localStorage === 'undefined') {
  const storage = {};
  globalThis.localStorage = {
    getItem: (key) => storage[key] ?? null,
    setItem: (key, value) => { storage[key] = value; },
    removeItem: (key) => { delete storage[key]; },
    clear: () => { for (const k in storage) delete storage[k]; },
    get length() { return Object.keys(storage).length; },
    key: (i) => Object.keys(storage)[i] ?? null,
  };
}

// Nova CLI Entry Point

import { NovaApp } from '../src/startup/NovaApp.js';

const app = new NovaApp();
app.run().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
