// ============================================================================
// ProgressIndicator - Modern progress indicator for Nova CLI
// ============================================================================

import chalk from 'chalk';
import { EventEmitter } from 'node:events';

export interface ProgressOptions {
  type?: 'spinner' | 'bar' | 'dots';
  message?: string;
  showPercentage?: boolean;
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'cyan';
  width?: number;
}

export class ProgressIndicator extends EventEmitter {
  private isActive = false;
  private currentMessage = '';
  private currentType: 'spinner' | 'bar' | 'dots' = 'spinner';
  private currentColor: 'blue' | 'green' | 'yellow' | 'red' | 'cyan' = 'blue';
  private progress = 0;
  private startTime = 0;
  private timer: NodeJS.Timeout | null = null;

  // Spinner frames
  private spinnerFrames = ['â ?, 'â ?, 'â ?, 'â ?, 'â ?, 'â ?, 'â ?, 'â ?, 'â ?, 'â ?];
  private currentFrame = 0;

  // Bar characters
  private barWidth = 20;
  private filledChar = 'â–?;
  private emptyChar = 'â–?;

  constructor(protected options: ProgressOptions = {}) {
    super();
    this.options = {
      type: 'spinner',
      showPercentage: true,
      color: 'blue',
      width: 40,
      ...options
    };
  }

  start(message: string = 'Processing...'): void {
    if (this.isActive) {
      this.stop();
    }

    this.isActive = true;
    this.currentMessage = message;
    this.startTime = Date.now();

    this.render();

    switch (this.options.type) {
      case 'spinner':
        this.startSpinner();
        break;
      case 'bar':
        this.startBar();
        break;
      case 'dots':
        this.startDots();
        break;
    }
  }

  update(progress: number, message?: string): void {
    if (!this.isActive) return;

    this.progress = Math.max(0, Math.min(100, progress));
    
    if (message) {
      this.currentMessage = message;
    }

    this.render();
  }

  complete(message: string = 'Done!'): void {
    this.update(100, message);
    
    if (this.timer) {
      clearTimeout(this.timer);
    }

    // Clear the line and show completion
    process.stdout.write('\r\x1b[K');
    console.log(chalk.green(`âœ?${message}`));

    this.isActive = false;
    this.emit('complete', { progress: 100, duration: Date.now() - this.startTime });
  }

  fail(error: Error | string, message: string = 'Failed'): void {
    const errorMessage = typeof error === 'string' ? error : error.message;
    
    this.update(0, `${message}: ${errorMessage}`);
    
    if (this.timer) {
      clearTimeout(this.timer);
    }

    // Show error in red
    process.stdout.write('\r\x1b[K');
    console.log(chalk.red(`âœ?${message}: ${errorMessage}`));

    this.isActive = false;
    this.emit('fail', { error: errorMessage, duration: Date.now() - this.startTime });
  }

  stop(): void {
    if (!this.isActive || !this.timer) return;

    this.isActive = false;
    this.clear();

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private startSpinner(): void {
    this.timer = setInterval(() => {
      if (!this.isActive) {
        if (this.timer) {
          clearInterval(this.timer);
          this.timer = null;
        }
        return;
      }

      this.currentFrame = (this.currentFrame + 1) % this.spinnerFrames.length;
      this.render();
    }, 80);
  }

  private startBar(): void {
    this.timer = setInterval(() => {
      if (!this.isActive) {
        if (this.timer) {
          clearInterval(this.timer);
          this.timer = null;
        }
        return;
      }

      this.render();
    }, 100);
  }

  private startDots(): void {
    let dotCount = 0;
    this.timer = setInterval(() => {
      if (!this.isActive) {
        if (this.timer) {
          clearInterval(this.timer);
          this.timer = null;
        }
        return;
      }

      dotCount = (dotCount + 1) % 4;
      this.render();
    }, 500);
  }

  private render(): void {
    process.stdout.write('\r\x1b[K'); // Clear line

    const parts: string[] = [];

    // Type-specific rendering
    switch (this.options.type) {
      case 'spinner':
        parts.push(this.renderSpinner());
        break;
      case 'bar':
        parts.push(this.renderBar());
        break;
      case 'dots':
        parts.push(this.renderDots());
        break;
    }

    // Add message if provided
    if (this.currentMessage && this.options.type !== 'bar') {
      parts.push(chalk.dim(this.currentMessage));
    }

    // Add percentage if enabled
    if (this.options.showPercentage && this.options.type === 'bar') {
      const percentage = Math.round(this.progress);
      parts.push(chalk.gray(`${percentage}%`));
    }

    // Add elapsed time
    const elapsed = Date.now() - this.startTime;
    const seconds = Math.floor(elapsed / 1000);
    if (seconds > 0) {
      parts.push(chalk.gray(`(${seconds}s)`));
    }

    process.stdout.write(parts.join(' ') + '\n');
  }

  private renderSpinner(): string {
    const frame = this.spinnerFrames[this.currentFrame];
    const color = this.getColor();
    
    return `${(chalk as any)[color](frame)} ${this.currentMessage || 'Processing...'}`;
  }

    private renderBar(): string {

      const width = this.options.width || this.barWidth;

      const percentage = Math.max(0, Math.min(100, this.progress));

      const filledLength = Math.round((percentage / 100) * width);

      const emptyLength = width - filledLength;

  

      const filled = (chalk as any)[this.currentColor](this.filledChar.repeat(filledLength));

      const empty = chalk.gray(this.emptyChar.repeat(emptyLength));

  

      const bar = `[${filled}${empty}]`;

      

      let result = bar;

      if (this.currentMessage) {

        result += ` ${this.currentMessage}`;

      }

      return result;

    }

  private renderDots(): string {
    const dots = '.'.repeat((this.currentFrame + 1) % 4);
    const color = this.getColor();
    
    return (chalk as any)[color](`${dots} ${this.currentMessage || 'Working...'}`);
  }

  private getColor(): keyof typeof chalk {
    switch (this.currentColor) {
      case 'blue': return 'blue';
      case 'green': return 'green';
      case 'yellow': return 'yellow';
      case 'red': return 'red';
      case 'cyan': return 'cyan';
      default: return 'blue';
    }
  }

  private clear(): void {
    if (this.isActive) {
      process.stdout.write('\r\x1b[K\n');
    }
  }

  // Static utility methods
  static async withProgress<T>(
    task: (progress: ProgressIndicator) => Promise<T>,
    message: string = 'Processing...'
  ): Promise<T> {
    const progress = new ProgressIndicator({ type: 'bar', message });
    
    try {
      progress.start(message);
      
      // Simulate some initial progress
      progress.update(10, 'Initializing...');
      
      const result = await task(progress);
      
      progress.complete('Completed successfully!');
      return result;
    } catch (error) {
      progress.fail(error as Error, 'Operation failed');
      throw error;
    }
  }

  static async withSpinner<T>(
    task: () => Promise<T>,
    message: string = 'Processing...'
  ): Promise<T> {
    const progress = new ProgressIndicator({ type: 'spinner', message });
    progress.start(message);

    try {
      const result = await task();
      progress.complete('Done!');
      return result;
    } catch (error) {
      progress.fail(error as Error, 'Failed');
      throw error;
    }
  }
}