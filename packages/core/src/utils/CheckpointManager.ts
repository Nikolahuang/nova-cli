// ============================================================================
// CheckpointManager - File snapshot and rollback system
// ============================================================================

import { promises as fs } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { createHash } from 'node:crypto';
import type { NovaConfig } from '../types/config.js';

export interface Checkpoint {
  /** Unique checkpoint ID */
  id: string;
  /** Human-readable name */
  name: string;
  /** Creation timestamp */
  timestamp: number;
  /** Files included in this checkpoint */
  files: CheckpointFile[];
  /** Description of changes */
  description?: string;
  /** Parent checkpoint ID (for branching) */
  parentId?: string;
}

export interface CheckpointFile {
  /** Relative path from workspace root */
  path: string;
  /** File hash for integrity checking */
  hash: string;
  /** File size in bytes */
  size: number;
  /** Modification timestamp */
  mtime: number;
  /** Whether this file was created new */
  isNew?: boolean;
  /** Whether this file was deleted */
  isDeleted?: boolean;
}

export interface CheckpointStats {
  totalCheckpoints: number;
  totalSize: number;
  oldest?: number;
  newest?: number;
}

/**
 * CheckpointManager - Manages file snapshots for rollback capability
 * 
 * Features:
 * - Create snapshots before destructive operations
 * - Rollback to previous states
 * - List and manage checkpoints
 * - Automatic cleanup of old checkpoints
 */
export class CheckpointManager {
  private workspaceRoot: string;
  private checkpointsDir: string;
  private config: NovaConfig;
  private maxCheckpoints: number;
  private maxAgeMs: number;

  constructor(workspaceRoot: string, config: NovaConfig) {
    this.workspaceRoot = workspaceRoot;
    this.config = config;
    this.checkpointsDir = join(workspaceRoot, '.nova', 'checkpoints');
    this.maxCheckpoints = config.core.maxCheckpoints || 10;
    this.maxAgeMs = (config.core.checkpointMaxAgeDays || 7) * 24 * 60 * 60 * 1000;
  }

  /**
   * Initialize checkpoint directory
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.checkpointsDir, { recursive: true });
    } catch (err) {
      // Directory might already exist
    }
  }

  /**
   * Create a checkpoint of specified files
   */
  async create(name: string, filePatterns: string[], description?: string): Promise<Checkpoint> {
    await this.initialize();

    const checkpointId = this.generateId();
    const checkpointDir = join(this.checkpointsDir, checkpointId);
    await fs.mkdir(checkpointDir, { recursive: true });

    const files: CheckpointFile[] = [];
    const matchedFiles = await this.findFiles(filePatterns);

    for (const filePath of matchedFiles) {
      const fullPath = join(this.workspaceRoot, filePath);
      try {
        const stats = await fs.stat(fullPath);
        if (!stats.isFile()) continue;

        // Read file content
        const content = await fs.readFile(fullPath);
        
        // Calculate hash
        const hash = createHash('sha256').update(content).digest('hex');

        // Copy file to checkpoint
        const checkpointFilePath = join(checkpointDir, filePath);
        await fs.mkdir(dirname(checkpointFilePath), { recursive: true });
        await fs.writeFile(checkpointFilePath, content);

        files.push({
          path: filePath,
          hash,
          size: content.length,
          mtime: stats.mtimeMs,
        });
      } catch (err) {
        // File might not exist or be readable
        console.warn(`Warning: Could not checkpoint ${filePath}: ${err}`);
      }
    }

    const checkpoint: Checkpoint = {
      id: checkpointId,
      name,
      timestamp: Date.now(),
      files,
      description,
    };

    // Save checkpoint metadata
    await fs.writeFile(
      join(checkpointDir, 'metadata.json'),
      JSON.stringify(checkpoint, null, 2)
    );

    // Cleanup old checkpoints
    await this.cleanupOldCheckpoints();

    return checkpoint;
  }

  /**
   * Restore a checkpoint
   */
  async restore(checkpointId: string): Promise<void> {
    const checkpoint = await this.load(checkpointId);
    if (!checkpoint) {
      throw new Error(`Checkpoint not found: ${checkpointId}`);
    }

    const checkpointDir = join(this.checkpointsDir, checkpointId);

    for (const file of checkpoint.files) {
      const sourcePath = join(checkpointDir, file.path);
      const destPath = join(this.workspaceRoot, file.path);

      try {
        await fs.mkdir(dirname(destPath), { recursive: true });
        const content = await fs.readFile(sourcePath);
        await fs.writeFile(destPath, content);
      } catch (err) {
        throw new Error(`Failed to restore ${file.path}: ${err}`);
      }
    }
  }

