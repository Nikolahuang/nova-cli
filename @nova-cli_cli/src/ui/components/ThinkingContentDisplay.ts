// ============================================================================
// ThinkingContentDisplay - Display model thinking content in a styled box
// Shows the model's reasoning process with a green dashed border
// ============================================================================

import chalk from 'chalk';

// ============================================================================
// Types
// ============================================================================

export interface ThinkingDisplayOptions {
  /** Maximum width of the display (default: terminal width - 4) */
  maxWidth?: number;
  /** Maximum lines to show in preview (default: 8) */
  maxPreviewLines?: number;
  /** Show full content or preview (default: preview) */
  expanded?: boolean;
}

// ============================================================================
// Color palette
// ============================================================================

const C = {
  thinking: chalk.hex('#10B981'),      // Green
  thinkingDim: chalk.hex('#10B981').dim,
  thinkingBg: chalk.bgHex('#064E3B'),
  border: chalk.hex('#34D399'),
  borderDim: chalk.hex('#34D399').dim,
  text: chalk.hex('#6EE7B7'),
  textDim: chalk.hex('#6EE7B7').dim,
  muted: chalk.gray,
};

// ============================================================================
// Box drawing characters for dashed border
// ============================================================================

const DASHED = {
  h: 'â•?,      // Dashed horizontal
  v: 'â•?,      // Dashed vertical
  tl: 'â”?,     // Top-left (solid for corners)
  tr: 'â”?,     // Top-right
  bl: 'â”?,     // Bottom-left
  br: 'â”?,     // Bottom-right
  hDash: 'â•?,  // Dashed horizontal
  vDash: 'â•?,  // Dashed vertical
  bullet: 'â€?,
  arrow: 'â†?,
};

// ============================================================================
// ThinkingContentDisplay class
// ============================================================================

/**
 * Displays model thinking content in a distinctive green dashed box.
 * 
 * Features:
 * - Green dashed border for visual distinction
 * - Expandable content (preview vs full)
 * - Streaming support for real-time display
 * - Clear visual separation from other output
 */
export class ThinkingContentDisplay {
  private options: Required<ThinkingDisplayOptions>;
  private content: string = '';
  private isActive: boolean = false;
  private startTime: number = 0;
  private renderedLines: number = 0;

  constructor(options: ThinkingDisplayOptions = {}) {
    this.options = {
      maxWidth: options.maxWidth ?? (process.stdout.columns || 80) - 4,
      maxPreviewLines: options.maxPreviewLines ?? 8,
      expanded: options.expanded ?? false,
    };
  }

  // ========================================================================
  // Public API
  // ========================================================================

  /**
   * Start displaying thinking content
   */
  start(): void {
    this.content = '';
    this.isActive = true;
    this.startTime = Date.now();
    this.renderedLines = 0;
  }

  /**
   * Append content to the thinking display
   */
  append(delta: string): void {
    if (!this.isActive) return;
    this.content += delta;
  }

  /**
   * Complete the thinking display and show final result
   */
  complete(): void {
    if (!this.isActive) return;
    this.isActive = false;
    this.render();
  }

  /**
   * Cancel and clear the display
   */
  cancel(): void {
    this.isActive = false;
    this.content = '';
  }

  /**
   * Set expanded mode
   */
  setExpanded(expanded: boolean): void {
    this.options.expanded = expanded;
  }

  // ========================================================================
  // Internal rendering
  // ========================================================================

  /**
   * Render the thinking content box
   */
  private render(): void {
    if (!this.content.trim()) return;

    const width = this.options.maxWidth;
    const duration = ((Date.now() - this.startTime) / 1000).toFixed(1);
    const lines = this.content.split('\n');
    
    // Header
    console.log('');
    console.log(C.border('â”? + DASHED.h.repeat(width - 2) + 'â”?));
    
    const headerText = ` ðŸ’­ æ€è€ƒè¿‡ç¨?${C.muted(`(${duration}s)`)} `;
    const headerPadding = width - 2 - this.stripAnsi(headerText).length;
    console.log(C.border('â•?) + C.thinking.bold(headerText) + ' '.repeat(Math.max(0, headerPadding)) + C.border('â•?));
    console.log(C.border('â”? + DASHED.h.repeat(width - 2) + 'â”?));

    // Content lines
    const displayLines = this.options.expanded 
      ? lines 
      : lines.slice(0, this.options.maxPreviewLines);
    
    for (const line of displayLines) {
      const wrappedLines = this.wrapLine(line, width - 4);
      for (const wrapped of wrappedLines) {
        const padding = width - 4 - this.stripAnsi(wrapped).length;
        console.log(
          C.borderDim('â•?) + ' ' + 
          C.textDim(wrapped) + 
          ' '.repeat(Math.max(0, padding)) + ' ' + 
          C.borderDim('â•?)
        );
      }
    }

    // Show truncation indicator if needed
    if (lines.length > displayLines.length) {
      const moreText = `... è¿˜æœ‰ ${lines.length - displayLines.length} è¡Œ`;
      const padding = width - 4 - moreText.length;
      console.log(C.borderDim('â•?) + ' ' + C.muted(moreText) + ' '.repeat(Math.max(0, padding)) + ' ' + C.borderDim('â•?));
    }

    // Footer
    console.log(C.border('â”? + DASHED.h.repeat(width - 2) + 'â”?));
  }

  // ========================================================================
  // Helper methods
  // ========================================================================

  /**
   * Strip ANSI escape codes from string
   */
  private stripAnsi(str: string): string {
    // eslint-disable-next-line no-control-regex
    return str.replace(/\x1b\[[0-9;]*m/g, '');
  }

  /**
   * Wrap a line to fit within the specified width
   */
  private wrapLine(line: string, width: number): string[] {
    if (line.length <= width) return [line];
    
    const result: string[] = [];
    for (let i = 0; i < line.length; i += width) {
      result.push(line.slice(i, i + width));
    }
    return result;
  }
}

// ============================================================================
// Factory function
// ============================================================================

export function createThinkingContentDisplay(options?: ThinkingDisplayOptions): ThinkingContentDisplay {
  return new ThinkingContentDisplay(options);
}
