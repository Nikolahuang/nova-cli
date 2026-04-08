// ============================================================================
// SmartCompletion - Intelligent command suggestion system for Nova CLI
// ============================================================================

import chalk from 'chalk';
import type { SessionInfo } from '../../../packages/core/src/types/config.js';

export interface CommandSuggestion {
  text: string;
  description: string;
  category: 'navigation' | 'session' | 'model' | 'tools' | 'help' | 'mcp' | 'skills';
  icon?: string;
  shortcut?: string;
}

export interface CompletionContext {
  input: string;
  session: SessionInfo | null;
  mode: string;
  recentCommands: string[];
  errorHistory: string[];
}

export class SmartCompletion {
  private allCommands = new Map<string, CommandSuggestion>();
  private recentCommands: string[] = [];
  private errorHistory: string[] = [];
  private context: CompletionContext;

  constructor(session: SessionInfo | null) {
    this.context = {
      input: '',
      session,
      mode: session?.mode || 'auto',
      recentCommands: [],
      errorHistory: []
    };
    this.initializeCommands();
  }

  /**
   * Handle user input and return suggestions
   */
  async handleInput(input: string): Promise<CommandSuggestion[]> {
    this.context.input = input.trim();

    // Update context with latest info
    if (this.context.session) {
      this.context.mode = this.context.session.mode;
    }
    this.context.recentCommands = this.recentCommands.slice(0, 10);

    // Get suggestions based on input
    const suggestions = this.getSuggestions(this.context.input);

    // If we have suggestions and it's a partial match, show dropdown
    if (suggestions.length > 0 && this.context.input.startsWith('/')) {
      await this.showDropdown(suggestions);
      return suggestions;
    }

    return suggestions;
  }

