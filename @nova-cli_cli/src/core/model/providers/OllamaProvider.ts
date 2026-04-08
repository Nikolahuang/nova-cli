// ============================================================================
// Ollama Provider - Local LLM via Ollama OpenAI-compatible API
// ============================================================================
// Refactored: now extends OpenAICompatibleProvider base class.
// Handles Ollama-specific concerns: no API key, /v1 suffix, friendly error hints.
// ============================================================================

import type { OpenAICompatibleConfig } from './OpenAICompatibleProvider.js';
import { OpenAICompatibleProvider } from './OpenAICompatibleProvider.js';
import type { ToolDefinition } from '../../types/tools.js';

export interface OllamaProviderConfig {
  /** Base URL for Ollama, defaults to http://localhost:11434 */
  baseUrl?: string;
  /** Model name (e.g., llama3, codellama, mistral) */
  model: string;
  /** Custom headers */
  headers?: Record<string, string>;
}

export class OllamaProvider extends OpenAICompatibleProvider {
  readonly name = 'Ollama';

  constructor(config: OllamaProviderConfig) {
    super({
      apiKey: 'ollama', // Ollama doesn't require a real API key
      baseUrl: config.baseUrl || 'http://localhost:11434',
      model: config.model,
      headers: config.headers,
      appendV1Suffix: true, // Ollama needs /v1 appended to baseUrl
    });
  }

  /**
   * Ollama: whitelist-based tools filtering.
   * Many Ollama models (e.g., deepseek-r1) do not support function calling.
   * Only well-known tool-capable model families get tools passed through.
   */
  protected filterTools(tools: ToolDefinition[], modelId: string): ToolDefinition[] {
    if (tools.length === 0) return tools;

    const modelLower = modelId.toLowerCase();
    const toolCapable = [
      'llama3', 'llama3.1', 'llama3.2', 'llama3.3',
      'qwen2.5', 'qwen2', 'mistral', 'mixtral',
      'gemma2', 'gemma3', 'codellama',
      'phi3', 'phi4', 'command-r',
    ];

    if (!toolCapable.some(p => modelLower.includes(p))) {
      return []; // Strip tools for unknown/unsupported models
    }
    return tools;
  }

  protected handleError(err: unknown, operation: 'complete' | 'stream'): never {
    const msg = (err as Error).message || String(err);
    const hint = msg.includes('ECONNREFUSED') || msg.includes('connect')
      ? ' Is Ollama running? Try `ollama serve` or check https://ollama.com for installation.'
      : '';
    const enhanced = new Error(`${msg}.${hint}`);
    super.handleError(enhanced, operation);
  }

  protected handleStreamError(err: unknown) {
    const msg = (err as Error).message || String(err);
    const hint = msg.includes('ECONNREFUSED') || msg.includes('connect')
      ? ' Is Ollama running? Try `ollama serve` or check https://ollama.com for installation.'
      : '';
    const enhanced = new Error(`${msg}.${hint}`);
    return super.handleStreamError(enhanced);
  }
}
