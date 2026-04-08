#!/usr/bin/env node

// Nova CLI Entry Point

import { NovaApp } from '../src/index.js';

const app = new NovaApp();
await app.run();