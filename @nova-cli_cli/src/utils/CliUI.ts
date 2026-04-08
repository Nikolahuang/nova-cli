// ============================================================================
// CLI UI Helper - 统一�?CLI 界面美化工具
// ============================================================================

/**
 * 颜色和样式常�?
 */
export const Colors = {
  // 品牌�?
  brand: '\x1b[38;5;93m',        // 紫色
  brandLight: '\x1b[38;5;141m',  // 浅紫�?
  brandDim: '\x1b[38;5;93m\x1b[2m', // 暗紫�?

  // 状态色
  success: '\x1b[32m',           // 绿色
  successDim: '\x1b[32m\x1b[2m', // 暗绿�?
  warning: '\x1b[33m',           // 黄色
  warningDim: '\x1b[33m\x1b[2m', // 暗黄�?
  error: '\x1b[31m',             // 红色
  errorDim: '\x1b[31m\x1b[2m',   // 暗红�?
  info: '\x1b[36m',              // 青色
  infoDim: '\x1b[36m\x1b[2m',    // 暗青�?

  // 文本�?
  primary: '\x1b[1m',           // 加粗白色
  muted: '\x1b[90m',            // 灰色
  dim: '\x1b[2m',              // 暗色
  reset: '\x1b[0m',            // 重置
};

/**
 * 盒子字符
 */
export const BoxChars = {
  tl: '�?, tr: '�?, bl: '�?, br: '�?,
  h: '─', v: '�?, ht: '�?, htr: '�?, cross: '�?,
  hThick: '�?, vThick: '�?,
  arrow: '�?, bullet: '�?, check: '�?, crossMark: '�?, dot: '·',
  diamond: '�?, star: '�?, circle: '�?, circleFull: '�?,
  spinner: ['�?,'�?,'�?,'�?,'�?,'�?,'�?,'�?,'�?,'�?],
  arrowRight: '�?, arrowLeft: '�?, arrowUp: '�?, arrowDown: '�?,
};

/**
 * CLI UI 辅助�?
 */
export class CliUI {
  private static termCols = process.stdout.columns || 80;
  private static maxWidth = Math.min(this.termCols - 4, 100);

  /**
   * 获取终端宽度,限制�?min �?max 之间
   */
  static getWidth(min = 40, max = 100): number {
    const cols = process.stdout.columns || 80;
    return Math.max(min, Math.min(cols - 4, max));
  }

  /**
   * 创建分割�?
   */
  static hr(char = '─', width = this.maxWidth, color = Colors.muted): string {
    return color + char.repeat(width) + Colors.reset;
  }

  /**
   * 创建标题�?
   */
  static createBoxHeader(title: string, subtext?: string): string[] {
    const width = this.getWidth();
    const hr = this.hr(BoxChars.h, width, Colors.brandDim);
    const hrThick = this.hr(BoxChars.hThick, width, Colors.brand);

    const lines: string[] = ['', Colors.brand + BoxChars.tl + hrThick + BoxChars.tr + Colors.reset];

    // 标题�?
    if (title) {
      const titleText = `  ${Colors.brand}${BoxChars.diamond} ${Colors.primary}${title}${Colors.reset}`;
      const padding = ' '.repeat(Math.max(0, width - title.length - 6));
      lines.push(Colors.brand + BoxChars.v + Colors.reset + titleText + padding + Colors.brand + BoxChars.v + Colors.reset);
    }

    // 副标�?
    if (subtext) {
      const subText = `  ${Colors.muted}${subtext}${Colors.reset}`;
      const padding = ' '.repeat(Math.max(0, width - subtext.length + 6));
      lines.push(Colors.brand + BoxChars.v + Colors.reset + subText + padding + Colors.brand + BoxChars.v + Colors.reset);
    }

    lines.push(Colors.brand + BoxChars.bl + hrThick + BoxChars.br + Colors.reset, '');
    return lines;
  }

