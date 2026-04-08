// ============================================================================
// MultieditTool - Edit multiple locations in a file in one operation
// More efficient than multiple edit_file calls
// ============================================================================

import type { ToolHandler, ToolHandlerInput, ToolHandlerOutput } from '../../types/tools.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export interface MultieditInput {
  filePath: string;
  edits: Array<{
    oldText: string;
    newText: string;
    replaceAll?: boolean;
  }>;
  dryRun?: boolean;
}

export interface MultieditResult {
  success: boolean;
  appliedEdits: number;
  totalEdits: number;
  failedEdits: Array<{
    index: number;
    oldText: string;
    reason: string;
  }>;
  diff?: string;
  error?: string;
}

export const multieditHandler: ToolHandler = async (input: ToolHandlerInput): Promise<ToolHandlerOutput> => {
  const params = input.params as unknown as MultieditInput;
  const { filePath, edits, dryRun = false } = params;

  try {
    // Resolve absolute path
    const absolutePath = path.isAbsolute(filePath) 
      ? filePath 
      : path.resolve((input as any).workingDirectory || process.cwd(), filePath);

    // Read current file content
    let content: string;
    try {
      content = await fs.readFile(absolutePath, 'utf-8');
    } catch {
      return {
        content: JSON.stringify({
          success: false,
          error: `File not found: ${absolutePath}`,
        }),
      };
    }

    const originalContent = content;
    const failedEdits: Array<{ index: number; oldText: string; reason: string }> = [];
    let appliedEdits = 0;

    // Apply each edit in sequence
    for (let i = 0; i < edits.length; i++) {
      const edit = edits[i];
      const { oldText, newText, replaceAll = false } = edit;

      if (oldText === newText) {
        failedEdits.push({
          index: i,
          oldText: oldText.slice(0, 50),
          reason: 'oldText and newText are identical',
        });
        continue;
      }

      // Check if oldText exists in content
      if (!content.includes(oldText)) {
        // Try fuzzy matching
        const fuzzyResult = fuzzyMatch(content, oldText);
        if (fuzzyResult) {
          // Use fuzzy match
          content = content.replace(fuzzyResult, newText);
          appliedEdits++;
          continue;
        }

        failedEdits.push({
          index: i,
          oldText: oldText.slice(0, 50),
          reason: 'oldText not found in file',
        });
        continue;
      }

      // Apply the replacement
      if (replaceAll) {
        const count = (content.match(escapeRegExp(oldText)) || []).length;
        content = content.split(oldText).join(newText);
        appliedEdits++;
      } else {
        // Check for multiple occurrences
        const count = (content.match(escapeRegExp(oldText)) || []).length;
        if (count > 1) {
          // Find the best match (most context)
          const bestMatch = findBestMatch(content, oldText);
          if (bestMatch) {
            content = content.replace(bestMatch, newText);
            appliedEdits++;
          } else {
            failedEdits.push({
              index: i,
              oldText: oldText.slice(0, 50),
              reason: `Found ${count} occurrences; use replaceAll or provide more context`,
            });
          }
        } else {
          content = content.replace(oldText, newText);
          appliedEdits++;
        }
      }
    }

    // Generate diff
    const diff = generateDiff(originalContent, content, path.basename(absolutePath));

    // If dry run, don't write changes
    if (dryRun) {
      return {
        content: JSON.stringify({
          success: true,
          applied: false,
          dryRun: true,
          appliedEdits,
          totalEdits: edits.length,
          failedEdits,
          diff,
        }),
      };
    }

    // Write the modified content
    await fs.writeFile(absolutePath, content, 'utf-8');

    return {
      content: JSON.stringify({
        success: true,
        applied: true,
        appliedEdits,
        totalEdits: edits.length,
        failedEdits,
        diff,
      }),
    };
  } catch (error) {
    return {
      content: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
    };
  }
};

function escapeRegExp(str: string): RegExp {
  return new RegExp(str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
}

function fuzzyMatch(content: string, search: string): string | null {
  // Try different fuzzy strategies
  // 1. Ignore whitespace differences
  const normalizedContent = content.replace(/\s+/g, ' ');
  const normalizedSearch = search.replace(/\s+/g, ' ');
  
  if (normalizedContent.includes(normalizedSearch)) {
    // Find the original match
    const regex = new RegExp(search.replace(/\s+/g, '\\s+'), 's');
    const match = content.match(regex);
    if (match) {
      return match[0];
    }
  }

  // 2. Try line-by-line matching
  const searchLines = search.split('\n');
  const contentLines = content.split('\n');
  
  for (let i = 0; i <= contentLines.length - searchLines.length; i++) {
    let matches = true;
    for (let j = 0; j < searchLines.length; j++) {
      if (contentLines[i + j].trim() !== searchLines[j].trim()) {
        matches = false;
        break;
      }
    }
    if (matches) {
      return contentLines.slice(i, i + searchLines.length).join('\n');
    }
  }

  return null;
}

function findBestMatch(content: string, search: string): string | null {
  // For now, just return the first match
  // In the future, could consider context (surrounding lines)
  const index = content.indexOf(search);
  if (index === -1) return null;
  return search;
}

function generateDiff(oldContent: string, newContent: string, filename: string): string {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');
  const diff: string[] = [];
  
  diff.push(`--- a/${filename}`);
  diff.push(`+++ b/${filename}`);
  
  // Simple line-by-line diff
  let oldLine = 1;
  let newLine = 1;
  const hunks: Array<{ oldStart: number; newStart: number; lines: string[] }> = [];
  let currentHunk: { oldStart: number; newStart: number; lines: string[] } | null = null;
  
  const maxLines = Math.max(oldLines.length, newLines.length);
  
  for (let i = 0; i < maxLines; i++) {
    const oldLineContent = oldLines[i] || '';
    const newLineContent = newLines[i] || '';
    
    if (oldLineContent !== newLineContent) {
      if (!currentHunk) {
        currentHunk = {
          oldStart: oldLine,
          newStart: newLine,
          lines: [],
        };
      }
      
      if (i < oldLines.length) {
        currentHunk.lines.push(`-${oldLineContent}`);
      }
      if (i < newLines.length) {
        currentHunk.lines.push(`+${newLineContent}`);
      }
    } else {
      if (currentHunk) {
        currentHunk.lines.push(` ${oldLineContent}`);
        if (currentHunk.lines.length > 10) {
          hunks.push(currentHunk);
          currentHunk = null;
        }
      }
    }
    
    if (i < oldLines.length) oldLine++;
    if (i < newLines.length) newLine++;
  }
  
  if (currentHunk) {
    hunks.push(currentHunk);
  }
  
  for (const hunk of hunks) {
    diff.push(`@@ -${hunk.oldStart},${hunk.lines.filter(l => l.startsWith('-') || l.startsWith(' ')).length} +${hunk.newStart},${hunk.lines.filter(l => l.startsWith('+') || l.startsWith(' ')).length} @@`);
    diff.push(...hunk.lines);
  }
  
  return diff.join('\n');
}

export default multieditHandler;
