// ============================================================================
// LayeredMemoryManager - L1-L4 layered memory architecture
// Reference: Letta/MemGPT memory system with context budget management
// ============================================================================

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import type { Message, SessionId } from '../types/session.js';
import { OptimizedContextCompressor, type StructuredSummary, type FileChange, type Decision } from './OptimizedContextCompressor.js';

// --- Memory Layer Types ---

export interface MemoryEntry {
  id: string;
  content: string;
  layer: MemoryLayer;
  category: MemoryCategory;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  accessCount: number;
  lastAccessedAt: number;
  /** Approximate token count */
  tokenCount: number;
  /** Optional TTL in ms; entry expires after this */
  ttl?: number;
  /** Relevance score (0-1), used for retrieval ranking */
  relevanceScore?: number;
}

export type MemoryLayer = 'L1_immediate' | 'L2_working' | 'L3_longterm' | 'L4_archival';

export type MemoryCategory = 'project' | 'user' | 'convention' | 'decision' | 'pattern' | 'error';

export interface MemoryContext {
  /** L1 messages - always injected into the context */
  immediate: Message[];
  /** L2 working summary - session-level persistence */
  workingSummary: StructuredSummary | null;
  /** L3 relevant long-term memory entries */
  longTermEntries: MemoryEntry[];
  /** L4 archival entries (only loaded on demand) */
  archivalEntries: MemoryEntry[];
  /** Total estimated token count of all loaded memory */
  totalTokens: number;
}

export interface MemoryQuery {
  /** The task or query to match against */
  query: string;
  /** Maximum number of entries to retrieve */
  maxEntries?: number;
  /** Minimum relevance score (0-1) */
  minScore?: number;
  /** Which layers to search */
  layers?: MemoryLayer[];
  /** Which categories to search */
  categories?: MemoryCategory[];
  /** Maximum total tokens for returned entries */
  maxTokens?: number;
}

export interface LayeredMemoryOptions {
  /** Session ID for persistence isolation */
  sessionId: SessionId;
  /** Base directory for memory persistence */
  storageDir?: string;
  /** L1: Maximum number of recent messages to keep (default: 10) */
  l1MaxMessages?: number;
  /** L2: Maximum token budget for working summary (default: 2000) */
  l2MaxTokens?: number;
  /** L3: Maximum entries to load into context (default: 20) */
  l3MaxEntries?: number;
  /** L4: Maximum entries to retrieve from archival (default: 5) */
  l4MaxRetrieveEntries?: number;
  /** Total token budget for all memory layers combined (default: 20000) */
  totalTokenBudget?: number;
}

// --- Circular Buffer for L1 ---

class CircularBuffer<T> {
  private buffer: T[] = [];
  private maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  push(item: T): void {
    if (this.buffer.length >= this.maxSize) {
      this.buffer.shift();
    }
    this.buffer.push(item);
  }

  getAll(): T[] {
    return [...this.buffer];
  }

  get size(): number {
    return this.buffer.length;
  }

  clear(): void {
    this.buffer = [];
  }
}

// --- LayeredMemoryManager ---

export class LayeredMemoryManager {
  private readonly sessionId: SessionId;
  private readonly storageDir: string;

  // L1: Immediate memory - circular buffer of recent messages
  private immediateBuffer: CircularBuffer<Message>;

  // L2: Working memory - structured session summary
  private compressor: ContextCompressor;
  private workingSummary: StructuredSummary | null = null;

  // L3: Long-term memory - in-memory entries with persistence
  private longTermMemory: Map<string, MemoryEntry> = new Map();

  // L4: Archival memory - persisted to disk, loaded on demand
  private archivalIndex: Map<string, MemoryEntry> = new Map();

  // Configuration
  private readonly l2MaxTokens: number;
  private readonly l3MaxEntries: number;
  private readonly l4MaxRetrieveEntries: number;
  private readonly totalTokenBudget: number;

  // Persistence dirty flag
  private dirty = false;

