// ============================================================================
// ModelValidator - Validates model availability and provider configuration
// ============================================================================

import fetch from 'node-fetch';
import { AuthManager } from '../auth/AuthManager.js';

export interface ProviderValidationResult {
  isConfigured: boolean;
  isAccessible: boolean;
  error?: string;
  models: string[];
}

export interface ModelValidationResult {
  provider: string;
  modelId: string;
  isValid: boolean;
  error?: string;
  displayName?: string;
}

export class ModelValidator {
  private authManager: any;

  /**
   * Validate if a provider is properly configured and accessible
   */
  async validateProvider(providerName: string): Promise<ProviderValidationResult> {
    // Check if provider is configured
    const isConfigured = this.authManager.hasCredentials(providerName);
    if (!isConfigured) {
      return {
        isConfigured: false,
        isAccessible: false,
        error: `Provider "${providerName}" not configured`,
        models: []
      };
    }

    try {
      switch (providerName.toLowerCase()) {
        case 'ollama':
          return await this.validateOllama();
        case 'ollama-cloud':
          return await this.validateOllamaCloud();
        default:
          return await this.validateApiProvider(providerName);
      }
    } catch (error) {
      return {
        isConfigured: true,
        isAccessible: false,
        error: `Failed to connect to ${providerName}: ${(error as Error).message}`,
        models: []
      };
    }
  }

  /**
   * Validate a specific model for a provider
   */
  async validateModel(providerName: string, modelId: string): Promise<ModelValidationResult> {
    try {
      const providerResult = await this.validateProvider(providerName);

      if (!providerResult.isAccessible) {
        return {
          provider: providerName,
          modelId,
          isValid: false,
          error: providerResult.error
        };
      }

      // For API providers, basic validation is enough
      if (this.isApiProvider(providerName)) {
        return {
          provider: providerName,
          modelId,
          isValid: true,
          displayName: modelId
        };
      }

      // For Ollama, check if model exists locally
      if (providerName === 'ollama') {
        return await this.validateOllamaModel(modelId);
      }

      return {
        provider: providerName,
        modelId,
        isValid: true,
        displayName: modelId
      };

    } catch (error) {
      return {
        provider: providerName,
        modelId,
        isValid: false,
        error: `Validation failed: ${(error as Error).message}`
      };
    }
  }

  /**
   * Get all available and validated models for all configured providers
   */
  async getValidatedModels(): Promise<Map<string, ModelValidationResult[]>> {
    const result = new Map<string, ModelValidationResult[]>();
    let providers: string[] = [];

    try {
      // Get all providers from config
      const { ConfigManager } = await import('../../../packages/core/src/config/ConfigManager.js');
      const configManager = new ConfigManager();
      await configManager.load();
      providers = Object.keys(configManager.getConfig().models.providers);
    } catch (error) {
      console.warn(`⚠️  Could not load config: ${(error as Error).message}`);
      return result; // Return empty map on error
    }

    for (const providerName of providers) {
      const providerResult = await this.validateProvider(providerName);

      if (providerResult.isAccessible && providerResult.models.length > 0) {
        const models: ModelValidationResult[] = [];

        // Validate each model in the provider
        for (const modelId of providerResult.models) {
          const modelResult = await this.validateModel(providerName, modelId);
          if (modelResult.isValid) {
            models.push(modelResult);
          }
        }

        if (models.length > 0) {
          result.set(providerName, models);
        }
      }
    }

    return result;
  }

  /**
   * Quick check if a provider is ready for use
   */
  isProviderReady(providerName: string): boolean {
    if (!this.authManager.hasCredentials(providerName)) {
      return false;
    }

    // Basic checks for common providers
    switch (providerName.toLowerCase()) {
      case 'ollama':
        const ollamaCreds = this.authManager.getCredentials('ollama');
        return !!ollamaCreds?.baseUrl || process.env.OLLAMA_HOST !== undefined;
      case 'custom':
        const customCreds = this.authManager.getCredentials('custom');
        return !!(customCreds?.apiKey && customCreds?.baseUrl);
      default:
        // API providers just need an API key
        return true;
    }
  }

  private async validateOllama(): Promise<ProviderValidationResult> {
    const baseUrl = this.authManager.getCredentials('ollama')?.baseUrl ||
                   process.env.OLLAMA_HOST ||
                   'http://localhost:11434';

    try {
      const response = await fetch(`${baseUrl}/api/tags`, {
        method: 'GET',
        timeout: 3000
      });

      if (!response.ok) {
        return {
          isConfigured: true,
          isAccessible: false,
          error: `Ollama server returned ${response.status}: ${response.statusText}`,
          models: []
        };
      }

      const data = await response.json() as { models: Array<{ name: string }> };
      const modelNames = data.models.map(m => m.name);

      return {
        isConfigured: true,
        isAccessible: true,
        models: modelNames
      };

    } catch (error) {
      return {
        isConfigured: true,
        isAccessible: false,
        error: `Cannot connect to Ollama at ${baseUrl}: ${(error as Error).message}`,
        models: []
      };
    }
  }

