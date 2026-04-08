#!/usr/bin/env node

// Nova CLI Main Entry Point
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🚀 Nova CLI v0.2.7');
console.log('');

// Check if running in development mode (source files)
const isDevMode = existsSync(join(__dirname, '../../node_modules/.bin/tsx'));

if (isDevMode) {
    console.log('🔧 Running in development mode...');
    const tsxPath = join(__dirname, '../../node_modules/.bin/tsx');
    const userArgs = process.argv.slice(2);

    // Use tsx to run the TypeScript application
    const child = spawn(tsxPath, [__filename, ...userArgs], {
        stdio: 'inherit',
        cwd: process.cwd()
    });

    child.on('exit', (code) => {
        process.exit(code || 0);
    });
} else {
    console.log('📦 Running production version...');
    console.log('');
    console.log('Available commands:');
    console.log('  nova --version     Show version information');
    console.log('  nova --help        Show help information');
    console.log('  nova -p "prompt"   Run a single prompt');
    console.log('  nova               Start interactive mode');
    console.log('');
    console.log('Note: This is a working version. Full functionality requires proper compilation.');
}

process.exit(0);