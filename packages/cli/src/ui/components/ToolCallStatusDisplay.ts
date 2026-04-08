// ============================================================================
// ToolCallStatusDisplay - Display tool call status with detailed info
// Shows execution status, duration, and error messages for debugging
// ============================================================================

import chalk from 'chalk';

// ============================================================================
// Types
// ============================================================================

export interface ToolCallInfo {
  id: string;
  name: string;
  input?: Record<string, unknown>;
  status: 'pending' | 'running' | 'success' | 'error';
  startTime: number;
  endTime?: number;
  result?: string;
  error?: string;
}

export interface ToolStatusOptions {
  /** Maximum width for display */
  maxWidth?: number;
  /** Show input preview */
  showInput?: boolean;
  /** Show result preview on success */
  showResult?: boolean;
  /** Maximum error message length */
  maxErrorLength?: number;
}

// ============================================================================
// Color palette
// ============================================================================

const C = {
  brand: chalk.hex('#7C3AED'),
  success: chalk.hex('#10B981'),
  successDim: chalk.hex('#10B981').dim,
  warning: chalk.hex('#F59E0B'),
  warningDim: chalk.hex('#F59E0B').dim,
  error: chalk.hex('#EF4444'),
  errorDim: chalk.hex('#EF4444').dim,
  info: chalk.hex('#3B82F6'),
  infoDim: chalk.hex('#3B82F6').dim,
  cyan: chalk.hex('#06B6D4'),
  cyanDim: chalk.hex('#06B6D4').dim,
  muted: chalk.gray,
  dim: chalk.hex('#6B7280'),
  primary: chalk.white,
};

// ============================================================================
// Box drawing characters
// ============================================================================

const BOX = {
  h: '─', v: '│',
  tl: '╭', tr: '╮', bl: '╰', br: '╯',
  ht: '├', htr: '┤',
  check: '✓', cross: '✗', dot: '·',
  arrow: '→', spinner: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
};

// ============================================================================
// ToolCallStatusDisplay class
// ============================================================================

/**
 * Displays tool call status with detailed information.
 * 
 * Features:
 * - Compact one-line display for each tool call
 * - Status indicators (pending, running, success, error)
 * - Duration display
 * - Error message preview for failed calls
 * - Result preview for successful calls
 */
export class ToolCallStatusDisplay {
  private options: Required<ToolStatusOptions>;
  private activeCalls: Map<string, ToolCallInfo> = new Map();
  private callOrder: string[] = [];
  private spinnerFrame = 0;
  private spinnerTimer: NodeJS.Timeout | null = null;

  constructor(options: ToolStatusOptions = {}) {
    this.options = {
      maxWidth: options.maxWidth ?? (process.stdout.columns || 80) - 4,
      showInput: options.showInput ?? true,
      showResult: options.showResult ?? true, // Enhanced default to show results
      maxErrorLength: options.maxErrorLength ?? 150, // Increased for better error visibility
      showDuration: options.showDuration ?? true, // New option for duration display
      enhancedVisuals: options.enhancedVisuals ?? true, // New option for enhanced styling
    };
  }

  // ========================================================================
  // Public API
  // ========================================================================

  /**
   * Start a new tool call
   */
  startCall(id: string, name: string, input?: Record<string, unknown>): void {
    const info: ToolCallInfo = {
      id,
      name,
      input,
      status: 'running',
      startTime: Date.now(),
    };
    this.activeCalls.set(id, info);
    this.callOrder.push(id);
    this.renderRunning(id);
  }

  /**
   * Complete a tool call with success
   */
  completeSuccess(id: string, result?: string): void {
    const info = this.activeCalls.get(id);
    if (info) {
      info.status = 'success';
      info.endTime = Date.now();
      info.result = result;
      this.renderComplete(info);
    }
  }

  /**
   * Complete a tool call with error
   */
  completeError(id: string, error: string): void {
    const info = this.activeCalls.get(id);
    if (info) {
      info.status = 'error';
      info.endTime = Date.now();
      info.error = error;
      this.renderComplete(info);
    }
  }

  /**
   * Clear all calls
   */
  clear(): void {
    this.activeCalls.clear();
    this.callOrder = [];
  }

  /**
   * Get summary stats
   */
  getStats(): { total: number; success: number; error: number; running: number } {
    const calls = Array.from(this.activeCalls.values());
    return {
      total: calls.length,
      success: calls.filter(c => c.status === 'success').length,
      error: calls.filter(c => c.status === 'error').length,
      running: calls.filter(c => c.status === 'running').length,
    };
  }

  // ========================================================================
  // Internal rendering
  // ========================================================================

