// ============================================================================
// AuthManager - Manages API credentials
// ============================================================================

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

export interface CredentialEntry {
  provider: string;
  apiKey: string;
  baseUrl?: string;
  organizationId?: string;
  createdAt: number;
  updatedAt: number;
}

export class AuthManager {
  private credentialsPath: string;
  private credentials = new Map<string, CredentialEntry>();

  constructor() {
    this.credentialsPath = path.join(os.homedir(), '.nova', 'credentials.json');
  }

  /** Load credentials from storage */
  async loadCredentials(): Promise<void> {
    try {
      const content = await fs.readFile(this.credentialsPath, 'utf-8');
      const data = JSON.parse(content) as Record<string, CredentialEntry>;
      for (const [provider, entry] of Object.entries(data)) {
        this.credentials.set(provider, entry);
      }
    } catch {
      // No credentials file yet
    }
  }

  /** Get credentials for a provider */
  getCredentials(provider: string): { apiKey: string; baseUrl?: string; organizationId?: string } | null {
    const entry = this.credentials.get(provider);
    if (!entry) {
      const envKey = this.getEnvKeyName(provider);
      const envValue = process.env[envKey];
      if (envValue) {
        return { apiKey: envValue };
      }
      return null;
    }
    return {
      apiKey: entry.apiKey,
      baseUrl: entry.baseUrl,
      organizationId: entry.organizationId,
    };
  }

  /** Check if credentials exist for a provider */
  hasCredentials(provider: string): boolean {
    if (this.credentials.has(provider)) return true;
    return !!process.env[this.getEnvKeyName(provider)];
  }

  /** Set credentials for a provider */
  async setCredentials(entry: { provider: string; apiKey: string; baseUrl?: string; organizationId?: string }): Promise<void> {
    const existing = this.credentials.get(entry.provider);
    // Clean up baseUrl: remove trailing slashes and common endpoint suffixes
    let baseUrl = entry.baseUrl;
    if (baseUrl) {
      baseUrl = baseUrl.replace(/\/+$/, '');
      baseUrl = baseUrl.replace(/\/(chat\/completions|completions|embeddings|v1\/chat\/completions)$/i, '');
    }
    const credential: CredentialEntry = {
      provider: entry.provider,
      apiKey: entry.apiKey,
      baseUrl,
      organizationId: entry.organizationId,
      createdAt: existing?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    this.credentials.set(entry.provider, credential);
    await this.saveCredentials();
  }

  /** Remove credentials for a provider */
  async removeCredentials(provider: string): Promise<boolean> {
    const deleted = this.credentials.delete(provider);
    if (deleted) await this.saveCredentials();
    return deleted;
  }

  /** List all configured providers */
  listProviders(): string[] {
    return Array.from(this.credentials.keys());
  }

  /** Save credentials to storage */
  private async saveCredentials(): Promise<void> {
    const dir = path.dirname(this.credentialsPath);
    await fs.mkdir(dir, { recursive: true });

    const data: Record<string, CredentialEntry> = {};
    for (const [provider, entry] of this.credentials) {
      data[provider] = entry;
    }

    await fs.writeFile(this.credentialsPath, JSON.stringify(data, null, 2), 'utf-8');
    try {
      await fs.chmod(this.credentialsPath, 0o600);
    } catch {
      // chmod may fail on some systems
    }
  }

  private getEnvKeyName(provider: string): string {
    const envMap: Record<string, string> = {
      // Built-in
      anthropic: 'ANTHROPIC_API_KEY',
      openai: 'OPENAI_API_KEY',
      azure: 'AZURE_OPENAI_API_KEY',
      ollama: 'OLLAMA_HOST',
      'ollama-cloud': 'OLLAMA_API_KEY',
      // Major cloud providers
      google: 'GOOGLE_API_KEY',
      deepseek: 'DEEPSEEK_API_KEY',
      // Chinese providers
      qwen: 'DASHSCOPE_API_KEY',
      glm: 'ZHIPU_API_KEY',
      zhipu: 'ZHIPU_API_KEY',
      moonshot: 'MOONSHOT_API_KEY',
      baichuan: 'BAICHUAN_API_KEY',
      minimax: 'MINIMAX_API_KEY',
      yi: 'YI_API_KEY',
      siliconflow: 'SILICONFLOW_API_KEY',
      // International providers
      groq: 'GROQ_API_KEY',
      mistral: 'MISTRAL_API_KEY',
      together: 'TOGETHER_API_KEY',
      cohere: 'COHERE_API_KEY',
      perplexity: 'PERPLEXITY_API_KEY',
    };
    return envMap[provider] || `${provider.toUpperCase().replace(/-/g, '_')}_API_KEY`;
  }
}
