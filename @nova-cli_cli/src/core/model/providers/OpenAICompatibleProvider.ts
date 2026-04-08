// ============================================================================
// OpenAICompatibleProvider - Base class for all OpenAI-compatible providers
// ============================================================================
//
// This base class handles all shared logic for providers that use the OpenAI
// SDK with an OpenAI-compatible API endpoint. Subclasses only need to define:
// - Provider name
// - Constructor (how to create the OpenAI client)
// - Error handling specifics (provider name in error messages)
// ============================================================================

import OpenAI from 'openai';
import type { Message, ContentBlock, ToolUseContent, ToolResultContent } from '../../types/session.js';
import type { ToolDefinition } from '../../types/tools.js';
import type { ModelProvider, ModelRequestOptions, ModelResponse, TokenUsage, StreamEvent } from '../types.js';
import { ModelError, RateLimitError } from '../../types/errors.js';
import { createToolCallId } from '../../types/session.js';

/** Configuration options shared by all OpenAI-compatible providers */
export interface OpenAICompatibleConfig {
  apiKey?: string;
  baseUrl?: string;
  model: string;
  organizationId?: string;
  headers?: Record<string, string>;
  /** Append /v1 suffix to baseUrl (needed by Ollama) */
  appendV1Suffix?: boolean;
}

export abstract class OpenAICompatibleProvider implements ModelProvider {
  abstract readonly name: string;
  protected client: OpenAI;

  constructor(config: OpenAICompatibleConfig) {
    let baseURL = config.baseUrl;
    if (baseURL && config.appendV1Suffix) {
      baseURL = baseURL.replace(/\/+$/, '') + '/v1';
    }
    this.client = new OpenAI({
      apiKey: config.apiKey || 'no-key-required',
      baseURL,
      ...(config.organizationId && { organization: config.organizationId }),
      ...(config.headers && { defaultHeaders: config.headers }),
    });
  }

  // --- Provider-specific hooks ---

  /**
   * Override to customize the error handling in complete()
   * Subclasses should call super.handleError(err, operation) after wrapping the error.
   */
  protected handleError(err: unknown, operation: 'complete' | 'stream'): never {
    if (err instanceof OpenAI.APIError) {
      if (err.status === 429) {
        const retryAfter = parseInt(err.headers?.['retry-after'] || '60', 10) * 1000;
        throw new RateLimitError(err.message, retryAfter, this.name);
      }
      throw new ModelError(err.message, err.status, this.name, err);
    }
    throw new ModelError(
      `${this.name} ${operation} failed: ${(err as Error).message}`,
      undefined,
      this.name,
      { originalError: err }
    );
  }

  /** Override to customize the error handling in stream() */
  protected handleStreamError(err: unknown): StreamEvent {
    if (err instanceof OpenAI.APIError) {
      return { type: 'error', error: new ModelError(err.message, err.status, this.name, err) };
    }
    return {
      type: 'error',
      error: new ModelError(
        `${this.name} stream failed: ${(err as Error).message}`,
        undefined,
        this.name,
        { originalError: err }
      ),
    };
  }

  /**
   * Hook to filter or disable tools before sending to the API.
   * Override in subclasses to conditionally disable tools (e.g., for models that don't support them).
   * Default implementation passes tools through unchanged.
   * @param tools - The tool definitions to filter
   * @param modelId - The model ID being called (useful for per-model decisions)
   */
  protected filterTools(tools: ToolDefinition[], modelId: string): ToolDefinition[] {
    return tools;
  }

  // --- Shared implementations ---