  /**
   * Show interactive dropdown menu
   */
  private async showDropdown(suggestions: CommandSuggestion[]): Promise<void> {
    console.log('\n'); // Clear line before dropdown

    const width = Math.min(process.stdout.columns || 80, 60);
    const border = '‚îÄ'.repeat(width);

    // Header
    console.log(chalk.bgBlue.white.bold(' COMMAND SUGGESTIONS '));
    console.log(chalk.blue(border));

    // Sort suggestions by relevance
    const sortedSuggestions = this.sortByRelevance(suggestions);

    // Display suggestions with navigation
    let selectedIndex = 0;
    const renderMenu = () => {
      // Clear previous menu lines
      const menuHeight = Math.min(sortedSuggestions.length + 2, 15);
      process.stdout.write(`\x1b[${menuHeight}A`);

      // Show header
      console.log(chalk.yellow(`\n  Use ‚Üë‚Üì to navigate, Enter to select, Esc to cancel\n  Input: ${chalk.cyan(this.context.input)}\n`));

      // Show suggestions
      sortedSuggestions.forEach((suggestion, index) => {
        const isSelected = index === selectedIndex;
        const prefix = isSelected ? chalk.green('‚ñ?') : chalk.gray('  ');
        const keyDisplay = isSelected ? chalk.cyan(`[${suggestion.text}]`) : chalk.gray(suggestion.text);
        const descDisplay = chalk.white(suggestion.description);

        console.log(`${prefix}${keyDisplay} ${descDisplay}`);
      });

      // Bottom border
      console.log(chalk.blue('‚î? + border + '‚î?));
      console.log(chalk.blue('‚î?) + ' '.repeat(width) + chalk.blue('‚î?));
      console.log(chalk.blue('‚î? + border + '‚î?));
    };

    // Initial render
    renderMenu();

    // Handle keyboard input
    return new Promise((resolve) => {
      const readline = require('node:readline');
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

      const handleKeyPress = (key: string) => {
        switch (key) {
          case '\x1b[A': // Up arrow
            selectedIndex = Math.max(0, selectedIndex - 1);
            renderMenu();
            break;
          case '\x1b[B': // Down arrow
            selectedIndex = Math.min(sortedSuggestions.length - 1, selectedIndex + 1);
            renderMenu();
            break;
          case '\r': // Enter
          case '\n':
            rl.close();
            const selected = sortedSuggestions[selectedIndex];
            console.log(`\n‚ú?Selected: ${chalk.cyan(selected.text)}`);
            this.executeCommand(selected.text);
            resolve();
            break;
          case '\x1b': // Escape
            rl.close();
            console.log(`\nCancelled.`);
            resolve();
            break;
        }
      };

      // Set up raw mode for direct key capture
      const wasRaw = process.stdin.isRaw;
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
      }

      process.stdin.on('data', (buffer: Buffer) => {
        const key = buffer.toString();
        handleKeyPress(key);
      });
    });
  }

  /**
   * Execute the selected command
   */
  private executeCommand(commandText: string): void {
    console.log(chalk.gray(`Executing: ${commandText}`));
    
    // Simulate command execution
    setTimeout(() => {
      console.log(chalk.green(`‚ú?Command executed: ${commandText}`));
      
      // Add to recent commands
      this.addRecentCommand(commandText);
    }, 500);
  }

  /**
   * Get command suggestions based on current input and context
   */
  private getSuggestions(input: string): CommandSuggestion[] {
    if (!input.startsWith('/')) {
      return []; // Only suggest commands that start with /
    }

    const baseInput = input.slice(1).toLowerCase(); // Remove / and lowercase
    const suggestions: CommandSuggestion[] = [];

    // Filter commands based on input
    for (const [commandName, suggestion] of this.allCommands) {
      const matchesInput = commandName.toLowerCase().startsWith(baseInput) ||
                          suggestion.description.toLowerCase().includes(baseInput);

      // Additional context-based filtering
      const contextMatches = this.getContextualMatches(commandName, suggestion);

      if (matchesInput || contextMatches) {
        suggestions.push({
          ...suggestion,
          text: '/' + commandName
        });
      }
    }

    // Sort by relevance
    return this.sortByRelevance(suggestions);
  }

  /**
   * Get contextual matches based on session state and history
   */
  private getContextualMatches(commandName: string, suggestion: CommandSuggestion): boolean {
    const session = this.context.session;
    if (!session) return false;

    // Mode-specific suggestions
    if (session.mode === 'plan' && commandName.includes('approve')) {
      return true;
    }

    if (session.mode === 'ask' && commandName.includes('edit')) {
      return false; // Hide editing commands in ask mode
    }

    // Recent command suggestions
    if (this.context.recentCommands.includes(commandName)) {
      return true;
    }

    // Error-based suggestions
    if (this.context.errorHistory.length > 0) {
      const lastError = this.context.errorHistory[this.context.errorHistory.length - 1];
      if (lastError.includes('model') && commandName.includes('model')) {
        return true;
      }
      if (lastError.includes('config') && commandName.includes('config')) {
        return true;
      }
    }

    return false;
  }

  /**
   * Sort suggestions by relevance
   */
  private sortByRelevance(suggestions: CommandSuggestion[]): CommandSuggestion[] {
    return suggestions.sort((a, b) => {
      // Priority order: exact match, then startsWith, then contains
      const aExact = a.text.toLowerCase() === this.context.input.toLowerCase();
      const bExact = b.text.toLowerCase() === this.context.input.toLowerCase();

      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;

      // Then by recent usage
      const aRecent = this.context.recentCommands.indexOf(a.text.slice(1)) >= 0;
      const bRecent = this.context.recentCommands.indexOf(b.text.slice(1)) >= 0;

      if (aRecent && !bRecent) return -1;
      if (!aRecent && bRecent) return 1;

      // Finally alphabetically
      return a.text.localeCompare(b.text);
    });
  }

  /**
   * Initialize all available commands
   */
  private initializeCommands(): void {
    // Navigation commands
    this.addCommand('help', {
      description: 'Show detailed help information',
      category: 'help',
      icon: '?',
      shortcut: '/h'
    });

    this.addCommand('quit', {
      description: 'Exit Nova CLI (session auto-saved)',
      category: 'navigation',
      icon: '‚ú?,
      shortcut: '/exit'
    });

    this.addCommand('clear', {
      description: 'Clear conversation and start new session',
      category: 'session',
      icon: 'üóëÔ∏?,
      shortcut: '/reset'
    });

    // Session management
    this.addCommand('status', {
      description: 'Show current session statistics and info',
      category: 'session',
      icon: 'üìä'
    });

    this.addCommand('history', {
      description: 'Browse and manage previous sessions',
      category: 'session',
      icon: 'üìö'
    });

    this.addCommand('compress', {
      description: 'Optimize context window size',
      category: 'session',
      icon: '‚ö?
    });

    // Model commands
    this.addCommand('model', {
      description: 'Switch or list available models',
      category: 'model',
      icon: 'ü§ñ'
    });

    this.addCommand('models', {
      description: 'List all available models',
      category: 'model',
      icon: 'ü§ñ'
    });

    // Mode commands
    this.addCommand('mode', {
      description: 'Change interaction mode (AUTO/PLAN/ASK)',
      category: 'session',
      icon: 'üîÑ'
    });

    this.addCommand('auto', {
      description: 'Switch to AUTO mode (no approval needed)',
      category: 'session',
      icon: 'üöÄ'
    });

    this.addCommand('plan', {
      description: 'Switch to PLAN mode (confirm before action)',
      category: 'session',
      icon: 'üìã'
    });

    this.addCommand('ask', {
      description: 'Switch to ASK mode (read-only questions)',
      category: 'session',
      icon: '‚ù?
    });

    // Tool commands
    this.addCommand('tools', {
      description: 'Manage built-in tools and capabilities',
      category: 'tools',
      icon: 'üõ†Ô∏?
    });

    this.addCommand('skills', {
      description: 'Use or manage AI skills',
      category: 'skills',
      icon: 'üß©'
    });

    this.addCommand('init', {
      description: 'Generate NOVA.md project memory file',
      category: 'tools',
      icon: 'üìù'
    });

    // MCP commands
    this.addCommand('mcp', {
      description: 'Manage MCP server connections',
      category: 'mcp',
      icon: 'üåê'
    });

    this.addCommand('mcp-status', {
      description: 'Check MCP server connection status',
      category: 'mcp',
      icon: 'üåê'
    });

    // Memory commands
    this.addCommand('memory', {
      description: 'Manage persistent notes and memory',
      category: 'session',
      icon: 'üíæ'
    });

    this.addCommand('memory-show', {
      description: 'Display all saved memories',
      category: 'session',
      icon: 'üíæ'
    });

    this.addCommand('memory-add', {
      description: 'Add a new memory note',
      category: 'session',
      icon: '‚û?
    });

    // Quick actions
    this.addCommand('profile', {
      description: 'Show detailed session profile',
      category: 'session',
      icon: 'üë§'
    });

    this.addCommand('stats', {
      description: 'Show token usage and performance stats',
      category: 'session',
      icon: 'üìà'
    });

    this.addCommand('theme', {
      description: 'Change UI theme (light/dark)',
      category: 'tools',
      icon: 'üé®'
    });
  }

  /**
   * Add a command to the registry
   */
  private addCommand(name: string, suggestion: Omit<CommandSuggestion, 'text'>): void {
    this.allCommands.set(name, {
      text: name,
      ...suggestion
    });
  }

  /**
   * Add command to recent usage history
   */
  private addRecentCommand(command: string): void {
    const cmdName = command.startsWith('/') ? command.slice(1) : command;
    this.recentCommands.unshift(cmdName);
    this.recentCommands = this.recentCommands.slice(0, 20); // Keep only 20 most recent
  }

  /**
   * Record an error for future suggestions
   */
  recordError(error: string): void {
    this.errorHistory.unshift(error);
    this.errorHistory = this.errorHistory.slice(0, 10); // Keep only 10 most recent errors
  }

  /**
   * Get all available commands (for testing/debugging)
   */
  getAllCommands(): CommandSuggestion[] {
    return Array.from(this.allCommands.values()).map(cmd => ({
      ...cmd,
      text: '/' + cmd.text
    }));
  }

  /**
   * Get commands by category
   */
  getCommandsByCategory(category: CommandSuggestion['category']): CommandSuggestion[] {
    return this.getAllCommands()
      .filter(cmd => cmd.category === category)
      .sort((a, b) => a.text.localeCompare(b.text));
  }
}