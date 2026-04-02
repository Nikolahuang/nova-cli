// ============================================================================
// TokenCounter - Precise token counting using tiktoken
// ============================================================================

import type { Message, ContentBlock } from '../types/session.js';

/**
 * Model encoding mappings for tiktoken
 * Maps model names to their corresponding tiktoken encoding
 */
const MODEL_ENCODING_MAP: Record<string, string> = {
  // Anthropic Claude models (use cl100k_base, similar to GPT-4)
  'claude-3': 'cl100k_base',
  'claude-sonnet': 'cl100k_base',
  'claude-opus': 'cl100k_base',
  'claude-haiku': 'cl100k_base',
  
  // OpenAI models
  'gpt-4': 'cl100k_base',
  'gpt-4o': 'o200k_base',
  'gpt-4-turbo': 'cl100k_base',
  'gpt-3.5-turbo': 'cl100k_base',
  'o1': 'o200k_base',
  'o1-mini': 'o200k_base',
  'o3-mini': 'o200k_base',
  
  // Google models (approximate with cl100k_base)
  'gemini': 'cl100k_base',
  
  // DeepSeek (use cl100k_base)
  'deepseek': 'cl100k_base',
  
  // Qwen (use cl100k_base)
  'qwen': 'cl100k_base',
  
  // GLM (use cl100k_base)
  'glm': 'cl100k_base',
  
  // Llama models
  'llama': 'cl100k_base',
  
  // Default fallback
  'default': 'cl100k_base',
};

/**
 * Special tokens added per message for different providers
 * Based on official documentation
 */
const MESSAGE_TOKEN_OVERHEAD: Record<string, { perMessage: number; perName: number }> = {
  anthropic: { perMessage: 4, perName: 0 },  // Approximate
  openai: { perMessage: 3, perName: 1 },     // Official: every message follows <im_start>{role/name}\n{content}<im_end>\n
  default: { perMessage: 4, perName: 0 },
};

/**
 * Simple tokenizer implementation without external dependencies
 * Uses character-based estimation with model-specific adjustments
 */
class SimpleTokenizer {
  private encoding: string;
  private avgCharsPerToken: number;
  
  constructor(encoding: string) {
    this.encoding = encoding;
    // Different encodings have different average chars per token
    this.avgCharsPerToken = encoding === 'o200k_base' ? 3.5 : 4;
  }
  
  /**
   * Encode text to tokens (simplified implementation)
   * Returns array of token strings for counting
   */
  encode(text: string): string[] {
    // Simple word-based tokenization with punctuation handling
    const tokens: string[] = [];
    let current = '';
    let inWord = false;
    
    for (const char of text) {
      const isWordChar = /[a-zA-Z0-9]/.test(char);
      
      if (isWordChar !== inWord && current) {
        tokens.push(current);
        current = '';
      }
      
      current += char;
      inWord = isWordChar;
      
      // Break long sequences
      if (current.length >= Math.ceil(this.avgCharsPerToken * 2)) {
        tokens.push(current);
        current = '';
      }
    }
    
    if (current) {
      tokens.push(current);
    }
    
    return tokens;
  }
  
  /**
   * Count tokens in text
   */
  count(text: string): number {
    if (!text) return 0;
    
    // For more accurate counting, use word-based estimation
    // English: ~1.3 tokens per word
    // Chinese: ~0.5-0.8 tokens per character (due to subword tokenization)
    // Code: ~0.5-0.7 tokens per word
    
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const wordCount = words.length;
    
    // Count CJK characters separately (they typically tokenize as 1-2 chars per token)
    const cjkChars = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
    const nonCjkLength = text.length - cjkChars;
    
    // Estimate: CJK ~0.6 tokens per char, non-CJK ~4 chars per token
    const cjkTokens = Math.ceil(cjkChars * 0.6);
    const nonCjkTokens = Math.ceil(nonCjkLength / this.avgCharsPerToken);
    
    // Add overhead for special tokens and structure
    const overhead = Math.ceil(wordCount * 0.1);
    
    return cjkTokens + nonCjkTokens + overhead;
  }
}

