// ============================================================================
// FileFilter - Controls which files can be accessed by tools
// ============================================================================

import path from 'node:path';
import fs from 'node:fs/promises';

export interface FileFilterConfig {
  /** Glob patterns to ignore */
  ignorePatterns: string[];
  /** Patterns to always allow */
  allowPatterns?: string[];
  /** Maximum file size in bytes */
  maxFileSize?: number;
  /** Maximum batch size for operations */
  maxBatchSize?: number;
  /** Forbidden paths (absolute) */
  forbiddenPaths?: string[];
  /** Working directory (for relative path resolution) */
  workingDirectory: string;
}

export class FileFilter {
  private ignorePatterns: string[];
  private allowPatterns: string[];
  private maxFileSize: number;
  private maxBatchSize: number;
  private forbiddenPaths: Set<string>;
  private workingDirectory: string;

  constructor(config: FileFilterConfig) {
    this.ignorePatterns = config.ignorePatterns;
    this.allowPatterns = config.allowPatterns || [];
    this.maxFileSize = config.maxFileSize || 10 * 1024 * 1024; // 10MB
    this.maxBatchSize = config.maxBatchSize || 100;
    this.forbiddenPaths = new Set(
      (config.forbiddenPaths || []).map((p) => path.resolve(p))
    );
    this.workingDirectory = config.workingDirectory;
  }

  /** Check if a file path is allowed */
  isAllowed(filePath: string): { allowed: boolean; reason?: string } {
    const resolved = path.resolve(filePath);

    // Check forbidden paths
    for (const forbidden of this.forbiddenPaths) {
      if (resolved.startsWith(forbidden) || resolved === forbidden) {
        return { allowed: false, reason: `Path is in forbidden directory: ${forbidden}` };
      }
    }

    // Check if it's within the working directory
    if (!resolved.startsWith(this.workingDirectory) && !path.isAbsolute(resolved)) {
      return { allowed: false, reason: `Path is outside the working directory` };
    }

    return { allowed: true };
  }

  /** Check if a file path matches ignore patterns */
  isIgnored(filePath: string): boolean {
    const normalized = filePath.replace(/\\/g, '/');

    for (const pattern of this.ignorePatterns) {
      if (this.matchGlob(normalized, pattern)) {
        return true;
      }
    }

    // Standard ignores
    const alwaysIgnore = [
      'node_modules',
      '.git',
      'dist',
      'build',
      '.next',
      '.nuxt',
      '__pycache__',
      '.venv',
      'venv',
      '.env',
      '.env.local',
    ];

    for (const dir of alwaysIgnore) {
      if (normalized.includes(`/${dir}/`) || normalized.includes(`\\${dir}\\`)) {
        return true;
      }
    }

    return false;
  }

  /** Check if a file is within size limits */
  async checkFileSize(filePath: string): Promise<{ ok: boolean; size?: number; reason?: string }> {
    try {
      const stat = await fs.stat(filePath);
      if (stat.size > this.maxFileSize) {
        return {
          ok: false,
          size: stat.size,
          reason: `File size (${stat.size} bytes) exceeds maximum (${this.maxFileSize} bytes)`,
        };
      }
      return { ok: true, size: stat.size };
    } catch {
      return { ok: false, reason: 'Cannot stat file' };
    }
  }

  /** Validate a batch of files */
  validateBatch(filePaths: string[]): { valid: boolean; invalidFiles: string[]; reason?: string } {
    if (filePaths.length > this.maxBatchSize) {
      return {
        valid: false,
        invalidFiles: filePaths.slice(this.maxBatchSize),
        reason: `Batch size (${filePaths.length}) exceeds maximum (${this.maxBatchSize})`,
      };
    }
    return { valid: false, invalidFiles: [] };
  }

  /** Filter a list of file paths, removing ignored and disallowed ones */
  filterPaths(filePaths: string[]): string[] {
    return filePaths.filter((p) => {
      const allowed = this.isAllowed(p);
      if (!allowed.allowed) return false;
      return !this.isIgnored(p);
    });
  }

  /** Simple glob matching */
  private matchGlob(str: string, pattern: string): boolean {
    const regexStr = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    return new RegExp(`^${regexStr}$`).test(str);
  }
}
