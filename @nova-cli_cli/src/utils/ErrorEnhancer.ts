// ============================================================================
// Error Enhancement - 增强的错误提示系�?
// ============================================================================

import { CliUI, Colors, BoxChars } from './CliUI.js';

/**
 * 增强的错误类�?
 */
export enum ErrorType {
  CONFIG = 'CONFIG',
  AUTH = 'AUTH',
  NETWORK = 'NETWORK',
  FILE = 'FILE',
  MODEL = 'MODEL',
  TOOL = 'TOOL',
  VALIDATION = 'VALIDATION',
  PERMISSION = 'PERMISSION',
  UNKNOWN = 'UNKNOWN',
}

/**
 * 错误建议
 */
interface ErrorSuggestion {
  command?: string;
  description: string;
  type: 'fix' | 'info' | 'warning';
}

/**
 * 错误详情
 */
interface ErrorDetail {
  type: ErrorType;
  message: string;
  suggestions: ErrorSuggestion[];
  showHelpCommand?: string;
}

/**
 * 错误增强�?
 */
export class ErrorEnhancer {
  private static errorMap: Map<RegExp, ErrorDetail> = new Map([
    // 认证错误
    [
      /api.?key|auth|credential/i,
      {
        type: ErrorType.AUTH,
        message: 'Authentication failed',
        suggestions: [
          {
            type: 'fix',
            description: 'Check your API key configuration',
            command: 'nova auth set <provider>',
          },
          {
            type: 'info',
            description: 'Ensure your API key is valid and has sufficient permissions',
          },
        ],
      },
    ],
    // 配置错误
    [
      /config|yaml|json/i,
      {
        type: ErrorType.CONFIG,
        message: 'Configuration error',
        suggestions: [
          {
            type: 'fix',
            description: 'Validate your configuration file',
            command: 'nova config edit',
          },
          {
            type: 'info',
            description: 'Check syntax and required fields',
          },
        ],
      },
    ],
    // 网络错误
    [
      /network|connection|timeout|econnrefused/i,
      {
        type: ErrorType.NETWORK,
        message: 'Network error',
        suggestions: [
          {
            type: 'fix',
            description: 'Check your internet connection',
          },
          {
            type: 'info',
            description: 'Try again later or use a different provider',
          },
        ],
      },
    ],
    // 文件错误
    [
      /file|directory|path|not found|enoent/i,
      {
        type: ErrorType.FILE,
        message: 'File system error',
        suggestions: [
          {
            type: 'fix',
            description: 'Check file path and permissions',
          },
          {
            type: 'info',
            description: 'Ensure the file or directory exists',
          },
        ],
      },
    ],
    // 模型错误
    [
      /model|llm|anthropic|openai|gpt|claude/i,
      {
        type: ErrorType.MODEL,
        message: 'Model error',
        suggestions: [
          {
            type: 'fix',
            description: 'Check available models',
            command: 'nova model list',
          },
          {
            type: 'info',
            description: 'Verify model name and provider support',
          },
        ],
      },
    ],
    // 权限错误
    [
      /permission|access|denied|eacces/i,
      {
        type: ErrorType.PERMISSION,
        message: 'Permission denied',
        suggestions: [
          {
            type: 'fix',
            description: 'Check file and directory permissions',
          },
          {
            type: 'info',
            description: 'Run with appropriate permissions',
          },
        ],
      },
    ],
  ]);

  /**
   * 分析错误并生成增强的错误信息
   */
  static enhance(error: Error | string): ErrorDetail {
    const message = error instanceof Error ? error.message : error;

    // 查找匹配的错误模�?
    for (const [pattern, detail] of this.errorMap.entries()) {
      if (pattern.test(message)) {
        return {
          ...detail,
          message: message,
        };
      }
    }

    // 默认错误
    return {
      type: ErrorType.UNKNOWN,
      message: message,
      suggestions: [
        {
          type: 'info',
          description: 'An unexpected error occurred',
        },
        {
          type: 'fix',
          description: 'Check the logs for more details',
        },
      ],
      showHelpCommand: 'nova --help',
    };
  }

  /**
   * 显示增强的错误信�?
   */
  static showError(error: Error | string, context?: string): void {
    const detail = this.enhance(error);
    const width = CliUI.getWidth(60, 100);

    // 打印错误�?
    console.error('');
    console.error(
      `${Colors.error}+${'-'.repeat(width - 2)}+${Colors.reset}`
    );
    console.error(
      `${Colors.error}|${Colors.reset}  ${Colors.primary}Error: ${detail.message}${' '.repeat(Math.max(0, width - detail.message.length - 12))}${Colors.error}|${Colors.reset}`
    );

    if (context) {
      console.error(
        `${Colors.error}|${Colors.reset}  ${Colors.dim}Context: ${context}${' '.repeat(Math.max(0, width - context.length - 13))}${Colors.error}|${Colors.reset}`
      );
    }

    console.error(
      `${Colors.error}|${Colors.reset}  ${Colors.dim}Type: ${detail.type}${' '.repeat(Math.max(0, width - detail.type.length - 11))}${Colors.error}|${Colors.reset}`
    );

    console.error(
      `${Colors.error}+${'-'.repeat(width - 2)}+${Colors.reset}`
    );

    // 打印建议
    if (detail.suggestions.length > 0) {
      console.error('');
      console.error(`${Colors.primary}  Suggestions:${Colors.reset}`);
      console.error('');

      detail.suggestions.forEach((suggestion, index) => {
        const icon = suggestion.type === 'fix' ? Colors.success + BoxChars.check : Colors.info + BoxChars.circle;
        const prefix = `${icon} ${Colors.reset}`;

        if (suggestion.command) {
          console.error(`  ${prefix}${Colors.info}${suggestion.command}${Colors.reset}`);
          console.error(`    ${Colors.dim}${suggestion.description}${Colors.reset}`);
        } else {
          console.error(`  ${prefix}${suggestion.description}${Colors.reset}`);
        }
        console.error('');
      });
    }

    // 打印帮助命令
    if (detail.showHelpCommand) {
      console.error(`${Colors.muted}  Run ${Colors.info}${detail.showHelpCommand}${Colors.muted} for more information${Colors.reset}`);
      console.error('');
    }
  }

