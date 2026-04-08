// ============================================================================
// OllamaManager - Ollama native API wrapper for model management
// ============================================================================
//
// Wraps Ollama's REST API for operations beyond simple chat completion:
// - List/pull/delete/show local models
// - Check Ollama server status and version
// - Runtime model discovery and auto-registration
// ============================================================================

import type { ModelConfig } from '../../types/config.js';

/** A model entry from Ollama's /api/tags */
export interface OllamaModel {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
  details: {
    parent_model?: string;
    format: string;
    family: string;
    families?: string[];
    parameter_size: string;
    quantization_level: string;
  };
}

/** Progress info for model pull operations */
export interface OllamaPullProgress {
  status: string;
  digest?: string;
  total?: number;
  completed?: number;
  percent?: number;
}

/** Model info from Ollama's /api/show */
export interface OllamaModelInfo {
  license?: string;
  modelfile?: string;
  parameters?: string;
  template?: string;
  details: {
    parent_model?: string;
    format: string;
    family: string;
    families?: string[];
    parameter_size: string;
    quantization_level: string;
  };
  model_info?: Record<string, unknown>;
}

/** Result from Ollama's /api/version */
export interface OllamaVersion {
  version: string;
}

export class OllamaManager {
  private baseUrl: string;
  private timeout: number;

  constructor(baseUrl?: string, timeoutMs = 30000) {
    this.baseUrl = (baseUrl || 'http://localhost:11434').replace(/\/+$/, '');
    this.timeout = timeoutMs;
  }

  /** Check if Ollama server is running */
  async ping(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /** Get Ollama server version */
  async version(): Promise<string> {
    const res = await this.request<{ version: string }>('/api/version', undefined, 'GET');
    return res.version;
  }

  /** List all locally installed models */
  async listModels(): Promise<OllamaModel[]> {
    const res = await this.request<{ models: OllamaModel[] }>('/api/tags', undefined, 'GET');
    return res.models || [];
  }

  /** Show detailed info about a model */
  async showModel(name: string): Promise<OllamaModelInfo> {
    return this.request<OllamaModelInfo>('/api/show', { name }, 'POST');
  }

  /**
   * Pull a model from Ollama Hub. Calls onProgress periodically with download status.
   * Returns when the pull is complete.
   */
  async pullModel(name: string, onProgress?: (progress: OllamaPullProgress) => void): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, stream: true }),
      signal: AbortSignal.timeout(this.timeout * 60), // Pull can take a long time
    });

    if (!res.ok) {
      throw new Error(`Ollama pull failed: ${res.status} ${res.statusText}`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const progress: OllamaPullProgress = JSON.parse(line);
          if (onProgress) onProgress(progress);
        } catch {
          // Skip malformed lines
        }
      }
    }
  }

  /** Delete a locally installed model */
  async deleteModel(name: string): Promise<void> {
    // Ollama DELETE API expects the model name in the URL query string
    const url = `${this.baseUrl}/api/delete?name=${encodeURIComponent(name)}`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Ollama delete failed: ${res.status} ${text || res.statusText}`);
    }
    // DELETE endpoint returns empty body
  }

  /**
   * Convert Ollama models to Nova ModelConfig for auto-registration.
   * Attempts to infer capabilities from model metadata.
   */
  toModelConfig(model: OllamaModel): ModelConfig {
    const paramSize = model.details?.parameter_size || '';
    const isLarge = paramSize.includes('70B') || paramSize.includes('72B') || paramSize.includes('65B');
    const isMedium = paramSize.includes('32B') || paramSize.includes('34B') || paramSize.includes('14B');

    // Estimate context window from model family
    let contextTokens = 8192;
    const family = (model.details?.family || '').toLowerCase();
    if (family.includes('qwen')) contextTokens = 131072;
    else if (family.includes('llama')) contextTokens = isLarge ? 131072 : 128000;
    else if (family.includes('deepseek')) contextTokens = 128000;
    else if (family.includes('mistral')) contextTokens = isLarge ? 131072 : 32768;
    else if (family.includes('gemma')) contextTokens = isMedium ? 8192 : 128000;
    else contextTokens = isLarge ? 131072 : 32768;

    return {
      name: model.name,
      maxContextTokens: contextTokens,
      maxOutputTokens: Math.min(contextTokens, isLarge ? 8192 : 4096),
      supportsVision: family.includes('llava') || family.includes('qwen-vl'),
      supportsTools: true, // Most models support tools via Ollama's OpenAI compat
      supportsStreaming: true,
      supportsThinking: false,
    };
  }

  // --- Private helpers ---

  private async request<T>(path: string, body?: Record<string, unknown>, method = 'POST'): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const options: RequestInit = {
      method,
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(this.timeout),
    };
    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }

    const res = await fetch(url, options);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Ollama API error ${res.status}: ${text || res.statusText}`);
    }

    // Some endpoints return empty body (e.g., DELETE)
    const text = await res.text();
    if (!text) return {} as T;
    return JSON.parse(text);
  }
}
