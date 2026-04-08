// ============================================================================
// InkAppRunner - Simple Ink UI entry point
// This is a lightweight bridge that only handles UI rendering.
// Business logic is handled by the caller (NovaApp/InteractiveRepl)
// ============================================================================

import React from 'react';
import { render, RenderOptions } from 'ink';
import { NovaInkApp } from './NovaInkApp.js';

// ============================================================================
// Types
// ============================================================================

export interface InkAppOptions {
  initialModel?: string;
  initialMode?: 'auto' | 'plan' | 'ask';
  sessionId?: string;
  onSubmit?: (input: string) => Promise<void>;
  onCommand?: (command: string) => Promise<void>;
}

// ============================================================================
// InkAppRunner Class
// ============================================================================

export class InkAppRunner {
  private options: InkAppOptions;
  
  constructor(options: InkAppOptions) {
    this.options = options;
  }
  
  /**
   * Start the Ink UI application
   */
  async start(): Promise<void> {
    const { waitUntilExit } = render(
      <NovaInkApp
        initialModel={this.options.initialModel || 'claude-3-sonnet'}
        initialMode={this.options.initialMode || 'auto'}
        sessionId={this.options.sessionId}
        onSubmit={this.options.onSubmit}
        onCommand={this.options.onCommand}
      />
    );
    
    await waitUntilExit();
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createInkApp(options: InkAppOptions): InkAppRunner {
  return new InkAppRunner(options);
}

// ============================================================================
// Standalone Run (for testing)
// ============================================================================

export async function runInkApp(options: InkAppOptions = {}): Promise<void> {
  const app = createInkApp(options);
  await app.start();
}