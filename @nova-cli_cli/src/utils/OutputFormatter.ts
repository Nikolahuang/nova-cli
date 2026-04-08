// ============================================================================
// Output Formatter - Structured output for Agent consumption
// ============================================================================

/**
 * Output format mode
 */
export type OutputFormat = 'text' | 'json';

/**
 * Global output configuration
 */
export interface OutputConfig {
  format: OutputFormat;
  noColor: boolean;
  compact: boolean;
}

/**
 * Global output formatter instance
 */
let globalConfig: OutputConfig = {
  format: 'text',
  noColor: false,
  compact: false,
};

/**
 * Initialize output formatter with CLI args
 */
export function initOutputFormatter(config: Partial<OutputConfig>): void {
  globalConfig = { ...globalConfig, ...config };
}

/**
 * Get current output config
 */
export function getOutputConfig(): OutputConfig {
  return { ...globalConfig };
}

/**
 * Check if JSON mode is enabled
 */
export function isJsonMode(): boolean {
  return globalConfig.format === 'json';
}

/**
 * Check if colors should be disabled
 */
export function shouldDisableColors(): boolean {
  return globalConfig.noColor || isJsonMode() || !process.stdout.isTTY;
}

/**
 * Format a single item for output
 */
export function formatOutput<T>(data: T): string {
  if (isJsonMode()) {
    return JSON.stringify(data, null, globalConfig.compact ? 0 : 2);
  }
  return String(data);
}

/**
 * Format a list of items for output
 */
export function formatList<T>(
  items: T[],
  formatter: (item: T) => Record<string, unknown>
): string {
  if (isJsonMode()) {
    return JSON.stringify(items.map(formatter), null, globalConfig.compact ? 0 : 2);
  }
  return items.map(item => formatOutput(formatter(item))).join('\n');
}

/**
 * Format an error for output
 */
export function formatError(error: {
  type: string;
  message: string;
  code?: string;
  suggestions?: Array<{ description: string; command?: string }>;
  context?: string;
}): string {
  if (isJsonMode()) {
    return JSON.stringify({
      error: true,
      type: error.type,
      code: error.code,
      message: error.message,
      context: error.context,
      suggestions: error.suggestions,
    }, null, globalConfig.compact ? 0 : 2);
  }
  
  // Text format
  const lines: string[] = [];
  lines.push(`\x1b[31m╭──────────────────────────────────────────────────────────────────╮\x1b[0m`);
  lines.push(`\x1b[31m│\x1b[0m  Error: ${error.message.slice(0, 55).padEnd(55)}\x1b[31m│\x1b[0m`);
  if (error.context) {
    lines.push(`\x1b[31m│\x1b[0m  Context: ${error.context.slice(0, 52).padEnd(52)}\x1b[31m│\x1b[0m`);
  }
  lines.push(`\x1b[31m╰──────────────────────────────────────────────────────────────────╯\x1b[0m`);
  
  if (error.suggestions && error.suggestions.length > 0) {
    lines.push('');
    lines.push('  Suggestions:');
    error.suggestions.forEach(s => {
      if (s.command) {
        lines.push(`    \x1b[32m✓\x1b[0m ${s.command}`);
        lines.push(`      ${s.description}`);
      } else {
        lines.push(`    �?${s.description}`);
      }
    });
  }
  
  return lines.join('\n');
}

/**
 * Format a success result for output
 */
export function formatSuccess(data: {
  message: string;
  details?: Record<string, unknown>;
}): string {
  if (isJsonMode()) {
    return JSON.stringify({
      success: true,
      message: data.message,
      details: data.details,
    }, null, globalConfig.compact ? 0 : 2);
  }
  
  const lines: string[] = [];
  lines.push(`\x1b[32m  �?${data.message}\x1b[0m`);
  if (data.details) {
    Object.entries(data.details).forEach(([key, value]) => {
      lines.push(`    ${key}: ${value}`);
    });
  }
  return lines.join('\n');
}

/**
 * Format a list result with truncation hint
 */
export function formatListWithTruncation<T>(
  items: T[],
  total: number,
  formatter: (item: T) => Record<string, unknown>,
  hint?: string
): string {
  const showing = items.length;
  const hasMore = showing < total;
  
  if (isJsonMode()) {
    return JSON.stringify({
      items: items.map(formatter),
      pagination: {
        showing,
        total,
        hasMore,
        hint: hasMore ? hint : undefined,
      },
    }, null, globalConfig.compact ? 0 : 2);
  }
  
  const lines: string[] = items.map(item => formatOutput(formatter(item)));
  
  if (hasMore) {
    lines.push('');
    lines.push(`  Showing ${showing} of ${total} items.`);
    if (hint) {
      lines.push(`  Hint: ${hint}`);
    }
  }
  
  return lines.join('\n');
}

/**
 * Strip ANSI codes from string (for JSON mode)
 */
export function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}