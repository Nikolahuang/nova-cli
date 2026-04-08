// ============================================================================
// IFlowRepl - True iFlow CLI style REPL for Nova CLI
// ============================================================================

import chalk from 'chalk';
import type { SessionInfo, NovaConfig } from '../../../packages/core/src/types/config.js';
import { IFlowDropdown } from '../ui/IFlowDropdown.js';

export interface IFlowReplOptions {
  enableDropdown?: boolean;
  showPrompt?: boolean;
  theme?: 'light' | 'dark';
}

export class IFlowRepl {
  private session: SessionInfo | null = null;
  private config: NovaConfig | null = null;
  private options: IFlowReplOptions;
  private dropdown: IFlowDropdown | null = null;

  constructor(options: IFlowReplOptions = {}) {
    this.options = {
      enableDropdown: true,
      showPrompt: true,
      theme: 'dark',
      ...options
    };

    if (this.options.enableDropdown) {
      this.dropdown = new IFlowDropdown({
        theme: this.options.theme,
        showIcons: true,
        maxHeight: 12
      });
    }
  }

  /**
   * Initialize the iFlow-style REPL
   */
  async start(session: SessionInfo, config: NovaConfig): Promise<void> {
    this.session = session;
    this.config = config;

    // Clear screen and show header
    console.clear();
    this.showHeader();

    // Show welcome message
    this.showWelcomeMessage();

    // Start input loop
    await this.runInputLoop();
  }

  /**
   * Show professional header similar to iFlow
   */
  private showHeader(): void {
    const width = Math.min(process.stdout.columns || 80, 70);
    const border = 'â”?.repeat(width);
    const title = ' NOVA CLI Â· AI-Powered Terminal Assistant ';
    const header = `â•?{border}â•®\nâ”?{title.padEnd(width)}â”‚\nâ”?{'â”€'.repeat(width)}â”¤`;

    console.log(chalk.bgBlue.black(header));

    // Model info line
    const modelShort = this.session?.model.split('/').pop() || this.session?.model || 'unknown';
    const modelLine = `â”?${chalk.cyan('Model:')} ${chalk.white(modelShort.padEnd(50))}${chalk.blue('â”?)}`;
    console.log(chalk.blue(modelLine));

    // Mode and directory info
    const modeLabel = this.session?.mode === 'auto' ? 'AUTO' : 
                     this.session?.mode === 'plan' ? 'PLAN' : 'ASK';
    const modeColor = this.session?.mode === 'auto' ? 'green' :
                     this.session?.mode === 'plan' ? 'yellow' : 'blue';

    const modeLine = `â”?${chalk[modeColor](`Mode:  ${modeLabel}`).padEnd(56)}${chalk.blue('â”?)}`;
    const dirLine = `â”?${chalk.cyan('Dir:')} ${chalk.white((this.session?.workingDirectory || '.').padEnd(49))}${chalk.blue('â”?)}`;

    console.log(chalk.blue(modeLine));
    console.log(chalk.blue(dirLine));

    const footer = `â•?{'â”?.repeat(width)}â•¯`;
    console.log(chalk.blue(footer));
    console.log('');
  }

  /**
   * Show welcome message
   */
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
      chalk.green('ðŸŽ¯ Quick Start:'),
      '  â€?Type /help for command suggestions',
      '  â€?Use â†‘â†“ arrows to navigate, Enter to select',
      '  â€?Press ESC to cancel any operation',
      '',
      chalk.blue('ðŸ’¡ Pro Tip:'),
      '  Try typing / and see the interactive dropdown!',
      '',
      chalk.gray('Press Ctrl+C at any time to cancel current operation')
    ];

    messages.forEach(msg => console.log(msg));
    console.log('');
  }

  /**
   * Main input loop with iFlow-style handling
   */
  private async runInputLoop(): Promise<void> {
    while (true) {
      try {
        // Show prompt
        if (this.options.showPrompt) {
          this.showPrompt();
        }

        // Get user input
        const input = await this.getInput();

        if (!input) continue;

        // Handle iFlow-style dropdown if enabled
        if (this.options.enableDropdown && input.startsWith('/')) {
          const result = await this.handleDropdown(input);
          if (result) {
            // Execute the selected command
            await this.executeCommand(result.id);
          }
          continue;
        }

        // Regular command execution
        await this.executeCommand(input);

      } catch (error) {
        if (error instanceof Error && error.message.includes('SIGINT')) {
          console.log(chalk.yellow('\nUse /quit or Ctrl+D to exit'));
          continue;
        }
        console.error(chalk.red(`Error: ${(error as Error).message}`));
      }
    }
  }

  /**
   * Show iFlow-style prompt
   */
  private showPrompt(): void {
    const promptText = `${chalk.cyan('[NOVA]')} ${chalk.white('> ')}`;
    process.stdout.write(promptText);
  }

  /**
   * Get user input
   */
  private async getInput(): Promise<string> {
    return new Promise((resolve) => {
      const readline = require('node:readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      rl.question('', (answer: string) => {
        rl.close();
        resolve(answer.trim());
      });
    });
  }

  /**
   * Handle iFlow-style dropdown
   */
  private async handleDropdown(input: string): Promise<any> {
    if (!this.dropdown || !this.session) return null;

    return await this.dropdown.show(input, this.session);
  }

  /**
   * Execute a command
   */
  private async executeCommand(command: string): Promise<void> {
    console.log(chalk.gray(`Executing: ${command}`));

    // Simulate command execution delay
    setTimeout(() => {
      console.log(chalk.green(`âœ?Command executed: ${command}`));
    }, 300);
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    if (this.dropdown) {
      this.dropdown.hide();
    }
  }
}