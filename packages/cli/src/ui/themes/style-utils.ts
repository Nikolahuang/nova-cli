// ============================================================================
// Style Utilities - Visual enhancement functions
// Provides visual polish without changing functionality
// ============================================================================

import { Theme, getTheme } from './theme-config.js';

// ============================================================================
// Visual Enhancement Types
// ============================================================================

export interface StyleOptions {
  theme?: Theme;
  bold?: boolean;
  dim?: boolean;
  underline?: boolean;
  italic?: boolean;
}

export interface BorderStyle {
  style: 'single' | 'double' | 'round' | 'bold' | 'dashed';
  color?: string;
  padding?: number;
}

export interface HighlightStyle {
  color?: string;
  backgroundColor?: string;
  bold?: boolean;
  dim?: boolean;
}

// ============================================================================
// Border Enhancement
// ============================================================================

/**
 * Get border style characters for different border types
 */
export function getBorderCharacters(style: 'single' | 'double' | 'round' | 'bold' | 'dashed') {
  const borders = {
    single: {
      topLeft: '┌',
      topRight: '┐',
      bottomLeft: '└',
      bottomRight: '┘',
      horizontal: '─',
      vertical: '│',
      topT: '┬',
      bottomT: '┴',
      leftT: '├',
      rightT: '┤',
      cross: '┼',
    },
    double: {
      topLeft: '╔',
      topRight: '╗',
      bottomLeft: '╚',
      bottomRight: '╝',
      horizontal: '═',
      vertical: '║',
      topT: '╦',
      bottomT: '╩',
      leftT: '╠',
      rightT: '╣',
      cross: '╬',
    },
    round: {
      topLeft: '╭',
      topRight: '╮',
      bottomLeft: '╰',
      bottomRight: '╯',
      horizontal: '─',
      vertical: '│',
      topT: '┬',
      bottomT: '┴',
      leftT: '├',
      rightT: '┤',
      cross: '┼',
    },
    bold: {
      topLeft: '┏',
      topRight: '┓',
      bottomLeft: '┗',
      bottomRight: '┛',
      horizontal: '━',
      vertical: '┃',
      topT: '┳',
      bottomT: '┻',
      leftT: '┣',
      rightT: '┫',
      cross: '╋',
    },
    dashed: {
      topLeft: '┌',
      topRight: '┐',
      bottomLeft: '└',
      bottomRight: '┘',
      horizontal: '┄',
      vertical: '┆',
      topT: '┬',
      bottomT: '┴',
      leftT: '├',
      rightT: '┤',
      cross: '┼',
    },
  };
  return borders[style];
}

/**
 * Create a decorative separator line
 */
export function createSeparator(
  char: string = '─',
  length: number = 40,
  style: 'plain' | 'dotted' | 'dashed' = 'plain'
): string {
  if (style === 'dotted') {
    return char === '─' ? '·'.repeat(length) : char.repeat(Math.ceil(length / 2));
  } else if (style === 'dashed') {
    return char === '─' ? '─'.repeat(Math.ceil(length / 2)) + ' '.repeat(Math.floor(length / 2)) : char.repeat(Math.ceil(length / 3));
  }
  return char.repeat(length);
}

// ============================================================================
// Icon Enhancement
// ============================================================================

/**
 * Get enhanced icon with visual indicators
 */
export function getEnhancedIcon(
  type: 'success' | 'warning' | 'error' | 'info' | 'loading' | 'thinking' | 'tool' | 'file',
  theme?: Theme,
  frame?: number
): string {
  const t = theme || getTheme();
  const icons = t.styles.icons;

  // Add color prefix for terminals that support it
  const addColor = (icon: string, color: string): string => {
    // In React/Ink, color is handled via Text component
    // This is for reference when using raw strings
    return icon;
  };

  switch (type) {
    case 'loading':
      if (frame !== undefined && icons.loading.length > 0) {
        return icons.loading[frame % icons.loading.length];
      }
      return icons.loading[0];
    default:
      return icons[type] || '•';
  }
}

/**
 * Get decorative prefix for different message types
 */
export function getDecorativePrefix(role: 'user' | 'assistant' | 'tool', theme?: Theme): string {
  const t = theme || getTheme();
  
  switch (role) {
    case 'user':
      return `${t.styles.icons.arrow} `;
    case 'assistant':
      return `${t.styles.decorations.chevron} `;
    case 'tool':
      return `${t.styles.icons.tool} `;
    default:
      return `${t.styles.decorations.bullet} `;
  }
}

// ============================================================================
// Text Enhancement
// ============================================================================

/**
 * Create a highlighted badge effect
 */
export function createBadge(
  text: string,
  color: string,
  theme?: Theme
): { text: string; color: string; bold: boolean } {
  return {
    text: ` ${text} `,
    color,
    bold: true,
  };
}

/**
 * Create a status indicator with color coding
 */
