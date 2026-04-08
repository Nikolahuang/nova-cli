import fs from 'node:fs/promises';
import path from 'node:path';
import type { ToolHandler, ToolHandlerInput, ToolHandlerOutput } from '../../types/tools.js';
import { ToolError } from '../../types/errors.js';
import { FileFilter } from '../../security/FileFilter.js';

export const editFileHandler: ToolHandler = async (input: ToolHandlerInput): Promise<ToolHandlerOutput> => {
  const { filePath, oldText, newText, allOccurrences = false, dryRun = false, allowExternalAccess = false, additionalAllowedPaths = [] } = input.params as {
    filePath: string;
    oldText: string;
    newText: string;
    allOccurrences?: boolean;
    dryRun?: boolean;
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
      throw new ToolError(`File access denied: ${accessCheck.reason}`, 'edit_file');
    }
  }

  const resolvedPath = path.resolve(filePath);

  try {
    const content = await fs.readFile(resolvedPath, 'utf-8');

    // Check if oldText exists
    if (!content.includes(oldText)) {
      throw new ToolError(
        `The specified text was not found in the file. Make sure oldText matches exactly (including whitespace).`,
        'edit_file'
      );
    }

    // Count occurrences
    const occurrences = content.split(oldText).length - 1;

    if (occurrences > 1 && !allOccurrences) {
      throw new ToolError(
        `The text appears ${occurrences} times in the file. Set allOccurrences=true to replace all, or make oldText more specific to match only once.`,
        'edit_file',
        undefined,
        { occurrences }
      );
    }

    let newContent: string;
    if (allOccurrences) {
      newContent = content.split(oldText).join(newText);
    } else {
      newContent = content.replace(oldText, newText);
    }

    if (dryRun) {
      // Show a unified diff-like preview
      const oldLines = content.split('\n');
      const newLines = newContent.split('\n');
      const preview = generateDiffPreview(oldLines, newLines);
      return {
        content: `Dry run preview for ${resolvedPath}:\n${preview}\n\n${occurrences} occurrence(s) would be replaced.${allowExternalAccess ? '' : '\n\nNote: External file access is disabled by default for security.'}`,
        metadata: { dryRun: true, occurrences, path: resolvedPath, allowExternalAccess, additionalAllowedPaths },
      };
    }

    await fs.writeFile(resolvedPath, newContent, 'utf-8');

return {
    content: `Successfully replaced ${occurrences} occurrence(s) in ${resolvedPath}${allowExternalAccess ? '' : '\n\nNote: External file access is disabled by default for security.'}`,
    metadata: {
      path: resolvedPath,
      occurrences,
      oldSize: Buffer.byteLength(content, 'utf-8'),
      newSize: Buffer.byteLength(newContent, 'utf-8'),
      allowExternalAccess,
      additionalAllowedPaths,
    },
    filesAffected: [resolvedPath],
  };
  } catch (err) {
    if (err instanceof ToolError) throw err;
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      throw new ToolError(`File not found: ${filePath}`, 'edit_file', undefined, { code });
    }
    throw new ToolError(`Failed to edit file: ${(err as Error).message}`, 'edit_file');
  }
};

function generateDiffPreview(oldLines: string[], newLines: string[]): string {
  const result: string[] = [];
  const maxLines = Math.max(oldLines.length, newLines.length);
  let shown = 0;

  for (let i = 0; i < maxLines && shown < 20; i++) {
    const oldLine = oldLines[i];
    const newLine = newLines[i];
    if (oldLine === newLine) continue;
    if (oldLine !== undefined) result.push(`- ${oldLine}`);
    if (newLine !== undefined) result.push(`+ ${newLine}`);
    shown++;
  }

  if (shown >= 20) result.push('... (truncated)');

  return result.join('\n');
}
