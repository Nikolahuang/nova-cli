// ============================================================================
// Theme System - Main export
// Provides enhanced visual aesthetics while maintaining all functionality
// ============================================================================

export { Theme, themes, defaultTheme, getTheme, getGradientColors, supportsColor } from './theme-config.js';
export {
  getBorderCharacters,
  createSeparator,
  getEnhancedIcon,
  getDecorativePrefix,
  createBadge,
  createStatusIndicator,
  getSpacing,
  createPaddedBlock,
  createEnhancedProgressBar,
  getSpinnerFrame,
  shouldPulse,
  getColorForLevel,
  getContrastColor,
  createDecorativeHeader,
  createDecorativeFooter,
} from './style-utils.js';

// Re-export types for convenience
export type { ThemeColors, ThemeStyles, ThemeAnimations, StyleOptions, BorderStyle, HighlightStyle } from './theme-config.js';
export type { StyleOptions as StyleOptionsType, BorderStyle as BorderStyleType, HighlightStyle as HighlightStyleType } from './style-utils.js';

// ============================================================================
// Theme Configuration Options
// ============================================================================

export interface ThemeConfig {
  /**
   * Current theme ID
   * @default 'dark'
   */
  theme: string;
  
  /**
   * Enable/disable animations
   * @default true
   */
  animations: boolean;
  
  /**
   * Enable/disable enhanced borders
   * @default true
   */
  enhancedBorders: boolean;
  
  /**
   * Enable/disable enhanced icons
   * @default true
   */
  enhancedIcons: boolean;
  
  /**
   * Enable/disable enhanced spacing
   * @default true
   */
  enhancedSpacing: boolean;
}

/**
 * Default theme configuration
 */
export const defaultThemeConfig: ThemeConfig = {
  theme: 'dark',
  animations: true,
  enhancedBorders: true,
  enhancedIcons: true,
  enhancedSpacing: true,
};

/**
 * Get theme configuration from environment or use default
 */
export function getThemeConfig(): ThemeConfig {
  // Check for environment variable
  const envTheme = process.env.NOVA_THEME;
  const envAnimations = process.env.NOVA_ANIMATIONS;
  
  return {
    theme: envTheme || defaultThemeConfig.theme,
    animations: envAnimations !== 'false',
    enhancedBorders: defaultThemeConfig.enhancedBorders,
    enhancedIcons: defaultThemeConfig.enhancedIcons,
    enhancedSpacing: defaultThemeConfig.enhancedSpacing,
  };
}

/**
 * Apply theme configuration to the application
 * This is a placeholder for future theme persistence
 */
export function applyThemeConfig(config: Partial<ThemeConfig>): void {
  // In a future implementation, this would:
  // 1. Save configuration to a file
  // 2. Notify components to re-render with new theme
  // 3. Provide feedback to the user
  
  console.log(`Theme configuration updated:`, config);
}

/**
 * Get available theme names
 */
export function getAvailableThemes(): string[] {
  return Object.keys({ dark: 'Dark', light: 'Light' });
}

/**
 * Get theme description
 */
export function getThemeDescription(themeId: string): string {
  const descriptions: Record<string, string> = {
    dark: 'Dark theme with purple accents, inspired by Claude Code',
    light: 'Light theme with modern colors, inspired by modern UI design',
  };
  return descriptions[themeId] || 'Unknown theme';
}