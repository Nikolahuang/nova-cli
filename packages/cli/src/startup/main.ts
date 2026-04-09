#!/usr/bin/env node

// Nova CLI Main Entry Point
import { NovaApp } from './NovaApp.js';

const app = new NovaApp();
app.run().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});