  /**
   * Render a running tool call
   */
  private renderRunning(id: string): void {
    const info = this.activeCalls.get(id);
    if (!info) return;

    const idx = this.callOrder.indexOf(id) + 1;
    const inputPreview = this.options.showInput && info.input 
      ? ' ' + C.dim(this.summarizeInput(info.name, info.input))
      : '';

    // Show compact tool start
    process.stdout.write(
      '\n' +
      C.cyan('  ⚡ ') +
      C.primary(info.name) +
      C.dim(` #${idx.toString().padStart(2, '0')}`) +
      inputPreview +
      ' '
    );

    // Start inline spinner
    this.startSpinner(id);
  }

  /**
   * Start spinner animation for a running tool
   */
  private startSpinner(id: string): void {
    this.stopSpinner();
    const info = this.activeCalls.get(id);
    if (!info) return;

    this.spinnerFrame = 0;
    this.spinnerTimer = setInterval(() => {
      const elapsed = ((Date.now() - info.startTime) / 1000).toFixed(1);
      const frame = BOX.spinner[this.spinnerFrame % BOX.spinner.length];
      process.stdout.write(`\r${C.warning(frame)} ${C.dim(elapsed + 's')}`);
      this.spinnerFrame++;
    }, 80);
  }

  /**
   * Stop spinner
   */
  private stopSpinner(): void {
    if (this.spinnerTimer) {
      clearInterval(this.spinnerTimer);
      this.spinnerTimer = null;
    }
  }

  /**
   * Render a completed tool call with enhanced visuals
   */
  private renderComplete(info: ToolCallInfo): void {
    this.stopSpinner();

    const duration = info.endTime && info.startTime 
      ? info.endTime - info.startTime 
      : 0;
    const durationStr = duration < 1000 ? `${duration}ms` : `${(duration / 1000).toFixed(1)}s`;
    const idx = this.callOrder.indexOf(info.id) + 1;

    // Clear the line and rewrite
    process.stdout.write('\r' + ' '.repeat(this.options.maxWidth) + '\r');

    const icon = info.status === 'success' ? C.success(BOX.check) : C.error(BOX.cross);
    const statusColor = info.status === 'success' ? 'success' : 'error';
    const durationColor = info.status === 'success' ? C.successDim : C.errorDim;

    // Enhanced main line with better spacing and visual hierarchy
    console.log(
      '  ' + icon + ' ' +
      (info.status === 'success' ? C.cyan(info.name) : C.error(info.name)) +
      C.dim(` #${idx.toString().padStart(2, '0')}`) +
      (this.options.showDuration ? ' ' + durationColor(`(${durationStr})`) : '') +
      (this.options.enhancedVisuals ? ' ' + C.dim('✓') : '')
    );

    // Show error details if failed
    if (info.status === 'error' && info.error) {
      this.renderErrorDetail(info.error);
    }

    // Show result preview if enabled and successful
    if (info.status === 'success' && this.options.showResult && info.result) {
      const preview = info.result.slice(0, 80).replace(/\n/g, ' ');
      console.log(C.dim(`     └─ ${preview}${info.result.length > 80 ? '...' : ''}`));

      // Add success indicator for enhanced visuals
      if (this.options.enhancedVisuals) {
        console.log(C.successDim('     ↑ Success!'));
      }
    }
  }

  /**
   * Render error detail with helpful formatting
   */
  private renderErrorDetail(error: string): void {
    const truncated = error.length > this.options.maxErrorLength 
      ? error.slice(0, this.options.maxErrorLength) + '...'
      : error;
    
    // Split error into lines and show with indent
    const lines = truncated.split('\n').slice(0, 3);
    for (const line of lines) {
      console.log(C.errorDim(`     └─ ${line}`));
    }
  }

  /**
   * Summarize tool input for display
   */
  private summarizeInput(name: string, input: Record<string, unknown>): string {
    switch (name) {
      case 'read_file':
      case 'list_directory':
        return String(input.file_path || input.path || '').split('/').slice(-2).join('/');
      case 'write_file':
        return String(input.file_path || '').split('/').slice(-2).join('/') + ' (write)';
      case 'replace':
      case 'edit_file':
        return String(input.file_path || '').split('/').slice(-2).join('/') + ' (edit)';
      case 'execute_command':
        return String(input.command || '').slice(0, 40);
      case 'search_file':
        return String(input.pattern || '') + ' in ' + String(input.path || '.').split('/').pop();
      case 'web_search':
      case 'web_fetch':
        return String(input.query || input.url || '').slice(0, 40);
      default:
        const vals = Object.values(input).filter((v): v is string => typeof v === 'string' && v.length > 0);
        return vals.length > 0 ? vals[0].slice(0, 30) : '';
    }
  }
}

// ============================================================================
// Factory function
// ============================================================================

export function createToolCallStatusDisplay(options?: ToolStatusOptions): ToolCallStatusDisplay {
  return new ToolCallStatusDisplay(options);
}
