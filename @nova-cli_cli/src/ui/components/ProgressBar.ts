// ============================================================================
// ProgressBar - Terminal progress bar component
// ============================================================================

import chalk from 'chalk';

export interface ProgressBarOptions {
  /** Total progress value (default: 100) */
  total?: number;
  /** Current progress value (default: 0) */
  current?: number;
  /** Bar width in characters (default: 40) */
  width?: number;
  /** Progress bar color */
  color?: string;
  /** Show percentage (default: true) */
  showPercentage?: boolean;
  /** Show value (default: true) */
  showValue?: boolean;
  /** Custom label */
  label?: string;
  /** Clear line when complete (default: false) */
  clearOnComplete?: boolean;
}

export class ProgressBar {
  private options: Required<ProgressBarOptions>;
  private startTime: number;
  private lastRender: string = '';

  constructor(options: ProgressBarOptions = {}) {
    this.options = {
      total: options.total ?? 100,
      current: options.current ?? 0,
      width: options.width ?? 40,
      color: options.color ?? '#10B981',
      showPercentage: options.showPercentage ?? true,
      showValue: options.showValue ?? true,
      label: options.label ?? '',
      clearOnComplete: options.clearOnComplete ?? false,
    };
    this.startTime = Date.now();
  }

  /**
   * Update progress value
   */
  update(current: number): void {
    this.options.current = Math.min(current, this.options.total);
    this.render();
  }

  /**
   * Increment progress by delta
   */
  increment(delta: number = 1): void {
    this.options.current += delta;
    this.options.current = Math.min(this.options.current, this.options.total);
    this.render();
  }

  /**
   * Set progress to 100% and optionally clear
   */
  complete(): void {
    this.options.current = this.options.total;
    this.render();
    if (this.options.clearOnComplete) {
      this.clear();
    }
  }

  /**
   * Clear the progress bar from terminal
   */
  clear(): void {
    const width = process.stdout.columns || 80;
    process.stdout.write('\r' + ' '.repeat(width - 1) + '\r');
  }

  /**
   * Render the progress bar
   */
  private render(): void {
    const { current, total, width, color, showPercentage, showValue, label } = this.options;
    
    const percentage = Math.min(100, Math.max(0, (current / total) * 100));
    const filledWidth = Math.floor((percentage / 100) * width);
    const emptyWidth = width - filledWidth;
    
    const colorFn = chalk.hex(color);
    const bar = colorFn('â”?.repeat(filledWidth)) + chalk.dim('â”€'.repeat(emptyWidth));
    
    let output = '\r';
    
    if (label) {
      output += chalk.cyan(label) + ' ';
    }
    
    output += 'â•? + bar + 'â•?;
    
    if (showPercentage) {
      output += ' ' + chalk.bold(percentage.toFixed(1) + '%');
    }
    
    if (showValue) {
      output += chalk.dim(` (${current}/${total})`);
    }
    
    // Add ETA if not complete
    if (percentage > 0 && percentage < 100) {
      const elapsed = (Date.now() - this.startTime) / 1000;
      const rate = current / elapsed;
      const remaining = total - current;
      const eta = remaining / rate;
      
      if (eta > 0) {
        const minutes = Math.floor(eta / 60);
        const seconds = Math.floor(eta % 60);
        output += chalk.dim(` ETA: ${minutes}:${seconds.toString().padStart(2, '0')}`);
      }
    }
    
    // Prevent flickering by only updating if changed
    if (output !== this.lastRender) {
      process.stdout.write(output);
      this.lastRender = output;
    }
  }
}

/**
 * Create and manage multiple progress bars
 */
export class MultiProgressBar {
  private bars: ProgressBar[] = [];
  private startLine: number = 0;

  constructor() {
    this.startLine = this.getCurrentLine();
  }

  /**
   * Add a new progress bar
   */
  add(options: ProgressBarOptions = {}): ProgressBar {
    const bar = new ProgressBar(options);
    this.bars.push(bar);
    return bar;
  }

  /**
   * Remove a progress bar
   */
  remove(bar: ProgressBar): void {
    const index = this.bars.indexOf(bar);
    if (index >= 0) {
      this.bars.splice(index, 1);
    }
  }

  /**
   * Get current terminal line
   */
  private getCurrentLine(): number {
    // This is a simplified version - in practice you'd track this manually
    return 0;
  }
}

// Example usage:
// const bar = new ProgressBar({ label: 'Processing', total: 100 });
// for (let i = 0; i <= 100; i++) {
//   bar.update(i);
//   await sleep(50);
// }
// bar.complete();
