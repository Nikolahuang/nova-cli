// ============================================================================
// ErrorPanel - Modern error display component for Nova CLI
// ============================================================================

import chalk from 'chalk';
// import type { NovaError } from '../../../../../core/src/types/errors.ts';

export interface ErrorPanelOptions {
  showStack?: boolean;
  showSuggestions?: boolean;
  maxLines?: number;
  compact?: boolean;
}

export class ErrorPanel {
  private options: ErrorPanelOptions = {};

  constructor(options: ErrorPanelOptions = {}) {
    this.options = {
      showStack: false,
      showSuggestions: true,
      maxLines: 20,
      compact: false,
      ...options
    };
  }

  display(error: Error | string, context?: any): void {
    const errorInfo = this.parseError(error);
    
    if (this.options.compact) {
      this.displayCompact(errorInfo);
    } else {
      this.displayFull(errorInfo, context);
    }
  }

  private parseError(error: Error | string): ErrorInfo {
    const errorObj = typeof error === 'string' ? new Error(error) : error;

    // Try to identify Nova-specific errors
    let code: string | undefined;
    let category: ErrorCategory = 'unknown';
    let suggestion: string[] = [];

    // Check for API key related errors
    if (errorObj.message.includes('API key') ||
        (errorObj as any).name === 'AUTH_ERROR' ||
        (errorObj as any).code === 'AUTH_ERROR') {
      category = 'auth';
      code = 'AUTH_ERROR';
      suggestion = ['Check your API key configuration', 'Verify provider settings'];
    } else if (errorObj.message.includes('config') ||
               errorObj.message.includes('yaml')) {
      category = 'config';
      code = 'CONFIG_ERROR';
      suggestion = ['Validate your config file syntax', 'Run nova config edit to fix'];
    } else if (errorObj.message.includes('network') ||
               errorObj.message.includes('connection')) {
      category = 'network';
      code = 'NETWORK_ERROR';
      suggestion = ['Check internet connection', 'Verify proxy settings', 'Try again later'];
    } else if (errorObj.message.includes('model')) {
      category = 'model';
      code = 'MODEL_ERROR';
      suggestion = ['Use nova model list to see available models', 'Check provider configuration'];
    } else if (errorObj.message.includes('timeout')) {
      category = 'timeout';
      code = 'TIMEOUT_ERROR';
      suggestion = ['Request timed out', 'Try again with a simpler request'];
    } else if (errorObj.message.includes('quota') ||
               errorObj.message.includes('billing')) {
      category = 'quota';
      code = 'QUOTA_EXCEEDED';
      suggestion = ['Check your account billing status', 'Contact support for quota increase'];
    } else if (errorObj.message.includes('file') ||
               errorObj.message.includes('permission')) {
      category = 'permission';
      code = 'PERMISSION_ERROR';
      suggestion = ['Check file permissions', 'Verify you have access to the requested resource'];
    } else if (errorObj.message.includes('rate limit') ||
               errorObj.message.includes('too many requests')) {
      category = 'validation';
      code = 'RATE_LIMIT_EXCEEDED';
      suggestion = ['Wait a few minutes before trying again', 'Consider upgrading your plan for higher limits'];
    } else if (errorObj.message.includes('auth') || errorObj.message.includes('api key') || errorObj.message.includes('unauthorized')) {
      category = 'auth';
      code = 'AUTH_ERROR';
      suggestion = ['Check your API key configuration', 'Verify provider settings'];
    } else if (errorObj.message.includes('network') || errorObj.message.includes('connection')) {
      category = 'network';
      code = 'NETWORK_ERROR';
      suggestion = ['Check internet connection', 'Verify proxy settings', 'Try again later'];
    } else if (errorObj.message.includes('config') || errorObj.message.includes('yaml')) {
      category = 'config';
      code = 'CONFIG_ERROR';
      suggestion = ['Check config file syntax', 'Run nova config edit to fix'];
    } else {
      // Generic error handling
      category = 'unknown';
      code = 'UNKNOWN_ERROR';
      suggestion = ['Check the Nova CLI documentation', 'Search for your error online', 'Contact support if issue persists'];
    }

    return {
      name: errorObj.name,
      message: errorObj.message,
      code,
      category,
      suggestion,
      stack: this.options.showStack ? errorObj.stack : undefined
    };
  }

  private displayCompact(errorInfo: ErrorInfo): void {
    const icon = this.getIcon(errorInfo.category);
    const color = this.getColor(errorInfo.category);

    console.log(
      (chalk as any)[color](`${icon} ${errorInfo.message}`)
    );
  }

