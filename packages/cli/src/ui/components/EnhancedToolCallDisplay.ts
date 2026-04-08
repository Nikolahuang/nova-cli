// ============================================================================
// Enhanced Tool Call Display - Modern tool execution visualization
// Inspired by Claude Code's clean, informative tool call presentations
// ============================================================================

import chalk from 'chalk';
import { createEnhancedBorder } from '../themes/claude-code-enhancements.js';

// ============================================================================
// Types
// ============================================================================

export interface ToolExecutionInfo {
  id: string;
  name: string;
  input?: Record<string, any>;
  output?: any;
  error?: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'pending' | 'running' | 'success' | 'error' | 'cancelled';
}

export interface EnhancedToolDisplayOptions {
  showInput?: boolean;
  showOutput?: boolean;
  showDuration?: boolean;
  maxInputLength?: number;
  maxOutputLength?: number;
  compact?: boolean;
  theme?: any;
}

// ============================================================================
// Enhanced Tool Call Renderer
// ============================================================================

export class EnhancedToolCallDisplay {
  private options: Required<EnhancedToolDisplayOptions>;

  constructor(options: EnhancedToolDisplayOptions = {}) {
    this.options = {
      showInput: options.showInput ?? true,
      showOutput: options.showOutput ?? true,
      showDuration: options.showDuration ?? true,
      maxInputLength: options.maxInputLength ?? 100,
      maxOutputLength: options.maxOutputLength ?? 200,
      compact: options.compact ?? false,
      theme: options.theme,
    };
  }

  // ========================================================================
  // Public API
  // ========================================================================

  /**
   * Display a running tool call with animated status
   */
  displayRunning(tool: ToolExecutionInfo): void {
    const theme = this.options.theme || { colors: { brand: '#7C3AED', warning: '#F59E0B' } };

    if (this.options.compact) {
      process.stdout.write(
        chalk.hex(theme.colors.brand).bold(`⚡ ${tool.name}`) +
        chalk.gray.dim(' [running...]') + '\r'
      );
    } else {
      console.log('');
      console.log(chalk.hex(theme.colors.warning).bold('🔄 Executing Tool'));
      this.renderToolDetails(tool, 'running');
    }
  }

  /**
   * Display a completed tool call
   */
  displayCompleted(tool: ToolExecutionInfo): void {
    const theme = this.options.theme || { colors: { success: '#10B981', error: '#EF4444' } };

    console.log('');
    const statusIcon = tool.status === 'success' ? '✅' : '❌';
    const statusColor = tool.status === 'success' ? 'success' : 'error';
    const statusText = tool.status === 'success' ? 'Success' : 'Failed';

    console.log(chalk.hex(theme.colors[statusColor]).bold(`${statusIcon} ${tool.name} - ${statusText}`));

    if (this.options.showDuration && tool.duration) {
      const durationStr = tool.duration < 1000 ? `${tool.duration}ms` : `${(tool.duration / 1000).toFixed(1)}s`;
      console.log(chalk.gray.dim(`⏱ Duration: ${durationStr}`));
    }

    if (tool.error) {
      console.log('');
      console.log(chalk.hex(theme.colors.error).dim('Error Details:'));
      console.log(chalk.red.dim(`  ${tool.error}`));
    }

    if (tool.output && this.options.showOutput && !tool.error) {
      console.log('');
      console.log(chalk.gray.dim('Output Preview:'));
      const outputStr = typeof tool.output === 'string' ? tool.output : JSON.stringify(tool.output);
      const preview = outputStr.slice(0, this.options.maxOutputLength!);
      console.log(chalk.gray.dim(`  ${preview}${outputStr.length > this.options.maxOutputLength! ? '...' : ''}`));
    }

    console.log('');
  }

  /**
   * Display multiple concurrent tool executions
   */
  displayConcurrentTools(tools: Map<string, ToolExecutionInfo>): void {
    if (tools.size === 0) return;

    const theme = this.options.theme || { colors: { brand: '#7C3AED' } };

    console.log('');
    console.log(chalk.hex(theme.colors.brand).bold(`🚀 Concurrent Tool Execution (${tools.size})`));
    console.log(chalk.gray.dim('─'.repeat(50)));

    tools.forEach((tool, id) => {
      if (tool.status === 'running') {
        const elapsed = Date.now() - tool.startTime;
        const elapsedStr = elapsed < 1000 ? `${elapsed}ms` : `${(elapsed / 1000).toFixed(1)}s`;

        let line = chalk.hex(theme.colors.brand).bold(`  ${tool.name}`);
        line += chalk.gray.dim(` (${elapsedStr})`);

        if (this.options.showInput && tool.input) {
          const inputPreview = this.summarizeInput(tool.name, tool.input);
          line += chalk.gray.dim(` - ${inputPreview}`);
        }

        process.stdout.write(line + '\n');
      }
    });
  }