  /**
   * 创建章节标题
   */
  static createSection(title: string): string {
    const width = this.getWidth();
    const padding = ' '.repeat(Math.max(0, width - title.length - 6));
    return `\n${Colors.brand}${BoxChars.diamond}${Colors.reset} ${Colors.primary}${title}${Colors.reset}${padding}`;
  }

  /**
   * 创建命令�?
   */
  static createCmd(name: string, desc: string, nameWidth = 24): string {
    return `  ${Colors.info}${name.padEnd(nameWidth)}${Colors.reset} ${Colors.muted}${desc}${Colors.reset}`;
  }

  /**
   * 打印成功消息
   */
  static success(message: string, icon = BoxChars.check): void {
    console.log(`${Colors.success}  ${icon} ${message}${Colors.reset}`);
  }

  /**
   * 打印错误消息
   */
  static error(message: string, icon = BoxChars.cross): void {
    console.error(`${Colors.error}  ${icon} ${message}${Colors.reset}`);
  }

  /**
   * 打印警告消息
   */
  static warning(message: string, icon = BoxChars.diamond): void {
    console.log(`${Colors.warning}  ${icon} ${message}${Colors.reset}`);
  }

  /**
   * 打印信息消息
   */
  static info(message: string, icon = BoxChars.circle): void {
    console.log(`${Colors.info}  ${icon} ${message}${Colors.reset}`);
  }

  /**
   * 打印带框的成功消�?
   */
  static successBox(message: string): void {
    const width = this.getWidth();
    const lines = [
      Colors.brand + BoxChars.tl + this.hr(BoxChars.hThick, width, Colors.success) + BoxChars.tr + Colors.reset,
      Colors.success + BoxChars.v + Colors.reset + '  ' + message + ' '.repeat(Math.max(0, width - message.length - 4)) + Colors.success + BoxChars.v + Colors.reset,
      Colors.success + BoxChars.bl + this.hr(BoxChars.hThick, width, Colors.success) + BoxChars.br + Colors.reset,
    ];
    console.log(lines.join('\n'));
  }

  /**
   * 打印带框的错误消�?
   */
  static errorBox(message: string): void {
    const width = this.getWidth();
    const lines = [
      Colors.brand + BoxChars.tl + this.hr(BoxChars.hThick, width, Colors.error) + BoxChars.tr + Colors.reset,
      Colors.error + BoxChars.v + Colors.reset + '  ' + message + ' '.repeat(Math.max(0, width - message.length - 4)) + Colors.error + BoxChars.v + Colors.reset,
      Colors.error + BoxChars.bl + this.hr(BoxChars.hThick, width, Colors.error) + BoxChars.br + Colors.reset,
    ];
    console.error(lines.join('\n'));
  }

  /**
   * 打印使用说明
   */
  static printUsage(command: string, description: string, examples?: string[]): void {
    const lines = this.createBoxHeader('Usage');

    console.log(`${Colors.primary}${command}${Colors.reset} - ${Colors.muted}${description}${Colors.reset}`);

    if (examples && examples.length > 0) {
      console.log('');
      console.log(this.createSection('Examples'));
      examples.forEach((ex) => {
        console.log(`  ${Colors.muted}${ex}${Colors.reset}`);
      });
    }

    console.log('');
  }

  /**
   * 打印加载状�?
   */
  static loading(message: string): () => void {
    let frames = 0;
    const spinner = BoxChars.spinner;
    const interval = setInterval(() => {
      process.stdout.write(`\r${Colors.info}${spinner[frames % spinner.length]}${Colors.reset} ${message}`);
      frames++;
    }, 80);

    return () => {
      clearInterval(interval);
      process.stdout.write('\r' + ' '.repeat(message.length + 2) + '\r');
    };
  }

