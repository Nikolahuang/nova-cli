// ============================================================================
// ThinkingBlockRenderer - Collapsible thinking block display for REPL
// ============================================================================

import chalk from 'chalk';

// ============================================================================
// Types
// ============================================================================

export interface ThinkingBlockOptions {
  /** Whether to show expanded thinking blocks (default: false = compact) */
  expanded?: boolean;
  /** Maximum lines to show in streaming preview (default: 4) */
  maxPreviewLines?: number;
  /** Maximum characters per line in preview (default: 80) */
  maxLineLength?: number;
  /** Show elapsed time (default: true) */
  showElapsedTime?: boolean;
  /** Custom icon for thinking block (default: '💭') */
  icon?: string;
  /** Show streaming preview (default: false - only show summary when complete) */
  showStreamingPreview?: boolean;
}

export interface ThinkingBlockState {
  text: string;
  startTime: number;
  isComplete: boolean;
}

// ============================================================================
// ANSI helpers for terminal control
// ============================================================================

const ANSI = {
  cursorUp: (n: number): string => `\x1b[${n}A`,
  cursorDown: (n: number): string => `\x1b[${n}B`,
  cursorLineStart: (): string => '\x1b[0G',
  clearDown: (): string => '\x1b[0J',
  clearLine: (): string => '\x1b[2K',
  hideCursor: (): string => '\x1b[?25l',
  showCursor: (): string => '\x1b[?25h',
  saveCursor: (): string => '\x1b[s',
  restoreCursor: (): string => '\x1b[u',
  dim: (): string => '\x1b[2m',
  reset: (): string => '\x1b[0m',
};

// ============================================================================
// ThinkingBlockRenderer
// ============================================================================

/**
 * Renders a collapsible thinking block in the terminal.
 * 
 * Features:
 * - Gray/dim color for thinking content (distinguishable from normal output)
 * - Collapsed mode: single summary line with char/line count
 * - Expanded mode: shows preview of thinking content
 * - Optional streaming preview (disabled by default for cleaner UI)
 */
export class ThinkingBlockRenderer {
  private options: Required<ThinkingBlockOptions>;
  private state: ThinkingBlockState | null = null;
  private renderedLineCount = 0;
  private isActive = false;

  constructor(options: ThinkingBlockOptions = {}) {
    this.options = {
      expanded: options.expanded ?? false,
      maxPreviewLines: options.maxPreviewLines ?? 4,
      maxLineLength: options.maxLineLength ?? 80,
      showElapsedTime: options.showElapsedTime ?? true,
      icon: options.icon ?? '💭',
      showStreamingPreview: options.showStreamingPreview ?? false,
    };
  }

  // ========================================================================
  // Public API
  // ========================================================================

  /**
   * Set whether to show expanded thinking blocks
   */
  setExpanded(expanded: boolean): void {
    this.options.expanded = expanded;
  }

  /**
   * Check if currently rendering a thinking block
   */
  isRendering(): boolean {
    return this.isActive;
  }

  /**
   * Start a new thinking block.
   * Call this when thinking content begins streaming.
   */
  start(): void {
    this.state = {
      text: '',
      startTime: Date.now(),
      isComplete: false,
    };
    this.renderedLineCount = 0;
    this.isActive = true;

    // Show minimal indicator during thinking
    if (this.options.showStreamingPreview) {
      process.stdout.write(ANSI.hideCursor());
      this.renderStreamingIndicator();
    } else {
      // Just show a subtle indicator
      this.renderMinimalIndicator();
    }
  }

  /**
   * Append text to the thinking block.
   * Updates the display in real-time only if showStreamingPreview is true.
   */
  append(delta: string): void {
    if (!this.state || !this.isActive) return;
    this.state.text += delta;

    // Only update display if streaming preview is enabled
    if (this.options.showStreamingPreview) {
      this.renderStreaming();
    }
  }

  /**
   * Complete the thinking block.
   * Clears any streaming display and shows final collapsed/expanded view.
   */
  complete(): void {
    if (!this.state || !this.isActive) return;
    this.state.isComplete = true;

    // Clear any streaming display
    if (this.options.showStreamingPreview) {
      this.clearRender();
      process.stdout.write(ANSI.showCursor());
    }

    // Always show final summary (collapsed or expanded)
    this.renderFinal();
    this.isActive = false;
  }

  /**
   * Cancel and clear the thinking block display.
   */
  cancel(): void {
    if (!this.isActive) return;
    this.clearRender();
    this.state = null;
    this.isActive = false;
    process.stdout.write(ANSI.showCursor());
  }

  /**
   * Get the current thinking text (if any)
   */
  getText(): string | null {
    return this.state?.text ?? null;
  }

  /**
   * Get elapsed time since thinking started
   */
  getElapsed(): string {
    if (!this.state) return '';
    return this.formatDuration(this.state.startTime);
  }

  // ========================================================================
  // Internal rendering
  // ========================================================================

  /**
   * Render minimal indicator during thinking (default behavior)
   */
  private renderMinimalIndicator(): void {
    const elapsed = this.formatDuration(this.state?.startTime ?? Date.now());
    // Use gray/dim styling for thinking indicator
    process.stdout.write(
      chalk.gray.dim('  ') +
      chalk.gray.dim(this.options.icon + ' ') +
      chalk.gray.dim.italic('thinking') +
      chalk.gray.dim(` (${elapsed})...`) +
      '\r'
    );
  }

  /**
   * Render streaming indicator (when showStreamingPreview is true)
   */
  private renderStreamingIndicator(): void {
    const elapsed = this.formatDuration(this.state?.startTime ?? Date.now());
    process.stdout.write(
      ANSI.clearLine() +
      chalk.gray.dim('  ') +
      chalk.gray.dim(this.options.icon + ' ') +
      chalk.gray.dim.italic('thinking') +
      chalk.gray.dim(` (${elapsed})...`) +
      '\n'
    );
    this.renderedLineCount = 1;
  }

