// ============================================================================
// Claude Code Inspired Enhancements - Visual Design Improvements
// Enhanced UI patterns inspired by Claude Code's modern terminal interface
// Maintains all existing functionality while improving visual aesthetics
// ============================================================================

import chalk from 'chalk';
import { getTheme } from './theme-config.js';

// ============================================================================
// Enhanced Color Palette
// ============================================================================

export const enhancedColors = {
  // Claude Code style gradients and accents
  gradient: {
    start: '#7C3AED',
    end: '#06B6D4',
    accent: '#EC4899',
  },

  // Enhanced semantic colors with better contrast
  semantic: {
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',
    pending: '#8B5CF6',
    loading: '#06B6D4',
  },

  // Text hierarchy improvements
  text: {
    primary: '#F9FAFB',
    secondary: '#E5E7EB',
    muted: '#9CA3AF',
    dim: '#6B7280',
    hint: '#4B5563',
    code: '#D1FAE5',
  },

  // Background variations for depth
  background: {
    primary: '#1F2937',
    secondary: '#111827',
    tertiary: '#0F172A',
    highlight: '#374151',
    selection: '#4F46E5',
  },

  // Border and divider improvements
  border: {
    subtle: '#374151',
    medium: '#4B5563',
    strong: '#6B7280',
  },
};

// ============================================================================
// Enhanced Box Drawing Characters (Claude Code Style)
// ============================================================================

export const claudeBox = {
  // Modern rounded corners and clean lines
  corners: {
    topLeft: '╭', topRight: '╮',
    bottomLeft: '╰', bottomRight: '╯',
  },

  // Thick borders for emphasis
  thick: {
    horizontal: '━', vertical: '┃',
    topT: '┳', bottomT: '┻',
    leftT: '┣', rightT: '┫',
    cross: '╋',
  },

  // Clean thin borders
  thin: {
    horizontal: '─', vertical: '│',
    topT: '┬', bottomT: '┴',
    leftT: '├', rightT: '┤',
    cross: '┼',
  },

  // Dashed style for subtle divisions
  dashed: {
    horizontal: '┄', vertical: '┆',
  },

  // Icons and indicators
  icons: {
    arrow: '→', chevron: '›',
    bullet: '•', dot: '·',
    check: '✓', cross: '✗',
    sparkles: '✨', brain: '🧠',
    lightning: '⚡', file: '📄',
    folder: '📁', search: '🔍',
    settings: '⚙', clock: '🕐',
    user: '👤', assistant: '🤖',
    tool: '⚙️', thinking: '💭',
  },
};

// ============================================================================
// Enhanced Spinner Animations
// ============================================================================

export const enhancedSpinners = {
  // Claude Code style spinners
  dots: ['⣾', '⣷', '⣯', '⣟', '⡿', '⢿', '⣻', '⣽'],
  line: ['|', '/', '-', '\\'],
  pulse: ['◜', '◠', '◝', '◞', '◡', '◟'],
  bounce: ['●', '○', '●', '○'],

  // Thinking indicator
  thinking: ['▖', '▘', '▝', '▗'],
};

// ============================================================================
// Enhanced Typography Patterns
// ============================================================================

export const typography = {
  // Header styles
  header: {
    main: (text: string) => chalk.hex('#7C3AED').bold(text),
    sub: (text: string) => chalk.hex('#A78BFA').dim.bold(text),
    accent: (text: string) => chalk.hex('#06B6D4').bold(text),
  },

  // Status indicators
  status: {
    success: (text: string) => chalk.hex('#10B981').bold(text),
    warning: (text: string) => chalk.hex('#F59E0B').bold(text),
    error: (text: string) => chalk.hex('#EF4444').bold(text),
    info: (text: string) => chalk.hex('#3B82F6').bold(text),
  },

  // Code and technical text
  code: {
    inline: (text: string) => chalk.hex('#D1FAE5').bgHex('#065F46').bold(text),
    block: (text: string) => chalk.gray.dim(text),
    command: (text: string) => chalk.hex('#7C3AED').bold(text),
  },

  // Metadata and timestamps
  meta: {
    timestamp: (text: string) => chalk.hex('#6B7280').dim(text),
    duration: (text: string) => chalk.hex('#06B6D4').dim(text),
    size: (text: string) => chalk.hex('#9CA3AF').dim(text),
  },
};

