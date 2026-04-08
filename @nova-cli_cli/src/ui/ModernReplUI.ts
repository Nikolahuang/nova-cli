// ============================================================================
// ModernReplUI - Integrated modern UI for Nova CLI REPL
// ============================================================================

import chalk from 'chalk';
import type { SessionInfo, NovaConfig } from '../../../packages/core/src/types/config.js';

import { StatusBar } from './components/StatusBar.js';
import { ProgressIndicator } from './components/ProgressIndicator.js';
import { ErrorPanel } from './components/ErrorPanel.js';
import { QuickActions } from './components/QuickActions.js';

export interface ModernReplOptions {
  showStatusBar?: boolean;
  showInputBox?: boolean;
  enableQuickActions?: boolean;
  compactMode?: boolean;
}

export class ModernReplUI {
  private session: SessionInfo | null = null;
  private config: NovaConfig | null = null;
  private options: ModernReplOptions = {};

  // UI Components
  private statusBar: StatusBar;
  private progressIndicator: ProgressIndicator;
  private errorPanel: ErrorPanel;
  private quickActions: QuickActions;

  constructor(options: ModernReplOptions = {}) {
    this.options = {
      showStatusBar: true,
      showInputBox: true,
      enableQuickActions: true,
      compactMode: false,
      ...options
    };

    // Initialize components
    this.statusBar = new StatusBar({ compact: this.options.compactMode });
    this.progressIndicator = new ProgressIndicator();
    this.errorPanel = new ErrorPanel({ compact: this.options.compactMode });
    this.quickActions = new QuickActions(this.session);

    console.log(chalk.bgGreen.black.bold(' NOVA CLI v0.1.0 '));
    console.log(chalk.green('-'.repeat(50)));
    console.log('');
  }

  async start(): Promise<void> {
    // Clear screen and setup
    console.clear();

    if (this.options.showStatusBar) {
      this.renderStatusBar();
    }

    // Show welcome message
    this.showWelcomeMessage();

    // Main input loop would be handled by parent component
    console.log(chalk.dim('Type /help for commands, or press Ctrl+C to exit...'));
  }

  updateSession(session: SessionInfo): void {
    this.session = session;
    this.quickActions = new QuickActions(session);
    
    if (this.options.showStatusBar) {
      this.statusBar.update(session, this.config!);
    }
  }

  updateConfig(config: NovaConfig): void {
    this.config = config;
    
    if (this.options.showStatusBar) {
      this.statusBar.update(this.session!, config);
    }
  }

  // Progress management
  showProgress(message: string = 'Processing...', type: 'spinner' | 'bar' | 'dots' = 'spinner'): void {
    this.progressIndicator.start(message);
  }

  updateProgress(progress: number, message?: string): void {
    this.progressIndicator.update(progress, message);
  }

  completeProgress(message: string = 'Done!'): void {
    this.progressIndicator.complete(message);
  }

  failProgress(error: Error | string, message: string = 'Failed'): void {
    this.progressIndicator.fail(error, message);
  }

  // Error handling
  handleError(error: Error | string, context?: any): void {
    this.errorPanel.display(error, context);
  }

  // Quick actions
  async showQuickMenu(): Promise<string> {
    if (!this.options.enableQuickActions) {
      return '';
    }

    this.quickActions.showMenu();
    const result = await this.quickActions.handleInput('');
    return result ? 'handled' : '';
  }

  // Input box rendering
  renderInputBox(prompt: string = 'NOVA > '): void {
    if (!this.options.showInputBox) return;

    const width = Math.min(process.stdout.columns || 80, 100);
    const border = 'â”€'.repeat(width);

    console.log('');
    console.log(chalk.blue('â”? + border + 'â”?));
    console.log(chalk.blue('â”?) + ' '.repeat(width) + chalk.blue('â”?));
    console.log(chalk.blue('â”?) + chalk.white(` ${prompt}`).padEnd(width - 2) + chalk.blue('â”?));
    console.log(chalk.blue('â”?) + ' '.repeat(width) + chalk.blue('â”?));
    console.log(chalk.blue('â”? + border + 'â”?));
  }

