// ============================================================================
// OptimizedContextCompressor - Performance-optimized context compression
// ============================================================================

import type { Message, ContentBlock, SessionId } from '../types/session.js';
import { StructuredSummary, CompressionResult, CompressionOptions } from './ContextCompressor.js';

const DEFAULT_OPTIONS = {
  maxTokens: 128000,
  compressThreshold: 0.6,
  aggressiveThreshold: 0.85,
  keepRecentCount: 5,
  extractStructuredInfo: true,
  existingSummary: undefined,
};

export class OptimizedContextCompressor {
  private currentSummary: StructuredSummary | null = null;
  private sessionId: SessionId | null = null;
  private maxTokens: number;
  
  // Performance optimizations
  private tokenCache = new Map<string, number>();
  private messageTokenCache = new Map<string, number>();
  private compressionHistory: Array<{
    action: string;
    timestamp: Date;
    originalTokens: number;
    resultingTokens: number;
  }> = [];
  private totalTokensSaved = 0;

  constructor(options?: { sessionId?: SessionId; maxTokens?: number } | SessionId) {
    if (typeof options === 'string') {
      this.sessionId = options;
      this.maxTokens = DEFAULT_OPTIONS.maxTokens;
    } else {
      this.sessionId = options?.sessionId || null;
      this.maxTokens = options?.maxTokens || DEFAULT_OPTIONS.maxTokens;
    }
  }

  /**
   * Optimized token estimation with caching
   */
  private estimateTokensFast(text: string): number {
    if (!text) return 0;
    
    // Check cache first
    const cacheKey = text.slice(0, 100);
    if (this.tokenCache.has(cacheKey)) {
      return this.tokenCache.get(cacheKey)!;
    }

    // Fast estimation: ~4 chars per token for English, ~2 chars per token for Chinese
    const cjkChars = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
    const nonCjkChars = text.length - cjkChars;
    
    // Estimate: CJK ~2 chars per token, non-CJK ~4 chars per token
    const tokens = Math.ceil(cjkChars / 2) + Math.ceil(nonCjkChars / 4);
    
    // Cache result (limit cache size)
    if (this.tokenCache.size < 1000) {
      this.tokenCache.set(cacheKey, tokens);
    }
    
    return tokens;
  }

  /**
   * Optimized message token counting
   */
  private estimateMessageTokensFast(message: Message): number {
    const cacheKey = `${message.id}-${message.role}`;
    
    if (this.messageTokenCache.has(cacheKey)) {
      return this.messageTokenCache.get(cacheKey)!;
    }

    let total = 4; // Base overhead per message
    
    // Count role
    total += this.estimateTokensFast(message.role);
    
    // Count content
    for (const block of message.content) {
      total += this.estimateContentBlockTokensFast(block);
    }

    // Cache result
    if (this.messageTokenCache.size < 1000) {
      this.messageTokenCache.set(cacheKey, total);
    }

    return total;
  }

  /**
   * Optimized content block token counting
   */
  private estimateContentBlockTokensFast(block: ContentBlock): number {
    switch (block.type) {
      case 'text':
        return this.estimateTokensFast(block.text);
      
      case 'tool_use':
        return this.estimateTokensFast(block.name) + 
               this.estimateTokensFast(JSON.stringify(block.input)) + 4;
      
      case 'tool_result':
        const content = typeof block.content === 'string' ? block.content : JSON.stringify(block.content);
        return this.estimateTokensFast(block.tool_use_id) + 
               this.estimateTokensFast(content) + 4;
      
      case 'thinking':
        return this.estimateTokensFast(block.thinking);
      
      default:
        return 0;
    }
  }

