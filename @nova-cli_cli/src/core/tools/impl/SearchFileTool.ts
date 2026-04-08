import { glob } from 'glob';
import path from 'node:path';
import type { ToolHandler, ToolHandlerInput, ToolHandlerOutput } from '../../types/tools.js';
import { ToolError } from '../../types/errors.js';

export const searchFileHandler: ToolHandler = async (input: ToolHandlerInput): Promise<ToolHandlerOutput> => {
  const { pattern, directory, recursive = true, caseSensitive = false, excludePatterns } = input.params as {
    pattern: string;
    directory: string;
    recursive?: boolean;
    caseSensitive?: boolean;
    excludePatterns?: string[];
  };

  const resolvedDir = path.resolve(directory);

  try {
    const globPattern = recursive ? `**/${pattern}` : pattern;
    
    const ignore = excludePatterns || [
      'node_modules/**',
      '.git/**',
      'dist/**',
      'build/**',
      '*.log',
    ];

    const files = await glob(globPattern, {
      cwd: resolvedDir,
      ignore,
      absolute: true,
      nocase: !caseSensitive,
      nodir: true,
      windowsPathsNoEscape: true,
    });

    if (files.length === 0) {
      return {
        content: `No files matching "${pattern}" found in ${resolvedDir}`,
        metadata: { pattern, directory: resolvedDir, count: 0 },
      };
    }

    const output = files
      .sort()
      .map((f) => path.relative(resolvedDir, f))
      .join('\n');

    return {
      content: output,
      metadata: {
        pattern,
        directory: resolvedDir,
        count: files.length,
        matches: files,
      },
    };
  } catch (err) {
    throw new ToolError(`Failed to search files: ${(err as Error).message}`, 'search_file');
  }
};
