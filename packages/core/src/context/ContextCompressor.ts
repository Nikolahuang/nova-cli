// ============================================================================
// ContextCompressor - Intelligent context compression with structured summarization
// Reference: Factory.ai research (98.6% compression, 4.04/5 accuracy)
// ============================================================================

import type { Message, ContentBlock, SessionId } from '../types/session.js';

// --- Structured Summary Types ---

export interface FileChange {
  path: string;
  action: 'created' | 'modified' | 'deleted';
  summary: string;
  timestamp: number;
}

export interface Decision {
  id: string;
  topic: string;
  reasoning: string;
  outcome: string;
  timestamp: number;
}

export interface StructuredSummary {
  /** Core intent of the current session */
  sessionIntent: string;
  /** Tracked file modifications */
  fileModifications: FileChange[];
  /** Key decisions made during the session */
  decisions: Decision[];
  /** Pending tasks / next steps */
  nextSteps: string[];
  /** Summary of completed actions */
  completedActions: string[];
  /** Total token count of this summary */
  tokenCount: number;
  /** Compression ratio (original / summary) */
  compressionRatio: number;
  /** When this summary was last updated */
  lastUpdated: number;
}

export interface ContextState {
  /** Current token usage estimate */
  tokenUsage: number;
  /** Maximum context window */
  maxTokens: number;
  /** Whether the conversation has precise history that shouldn't be lost */
  hasPreciseHistory: boolean;
  /** Number of messages in the conversation */
  messageCount: number;
}

// --- Compression Strategy Types ---

type CompressionAction = 'compress' | 'keep' | 'summarize' | 'retrieve';

export interface CompressionResult {
  action: CompressionAction;
  /** Reasoning for the chosen action */
  reason: string;
  /** The resulting message list (may be compressed or original) */
  messages: Message[];
  /** If compression happened, the generated summary */
  summary?: StructuredSummary;
  /** Token count after compression */
  resultingTokens: number;
  /** Token count before compression */
  originalTokens: number;
}

export interface CompressionOptions {
  /** Maximum tokens for the context window (default: 128000) */
  maxTokens?: number;
  /** Threshold to start compressing (default: 0.6 = 60%) */
  compressThreshold?: number;
  /** Threshold for aggressive compression (default: 0.85 = 85%) */
  aggressiveThreshold?: number;
  /** Maximum number of recent messages to always keep (default: 5) */
  keepRecentCount?: number;
  /** Whether to extract structured info from removed messages */
  extractStructuredInfo?: boolean;
  /** Existing summary to merge into (for incremental compression) */
  existingSummary?: StructuredSummary;
}

// --- Constants ---

const DEFAULT_OPTIONS: Required<CompressionOptions> = {
  maxTokens: 128000,
  compressThreshold: 0.6,
  aggressiveThreshold: 0.85,
  keepRecentCount: 5,
  extractStructuredInfo: true,
  existingSummary: undefined,
};

// --- ContextCompressor ---

export interface ContextCompressorOptions {
  sessionId?: SessionId;
  maxTokens?: number;
  summaryModel?: string;
}

export class ContextCompressor {
  private currentSummary: StructuredSummary | null = null;
  private sessionId: SessionId | null = null;
  private maxTokens: number;

  constructor(options?: ContextCompressorOptions | SessionId) {
    if (typeof options === 'string') {
      this.sessionId = options;
      this.maxTokens = DEFAULT_OPTIONS.maxTokens;
    } else {
      this.sessionId = options?.sessionId || null;
      this.maxTokens = options?.maxTokens || DEFAULT_OPTIONS.maxTokens;
    }
  }

  /**
   * Analyze the context state and determine the best compression action.
   */
  shouldCompress(state: ContextState): CompressionAction {
    const usage = state.tokenUsage / state.maxTokens;

    if (usage < DEFAULT_OPTIONS.compressThreshold) {
      return 'keep';
    }

    if (usage >= DEFAULT_OPTIONS.aggressiveThreshold && state.hasPreciseHistory) {
      return 'retrieve';
    }

    if (usage >= DEFAULT_OPTIONS.aggressiveThreshold) {
      return 'summarize';
    }

    // Between 60-85%: light compression
    return 'compress';
  }

