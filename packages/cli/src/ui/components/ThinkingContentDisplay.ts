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
  h: '╌',      // Dashed horizontal
  v: '╎',      // Dashed vertical
  tl: '┌',     // Top-left (solid for corners)
  tr: '┐',     // Top-right
  bl: '└',     // Bottom-left
  br: '┘',     // Bottom-right
  hDash: '╌',  // Dashed horizontal
  vDash: '╎',  // Dashed vertical
  bullet: '•',
  arrow: '→',
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
    console.log(C.border('┌' + DASHED.h.repeat(width - 2) + '┐'));
    
    const headerText = ` 💭 思考过程 ${C.muted(`(${duration}s)`)} `;
    const headerPadding = width - 2 - this.getStrippedWidth(headerText);
    console.log(C.border('╎') + C.thinking.bold(headerText) + ' '.repeat(Math.max(0, headerPadding)) + C.border('╎'));
    console.log(C.border('├' + DASHED.h.repeat(width - 2) + '┤'));

    // Content lines
    const displayLines = this.options.expanded 
      ? lines 
      : lines.slice(0, this.options.maxPreviewLines);
    
    for (const line of displayLines) {
      const wrappedLines = this.wrapLine(line, width - 4);
      for (const wrapped of wrappedLines) {
        const padding = width - 4 - this.getStrippedWidth(wrapped);
        console.log(
          C.borderDim('╎') + ' ' + 
          C.textDim(wrapped) + 
          ' '.repeat(Math.max(0, padding)) + ' ' + 
          C.borderDim('╎')
        );
      }
    }

    // Show truncation indicator if needed
    if (lines.length > displayLines.length) {
      const moreText = `... 还有 ${lines.length - displayLines.length} 行`;
      const padding = width - 4 - this.getStrippedWidth(moreText);
      console.log(C.borderDim('╎') + ' ' + C.muted(moreText) + ' '.repeat(Math.max(0, padding)) + ' ' + C.borderDim('╎'));
    }

    // Footer
    console.log(C.border('└' + DASHED.h.repeat(width - 2) + '┘'));
  }

  // ========================================================================
  // Helper methods
  // ========================================================================

  /**
   * Strip ANSI escape codes from string and return the cleaned string
   */
  private stripAnsi(str: string): string {
    // eslint-disable-next-line no-control-regex
    return str.replace(/\x1b\[[0-9;]*m/g, '');
  }

  /**
   * Get the display width of a string with ANSI codes removed
   */
  private getStrippedWidth(str: string): number {
    const stripped = this.stripAnsi(str);
    return this.getDisplayWidth(stripped);
  }

  /**
   * Calculate the display width of a string (accounting for full-width characters)
   */
  private getDisplayWidth(str: string): number {
    let width = 0;
    for (const char of str) {
      // Check if character is full-width (Chinese, Japanese, Korean, etc.)
      if (this.isFullWidthChar(char)) {
        width += 2;
      } else {
        width += 1;
      }
    }
    return width;
  }

  /**
   * Check if a character is full-width
   */
  private isFullWidthChar(char: string): boolean {
    const code = char.charCodeAt(0);
    // Chinese, Japanese, Korean, and other full-width characters
    return (
      (code >= 0x4E00 && code <= 0x9FFF) || // CJK Unified Ideographs
      (code >= 0x3400 && code <= 0x4DBF) || // CJK Extension A
      (code >= 0x20000 && code <= 0x2A6DF) || // CJK Extension B
      (code >= 0x2A700 && code <= 0x2B73F) || // CJK Extension C
      (code >= 0x2B740 && code <= 0x2B81F) || // CJK Extension D
      (code >= 0x2B820 && code <= 0x2CEAF) || // CJK Extension E
      (code >= 0xF900 && code <= 0xFAFF) || // CJK Compatibility Ideographs
      (code >= 0x2F800 && code <= 0x2FA1F) || // CJK Compatibility Ideographs Supplement
      (code >= 0x3000 && code <= 0x303F) || // CJK Symbols and Punctuation
      (code >= 0xFF00 && code <= 0xFFEF) // Half-width and Full-width Forms
    );
  }

  /**
   * Wrap a line to fit within the specified width (accounting for full-width characters)
   */
  private wrapLine(line: string, width: number): string[] {
    if (this.getDisplayWidth(line) <= width) return [line];
    
    const result: string[] = [];
    let currentLine = '';
    let currentWidth = 0;
    
    for (const char of line) {
      const charWidth = this.isFullWidthChar(char) ? 2 : 1;
      
      if (currentWidth + charWidth > width) {
        result.push(currentLine);
        currentLine = char;
        currentWidth = charWidth;
      } else {
        currentLine += char;
        currentWidth += charWidth;
      }
    }
    
    if (currentLine) {
      result.push(currentLine);
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
