// ============================================================================
// IFlowDropdown - True iFlow CLI style dropdown interface for Nova CLI
// ============================================================================

import chalk from 'chalk';
import type { SessionInfo } from '../../../core/src/types/config.js';

export interface DropdownItem {
  id: string;
  label: string;
  description: string;
  category: 'navigation' | 'session' | 'model' | 'tools' | 'help' | 'mcp' | 'skills';
  icon?: string;
  shortcut?: string;
  action?: () => void | Promise<void>;
}

export interface DropdownConfig {
  maxHeight?: number;      // Maximum dropdown height
  animationDuration?: number; // Animation speed in ms
  showIcons?: boolean;     // Display icons
  enableSearch?: boolean;  // Enable real-time search
  theme?: 'light' | 'dark'; // Theme selection
}

export class IFlowDropdown {
  private items: DropdownItem[] = [];
  private filteredItems: DropdownItem[] = [];
  private selectedIndex: number = 0;
  private isVisible: boolean = false;
  private config: DropdownConfig;
  private currentInput: string = '';

  constructor(config: DropdownConfig = {}) {
    this.config = {
      maxHeight: 15,
      animationDuration: 200,
      showIcons: true,
      enableSearch: true,
      theme: 'dark',
      ...config
    };

    this.initializeItems();
  }

  /**
   * Show dropdown with suggestions based on input
   */
  async show(input: string, session: SessionInfo | null): Promise<DropdownItem | null> {
    if (!input.startsWith('/')) return null;

    // Filter items based on input and context
    this.filterItems(input, session);

    if (this.filteredItems.length === 0) return null;

    this.isVisible = true;
    this.selectedIndex = 0;

    await this.render(input);
    return await this.handleInput(input);
  }

  /**
   * Initialize all dropdown items
   */
  private initializeItems(): void {
    this.items = [
      // Navigation commands
      {
        id: 'help',
        label: 'Help',
        description: 'Show detailed help information',
        category: 'navigation',
        icon: '?',
        shortcut: '/h'
      },
      {
        id: 'quit',
        label: 'Quit',
        description: 'Exit Nova CLI (session auto-saved)',
        category: 'navigation',
        icon: '✗',
        shortcut: '/exit'
      },
      {
        id: 'clear',
        label: 'Clear',
        description: 'Clear conversation and start new session',
        category: 'navigation',
        icon: '🗑️',
        shortcut: '/reset'
      },

      // Session management
      {
        id: 'status',
        label: 'Status',
        description: 'Show current session statistics and info',
        category: 'session',
        icon: '📊'
      },
      {
        id: 'history',
        label: 'History',
        description: 'Browse and manage previous sessions',
        category: 'session',
        icon: '📚'
      },
      {
        id: 'compress',
        label: 'Compress',
        description: 'Optimize context window size',
        category: 'session',
        icon: '⚡'
      },

      // Model commands
      {
        id: 'model',
        label: 'Model',
        description: 'Switch or list available models',
        category: 'model',
        icon: '🤖'
      },
      {
        id: 'models',
        label: 'Models',
        description: 'List all available models',
        category: 'model',
        icon: '🤖'
      },

      // Mode commands
      {
        id: 'mode',
        label: 'Mode',
        description: 'Change interaction mode (AUTO/PLAN/ASK)',
        category: 'session',
        icon: '🔄'
      },
      {
        id: 'auto',
        label: 'Auto',
        description: 'Switch to AUTO mode (no approval needed)',
        category: 'session',
        icon: '🚀'
      },
      {
        id: 'plan',
        label: 'Plan',
        description: 'Switch to PLAN mode (confirm before action)',
        category: 'session',
        icon: '📋'
      },
      {
        id: 'ask',
        label: 'Ask',
        description: 'Switch to ASK mode (read-only questions)',
        category: 'session',
        icon: '❓'
      },

      // Tool commands
      {
        id: 'tools',
        label: 'Tools',
        description: 'Manage built-in tools and capabilities',
        category: 'tools',
        icon: '🛠️'
      },
      {
        id: 'skills',
        label: 'Skills',
        description: 'Use or manage AI skills',
        category: 'skills',
        icon: '🧩'
      },
      {
        id: 'init',
        label: 'Init',
        description: 'Generate NOVA.md project memory file',
        category: 'tools',
        icon: '📝'
      },

      // MCP commands
      {
        id: 'mcp',
        label: 'MCP',
        description: 'Manage MCP server connections',
        category: 'mcp',
        icon: '🌐'
      },
      {
        id: 'mcp-status',
        label: 'MCP Status',
        description: 'Check MCP server connection status',
        category: 'mcp',
        icon: '🌐'
      },

      // Memory commands
      {
        id: 'memory',
        label: 'Memory',
        description: 'Manage persistent notes and memory',
        category: 'session',
        icon: '💾'
      },
      {
        id: 'profile',
        label: 'Profile',
        description: 'Show detailed session profile',
        category: 'session',
        icon: '👤'
      }
    ];
  }