// ============================================================================
// Enhanced Border Styles
// ============================================================================

export function createEnhancedBorder(
  width: number = 40,
  style: 'modern' | 'classic' | 'minimal' | 'accent' = 'modern',
  theme?: any
): { top: string; middle: string; bottom: string; sides: string } {
  const chars = claudeBox.thin;
  const color = chalk.hex(theme?.colors?.border || '#4B5563');

  switch (style) {
    case 'modern':
      return {
        top: color(chars.topLeft + chars.horizontal.repeat(width - 2) + chars.topRight),
        middle: color(chars.vertical + ' '.repeat(width - 2) + chars.vertical),
        bottom: color(chars.bottomLeft + chars.horizontal.repeat(width - 2) + chars.bottomRight),
        sides: color(chars.vertical),
      };

    case 'classic':
      return {
        top: color(chars.cross + chars.horizontal.repeat(width - 2) + chars.cross),
        middle: color(chars.vertical + ' '.repeat(width - 2) + chars.vertical),
        bottom: color(chars.cross + chars.horizontal.repeat(width - 2) + chars.cross),
        sides: color(chars.vertical),
      };

    case 'minimal':
      return {
        top: color(chars.horizontal.repeat(width)),
        middle: color('│' + ' '.repeat(width - 2) + '│'),
        bottom: color(chars.horizontal.repeat(width)),
        sides: color('│'),
      };

    case 'accent':
      return {
        top: chalk.hex('#7C3AED')(chars.topLeft + chars.horizontal.repeat(width - 2) + chars.topRight),
        middle: chalk.hex('#7C3AED')(chars.vertical + ' '.repeat(width - 2) + chars.vertical),
        bottom: chalk.hex('#7C3AED')(chars.bottomLeft + chars.horizontal.repeat(width - 2) + chars.bottomRight),
        sides: chalk.hex('#7C3AED')(chars.vertical),
      };
  }
}

// ============================================================================
// Enhanced Progress Indicators
// ============================================================================

export function createEnhancedProgress(
  percent: number,
  options: {
    width?: number;
    style?: 'blocks' | 'smooth' | 'pulse' | 'dots';
    color?: string;
    showPercent?: boolean;
    animated?: boolean;
  } = {}
): string {
  const opts = {
    width: 30,
    style: 'blocks' as const,
    color: '#7C3AED',
    showPercent: true,
    animated: false,
    ...options,
  };

  const filledWidth = Math.round((percent / 100) * opts.width!);
  const emptyWidth = opts.width! - filledWidth;

  let filled: string, empty: string;

  switch (opts.style) {
    case 'blocks':
      filled = '█'.repeat(filledWidth);
      empty = '░'.repeat(emptyWidth);
      break;
    case 'smooth':
      filled = '▓'.repeat(filledWidth);
      empty = '▒'.repeat(emptyWidth);
      break;
    case 'pulse':
      filled = '●'.repeat(filledWidth);
      empty = '○'.repeat(emptyWidth);
      break;
    case 'dots':
      filled = '•'.repeat(filledWidth);
      empty = '·'.repeat(emptyWidth);
      break;
  }

  const progressBar = filled + empty;
  const percentText = opts.showPercent ? ` ${percent}%` : '';

  return chalk.hex(opts.color)(progressBar) + percentText;
}

// ============================================================================
// Enhanced Message Styling
// ============================================================================