export function createStatusIndicator(
  status: 'success' | 'warning' | 'error' | 'info' | 'pending' | 'loading',
  theme?: Theme
): { icon: string; color: string; label: string } {
  const t = theme || getTheme();
  
  const statusConfig = {
    success: {
      icon: t.styles.icons.success,
      color: t.colors.success,
      label: 'OK',
    },
    warning: {
      icon: t.styles.icons.warning,
      color: t.colors.warning,
      label: 'WARN',
    },
    error: {
      icon: t.styles.icons.error,
      color: t.colors.error,
      label: 'ERROR',
    },
    info: {
      icon: t.styles.icons.info,
      color: t.colors.info,
      label: 'INFO',
    },
    pending: {
      icon: '○',
      color: t.colors.dim,
      label: 'PENDING',
    },
    loading: {
      icon: '◐',
      color: t.colors.warning,
      label: 'LOADING',
    },
  };

  return statusConfig[status];
}

// ============================================================================
// Spacing & Layout Enhancement
// ============================================================================

/**
 * Get consistent spacing based on theme
 */
export function getSpacing(
  size: 'xs' | 'sm' | 'md' | 'lg' | 'xl',
  theme?: Theme
): number {
  const t = theme || getTheme();
  return t.styles.spacing[size];
}

/**
 * Create a padded text block
 */
export function createPaddedBlock(
  text: string,
  padding: number = 1,
  vertical: boolean = true
): string {
  const pad = ' '.repeat(padding);
  if (vertical) {
    return `${pad}${text}${pad}`;
  }
  return text;
}

// ============================================================================
// Progress Enhancement
// ============================================================================

/**
 * Create an enhanced progress bar with different styles
 */
export function createEnhancedProgressBar(
  percent: number,
  width: number = 30,
  style: 'blocks' | 'dashes' | 'dots' | 'braille' = 'blocks',
  color: string = '#7C3AED'
): { filled: string; empty: string; percent: number } {
  const filledWidth = Math.round((percent / 100) * width);
  const emptyWidth = width - filledWidth;

  const styleChars = {
    blocks: { filled: '█', empty: '░' },
    dashes: { filled: '━', empty: '─' },
    dots: { filled: '●', empty: '○' },
    braille: { filled: '⣿', empty: '⣿' }, // Simplified, real braille would be more complex
  };

  const chars = styleChars[style];

  return {
    filled: chars.filled.repeat(filledWidth),
    empty: chars.empty.repeat(emptyWidth),
    percent,
  };
}

// ============================================================================
// Animation Enhancement
// ============================================================================

/**
 * Get spinner frame for animation
 */
export function getSpinnerFrame(
  theme?: Theme,
  customFrame?: number
): { char: string; color: string; interval: number } {
  const t = theme || getTheme();
  const frame = customFrame || 0;
  
  const spinner = t.animations.spinner;
  const char = spinner.frames[frame % spinner.frames.length];

  return {
    char,
    color: t.colors.brand,
    interval: spinner.interval,
  };
}

/**
 * Check if pulse animation should be active
 */
export function shouldPulse(theme?: Theme): boolean {
  const t = theme || getTheme();
  return t.animations.pulse.enabled;
}

// ============================================================================
// Color Utility Functions
// ============================================================================

/**
 * Get color for a given level (for progress, status, etc.)
 */
export function getColorForLevel(
  level: number,
  theme?: Theme
): string {
  const t = theme || getTheme();
  
  if (level >= 80) return t.colors.error;
  if (level >= 60) return t.colors.warning;
  if (level >= 40) return t.colors.info;
  return t.colors.success;
}

/**
 * Get contrasting text color for a background
 */
export function getContrastColor(
  backgroundColor: string,
  theme?: Theme
): string {
  const t = theme || getTheme();
  
  // Simple heuristic: light backgrounds get dark text, dark backgrounds get light text
  // In practice, this would need better color analysis
  const lightColors = [
    t.colors.bgPrimary,
    t.colors.bgSecondary,
    t.colors.bgTertiary,
  ];

  if (lightColors.includes(backgroundColor)) {
    return t.colors.primary;
  }
  return t.colors.secondary;
}

// ============================================================================
// Decorative Elements
// ============================================================================

/**
 * Create a decorative header
 */
export function createDecorativeHeader(
  title: string,
  subtitle?: string,
  theme?: Theme
): { title: string; subtitle?: string; separator: string } {
  const t = theme || getTheme();
  
  return {
    title: `${t.styles.decorations.chevron} ${title}`,
    subtitle: subtitle ? `${t.styles.decorations.bullet} ${subtitle}` : undefined,
    separator: t.styles.decorations.divider.repeat(40),
  };
}

/**
 * Create a decorative footer
 */
export function createDecorativeFooter(
  text: string,
  theme?: Theme
): string {
  const t = theme || getTheme();
  return `${t.styles.decorations.separator} ${text}`;
}