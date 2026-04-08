#!/usr/bin/env node

// Nova CLI Entry Point
// Uses tsx to run TypeScript directly (handles ESM + cross-package imports)

import { NovaApp } from '../src/startup/NovaApp.ts';

const app = new NovaApp();
app.run().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