  private displayFull(errorInfo: ErrorInfo, context?: any): void {
    console.log('\n');
    console.log(chalk.bgRed.white.bold(' ERROR '));
    console.log(chalk.red('-'.repeat(50)));

    // Error header with category
    const categoryLabel = this.formatCategory(errorInfo.category);
    const codeLabel = errorInfo.code ? ` [${errorInfo.code}]` : '';
    
    console.log(chalk.red(`  ${categoryLabel}${codeLabel}`));

    // Error message
    console.log('');
    console.log(chalk.white('Message:'));
    console.log(chalk.yellow(`  ${errorInfo.message}`));

    // Context info
    if (context) {
      console.log('');
      console.log(chalk.white('Context:'));
      if (typeof context === 'object') {
        Object.entries(context).forEach(([key, value]) => {
          console.log(chalk.gray(`  ${key}: ${String(value)}`));
        });
      } else {
        console.log(chalk.gray(`  ${context}`));
      }
    }

    // Suggestions
    if (errorInfo.suggestion.length > 0 && this.options.showSuggestions) {
      console.log('');
      console.log(chalk.white('Suggested actions:'));
      errorInfo.suggestion.forEach((s, i) => {
        console.log(chalk.green(`  ${i + 1}. ${s}`));
      });

      // Quick commands
      console.log('');
      console.log(chalk.cyan('Quick commands:'));
      switch (errorInfo.category) {
        case 'auth':
          console.log(chalk.cyan('  • nova auth set <provider>'));
          console.log(chalk.cyan('  • Check environment variables'));
          break;
        case 'config':
          console.log(chalk.cyan('  • nova config edit'));
          console.log(chalk.cyan('  • Check ~/.nova/config.yaml'));
          break;
        case 'network':
          console.log(chalk.cyan('  • Check internet connection'));
          console.log(chalk.cyan('  • Try nova ollama status'));
          break;
        case 'model':
          console.log(chalk.cyan('  • nova model list'));
          console.log(chalk.cyan('  • Check provider configuration'));
          break;
      }
    }

    // Stack trace (if enabled and not too long)
    if (errorInfo.stack && this.options.showStack && errorInfo.stack.split('\n').length <= this.options.maxLines) {
      console.log('');
      console.log(chalk.white('Stack trace:'));
      console.log(chalk.gray(errorInfo.stack));
    } else if (errorInfo.stack) {
      console.log('');
      console.log(chalk.gray('(Stack trace truncated. Use --verbose for full trace.)'));
    }

    console.log('');
    console.log(chalk.red('-'.repeat(50)));
    console.log('');
  }

  private getIcon(category: ErrorCategory): string {
    const icons = {
      auth: '🔑',
      config: '⚙️',
      network: '🌐',
      model: '🤖',
      file: '📁',
      execution: '⚡',
      validation: '⚠️',
      permission: '🚫',
      timeout: '⏰',
      quota: '💰',
      unknown: '❌'
    };

    return icons[category] || icons.unknown;
  }

  private getColor(category: ErrorCategory): keyof typeof chalk {
    const colors: Record<ErrorCategory, keyof typeof chalk> = {
      auth: 'red',
      config: 'yellow',
      network: 'blue',
      model: 'cyan',
      file: 'green',
      execution: 'magenta',
      validation: 'yellow',
      permission: 'red',
      timeout: 'yellow',
      quota: 'red',
      unknown: 'red'
    };

    return colors[category] || colors.unknown;
  }

  private formatCategory(category: ErrorCategory): string {
    const labels = {
      auth: 'Authentication Error',
      config: 'Configuration Error',
      network: 'Network Error',
      model: 'Model Error',
      file: 'File System Error',
      execution: 'Execution Error',
      validation: 'Validation Error',
      permission: 'Permission Error',
      timeout: 'Timeout Error',
      quota: 'Quota Exceeded',
      unknown: 'Unknown Error'
    };

    return labels[category] || labels.unknown;
  }

  private getErrorSuggestions(category: ErrorCategory, code?: string): string[] {
    const suggestions: string[] = [];

    // Generic suggestions based on category
    switch (category) {
      case 'auth':
        suggestions.push('Check your API key in nova auth status');
        suggestions.push('Verify the provider supports your selected model');
        break;

      case 'config':
        suggestions.push('Validate your config.yaml file syntax');
        suggestions.push('Run nova config edit to fix configuration');
        break;

      case 'model':
        suggestions.push('Use nova model list to see available models');
        suggestions.push('Check model alias configuration');
        break;

      case 'network':
        suggestions.push('Check internet connection');
        suggestions.push('Verify proxy settings');
        break;

      case 'timeout':
        suggestions.push('Request timed out');
        suggestions.push('Try again with a simpler request');
        break;

      case 'quota':
        suggestions.push('Check your account billing status');
        suggestions.push('Contact support for quota increase');
        break;

      default:
        suggestions.push('Check the Nova CLI documentation');
        suggestions.push('Search for your error code online');
        break;
    }

    return suggestions;
  }

  // Static utility methods
  static async handleAsyncError<T>(
    promise: Promise<T>,
    context?: any
  ): Promise<T> {
    try {
      return await promise;
    } catch (error) {
      const panel = new ErrorPanel();
      panel.display(error, context);
      throw error; // Re-throw after display
    }
  }

  static formatErrorForLogging(error: Error): LoggableError {
    return {
      timestamp: new Date().toISOString(),
      name: error.name,
      message: error.message,
      stack: error.stack,
      category: this.inferCategory(error),
      code: this.extractErrorCode(error)
    };
  }

  private static inferCategory(error: Error): ErrorCategory {
    const msg = error.message.toLowerCase();

    if (msg.includes('api key') || msg.includes('authentication')) return 'auth';
    if (msg.includes('config') || msg.includes('yaml')) return 'config';
    if (msg.includes('network') || msg.includes('connection')) return 'network';
    if (msg.includes('model')) return 'model';
    if (msg.includes('file') || msg.includes('permission')) return 'file';
    if (msg.includes('timeout')) return 'timeout';
    if (msg.includes('quota') || msg.includes('billing')) return 'quota';

    return 'unknown';
  }

  private static extractErrorCode(error: Error): string | undefined {
    const match = error.message.match(/\[(\w+)\]/);
    return match ? match[1] : undefined;
  }
}

// Type definitions
interface ErrorInfo {
  name: string;
  message: string;
  code?: string;
  category: ErrorCategory;
  suggestion: string[];
  stack?: string;
}

type ErrorCategory = 
  | 'auth' | 'config' | 'network' | 'model' | 'file' 
  | 'execution' | 'validation' | 'permission' 
  | 'timeout' | 'quota' | 'unknown';

interface LoggableError {
  timestamp: string;
  name: string;
  message: string;
  stack?: string;
  category: ErrorCategory;
  code?: string;
}