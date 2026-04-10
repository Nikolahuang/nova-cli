// ============================================================================
// OllamaCloudProvider - Ollama Cloud API (https://ollama.com)
// ============================================================================
//
// Uses Ollama's native REST API (/api/chat) for cloud-hosted models.
// Supports:
// - All Ollama Cloud models (deepseek-v3.2, kimi-k2.5, qwen3-coder, etc.)
// - Streaming responses with thinking/reasoning support
// - Tool/function calling (Ollama native format)
// - Model discovery via /api/tags
// - API key authentication (Bearer token)
//
// NOTE: Ollama Cloud uses native API format, NOT OpenAI-compatible.
// ============================================================================

import type { Message, ContentBlock, ToolUseContent, ToolResultContent } from '../../types/session.js';
import type { ToolDefinition } from '../../types/tools.js';
import type { ModelProvider, ModelRequestOptions, ModelResponse, TokenUsage, StreamEvent } from '../types.js';
import { ModelError, RateLimitError } from '../../types/errors.js';
import { createToolCallId } from '../../types/session.js';

export interface OllamaCloudConfig {
  apiKey: string;
  baseUrl?: string;
  model: string;
}

/** Ollama Cloud /api/chat response format (non-streaming) */
interface OllamaChatResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
    thinking?: string;
    tool_calls?: Array<{
      function: {
        name: string;
        arguments: { [key: string]: unknown };
      };
    }>;
  };
  done: boolean;
  done_reason?: string;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

/** Ollama Cloud /api/chat streaming chunk */
interface OllamaChatChunk {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
    thinking?: string;
    tool_calls?: Array<{
      function: {
        name: string;
        arguments: { [key: string]: unknown };
      };
    }>;
  };
  done: boolean;
  done_reason?: string;
  prompt_eval_count?: number;
  eval_count?: number;
}

export class OllamaCloudProvider implements ModelProvider {
  readonly name = 'Ollama Cloud';
  private apiKey: string;
  private baseUrl: string;

