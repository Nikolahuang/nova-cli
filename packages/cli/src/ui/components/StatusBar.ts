// ============================================================================
// StatusBar - Modern status bar component for Nova CLI REPL
// ============================================================================

import chalk from 'chalk';
import type { SessionInfo, NovaConfig } from '../../../../core/src/types/config.js';

export interface StatusBarOptions {
  showTokens?: boolean;
  showMode?: boolean;
  showProvider?: boolean;
  compact?: boolean;
}

export class StatusBar {
  private session: SessionInfo | null = null;
  private config: NovaConfig | null = null;
  public options: StatusBarOptions = {};

  constructor(options: StatusBarOptions = {}) {
    this.options = {
      showTokens: true,
      showMode: true,
      showProvider: true,
      compact: false,
      ...options
    };
  }

  update(session: SessionInfo, config: NovaConfig): void {
    this.session = session;
    this.config = config;
  }

  render(): string {
    if (!this.session || !this.config) {
      return '';
    }

    const parts: string[] = [];

    // Compact mode
    if (this.options.compact) {
      return this.renderCompact();
    }

    // Full mode
    return this.renderFull();
  }

  private renderCompact(): string {
    const session = this.session!;
    const config = this.config!;

    // [NOVA] model • turns • tokens • mode
    const modelShort = session.model.split('/').pop() || session.model;
    const turnCount = session.turnCount || 0;
    const tokenCount = session.totalInputTokens + session.totalOutputTokens;

    return chalk.dim(
      `[${chalk.bold('NOVA')}] ${chalk.cyan(modelShort)} • ` +
      `${chalk.yellow(turnCount)} turns • ` +
      `${chalk.green(tokenCount.toLocaleString())} tok • ` +
      `${chalk[session.mode === 'auto' ? 'green' : session.mode === 'plan' ? 'yellow' : 'blue'](session.mode.toUpperCase())}`
    );
  }

  private renderFull(): string {
    const session = this.session!;
    const config = this.config!;

    // Top border
    const width = Math.min(process.stdout.columns || 80, 120);
    const border = '─'.repeat(width);

    // Main content
    const lines: string[] = [];

    // Header
    lines.push(chalk.bgBlue.black(` NOVA CLI `));
    lines.push(chalk.dim(border));

    // Model info
    const modelShort = session.model.split('/').pop() || session.model;
    const provider = session.model.includes('/') ? session.model.split('/')[0] : 'local';
    const modelDisplay = `${provider}/${modelShort}`;

    lines.push(`${chalk.white('Model')}`.padEnd(15) + chalk.cyan(modelDisplay));
    lines.push(`${chalk.white('Session')}`.padEnd(15) + chalk.gray(session.id.slice(0, 8)));

    // Stats
    if (this.options.showTokens) {
      const totalTokens = session.totalInputTokens + session.totalOutputTokens;
      const inputTokens = session.totalInputTokens || 0;
      const outputTokens = session.totalOutputTokens || 0;

      lines.push(`${chalk.white('Tokens')}`.padEnd(15) +
        `${chalk.green(inputTokens.toLocaleString())} in / ${chalk.blue(outputTokens.toLocaleString())} out`);
    }

    lines.push(`${chalk.white('Turns')}`.padEnd(15) + chalk.yellow((session.turnCount || 0).toString()));

    // Mode
    if (this.options.showMode) {
      const modeColors = {
        auto: 'green',
        plan: 'yellow', 
        ask: 'blue'
      };
      const modeColor = modeColors[session.mode as keyof typeof modeColors] || 'gray';
      lines.push(`${chalk.white('Mode')}`.padEnd(15) + chalk[modeColor](session.mode.toUpperCase()));
    }

    // Working directory
    const cwd = session.workingDirectory || process.cwd();
    const shortCwd = cwd.length > 40 ? '...' + cwd.slice(-37) : cwd;
    lines.push(`${chalk.white('Dir')}`.padEnd(15) + chalk.gray(shortCwd));

    // Bottom border
    lines.push(chalk.dim(border));

    return lines.join('\n');
  }

  // Quick access methods
  getTokenUsage(): { input: number; output: number; total: number } {
    const session = this.session!;
    const input = session.totalInputTokens || 0;
    const output = session.totalOutputTokens || 0;
    return { input, output, total: input + output };
  }

  getSessionStats(): { turnCount: number; duration: string } {
    const session = this.session!;
    const duration = this.formatDuration(Date.now() - (session.startTime?.getTime() || Date.now()));
    
    return {
      turnCount: session.turnCount || 0,
      duration
    };
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

  // Interactive methods
  async showQuickMenu(): Promise<string> {
    console.log('\n' + this.render());
    console.log(chalk.dim('Press:'));
    console.log(`  ${chalk.green('t')} Toggle tokens display`);
    console.log(`  ${chalk.yellow('m')} Switch mode (AUTO↔PLAN↔ASK)`);
    console.log(`  ${chalk.blue('h')} Show/hide this help`);
    console.log(`  ${chalk.gray('q')} Continue to input\n`);

    // Simulate menu for testing - in real usage this would use actual input
    console.log('Simulating menu interaction...');
    return 't'; // Return simulated input
  }

  private showHelp(): void {
    console.log('\n' + this.render());
    console.log(chalk.bgWhite.black(' STATUS BAR HELP '));
    console.log(chalk.dim('-'.repeat(50)));
    console.log(chalk.white('Left side:') + ' Current model and session ID');
    console.log(chalk.white('Center:') + ' Conversation statistics (turns, tokens)');
    console.log(chalk.white('Right:') + ' Current mode and working directory');
    console.log('');
    console.log(chalk.yellow('Quick actions:'));
    console.log('  /status     - Detailed session information');
    console.log('  /mode       - Change interaction mode');
    console.log('  /compress   - Optimize context window');
    console.log('  /history    - Manage previous sessions');
    console.log('');
    console.log(chalk.dim('Press any key to continue...'));
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.once('data', () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
    });
  }
}