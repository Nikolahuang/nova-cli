// ============================================================================
// TodoProgressPanel - Fixed-position TODO progress display panel
// Shows a compact table of tasks with dynamic updates at a fixed screen location
// ============================================================================

import chalk from 'chalk';

// ============================================================================
// Types
// ============================================================================

export interface TodoItem {
  id: string;
  task: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  priority?: 'high' | 'medium' | 'low';
}

export interface TodoProgressOptions {
  /** Maximum width of the panel (default: terminal width - 4) */
  maxWidth?: number;
  /** Show priority indicators (default: true) */
  showPriority?: boolean;
  /** Compact mode - single line per task (default: true) */
  compact?: boolean;
}

// ============================================================================
// ANSI helpers for terminal control
// ============================================================================

const ANSI = {
  saveCursor: (): string => '\x1b[s',
  restoreCursor: (): string => '\x1b[u',
  cursorUp: (n: number): string => `\x1b[${n}A`,
  cursorDown: (n: number): string => `\x1b[${n}B`,
  cursorLineStart: (): string => '\x1b[0G',
  clearDown: (): string => '\x1b[0J',
  clearLine: (): string => '\x1b[2K',
  hideCursor: (): string => '\x1b[?25l',
  showCursor: (): string => '\x1b[?25h',
};

// ============================================================================
// Color palette
// ============================================================================

const C = {
  brand: chalk.hex('#7C3AED'),
  brandDim: chalk.hex('#7C3AED').dim,
  success: chalk.hex('#10B981'),
  successDim: chalk.hex('#10B981').dim,
  warning: chalk.hex('#F59E0B'),
  warningDim: chalk.hex('#F59E0B').dim,
  error: chalk.hex('#EF4444'),
  errorDim: chalk.hex('#EF4444').dim,
  info: chalk.hex('#3B82F6'),
  infoDim: chalk.hex('#3B82F6').dim,
  primary: chalk.white,
  muted: chalk.gray,
  dim: chalk.hex('#6B7280'),
  accent: chalk.hex('#F472B6'),
};

// ============================================================================
// Box drawing characters
// ============================================================================

const BOX = {
  tl: 'â•?, tr: 'â•?, bl: 'â•?, br: 'â•?,
  h: 'â”€', v: 'â”?,
  ht: 'â”?, htr: 'â”?, cross: 'â”?,
  check: 'âœ?, crossX: 'âœ?, dot: 'Â·',
  diamond: 'â—?, star: 'â˜?, circle: 'â—?, circleFull: 'â—?,
  arrowRight: 'â†?, arrowDown: 'â†?,
  spinner: ['â ?, 'â ?, 'â ?, 'â ?, 'â ?, 'â ?, 'â ?, 'â ?, 'â ?, 'â ?],
};

// ============================================================================
// TodoProgressPanel class
// ============================================================================

/**
 * A fixed-position TODO progress panel that updates dynamically.
 * 
 * Features:
 * - Fixed position rendering (saves/restores cursor position)
 * - Compact table format with status indicators
 * - Progress bar showing completion percentage
 * - Dynamic updates without message stacking
 */
export class TodoProgressPanel {
  private options: Required<TodoProgressOptions>;
  private todos: TodoItem[] = [];
  private renderedLines = 0;
  private isActive = false;
  private savedCursorPosition = false;

  constructor(options: TodoProgressOptions = {}) {
    this.options = {
      maxWidth: options.maxWidth ?? (process.stdout.columns || 80) - 4,
      showPriority: options.showPriority ?? true,
      compact: options.compact ?? true,
    };
  }

  // ========================================================================
  // Public API
  // ========================================================================

  /**
   * Set the TODO list and render the panel
   */
  setTodos(todos: TodoItem[]): void {
    this.todos = todos;
    if (this.isActive) {
      this.render();
    }
  }

  /**
   * Update a single TODO item status
   */
  updateStatus(id: string, status: TodoItem['status']): void {
    const todo = this.todos.find(t => t.id === id);
    if (todo) {
      todo.status = status;
      if (this.isActive) {
        this.render();
      }
    }
  }

  /**
   * Show the TODO panel at current position (fixed location)
   */
  show(): void {
    if (this.isActive) return;
    this.isActive = true;
    this.render();
  }

  /**
   * Refresh the panel display
   */
  refresh(): void {
    if (this.isActive) {
      this.render();
    }
  }

  /**
   * Hide the panel and clear its display
   */
  hide(): void {
    if (!this.isActive) return;
    this.clear();
    this.isActive = false;
  }

  /**
   * Clear the panel from screen
   */
  clear(): void {
    if (this.renderedLines > 0) {
      this.clearLines(this.renderedLines);
      this.renderedLines = 0;
    }
  }

  /**
   * Get current progress stats
   */
  getStats(): { total: number; completed: number; inProgress: number; pending: number; failed: number } {
    return {
      total: this.todos.length,
      completed: this.todos.filter(t => t.status === 'completed').length,
      inProgress: this.todos.filter(t => t.status === 'in_progress').length,
      pending: this.todos.filter(t => t.status === 'pending').length,
      failed: this.todos.filter(t => t.status === 'failed').length,
    };
  }

