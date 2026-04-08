// ============================================================================
// SimpleSelector2 - Simplified interactive selection for NOVA CLI
// Provides iFlow CLI-like interactive selection experience
// Windows-compatible: uses ANSI cursor movement instead of clearScreenDown
// ============================================================================

import chalk from 'chalk';

export interface SelectItem {
  label: string;
  value: string;
  description?: string;
}

/**
 * Simple interactive selection using arrow keys.
 * Uses ANSI escape codes for cursor movement (Windows-compatible).
 */
export async function selectInteractive(
  items: SelectItem[],
  title: string = 'Select an option'
): Promise<string | null> {

  if (items.length === 0) {
    console.log(chalk.dim('  No items available'));
    return null;
  }

  let selectedIndex = 0;
  const pageSize = 10;
  let renderedLineCount = 0; // Track how many lines were rendered

  // Function to render the selection menu
  const render = (isFirst: boolean) => {
    if (isFirst) {
      // First render: just draw from current cursor position
      doRender();
    } else {
      // Subsequent renders: move cursor up to redraw in place
      // Move cursor up by renderedLineCount lines
      if (renderedLineCount > 0) {
        process.stdout.write(`\x1b[${renderedLineCount}A`);
      }
      // Now clear and redraw each line
      doRender();
    }
  };

  const doRender = () => {
    // Calculate pagination
    const startIndex = Math.floor(selectedIndex / pageSize) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, items.length);

    // Count lines we're about to render
    let lineCount = 0;

    // Title (2 lines: title + hint)
    process.stdout.write('\x1b[2K\r' + chalk.hex('#7C3AED').bold(`  ${title}`) + '\n');
    lineCount++;
    process.stdout.write('\x1b[2K\r' + chalk.dim('  \u2191\u2193 to navigate, Enter to select, Esc to cancel') + '\n');
    lineCount++;
    process.stdout.write('\x1b[2K\r');
    process.stdout.write('\n');
    lineCount++;

    // Display items
    for (let i = startIndex; i < endIndex; i++) {
      process.stdout.write('\x1b[2K\r');
      const item = items[i];
      const isSelected = i === selectedIndex;
      const prefix = isSelected ? chalk.hex('#7C3AED')('> ') : '  ';
      const label = isSelected ? chalk.hex('#7C3AED').bold(item.label) : chalk.white(item.label);

      let line = `${prefix}${label}`;

      if (item.description) {
        line += chalk.dim(` - ${item.description}`);
      }

      process.stdout.write(line + '\n');
      lineCount++;
    }

    // Pagination info (1-2 lines)
    if (items.length > pageSize) {
      const currentPage = Math.floor(selectedIndex / pageSize) + 1;
      const totalPages = Math.ceil(items.length / pageSize);
      process.stdout.write('\x1b[2K\r');
      process.stdout.write('\n');
      process.stdout.write('\x1b[2K\r' + chalk.dim(`  Page ${currentPage}/${totalPages} (${items.length} items)`));
      process.stdout.write('\n');
      lineCount += 2;
    } else {
      process.stdout.write('\x1b[2K\r');
      process.stdout.write('\n');
      process.stdout.write('\x1b[2K\r' + chalk.dim(`  ${items.length} items`));
      process.stdout.write('\n');
      lineCount += 2;
    }

    renderedLineCount = lineCount;
  };

  // Initial render
  render(true);

  return new Promise((resolve) => {
    // Set raw mode for keypress handling
    const wasRaw = process.stdin.isRaw;
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    const onData = (data: Buffer) => {
      const str = data.toString();

      // Handle arrow keys
      if (str === '\u001b[A') { // Up arrow
        if (selectedIndex > 0) {
          selectedIndex--;
          render(false);
        }
      } else if (str === '\u001b[B') { // Down arrow
        if (selectedIndex < items.length - 1) {
          selectedIndex++;
          render(false);
        }
      } else if (str === '\r' || str === '\n') { // Enter
        cleanup();
        const selectedItem = items[selectedIndex];
        resolve(selectedItem ? selectedItem.value : null);
      } else if (str === '\u001b' || str === '\u0003') { // Escape or Ctrl+C
        cleanup();
        resolve(null);
      }
      // Ignore other keys
    };

    const cleanup = () => {
      process.stdin.removeListener('data', onData);
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(wasRaw ?? false);
      }
      // Don't pause - let the calling code handle stdin
      process.stdin.resume();
    };

    process.stdin.on('data', onData);
  });
}

/**
 * Model selection helper with provider grouping.
 * Only includes models from configured/available providers.
 */
export async function selectModelInteractive(
  models: Array<{ provider: string; model: string; description?: string; configured?: boolean }>
): Promise<string | null> {
  const items: SelectItem[] = [];

  // Group by provider for better organization
  const providers = new Map<string, Array<{ model: string; description?: string }>>();

  for (const m of models) {
    if (!providers.has(m.provider)) {
      providers.set(m.provider, []);
    }
    providers.get(m.provider)!.push({ model: m.model, description: m.description });
  }

  // Create items with provider headers
  for (const [provider, providerModels] of providers) {
    // Provider header
    items.push({
      label: `${provider.toUpperCase()}`,
      value: `provider:${provider}`,
      description: `${providerModels.length} models`,
    });

    // Models under provider
    for (const pm of providerModels) {
      items.push({
        label: `  ${pm.model}`,
        value: `${provider}/${pm.model}`,
        description: pm.description,
      });
    }

    // Separator
    items.push({
      label: '\u2500'.repeat(40),
      value: 'separator',
      description: '',
    });
  }

  // Remove last separator if it exists
  if (items.length > 0 && items[items.length - 1].value === 'separator') {
    items.pop();
  }

  return selectInteractive(items, 'Select Model');
}

/**
 * Skill selection helper
 */
export async function selectSkillInteractive(
  skills: Array<{ name: string; description: string }>
): Promise<string | null> {
  const items: SelectItem[] = skills.map(skill => ({
    label: skill.name,
    value: skill.name,
    description: skill.description.length > 50 ? skill.description.substring(0, 47) + '...' : skill.description,
  }));

  return selectInteractive(items, 'Select Skill');
}