  /**
   * 显示使用错误
   */
  static showUsageError(command: string, error: string, correctUsage: string, examples?: string[]): void {
    const width = CliUI.getWidth(60, 100);

    console.error('');
    console.error(
      `${Colors.warning}+${'-'.repeat(width - 2)}+${Colors.reset}`
    );
    console.error(
      `${Colors.warning}|${Colors.reset}  ${Colors.primary}Usage Error${' '.repeat(width - 16)}${Colors.warning}|${Colors.reset}`
    );
    console.error(
      `${Colors.warning}|${Colors.reset}  ${Colors.dim}Command: ${command}${' '.repeat(width - command.length - 14)}${Colors.warning}|${Colors.reset}`
    );
    console.error(
      `${Colors.warning}+${'-'.repeat(width - 2)}+${Colors.reset}`
    );

    console.error('');
    console.error(`${Colors.error}  ${BoxChars.cross} ${error}${Colors.reset}`);
    console.error('');
    console.error(`${Colors.primary}  Correct Usage:${Colors.reset}`);
    console.error(`${Colors.muted}  ${correctUsage}${Colors.reset}`);

    if (examples && examples.length > 0) {
      console.error('');
      console.error(`${Colors.info}  Examples:${Colors.reset}`);
      examples.forEach((ex) => {
        console.error(`${Colors.muted}  ${ex}${Colors.reset}`);
      });
    }

    console.error('');
  }

  /**
   * 添加自定义错误模�?
   */
  static addErrorPattern(pattern: RegExp, detail: ErrorDetail): void {
    this.errorMap.set(pattern, detail);
  }

  /**
   * 显示警告
   */
  static showWarning(message: string, suggestion?: string): void {
    console.warn('');
    console.warn(`${Colors.warning}  ${BoxChars.diamond} ${message}${Colors.reset}`);
    if (suggestion) {
      console.warn(`  ${Colors.dim}${suggestion}${Colors.reset}`);
    }
    console.warn('');
  }

  /**
   * 显示成功消息
   */
  static showSuccess(message: string): void {
    console.log('');
    console.log(`${Colors.success}  ${BoxChars.check} ${message}${Colors.reset}`);
    console.log('');
  }

  /**
   * 显示信息消息
   */
  static showInfo(message: string): void {
    console.log('');
    console.log(`${Colors.info}  ${BoxChars.circle} ${message}${Colors.reset}`);
    console.log('');
  }
}

/**
 * 进度提示
 */
export class TaskProgressIndicator {
  private static startTime: number = 0;
  private static message: string = '';

  /**
   * 开始任�?
   */
  static start(message: string): void {
    this.startTime = Date.now();
    this.message = message;
    console.log('');
    console.log(`${Colors.info}  ${BoxChars.spinner[0]} ${message}${Colors.reset}`);
  }

  /**
   * 更新进度
   */
  static update(message?: string): void {
    if (message) {
      this.message = message;
    }
    // 在实际使用中,这里会显示旋转的spinner
  }

  /**
   * 完成任务
   */
  static complete(message?: string): void {
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(2);
    const msg = message || this.message;
    console.log(`${Colors.success}  ${BoxChars.check} ${msg} ${Colors.dim}(${elapsed}s)${Colors.reset}`);
    console.log('');
  }

  /**
   * 任务失败
   */
  static fail(error: Error | string): void {
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(2);
    const errorMsg = error instanceof Error ? error.message : error;
    console.log(`${Colors.error}  ${BoxChars.cross} ${this.message} ${Colors.dim}(${elapsed}s)${Colors.reset}`);
    console.log(`  ${Colors.dim}${errorMsg}${Colors.reset}`);
    console.log('');
  }
}

/**
 * 表格输出
 */
export class TableRenderer {
  /**
   * 渲染表格
   */
  static render(headers: string[], rows: (string | number)[][]): void {
    const colWidths = headers.map((h, i) => {
      const maxWidth = Math.max(
        h.length,
        ...rows.map(r => String(r[i] || '').length)
      );
      return maxWidth + 2;
    });

    // 渲染表头
    console.log('');
    const headerRow = headers.map((h, i) =>
      `${Colors.primary}${h.padEnd(colWidths[i])}${Colors.reset}`
    ).join('');
    console.log(headerRow);

    // 渲染分隔�?
    const separator = colWidths.map(w =>
      Colors.dim + BoxChars.h.repeat(w - 1) + BoxChars.ht
    ).join('') + BoxChars.h;
    console.log(separator);

    // 渲染数据�?
    rows.forEach(row => {
      const cells = row.map((cell, i) =>
        `${Colors.reset}${String(cell).padEnd(colWidths[i])}`
      ).join('');
      console.log(cells);
    });

    console.log('');
  }

  /**
   * 渲染键值对列表
   */
  static renderKeyValue(pairs: Record<string, string | number>): void {
    const maxLength = Math.max(...Object.keys(pairs).map(k => k.length));
    const width = maxLength + 4;

    console.log('');
    Object.entries(pairs).forEach(([key, value]) => {
      const paddedKey = Colors.primary + key + ':'.padEnd(width) + Colors.reset;
      const paddedValue = Colors.muted + String(value) + Colors.reset;
      console.log(`  ${paddedKey}${paddedValue}`);
    });
    console.log('');
  }
}