  constructor(options: LayeredMemoryOptions) {
    this.sessionId = options.sessionId;
    this.storageDir = options.storageDir || path.join(os.homedir(), '.nova', 'memory', this.sessionId.slice(0, 8));
    this.immediateBuffer = new CircularBuffer(options.l1MaxMessages || 10);
    this.compressor = new OptimizedContextCompressor(this.sessionId);
    this.l2MaxTokens = options.l2MaxTokens || 2000;
    this.l3MaxEntries = options.l3MaxEntries || 20;
    this.l4MaxRetrieveEntries = options.l4MaxRetrieveEntries || 5;
    this.totalTokenBudget = options.totalTokenBudget || 20000;

    this.ensureStorageDir();
  }

  // ========================================================================
  // L1: Immediate Memory
  // ========================================================================

  /**
   * Add a message to L1 immediate memory.
   * This is the most recent conversation context.
   */
  addImmediateMessage(message: Message): void {
    this.immediateBuffer.push(message);
    this.dirty = true;
  }

  /**
   * Get all L1 immediate messages.
   */
  getImmediateMessages(): Message[] {
    return this.immediateBuffer.getAll();
  }

  /**
   * Clear L1 immediate memory (e.g., on session reset).
   */
  clearImmediateMemory(): void {
    this.immediateBuffer.clear();
    this.dirty = true;
  }

  // ========================================================================
  // L2: Working Memory (Session-level)
  // ========================================================================

  /**
   * Promote messages from L1 to L2 working memory via compression.
   * Called when L1 is full and messages need to be "graduated" to summary.
   */
  async promoteToWorkingMemory(): Promise<void> {
    const messages = this.immediateBuffer.getAll();
    if (messages.length < 2) return;

    // Use the compressor to extract structured info
    const newSummary = this.compressor.incrementalCompress(messages, this.workingSummary);

    // Only update if compressor returned a valid summary
    if (newSummary) {
      this.workingSummary = newSummary;

      // Ensure summary doesn't exceed token budget
      if (this.workingSummary.tokenCount > this.l2MaxTokens) {
        this.workingSummary = this.trimSummary(this.workingSummary, this.l2MaxTokens);
      }
    }

    // Clear immediate memory after promotion
    this.immediateBuffer.clear();
    this.dirty = true;
  }

  /**
   * Get the L2 working memory summary.
   */
  getWorkingSummary(): StructuredSummary | null {
    return this.workingSummary;
  }

  /**
   * Set the working summary directly (e.g., restored from persistence).
   */
  setWorkingSummary(summary: StructuredSummary): void {
    this.workingSummary = summary;
    this.dirty = true;
  }

  // ========================================================================
  // L3: Long-term Memory
  // ========================================================================

  /**
   * Store an entry in L3 long-term memory.
   */
  async storeLongTerm(entry: Omit<MemoryEntry, 'id' | 'createdAt' | 'updatedAt' | 'accessCount' | 'lastAccessedAt' | 'tokenCount'>): Promise<MemoryEntry> {
    const fullEntry: MemoryEntry = {
      ...entry,
      id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      accessCount: 0,
      lastAccessedAt: Date.now(),
      tokenCount: this.estimateTokens(entry.content),
    };

    this.longTermMemory.set(fullEntry.id, fullEntry);
    this.dirty = true;

    return fullEntry;
  }

