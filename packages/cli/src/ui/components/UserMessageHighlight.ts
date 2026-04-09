// ============================================================================
// UserMessageHighlight - Enhanced highlighted user message display component
// Modern design inspired by Claude Code with theme system integration
// ============================================================================

import chalk from 'chalk';
import { getTheme } from '../themes/theme-config.ts';

// ============================================================================
// Types
// ============================================================================

export interface UserMessageOptions {
  /** Maximum width of the message box (default: terminal width - 4) */
  maxWidth?: number;
  /** Show timestamp (default: true) */
  showTimestamp?: boolean;
  /** Highlight style (default: 'blue') */
  highlightColor?: 'blue' | 'purple' | 'cyan' | 'green';
}

// ============================================================================
// Color palettes for different highlight styles - Enhanced with theme system
// ============================================================================

const HIGHLIGHT_STYLES = {
  blue: {
    border: chalk.hex('#3B82F6'),
    borderDim: chalk.hex('#3B82F6').dim,
    bg: chalk.bgHex('#1E3A5F'),
    accent: chalk.hex('#60A5FA'),
  },
  purple: {
    border: chalk.hex('#7C3AED'),
    borderDim: chalk.hex('#7C3AED').dim,
    bg: chalk.bgHex('#2E1065'),
    accent: chalk.hex('#A78BFA'),
  },
  cyan: {
    border: chalk.hex('#06B6D4'),
    borderDim: chalk.hex('#06B6D4').dim,
    bg: chalk.bgHex('#083344'),
    accent: chalk.hex('#22D3EE'),
  },
  green: {
    border: chalk.hex('#10B981'),
    borderDim: chalk.hex('#10B981').dim,
    bg: chalk.bgHex('#052E16'),
    accent: chalk.hex('#34D399'),
  },
  modern: {
    border: chalk.hex('#7C3AED'),
    borderDim: chalk.hex('#5B21B6').dim,
    bg: chalk.bgHex('#1F2937'),
    accent: chalk.hex('#A78BFA'),
  },
};

// ============================================================================
// Enhanced box drawing characters with modern symbols
// ============================================================================

const BOX = {
  tl: '╭', tr: '╮', bl: '╰', br: '╯',
  h: '─', hThick: '━', hDouble: '═',
  v: '│', vThick: '┃', vDouble: '║',
  ht: '├', htr: '┤', hc: '┬', hcB: '┴',
  vt: '┬', vtr: '┤', vc: '├', vcB: '┤',
  arrow: '›', user: '👤', userAlt: '◈',
  star: '★', diamond: '◆', circle: '●',
  sparkles: '✨', rocket: '🚀', lightning: '⚡',
};

// ============================================================================
// UserMessageHighlight class
// ============================================================================

/**
 * Displays user messages in a highlighted box for easy identification.
 * 
 * Features:
 * - Distinctive highlighted border and background
 * - User icon for quick visual identification
 * - Word wrapping for long messages
 * - Timestamp display
 */
export class UserMessageHighlight {
  private options: Required<UserMessageOptions>;

  constructor(options: UserMessageOptions = {}) {
    this.options = {
      maxWidth: options.maxWidth ?? (process.stdout.columns || 80) - 4,
      showTimestamp: options.showTimestamp ?? true,
      highlightColor: options.highlightColor ?? 'purple',
    };
  }

  // ========================================================================
  // Public API
  // ========================================================================

  /**
   * Set the highlight color style
   */
  setHighlightColor(color: UserMessageOptions['highlightColor']): void {
    this.options.highlightColor = color;
  }