export function styleMessage(
  content: string,
  type: 'user' | 'assistant' | 'system' | 'error' | 'success' | 'info' | 'tool' = 'assistant',
  options: {
    timestamp?: Date;
    duration?: number;
    metadata?: Record<string, any>;
  } = {}
): { styledContent: string; metadata: any } {
  const theme = getTheme();

  let styledContent = content;
  let icon = '';

  switch (type) {
    case 'user':
      icon = claudeBox.icons.user;
      styledContent = chalk.hex(theme.colors.info).bold(`${icon} You`) + ': ' + content;
      break;

    case 'assistant':
      icon = claudeBox.icons.brain;
      styledContent = chalk.hex(theme.colors.brand).bold(`${icon} Assistant`) + ': ' + content;
      break;

    case 'system':
      icon = claudeBox.icons.settings;
      styledContent = chalk.hex(theme.colors.dim).dim(`${icon} System`) + ': ' + content;
      break;

    case 'error':
      icon = claudeBox.icons.cross;
      styledContent = chalk.hex(theme.colors.error).bold(`${icon} Error`) + ': ' + content;
      break;

    case 'success':
      icon = claudeBox.icons.check;
      styledContent = chalk.hex(theme.colors.success).bold(`${icon} Success`) + ': ' + content;
      break;

    case 'info':
      icon = claudeBox.icons.search;
      styledContent = chalk.hex(theme.colors.info).bold(`${icon} Info`) + ': ' + content;
      break;

    case 'tool':
      icon = claudeBox.icons.tool;
      styledContent = chalk.hex(theme.colors.warning).bold(`${icon} Tool`) + ': ' + content;
      break;
  }

  const metadata = {
    ...options.metadata,
    timestamp: options.timestamp || new Date(),
    duration: options.duration,
    type,
  };

  return { styledContent, metadata };
}

// ============================================================================
// Enhanced Tool Call Display
// ============================================================================

export function formatToolCall(
  name: string,
  input?: Record<string, any>,
  result?: string,
  isError: boolean = false
): string {
  const icon = isError ? claudeBox.icons.cross : claudeBox.icons.tool;
  const color = isError ? 'red' : 'cyan';

  let output = chalk[color].bold(`${icon} ${name}`);

  if (input) {
    const inputStr = JSON.stringify(input, null, 2);
    const preview = inputStr.length > 50 ? inputStr.slice(0, 50) + '...' : inputStr;
    output += '\n' + chalk.gray.dim('  Input: ') + chalk.gray.dim(preview);
  }

  if (result && !isError) {
    const resultStr = typeof result === 'string' ? result : JSON.stringify(result);
    const preview = resultStr.length > 80 ? resultStr.slice(0, 80) + '...' : resultStr;
    output += '\n' + chalk.gray.dim('  Output: ') + chalk.gray.dim(preview);
  }

  if (isError && result) {
    output += '\n' + chalk.red.dim('  Error: ') + chalk.red.dim(String(result));
  }

  return output;
}

// ============================================================================
// Enhanced Thinking Block Display
// ============================================================================

export function formatThinkingBlock(
  content: string,
  elapsed: number,
  isComplete: boolean = false
): string {
  const icon = claudeBox.icons.thinking;
  const color = isComplete ? 'gray' : 'yellow';

  let output = chalk[color].bold(`${icon} Thinking${elapsed > 0 ? ` (${elapsed}ms)` : ''}`);

  if (content.trim()) {
    const lines = content.split('\n');
    const previewLines = lines.slice(0, 3); // Show first 3 lines
    const truncated = lines.length > 3;

    output += '\n' + previewLines.map(line =>
      chalk.gray.dim('  ' + line.slice(0, 80))
    ).join('\n');

    if (truncated) {
      output += '\n' + chalk.gray.dim('  ...') + (lines.length > 3 ? ` ${lines.length - 3} more lines` : '');
    }
  }

  if (!isComplete) {
    output += '\n' + chalk.yellow.dim('  [thinking in progress...]');
  }

  return output;
}

// ============================================================================
// Enhanced Status Bar
// ============================================================================

