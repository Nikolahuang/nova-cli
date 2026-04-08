#!/usr/bin/env node

// Nova CLI Entry Point
// Detects if running from source (needs tsx) or compiled dist

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Mock localStorage for packages that try to access it in Node.js (e.g., docx)
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

// Check if running from compiled dist or source (src/ exists)
const isCompiled = !existsSync(join(__dirname, '../src'));

if (isCompiled) {
  // Running compiled version - import directly
  import('../dist/startup/NovaApp.js').then(({ NovaApp }) => {
    const app = new NovaApp();
    return app.run();
  }).catch((err) => {
    console.error('Fatal error:', err.message);
    process.exit(1);
  });
} else {
  // Running from source, need tsx to execute TypeScript
  // Search for tsx in multiple possible locations
  const searchPaths = [
    join(__dirname, '../../node_modules/.bin/tsx'),  // root node_modules (global install)
    join(__dirname, '../node_modules/.bin/tsx'),      // cli local node_modules
  ];
  
  let tsxCmd = null;
  for (const p of searchPaths) {
    if (existsSync(p + '.cmd') || existsSync(p)) {
      tsxCmd = existsSync(p + '.cmd') ? p + '.cmd' : p;
      break;
    }
  }
  
  const userArgs = process.argv.slice(2);

  if (!tsxCmd) {
    console.error('Error: tsx is required to run Nova CLI from source.');
    console.error('Please install it: npm install -g tsx');
    process.exit(1);
  }

  // Re-execute this same file with tsx
  if (process.platform === 'win32') {
    const child = spawn('cmd', ['/c', tsxCmd, __filename, ...userArgs], {
      stdio: 'inherit',
    });
    child.on('exit', (code) => process.exit(code ?? 0));
  } else {
    const child = spawn(tsxCmd, [__filename, ...userArgs], {
      stdio: 'inherit',
    });
    child.on('exit', (code) => process.exit(code ?? 0));
  }
}
