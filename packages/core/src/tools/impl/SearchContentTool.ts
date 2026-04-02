import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import type { ToolHandler, ToolHandlerInput, ToolHandlerOutput } from '../../types/tools.js';
import { ToolError } from '../../types/errors.js';

const execFileAsync = promisify(execFile);

export const searchContentHandler: ToolHandler = async (input: ToolHandlerInput): Promise<ToolHandlerOutput> => {
  const {
    pattern,
    directory,
    filePattern,
    caseSensitive = false,
    includeHidden = false,
    maxResults = 50,
    contextBefore = 0,
    contextAfter = 0,
    multiline = false,
  } = input.params as {
    pattern: string;
    directory: string;
    filePattern?: string;
    caseSensitive?: boolean;
    includeHidden?: boolean;
    maxResults?: number;
    contextBefore?: number;
    contextAfter?: number;
    multiline?: boolean;
  };

  const resolvedDir = path.resolve(directory);

  try {
    // Validate regex
    new RegExp(pattern);

    const args: string[] = [
      '--no-heading',
      '--color', 'never',
      '--max-count', String(maxResults),
      '-C', String(Math.max(contextBefore, contextAfter)),
    ];

    if (!caseSensitive) args.push('-i');
    if (includeHidden) args.push('--hidden');
    if (multiline) args.push('-U', '--multiline-dotall');
    if (filePattern) args.push('--glob', filePattern);

    // Add common ignores
    const ignoreArgs = ['--glob', '!node_modules/**', '--glob', '!.git/**', '--glob', '!dist/**', '--glob', '!build/**'];
    args.push(...ignoreArgs);

    args.push('--', pattern, resolvedDir);

    const { stdout, stderr } = await execFileAsync('rg', args, {
      timeout: 15000,
      maxBuffer: 10 * 1024 * 1024, // 10MB
    });

    if (!stdout.trim()) {
      return {
        content: `No matches found for pattern "${pattern}" in ${resolvedDir}`,
        metadata: { pattern, directory: resolvedDir, count: 0 },
      };
    }

    return {
      content: stdout.trim(),
      metadata: {
        pattern,
        directory: resolvedDir,
        tool: 'ripgrep',
        options: { caseSensitive, includeHidden, maxResults, contextBefore, contextAfter, multiline },
      },
    };
  } catch (err) {
    const error = err as { code?: string; message: string };
    if (error.code === 'ENOENT') {
      throw new ToolError(
        'ripgrep (rg) not found. Please install it: https://github.com/BurntSushi/ripgrep',
        'search_content'
      );
    }
    if (error.code && (error.code === '1' || error.code === '2' || Number(error.code) === 1)) {
      // ripgrep returns 1 when no matches found, 2 for errors (not an error for our purposes)
      return {
        content: `No matches found for pattern "${pattern}" in ${resolvedDir}`,
        metadata: { pattern, directory: resolvedDir, count: 0 },
      };
    }
    throw new ToolError(`Failed to search content: ${error.message}`, 'search_content');
  }
};
