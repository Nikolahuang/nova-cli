// ============================================================================
// SimpleErrorPanel - Basic error display component for Nova CLI
// ============================================================================

export interface ErrorPanelOptions {
  showStack?: boolean;
  compact?: boolean;
}

export class SimpleErrorPanel {
  private options: ErrorPanelOptions = {};

  constructor(options: ErrorPanelOptions = {}) {
    this.options = {
      showStack: false,
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

    // Simple error categorization based on message content
    let category: ErrorCategory = 'unknown';
    let code: string | undefined;
    let suggestion: string[] = [];

    if (errorObj.message.includes('API key') || 
        errorObj.message.includes('authentication')) {
      category = 'auth';
      code = 'AUTH_ERROR';
      suggestion = ['Check your API key configuration', 'Verify provider settings'];
    } else if (errorObj.message.includes('network') || 
               errorObj.message.includes('connection')) {
      category = 'network';
      code = 'NETWORK_ERROR';
      suggestion = ['Check internet connection', 'Try again later'];
    } else if (errorObj.message.includes('config') || 
               errorObj.message.includes('yaml')) {
      category = 'config';
      code = 'CONFIG_ERROR';
      suggestion = ['Check config file syntax', 'Run nova config edit to fix'];
    } else if (errorObj.message.includes('timeout')) {
      category = 'timeout';
      code = 'TIMEOUT_ERROR';
      suggestion = ['Request timed out', 'Try with a simpler request'];
    } else if (errorObj.message.includes('rate limit') || 
               errorObj.message.includes('too many requests')) {
      category = 'validation';
      code = 'RATE_LIMIT_EXCEEDED';
      suggestion = ['Wait a few minutes', 'Consider upgrading your plan'];
    } else {
      category = 'unknown';
      code = 'UNKNOWN_ERROR';
      suggestion = ['Check the Nova CLI documentation', 'Contact support if issue persists'];
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
      `${color}${icon} ${errorInfo.message}`
    );
  }

  private displayFull(errorInfo: ErrorInfo, context?: any): void {
    console.log('\n');
    console.log('\x1b[41m\x1b[37m ERROR \x1b[0m');
    console.log('\x1b[31m' + '-'.repeat(50) + '\x1b[0m');

    // Error header with category
    const categoryLabel = this.formatCategory(errorInfo.category);
    const codeLabel = errorInfo.code ? ` [${errorInfo.code}]` : '';
    
    console.log(`\x1b[31m  ${categoryLabel}${codeLabel}\x1b[0m`);

    // Error message
    console.log('');
    console.log('\x1b[32mMessage:\x1b[0m');
    console.log(`\x1b[33m  ${errorInfo.message}\x1b[0m`);

    // Context info
    if (context) {
      console.log('');
      console.log('\x1b[32mContext:\x1b[0m');
      if (typeof context === 'object') {
        Object.entries(context).forEach(([key, value]) => {
          console.log(`\x1b[90m  ${key}: ${String(value)}\x1b[0m`);
        });
      } else {
        console.log(`\x1b[90m  ${context}\x1b[0m`);
      }
    }

    // Suggestions
    if (errorInfo.suggestion.length > 0) {
      console.log('');
      console.log('\x1b[32mSuggested actions:\x1b[0m');
      errorInfo.suggestion.forEach((s, i) => {
        console.log(`\x1b[32m  ${i + 1}. ${s}\x1b[0m`);
      });

      // Quick commands
      console.log('');
      console.log('\x1b[36mQuick commands:\x1b[0m');
      switch (errorInfo.category) {
        case 'auth':
          console.log('\x1b[36m  • nova auth set <provider>\x1b[0m');
          console.log('\x1b[36m  • Check environment variables\x1b[0m');
          break;
        case 'config':
          console.log('\x1b[36m  • nova config edit\x1b[0m');
          console.log('\x1b[36m  • Check ~/.nova/config.yaml\x1b[0m');
          break;
        case 'network':
          console.log('\x1b[36m  • Check internet connection\x1b[0m');
          console.log('\x1b[36m  • Try nova ollama status\x1b[0m');
          break;
        case 'model':
          console.log('\x1b[36m  • nova model list\x1b[0m');
          console.log('\x1b[36m  • Check provider configuration\x1b[0m');
          break;
      }
    }

    // Stack trace (if enabled and not too long)
    if (errorInfo.stack && this.options.showStack && errorInfo.stack.split('\n').length <= 20) {
      console.log('');
      console.log('\x1b[32mStack trace:\x1b[0m');
      console.log(`\x1b[90m${errorInfo.stack}\x1b[0m`);
    } else if (errorInfo.stack) {
      console.log('');
      console.log('\x1b[90m(Stack trace truncated. Use --verbose for full trace.)\x1b[0m');
    }

    console.log('');
    console.log('\x1b[31m' + '-'.repeat(50) + '\x1b[0m');
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

  private getColor(category: ErrorCategory): string {
    const colors = {
      auth: '\x1b[31m',
      config: '\x1b[33m',
      network: '\x1b[34m',
      model: '\x1b[36m',
      file: '\x1b[32m',
      execution: '\x1b[35m',
      validation: '\x1b[33m',
      permission: '\x1b[31m',
      timeout: '\x1b[33m',
      quota: '\x1b[31m',
      unknown: '\x1b[31m'
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