  /**
   * Retrieve relevant entries from L3 long-term memory based on a query.
   * Uses simple keyword matching (can be upgraded to embeddings later).
   */
  retrieveLongTerm(query: MemoryQuery): MemoryEntry[] {
    const queryLower = query.query.toLowerCase();
    const queryTokens = queryLower.split(/\s+/).filter(t => t.length >= 2);

    let entries = Array.from(this.longTermMemory.values());

    // Filter by layers and categories if specified
    if (query.layers) {
      entries = entries.filter((e) => query.layers!.includes(e.layer));
    }
    if (query.categories) {
      entries = entries.filter((e) => query.categories!.includes(e.category));
    }

    // Filter expired entries
    const now = Date.now();
    entries = entries.filter((e) => {
      if (e.ttl && now - e.createdAt > e.ttl) return false;
      return true;
    });

    // Build IDF (inverse document frequency) across all entries
    const docCount = entries.length || 1;
    const docFreq: Map<string, number> = new Map();
    for (const entry of entries) {
      const contentStr = (typeof entry.content === 'string' ? entry.content : JSON.stringify(entry.content)).toLowerCase();
      const tagsStr = entry.tags.join(' ').toLowerCase();
      const fullText = contentStr + ' ' + tagsStr;
      const seen = new Set<string>();
      for (const token of fullText.split(/\s+/)) {
        if (token.length >= 2 && !seen.has(token)) {
          seen.add(token);
          docFreq.set(token, (docFreq.get(token) || 0) + 1);
        }
      }
    }

    // Score and rank by TF-IDF relevance
    const scored = entries.map((entry) => {
      const contentStr = typeof entry.content === 'string' ? entry.content : JSON.stringify(entry.content);
      const contentLower = contentStr.toLowerCase();
      const tagsLower = entry.tags.join(' ').toLowerCase();
      const fullText = contentLower + ' ' + tagsLower;

      // TF-IDF scoring
      let score = 0;
      for (const token of queryTokens) {
        const regex = new RegExp(token, 'gi');
        const contentMatches = contentLower.match(regex);
        const tagMatches = tagsLower.match(regex);
        const tf = ((contentMatches?.length || 0) * 2 + (tagMatches?.length || 0) * 3);
        
        // IDF component: rare terms are more important
        const df = docFreq.get(token) || 1;
        const idf = Math.log(1 + docCount / df);
        
        score += tf * idf;
      }

      // Boost recently accessed entries (recency decay)
      const hoursSinceAccess = (now - entry.lastAccessedAt) / (1000 * 60 * 60);
      const recencyBoost = 1 + Math.max(0, entry.accessCount * 0.05 - hoursSinceAccess * 0.01);
      score *= recencyBoost;

      entry.relevanceScore = Math.min(score / 20, 1);
      return { entry, score };
    });

    // Sort by relevance descending
    scored.sort((a, b) => b.score - a.score);

    // Apply min score filter
    const filtered = scored.filter(
      (s) => !query.minScore || s.entry.relevanceScore! >= query.minScore
    );

    // Apply token budget
    let totalTokens = 0;
    const maxTokens = query.maxTokens || this.totalTokenBudget * 0.4;
    const maxEntries = query.maxEntries || this.l3MaxEntries;
    const result: MemoryEntry[] = [];

    for (const { entry } of filtered) {
      if (result.length >= maxEntries) break;
      if (totalTokens + entry.tokenCount > maxTokens) break;

      // Update access metadata
      entry.accessCount++;
      entry.lastAccessedAt = Date.now();
      result.push(entry);
      totalTokens += entry.tokenCount;
    }

    return result;
  }

  /**
   * Get all L3 entries (for management purposes).
   */
  getAllLongTermEntries(): MemoryEntry[] {
    return Array.from(this.longTermMemory.values());
  }

  /**
   * Delete an entry from L3.
   */
  deleteLongTerm(id: string): boolean {
    const deleted = this.longTermMemory.delete(id);
    if (deleted) this.dirty = true;
    return deleted;
  }

  // ========================================================================
  // L4: Archival Memory
  // ========================================================================

  /**
   * Archive an entry to L4 (persist to disk).
   */
  async archiveEntry(entry: MemoryEntry): Promise<void> {
    this.archivalIndex.set(entry.id, entry);
    await this.persistArchivalEntry(entry);
    this.dirty = true;
  }