  /**
   * Compress messages intelligently.
   * - Keeps system messages always
   * - Keeps the N most recent messages
   * - Extracts structured information from removed messages
   * - Generates a structured summary for the LLM context
   */
  compress(
    messages: Message[],
    options?: CompressionOptions
  ): CompressionResult {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const originalTokens = this.estimateMessagesTokens(messages);

    const state: ContextState = {
      tokenUsage: originalTokens,
      maxTokens: opts.maxTokens,
      hasPreciseHistory: this.hasPreciseHistory(messages),
      messageCount: messages.length,
    };

    const action = this.shouldCompress(state);

    if (action === 'keep') {
      return {
        action: 'keep',
        reason: `Context usage at ${((state.tokenUsage / state.maxTokens) * 100).toFixed(0)}%, below threshold of ${opts.compressThreshold * 100}%`,
        messages,
        resultingTokens: originalTokens,
        originalTokens,
      };
    }

    // Separate message types
    const systemMessages = messages.filter((m) => m.role === 'system');
    const nonSystemMessages = messages.filter((m) => m.role !== 'system');

    if (nonSystemMessages.length <= opts.keepRecentCount) {
      // Not enough messages to compress meaningfully
      return {
        action: 'keep',
        reason: 'Too few non-system messages to compress',
        messages,
        resultingTokens: originalTokens,
        originalTokens,
      };
    }

    // Split into "old" (to be summarized) and "recent" (to be kept)
    const recentMessages = nonSystemMessages.slice(-opts.keepRecentCount);
    const oldMessages = nonSystemMessages.slice(0, -opts.keepRecentCount);

    // Extract structured information from old messages
    let summary = opts.existingSummary || this.currentSummary;
    if (opts.extractStructuredInfo && oldMessages.length > 0) {
      summary = this.extractStructuredInfo(oldMessages, summary);
      this.currentSummary = summary;
    }

    // Build the compressed message list
    const compressedMessages: Message[] = [
      ...systemMessages,
    ];

    // Inject summary as a system-level context message if we have one
    if (summary) {
      compressedMessages.push(this.createSummaryMessage(summary));
    }

    // Add the recent messages back
    compressedMessages.push(...recentMessages);

    const resultingTokens = this.estimateMessagesTokens(compressedMessages);

    return {
      action,
      reason: this.getCompressionReason(action, oldMessages.length, originalTokens, resultingTokens),
      messages: compressedMessages,
      summary,
      resultingTokens,
      originalTokens,
    };
  }

  /**
   * Incremental compression: only process new messages since last compression,
   * merge into existing summary. More efficient than full recompression.
   */
  incrementalCompress(
    newMessages: Message[],
    existingSummary: StructuredSummary | null
  ): StructuredSummary {
    if (!existingSummary) {
      return this.extractStructuredInfo(newMessages, null);
    }

    const newInfo = this.extractNewInfo(newMessages);
    return this.mergeSummary(existingSummary, newInfo);
  }