  clearInputBox(): void {
    if (!this.options.showInputBox) return;

    const width = Math.min(process.stdout.columns || 80, 100);
    console.log(chalk.blue('â”? + ' '.repeat(width) + 'â”?));
    console.log(chalk.blue('â”?) + ' '.repeat(width) + chalk.blue('â”?));
    console.log(chalk.blue('â”?) + ' '.repeat(width) + chalk.blue('â”?));
    console.log(chalk.blue('â”?) + ' '.repeat(width) + chalk.blue('â”?));
    console.log(chalk.blue('â”? + ' '.repeat(width) + 'â”?));
  }

  // Utility methods
  private renderStatusBar(): void {
    if (this.session && this.config) {
      console.log(this.statusBar.render());
    }
  }

  private showWelcomeMessage(): void {
    const messages = [
      chalk.cyan('ðŸš€ Welcome to Nova CLI - Your AI-Powered Terminal Assistant'),
      '',
      chalk.yellow('âœ?Features:'),
      '  â€?Multiple AI model providers (OpenAI, Anthropic, Ollama, etc.)',
      '  â€?Smart file operations with @file references',
      '  â€?Built-in tools for code analysis and generation',
      '  â€?MCP server integration for extended functionality',
      '  â€?Session persistence and history management',
      '',
      chalk.blue('ðŸ“– Quick Start:'),
      '  â€?Type your request and press Enter',
      '  â€?Use @filename to reference files',
      '  â€?Use !command to execute shell commands',
      '  â€?Press /help for command reference',
      '',
      chalk.gray('Press Ctrl+C at any time to cancel current operation')
    ];

    messages.forEach(msg => console.log(msg));
    console.log('');
  }

  // Static utility methods
  static async withModernUI<T>(
    task: (ui: ModernReplUI) => Promise<T>,
    options?: ModernReplOptions
  ): Promise<T> {
    const ui = new ModernReplUI(options);
    await ui.start();

    try {
      const result = await task(ui);
      return result;
    } finally {
      // Cleanup
      console.clear();
    }
  }

  static async createFromExisting(
    originalRepl: any,
    options?: ModernReplOptions
  ): Promise<ModernReplUI> {
    const ui = new ModernReplUI(options);

    // Hook into existing REPL methods
    if (originalRepl.printBanner) {
      const originalPrintBanner = originalRepl.printBanner.bind(originalRepl);
      originalRepl.printBanner = async function() {
        await originalPrintBanner();
        console.log('\n' + ui.statusBar.render());
      };
    }

    return ui;
  }

  // Configuration helpers
  setOption<K extends keyof ModernReplOptions>(key: K, value: ModernReplOptions[K]): void {
    this.options[key] = value;

    switch (key) {
      case 'showStatusBar':
        if (value && this.session && this.config) {
          this.statusBar.update(this.session, this.config);
        }
        break;
      case 'compactMode':
        this.statusBar.options.compact = value as boolean;
        if (this.session && this.config) {
          this.statusBar.update(this.session, this.config);
        }
        break;
      case 'enableQuickActions':
        // Actions can be toggled dynamically
        break;
    }
  }

  getStatus(): ReplUIStatus {
    return {
      hasSession: !!this.session,
      hasConfig: !!this.config,
      sessionStats: this.session ? {
        id: this.session.id,
        model: this.session.model,
        turnCount: this.session.turnCount || 0,
        tokenUsage: (this.session.totalInputTokens || 0) + (this.session.totalOutputTokens || 0),
        duration: Date.now() - (this.session.startTime?.getTime() || Date.now())
      } : null,
      uiOptions: { ...this.options },
      components: {
        statusBar: !!this.statusBar,
        progressIndicator: !!this.progressIndicator,
        errorPanel: !!this.errorPanel,
        quickActions: !!this.quickActions
      }
    };
  }

  // Cleanup
  dispose(): void {
    this.progressIndicator.stop();
    console.clear();
  }
}

// Type definitions
interface ReplUIStatus {
  hasSession: boolean;
  hasConfig: boolean;
  sessionStats: {
    id: string;
    model: string;
    turnCount: number;
    tokenUsage: number;
    duration: number;
  } | null;
  uiOptions: ModernReplOptions;
  components: {
    statusBar: boolean;
    progressIndicator: boolean;
    errorPanel: boolean;
    quickActions: boolean;
  };
}