  /**
   * Retrieve relevant entries from L4 archival.
   * Uses BM25 algorithm + semantic similarity for better retrieval.
   */
  async retrieveArchival(query: MemoryQuery): Promise<MemoryEntry[]> {
    const queryLower = query.query.toLowerCase();
    const queryTokens = queryLower.split(/\s+/).filter(t => t.length >= 2);

    let entries = Array.from(this.archivalIndex.values());

    // Filter expired
    const now = Date.now();
    entries = entries.filter((e) => !e.ttl || now - e.createdAt <= e.ttl);

    if (entries.length === 0) return [];

    // Build document frequency for BM25
    const docCount = entries.length;
    const docFreq: Map<string, number> = new Map();
    const docLengths: Map<string, number> = new Map();
    const avgDocLength = this.calculateAvgDocLength(entries, docFreq, docLengths);

    // BM25 parameters
    const k1 = 1.5;
    const b = 0.75;

    // Score with BM25 + semantic similarity
    const scored = entries.map((entry) => {
      const contentStr = typeof entry.content === 'string' ? entry.content : JSON.stringify(entry.content);
      const contentLower = contentStr.toLowerCase();
      const tagsLower = entry.tags.join(' ').toLowerCase();
      const fullText = contentLower + ' ' + tagsLower;
      const docLength = docLengths.get(entry.id) || fullText.split(/\s+/).length;

      // BM25 score
      let bm25Score = 0;
      for (const token of queryTokens) {
        const tf = (fullText.match(new RegExp(token, 'gi'))?.length || 0);
        const df = docFreq.get(token) || 1;
        const idf = Math.log(1 + (docCount - df + 0.5) / (df + 0.5));
        
        // BM25 formula
        const numerator = tf * (k1 + 1);
        const denominator = tf + k1 * (1 - b + b * (docLength / avgDocLength));
        bm25Score += idf * (numerator / denominator);
      }

      // Semantic similarity (simple word overlap ratio)
      const docTokens = new Set(fullText.split(/\s+/).filter(t => t.length >= 2));
      const queryTokenSet = new Set(queryTokens);
      const intersection = [...queryTokenSet].filter(t => docTokens.has(t));
      const semanticScore = queryTokenSet.size > 0 ? intersection.length / queryTokenSet.size : 0;

      // Tag boost
      const tagBoost = entry.tags.some(tag => 
        queryTokens.some(token => tag.toLowerCase().includes(token))
      ) ? 1.5 : 1.0;

      // Recency boost
      const ageDays = (now - entry.createdAt) / (1000 * 60 * 60 * 24);
      const recencyBoost = Math.max(0.5, 1 - ageDays * 0.01);

      // Combined score
      const combinedScore = (bm25Score * 0.6 + semanticScore * 0.4) * tagBoost * recencyBoost;

      entry.relevanceScore = Math.min(combinedScore, 1);
      return { entry, score: combinedScore };
    });

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    const minScore = query.minScore || 0.1;
    const maxEntries = query.maxEntries || this.l4MaxRetrieveEntries;
    const maxTokens = query.maxTokens || this.totalTokenBudget * 0.2;
    const result: MemoryEntry[] = [];
    let totalTokens = 0;

    for (const { entry } of scored) {
      if (result.length >= maxEntries) break;
      if (totalTokens + entry.tokenCount > maxTokens) break;
      if (entry.relevanceScore! >= minScore) {
        // Update access metadata
        entry.accessCount++;
        entry.lastAccessedAt = Date.now();
        result.push(entry);
        totalTokens += entry.tokenCount;
      }
    }

    return result;
  }

  /**
   * Calculate average document length and build document frequency map.
   */
  private calculateAvgDocLength(
    entries: MemoryEntry[],
    docFreq: Map<string, number>,
    docLengths: Map<string, number>
  ): number {
    let totalLength = 0;
    
    for (const entry of entries) {
      const contentStr = typeof entry.content === 'string' ? entry.content : JSON.stringify(entry.content);
      const tagsStr = entry.tags.join(' ');
      const fullText = (contentStr + ' ' + tagsStr).toLowerCase();
      const tokens = fullText.split(/\s+/).filter(t => t.length >= 2);
      
      docLengths.set(entry.id, tokens.length);
      totalLength += tokens.length;

      // Build document frequency
      const seen = new Set<string>();
      for (const token of tokens) {
        if (!seen.has(token)) {
          seen.add(token);
          docFreq.set(token, (docFreq.get(token) || 0) + 1);
        }
      }
    }

    return entries.length > 0 ? totalLength / entries.length : 100;
  }

  // ========================================================================
  // Unified Memory Loading
  // ========================================================================