  /**
   * Render a user message with enhanced visual design
   */
  render(message: string, timestamp?: Date): void {
    const style = HIGHLIGHT_STYLES[this.options.highlightColor];
    const width = this.options.maxWidth;
    const time = timestamp || new Date();
    const timeStr = this.options.showTimestamp 
      ? time.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
      : '';

    // Enhanced header with modern icons and design
    const headerIcon = BOX.sparkles;
    const headerLabel = ` ${headerIcon} 您的消息 `;
    const headerContent = style.accent.bold(headerLabel) + (timeStr ? style.borderDim(` ${timeStr}`) : '');
    const headerPadding = width - this.stripAnsi(headerContent).length - 2;
    
    console.log('');
    // Top border with accent
    console.log(style.border(BOX.tl) + style.border(BOX.hThick.repeat(3)) + style.border(BOX.h.repeat(width - 6)) + style.border(BOX.hThick.repeat(3)) + style.border(BOX.tr));
    // Header line
    console.log(style.border(BOX.v) + ' ' + headerContent + ' '.repeat(Math.max(0, headerPadding)) + ' ' + style.border(BOX.v));
    // Divider
    console.log(style.borderDim(BOX.vc) + style.borderDim(BOX.h.repeat(width)) + style.borderDim(BOX.vcB));

    // Message content with enhanced formatting
    const lines = this.wrapText(message, width - 4);
    for (const line of lines) {
      const linePadding = width - 4 - this.stripAnsi(line).length;
      // Add subtle indentation for better readability
      console.log(
        style.border(BOX.v) + '   ' + 
        style.accent(line) + 
        ' '.repeat(Math.max(0, linePadding)) + '   ' + 
        style.border(BOX.v)
      );
    }

    // Enhanced footer with modern design
    console.log(style.borderDim(BOX.vc) + style.borderDim(BOX.h.repeat(width)) + style.borderDim(BOX.vcB));
    // Bottom border with accent
    console.log(style.border(BOX.bl) + style.border(BOX.hThick.repeat(3)) + style.border(BOX.h.repeat(width - 6)) + style.border(BOX.hThick.repeat(3)) + style.border(BOX.br));
    console.log('');
  }

  /**
   * Render a compact one-line user message
   */
  renderCompact(message: string, timestamp?: Date): void {
    const style = HIGHLIGHT_STYLES[this.options.highlightColor];
    const width = Math.min(this.options.maxWidth, 80);
    const time = timestamp || new Date();
    const timeStr = this.options.showTimestamp 
      ? time.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
      : '';

    // Truncate message if needed
    const maxMsgLen = width - 20;
    const truncatedMsg = message.length > maxMsgLen 
      ? message.slice(0, maxMsgLen - 3) + '...'
      : message;

    const content = `${BOX.userAlt} ${truncatedMsg}`;
    const timePart = timeStr ? style.borderDim(` ${timeStr}`) : '';
    const line = style.border(BOX.v) + ' ' + style.accent.bold(content) + timePart;
    const padding = width - this.stripAnsi(line).length - 1;

    console.log('');
    console.log(line + ' '.repeat(Math.max(0, padding)) + style.border(BOX.v));
    console.log('');
  }

  /**
   * Render a highlighted inline marker (for message list context)
   */
  renderInline(message: string): string {
    const style = HIGHLIGHT_STYLES[this.options.highlightColor];
    const maxLen = 60;
    const truncated = message.length > maxLen ? message.slice(0, maxLen - 3) + '...' : message;
    return style.bg(' ' + BOX.userAlt + ' ') + ' ' + style.accent(truncated);
  }

  // ========================================================================
  // Helper methods
  // ========================================================================

  /**
   * Strip ANSI escape codes from string (for length calculation)
   */
  private stripAnsi(str: string): string {
    // eslint-disable-next-line no-control-regex
    return str.replace(/\x1b\[[0-9;]*m/g, '');
  }

  /**
   * Wrap text to lines respecting terminal width
   */
  private wrapText(text: string, width: number): string[] {
    if (!text) return [];

    const result: string[] = [];
    const paragraphs = text.split('\n');

    for (const paragraph of paragraphs) {
      if (paragraph.length === 0) {
        result.push('');
        continue;
      }

      // Split by word boundaries
      const words = paragraph.split(' ');
      let currentLine = '';

      for (const word of words) {
        if (currentLine.length === 0) {
          currentLine = word;
        } else if (currentLine.length + word.length + 1 <= width) {
          currentLine += ' ' + word;
        } else {
          result.push(currentLine);
          currentLine = word;
        }
      }

      if (currentLine.length > 0) {
        result.push(currentLine);
      }
    }

    return result;
  }
}

// ============================================================================
// Factory function
// ============================================================================

export function createUserMessageHighlight(options?: UserMessageOptions): UserMessageHighlight {
  return new UserMessageHighlight(options);
}

// ============================================================================
// Convenience function for quick rendering
// ============================================================================

export function highlightUserMessage(message: string, options?: UserMessageOptions): void {
  const highlighter = new UserMessageHighlight(options);
  highlighter.render(message);
}
