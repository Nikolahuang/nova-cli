import fs from 'node:fs/promises';
import path from 'node:path';
import type { ToolHandler, ToolHandlerInput, ToolHandlerOutput } from '../../types/tools.js';
import { ToolError } from '../../types/errors.js';
import { FileFilter } from '../../security/FileFilter.js';

export const writeFileHandler: ToolHandler = async (input: ToolHandlerInput): Promise<ToolHandlerOutput> => {
  const { filePath, content, createDirectories = false, encoding = 'utf-8', allowExternalAccess = false, additionalAllowedPaths = [] } = input.params as {
    filePath: string;
    content: string;
    createDirectories?: boolean;
    encoding?: BufferEncoding;
    allowExternalAccess?: boolean;
    additionalAllowedPaths?: string[];
  };

  // Create a temporary FileFilter to validate file access if external access is not allowed
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
    
    const accessCheck = fileFilter.isAllowed(filePath);
    if (!accessCheck.allowed) {
      throw new ToolError(`File access denied: ${accessCheck.reason}`, 'write_file');
    }
  }

  const resolvedPath = path.resolve(filePath);

  try {
    if (createDirectories) {
      const dir = path.dirname(resolvedPath);
      await fs.mkdir(dir, { recursive: true });
    }

    // Verify parent directory exists
    const dir = path.dirname(resolvedPath);
    try {
      await fs.access(dir, fs.constants.W_OK);
    } catch {
      throw new ToolError(`Cannot write to directory: ${dir}`, 'write_file');
    }

    await fs.writeFile(resolvedPath, content, { encoding });

return {
    content: `Successfully wrote ${content.length} characters to ${resolvedPath}`,
    metadata: {
      path: resolvedPath,
      size: Buffer.byteLength(content, encoding),
      encoding,
      allowExternalAccess,
      additionalAllowedPaths,
    },
    filesAffected: [resolvedPath],
  };
  } catch (err) {
    if (err instanceof ToolError) throw err;
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'EACCES') {
      throw new ToolError(`Permission denied: ${filePath}`, 'write_file', undefined, { code });
    }
    throw new ToolError(`Failed to write file: ${(err as Error).message}`, 'write_file');
  }
};
