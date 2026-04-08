// ============================================================================
// ApplyPatchTool - Apply unified diff patches to files
// More robust than simple text replacement for complex changes
// ============================================================================

import type { ToolHandler, ToolHandlerInput, ToolHandlerOutput } from '../../types/tools.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export interface ApplyPatchInput {
  filePath: string;
  patch: string;
  dryRun?: boolean;
}

export interface PatchResult {
  success: boolean;
  applied: boolean;
  hunksApplied: number;
  hunksTotal: number;
  rejectedHunks: Array<{
    header: string;
    reason: string;
  }>;
  error?: string;
}

interface Hunk {
  header: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: string[];
}

export const applyPatchHandler: ToolHandler = async (input: ToolHandlerInput): Promise<ToolHandlerOutput> => {
  const params = input.params as unknown as ApplyPatchInput;
  const { filePath, patch, dryRun = false } = params;

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

    // Parse the patch
    const hunks = parsePatch(patch);
    if (hunks.length === 0) {
      return {
        content: JSON.stringify({
          success: false,
          error: 'No valid hunks found in patch',
        }),
      };
    }

    // Apply each hunk
    const lines = content.split('\n');
    const rejectedHunks: Array<{ header: string; reason: string }> = [];
    let hunksApplied = 0;
    let lineOffset = 0;

    for (const hunk of hunks) {
      const result = applyHunk(lines, hunk, lineOffset);
      if (result.success) {
        lineOffset += result.lineDelta;
        hunksApplied++;
      } else {
        rejectedHunks.push({
          header: hunk.header,
          reason: result.error || 'Context mismatch',
        });
      }
    }

    // If dry run, don't write changes
    if (dryRun) {
      return {
        content: JSON.stringify({
          success: true,
          applied: false,
          dryRun: true,
          hunksApplied,
          hunksTotal: hunks.length,
          rejectedHunks,
        }),
      };
    }

    // Check if any hunks were applied
    if (hunksApplied === 0) {
      return {
        content: JSON.stringify({
          success: false,
          applied: false,
          hunksApplied: 0,
          hunksTotal: hunks.length,
          rejectedHunks,
          error: 'No hunks could be applied',
        }),
      };
    }

    // Write the modified content
    const newContent = lines.join('\n');
    await fs.writeFile(absolutePath, newContent, 'utf-8');

    return {
      content: JSON.stringify({
        success: true,
        applied: true,
        hunksApplied,
        hunksTotal: hunks.length,
        rejectedHunks,
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

function parsePatch(patch: string): Hunk[] {
  const hunks: Hunk[] = [];
  const lines = patch.split('\n');
  let currentHunk: Hunk | null = null;
  let inHunk = false;

  for (const line of lines) {
    // Hunk header: @@ -oldStart,oldLines +newStart,newLines @@
    const hunkMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
    if (hunkMatch) {
      if (currentHunk) {
        hunks.push(currentHunk);
      }
      currentHunk = {
        header: line,
        oldStart: parseInt(hunkMatch[1], 10),
        oldLines: hunkMatch[2] ? parseInt(hunkMatch[2], 10) : 1,
        newStart: parseInt(hunkMatch[3], 10),
        newLines: hunkMatch[4] ? parseInt(hunkMatch[4], 10) : 1,
        lines: [],
      };
      inHunk = true;
      continue;
    }

    // Collect hunk lines
    if (inHunk && currentHunk) {
      // Stop at next hunk or end of patch
      if (line.startsWith('@@') || line.startsWith('diff --git') || line.startsWith('---') || line.startsWith('+++')) {
        hunks.push(currentHunk);
        currentHunk = null;
        inHunk = false;
        // Re-process this line in case it's another hunk
        if (line.startsWith('@@')) {
          const reMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
          if (reMatch) {
            currentHunk = {
              header: line,
              oldStart: parseInt(reMatch[1], 10),
              oldLines: reMatch[2] ? parseInt(reMatch[2], 10) : 1,
              newStart: parseInt(reMatch[3], 10),
              newLines: reMatch[4] ? parseInt(reMatch[4], 10) : 1,
              lines: [],
            };
            inHunk = true;
          }
        }
      } else {
        currentHunk.lines.push(line);
      }
    }
  }

  if (currentHunk) {
    hunks.push(currentHunk);
  }

  return hunks;
}

function applyHunk(
  lines: string[],
  hunk: Hunk,
  offset: number
): { success: boolean; lineDelta: number; error?: string } {
  // Find the context in the file
  const contextLines: string[] = [];
  const newLines: string[] = [];
  let oldLineCount = 0;

  for (const line of hunk.lines) {
    if (line.startsWith(' ')) {
      // Context line
      contextLines.push(line.slice(1));
      newLines.push(line.slice(1));
      oldLineCount++;
    } else if (line.startsWith('-')) {
      // Removed line
      contextLines.push(line.slice(1));
      oldLineCount++;
    } else if (line.startsWith('+')) {
      // Added line
      newLines.push(line.slice(1));
    } else if (line === '') {
      // Empty line (could be context)
      contextLines.push('');
      newLines.push('');
      oldLineCount++;
    }
  }

  // Search for the context in the file
  const startLine = hunk.oldStart - 1 + offset; // 0-based
  const searchRange = 20; // Search ±20 lines for context
  let matchIndex = -1;

  for (let i = Math.max(0, startLine - searchRange); i < Math.min(lines.length, startLine + searchRange); i++) {
    let matches = true;
    for (let j = 0; j < contextLines.length && matches; j++) {
      if (i + j >= lines.length) {
        matches = false;
      } else {
        const fileLine = lines[i + j].trimEnd();
        const patchLine = contextLines[j].trimEnd();
        if (fileLine !== patchLine) {
          matches = false;
        }
      }
    }
    if (matches) {
      matchIndex = i;
      break;
    }
  }

  if (matchIndex === -1) {
    return {
      success: false,
      lineDelta: 0,
      error: `Could not find context for hunk starting at line ${hunk.oldStart}`,
    };
  }

  // Apply the hunk
  lines.splice(matchIndex, oldLineCount, ...newLines);

  return {
    success: true,
    lineDelta: newLines.length - oldLineCount,
  };
}

export default applyPatchHandler;