  /**
   * Filter items based on input and session context
   */
  private filterItems(input: string, session: SessionInfo | null): void {
    const baseInput = input.slice(1).toLowerCase(); // Remove / and lowercase

    this.filteredItems = this.items.filter(item => {
      // Basic text matching
      const matchesText = item.label.toLowerCase().includes(baseInput) ||
                         item.description.toLowerCase().includes(baseInput) ||
                         item.id.toLowerCase().startsWith(baseInput);

      if (!matchesText) return false;

      // Context-based filtering
      if (session?.mode === 'ask') {
        // In ask mode, hide editing commands
        if (['clear', 'memory-add'].includes(item.id)) return false;
      }

      // Mode-specific suggestions based on recent errors would go here
      // For now, return basic filtered results

      return true;
    });

    // Sort by relevance
    this.sortItems();
  }

  /**
   * Sort items by relevance
   */
  private sortItems(): void {
    this.filteredItems.sort((a, b) => {
      // Exact match first
      if (a.id === b.id) return 0;
      if (a.id.toLowerCase() === this.currentInput.toLowerCase()) return -1;
      if (b.id.toLowerCase() === this.currentInput.toLowerCase()) return 1;

      // Then by startsWith
      const aStarts = a.id.toLowerCase().startsWith(this.currentInput.toLowerCase());
      const bStarts = b.id.toLowerCase().startsWith(this.currentInput.toLowerCase());

      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;

      // Finally alphabetically
      return a.label.localeCompare(b.label);
    });
  }

  /**
   * Render the dropdown UI
   */
  private async render(input: string): Promise<void> {
    console.clear();

    // Header
    const width = Math.min(process.stdout.columns || 80, 70);
    const border = '━'.repeat(width);
    const title = ' NOVA CLI COMMAND SUGGESTIONS ';
    const header = `╭${border}╮\n│${title.padEnd(width)}│\n├${'─'.repeat(width)}┤`;

    console.log(chalk.bgBlue.black(header));
    console.log(chalk.blue(`│ Use ↑↓ to navigate, Enter to select, Esc to cancel${' '.repeat(width - 64)}│`));
    console.log(chalk.blue(`│ Input: ${chalk.cyan(input)}${' '.repeat(width - 18 - input.length)}│`));
    console.log(chalk.blue(`├${'─'.repeat(width)}┤`));

    // Items
    const displayCount = Math.min(
      this.filteredItems.length,
      this.config.maxHeight || 15
    );

    for (let i = 0; i < displayCount; i++) {
      const item = this.filteredItems[i];
      const isSelected = i === this.selectedIndex;

      // Selection indicator
      const prefix = isSelected ? chalk.green('▶ ') : chalk.gray('  ');
      const indent = isSelected ? ' ' : '·';

      // Icon
      let iconDisplay = '';
      if (this.config.showIcons && item.icon) {
        iconDisplay = isSelected ? chalk.white(item.icon) : chalk.gray(item.icon);
      }

      // Label and description
      const labelDisplay = isSelected 
        ? chalk.cyan.bold(item.label)
        : chalk.white(item.label);

      const descDisplay = isSelected
        ? chalk.yellow(item.description)
        : chalk.gray(item.description);

      // Shortcut
      let shortcutDisplay = '';
      if (item.shortcut) {
        shortcutDisplay = isSelected
          ? chalk.magenta(` [${item.shortcut}]`)
          : chalk.gray(` (${item.shortcut})`);
      }

      const line = `${prefix}${indent}${iconDisplay} ${labelDisplay} ${descDisplay}${shortcutDisplay}`;
      console.log(chalk.blue(`│${line.padEnd(width)}│`));
    }

    // Footer
    const footer = `╰${'━'.repeat(width)}╯`;
    console.log(chalk.blue(footer));
    console.log('');
  }

  /**
   * Handle user input for dropdown navigation
   */
  private async handleInput(input: string): Promise<DropdownItem | null> {
    return new Promise((resolve) => {
      const readline = require('node:readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      // Set raw mode for direct key capture
      const wasRaw = process.stdin.isRaw;
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
      }

      const handleKeyPress = (key: string) => {
        switch (key) {
          case '\x1b[A': // Up arrow
            this.selectedIndex = Math.max(0, this.selectedIndex - 1);
            this.render(input);
            break;

          case '\x1b[B': // Down arrow
            this.selectedIndex = Math.min(
              this.filteredItems.length - 1,
              this.selectedIndex + 1
            );
            this.render(input);
            break;

          case '\r': // Enter
          case '\n':
            rl.close();
            if (process.stdin.isTTY) {
              process.stdin.setRawMode(wasRaw);
            }

            const selected = this.filteredItems[this.selectedIndex];
            if (selected) {
              console.log(chalk.green(`✓ Executing: ${selected.label}`));
              setTimeout(() => {
                if (selected.action) {
                  selected.action();
                }
                resolve(selected);
              }, 500);
            } else {
              resolve(null);
            }
            break;

          case '\x1b': // Escape
            rl.close();
            if (process.stdin.isTTY) {
              process.stdin.setRawMode(wasRaw);
            }
            console.log(chalk.gray('\nCancelled.'));
            resolve(null);
            break;
        }
      };

      process.stdin.on('data', handleKeyPress);
    });
  }

  /**
   * Hide dropdown
   */
  hide(): void {
    this.isVisible = false;
  }

  /**
   * Get all available items (for testing)
   */
  getAllItems(): DropdownItem[] {
    return [...this.items];
  }

  /**
   * Get items by category
   */
  getItemsByCategory(category: DropdownItem['category']): DropdownItem[] {
    return this.items.filter(item => item.category === category);
  }
}