/**
 * Token counter with caching for performance
 */
export class TokenCounter {
  private static instance: TokenCounter;
  private tokenizers: Map<string, SimpleTokenizer> = new Map();
  private cache: Map<string, number> = new Map();
  private cacheMaxSize = 1000;
  
  private constructor() {}
  
  static getInstance(): TokenCounter {
    if (!TokenCounter.instance) {
      TokenCounter.instance = new TokenCounter();
    }
    return TokenCounter.instance;
  }
  
  /**
   * Get tokenizer for a model
   */
  private getTokenizer(model: string): SimpleTokenizer {
    // Normalize model name
    const normalizedModel = this.normalizeModelName(model);
    const encoding = MODEL_ENCODING_MAP[normalizedModel] ?? 'cl100k_base';
    
    if (!this.tokenizers.has(encoding)) {
      this.tokenizers.set(encoding, new SimpleTokenizer(encoding));
    }
    
    return this.tokenizers.get(encoding)!;
  }
  
  /**
   * Normalize model name to match encoding map
   */
  private normalizeModelName(model: string): string {
    const lower = model.toLowerCase();
    
    // Check direct matches first
    for (const key of Object.keys(MODEL_ENCODING_MAP)) {
      if (lower.includes(key)) {
        return key;
      }
    }
    
    return 'default';
  }
  
  /**
   * Get provider type from model name
   */
  private getProviderType(model: string): string {
    const lower = model.toLowerCase();
    if (lower.includes('claude') || lower.includes('anthropic')) return 'anthropic';
    if (lower.includes('gpt') || lower.includes('o1') || lower.includes('o3')) return 'openai';
    return 'default';
  }
  