  async complete(messages: Message[], options: ModelRequestOptions): Promise<ModelResponse> {
    try {
      const openaiMessages = this.convertMessages(messages, options.systemPrompt);
      const tools = this.filterTools(options.tools, options.model);
      const openaiTools = this.convertTools(tools);

      const params: OpenAI.ChatCompletionCreateParams = {
        model: options.model,
        max_tokens: options.maxTokens,
        messages: openaiMessages,
        temperature: options.temperature,
        ...(openaiTools.length > 0 && { tools: openaiTools }),
        ...(options.stopSequences && options.stopSequences.length > 0 && { stop: options.stopSequences }),
      };

      const response = await this.client.chat.completions.create(params);
      const choice = response.choices[0]!;
      let content = this.convertResponseContent(choice);
      const usage = this.convertUsage(response.usage);

      // Check for text-based tool calls (some providers like deepseek output them as XML text)
      const textContent = content
        .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
        .map(c => c.text)
        .join('');
      
      if (textContent.includes('<function_calls>') && textContent.includes('</function_calls>')) {
        const callsBlock = textContent.substring(
          textContent.indexOf('<function_calls>'),
          textContent.indexOf('</function_calls>') + '</function_calls>'.length
        );
        const parsed = this.parseTextToolCalls(callsBlock, tools);
        if (parsed.length > 0) {
          // Remove the text-based tool call XML from text content
          const cleanText = textContent
            .replace(/<function_calls>[\s\S]*?<\/function_calls>/g, '')
            .trim();
          content = content.filter(c => c.type !== 'text');
          if (cleanText) {
            content.push({ type: 'text', text: cleanText });
          }
          // Add parsed tool calls
          for (const call of parsed) {
            content.push({ type: 'tool_use', id: call.id as any, name: call.name, input: call.input });
          }
        }
      }

      // Detect tool_use from content blocks to ensure correct loop continuation.
      const hasToolCalls = content.some((c): c is ToolUseContent => c.type === 'tool_use');
      const stopReason = hasToolCalls ? 'tool_use' : this.convertStopReason(choice.finish_reason);

      return {
        content,
        model: response.model,
        stopReason,
        usage,
        sessionId: options.sessionId,
      };
    } catch (err) {
      this.handleError(err, 'complete');
    }
  }

  async *stream(messages: Message[], options: ModelRequestOptions): AsyncGenerator<StreamEvent> {
    try {
      const openaiMessages = this.convertMessages(messages, options.systemPrompt);
      const tools = this.filterTools(options.tools, options.model);
      const openaiTools = this.convertTools(tools);

      const params: OpenAI.ChatCompletionCreateParams = {
        model: options.model,
        max_tokens: options.maxTokens,
        messages: openaiMessages,
        temperature: options.temperature,
        ...(openaiTools.length > 0 && { tools: openaiTools }),
        stream: true,
      };

      const stream = await this.client.chat.completions.create(params);
      let currentToolCallId = '';
      let currentToolName = '';
      const standardToolCallIds = new Set<string>();
      let fullTextBuffer = '';
      let messageCompleted = false;

      for await (const chunk of stream as AsyncIterable<OpenAI.ChatCompletionChunk>) {
        const delta = chunk.choices[0]?.delta;
        if (!delta) continue;

        if (delta.content) {
          fullTextBuffer += delta.content;
          yield { type: 'text_delta', delta: delta.content };
        }

        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            if (tc.id) {
              currentToolCallId = tc.id;
              currentToolName = tc.function?.name || '';
              standardToolCallIds.add(tc.id);
              yield { type: 'tool_call_start', toolCallId: tc.id, toolName: currentToolName };
            }
            if (tc.function?.arguments) {
              yield {
                type: 'tool_call_delta',
                toolCallId: tc.id || currentToolCallId,
                delta: tc.function.arguments,
              };
            }
          }
        }

        if (chunk.choices[0]?.finish_reason) {
          const usage: TokenUsage = {
            inputTokens: chunk.usage?.prompt_tokens ?? 0,
            outputTokens: chunk.usage?.completion_tokens ?? 0,
          };

          // Check for text-based tool calls (e.g. deepseek XML format)
          let hasTextToolCalls = false;
          const hasFuncOpen = fullTextBuffer.includes('<function_calls>');
          const hasFuncClose = fullTextBuffer.includes('</function_calls>');
          
          // Debug - Commented out to reduce visual clutter
          // process.stdout.write(`\n[PROVIDER-DEBUG] finish_reason="${chunk.choices[0].finish_reason}", standardCalls=${standardToolCallIds.size}, textLen=${fullTextBuffer.length}, hasOpen=${hasFuncOpen}, hasClose=${hasFuncClose}, textPreview="${fullTextBuffer.slice(-200)}"\n`);

          if (hasFuncOpen && hasFuncClose) {
            const callsBlock = fullTextBuffer.substring(
              fullTextBuffer.indexOf('<function_calls>'),
              fullTextBuffer.indexOf('</function_calls>') + '</function_calls>'.length
            );
            const parsed = this.parseTextToolCalls(callsBlock, tools);
            if (parsed.length > 0) {
              hasTextToolCalls = true;
              for (const call of parsed) {
                yield { type: 'tool_call_start', toolCallId: call.id, toolName: call.name };
                yield { type: 'tool_call_delta', toolCallId: call.id, delta: JSON.stringify(call.input) };
              }
            }
          }

          const hasToolCalls = standardToolCallIds.size > 0 || hasTextToolCalls;
          const stopReason = hasToolCalls ? 'tool_use' : this.convertStopReason(chunk.choices[0].finish_reason);

          yield {
            type: 'message_complete',
            stopReason,
            usage,
          };
          messageCompleted = true;
        }
      }

