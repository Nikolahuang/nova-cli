// ============================================================================
// ConfirmDialog - Terminal confirmation dialog
// ============================================================================

import * as readline from 'node:readline';
import chalk from 'chalk';

export interface ConfirmDialogOptions {
  /** Dialog message/question */
  message: string;
  /** Default value (default: false) */
  default?: boolean;
  /** Custom yes label (default: 'yes') */
  yesLabel?: string;
  /** Custom no label (default: 'no') */
  noLabel?: string;
  /** Show as warning (default: false) */
  warning?: boolean;
  /** Show as danger (default: false) */
  danger?: boolean;
}

export class ConfirmDialog {
  private rl: readline.Interface;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  /**
   * Show confirmation dialog and return user response
   */
  async show(options: ConfirmDialogOptions): Promise<boolean> {
    const {
      message,
      default: defaultValue = false,
      yesLabel = 'yes',
      noLabel = 'no',
      warning = false,
      danger = false,
    } = options;

    // Style the message based on type
    let styledMessage: string;
    if (danger) {
      styledMessage = chalk.redBright('⚠ ') + chalk.bold.red(message);
    } else if (warning) {
      styledMessage = chalk.yellowBright('⚠ ') + chalk.bold.yellow(message);
    } else {
      styledMessage = chalk.cyan('? ') + chalk.bold(message);
    }

    // Build prompt with options
    const prompt = defaultValue 
      ? ` ${styledMessage} (${chalk.green(yesLabel)}/${noLabel}) `
      : ` ${styledMessage} (${yesLabel}/${chalk.green(noLabel)}) `;

    return new Promise((resolve) => {
      this.rl.question(prompt, (answer) => {
        const normalized = answer.trim().toLowerCase();
        
        // Handle different answer formats
        if (normalized === '' && defaultValue !== undefined) {
          resolve(defaultValue);
        } else if (normalized === yesLabel.toLowerCase() || normalized === 'y') {
          resolve(true);
        } else if (normalized === noLabel.toLowerCase() || normalized === 'n') {
          resolve(false);
        } else {
          // For invalid input, return default
          resolve(defaultValue);
        }
        
        this.rl.close();
      });
    });
  }

  /**
   * Show danger dialog (destructive action)
   */
  async danger(message: string, defaultValue = false): Promise<boolean> {
    return this.show({
      message,
      default: defaultValue,
      danger: true,
      yesLabel: 'delete',
      noLabel: 'cancel',
    });
  }

  /**
   * Show warning dialog
   */
  async warning(message: string, defaultValue = false): Promise<boolean> {
    return this.show({
      message,
      default: defaultValue,
      warning: true,
    });
  }

  /**
   * Show info dialog
   */
  async info(message: string, defaultValue = true): Promise<boolean> {
    return this.show({
      message,
      default: defaultValue,
      danger: false,
      warning: false,
    });
  }

  /**
   * Cleanup and close
   */
  close(): void {
    try {
      this.rl.close();
    } catch {
      // Already closed
    }
  }
}

/**
 * Quick confirmation helper
 */
export async function confirm(options: ConfirmDialogOptions): Promise<boolean> {
  const dialog = new ConfirmDialog();
  try {
    return await dialog.show(options);
  } finally {
    dialog.close();
  }
}

/**
 * Quick danger confirmation
 */
export async function confirmDanger(message: string): Promise<boolean> {
  const dialog = new ConfirmDialog();
  try {
    return await dialog.danger(message);
  } finally {
    dialog.close();
  }
}

/**
 * Quick warning confirmation
 */
export async function confirmWarning(message: string): Promise<boolean> {
  const dialog = new ConfirmDialog();
  try {
    return await dialog.warning(message);
  } finally {
    dialog.close();
  }
}

// Example usage:
// const confirmed = await confirm({
//   message: 'Do you want to continue?',
//   default: true,
// });
// 
// if (confirmed) {
//   console.log('User confirmed');
// } else {
//   console.log('User cancelled');
// }
