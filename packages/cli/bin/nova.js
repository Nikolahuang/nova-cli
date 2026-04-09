#!/usr/bin/env node

// Nova CLI Entry Point - use tsx to run TypeScript directly
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const srcPath = resolve(__dirname, '../src/startup/main.ts');
const args = process.argv.slice(2).join(' ');

try {
  execSync(`npx tsx "${srcPath}" ${args}`, {
    stdio: 'inherit',
    cwd: resolve(__dirname, '..')
  });
} catch (error) {
  console.error('Error:', error.message);
  process.exit(error.status || 1);
}