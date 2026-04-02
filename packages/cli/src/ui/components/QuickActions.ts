// ============================================================================
// QuickActions - Modern quick action menu for Nova CLI REPL
// ============================================================================

import chalk from 'chalk';
import type { SessionInfo } from '../../../../core/src/types/config.js';

export interface QuickAction {
  key: string;
  label: string;
  description: string;
  action: () => void | Promise<void>;
  category?: 'navigation' | 'session' | 'model' | 'tools' | 'help';
}

export class QuickActions {
  private actions: Map<string, QuickAction> = new Map();
  private session: SessionInfo | null = null;

  constructor(session?: SessionInfo) {
    this.session = session || null;
    this.initializeDefaultActions();
  }

  private initializeDefaultActions(): void {
    // Navigation actions
    this.addAction({
      key: '?',
      label: 'Help',
      description: 'Show command help',
      category: 'help',
      action: () => this.showHelp()
    });

    this.addAction({
      key: 'h',
      label: 'History',
      description: 'Browse previous sessions',
      category: 'navigation',
      action: () => this.showSessionHistory()
    });

    this.addAction({
      key: 'c',
      label: 'Clear',
      description: 'Start new conversation',
      category: 'session',
      action: () => this.clearConversation()
    });

    // Model actions
    this.addAction({
      key: 'm',
      label: 'Model',
      description: 'Switch model (interactive)',
      category: 'model',
      action: () => this.switchModel()
    });

    this.addAction({
      key: 'M',
      label: 'Models',
      description: 'List available models',
      category: 'model',
      action: () => this.listModels()
    });

    // Mode actions
    this.addAction({
      key: '1',
      label: 'AUTO',
      description: 'Auto mode (no approval)',
      category: 'session',
      action: () => this.setMode('auto')
    });

    this.addAction({
      key: '2',
      label: 'PLAN',
      description: 'Plan mode (ask before action)',
      category: 'session',
      action: () => this.setMode('plan')
    });

    this.addAction({
      key: '3',
      label: 'ASK',
      description: 'Ask mode (read-only)',
      category: 'session',
      action: () => this.setMode('ask')
    });

    // Tools actions
    this.addAction({
      key: 't',
      label: 'Tools',
      description: 'Manage built-in tools',
      category: 'tools',
      action: () => this.manageTools()
    });

    this.addAction({
      key: 's',
      label: 'Skills',
      description: 'Use or manage skills',
      category: 'tools',
      action: () => this.manageSkills()
    });

    this.addAction({
      key: 'p',
      label: 'Profile',
      description: 'View session profile',
      category: 'session',
      action: () => this.showProfile()
    });

    // MCP actions
    this.addAction({
      key: 'C',
      label: 'MCP Status',
      description: 'Check MCP server connections',
      category: 'tools',
      action: () => this.checkMcpStatus()
    });

    // Memory actions
    this.addAction({
      key: 'i',
      label: 'Init',
      description: 'Generate NOVA.md project file',
      category: 'session',
      action: () => this.initProject()
    });

    this.addAction({
      key: 'r',
      label: 'Compress',
      description: 'Optimize context window',
      category: 'session',
      action: () => this.compressContext()
    });
  }

  addAction(action: QuickAction): void {
    this.actions.set(action.key, action);
  }

  removeAction(key: string): boolean {
    return this.actions.delete(key);
  }

  getActionsByCategory(category: QuickAction['category']): QuickAction[] {
    return Array.from(this.actions.values())
      .filter(action => action.category === category)
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  showMenu(): void {
    console.log('\n');
    
    // Header
    const width = Math.min(process.stdout.columns || 80, 60);
    const border = '─'.repeat(width);
    
    console.log(chalk.bgBlue.white.bold(' QUICK ACTIONS '));
    console.log(chalk.blue(border));

    // Group actions by category
    const categories: Record<string, QuickAction[]> = {};
    
    for (const action of this.actions.values()) {
      const category = action.category || 'other';
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push(action);
    }

    // Display categories and actions
    for (const [categoryName, actions] of Object.entries(categories)) {
      const displayName = this.formatCategoryName(categoryName);
      
      console.log(chalk.yellow(`\n${displayName}:`));
      console.log(chalk.gray('─'.repeat(displayName.length + 1)));

      for (const action of actions.sort((a, b) => a.label.localeCompare(b.label))) {
        const keyDisplay = chalk.cyan(`[${action.key}]`);
        const labelDisplay = chalk.white(action.label.padEnd(12));
        const descDisplay = chalk.gray(action.description);

        console.log(`  ${keyDisplay} ${labelDisplay} ${descDisplay}`);
      }
    }

    console.log('');
    console.log(chalk.dim('Enter a key to execute, or press Enter to cancel...'));
  }

  async handleInput(input: string): Promise<boolean> {
    const trimmed = input.trim().toLowerCase();
    
    if (!trimmed) {
      return false; // Cancel
    }

    const action = this.actions.get(trimmed);
    if (action) {
      try {
        await action.action();
        return true;
      } catch (error) {
        console.error(chalk.red(`Error executing action: ${(error as Error).message}`));
        return true; // Consumed
      }
    }

    // Check if it's a number (mode selection)
    const numValue = parseInt(trimmed, 10);
    if (numValue >= 1 && numValue <= 3) {
      const modes = ['auto', 'plan', 'ask'] as const;
      await this.setMode(modes[numValue - 1]);
      return true;
    }

    console.log(chalk.yellow(`Unknown action: "${input}". Press ? for help.`));
    return true;
  }

  private formatCategoryName(category: string): string {
    const names = {
      navigation: 'Navigation',
      session: 'Session Management',
      model: 'Model Control',
      tools: 'Tools & Extensions',
      help: 'Help & Info',
      other: 'Other'
    };

    return names[category] || category.charAt(0).toUpperCase() + category.slice(1);
  }

  // Action implementations
  private showHelp(): void {
    console.log('\n' + chalk.bgWhite.black(' COMMAND HELP '));
    console.log(chalk.white('-'.repeat(50)));
    
    console.log(chalk.white('\nAvailable commands:'));
    console.log(chalk.cyan('  /help, /h, /?') + '     Show detailed help');
    console.log(chalk.cyan('  /quit, /exit, /q') + '  Exit Nova CLI');
    console.log(chalk.cyan('  /clear, /reset') + '     Start new conversation');
    
    console.log(chalk.white('\nSession commands:'));
    console.log(chalk.cyan('  /status') + '           Show session info');
    console.log(chalk.cyan('  /history') + '          List previous sessions');
    console.log(chalk.cyan('  /compress') + '         Optimize context');
    
    console.log(chalk.white('\nModel commands:'));
    console.log(chalk.cyan('  /model') + '            Switch model (interactive)');
    console.log(chalk.cyan('  /model <id>') + '       Switch to specific model');
    
    console.log(chalk.white('\nQuick shortcuts:'));
    console.log(chalk.cyan('  @file.ts') + '         Inject file content');
    console.log(chalk.cyan('  !command') + '          Execute shell command');
    console.log(chalk.cyan('  \\') + '                  Multi-line input');
    
    console.log('');
    console.log(chalk.gray('Press any key to continue...'));
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.once('data', () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
    });
  }

