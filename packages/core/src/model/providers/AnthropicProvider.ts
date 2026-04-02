// ============================================================================
// Anthropic Provider - Claude API integration
// ============================================================================

import Anthropic from '@anthropic-ai/sdk';
import type { Message, ContentBlock, ToolUseContent, ToolResultContent, SessionId } from '../../types/session.js';
import type { ToolDefinition } from '../../types/tools.js';
import type { ModelProvider, ModelRequestOptions, ModelResponse, TokenUsage, StreamEvent } from '../types.js';
import { ModelError, RateLimitError } from '../../types/errors.js';
import { createToolCallId, createMessageId } from '../../types/session.js';
import { tokenCounter } from '../../utils/TokenCounter.js';

export interface AnthropicProviderConfig {
  apiKey: string;
  baseUrl?: string;
  model: string;
  apiVersion?: string;
}

export class AnthropicProvider implements ModelProvider {
  readonly name = 'Anthropic';
  private client: Anthropic;
  private enableCache: boolean;

  constructor(config: AnthropicProviderConfig & { enableCache?: boolean }) {
    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      ...(config.apiVersion && { defaultHeaders: { 'anthropic-version': config.apiVersion } }),
    });
    this.enableCache = config.enableCache !== false; // Default to true
  }

  async complete(messages: Message[], options: ModelRequestOptions): Promise<ModelResponse> {
    try {
      const anthropicMessages = this.convertMessages(messages);
      
      // Convert tools with cache control if caching is enabled
      const anthropicTools = this.convertTools(options.tools);
      
      // Prepare params
      const params: any = {
        model: options.model,
        max_tokens: options.maxTokens,
        messages: anthropicMessages,
        ...(anthropicTools.length > 0 && { tools: anthropicTools }),
        ...(options.stopSequences && options.stopSequences.length > 0 && { stop_sequences: options.stopSequences }),
      };
      
      // Add system prompt with cache control if enabled
      if (options.systemPrompt) {
        if (this.enableCache && options.thinking !== 'disabled') {
          params.system = [
            {
              type: 'text',
              text: options.systemPrompt,
              cache_control: { type: 'ephemeral' }
            }
          ];
        } else {
          params.system = options.systemPrompt;
        }
      }
      
      // Add beta header for caching
      const requestOptions: any = {};
      if (this.enableCache && options.thinking !== 'disabled') {
        requestOptions.headers = {
          'anthropic-beta': 'prompt-caching-2024-07-31'
        };
      }

      const response = await this.client.messages.create(params, requestOptions);

      const content = this.convertResponseContent(response.content);
      const usage = this.convertUsage(response.usage);

      return {
        content,
        model: response.model,
        stopReason: this.convertStopReason(response.stop_reason),
        usage,
        sessionId: options.sessionId,
      };
    } catch (err) {
      if (err instanceof Anthropic.APIError) {
        if (err.status === 429) {
          const retryAfter = parseInt(err.headers?.['retry-after'] || '60', 10) * 1000;
          throw new RateLimitError(err.message, retryAfter, 'anthropic');
        }
        throw new ModelError(err.message, err.status, 'anthropic', err);
      }
      throw err;
    }
  }

  async *stream(messages: Message[], options: ModelRequestOptions): AsyncGenerator<StreamEvent> {
    try {
      const anthropicMessages = this.convertMessages(messages);
      
      // Convert tools with cache control if caching is enabled
      const anthropicTools = this.convertTools(options.tools);
      
      // Prepare params
      const params: any = {
        model: options.model,
        max_tokens: options.maxTokens,
        messages: anthropicMessages,
        ...(anthropicTools.length > 0 && { tools: anthropicTools }),
        stream: true,
      };
      
      // Add system prompt with cache control if enabled
      if (options.systemPrompt) {
        if (this.enableCache && options.thinking !== 'disabled') {
          params.system = [
            {
              type: 'text',
              text: options.systemPrompt,
              cache_control: { type: 'ephemeral' }
            }
          ];
        } else {
          params.system = options.systemPrompt;
        }
      }
      
      // Add beta header for caching
      const requestOptions: any = {};
      if (this.enableCache && options.thinking !== 'disabled') {
        requestOptions.headers = {
          'anthropic-beta': 'prompt-caching-2024-07-31'
        };
      }

      const stream = await this.client.messages.create(params, requestOptions) as unknown as AsyncIterable<Anthropic.Messages.MessageStreamEvent>;

      for await (const event of stream) {
        if (event.type === 'message_start') {
          yield { type: 'message_start', model: event.message.model };
        } else if (event.type === 'content_block_start') {
          if (event.content_block.type === 'text') {
            // noop, deltas follow
          } else if (event.content_block.type === 'tool_use') {
            yield {
              type: 'tool_call_start',
              toolCallId: event.content_block.id,
              toolName: event.content_block.name,
            };
          }
        } else if (event.type === 'content_block_delta') {
          if (event.delta.type === 'text_delta') {
            yield { type: 'text_delta', delta: event.delta.text };
          } else if ((event.delta as any).type === 'thinking_delta') {
            yield { type: 'thinking_delta', delta: (event.delta as any).thinking };
          } else if (event.delta.type === 'input_json_delta') {
            yield {
              type: 'tool_call_delta',
              toolCallId: (event as Anthropic.ContentBlockDeltaEvent).index?.toString() || '',
              delta: event.delta.partial_json,
            };
          }
        } else if (event.type === 'content_block_stop') {
          // noop
        } else if (event.type === 'message_delta') {
          if (event.delta.stop_reason) {
            const usage: TokenUsage = {
              inputTokens: (event.usage as any)?.input_tokens ?? 0,
              outputTokens: (event.usage as any)?.output_tokens ?? 0,
            };
            yield {
              type: 'message_complete',
              stopReason: this.convertStopReason(event.delta.stop_reason),
              usage,
            };
          }
        } else if (event.type === 'message_stop') {
          // Stream complete
        }
      }
    } catch (err) {
      if (err instanceof Anthropic.APIError) {
        yield { type: 'error', error: new ModelError(err.message, err.status, 'anthropic', err) };
      } else {
        yield { type: 'error', error: err };
      }
    }
  }

  async countTokens(messages: Message[]): Promise<number> {
    // Approximate: ~4 chars per token
    const text = messages.map(m => {
      if (typeof m.content === 'string') return m.content;
      return m.content.map(c => c.type === 'text' ? (c as any).text || '' : '').join('');
    }).join('');
    return Math.ceil(text.length / 4);
  }

  // --- Conversion helpers ---

  private convertMessages(messages: Message[]): Anthropic.MessageParam[] {
    const result: Anthropic.MessageParam[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') continue; // System messages handled separately

      if (msg.role === 'tool') {
        const toolResults = msg.content
          .filter((c): c is ToolResultContent => c.type === 'tool_result')
          .map((c): Anthropic.ToolResultBlockParam => ({
            type: 'tool_result',
            tool_use_id: c.tool_use_id,
            content: typeof c.content === 'string' ? c.content : c.content.map((cc) => 'text' in cc ? (cc as any).text || '' : '').join(''),
            is_error: c.is_error,
          }));

        result.push({ role: 'user', content: toolResults });
        continue;
      }

      const content = msg.content
        .map((c) => {
          if (c.type === 'text') return { type: 'text' as const, text: c.text };
          if (c.type === 'tool_use') return { type: 'tool_use' as const, id: c.id, name: c.name, input: c.input };
          if (c.type === 'image') return {
            type: 'image' as const,
            source: { type: c.source.type === 'url' ? 'url' : 'base64', media_type: c.source.media_type, data: c.source.data || c.source.url || '' },
          };
          return null;
        })
        .filter((c): c is NonNullable<typeof c> => c !== null) as Anthropic.ContentBlock[];

      result.push({ role: msg.role as 'user' | 'assistant', content });
    }

    return result;
  }

  private convertTools(tools: ToolDefinition[]): Anthropic.Tool[] {
    return tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema as Anthropic.Tool.InputSchema,
    }));
  }

  private convertResponseContent(content: Anthropic.Message['content']): ContentBlock[] {
    return content.map((block) => {
      if (block.type === 'text') return { type: 'text' as const, text: block.text };
      if (block.type === 'tool_use') return {
        type: 'tool_use' as const,
        id: createToolCallId(block.id),
        name: block.name,
        input: block.input as Record<string, unknown>,
      };
      return { type: 'text', text: JSON.stringify(block) };
    });
  }

  private convertUsage(usage: Anthropic.Usage): TokenUsage {
    const usageAny = usage as any;
    return {
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      cacheReadTokens: usageAny.cache_read_input_tokens as number | undefined,
      cacheWriteTokens: usageAny.cache_creation_input_tokens as number | undefined,
    };
  }

  private convertStopReason(reason: string | null): ModelResponse['stopReason'] {
    switch (reason) {
      case 'end_turn': return 'end_turn';
      case 'tool_use': return 'tool_use';
      case 'max_tokens': return 'max_tokens';
      case 'stop_sequence': return 'stop_sequence';
      default: return 'end_turn';
    }
  }
}
