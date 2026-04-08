import { glob } from 'glob';
import path from 'node:path';
import type { ToolHandler, ToolHandlerInput, ToolHandlerOutput } from '../../types/tools.js';
import { ToolError } from '../../types/errors.js';
import { FileFilter } from '../../security/FileFilter.js';

export const searchFileHandler: ToolHandler = async (input: ToolHandlerInput): Promise<ToolHandlerOutput> => {
  const { pattern, directory, recursive = true, caseSensitive = false, excludePatterns, allowExternalAccess = false, additionalAllowedPaths = [] } = input.params as {
    pattern: string;
    directory: string;
    recursive?: boolean;
    caseSensitive?: boolean;
    excludePatterns?: string[];
    allowExternalAccess?: boolean;
    additionalAllowedPaths?: string[];
  };

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
      throw new ToolError(`Directory access denied: ${accessCheck.reason}`, 'search_file');
    }
  }

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
        content: `No files matching "${pattern}" found in ${resolvedDir}${allowExternalAccess ? '' : '\n\nNote: External file access is disabled by default for security.'}`,
        metadata: { pattern, directory: resolvedDir, count: 0, allowExternalAccess, additionalAllowedPaths },
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
        allowExternalAccess,
        additionalAllowedPaths,
      },
    };
  } catch (err) {
    throw new ToolError(`Failed to search files: ${(err as Error).message}`, 'search_file');
  }
};