      // Fallback: some providers (e.g. deepseek) end the stream without a finish_reason chunk.
      // If message_complete was not emitted, check for text-based tool calls now.
      if (!messageCompleted) {
        const hasOpen = fullTextBuffer.includes('<function_calls>');
        const hasClose = fullTextBuffer.includes('</function_calls>');
        process.stdout.write(`\n[STREAM-FALLBACK] messageCompleted=false, textLen=${fullTextBuffer.length}, hasOpen=${hasOpen}, hasClose=${hasClose}\n`);
        process.stdout.write(`[STREAM-FALLBACK] textBuffer preview: ${fullTextBuffer.slice(0, 300)}\n`);
        if (hasOpen && hasClose) {
          const callsBlock = fullTextBuffer.substring(
            fullTextBuffer.indexOf('<function_calls>'),
            fullTextBuffer.indexOf('</function_calls>') + '</function_calls>'.length
          );
          const parsed = this.parseTextToolCalls(callsBlock, tools);
          if (parsed.length > 0) {
            for (const call of parsed) {
              yield { type: 'tool_call_start', toolCallId: call.id, toolName: call.name };
              yield { type: 'tool_call_delta', toolCallId: call.id, delta: JSON.stringify(call.input) };
            }
            yield {
              type: 'message_complete',
              stopReason: 'tool_use',
              usage: { inputTokens: 0, outputTokens: 0 },
            };
          }
        }
      }
    } catch (err) {
      yield this.handleStreamError(err);
    }
  }

  /**
   * Parse text-based tool calls in XML format (used by some providers like deepseek).
   * Expected format: <function_calls><invoke name="tool_name"><parameter name="key">value</parameter>...</invoke></function_calls>
   */
  private parseTextToolCalls(xmlBlock: string, tools: ToolDefinition[]): Array<{ id: string; name: string; input: Record<string, unknown> }> {
    const results: Array<{ id: string; name: string; input: Record<string, unknown> }> = [];

    // Match each <invoke name="...">...</invoke> block
    const invokeRegex = /<invoke\s+name=["']([^"']+)["']\s*>(.*?)<\/invoke>/gs;
    let match: RegExpExecArray | null;

    while ((match = invokeRegex.exec(xmlBlock)) !== null) {
      const toolName = match[1];
      const paramsXml = match[2];

      // Parse parameters from <parameter name="key">value</parameter>
      const params: Record<string, unknown> = {};
      const paramRegex = /<parameter\s+name=["']([^"']+)["']\s*>(.*?)<\/parameter>/gs;
      let paramMatch: RegExpExecArray | null;

      while ((paramMatch = paramRegex.exec(paramsXml)) !== null) {
        const paramName = paramMatch[1];
        const paramValue = paramMatch[2].trim();

        // Try to parse the value as JSON, otherwise keep as string
        try {
          params[paramName] = JSON.parse(paramValue);
        } catch {
          params[paramName] = paramValue;
        }
      }

      results.push({
        id: createToolCallId(`text_tool_${Date.now()}_${Math.random()}`),
        name: toolName,
        input: params,
      });
    }

    return results;
  }

  async countTokens(messages: Message[]): Promise<number> {
    const text = messages
      .map((m) => m.content
        .filter((c): c is Extract<ContentBlock, { type: 'text' }> => c.type === 'text')
        .map((c) => c.text)
        .join(' '))
      .join(' ');
    return Math.ceil(text.length / 4);
  }

  // --- Conversion helpers (shared by all OpenAI-compatible providers) ---

  protected convertMessages(messages: Message[], systemPrompt?: string): OpenAI.ChatCompletionMessageParam[] {
    const result: OpenAI.ChatCompletionMessageParam[] = [];

    if (systemPrompt) {
      result.push({ role: 'system', content: systemPrompt });
    }

    for (const msg of messages) {
      if (msg.role === 'system') {
        result.push({ role: 'system', content: msg.content.map((c) => c.type === 'text' ? c.text : '').join('') });
        continue;
      }

      if (msg.role === 'tool') {
        const toolResults = msg.content
          .filter((c): c is ToolResultContent => c.type === 'tool_result')
          .map((c) => ({
            role: 'tool' as const,
            tool_call_id: c.tool_use_id,
            content: typeof c.content === 'string' ? c.content : c.content.map((cc) => 'text' in cc ? cc.text : '').join(''),
          }));
        result.push(...toolResults);
        continue;
      }

      // user or assistant
      const textContent = msg.content
        .filter((c): c is Extract<ContentBlock, { type: 'text' }> => c.type === 'text')
        .map((c) => c.text)
        .join('');

      const toolCalls = msg.content
        .filter((c): c is ToolUseContent => c.type === 'tool_use')
        .map((c) => ({
          id: c.id,
          type: 'function' as const,
          function: { name: c.name, arguments: JSON.stringify(c.input) },
        }));

      if (msg.role === 'assistant') {
        const param: OpenAI.ChatCompletionAssistantMessageParam = {
          role: 'assistant',
          content: textContent || null,
          ...(toolCalls.length > 0 && { tool_calls: toolCalls }),
        };
        result.push(param);
      } else {
        result.push({ role: 'user', content: textContent });
      }
    }

    return result;
  }

  protected convertTools(tools: ToolDefinition[]): OpenAI.ChatCompletionTool[] {
    return tools.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.inputSchema,
      },
    }));
  }

  protected convertResponseContent(choice: OpenAI.ChatCompletion.Choice): ContentBlock[] {
    const content: ContentBlock[] = [];

    if (choice.message.content) {
      content.push({ type: 'text', text: choice.message.content });
    }

    if (choice.message.tool_calls) {
      for (const tc of choice.message.tool_calls) {
        let input: Record<string, unknown>;
        try {
          input = JSON.parse(tc.function.arguments);
        } catch {
          input = { raw: tc.function.arguments };
        }
        content.push({
          type: 'tool_use',
          id: createToolCallId(tc.id),
          name: tc.function.name,
          input,
        });
      }
    }

    return content;
  }

  protected convertUsage(usage: OpenAI.CompletionUsage | undefined): TokenUsage {
    return {
      inputTokens: usage?.prompt_tokens ?? 0,
      outputTokens: usage?.completion_tokens ?? 0,
    };
  }

  protected convertStopReason(reason: string | null | undefined): ModelResponse['stopReason'] {
    switch (reason) {
      case 'stop': return 'end_turn';
      case 'tool_calls': return 'tool_use';
      case 'length': return 'max_tokens';
      case 'content_filter': return 'end_turn';
      default: return 'end_turn';
    }
  }

  /**
   * List available models from the API.
   * Returns model IDs that can be used with this provider.
   */
  async listModels(): Promise<string[]> {
    try {
      const response = await this.client.models.list();
      const models: string[] = [];
      for await (const model of response) {
        models.push(model.id);
      }
      return models.sort();
    } catch {
      // If the API doesn't support /models endpoint, return empty array
      return [];
    }
  }
}