  /**
   * Extract a structured summary from a set of messages.
   * This analyzes tool calls, file operations, and conversation content
   * to build a structured representation of what happened.
   */
  extractStructuredInfo(
    messages: Message[],
    base: StructuredSummary | null
  ): StructuredSummary {
    const fileChanges = base ? [...base.fileModifications] : [];
    const decisions = base ? [...base.decisions] : [];
    const nextSteps: string[] = base ? [...base.nextSteps] : [];
    const completedActions: string[] = base ? [...base.completedActions] : [];

    let sessionIntent = base?.sessionIntent || '';

    for (const message of messages) {
      for (const block of message.content) {
        if (block.type === 'tool_use') {
          this.processToolUse(block.name, block.input, fileChanges, completedActions, decisions);
        } else if (block.type === 'text') {
          // Try to extract session intent from user messages
          if (message.role === 'user' && !sessionIntent && block.text.length > 5) {
            sessionIntent = block.text.slice(0, 200);
          }
          // Extract explicit decisions or next steps patterns
          this.extractFromText(block.text, decisions, nextSteps, completedActions);
        }
      }
    }

    // Deduplicate
    const uniqueDecisions = this.deduplicateDecisions(decisions);
    const uniqueNextSteps = [...new Set(nextSteps.filter((s) => s.length > 0))];

    const summaryText = this.renderSummary(sessionIntent, fileChanges, uniqueDecisions, uniqueNextSteps, completedActions);
    const tokenCount = this.estimateTokensText(summaryText);

    return {
      sessionIntent: sessionIntent || 'User conversation',
      fileModifications: fileChanges.slice(-20), // Keep last 20 file changes
      decisions: uniqueDecisions.slice(-10), // Keep last 10 decisions
      nextSteps: uniqueNextSteps.slice(-10),
      completedActions: completedActions.slice(-20),
      tokenCount,
      compressionRatio: 0, // Will be calculated externally
      lastUpdated: Date.now(),
    };
  }

  /**
   * Get the current structured summary.
   */
  getSummary(): StructuredSummary | null {
    return this.currentSummary;
  }

  /**
   * Set an existing summary (e.g., loaded from persistence).
   */
  setSummary(summary: StructuredSummary): void {
    this.currentSummary = summary;
  }

  /**
   * Clear the current summary.
   */
  clearSummary(): void {
    this.currentSummary = null;
  }

  /**
   * Render a structured summary into a text format suitable for LLM context.
   */
  renderSummaryToText(summary: StructuredSummary): string {
    return this.renderSummary(
      summary.sessionIntent,
      summary.fileModifications,
      summary.decisions,
      summary.nextSteps,
      summary.completedActions
    );
  }

  // --- Private Methods ---

  private createSummaryMessage(summary: StructuredSummary): Message {
    const text = this.renderSummaryToText(summary);
    return {
      id: `summary-${Date.now()}` as any,
      role: 'user' as const,
      content: [{ type: 'text', text }],
      timestamp: Date.now(),
      createdAt: new Date(),
      metadata: { isContextSummary: true },
    };
  }

  private renderSummary(
    intent: string,
    files: FileChange[],
    decisions: Decision[],
    nextSteps: string[],
    completed: string[]
  ): string {
    const parts: string[] = [];
    const safeCompleted = Array.isArray(completed) ? completed : [];
    const safeFiles = Array.isArray(files) ? files : [];
    const safeDecisions = Array.isArray(decisions) ? decisions : [];
    const safeNextSteps = Array.isArray(nextSteps) ? nextSteps : [];

    parts.push('<context-summary>');
    parts.push(`Session goal: ${intent}`);

    if (safeCompleted.length > 0) {
      parts.push(`Completed: ${safeCompleted.join('; ')}`);
    }

    if (safeFiles.length > 0) {
      const fileStr = safeFiles.map((f) => `${f.action} ${f.path} (${f.summary})`).join('; ');
      parts.push(`Files changed: ${fileStr}`);
    }

    if (safeDecisions.length > 0) {
      const decisionStr = safeDecisions.map((d) => `${d.topic}: ${d.outcome}`).join('; ');
      parts.push(`Decisions: ${decisionStr}`);
    }

    if (safeNextSteps.length > 0) {
      parts.push(`Next: ${safeNextSteps.join('; ')}`);
    }

    parts.push('</context-summary>');
    return parts.join('\n');
  }

  private extractNewInfo(messages: Message[]): Partial<StructuredSummary> {
    // For incremental: just extract from the new messages
    const tempBase: StructuredSummary = {
      sessionIntent: '',
      fileModifications: [],
      decisions: [],
      nextSteps: [],
      completedActions: [],
      tokenCount: 0,
      compressionRatio: 0,
      lastUpdated: Date.now(),
    };
    const extracted = this.extractStructuredInfo(messages, null);
    return {
      sessionIntent: extracted.sessionIntent,
      fileModifications: extracted.fileModifications,
      decisions: extracted.decisions,
      nextSteps: extracted.nextSteps,
      completedActions: extracted.completedActions,
    };
  }

