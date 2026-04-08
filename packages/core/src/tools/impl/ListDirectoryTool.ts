import fs from 'node:fs/promises';
import path from 'node:path';
import type { ToolHandler, ToolHandlerInput, ToolHandlerOutput } from '../../types/tools.js';
import { ToolError } from '../../types/errors.js';
import { FileFilter } from '../../security/FileFilter.js';

/** Maximum entries to return before truncating with guidance */
const MAX_ENTRIES = 500;

export const listDirectoryHandler: ToolHandler = async (input: ToolHandlerInput): Promise<ToolHandlerOutput> => {
  const { dirPath, recursive = false, includeHidden = false, pattern, depth, limit, allowExternalAccess = false, additionalAllowedPaths = [] } = input.params as {
    dirPath: string;
    recursive?: boolean;
    includeHidden?: boolean;
    pattern?: string;
    depth?: number;
    limit?: number;
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
    
    const accessCheck = fileFilter.isAllowed(dirPath);
    if (!accessCheck.allowed) {
      throw new ToolError(`Directory access denied: ${accessCheck.reason}`, 'list_directory');
    }
  }

  const resolvedPath = path.resolve(dirPath);
  const maxEntries = limit || MAX_ENTRIES;

  try {
    const stat = await fs.stat(resolvedPath);
    if (!stat.isDirectory()) {
      throw new ToolError(`Path is not a directory: ${dirPath}`, 'list_directory', undefined, { 
        code: 'NOT_DIRECTORY',
        suggestion: `Use read_file to read a file, or specify a directory path.`
      });
    }

    const entries: Array<{ name: string; path: string; isDirectory: boolean; size: number }> = [];
    let totalFound = 0;
    let truncated = false;

    async function walk(currentDir: string, currentDepth: number): Promise<void> {
      if (depth !== undefined && currentDepth > depth) return;

      const items = await fs.readdir(currentDir, { withFileTypes: true });

      for (const item of items) {
        if (!includeHidden && item.name.startsWith('.')) continue;

        if (pattern && !matchGlob(item.name, pattern)) continue;

        totalFound++;

        if (entries.length >= maxEntries) {
          truncated = true;
          continue; // Keep counting but don't add more entries
        }

        const fullPath = path.join(currentDir, item.name);
        let size = 0;

        if (item.isFile()) {
          try {
            const itemStat = await fs.stat(fullPath);
            size = itemStat.size;
          } catch {
            // Skip files we can't stat
          }
        }

        entries.push({
          name: item.name,
          path: fullPath,
          isDirectory: item.isDirectory(),
          size,
        });

        if (recursive && item.isDirectory()) {
          await walk(fullPath, currentDepth + 1);
        }
      }
    }

    await walk(resolvedPath, 0);

    const output = entries
      .map((entry) => {
        const type = entry.isDirectory ? 'DIR ' : 'FILE';
        const sizeStr = entry.isDirectory ? '        ' : String(entry.size).padStart(8);
        return `${type} ${sizeStr}  ${entry.path}`;
      })
      .join('\n');

    const dirCount = entries.filter((e) => e.isDirectory).length;
    const fileCount = entries.length - dirCount;

    // Build content with truncation guidance
    let content = output;
    
    if (truncated) {
      content += `\n\n[TRUNCATED: Showing ${entries.length} of ${totalFound} items.]`;
      content += `\n[To see more, use one of these approaches:]`;
      content += `\n  • Use pattern filter: list_directory with pattern="*.ts"`;
      content += `\n  • Increase limit: list_directory with limit=1000`;
      content += `\n  • Use non-recursive: list_directory with recursive=false`;
      content += `\n  • Search specific files: search_file with pattern="**/*.ts"`;
    } else {
      content += `\n\n${entries.length} item(s): ${fileCount} file(s), ${dirCount} director${dirCount === 1 ? 'y' : 'ies'}`;
    }

    return {
      content,
      metadata: {
        path: resolvedPath,
        totalEntries: entries.length,
        totalFound: totalFound,
        truncated,
        files: fileCount,
        directories: dirCount,
        suggestion: truncated ? 'Use pattern, limit, or non-recursive mode to narrow results' : undefined,
        allowExternalAccess,
        additionalAllowedPaths,
      },
    };
  } catch (err) {
    if (err instanceof ToolError) throw err;
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      throw new ToolError(`Directory not found: ${dirPath}`, 'list_directory', undefined, { 
        code,
        suggestion: `Check the path exists. Use list_directory "." to see current directory.`
      });
    }
    if (code === 'EACCES') {
      throw new ToolError(`Permission denied: ${dirPath}`, 'list_directory', undefined, { 
        code,
        suggestion: `Check directory permissions or try a different path.`
      });
    }
    throw new ToolError(`Failed to list directory: ${(err as Error).message}`, 'list_directory');
  }
};

function matchGlob(name: string, pattern: string): boolean {
  // Simple glob matching: * matches any chars, ? matches single char
  const regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${regexStr}$`, 'i').test(name);
}
