// ============================================================================
// ModernReplUI - Integrated modern UI for Nova CLI REPL
// ============================================================================

import chalk from 'chalk';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
// Use createRequire to reliably resolve package.json from the installed location
const require = createRequire(import.meta.url);
let packageJson: { version: string };
try {
  // Try to resolve from the module's own package.json (relative to src/ui)
  packageJson = require('../../../package.json');
} catch {
  // Fallback: try to find it relative to the dist output
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const packageJsonPath = path.resolve(__dirname, '../../../../package.json');
  packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
}
import type { SessionInfo, NovaConfig } from '../../../core/src/types/config.js';

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

    console.log(chalk.bgGreen.black.bold(` NOVA CLI v${packageJson.version} `));
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
    const border = '─'.repeat(width);

    console.log('');
    console.log(chalk.blue('┌' + border + '┐'));
    console.log(chalk.blue('│') + ' '.repeat(width) + chalk.blue('│'));
    console.log(chalk.blue('│') + chalk.white(` ${prompt}`).padEnd(width - 2) + chalk.blue('│'));
    console.log(chalk.blue('│') + ' '.repeat(width) + chalk.blue('│'));
    console.log(chalk.blue('└' + border + '┘'));
  }

  clearInputBox(): void {
    if (!this.options.showInputBox) return;

    const width = Math.min(process.stdout.columns || 80, 100);
    console.log(chalk.blue('┌' + ' '.repeat(width) + '┐'));
    console.log(chalk.blue('│') + ' '.repeat(width) + chalk.blue('│'));
    console.log(chalk.blue('│') + ' '.repeat(width) + chalk.blue('│'));
    console.log(chalk.blue('│') + ' '.repeat(width) + chalk.blue('│'));
    console.log(chalk.blue('└' + ' '.repeat(width) + '┘'));
  }

  // Utility methods
  private renderStatusBar(): void {
    if (this.session && this.config) {
      console.log(this.statusBar.render());
    }
  }

  private showWelcomeMessage(): void {
    const messages = [
      chalk.cyan('🚀 Welcome to Nova CLI - Your AI-Powered Terminal Assistant'),
      '',
      chalk.yellow('✨ Features:'),
      '  • Multiple AI model providers (OpenAI, Anthropic, Ollama, etc.)',
      '  • Smart file operations with @file references',
      '  • Built-in tools for code analysis and generation',
      '  • MCP server integration for extended functionality',
      '  • Session persistence and history management',
      '',
      chalk.blue('📖 Quick Start:'),
      '  • Type your request and press Enter',
      '  • Use @filename to reference files',
      '  • Use !command to execute shell commands',
      '  • Press /help for command reference',
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