  private mergeSummary(
    existing: StructuredSummary,
    newInfo: Partial<StructuredSummary>
  ): StructuredSummary {
    const mergedFiles = [...(Array.isArray(existing.fileModifications) ? existing.fileModifications : [])];
    for (const fc of newInfo.fileModifications || []) {
      // Update if same path, otherwise add
      const existingIdx = mergedFiles.findIndex((f) => f.path === fc.path);
      if (existingIdx >= 0) {
        mergedFiles[existingIdx] = fc; // Replace with newer version
      } else {
        mergedFiles.push(fc);
      }
    }

    const mergedDecisions = [...(Array.isArray(existing.decisions) ? existing.decisions : [])];
    for (const d of newInfo.decisions || []) {
      const existingIdx = mergedDecisions.findIndex((ed) => ed.topic === d.topic);
      if (existingIdx >= 0) {
        mergedDecisions[existingIdx] = d;
      } else {
        mergedDecisions.push(d);
      }
    }

    // Next steps: keep new ones, remove completed ones
    const completedSet = new Set(newInfo.completedActions || []);
    const mergedNextSteps = (newInfo.nextSteps || [])
      .filter((s) => !completedSet.has(s))
      .concat(
        (existing.nextSteps || []).filter(
          (s) => !completedSet.has(s) && !(newInfo.nextSteps || []).includes(s)
        )
      );

    const allCompleted = [
      ...(existing.completedActions || []),
      ...(newInfo.completedActions || []),
    ].filter((v, i, a) => a.indexOf(v) === i);

    const summaryText = this.renderSummary(
      newInfo.sessionIntent || existing.sessionIntent,
      mergedFiles.slice(-20),
      mergedDecisions.slice(-10),
      mergedNextSteps.slice(-10),
      allCompleted.slice(-20)
    );

    return {
      sessionIntent: newInfo.sessionIntent || existing.sessionIntent,
      fileModifications: mergedFiles.slice(-20),
      decisions: mergedDecisions.slice(-10),
      nextSteps: mergedNextSteps.slice(-10),
      completedActions: allCompleted.slice(-20),
      tokenCount: this.estimateTokensText(summaryText),
      compressionRatio: 0,
      lastUpdated: Date.now(),
    };
  }

  private processToolUse(
    toolName: string,
    input: Record<string, unknown>,
    fileChanges: FileChange[],
    completedActions: string[],
    decisions: Decision[]
  ): void {
    switch (toolName) {
      case 'write_file': {
        const path = String(input.file_path || input.filePath || 'unknown');
        const summary = String(input.content || '').slice(0, 100);
        fileChanges.push({
          path,
          action: 'created',
          summary: `Created (${summary.length} chars)`,
          timestamp: Date.now(),
        });
        completedActions.push(`Created ${path}`);
        break;
      }
      case 'edit_file': {
        const path = String(input.file_path || input.filePath || 'unknown');
        // Check if we already have a recent change for this file
        const existing = fileChanges.find((f) => f.path === path && Date.now() - f.timestamp < 60000);
        if (existing) {
          existing.action = 'modified';
          existing.summary = `Modified (${Date.now() - existing.timestamp}ms ago)`;
          existing.timestamp = Date.now();
        } else {
          fileChanges.push({
            path,
            action: 'modified',
            summary: 'Modified',
            timestamp: Date.now(),
          });
        }
        completedActions.push(`Edited ${path}`);
        break;
      }
      case 'execute_command': {
        const cmd = String((input as any).command || (input as any).params?.command || 'unknown');
        completedActions.push(`Ran: ${cmd.slice(0, 80)}`);
        break;
      }
      case 'search_content':
      case 'search_file': {
        const query = String(input.query || input.pattern || input.glob_pattern || 'unknown');
        completedActions.push(`Searched: ${query.slice(0, 60)}`);
        break;
      }
      case 'read_file': {
        const path = String(input.file_path || input.filePath || 'unknown');
        completedActions.push(`Read ${path}`);
        break;
      }
    }
  }

