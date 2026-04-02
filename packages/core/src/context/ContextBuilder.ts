// ============================================================================
// ContextBuilder - Builds system prompt and context from discovered memory
// ============================================================================

import type { Message, SessionConfig } from '../types/session.js';
import { MemoryDiscovery, type MemoryFile } from './MemoryDiscovery.js';

export interface ContextBuilderOptions {
  /** Session configuration */
  sessionConfig: SessionConfig;
  /** Base system prompt */
  baseSystemPrompt?: string;
  /** Memory discovery instance */
  memoryDiscovery: MemoryDiscovery;
  /** Additional context sections */
  additionalContext?: Array<{ heading: string; content: string }>;
}

export interface BuiltContext {
  systemPrompt: string;
  memoryFiles: MemoryFile[];
  totalContextTokens: number;
  truncated: boolean;
}

export class ContextBuilder {
  private sessionConfig: SessionConfig;
  private baseSystemPrompt?: string;
  private memoryDiscovery: MemoryDiscovery;
  private additionalContext: Array<{ heading: string; content: string }>;

  constructor(options: ContextBuilderOptions) {
    this.sessionConfig = options.sessionConfig;
    this.baseSystemPrompt = options.baseSystemPrompt;
    this.memoryDiscovery = options.memoryDiscovery;
    this.additionalContext = options.additionalContext || [];
  }

  /** Build the full system prompt with context */
  async build(): Promise<BuiltContext> {
    const memoryFiles = await this.memoryDiscovery.discover();
    const sections: string[] = [];

    // Base system prompt
    if (this.baseSystemPrompt) {
      sections.push(this.baseSystemPrompt);
    }

    // Session-specific system prompt
    if (this.sessionConfig.systemPrompt) {
      sections.push(this.sessionConfig.systemPrompt);
    }

    // Working directory context
    sections.push(`Working directory: ${this.sessionConfig.workingDirectory}`);

    // Memory files context
    if (memoryFiles.length > 0) {
      const memorySection = this.buildMemorySection(memoryFiles);
      if (memorySection) {
        sections.push(memorySection);
      }
    }

    // Additional context sections
    for (const ctx of this.additionalContext) {
      sections.push(`## ${ctx.heading}\n${ctx.content}`);
    }

    const systemPrompt = sections.join('\n\n---\n\n');
    const totalContextTokens = this.estimateTokens(systemPrompt);

    return {
      systemPrompt,
      memoryFiles,
      totalContextTokens,
      truncated: false,
    };
  }

  /** Build memory section from discovered files */
  private buildMemorySection(files: MemoryFile[]): string {
    const parts: string[] = ['# Project Context & Memory'];

    // Group by category
    const grouped = new Map<MemoryFile['category'], MemoryFile[]>();
    for (const file of files) {
      const cat = file.category;
      if (!grouped.has(cat)) grouped.set(cat, []);
      grouped.get(cat)!.push(file);
    }

    // Add project memory first
    const projectFiles = grouped.get('project');
    if (projectFiles && projectFiles.length > 0) {
      parts.push('\n### Project Knowledge');
      for (const file of projectFiles.slice(0, 5)) {
        const relPath = file.filePath.replace(/\\/g, '/');
        const content = file.content.length > 2000
          ? file.content.slice(0, 2000) + '\n... (truncated)'
          : file.content;
        parts.push(`\n<project-memory file="${relPath}">\n${content}\n</project-memory>`);
      }
    }

    // Add convention files
    const conventionFiles = grouped.get('convention');
    if (conventionFiles && conventionFiles.length > 0) {
      parts.push('\n### Conventions & Rules');
      for (const file of conventionFiles.slice(0, 3)) {
        const relPath = file.filePath.replace(/\\/g, '/');
        const content = file.content.length > 1500
          ? file.content.slice(0, 1500) + '\n... (truncated)'
          : file.content;
        parts.push(`\n<convention file="${relPath}">\n${content}\n</convention>`);
      }
    }

    return parts.join('\n');
  }

  /** Compress context when it gets too long */
  compress(messages: Message[], maxTokens: number): Message[] {
    const estimatedTokens = this.estimateMessagesTokens(messages);

    if (estimatedTokens <= maxTokens) {
      return messages;
    }

    // Remove oldest non-system messages first
    const systemMessages = messages.filter((m) => m.role === 'system');
    const nonSystemMessages = messages.filter((m) => m.role !== 'system');

    // Binary search for the right number of messages to keep
    let keep = Math.floor(nonSystemMessages.length * 0.7);
    while (keep > 1) {
      const testMessages = [...systemMessages, ...nonSystemMessages.slice(-keep)];
      if (this.estimateMessagesTokens(testMessages) <= maxTokens * 0.9) {
        break;
      }
      keep = Math.floor(keep * 0.8);
    }

    const kept = [...systemMessages, ...nonSystemMessages.slice(-keep)];
    return kept;
  }

  /** Estimate token count for text (rough: 4 chars per token) */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /** Estimate tokens for messages */
  private estimateMessagesTokens(messages: Message[]): number {
    let total = 0;
    for (const msg of messages) {
      for (const block of msg.content) {
        if (block.type === 'text') {
          total += this.estimateTokens(block.text);
        } else if (block.type === 'tool_use') {
          total += this.estimateTokens(JSON.stringify(block.input));
        } else if (block.type === 'tool_result') {
          const content = typeof block.content === 'string' ? block.content : 
            (Array.isArray(block.content) ? block.content.map((c: any) => c.text || '').join('') : '');
          total += this.estimateTokens(content);
        }
      }
    }
    return total;
  }
}
