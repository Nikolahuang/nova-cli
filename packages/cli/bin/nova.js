#!/usr/bin/env node

// Nova CLI Entry Point

import { NovaApp } from '../dist/packages/cli/src/startup/NovaApp.js';

const app = new NovaApp();
app.run().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