  /**
   * Load all relevant memory into a MemoryContext for injection into the LLM.
   * This is the main entry point for the AgentLoop to get context.
   */
  async loadMemory(query?: string): Promise<MemoryContext> {
    let totalTokens = 0;

    // L1: Immediate messages
    const immediate = this.immediateBuffer.getAll();
    totalTokens += this.estimateMessagesTokens(immediate);

    // L2: Working summary
    const workingSummary = this.workingSummary;
    if (workingSummary) {
      totalTokens += workingSummary.tokenCount;
    }

    // L3: Long-term memory (keyword search)
    let longTermEntries: MemoryEntry[] = [];
    if (query) {
      longTermEntries = this.retrieveLongTerm({
        query,
        maxEntries: this.l3MaxEntries,
        maxTokens: this.totalTokenBudget * 0.3,
      });
    }
    totalTokens += longTermEntries.reduce((sum, e) => sum + e.tokenCount, 0);

    // L4: Archival memory (only if we have budget remaining)
    let archivalEntries: MemoryEntry[] = [];
    if (query && totalTokens < this.totalTokenBudget * 0.8) {
      archivalEntries = await this.retrieveArchival({
        query,
        maxEntries: this.l4MaxRetrieveEntries,
        maxTokens: this.totalTokenBudget - totalTokens,
        minScore: 0.5, // Higher threshold for archival
      });
      totalTokens += archivalEntries.reduce((sum, e) => sum + e.tokenCount, 0);
    }

    return {
      immediate,
      workingSummary,
      longTermEntries,
      archivalEntries,
      totalTokens,
    };
  }

  /**
   * Build a system prompt section from loaded memory context.
   */
  buildMemoryPrompt(context: MemoryContext): string {
    const parts: string[] = [];

    if (context.workingSummary) {
      parts.push(this.compressor.renderSummaryToText(context.workingSummary));
    }

    if (context.longTermEntries.length > 0) {
      parts.push('<long-term-memory>');
      for (const entry of context.longTermEntries) {
        const tagStr = entry.tags.length > 0 ? ` [${entry.tags.join(', ')}]` : '';
        parts.push(`- [${entry.category}]${tagStr} ${entry.content}`);
      }
      parts.push('</long-term-memory>');
    }

    if (context.archivalEntries.length > 0) {
      parts.push('<archival-context>');
      for (const entry of context.archivalEntries) {
        parts.push(`- ${entry.content}`);
      }
      parts.push('</archival-context>');
    }

    return parts.join('\n\n');
  }

  // ========================================================================
  // Persistence
  // ========================================================================

  /**
   * Persist all memory layers to disk.
   */
  async persist(): Promise<void> {
    if (!this.dirty) return;

    try {
      await fs.mkdir(this.storageDir, { recursive: true });

      // Persist L2 working summary
      if (this.workingSummary) {
        const summaryPath = path.join(this.storageDir, 'working-summary.json');
        await fs.writeFile(summaryPath, JSON.stringify(this.workingSummary, null, 2), 'utf-8');
      }

      // Persist L3 long-term memory
      if (this.longTermMemory.size > 0) {
        const ltPath = path.join(this.storageDir, 'long-term.json');
        const entries = Array.from(this.longTermMemory.values());
        await fs.writeFile(ltPath, JSON.stringify(entries, null, 2), 'utf-8');
      }

      // Persist L4 archival index
      if (this.archivalIndex.size > 0) {
        const archPath = path.join(this.storageDir, 'archival-index.json');
        const entries = Array.from(this.archivalIndex.values());
        await fs.writeFile(archPath, JSON.stringify(entries, null, 2), 'utf-8');
      }

      this.dirty = false;
    } catch (err) {
      // Memory persistence is best-effort, never block
      console.warn(`Memory persistence warning: ${(err as Error).message}`);
    }
  }

