// ============================================================================
// Theme Configuration - Enhanced design system inspired by Claude Code
// Maintains all existing functionality while improving visual aesthetics
// ============================================================================

export interface Theme {
  name: string;
  id: string;
  colors: ThemeColors;
  styles: ThemeStyles;
  animations: ThemeAnimations;
}

export interface ThemeColors {
  // Brand colors (Nova Purple)
  brand: string;
  brandLight: string;
  brandDark: string;
  brandAccent: string;

  // Semantic colors
  success: string;
  successLight: string;
  warning: string;
  warningLight: string;
  error: string;
  errorLight: string;
  info: string;
  infoLight: string;

  // Text colors
  primary: string;
  secondary: string;
  muted: string;
  dim: string;
  hint: string;

  // Accent colors (for visual variety)
  cyan: string;
  cyanLight: string;
  pink: string;
  pinkLight: string;
  orange: string;
  orangeLight: string;
  lime: string;
  limeLight: string;
  violet: string;
  violetLight: string;

  // Background colors
  bgPrimary: string;
  bgSecondary: string;
  bgTertiary: string;
  bgHighlight: string;

  // Border colors
  border: string;
  borderLight: string;
  borderDim: string;
}

export interface ThemeStyles {
  // Border styles
  borderStyle: 'single' | 'double' | 'round' | 'bold' | 'dashed';
  borderWidth: number;

  // Spacing
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };

  // Typography
  font: {
    weight: 'normal' | 'bold';
    family: 'default' | 'monospace';
  };

  // Icons
  icons: {
    success: string;
    warning: string;
    error: string;
    info: string;
    loading: string[];
    thinking: string;
    tool: string;
    file: string;
    folder: string;
    search: string;
    settings: string;
  };

  // Decorations
  decorations: {
    separator: string;
    divider: string;
    bullet: string;
    arrow: string;
    chevron: string;
  };
}

export interface ThemeAnimations {
  spinner: {
    frames: string[];
    interval: number;
  };
  pulse: {
    enabled: boolean;
    interval: number;
  };
  progress: {
    style: 'blocks' | 'dashes' | 'dots';
  };
}

// ============================================================================
// Dark Theme (Default - inspired by Claude Code dark mode)
// ============================================================================

export const darkTheme: Theme = {
  name: 'Dark',
  id: 'dark',
  colors: {
    // Brand colors - Purple with gradient support
    brand: '#7C3AED',
    brandLight: '#A78BFA',
    brandDark: '#5B21B6',
    brandAccent: '#8B5CF6',

    // Semantic colors with light variants for gradients
    success: '#10B981',
    successLight: '#34D399',
    warning: '#F59E0B',
    warningLight: '#FBBF24',
    error: '#EF4444',
    errorLight: '#F87171',
    info: '#3B82F6',
    infoLight: '#60A5FA',

    // Text colors - better contrast
    primary: '#F9FAFB',
    secondary: '#E5E7EB',
    muted: '#9CA3AF',
    dim: '#6B7280',
    hint: '#4B5563',

    // Accent colors - for visual variety
    cyan: '#06B6D4',
    cyanLight: '#22D3EE',
    pink: '#EC4899',
    pinkLight: '#F472B6',
    orange: '#F97316',
    orangeLight: '#FB923C',
    lime: '#84CC16',
    limeLight: '#A3E635',
    violet: '#8B5CF6',
    violetLight: '#A78BFA',

    // Background colors - layered depth
    bgPrimary: '#1F2937',
    bgSecondary: '#111827',
    bgTertiary: '#0F172A',
    bgHighlight: '#374151',

    // Border colors - subtle distinction
    border: '#4B5563',
    borderLight: '#6B7280',
    borderDim: '#374151',
  },
  styles: {
    borderStyle: 'round',
    borderWidth: 1,
    spacing: {
      xs: 0,
      sm: 1,
      md: 2,
      lg: 3,
      xl: 4,
    },
    font: {
      weight: 'normal',
      family: 'default',
    },
    icons: {
      success: '✓',
      warning: '⚠',
      error: '✗',
      info: 'ℹ',
      loading: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
      thinking: '💭',
      tool: '⚡',
      file: '📄',
      folder: '📁',
      search: '🔍',
      settings: '⚙',
    },
    decorations: {
      separator: '│',
      divider: '─',
      bullet: '•',
      arrow: '→',
      chevron: '›',
    },
  },
  animations: {
    spinner: {
      frames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
      interval: 80,
    },
    pulse: {
      enabled: true,
      interval: 150,
    },
    progress: {
      style: 'blocks',
    },
  },
};