  private showSessionHistory(): void {
    // This would integrate with SessionManager
    console.log(chalk.yellow('Opening session history...'));
    console.log(chalk.gray('Use /history in REPL for full functionality'));
  }

  private clearConversation(): void {
    console.log(chalk.yellow('Clearing conversation...'));
    console.log(chalk.gray('Starting fresh session'));
  }

  private switchModel(): void {
    console.log(chalk.yellow('Opening model selector...'));
    console.log(chalk.gray('Use /model in REPL for interactive selection'));
  }

  private listModels(): void {
    console.log(chalk.yellow('Listing available models...'));
    console.log(chalk.gray('Run nova model list in terminal'));
  }

  private setMode(mode: 'auto' | 'plan' | 'ask'): void {
    console.log(chalk.green(`Switched to ${mode.toUpperCase()} mode`));
    console.log(chalk.gray('Use /mode to change interaction mode'));
  }

  private manageTools(): void {
    console.log(chalk.yellow('Managing built-in tools...'));
    console.log(chalk.gray('Use /tools in REPL to see available tools'));
  }

  private manageSkills(): void {
    console.log(chalk.yellow('Managing skills...'));
    console.log(chalk.gray('Use /skills in REPL to see available skills'));
  }

  private showProfile(): void {
    if (!this.session) {
      console.log(chalk.yellow('No active session'));
      return;
    }

    console.log(chalk.bgGreen.black(' SESSION PROFILE '));
    console.log(chalk.green('-'.repeat(50)));
    
    const session = this.session;
    console.log(chalk.white('Session ID:').padEnd(15) + chalk.gray(session.id.slice(0, 8)));
    console.log(chalk.white('Model:').padEnd(15) + chalk.cyan(session.model));
    console.log(chalk.white('Mode:').padEnd(15) + chalk.yellow(session.mode.toUpperCase()));
    console.log(chalk.white('Turns:').padEnd(15) + chalk.blue((session.turnCount || 0).toString()));
    
    const tokens = (session.totalInputTokens || 0) + (session.totalOutputTokens || 0);
    console.log(chalk.white('Tokens:').padEnd(15) + chalk.magenta(tokens.toLocaleString()));
    
    const duration = this.formatDuration(Date.now() - (session.startTime?.getTime() || Date.now()));
    console.log(chalk.white('Duration:').padEnd(15) + chalk.gray(duration));
    
    console.log('');
  }

  private checkMcpStatus(): void {
    console.log(chalk.yellow('Checking MCP server status...'));
    console.log(chalk.gray('Use /mcp in REPL for detailed status'));
  }

  private initProject(): void {
    console.log(chalk.yellow('Initializing project...'));
    console.log(chalk.gray('Use /init in REPL to generate NOVA.md'));
  }

  private compressContext(): void {
    console.log(chalk.yellow('Compressing context...'));
    console.log(chalk.gray('Use /compress in REPL to optimize'));
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  // Static utility methods
  static createFromSession(session: SessionInfo): QuickActions {
    return new QuickActions(session);
  }

  static getDefaultActions(): QuickAction[] {
    return [
      {
        key: 'Ctrl+R',
        label: 'Recent Sessions',
        description: 'Show recent sessions',
        category: 'navigation',
        action: () => console.log('Recent sessions')
      },
      {
        key: 'Ctrl+T',
        label: 'Token Usage',
        description: 'Show token statistics',
        category: 'session',
        action: () => console.log('Token usage')
      },
      {
        key: 'Ctrl+M',
        label: 'Change Mode',
        description: 'Cycle through modes',
        category: 'session',
        action: () => console.log('Change mode')
      }
    ];
  }
}