  /**
   * Restore memory from disk.
   */
  async restore(): Promise<void> {
    try {
      // Restore L2 working summary
      const summaryPath = path.join(this.storageDir, 'working-summary.json');
      try {
        const data = await fs.readFile(summaryPath, 'utf-8');
        this.workingSummary = JSON.parse(data);
      } catch {
        // No summary file, that's OK
      }

      // Restore L3 long-term memory
      const ltPath = path.join(this.storageDir, 'long-term.json');
      try {
        const data = await fs.readFile(ltPath, 'utf-8');
        const entries: MemoryEntry[] = JSON.parse(data);
        for (const entry of entries) {
          this.longTermMemory.set(entry.id, entry);
        }
      } catch {
        // No long-term memory, that's OK
      }

      // Restore L4 archival index
      const archPath = path.join(this.storageDir, 'archival-index.json');
      try {
        const data = await fs.readFile(archPath, 'utf-8');
        const entries: MemoryEntry[] = JSON.parse(data);
        for (const entry of entries) {
          this.archivalIndex.set(entry.id, entry);
        }
      } catch {
        // No archival memory, that's OK
      }
    } catch (err) {
      console.warn(`Memory restore warning: ${(err as Error).message}`);
    }
  }

  // ========================================================================
  // Helpers
  // ========================================================================

  private async ensureStorageDir(): Promise<void> {
    try {
      await fs.mkdir(this.storageDir, { recursive: true });
    } catch {
      // Ignore
    }
  }

  private async persistArchivalEntry(entry: MemoryEntry): Promise<void> {
    try {
      const entryPath = path.join(this.storageDir, 'archival', `${entry.id}.json`);
      await fs.mkdir(path.dirname(entryPath), { recursive: true });
      await fs.writeFile(entryPath, JSON.stringify(entry, null, 2), 'utf-8');
    } catch {
      // Best-effort
    }
  }

  private trimSummary(summary: StructuredSummary, maxTokens: number): StructuredSummary {
    // Trim each section to fit within budget
    const entries = [
      ...summary.fileModifications.slice(0, 10),
      ...summary.decisions.slice(0, 5),
      ...summary.nextSteps.slice(0, 5),
    ];

    let text = `Session goal: ${summary.sessionIntent}\n`;
    text += `Completed: ${summary.completedActions.slice(0, 10).join('; ')}\n`;
    text += `Files: ${summary.fileModifications.slice(0, 10).map((f) => `${f.action} ${f.path}`).join('; ')}`;

    if (this.estimateTokens(text) > maxTokens) {
      // Just truncate the intent and keep only the most essential info
      text = `Session goal: ${summary.sessionIntent.slice(0, 100)}\n`;
      text += `Files changed: ${summary.fileModifications.length}, Decisions: ${summary.decisions.length}`;
    }

    return {
      ...summary,
      fileModifications: summary.fileModifications.slice(0, 10),
      decisions: summary.decisions.slice(0, 5),
      nextSteps: summary.nextSteps.slice(0, 5),
      completedActions: summary.completedActions.slice(0, 10),
      tokenCount: this.estimateTokens(text),
      lastUpdated: Date.now(),
    };
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  private estimateMessagesTokens(messages: Message[]): number {
    let total = 0;
    for (const msg of messages) {
      for (const block of msg.content) {
        if (block.type === 'text') {
          total += this.estimateTokens(block.text);
        } else if (block.type === 'tool_use') {
          total += this.estimateTokens(JSON.stringify(block.input));
        } else if (block.type === 'tool_result') {
          const content = typeof block.content === 'string' ? block.content : JSON.stringify(block.content);
          total += this.estimateTokens(content);
        }
      }
    }
    return total;
  }

  // ========================================================================
  // Memory Statistics
  // ========================================================================

  getStats(): {
    l1Count: number;
    l2Tokens: number;
    l3Count: number;
    l4Count: number;
    totalTokens: number;
  } {
    return {
      l1Count: this.immediateBuffer.size,
      l2Tokens: this.workingSummary?.tokenCount || 0,
      l3Count: this.longTermMemory.size,
      l4Count: this.archivalIndex.size,
      totalTokens: this.workingSummary?.tokenCount || 0 +
        Array.from(this.longTermMemory.values()).reduce((s, e) => s + e.tokenCount, 0),
    };
  }
}