// ============================================================================
// Light Theme (Alternative - inspired by modern light mode designs)
// ============================================================================

export const lightTheme: Theme = {
  name: 'Light',
  id: 'light',
  colors: {
    // Brand colors - adjusted for light background
    brand: '#6366F1',
    brandLight: '#818CF8',
    brandDark: '#4F46E5',
    brandAccent: '#6366F1',

    // Semantic colors
    success: '#059669',
    successLight: '#10B981',
    warning: '#D97706',
    warningLight: '#F59E0B',
    error: '#DC2626',
    errorLight: '#EF4444',
    info: '#2563EB',
    infoLight: '#3B82F6',

    // Text colors - better contrast on light background
    primary: '#111827',
    secondary: '#374151',
    muted: '#6B7280',
    dim: '#9CA3AF',
    hint: '#D1D5DB',

    // Accent colors
    cyan: '#0891B2',
    cyanLight: '#06B6D4',
    pink: '#DB2777',
    pinkLight: '#EC4899',
    orange: '#EA580C',
    orangeLight: '#F97316',
    lime: '#65A30D',
    limeLight: '#84CC16',
    violet: '#7C3AED',
    violetLight: '#8B5CF6',

    // Background colors - light layered depth
    bgPrimary: '#FFFFFF',
    bgSecondary: '#F9FAFB',
    bgTertiary: '#F3F4F6',
    bgHighlight: '#E5E7EB',

    // Border colors
    border: '#D1D5DB',
    borderLight: '#9CA3AF',
    borderDim: '#E5E7EB',
  },
  styles: {
    borderStyle: 'round',
    borderWidth: 1,
    spacing: {
      xs: 0,
      sm: 1,
      md: 2,
      lg: 3,
      xl: 4,
    },
    font: {
      weight: 'normal',
      family: 'default',
    },
    icons: {
      success: '✓',
      warning: '⚠',
      error: '✗',
      info: 'ℹ',
      loading: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
      thinking: '💭',
      tool: '⚡',
      file: '📄',
      folder: '📁',
      search: '🔍',
      settings: '⚙',
    },
    decorations: {
      separator: '│',
      divider: '─',
      bullet: '•',
      arrow: '→',
      chevron: '›',
    },
  },
  animations: {
    spinner: {
      frames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
      interval: 80,
    },
    pulse: {
      enabled: true,
      interval: 150,
    },
    progress: {
      style: 'blocks',
    },
  },
};

// ============================================================================
// Theme Registry
// ============================================================================

export const themes: Record<string, Theme> = {
  dark: darkTheme,
  light: lightTheme,
};

// Default theme (can be changed via configuration)
export const defaultTheme = darkTheme;

// ============================================================================
// Theme Utility Functions
// ============================================================================

/**
 * Get theme by ID, fallback to default
 */
export function getTheme(themeId?: string): Theme {
  if (themeId && themes[themeId]) {
    return themes[themeId];
  }
  return defaultTheme;
}

/**
 * Get gradient effect between two colors
 * (simplified - in practice would require terminal color capability detection)
 */
export function getGradientColors(color1: string, color2: string, steps: number = 5): string[] {
  // Return array with color1 and color2 at ends
  // In a real implementation, this would interpolate colors
  return Array(steps).fill(color1).map((_, i) => {
    if (i === steps - 1) return color2;
    return color1;
  });
}

/**
 * Check if terminal supports color
 */
export function supportsColor(): boolean {
  return (
    process.env.COLORTERM !== undefined ||
    process.env.TERM?.includes('color') ||
    process.env.TERM === 'xterm-256color'
  );
}