export function createEnhancedStatusBar(
  sessionInfo: {
    model?: string;
    tokens?: number;
    turn?: number;
    status?: string;
    theme?: any;
  }
): string {
  const theme = sessionInfo.theme || getTheme();
  const parts: string[] = [];

  // Model indicator
  if (sessionInfo.model) {
    parts.push(chalk.hex(theme.colors.brand).bold(`Model: ${sessionInfo.model}`));
  }

  // Token usage
  if (sessionInfo.tokens !== undefined) {
    const tokenColor = sessionInfo.tokens > 10000 ? 'yellow' : 'green';
    parts.push(chalk[tokenColor](`Tokens: ${sessionInfo.tokens.toLocaleString()}`));
  }

  // Turn counter
  if (sessionInfo.turn !== undefined) {
    parts.push(chalk.hex(theme.colors.info).dim(`Turn: ${sessionInfo.turn}`));
  }

  // Status
  if (sessionInfo.status) {
    const statusIcon = sessionInfo.status === 'running' ? '▶' :
                      sessionInfo.status === 'idle' ? '⏸' :
                      sessionInfo.status === 'error' ? '❌' : '✅';
    parts.push(chalk.hex(theme.colors[sessionInfo.status === 'error' ? 'error' : 'success'])
      .bold(`${statusIcon} ${sessionInfo.status}`));
  }

  return parts.join('  ');
}

// ============================================================================
// Enhanced Welcome Screen
// ============================================================================

export function createEnhancedWelcome(): string {
  const theme = getTheme();
  const welcome = [
    '',
    chalk.hex(theme.colors.brand).bold('🚀 Welcome to Nova CLI v3.0'),
    '',
    chalk.gray.dim('Enhanced with performance optimizations:'),
    chalk.hex(theme.colors.success).dim('  • Parallel tool execution (up to 3 concurrent)'),
    chalk.hex(theme.colors.info).dim('  • Optimized context compression with caching'),
    chalk.hex(theme.colors.warning).dim('  • Smart token management and memory optimization'),
    '',
    chalk.gray.dim('Available commands:'),
    chalk.hex(theme.colors.cyan).dim('  • /help          ') + chalk.gray.dim('- Show help information'),
    chalk.hex(theme.colors.cyan).dim('  • /model         ') + chalk.gray.dim('- Switch AI model'),
    chalk.hex(theme.colors.cyan).dim('  • /memory        ') + chalk.gray.dim('- Manage conversation memory'),
    chalk.hex(theme.colors.cyan).dim('  • /history       ') + chalk.gray.dim('- View conversation history'),
    chalk.hex(theme.colors.cyan).dim('  • /clear         ') + chalk.gray.dim('- Clear current session'),
    chalk.hex(theme.colors.cyan).dim('  • /exit          ') + chalk.gray.dim('- Exit the application'),
    '',
    chalk.hex(theme.colors.dim).dim('Type your message and press Enter to begin...'),
    '',
  ];

  return welcome.join('\n');
}

// ============================================================================
// Theme Integration Helper
// ============================================================================

export function integrateClaudeCodeTheme(themeId: 'dark' | 'light' = 'dark'): any {
  const themes = {
    dark: {
      ...getTheme('dark'),
      claudeAccent: '#7C3AED',
      claudeSecondary: '#06B6D4',
      claudeSuccess: '#10B981',
      claudeWarning: '#F59E0B',
      claudeError: '#EF4444',
    },
    light: {
      ...getTheme('light'),
      claudeAccent: '#6366F1',
      claudeSecondary: '#06B6D4',
      claudeSuccess: '#059669',
      claudeWarning: '#D97706',
      claudeError: '#DC2626',
    },
  };

  return themes[themeId];
}

// ============================================================================
// Export Enhanced Components
// ============================================================================

export default {
  colors: enhancedColors,
  box: claudeBox,
  spinners: enhancedSpinners,
  typography,
  borders: {
    create: createEnhancedBorder,
  },
  progress: {
    create: createEnhancedProgress,
  },
  messages: {
    style: styleMessage,
    tool: formatToolCall,
    thinking: formatThinkingBlock,
  },
  status: {
    bar: createEnhancedStatusBar,
  },
  welcome: createEnhancedWelcome,
  theme: integrateClaudeCodeTheme,
};