  // ========================================================================
  // Internal rendering
  // ========================================================================

  /**
   * Render the TODO panel
   */
  private render(): void {
    const width = this.options.maxWidth;

    // Clear previous render
    if (this.renderedLines > 0) {
      this.clearLines(this.renderedLines);
    }

    const lines: string[] = [];
    const stats = this.getStats();

    // Header
    const progressPct = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
    const headerText = ` Tasks ${stats.completed}/${stats.total} `;
    const progressBar = this.renderMiniProgressBar(progressPct, 10);
    const headerLine = C.brandDim(BOX.v) + ' ' + C.brand('ðŸ“‹') + ' ' + C.primary(headerText) + progressBar + ' '.repeat(Math.max(0, width - headerText.length - 18)) + C.brandDim(BOX.v);
    lines.push(C.brand(BOX.tl) + C.brand(BOX.h.repeat(width)) + C.brand(BOX.tr));
    lines.push(headerLine);

    // Separator
    lines.push(C.brandDim(BOX.ht) + C.brandDim(BOX.h.repeat(width)) + C.brandDim(BOX.htr));

    // Task rows
    if (this.todos.length === 0) {
      lines.push(C.brandDim(BOX.v) + ' ' + C.muted('No tasks') + ' '.repeat(width - 10) + C.brandDim(BOX.v));
    } else {
      for (const todo of this.todos) {
        const taskLine = this.renderTaskLine(todo, width);
        lines.push(taskLine);
      }
    }

    // Footer with stats
    const statsText = this.renderStatsLine(stats, width);
    lines.push(C.brandDim(BOX.ht) + C.brandDim(BOX.h.repeat(width)) + C.brandDim(BOX.htr));
    lines.push(statsText);
    lines.push(C.brand(BOX.bl) + C.brand(BOX.h.repeat(width)) + C.brand(BOX.br));

    // Output all lines
    for (const line of lines) {
      process.stdout.write(line + '\n');
    }

    this.renderedLines = lines.length;
  }

  /**
   * Render a single task line
   */
  private renderTaskLine(todo: TodoItem, width: number): string {
    const statusIcons = {
      pending: C.dim(BOX.circle + ' '),
      in_progress: C.warning(C.brand('â—?')),
      completed: C.success(BOX.check + ' '),
      failed: C.error(BOX.crossX + ' '),
    };

    const priorityIndicators = {
      high: C.error('â—?),
      medium: C.warning('â—?),
      low: C.dim('â—?),
    };

    const icon = statusIcons[todo.status];
    const priority = this.options.showPriority && todo.priority ? priorityIndicators[todo.priority] + ' ' : '';
    
    // Truncate task text to fit
    const maxTaskLen = width - 10 - (priority ? 2 : 0);
    const taskText = todo.task.length > maxTaskLen ? todo.task.slice(0, maxTaskLen - 3) + '...' : todo.task;
    
    // Color based on status
    let coloredTask: string;
    switch (todo.status) {
      case 'completed':
        coloredTask = C.successDim(taskText);
        break;
      case 'in_progress':
        coloredTask = C.warning(taskText);
        break;
      case 'failed':
        coloredTask = C.error(taskText);
        break;
      default:
        coloredTask = C.muted(taskText);
    }

    const content = icon + priority + coloredTask;
    const padding = width - 4 - this.stripAnsi(content).length;
    return C.brandDim(BOX.v) + ' ' + content + ' '.repeat(Math.max(0, padding)) + C.brandDim(BOX.v);
  }

  /**
   * Render stats line
   */
  private renderStatsLine(stats: ReturnType<typeof this.getStats>, width: number): string {
    const parts: string[] = [];
    
    if (stats.completed > 0) parts.push(C.success(`${stats.completed} done`));
    if (stats.inProgress > 0) parts.push(C.warning(`${stats.inProgress} active`));
    if (stats.pending > 0) parts.push(C.dim(`${stats.pending} pending`));
    if (stats.failed > 0) parts.push(C.error(`${stats.failed} failed`));

    const statsText = parts.join(C.dim(' Â· '));
    const padding = width - 4 - this.stripAnsi(statsText).length;
    return C.brandDim(BOX.v) + ' ' + statsText + ' '.repeat(Math.max(0, padding)) + C.brandDim(BOX.v);
  }

  /**
   * Render a mini progress bar
   */
  private renderMiniProgressBar(pct: number, width: number): string {
    const filled = Math.round((pct / 100) * width);
    const empty = width - filled;
    return C.muted('[') + C.success('â–?.repeat(filled)) + C.dim('â–?.repeat(empty)) + C.muted(']') + C.muted(` ${pct}%`);
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
   * Clear N lines from current cursor position upward
   */
  private clearLines(count: number): void {
    if (count <= 0) return;

    // Move up and clear each line
    for (let i = 0; i < count; i++) {
      process.stdout.write(ANSI.cursorUp(1) + ANSI.clearLine());
    }
    process.stdout.write(ANSI.cursorLineStart());
  }
}

// ============================================================================
// Factory function
// ============================================================================

export function createTodoProgressPanel(options?: TodoProgressOptions): TodoProgressPanel {
  return new TodoProgressPanel(options);
}
