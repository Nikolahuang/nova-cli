// ============================================================================
// TruncateTool - Intelligent output truncation for large tool results
// Saves truncated content to disk and provides retrieval hints
// ============================================================================

import type { ToolHandler, ToolHandlerInput, ToolHandlerOutput } from '../../types/tools.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

export interface TruncateInput {
  content: string;
  maxLines?: number;
  maxBytes?: number;
  direction?: 'head' | 'tail' | 'middle';
  outputPath?: string;
}

export interface TruncateResult {
  success: boolean;
  truncated: boolean;
  content: string;
  originalSize: number;
  truncatedSize: number;
  savedTo?: string;
  hint?: string;
}

const DEFAULT_MAX_LINES = 500;
const DEFAULT_MAX_BYTES = 50000;
const TRUNCATION_DIR = path.join(os.homedir(), '.nova', 'truncation');

export const truncateHandler: ToolHandler = async (input: ToolHandlerInput): Promise<ToolHandlerOutput> => {
  const params = input.params as unknown as TruncateInput;
  const {
    content,
    maxLines = DEFAULT_MAX_LINES,
    maxBytes = DEFAULT_MAX_BYTES,
    direction = 'head',
    outputPath,
  } = params;

  try {
    const totalBytes = Buffer.byteLength(content, 'utf-8');
    const lines = content.split('\n');

    // Check if truncation is needed
    if (lines.length <= maxLines && totalBytes <= maxBytes) {
      return {
        content: JSON.stringify({
          success: true,
          truncated: false,
          content,
          originalSize: totalBytes,
          truncatedSize: totalBytes,
        }),
      };
    }

    // Perform truncation
    let truncatedContent: string;
    let removedCount: number;
    let unit: string;

    if (direction === 'head') {
      // Keep the beginning
      const result = truncateHead(lines, maxLines, maxBytes);
      truncatedContent = result.content;
      removedCount = result.removed;
      unit = 'lines';
    } else if (direction === 'tail') {
      // Keep the end
      const result = truncateTail(lines, maxLines, maxBytes);
      truncatedContent = result.content;
      removedCount = result.removed;
      unit = 'lines';
    } else {
      // Keep both ends, remove middle
      const result = truncateMiddle(lines, maxLines, maxBytes);
      truncatedContent = result.content;
      removedCount = result.removed;
      unit = 'lines';
    }

    // Save full content to disk
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).slice(2, 8);
    const savedPath = outputPath || path.join(TRUNCATION_DIR, `truncated-${timestamp}-${randomId}.txt`);

    await fs.mkdir(path.dirname(savedPath), { recursive: true });
    await fs.writeFile(savedPath, content, 'utf-8');

    // Clean up old truncation files (keep last 100)
    await cleanupOldFiles(TRUNCATION_DIR, 100);

    const truncatedSize = Buffer.byteLength(truncatedContent, 'utf-8');
    const hint = generateHint(savedPath, removedCount, unit, direction);

    return {
      content: JSON.stringify({
        success: true,
        truncated: true,
        content: truncatedContent,
        originalSize: totalBytes,
        truncatedSize,
        savedTo: savedPath,
        hint,
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

function truncateHead(
  lines: string[],
  maxLines: number,
  maxBytes: number
): { content: string; removed: number } {
  const out: string[] = [];
  let bytes = 0;
  let hitBytes = false;

  for (let i = 0; i < lines.length && i < maxLines; i++) {
    const lineBytes = Buffer.byteLength(lines[i], 'utf-8') + 1; // +1 for newline
    if (bytes + lineBytes > maxBytes) {
      hitBytes = true;
      break;
    }
    out.push(lines[i]);
    bytes += lineBytes;
  }

  const removed = hitBytes 
    ? lines.length - out.length 
    : lines.length - maxLines;

  return {
    content: out.join('\n'),
    removed,
  };
}

function truncateTail(
  lines: string[],
  maxLines: number,
  maxBytes: number
): { content: string; removed: number } {
  const out: string[] = [];
  let bytes = 0;
  let hitBytes = false;

  for (let i = lines.length - 1; i >= 0 && out.length < maxLines; i--) {
    const lineBytes = Buffer.byteLength(lines[i], 'utf-8') + 1;
    if (bytes + lineBytes > maxBytes) {
      hitBytes = true;
      break;
    }
    out.unshift(lines[i]);
    bytes += lineBytes;
  }

  const removed = hitBytes
    ? lines.length - out.length
    : lines.length - maxLines;

  return {
    content: out.join('\n'),
    removed,
  };
}

function truncateMiddle(
  lines: string[],
  maxLines: number,
  maxBytes: number
): { content: string; removed: number } {
  const headLines = Math.floor(maxLines / 2);
  const tailLines = maxLines - headLines;

  const head: string[] = [];
  const tail: string[] = [];
  let headBytes = 0;
  let tailBytes = 0;

  // Collect head
  for (let i = 0; i < lines.length && head.length < headLines; i++) {
    const lineBytes = Buffer.byteLength(lines[i], 'utf-8') + 1;
    if (headBytes + lineBytes > maxBytes / 2) break;
    head.push(lines[i]);
    headBytes += lineBytes;
  }

  // Collect tail
  for (let i = lines.length - 1; i >= 0 && tail.length < tailLines; i--) {
    const lineBytes = Buffer.byteLength(lines[i], 'utf-8') + 1;
    if (tailBytes + lineBytes > maxBytes / 2) break;
    tail.unshift(lines[i]);
    tailBytes += lineBytes;
  }

  const removed = lines.length - head.length - tail.length;

  return {
    content: [
      ...head,
      '',
      `... ${removed} lines truncated ...`,
      '',
      ...tail,
    ].join('\n'),
    removed,
  };
}

function generateHint(savedPath: string, removed: number, unit: string, direction: string): string {
  return `Output was truncated (${removed} ${unit} removed). Full output saved to: ${savedPath}
To view specific sections:
  - Read from beginning: read_file(filePath="${savedPath}", limit=100)
  - Read from middle: read_file(filePath="${savedPath}", offset=${Math.floor(removed/2)}, limit=100)
  - Search for patterns: search_content(path="${savedPath}", pattern="your-search-term")`;
}

async function cleanupOldFiles(dir: string, keepCount: number): Promise<void> {
  try {
    const files = await fs.readdir(dir);
    if (files.length <= keepCount) return;

    // Get file stats and sort by mtime
    const fileStats = await Promise.all(
      files.map(async (f) => {
        const filePath = path.join(dir, f);
        const stat = await fs.stat(filePath);
        return { path: filePath, mtime: stat.mtime.getTime() };
      })
    );

    fileStats.sort((a, b) => b.mtime - a.mtime);

    // Delete old files
    for (let i = keepCount; i < fileStats.length; i++) {
      await fs.unlink(fileStats[i].path).catch(() => {});
    }
  } catch {
    // Ignore cleanup errors
  }
}

export default truncateHandler;