  /**
   * List all checkpoints
   */
  async list(): Promise<Checkpoint[]> {
    await this.initialize();

    try {
      const entries = await fs.readdir(this.checkpointsDir, { withFileTypes: true });
      const checkpoints: Checkpoint[] = [];

      for (const entry of entries) {
        if (entry.isDirectory()) {
          try {
            const metadataPath = join(this.checkpointsDir, entry.name, 'metadata.json');
            const metadata = await fs.readFile(metadataPath, 'utf-8');
            const checkpoint = JSON.parse(metadata) as Checkpoint;
            checkpoints.push(checkpoint);
          } catch (err) {
            // Skip invalid checkpoints
          }
        }
      }

      // Sort by timestamp (newest first)
      return checkpoints.sort((a, b) => b.timestamp - a.timestamp);
    } catch (err) {
      return [];
    }
  }

  /**
   * Get checkpoint by ID
   */
  async load(checkpointId: string): Promise<Checkpoint | null> {
    try {
      const metadataPath = join(this.checkpointsDir, checkpointId, 'metadata.json');
      const metadata = await fs.readFile(metadataPath, 'utf-8');
      return JSON.parse(metadata) as Checkpoint;
    } catch (err) {
      return null;
    }
  }

  /**
   * Delete a checkpoint
   */
  async delete(checkpointId: string): Promise<boolean> {
    try {
      const checkpointDir = join(this.checkpointsDir, checkpointId);
      await fs.rm(checkpointDir, { recursive: true, force: true });
      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * Get checkpoint statistics
   */
  async stats(): Promise<CheckpointStats> {
    const checkpoints = await this.list();
    let totalSize = 0;

    for (const checkpoint of checkpoints) {
      totalSize += checkpoint.files.reduce((sum, file) => sum + file.size, 0);
    }

    return {
      totalCheckpoints: checkpoints.length,
      totalSize,
      oldest: checkpoints.length > 0 ? checkpoints[checkpoints.length - 1].timestamp : undefined,
      newest: checkpoints.length > 0 ? checkpoints[0].timestamp : undefined,
    };
  }

  /**
   * Compare current files with checkpoint
   */
  async diff(checkpointId: string): Promise<Array<{ path: string; status: 'modified' | 'deleted' | 'added' }>> {
    const checkpoint = await this.load(checkpointId);
    if (!checkpoint) {
      throw new Error(`Checkpoint not found: ${checkpointId}`);
    }

    const differences: Array<{ path: string; status: 'modified' | 'deleted' | 'added' }> = [];

    // Check files in checkpoint
    for (const file of checkpoint.files) {
      const currentPath = join(this.workspaceRoot, file.path);
      try {
        const currentContent = await fs.readFile(currentPath);
        const currentHash = createHash('sha256').update(currentContent).digest('hex');
        
        if (currentHash !== file.hash) {
          differences.push({ path: file.path, status: 'modified' });
        }
      } catch (err) {
        // File doesn't exist (deleted)
        differences.push({ path: file.path, status: 'deleted' });
      }
    }

    return differences;
  }

  /**
   * Cleanup old checkpoints based on age and count limits
   */
  private async cleanupOldCheckpoints(): Promise<void> {
    const checkpoints = await this.list();
    const now = Date.now();
    const toDelete: string[] = [];

    // Find checkpoints to delete
    for (let i = 0; i < checkpoints.length; i++) {
      const checkpoint = checkpoints[i];
      const age = now - checkpoint.timestamp;

      // Delete if too old or if we have too many
      if (age > this.maxAgeMs || i >= this.maxCheckpoints) {
        toDelete.push(checkpoint.id);
      }
    }

    // Delete old checkpoints
    for (const id of toDelete) {
      await this.delete(id);
    }
  }

  /**
   * Find files matching patterns
   */
  private async findFiles(patterns: string[]): Promise<string[]> {
    const files = new Set<string>();
    
    for (const pattern of patterns) {
      if (pattern.includes('*')) {
        // Simple glob pattern - in real implementation use a glob library
        // For now, just add the pattern as-is
        files.add(pattern);
      } else {
        // Single file or directory
        files.add(pattern);
      }
    }

    return Array.from(files);
  }

  /**
   * Generate unique checkpoint ID
   */
  private generateId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 6);
    return `cp-${timestamp}-${random}`;
  }
}