  /**
   * Fast compression decision based on message count and rough token estimation
   */
  private shouldCompressFast(messages: Message[]): boolean {
    const messageCount = messages.length;
    
    // Quick heuristic: if we have more than 50 messages, compression is likely needed
    if (messageCount > 50) {
      return true;
    }
    
    // For smaller message counts, do rough token estimation
    if (messageCount > 20) {
      // Estimate total tokens (rough but fast)
      let estimatedTokens = 0;
      for (let i = 0; i < Math.min(messageCount, 30); i++) {
        estimatedTokens += this.estimateMessageTokensFast(messages[i]);
      }
      // Extrapolate for remaining messages
      estimatedTokens = Math.floor(estimatedTokens * (messageCount / 30));
      
      return estimatedTokens > this.maxTokens * 0.6;
    }
    
    return false;
  }

  /**
   * Optimized compression with reduced overhead
   */
  compress(
    messages: Message[],
    options?: CompressionOptions
  ): CompressionResult {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    
    // Fast path: check if compression is needed
    if (!this.shouldCompressFast(messages)) {
      const tokenCount = this.estimateMessagesTokensFast(messages);
      return {
        action: 'keep',
        reason: 'Compression not needed based on fast heuristic',
        messages,
        resultingTokens: tokenCount,
        originalTokens: tokenCount,
      };
    }

    const originalTokens = this.estimateMessagesTokensFast(messages);
    
    // Separate system messages
    const systemMessages = messages.filter((m) => m.role === 'system');
    const nonSystemMessages = messages.filter((m) => m.role !== 'system');

    if (nonSystemMessages.length <= opts.keepRecentCount) {
      return {
        action: 'keep',
        reason: 'Too few non-system messages to compress',
        messages,
        resultingTokens: originalTokens,
        originalTokens,
      };
    }

    // Split into recent and old messages
    const recentMessages = nonSystemMessages.slice(-opts.keepRecentCount);
    const oldMessages = nonSystemMessages.slice(0, -opts.keepRecentCount);

    // Extract structured info from old messages (optimized)
    let summary = opts.existingSummary || this.currentSummary;
    if (opts.extractStructuredInfo && oldMessages.length > 0) {
      summary = this.extractStructuredInfoFast(oldMessages, summary);
      this.currentSummary = summary;
    }

    // Build compressed message list
    const compressedMessages: Message[] = [...systemMessages];
    
    if (summary) {
      compressedMessages.push(this.createSummaryMessage(summary));
    }
    
    compressedMessages.push(...recentMessages);

    const resultingTokens = this.estimateMessagesTokensFast(compressedMessages);

    // Track compression
    const savedTokens = originalTokens - resultingTokens;
    this.totalTokensSaved += savedTokens;
    this.compressionHistory.push({
      action: 'compress',
      timestamp: new Date(),
      originalTokens,
      resultingTokens,
    });

    return {
      action: 'compress',
      reason: `Compressed ${oldMessages.length} messages, saved ~${savedTokens} tokens`,
      messages: compressedMessages,
      summary,
      resultingTokens,
      originalTokens,
    };
  }

  /**
   * Fast structured info extraction
   */
  private extractStructuredInfoFast(
    messages: Message[],
    base: StructuredSummary | null
  ): StructuredSummary {
    const fileChanges = base ? [...base.fileModifications] : [];
    const decisions = base ? [...base.decisions] : [];
    const nextSteps: string[] = base ? [...base.nextSteps] : [];
    const completedActions: string[] = base ? [...base.completedActions] : [];
    let sessionIntent = base?.sessionIntent || '';

    // Process messages in batches to avoid blocking
    const batchSize = 50;
    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);
      