  private async validateOllamaCloud(): Promise<ProviderValidationResult> {
    const apiKey = this.authManager.getCredentials('ollama-cloud')?.apiKey ||
                  process.env.OLLAMA_API_KEY;

    if (!apiKey) {
      return {
        isConfigured: false,
        isAccessible: false,
        error: 'Ollama Cloud API key not found',
        models: []
      };
    }

    try {
      const baseUrl = this.authManager.getCredentials('ollama-cloud')?.baseUrl ||
                     'https://ollama.com';

      const response = await fetch(`${baseUrl}/api/tags`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
        timeout: 5000
      });

      if (!response.ok) {
        return {
          isConfigured: true,
          isAccessible: false,
          error: `Ollama Cloud returned ${response.status}: ${response.statusText}`,
          models: []
        };
      }

      const data = await response.json() as { models: Array<{ name: string }> };
      const modelNames = data.models.map(m => m.name);

      return {
        isConfigured: true,
        isAccessible: true,
        models: modelNames
      };

    } catch (error) {
      return {
        isConfigured: true,
        isAccessible: false,
        error: `Cannot connect to Ollama Cloud: ${(error as Error).message}`,
        models: []
      };
    }
  }

  private async validateApiProvider(providerName: string): Promise<ProviderValidationResult> {
    // For API providers, we can't list models without making expensive calls
    // So we return basic info and let the user try to use it
    const creds = this.authManager.getCredentials(providerName);

    if (!creds?.apiKey) {
      return {
        isConfigured: false,
        isAccessible: false,
        error: `API key not found for ${providerName}`,
        models: []
      };
    }

    // For now, return empty models array - actual model validation happens on use
    return {
      isConfigured: true,
      isAccessible: true,
      models: [] // Will be populated when actually used
    };
  }

  private async validateOllamaModel(modelId: string): Promise<ModelValidationResult> {
    try {
      const validator = new ModelValidator();
      const ollamaResult = await validator.validateOllama();

      if (!ollamaResult.isAccessible) {
        return {
          provider: 'ollama',
          modelId,
          isValid: false,
          error: ollamaResult.error
        };
      }

      const modelExists = ollamaResult.models.includes(modelId);

      return {
        provider: 'ollama',
        modelId,
        isValid: modelExists,
        displayName: modelExists ? modelId : undefined,
        error: modelExists ? undefined : `Model "${modelId}" not found locally`
      };

    } catch (error) {
      return {
        provider: 'ollama',
        modelId,
        isValid: false,
        error: `Failed to validate Ollama model: ${(error as Error).message}`
      };
    }
  }

  private isApiProvider(providerName: string): boolean {
    const apiProviders = new Set([
      'anthropic', 'openai', 'azure', 'google', 'deepseek',
      'qwen', 'glm', 'moonshot', 'baichuan', 'minimax',
      'yi', 'groq', 'mistral', 'together', 'perplexity',
      'coding-plan-alibaba', 'coding-plan-tencent',
      'coding-plan-volcengine', 'coding-plan-baidu',
      'coding-plan-kimi', 'coding-plan-zhipu', 'coding-plan-minimax'
    ]);

    return apiProviders.has(providerName.toLowerCase());
  }

  private getEnvKeyName(provider: string): string {
    const envMap: Record<string, string> = {
      anthropic: 'ANTHROPIC_API_KEY',
      openai: 'OPENAI_API_KEY',
      google: 'GOOGLE_API_KEY',
      deepseek: 'DEEPSEEK_API_KEY',
      qwen: 'QWEN_API_KEY',
      glm: 'GLM_API_KEY',
      moonshot: 'MOONSHOT_API_KEY',
      baichuan: 'BAICHUAN_API_KEY',
      minimax: 'MINIMAX_API_KEY',
      yi: 'YI_API_KEY',
      groq: 'GROQ_API_KEY',
      mistral: 'MISTRAL_API_KEY',
      together: 'TOGETHER_API_KEY',
      perplexity: 'PERPLEXITY_API_KEY',
      'ollama-cloud': 'OLLAMA_API_KEY'
    };

    return envMap[provider] || `${provider.toUpperCase()}_API_KEY`;
  }
}