  private extractFromText(
    text: string,
    decisions: Decision[],
    nextSteps: string[],
    completedActions: string[]
  ): void {
    // Extract "decided to" or "chose to" patterns
    const decisionPatterns = [
      /(?:decided|chose|opted)\s+to\s+(.+)/gi,
      /(?:going|will)\s+(?:use|implement|go with|try)\s+(.+)/gi,
    ];
    for (const pattern of decisionPatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        decisions.push({
          id: `d-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          topic: match[1].slice(0, 50),
          reasoning: '',
          outcome: match[1].slice(0, 100),
          timestamp: Date.now(),
        });
      }
    }

    // Extract "next step" / "todo" / "need to" patterns
    const nextPatterns = [
      /(?:next\s+(?:step|up)|todo|need\s+to|should|must)\s*[:\-]?\s*(.+)/gi,
      /\d+\.\s+\*\*(.+)\*\*/g,  // Markdown numbered bold items
    ];
    for (const pattern of nextPatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        const step = match[1].trim().slice(0, 100);
        if (step.length > 3) {
          nextSteps.push(step);
        }
      }
    }
  }

  private hasPreciseHistory(messages: Message[]): boolean {
    // Check if there are any file edits or commands that represent precise work
    for (const msg of messages) {
      for (const block of msg.content) {
        if (block.type === 'tool_use') {
          if (block.name === 'edit_file' || block.name === 'write_file' || block.name === 'execute_command') {
            return true;
          }
        }
      }
    }
    return false;
  }

  private deduplicateDecisions(decisions: Decision[]): Decision[] {
    const seen = new Set<string>();
    return decisions.filter((d) => {
      const key = d.topic.toLowerCase().slice(0, 30);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private getCompressionReason(
    action: CompressionAction,
    removedCount: number,
    originalTokens: number,
    resultingTokens: number
  ): string {
    const saved = originalTokens - resultingTokens;
    const pct = originalTokens > 0 ? ((saved / originalTokens) * 100).toFixed(0) : '0';
    switch (action) {
      case 'compress':
        return `Light compression: removed ${removedCount} old messages, saved ~${pct}% tokens`;
      case 'summarize':
        return `Summarized ${removedCount} old messages into structured summary, saved ~${pct}% tokens`;
      case 'retrieve':
        return `Aggressive compression with retrieval: summarized ${removedCount} messages, saved ~${pct}% tokens`;
      default:
        return `No compression needed`;
    }
  }

  /** Exposed token estimation for messages (public API) */
  estimateTokens(messages: Message[]): number {
    return this.estimateMessagesTokens(messages);
  }

  /** Get compression history */
  getCompressionHistory(): Array<{ action: CompressionAction; timestamp: Date; originalTokens: number; resultingTokens: number }> {
    return [];
  }

  /** Get compressor stats */
  getStats(): { totalCompressions: number; tokensSaved: number } {
    return { totalCompressions: 0, tokensSaved: 0 };
  }

  private estimateTokensText(text: string): number {
    return Math.ceil(text.length / 4);
  }

  private estimateMessagesTokens(messages: Message[]): number {
    let total = 0;
    for (const msg of messages) {
      const content = Array.isArray(msg.content) ? msg.content : [];
      for (const block of content) {
        if (block.type === 'text') {
          total += this.estimateTokensText(block.text);
        } else if (block.type === 'tool_use') {
          total += this.estimateTokensText(JSON.stringify(block.input));
        } else if (block.type === 'tool_result') {
          const content = typeof block.content === 'string' ? block.content : JSON.stringify(block.content);
          total += this.estimateTokensText(content);
        } else if (block.type === 'thinking') {
          total += this.estimateTokensText(block.thinking);
        }
      }
    }
    return total;
  }
}
