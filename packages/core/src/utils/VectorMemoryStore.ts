// ============================================================================
// VectorMemoryStore - Vector-based semantic memory storage
// ============================================================================

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createLogger } from './Logger.js';
import { generateId } from './helpers.js';

const logger = createLogger('VectorMemoryStore');

// ============================================================================
// Types
// ============================================================================

/**
 * Memory entry with vector embedding
 */
export interface VectorMemoryEntry {
  id: string;
  content: string;
  embedding: number[];
  metadata: {
    session: string;
    timestamp: Date;
    type: 'decision' | 'code' | 'error' | 'insight' | 'context' | 'preference';
    importance: number;  // 0-1 score
    tags: string[];
    source?: string;     // File or URL source
  };
}

/**
 * Search result with similarity score
 */
export interface MemoryMatch {
  entry: VectorMemoryEntry;
  score: number;  // Cosine similarity 0-1
}

/**
 * Memory store configuration
 */
export interface VectorMemoryConfig {
  /** Storage directory for persistence */
  storageDir: string;
  /** Maximum entries to keep */
  maxEntries?: number;
  /** Minimum similarity score for search results */
  minSimilarity?: number;
  /** Embedding dimension (default 384 for small models) */
  embeddingDimension?: number;
}

// ============================================================================
// Embedding Functions
// ============================================================================

/**
 * Simple embedding function using character n-grams
 * This is a lightweight alternative to neural embeddings
 */
function simpleEmbedding(text: string, dimension: number = 384): number[] {
  const embedding = new Array(dimension).fill(0);
  
  // Normalize text
  const normalized = text.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff\s]/g, ' ');
  const words = normalized.split(/\s+/).filter(w => w.length > 0);
  
  // Hash-based embedding
  for (const word of words) {
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      const char = word.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    // Map hash to embedding dimensions
    const pos = Math.abs(hash) % dimension;
    const sign = hash > 0 ? 1 : -1;
    embedding[pos] += sign * (1 / words.length);
    
    // Add n-gram features
    for (let i = 0; i < word.length - 1; i++) {
      const bigram = word.slice(i, i + 2);
      let bigramHash = 0;
      for (let j = 0; j < bigram.length; j++) {
        bigramHash = ((bigramHash << 5) - bigramHash) + bigram.charCodeAt(j);
        bigramHash = bigramHash & bigramHash;
      }
      const bigramPos = Math.abs(bigramHash) % dimension;
      embedding[bigramPos] += 0.1 / words.length;
    }
  }
  
  // Normalize embedding
  const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
  if (norm > 0) {
    for (let i = 0; i < embedding.length; i++) {
      embedding[i] /= norm;
    }
  }
  
  return embedding;
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    const aVal = a[i] ?? 0;
    const bVal = b[i] ?? 0;
    dotProduct += aVal * bVal;
    normA += aVal * aVal;
    normB += bVal * bVal;
  }
  
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom > 0 ? dotProduct / denom : 0;
}

// ============================================================================
// VectorMemoryStore
// ============================================================================

/**
 * Vector-based memory store for semantic search
 */
export class VectorMemoryStore {
  private entries: VectorMemoryEntry[] = [];
  private config: Required<VectorMemoryConfig>;
  private storageFile: string;
  private isDirty = false;
  
  constructor(config: VectorMemoryConfig) {
    this.config = {
      maxEntries: config.maxEntries ?? 1000,
      minSimilarity: config.minSimilarity ?? 0.5,
      embeddingDimension: config.embeddingDimension ?? 384,
      ...config,
    };
    
    this.storageFile = path.join(this.config.storageDir, 'vector-memory.json');
    this.load();
    
    // Auto-save on process exit
    process.on('beforeExit', () => this.save());
  }
  
  // -----------------------------------------------------------------------
  // Core Operations
  // -----------------------------------------------------------------------
  
  /**
   * Add a memory entry
   */
  async addMemory(
    content: string,
    metadata: VectorMemoryEntry['metadata']
  ): Promise<VectorMemoryEntry> {
    // Generate embedding
    const embedding = simpleEmbedding(content, this.config.embeddingDimension);
    
    const entry: VectorMemoryEntry = {
      id: generateId(),
      content,
      embedding,
      metadata: {
        ...metadata,
        timestamp: metadata.timestamp ?? new Date(),
      },
    };
    
    this.entries.push(entry);
    this.isDirty = true;
    
    // Prune if over limit
    if (this.entries.length > this.config.maxEntries) {
      this.prune();
    }
    
    logger.debug(`Added memory entry: ${entry.id}`, { type: metadata.type });
    return entry;
  }
  
  /**
   * Search for similar memories
   */
  async searchSimilar(
    query: string,
    options: {
      topK?: number;
      minSimilarity?: number;
      type?: VectorMemoryEntry['metadata']['type'];
      tags?: string[];
    } = {}
  ): Promise<MemoryMatch[]> {
    const { topK = 5, minSimilarity, type, tags } = options;
    const threshold = minSimilarity ?? this.config.minSimilarity;
    
    // Generate query embedding
    const queryEmbedding = simpleEmbedding(query, this.config.embeddingDimension);
    
    // Calculate similarities
    const matches: MemoryMatch[] = [];
    
    for (const entry of this.entries) {
      // Filter by type
      if (type && entry.metadata.type !== type) continue;
      
      // Filter by tags
      if (tags && tags.length > 0) {
        const hasTag = tags.some(t => entry.metadata.tags.includes(t));
        if (!hasTag) continue;
      }
      
      const score = cosineSimilarity(queryEmbedding, entry.embedding);
      
      if (score >= threshold) {
        matches.push({ entry, score });
      }
    }
    
    // Sort by score and return top K
    matches.sort((a, b) => b.score - a.score);
    return matches.slice(0, topK);
  }
  