      for (const message of batch) {
        for (const block of message.content) {
          if (block.type === 'tool_use') {
            this.processToolUseFast(block.name, block.input, fileChanges, completedActions);
          } else if (block.type === 'text' && message.role === 'user' && !sessionIntent) {
            sessionIntent = block.text.slice(0, 200);
          }
        }
      }
    }

    // Deduplicate and limit arrays
    const uniqueDecisions = this.deduplicateDecisionsFast(decisions);
    const uniqueNextSteps = [...new Set(nextSteps.filter((s) => s.length > 0))];

    const summaryText = this.renderSummaryFast(
      sessionIntent,
      fileChanges.slice(-20),
      uniqueDecisions.slice(-10),
      uniqueNextSteps.slice(-10),
      completedActions.slice(-20)
    );

    return {
      sessionIntent: sessionIntent || 'User conversation',
      fileModifications: fileChanges.slice(-20),
      decisions: uniqueDecisions.slice(-10),
      nextSteps: uniqueNextSteps.slice(-10),
      completedActions: completedActions.slice(-20),
      tokenCount: this.estimateTokensFast(summaryText),
      compressionRatio: 0,
      lastUpdated: Date.now(),
    };
  }

  /**
   * Fast tool use processing
   */
  private processToolUseFast(
    toolName: string,
    input: Record<string, unknown>,
    fileChanges: Array<{ path: string; action: string; summary: string; timestamp: number }>,
    completedActions: string[]
  ): void {
    switch (toolName) {
      case 'write_file':
      case 'edit_file': {
        const path = String(input.file_path || input.filePath || 'unknown');
        fileChanges.push({
          path,
          action: toolName === 'write_file' ? 'created' : 'modified',
          summary: `${toolName === 'write_file' ? 'Created' : 'Modified'} file`,
          timestamp: Date.now(),
        });
        completedActions.push(`${toolName === 'write_file' ? 'Created' : 'Modified'} ${path}`);
        break;
      }
      case 'execute_command': {
        const cmd = String((input as any).command || 'unknown');
        completedActions.push(`Ran: ${cmd.slice(0, 80)}`);
        break;
      }
      default:
        completedActions.push(`Used tool: ${toolName}`);
    }
  }

  /**
   * Fast decision deduplication
   */
  private deduplicateDecisionsFast(
    decisions: Array<{ id: string; topic: string; outcome: string; timestamp: number }>
  ): Array<{ id: string; topic: string; outcome: string; timestamp: number }> {
    const seen = new Set<string>();
    return decisions.filter((d) => {
      const key = d.topic.toLowerCase().slice(0, 30);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Fast summary rendering
   */
  private renderSummaryFast(
    intent: string,
    files: Array<{ path: string; action: string; summary: string }>,
    decisions: Array<{ topic: string; outcome: string }>,
    nextSteps: string[],
    completed: string[]
  ): string {
    const parts: string[] = [];
    parts.push(`<context-summary>Session: ${intent || 'User conversation'}`);

    if (completed.length > 0) {
      parts.push(`Completed: ${completed.slice(0, 5).join('; ')}`);
    }

    if (files.length > 0) {
      parts.push(`Files: ${files.slice(0, 3).map((f) => `${f.action} ${f.path}`).join('; ')}`);
    }

    if (decisions.length > 0) {
      parts.push(`Decisions: ${decisions.slice(0, 3).map((d) => d.topic).join('; ')}`);
    }

    if (nextSteps.length > 0) {
      parts.push(`Next: ${nextSteps.slice(0, 3).join('; ')}`);
    }

    parts.push('</context-summary>');
    return parts.join('\n');
  }

  /**
   * Create summary message
   */
  private createSummaryMessage(summary: StructuredSummary): Message {
    return {
      id: `summary-${Date.now()}` as any,
      role: 'user' as const,
      content: [{ type: 'text', text: this.renderSummaryFast(
        summary.sessionIntent,
        summary.fileModifications,
        summary.decisions,
        summary.nextSteps,
        summary.completedActions
      ) }],
      timestamp: Date.now(),
      createdAt: new Date(),
      metadata: { isContextSummary: true },
    };
  }

  /**
   * Fast messages token estimation
   */
  private estimateMessagesTokensFast(messages: Message[]): number {
    let total = 0;
    for (const message of messages) {
      total += this.estimateMessageTokensFast(message);
    }
    return total + 4; // Add overhead for assistant reply priming
  }

  /**
   * Get compression stats
   */
  getStats() {
    return {
      totalCompressions: this.compressionHistory.length,
      tokensSaved: this.totalTokensSaved,
    };
  }

  /**
   * Clear caches
   */
  clearCaches() {
    this.tokenCache.clear();
    this.messageTokenCache.clear();
  }
}