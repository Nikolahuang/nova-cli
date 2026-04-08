import { glob } from 'glob';
import path from 'node:path';
import type { ToolHandler, ToolHandlerInput, ToolHandlerOutput } from '../../types/tools.js';
import { ToolError } from '../../types/errors.js';
import { FileFilter } from '../../security/FileFilter.js';

/**
 * Glob tool handler - search files using glob patterns with more options than search_file.
 * Supports absolute paths, dotfiles, and custom ignore patterns.
 */
export const globHandler: ToolHandler = async (input: ToolHandlerInput): Promise<ToolHandlerOutput> => {
  const { pattern, directory, ignore, absolute = false, dot = false, allowExternalAccess = false, additionalAllowedPaths = [] } = input.params as {
    pattern: string;
    directory: string;
    ignore?: string[];
    absolute?: boolean;
    dot?: boolean;
    allowExternalAccess?: boolean;
    additionalAllowedPaths?: string[];
  };

  if (!pattern || !directory) {
    throw new ToolError('Both "pattern" and "directory" are required', 'glob');
  }

  // Create a temporary FileFilter to validate directory access if external access is not allowed
  let fileFilter: FileFilter | undefined;
  if (!allowExternalAccess) {
    fileFilter = new FileFilter({
      ignorePatterns: ['node_modules/**', '.git/**', 'dist/**', 'build/**', '*.log', '.env', '.env.local'],
      workingDirectory: process.cwd(),
      maxFileSize: 10 * 1024 * 1024,
      maxBatchSize: 100,
      allowExternalAccess: allowExternalAccess,
      additionalAllowedPaths: additionalAllowedPaths,
    });
    
    const accessCheck = fileFilter.isAllowed(directory);
    if (!accessCheck.allowed) {
      throw new ToolError(`Directory access denied: ${accessCheck.reason}`, 'glob');
    }
  }

  const resolvedDir = path.resolve(directory);

  try {
    const defaultIgnore = [
      'node_modules/**',
      '.git/**',
      'dist/**',
      'build/**',
      '*.log',
    ];

    const files = await glob(pattern, {
      cwd: resolvedDir,
      ignore: ignore || defaultIgnore,
      absolute: absolute || false,
      dot: dot || false,
      nodir: false,  // include directories too (unlike search_file which is nodir: true)
      windowsPathsNoEscape: true,
    });

    if (files.length === 0) {
      return {
        content: `No files matching "${pattern}" found in ${resolvedDir}${allowExternalAccess ? '' : '\n\nNote: External file access is disabled by default for security.'}`,
        metadata: { pattern, directory: resolvedDir, count: 0, allowExternalAccess, additionalAllowedPaths },
      };
    }

    const output = files
      .sort()
      .map((f) => absolute ? f : path.relative(resolvedDir, f))
      .join('\n');

    return {
      content: output,
      metadata: {
        pattern,
        directory: resolvedDir,
        count: files.length,
        matches: files,
        allowExternalAccess,
        additionalAllowedPaths,
      },
    };
  } catch (err) {
    throw new ToolError(`Glob pattern failed: ${(err as Error).message}`, 'glob');
  }
};
