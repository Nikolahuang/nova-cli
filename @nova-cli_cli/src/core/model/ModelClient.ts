// ============================================================================
// ModelClient - Unified LLM client abstraction
// ============================================================================

import type {
  Message,
  ContentBlock,
  ToolUseContent,
  TextContent,
  ToolCallId,
  SessionId,
} from '../types/session.js';
import type { ToolDefinition } from '../types/tools.js';
import { ModelError, RateLimitError, NovaError } from '../types/errors.js';
import { AnthropicProvider } from './providers/AnthropicProvider.js';
import { OpenAIProvider } from './providers/OpenAIProvider.js';
import { OllamaProvider } from './providers/OllamaProvider.js';
import { OllamaCloudProvider } from './providers/OllamaCloudProvider.js';
import { CodingPlanProvider, type CodingPlanPlatform } from './providers/CodingPlanProvider.js';
import type { ModelProvider, ModelRequestOptions, ModelResponse, StreamEvent } from './types.js';

export interface CreateModelClientOptions {
  provider: 'anthropic' | 'openai' | 'azure' | 'ollama' | 'ollama-cloud' | 'coding-plan' | 'custom';
  apiKey?: string;
  baseUrl?: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
  organizationId?: string;
  apiVersion?: string;
  /** Coding Plan platform (required when provider is 'coding-plan') */
  codingPlanPlatform?: CodingPlanPlatform;
}

export class ModelClient {
  private provider: ModelProvider;
  private model: string;
  private maxTokens: number;
  private temperature: number;

  constructor(options: CreateModelClientOptions) {
    this.model = options.model;
    this.maxTokens = options.maxTokens ?? 4096;
    this.temperature = options.temperature ?? 0.7;

    switch (options.provider) {
      case 'anthropic':
        if (!options.apiKey) {
          throw new NovaError('API key is required for Anthropic provider', 'AUTH_ERROR');
        }
        this.provider = new AnthropicProvider({
          apiKey: options.apiKey,
          baseUrl: options.baseUrl,
          model: options.model,
          apiVersion: options.apiVersion,
        });
        break;

      case 'openai':
        if (!options.apiKey) {
          throw new NovaError('API key is required for OpenAI provider', 'AUTH_ERROR');
        }
        this.provider = new OpenAIProvider({
          apiKey: options.apiKey,
          baseUrl: options.baseUrl,
          organizationId: options.organizationId,
          model: options.model,
        });
        break;

      case 'azure':
        if (!options.apiKey) {
          throw new NovaError('API key is required for Azure OpenAI provider', 'AUTH_ERROR');
        }
        // Azure uses OpenAI-compatible SDK with custom baseUrl and apiVersion
        this.provider = new OpenAIProvider({
          apiKey: options.apiKey,
          baseUrl: options.baseUrl,
          organizationId: options.organizationId,
          model: options.model,
        });
        break;

      case 'ollama':
        // Ollama doesn't require an API key; uses localhost by default
        this.provider = new OllamaProvider({
          baseUrl: options.baseUrl || 'http://localhost:11434',
          model: options.model,
        });
        break;

      case 'ollama-cloud':
        // Ollama Cloud: hosted models via ollama.com with API key
        if (!options.apiKey) {
          throw new NovaError('API key is required for Ollama Cloud provider. Run: nova auth set ollama-cloud', 'AUTH_ERROR');
        }
        this.provider = new OllamaCloudProvider({
          apiKey: options.apiKey,
          baseUrl: options.baseUrl || 'https://ollama.com',
          model: options.model,
        });
        break;

      case 'coding-plan':
        // Coding Plan: Chinese AI coding platforms (Alibaba, Tencent, Volcengine, etc.)
        if (!options.apiKey) {
          throw new NovaError('API key is required for Coding Plan provider. Get your key from the platform console.', 'AUTH_ERROR');
        }
        if (!options.codingPlanPlatform) {
          throw new NovaError('codingPlanPlatform is required for Coding Plan provider. Options: alibaba, tencent, volcengine, baidu, kimi, zhipu, minimax', 'AUTH_ERROR');
        }
        this.provider = new CodingPlanProvider({
          platform: options.codingPlanPlatform,
          apiKey: options.apiKey,
          model: options.model,
          customBaseUrl: options.baseUrl,
        });
        break;

      case 'custom':
        // Custom provider: uses OpenAI-compatible SDK with user-provided baseUrl + apiKey
        // This covers DeepSeek, Google Gemini (OpenAI compat), Together AI, Groq, etc.
        this.provider = new OpenAIProvider({
          apiKey: options.apiKey || 'no-key-required',
          baseUrl: options.baseUrl,
          model: options.model,
        });
        break;

      default:
        throw new NovaError(`Provider "${options.provider}" is not supported`, 'NOT_IMPLEMENTED');
    }
  }

  /** Send a non-streaming completion request */
  async complete(
    messages: Message[],
    tools: ToolDefinition[],
    sessionId: SessionId,
    options?: Partial<ModelRequestOptions>
  ): Promise<ModelResponse> {
    try {
      const requestOpts: ModelRequestOptions = {
        model: this.model,
        maxTokens: options?.maxTokens ?? this.maxTokens,
        temperature: options?.temperature ?? this.temperature,
        tools,
        sessionId,
        stopSequences: options?.stopSequences,
        systemPrompt: options?.systemPrompt,
      };

      return await this.provider.complete(messages, requestOpts);
    } catch (err) {
      if (err instanceof NovaError) throw err;
      throw new ModelError(
        `Model request failed: ${(err as Error).message}`,
        undefined,
        this.provider.name,
        { originalError: err }
      );
    }
  }

  /** Send a streaming completion request */
  async *stream(
    messages: Message[],
    tools: ToolDefinition[],
    sessionId: SessionId,
    options?: Partial<ModelRequestOptions>
  ): AsyncGenerator<StreamEvent> {
    try {
      const requestOpts: ModelRequestOptions = {
        model: this.model,
        maxTokens: options?.maxTokens ?? this.maxTokens,
        temperature: options?.temperature ?? this.temperature,
        tools,
        sessionId,
        stopSequences: options?.stopSequences,
        systemPrompt: options?.systemPrompt,
      };

      yield* this.provider.stream(messages, requestOpts);
    } catch (err) {
      if (err instanceof NovaError) throw err;
      const error = new ModelError(
        `Model stream failed: ${(err as Error).message}`,
        undefined,
        this.provider.name,
        { originalError: err }
      );
      yield { type: 'error', error };
    }
  }

  /** Count tokens for a message array (approximate) */
  async countTokens(messages: Message[]): Promise<number> {
    return this.provider.countTokens(messages);
  }

  /** Get the current model name */
  getModel(): string {
    return this.model;
  }

  /** Get the provider name */
  getProviderName(): string {
    return this.provider.name;
  }

  /** Update model parameters */
  updateOptions(options: { maxTokens?: number; temperature?: number; model?: string }): void {
    if (options.maxTokens !== undefined) this.maxTokens = options.maxTokens;
    if (options.temperature !== undefined) this.temperature = options.temperature;
    if (options.model !== undefined) this.model = options.model;
  }
}