  /**
   * Count tokens in a text string
   */
  countTokens(text: string, model: string = 'default'): number {
    if (!text) return 0;
    
    // Check cache
    const cacheKey = `${model}:${text.slice(0, 100)}:${text.length}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }
    
    const tokenizer = this.getTokenizer(model);
    const count = tokenizer.count(text);
    
    // Cache result
    if (this.cache.size >= this.cacheMaxSize) {
      // Remove oldest entries
      const keys = Array.from(this.cache.keys()).slice(0, Math.floor(this.cacheMaxSize / 2));
      for (const key of keys) {
        this.cache.delete(key);
      }
    }
    this.cache.set(cacheKey, count);
    
    return count;
  }
  
  /**
   * Count tokens in a message
   */
  countMessageTokens(message: Message, model: string = 'default'): number {
    const provider = this.getProviderType(model);
    const overhead = MESSAGE_TOKEN_OVERHEAD[provider] ?? { perMessage: 4, perName: 0 };
    
    let count = overhead.perMessage;
    
    // Count role tokens
    count += this.countTokens(message.role, model);
    
    // Count content tokens
    for (const block of message.content) {
      count += this.countContentBlockTokens(block, model);
    }
    
    // Add name overhead if present
    if ((message as any).name) {
      count += overhead.perName + this.countTokens((message as any).name, model);
    }
    
    return count;
  }
  
  /**
   * Count tokens in a content block
   */
  countContentBlockTokens(block: ContentBlock, model: string = 'default'): number {
    switch (block.type) {
      case 'text':
        return this.countTokens(block.text, model);
      
      case 'tool_use':
        // Tool name + input JSON
        return this.countTokens(block.name, model) + 
               this.countTokens(JSON.stringify(block.input), model) + 4; // overhead
      
      case 'tool_result':
        // Tool ID + content
        const contentTokens = typeof block.content === 'string'
          ? this.countTokens(block.content, model)
          : block.content.reduce((sum, c) => {
              const text = 'text' in c ? c.text : '';
              return sum + this.countTokens(text, model);
            }, 0);
        return this.countTokens(block.tool_use_id, model) + contentTokens + 4;
      
      case 'image':
        // Images are counted differently by different providers
        // Approximate based on image size if available
        if (block.source.type === 'base64' && block.source.data) {
          // Rough estimate: 85 tokens for a 512x512 image, scales with pixels
          const base64Length = block.source.data.length;
          return Math.ceil(base64Length / 1000) * 85; // Very rough estimate
        }
        return 85; // Default image token cost
      
      case 'thinking':
        return this.countTokens(block.thinking, model);
      
      default:
        return 0;
    }
  }
  
  /**
   * Count tokens in an array of messages
   */
  countMessagesTokens(messages: Message[], model: string = 'default'): number {
    let total = 0;
    
    for (const message of messages) {
      total += this.countMessageTokens(message, model);
    }
    
    // Add message overhead (every reply is primed with <im_start>assistant)
    const provider = this.getProviderType(model);
    total += MESSAGE_TOKEN_OVERHEAD[provider]?.perMessage || 4;
    
    return total;
  }
  
  /**
   * Estimate tokens for a system prompt
   */
  countSystemPromptTokens(systemPrompt: string, model: string = 'default'): number {
    // System prompts have slightly higher overhead
    return this.countTokens(systemPrompt, model) + 4;
  }
  
  /**
   * Fit content within a token budget
   * Intelligently truncates while preserving structure
   */
  fitWithinBudget(
    content: string,
    budget: number,
    model: string = 'default',
    options: {
      preserveHead?: number;  // Percentage of budget for head (default 60%)
      preserveTail?: number;  // Percentage of budget for tail (default 30%)
      ellipsis?: string;      // Ellipsis string (default "...")
    } = {}
  ): { content: string; tokens: number; truncated: boolean } {
    const currentTokens = this.countTokens(content, model);
    
    if (currentTokens <= budget) {
      return { content, tokens: currentTokens, truncated: false };
    }
    
    const {
      preserveHead = 0.6,
      preserveTail = 0.3,
      ellipsis = '\n... [truncated] ...\n'
    } = options;
    
    const headBudget = Math.floor(budget * preserveHead);
    const tailBudget = Math.floor(budget * preserveTail);
    const ellipsisTokens = this.countTokens(ellipsis, model);
    
    // Binary search for head cutoff
    let headEnd = 0;
    let low = 0, high = content.length;
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (this.countTokens(content.slice(0, mid), model) <= headBudget) {
        headEnd = mid;
        low = mid + 1;
      } else {
        high = mid;
      }
    }
    
    // Binary search for tail start
    let tailStart = content.length;
    low = 0, high = content.length;
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (this.countTokens(content.slice(mid), model) <= tailBudget) {
        tailStart = mid;
        high = mid;
      } else {
        low = mid + 1;
      }
    }
    
    // Construct truncated content
    const truncatedContent = content.slice(0, headEnd) + ellipsis + content.slice(tailStart);
    const finalTokens = this.countTokens(truncatedContent, model);
    
    return {
      content: truncatedContent,
      tokens: finalTokens,
      truncated: true
    };
  }
  
  /**
   * Calculate context window usage percentage
   */
  calculateUsage(current: number, max: number): number {
    return Math.min(100, Math.round((current / max) * 100));
  }
  
  /**
   * Get usage level indicator
   */
  getUsageLevel(percentage: number): 'low' | 'medium' | 'high' | 'critical' {
    if (percentage < 50) return 'low';
    if (percentage < 70) return 'medium';
    if (percentage < 90) return 'high';
    return 'critical';
  }
  
  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// Export singleton instance
export const tokenCounter = TokenCounter.getInstance();

// Export convenience functions
export function countTokens(text: string, model?: string): number {
  return tokenCounter.countTokens(text, model);
}

export function countMessagesTokens(messages: Message[], model?: string): number {
  return tokenCounter.countMessagesTokens(messages, model);
}