  constructor(config: OllamaCloudConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl || 'https://ollama.com').replace(/\/+$/, '');
  }

  async complete(messages: Message[], options: ModelRequestOptions): Promise<ModelResponse> {
    const ollamaMessages = this.convertMessages(messages, options.systemPrompt);
    const tools = this.convertTools(options.tools);
    const body: Record<string, unknown> = {
      model: options.model,
      messages: ollamaMessages,
      stream: false,
      ...(tools.length > 0 && { tools }),
      ...(options.maxTokens && { options: { num_predict: options.maxTokens } }),
      ...(options.temperature !== undefined && options.temperature !== 1 && {
        options: { ...this.getOptions(options), temperature: options.temperature },
      }),
    };

    const res = await this.request('/api/chat', body);
    const data = await res.json() as OllamaChatResponse;

    if (!res.ok) {
      throw new ModelError(
        `Ollama Cloud API error: ${res.status} ${res.statusText} - ${JSON.stringify(data)}`,
        res.status,
        this.name,
      );
    }

    const content = this.convertResponseContent(data.message);
    const usage: TokenUsage = {
      inputTokens: data.prompt_eval_count || 0,
      outputTokens: data.eval_count || 0,
    };

    // Ollama returns done_reason "stop" even for tool calls; detect from response content
    const hasToolCalls = content.some((c): c is ToolUseContent => c.type === 'tool_use');
    const stopReason = hasToolCalls ? 'tool_use' : this.convertStopReason(data.done_reason);

    return {
      content,
      model: data.model,
      stopReason,
      usage,
      sessionId: options.sessionId,
    };
  }

  async *stream(messages: Message[], options: ModelRequestOptions): AsyncGenerator<StreamEvent> {
    const ollamaMessages = this.convertMessages(messages, options.systemPrompt);
    const tools = this.convertTools(options.tools);
    const body: Record<string, unknown> = {
      model: options.model,
      messages: ollamaMessages,
      stream: true,
      ...(tools.length > 0 && { tools }),
      options: this.getOptions(options),
    };

    let res: Response;
    try {
      res = await this.request('/api/chat', body);
    } catch (err) {
      yield { type: 'error', error: new ModelError(`Ollama Cloud request failed: ${(err as Error).message}`, undefined, this.name) };
      return;
    }

    if (!res.ok) {
      let errorText = '';
      try { errorText = await res.text(); } catch { /* ignore */ }
      yield { type: 'error', error: new ModelError(`Ollama Cloud API error: ${res.status} ${errorText || res.statusText}`, res.status, this.name) };
      return;
    }

    yield { type: 'message_start', model: options.model };

    const reader = res.body?.getReader();
    if (!reader) {
      yield { type: 'error', error: new ModelError('No response body from Ollama Cloud', undefined, this.name) };
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let totalInput = 0;
    let totalOutput = 0;
    // Track tool calls for streaming (Ollama sends them in the final chunk)
    let pendingToolCalls: Array<{ name: string; arguments: string }> = [];
    // Accumulate all text content for text-based tool call detection
    let fullTextBuffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const chunk: OllamaChatChunk = JSON.parse(line);

            // Emit thinking content
            if (chunk.message?.thinking) {
              yield { type: 'thinking_delta', delta: chunk.message.thinking };
            }

            // Emit text content
            if (chunk.message?.content) {
              fullTextBuffer += chunk.message.content;
              yield { type: 'text_delta', delta: chunk.message.content };
            }

            // Collect tool calls (Ollama sends them in final chunk or inline)
            if (chunk.message?.tool_calls) {
              for (const tc of chunk.message.tool_calls) {
                const argsStr = typeof tc.function.arguments === 'string'
                  ? tc.function.arguments
                  : JSON.stringify(tc.function.arguments);
                pendingToolCalls.push({
                  name: tc.function.name,
                  arguments: argsStr,
                });
              }
            }

            // Track token usage
            if (chunk.prompt_eval_count) totalInput = chunk.prompt_eval_count;
            if (chunk.eval_count) totalOutput = chunk.eval_count;

            // Stream done
            if (chunk.done) {
              // Check for text-based tool calls (some models output <function_calls>...</function_calls> as text)
              if (fullTextBuffer.includes('<function_calls>') && fullTextBuffer.includes('</function_calls>')) {
                const callsBlock = fullTextBuffer.substring(
                  fullTextBuffer.indexOf('<function_calls>'),
                  fullTextBuffer.indexOf('</function_calls>') + '</function_calls>'.length
                );
                const parsed = this.parseTextToolCalls(callsBlock);
                if (parsed.length > 0) {
                  pendingToolCalls.push(...parsed);
                }
              }

              // Emit any pending tool calls before message_complete
              if (pendingToolCalls.length > 0) {
                for (const tc of pendingToolCalls) {
                  const toolCallId = createToolCallId(`tool_${Date.now()}_${Math.random()}`);
                  yield { type: 'tool_call_start', toolCallId, toolName: tc.name };
                  yield { type: 'tool_call_delta', toolCallId, delta: tc.arguments };
                }
              }

              // Ollama uses "stop" even for tool calls; detect from pending tool calls
              const hasToolCalls = pendingToolCalls.length > 0;
              const stopReason = hasToolCalls ? 'tool_use' : this.convertStopReason(chunk.done_reason);

              yield {
                type: 'message_complete',
                stopReason,
                usage: { inputTokens: totalInput, outputTokens: totalOutput },
              };
            }
          } catch {
            // Skip malformed lines
          }
        }
      }
    } catch (err) {
      yield { type: 'error', error: new ModelError(`Ollama Cloud stream error: ${(err as Error).message}`, undefined, this.name) };
    }
  }

  async countTokens(messages: Message[]): Promise<number> {
    // Approximate: ~4 chars per token
    const text = messages.map(m => {
      if (typeof m.content === 'string') return m.content;
      return m.content.map(c => c.type === 'text' ? c.text : '').join('');
    }).join('');
    return Math.ceil(text.length / 4);
  }

  // --- Private helpers ---

  private getOptions(options: ModelRequestOptions): Record<string, unknown> {
    const opts: Record<string, unknown> = {};
    if (options.maxTokens) opts.num_predict = options.maxTokens;
    if (options.temperature !== undefined && options.temperature !== 1) {
      opts.temperature = options.temperature;
    }
    return opts;
  }

  /**
   * Convert internal ToolDefinition[] to Ollama's native tool format.
   * Ollama uses the same format as OpenAI: { type: "function", function: { name, description, parameters } }
   */
  private convertTools(tools: ToolDefinition[]): Array<Record<string, unknown>> {
    if (!tools || tools.length === 0) return [];

    return tools.map(tool => {
      const parameters: Record<string, unknown> = {
        type: 'object',
        properties: {},
      };

      if (tool.inputSchema?.properties) {
        parameters.properties = tool.inputSchema.properties;
      }
      if (tool.inputSchema?.required) {
        parameters.required = tool.inputSchema.required;
      }

      return {
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description || '',
          parameters,
        },
      };
    });
  }

  /**
   * Convert messages to Ollama format.
   * Handles: system, user, assistant (with optional tool_calls), and tool results.
   * Ollama doesn't have a native tool role; tool results are sent as user messages.
   */
  private convertMessages(messages: Message[], systemPrompt?: string): Array<Record<string, unknown>> {
    const result: Array<Record<string, unknown>> = [];

    if (systemPrompt) {
      result.push({ role: 'system', content: systemPrompt });
    }

    for (const msg of messages) {
      if (msg.role === 'user') {
        const text = this.extractText(msg.content);
        result.push({ role: 'user', content: text });
      } else if (msg.role === 'assistant') {
        // Check if assistant message contains tool calls
        const toolUseBlocks = msg.content.filter((c): c is ToolUseContent => c.type === 'tool_use');
        const textBlocks = msg.content.filter(c => c.type === 'text');

        if (toolUseBlocks.length > 0) {
          // Ollama supports tool_calls in assistant messages
          const msgObj: Record<string, unknown> = {
            role: 'assistant',
            content: textBlocks.map(c => (c as { text: string }).text).join('') || '',
            tool_calls: toolUseBlocks.map(tc => ({
              function: {
                name: tc.name,
                arguments: tc.input,
              },
            })),
          };
          result.push(msgObj);
        } else {
          const text = this.extractText(msg.content);
          result.push({ role: 'assistant', content: text });
        }
      } else if (msg.role === 'tool') {
        // Ollama doesn't have a native tool role; include as user message
        const toolResults = msg.content.filter((c): c is ToolResultContent => c.type === 'tool_result');
        const text = toolResults.map(tr => {
          const content = typeof tr.content === 'string'
            ? tr.content
            : JSON.stringify(tr.content);
          return `[Tool Result for ${(tr as any).tool_use_id}]: ${content}`;
        }).join('\n');
        result.push({ role: 'user', content: text });
      }
    }

    return result;
  }

  private extractText(content: Message['content']): string {
    if (typeof content === 'string') return content;
    return content
      .map(block => {
        if (block.type === 'text') return block.text;
        if (block.type === 'tool_use') return `[Calling tool: ${block.name}]`;
        if (block.type === 'tool_result') return `[Tool result: ${typeof block.content === 'string' ? block.content : JSON.stringify(block.content)}]`;
        return '';
      })
      .join('\n');
  }

  private convertResponseContent(message: OllamaChatResponse['message']): ContentBlock[] {
    const content: ContentBlock[] = [];

    if (message.thinking) {
      content.push({ type: 'text', text: message.thinking });
    }

    if (message.content) {
      content.push({ type: 'text', text: message.content });
    }

    // Handle tool calls
    if (message.tool_calls) {
      for (const tc of message.tool_calls) {
        content.push({
          type: 'tool_use' as const,
          id: createToolCallId(`tool_${Date.now()}_${Math.random()}`) as any,
          name: tc.function.name,
          input: tc.function.arguments,
        });
      }
    }

    return content;
  }

  private convertStopReason(reason?: string): ModelResponse['stopReason'] {
    if (!reason) return 'end_turn';
    switch (reason) {
      case 'stop': return 'end_turn';
      case 'length': return 'max_tokens';
      case 'tool_calls': return 'tool_use';
      default: return 'end_turn';
    }
  }

  /**
   * Parse text-based tool calls in XML format (used by some models via Ollama Cloud).
   * Expected format: <function_calls><invoke name="tool_name"><parameter name="key">value</parameter>...</invoke></function_calls>
   */
  private parseTextToolCalls(xmlBlock: string): Array<{ name: string; arguments: string }> {
    const results: Array<{ name: string; arguments: string }> = [];

    const invokeRegex = /<invoke\s+name=["']([^"']+)["']\s*>(.*?)<\/invoke>/gs;
    let match: RegExpExecArray | null;

    while ((match = invokeRegex.exec(xmlBlock)) !== null) {
      const toolName = match[1];
      const paramsXml = match[2];

      const params: Record<string, unknown> = {};
      const paramRegex = /<parameter\s+name=["']([^"']+)["']\s*>(.*?)<\/parameter>/gs;
      let paramMatch: RegExpExecArray | null;

      while ((paramMatch = paramRegex.exec(paramsXml)) !== null) {
        const paramName = paramMatch[1];
        const paramValue = paramMatch[2].trim();
        try {
          params[paramName] = JSON.parse(paramValue);
        } catch {
          params[paramName] = paramValue;
        }
      }

      results.push({
        name: toolName,
        arguments: JSON.stringify(params),
      });
    }

    return results;
  }

  private async request(path: string, body: Record<string, unknown>): Promise<Response> {
    return fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(300000), // 5 minutes timeout for large file operations
    });
  }
}