  /**
   * Clear running tool displays
   */
  clearRunning(): void {
    process.stdout.write('\r' + ' '.repeat(80) + '\r');
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  /**
   * Render detailed tool information
   */
  private renderToolDetails(tool: ToolExecutionInfo, state: 'running' | 'completed'): void {
    const theme = this.options.theme || { colors: { border: '#4B5563', dim: '#6B7280' } };

    const border = createEnhancedBorder(60, 'modern', theme);
    const contentWidth = 56; // Account for border characters

    // Header
    console.log(border.top);
    console.log(
      border.sides +
      chalk.hex(theme.colors.brand).bold(' Tool: ') +
      tool.name +
      ' '.repeat(Math.max(0, contentWidth - 10 - tool.name.length)) +
      border.sides
    );

    // Input section
    if (this.options.showInput && tool.input) {
      console.log(
        border.sides +
        chalk.hex(theme.colors.info).dim(' Input:') +
        ' '.repeat(Math.max(0, contentWidth - 9)) +
        border.sides
      );

      const inputLines = this.formatJsonInput(tool.input);
      inputLines.forEach(line => {
        console.log(border.sides + chalk.gray.dim('  ') + line);
      });
    }

    // Status/Output section
    if (state === 'completed') {
      if (tool.error) {
        console.log(
          border.sides +
          chalk.hex(theme.colors.error).dim(' Error:') +
          ' '.repeat(Math.max(0, contentWidth - 10)) +
          border.sides
        );
        console.log(border.sides + chalk.red.dim('  ') + tool.error);
      } else if (tool.output && this.options.showOutput) {
        console.log(
          border.sides +
          chalk.hex(theme.colors.success).dim(' Output:') +
          ' '.repeat(Math.max(0, contentWidth - 11)) +
          border.sides
        );

        const outputStr = typeof tool.output === 'string' ? tool.output : JSON.stringify(tool.output);
        const lines = outputStr.split('\n').slice(0, 10); // Limit to 10 lines

        lines.forEach(line => {
          const truncated = line.slice(0, contentWidth - 4);
          console.log(border.sides + chalk.gray.dim('  ') + truncated);
        });

        if (lines.length >= 10) {
          console.log(border.sides + chalk.gray.dim('  ... and more output'));
        }
      }
    }

    console.log(border.bottom);
  }

  /**
   * Format JSON input for display
   */
  private formatJsonInput(input: Record<string, any>): string[] {
    try {
      const formatted = JSON.stringify(input, null, 2);
      return formatted.split('\n').map(line => line.slice(0, 50)); // Limit line length
    } catch {
      return [String(input)];
    }
  }

  /**
   * Summarize tool input for compact display
   */
  private summarizeInput(name: string, input: Record<string, any>): string {
    switch (name) {
      case 'read_file':
      case 'list_directory':
        return String(input.file_path || input.path || '').split('/').slice(-2).join('/');

      case 'write_file':
        return String(input.file_path || '').split('/').slice(-2).join('/') + ' (write)';

      case 'edit_file':
      case 'replace':
        return String(input.file_path || '').split('/').slice(-2).join('/') + ' (edit)';

      case 'execute_command':
        return String(input.command || '').slice(0, 30);

      case 'search_content':
      case 'search_file':
        return String(input.query || input.pattern || '').slice(0, 30);

      case 'web_search':
      case 'web_fetch':
        return String(input.query || input.url || '').slice(0, 30);

      default:
        const values = Object.values(input)
          .filter((v): v is string => typeof v === 'string' && v.length > 0);
        return values.length > 0 ? values[0].slice(0, 30) : '';
    }
  }

  /**
   * Calculate execution duration
   */
  private calculateDuration(start: number, end?: number): number {
    const endTime = end || Date.now();
    return endTime - start;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createEnhancedToolCallDisplay(options?: EnhancedToolDisplayOptions): EnhancedToolCallDisplay {
  return new EnhancedToolCallDisplay(options);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a simple tool call indicator for inline display
 */
export function createSimpleToolIndicator(
  name: string,
  status: 'running' | 'success' | 'error',
  theme?: any
): string {
  const t = theme || { colors: { brand: '#7C3AED', success: '#10B981', error: '#EF4444' } };

  const icons = {
    running: '⏳',
    success: '✅',
    error: '❌',
  };

  const colors = {
    running: 'yellow',
    success: 'success',
    error: 'error',
  };

  return chalk[colors[status]].bold(`${icons[status]} ${name}`);
}

/**
 * Format tool execution statistics
 */
export function formatToolStats(tools: ToolExecutionInfo[]): string {
  const total = tools.length;
  const successful = tools.filter(t => t.status === 'success').length;
  const failed = tools.filter(t => t.status === 'error').length;
  const avgDuration = tools.reduce((sum, t) => sum + (t.duration || 0), 0) / total;

  return `Tools: ${total} total, ${successful} successful, ${failed} failed, Avg: ${avgDuration.toFixed(0)}ms`;
}