  /**
   * 打印列表
   */
  static printList(items: Array<{ label: string; value: string; description?: string }>): void {
    const width = this.getWidth();
    items.forEach((item) => {
      const label = `${Colors.primary}${item.label}:${Colors.reset}`;
      const value = `${Colors.info}${item.value}${Colors.reset}`;
      const desc = item.description ? ` ${Colors.dim}(${item.description})${Colors.reset}` : '';
      const padding = ' '.repeat(Math.max(0, width - label.length - value.length - desc.length - 8));
      console.log(`    ${label} ${value}${desc}${padding}`);
    });
  }

  /**
   * 创建表格
   */
  static createTable(headers: string[], rows: string[][]): string[] {
    const colWidths = headers.map((h, i) => {
      const maxWidth = Math.max(h.length, ...rows.map(r => (r[i] || '').length));
      return maxWidth + 4;
    });

    const headerRow = headers.map((h, i) => `${Colors.primary}${h.padEnd(colWidths[i])}${Colors.reset}`).join('');
    const separator = colWidths.map(w => Colors.dim + BoxChars.h.repeat(w - 1) + BoxChars.ht).join('') + BoxChars.h;

    const result = ['', headerRow, separator];

    rows.forEach(row => {
      const cells = row.map((cell, i) => `${Colors.reset}${cell.padEnd(colWidths[i])}`).join('');
      result.push(cells);
    });

    result.push('');
    return result;
  }
}

/**
 * 错误处理�?
 */
export class ErrorHandler {
  /**
   * 显示友好的错误信�?
   */
  static showError(error: Error | string, context?: string): void {
    const message = error instanceof Error ? error.message : error;
    
    CliUI.errorBox('Error occurred');
    console.log('');
    console.log(`${Colors.error}  Message:${Colors.reset} ${message}`);

    if (context) {
      console.log(`${Colors.dim}  Context:${Colors.reset} ${context}`);
    }

    console.log('');
    console.log(`${Colors.muted}  Tip: Use ${Colors.info}--help${Colors.reset} to see usage information`);
  }

  /**
   * 显示使用错误
   */
  static showUsageError(command: string, error: string, correctUsage: string): void {
    console.error('');
    CliUI.error('Usage Error', BoxChars.cross);
    console.error('');
    console.error(`${Colors.muted}  ${error}${Colors.reset}`);
    console.error('');
    console.error(`${Colors.info}  Correct usage:${Colors.reset}`);
    console.error(`${Colors.muted}  ${correctUsage}${Colors.reset}`);
    console.error('');
  }

  /**
   * 显示警告
   */
  static showWarning(message: string, suggestion?: string): void {
    console.warn('');
    CliUI.warning(message, BoxChars.diamond);
    if (suggestion) {
      console.warn(`  ${Colors.dim}${suggestion}${Colors.reset}`);
    }
    console.warn('');
  }
}

/**
 * 进度指示�?
 */
export class ProgressIndicator {
  private static current = 0;
  private static total = 0;
  private static message = '';

  /**
   * 开始进�?
   */
  static start(message: string, total: number): void {
    this.total = total;
    this.current = 0;
    this.message = message;
    this.update();
  }

  /**
   * 更新进度
   */
  static update(increment = 1): void {
    this.current = Math.min(this.current + increment, this.total);
    this.render();
  }

  /**
   * 完成
   */
  static complete(): void {
    this.current = this.total;
    this.render();
    process.stdout.write('\n');
  }

  /**
   * 渲染进度�?
   */
  private static render(): void {
    const width = CliUI.getWidth(20, 50);
    const percentage = Math.round((this.current / this.total) * 100);
    const filled = Math.round((this.current / this.total) * width);
    const empty = width - filled;

    const bar = Colors.success + BoxChars.hThick.repeat(filled) + Colors.dim + BoxChars.hThick.repeat(empty) + Colors.reset;
    const text = `${Colors.info}${this.message}${Colors.reset} ${bar} ${percentage}%`;

    process.stdout.write(`\r${text}`);
  }
}