  /**
   * Render the streaming thinking block (when showStreamingPreview is true).
   */
  private renderStreaming(): void {
    if (!this.state) return;

    const text = this.state.text;
    const termWidth = process.stdout.columns || 80;
    const usableWidth = termWidth - 4;

    // Calculate text dimensions
    const textLines = this.calculateTextLines(text, usableWidth);
    const maxLines = this.options.maxPreviewLines;

    // Clear previous render
    if (this.renderedLineCount > 0) {
      this.clearLines(this.renderedLineCount);
    }

    // Render header with elapsed time
    const elapsed = this.formatDuration(this.state.startTime);
    const header = chalk.gray.dim(`  ${this.options.icon} `) + 
                   chalk.gray.dim.italic('thinking') + 
                   chalk.gray.dim(` (${elapsed})`);
    process.stdout.write(header + '\n');

    // Render text preview in gray/dim (truncated)
    const lines = this.wrapTextToLines(text, usableWidth);
    const visibleLines = lines.slice(-maxLines);

    if (lines.length > maxLines) {
      process.stdout.write(chalk.gray.dim('  ...') + '\n');
      this.renderedLineCount = 2;
    } else {
      this.renderedLineCount = 1;
    }

    for (const line of visibleLines) {
      const truncated = line.slice(0, this.options.maxLineLength);
      // Use gray.dim for thinking content - clearly distinguishable
      process.stdout.write(chalk.gray.dim('  ') + chalk.gray.dim(truncated) + '\n');
      this.renderedLineCount++;
    }

    // Move cursor back up so next delta overwrites
    if (this.renderedLineCount > 0) {
      process.stdout.write(ANSI.cursorUp(this.renderedLineCount));
    }
  }

  /**
   * Clear the current streaming render.
   */
  private clearRender(): void {
    if (this.renderedLineCount > 0) {
      this.clearLines(this.renderedLineCount);
      this.renderedLineCount = 0;
    } else {
      // Clear the minimal indicator line
      process.stdout.write(ANSI.clearLine() + ANSI.cursorLineStart());
    }
  }

  /**
   * Render the final collapsed/expanded thinking block.
   * Uses gray/dim color to distinguish from normal output.
   */
  private renderFinal(): void {
    if (!this.state || !this.state.text.trim()) return;

    const text = this.state.text.trim();
    const elapsed = this.formatDuration(this.state.startTime);
    const charCount = text.length;
    const lineCount = text.split('\n').length;

    if (!this.options.expanded) {
      // Collapsed: show single summary line in gray
      // This is the default - minimal visual impact
      console.log(
        chalk.gray.dim('  └─ ') +
        chalk.gray.dim(this.options.icon + ' ') +
        chalk.gray.dim.italic('thinking') +
        chalk.gray.dim(` (${charCount} chars, ${elapsed})`)
      );
    } else {
      // Expanded: show preview lines in gray
      const lines = text.split('\n');
      const previewLines = lines.slice(0, this.options.maxPreviewLines);
      const truncated = lines.length > this.options.maxPreviewLines;

      console.log(
        chalk.gray.dim('  ┌─ ') +
        chalk.gray.dim(this.options.icon + ' ') +
        chalk.gray.dim.italic(`thinking (${elapsed})`)
      );

      for (const line of previewLines) {
        const truncatedLine = line.slice(0, this.options.maxLineLength);
        // Gray/dim styling for thinking content
        console.log(chalk.gray.dim('  │ ') + chalk.gray.dim(truncatedLine));
      }

      if (truncated) {
        console.log(chalk.gray.dim(`  └─ ... (${lines.length - this.options.maxPreviewLines} more lines)`));
      } else {
        console.log(chalk.gray.dim('  └─ end'));
      }
    }
  }

  // ========================================================================
  // Helper methods
  // ========================================================================

  /**
   * Clear N lines from current cursor position upward.
   */
  private clearLines(count: number): void {
    if (count <= 0) return;

    process.stdout.write(
      ANSI.cursorUp(count) +
      ANSI.clearLine() +
      '\n'.repeat(count - 1) +
      ANSI.cursorUp(count - 1) +
      ANSI.clearLine() +
      ANSI.cursorLineStart()
    );
  }

  /**
   * Calculate how many terminal lines a text will occupy.
   */
  private calculateTextLines(text: string, width: number): number {
    if (!text) return 0;
    const lines = text.split('\n');
    let totalLines = 0;
    for (const line of lines) {
      if (line.length === 0) {
        totalLines += 1;
      } else {
        totalLines += Math.ceil(line.length / width);
      }
    }
    return Math.max(1, totalLines);
  }

  /**
   * Wrap text to lines respecting terminal width.
   */
  private wrapTextToLines(text: string, width: number): string[] {
    if (!text) return [];

    const result: string[] = [];
    const paragraphs = text.split('\n');

    for (const paragraph of paragraphs) {
      if (paragraph.length === 0) {
        result.push('');
        continue;
      }
      for (let i = 0; i < paragraph.length; i += width) {
        result.push(paragraph.slice(i, i + width));
      }
    }

    return result;
  }

  /**
   * Format duration in human-readable form.
   */
  private formatDuration(startTime: number): string {
    const ms = Date.now() - startTime;
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  }
}

// ============================================================================
// Factory function
// ============================================================================

export function createThinkingBlockRenderer(options?: ThinkingBlockOptions): ThinkingBlockRenderer {
  return new ThinkingBlockRenderer(options);
}