  /**
   * Get entry by ID
   */
  getEntry(id: string): VectorMemoryEntry | undefined {
    return this.entries.find(e => e.id === id);
  }
  
  /**
   * Delete entry by ID
   */
  deleteEntry(id: string): boolean {
    const index = this.entries.findIndex(e => e.id === id);
    if (index >= 0) {
      this.entries.splice(index, 1);
      this.isDirty = true;
      return true;
    }
    return false;
  }
  
  /**
   * Get all entries of a specific type
   */
  getEntriesByType(type: VectorMemoryEntry['metadata']['type']): VectorMemoryEntry[] {
    return this.entries.filter(e => e.metadata.type === type);
  }
  
  /**
   * Get entries by tags
   */
  getEntriesByTags(tags: string[]): VectorMemoryEntry[] {
    return this.entries.filter(e => 
      tags.some(t => e.metadata.tags.includes(t))
    );
  }
  
  /**
   * Get entries for a session
   */
  getEntriesBySession(sessionId: string): VectorMemoryEntry[] {
    return this.entries.filter(e => e.metadata.session === sessionId);
  }
  
  // -----------------------------------------------------------------------
  // Persistence
  // -----------------------------------------------------------------------
  
  /**
   * Save to disk
   */
  save(): void {
    if (!this.isDirty) return;
    
    try {
      // Ensure directory exists
      const dir = path.dirname(this.storageFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // Serialize entries
      const data = {
        version: 1,
        entries: this.entries.map(e => ({
          ...e,
          metadata: {
            ...e.metadata,
            timestamp: e.metadata.timestamp.toISOString(),
          },
        })),
      };
      
      fs.writeFileSync(this.storageFile, JSON.stringify(data, null, 2), 'utf-8');
      this.isDirty = false;
      
      logger.debug(`Saved ${this.entries.length} memory entries`);
    } catch (error) {
      logger.error('Failed to save memory store', { error });
    }
  }
  
  /**
   * Load from disk
   */
  load(): void {
    try {
      if (!fs.existsSync(this.storageFile)) {
        logger.debug('No existing memory store found, starting fresh');
        return;
      }
      
      const data = JSON.parse(fs.readFileSync(this.storageFile, 'utf-8'));
      
      if (data.version === 1 && Array.isArray(data.entries)) {
        this.entries = data.entries.map((e: any) => ({
          ...e,
          metadata: {
            ...e.metadata,
            timestamp: new Date(e.metadata.timestamp),
          },
        }));
        
        logger.debug(`Loaded ${this.entries.length} memory entries`);
      }
    } catch (error) {
      logger.error('Failed to load memory store', { error });
      this.entries = [];
    }
  }
  
  // -----------------------------------------------------------------------
  // Maintenance
  // -----------------------------------------------------------------------
  
  /**
   * Prune entries based on importance and age
   */
  private prune(): void {
    if (this.entries.length <= this.config.maxEntries) return;
    
    // Calculate age scores (newer is better)
    const now = Date.now();
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
    
    const scoredEntries = this.entries.map(entry => {
      const age = now - entry.metadata.timestamp.getTime();
      const ageScore = Math.max(0, 1 - age / maxAge);
      
      // Combined score: importance * 0.7 + ageScore * 0.3
      const score = entry.metadata.importance * 0.7 + ageScore * 0.3;
      
      return { entry, score };
    });
    
    // Sort by score and keep top entries
    scoredEntries.sort((a, b) => b.score - a.score);
    this.entries = scoredEntries
      .slice(0, this.config.maxEntries)
      .map(s => s.entry);
    
    this.isDirty = true;
    logger.debug(`Pruned memory to ${this.entries.length} entries`);
  }
  
  /**
   * Get statistics
   */
  getStats(): {
    totalEntries: number;
    byType: Record<string, number>;
    oldestEntry: Date | null;
    newestEntry: Date | null;
    avgImportance: number;
  } {
    const byType: Record<string, number> = {};
    let oldest: Date | null = null;
    let newest: Date | null = null;
    let totalImportance = 0;
    
    for (const entry of this.entries) {
      byType[entry.metadata.type] = (byType[entry.metadata.type] ?? 0) + 1;
      
      if (!oldest || entry.metadata.timestamp < oldest) {
        oldest = entry.metadata.timestamp;
      }
      if (!newest || entry.metadata.timestamp > newest) {
        newest = entry.metadata.timestamp;
      }
      
      totalImportance += entry.metadata.importance;
    }
    
    return {
      totalEntries: this.entries.length,
      byType,
      oldestEntry: oldest,
      newestEntry: newest,
      avgImportance: this.entries.length > 0 ? totalImportance / this.entries.length : 0,
    };
  }
  
  /**
   * Clear all entries
   */
  clear(): void {
    this.entries = [];
    this.isDirty = true;
  }
}

// ============================================================================
// Factory function
// ============================================================================

/**
 * Create a vector memory store with default configuration
 */
export function createVectorMemoryStore(
  storageDir?: string
): VectorMemoryStore {
  const defaultDir = storageDir ?? path.join(process.env.HOME ?? '~', '.nova', 'memory');
  return new VectorMemoryStore({ storageDir: defaultDir });
}
