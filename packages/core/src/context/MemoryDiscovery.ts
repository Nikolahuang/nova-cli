// ============================================================================
// MemoryDiscovery - Discovers and loads project context/memory files
// ============================================================================

import fs from 'node:fs/promises';
import path from 'node:path';
import { glob } from 'glob';

export interface MemoryFile {
  filePath: string;
  content: string;
  priority: number; // Higher = more important, loaded first
  category: 'project' | 'team' | 'user' | 'convention';
}

export interface MemoryDiscoveryConfig {
  /** Project root directory */
  projectRoot: string;
  /** Memory file patterns to search for */
  patterns?: string[];
  /** Maximum total memory size in bytes */
  maxSizeBytes?: number;
  /** Maximum number of memory files */
  maxFiles?: number;
}

const DEFAULT_PATTERNS = [
  '**/.nova/memory/**',
  '**/.nova/MEMORY.md',
  '**/.nova/context.md',
  '**/CLAUDE.md',
  '**/.claude/context.md',
  '**/.cursor/rules/**',
  '**/.github/copilot-instructions.md',
  '**/CONTRIBUTING.md',
  '**/ARCHITECTURE.md',
  '**/.nova/**/*.md',
];

export class MemoryDiscovery {
  private config: MemoryDiscoveryConfig;
  private patterns: string[];
  private cache = new Map<string, MemoryFile>();

  constructor(config: MemoryDiscoveryConfig) {
    this.config = config;
    this.patterns = config.patterns || DEFAULT_PATTERNS;
  }

  /** Discover all memory files in the project */
  async discover(): Promise<MemoryFile[]> {
    const files: MemoryFile[] = [];

    for (const pattern of this.patterns) {
      try {
        const matches = await glob(pattern, {
          cwd: this.config.projectRoot,
          absolute: true,
          nodir: true,
          ignore: ['**/node_modules/**', '**/.git/**'],
          windowsPathsNoEscape: true,
        });

        for (const filePath of matches) {
          const existing = this.cache.get(filePath);
          if (existing) {
            files.push(existing);
            continue;
          }

          try {
            const content = await fs.readFile(filePath, 'utf-8');
            const memoryFile: MemoryFile = {
              filePath,
              content,
              priority: this.calculatePriority(filePath),
              category: this.categorize(filePath),
            };
            this.cache.set(filePath, memoryFile);
            files.push(memoryFile);
          } catch {
            // Skip unreadable files
          }
        }
      } catch {
        // Skip failed glob patterns
      }
    }

    // Sort by priority (highest first)
    files.sort((a, b) => b.priority - a.priority);

    // Apply limits
    const maxFiles = this.config.maxFiles || 20;
    const maxSizeBytes = this.config.maxSizeBytes || 100_000; // 100KB

    let totalSize = 0;
    const result: MemoryFile[] = [];

    for (const file of files) {
      const fileSize = Buffer.byteLength(file.content, 'utf-8');
      if (result.length >= maxFiles || totalSize + fileSize > maxSizeBytes) break;
      result.push(file);
      totalSize += fileSize;
    }

    return result;
  }

  /** Get a specific memory file */
  async getFile(filePath: string): Promise<MemoryFile | null> {
    const cached = this.cache.get(filePath);
    if (cached) return cached;

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const memoryFile: MemoryFile = {
        filePath,
        content,
        priority: this.calculatePriority(filePath),
        category: this.categorize(filePath),
      };
      this.cache.set(filePath, memoryFile);
      return memoryFile;
    } catch {
      return null;
    }
  }

  /** Clear the cache */
  clearCache(): void {
    this.cache.clear();
  }

  /** Calculate priority for a file based on its path */
  private calculatePriority(filePath: string): number {
    const lower = filePath.toLowerCase();

    // Highest priority: explicit project memory
    if (lower.includes('.nova/memory.md') || lower.includes('.nova/memories/')) return 100;
    if (lower.includes('.nova/context.md')) return 90;
    if (lower.includes('claude.md')) return 80;
    if (lower.includes('.claude/context.md')) return 75;

    // High priority: architecture and contribution guides
    if (lower.includes('architecture.md')) return 70;
    if (lower.includes('contributing.md')) return 65;
    if (lower.includes('.cursor/rules')) return 60;

    // Medium priority: copilot instructions
    if (lower.includes('copilot-instructions.md')) return 50;

    // Lower priority: other memory files
    if (lower.includes('.nova/')) return 40;

    return 20;
  }

  /** Categorize a memory file */
  private categorize(filePath: string): MemoryFile['category'] {
    const lower = filePath.toLowerCase();

    if (lower.includes('.nova/memory') || lower.includes('.nova/context') || lower.includes('claude.md')) {
      return 'project';
    }
    if (lower.includes('contributing') || lower.includes('.cursor/rules') || lower.includes('copilot')) {
      return 'convention';
    }
    if (lower.includes('architecture')) {
      return 'project';
    }

    return 'project';
  }
}
