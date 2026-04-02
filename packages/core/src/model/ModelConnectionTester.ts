// ============================================================================
// ModelConnectionTester - Test model provider connectivity
// ============================================================================

import type { AuthManager } from '../auth/AuthManager.js';
import type { ConfigManager } from '../config/ConfigManager.js';
import { OllamaManager } from './providers/OllamaManager.js';

export interface ModelConnectionStatus {
  provider: string;
  model: string;
  status: 'configured' | 'unconfigured' | 'available' | 'unavailable' | 'error';
  message?: string;
  latency?: number;
}

export interface ProviderConnectionStatus {
  provider: string;
  type: string;
  status: 'configured' | 'unconfigured' | 'partial' | 'unavailable' | 'error';
  hasCredentials: boolean;
  models: ModelConnectionStatus[];
  message?: string;
  latency?: number;
}

/**
 * Test connectivity for model providers
 */
export class ModelConnectionTester {
  private authManager: AuthManager;
  private configManager: ConfigManager;
  private cache: Map<string, ProviderConnectionStatus> = new Map();
  private cacheTimeout = 60000; // 1 minute cache
  private lastTestTime = 0;

  constructor(authManager: AuthManager, configManager: ConfigManager) {
    this.authManager = authManager;
    this.configManager = configManager;
  }

  /**
   * Test all providers and return their status
   */
  async testAllProviders(): Promise<ProviderConnectionStatus[]> {
    const config = this.configManager.getConfig();
    const results: ProviderConnectionStatus[] = [];

    for (const [providerName, providerConfig] of Object.entries(config.models.providers)) {
      const status = await this.testProvider(providerName, providerConfig.type);
      results.push(status);
    }

    this.lastTestTime = Date.now();
    return results;
  }

  /**
   * Test a single provider
   */
  async testProvider(providerName: string, providerType: string): Promise<ProviderConnectionStatus> {
    // Check cache
    const cached = this.cache.get(providerName);
    if (cached && Date.now() - this.lastTestTime < this.cacheTimeout) {
      return cached;
    }

    const config = this.configManager.getConfig();
    const providerConfig = config.models.providers[providerName];
    
    if (!providerConfig) {
      return {
        provider: providerName,
        type: providerType,
        status: 'unconfigured',
        hasCredentials: false,
        models: [],
        message: 'Provider not found in configuration',
      };
    }

    const hasCredentials = this.checkCredentials(providerName, providerType);
    const models: ModelConnectionStatus[] = [];
    let providerStatus: ProviderConnectionStatus['status'] = 'unconfigured';
    let message: string | undefined;
    let latency: number | undefined;

    // For Ollama, test actual connectivity
    if (providerType === 'ollama') {
      const startTime = Date.now();
      try {
        const ollamaCreds = this.authManager.getCredentials('ollama');
        const baseUrl = ollamaCreds?.baseUrl || process.env.OLLAMA_HOST || 'http://localhost:11434';
        const manager = new OllamaManager(baseUrl);
        const isRunning = await manager.ping();
        latency = Date.now() - startTime;

        if (isRunning) {
          providerStatus = 'configured';
          message = `Running at ${baseUrl}`;
          
          // List available models
          const ollamaModels = await manager.listModels();
          for (const model of ollamaModels) {
            models.push({
              provider: providerName,
              model: model.name,
              status: 'available',
              latency,
            });
          }
        } else {
          providerStatus = 'unavailable';
          message = `Ollama not running at ${baseUrl}`;
        }
      } catch (err) {
        providerStatus = 'error';
        message = `Failed to connect: ${(err as Error).message}`;
      }
    }
    // For ollama-cloud, check credentials
    else if (providerType === 'ollama-cloud') {
      if (hasCredentials) {
        providerStatus = 'configured';
        message = 'API key configured';
        
        // Add models from config
        for (const [modelId, modelConfig] of Object.entries(providerConfig.models)) {
          models.push({
            provider: providerName,
            model: modelId,
            status: 'configured',
          });
        }
      } else {
        providerStatus = 'unconfigured';
        message = 'No API key configured';
      }
    }
    // For other providers (anthropic, openai, etc.)
    else {
      if (hasCredentials) {
        // Try to actually test the connection
        const startTime = Date.now();
        const connectionTest = await this.testApiConnection(providerName, providerConfig);
        latency = Date.now() - startTime;

        if (connectionTest.success) {
          providerStatus = 'configured';
          message = connectionTest.message || `Connected (${latency}ms)`;
        } else {
          providerStatus = 'error';
          message = connectionTest.message || 'Connection failed';
        }
        
        // Add models from config with individual status
        for (const [modelId, modelConfig] of Object.entries(providerConfig.models)) {
          models.push({
            provider: providerName,
            model: modelId,
            status: connectionTest.success ? 'available' : 'error',
            message: connectionTest.success ? undefined : connectionTest.message,
            latency: connectionTest.success ? latency : undefined,
          });
        }
      } else {
        providerStatus = 'unconfigured';
        message = 'No API key configured';
        
        // Still list models but mark as unconfigured
        for (const [modelId, modelConfig] of Object.entries(providerConfig.models)) {
          models.push({
            provider: providerName,
            model: modelId,
            status: 'unconfigured',
          });
        }
      }
    }

    const result: ProviderConnectionStatus = {
      provider: providerName,
      type: providerType,
      status: providerStatus,
      hasCredentials,
      models,
      message,
      latency,
    };

    this.cache.set(providerName, result);
    return result;
  }

  /**
   * Quick check if a provider has credentials
   */
  checkCredentials(providerName: string, providerType: string): boolean {
    // Ollama local doesn't need credentials
    if (providerType === 'ollama') {
      return true;
    }
    
    // Check auth manager
    if (this.authManager.hasCredentials(providerName)) {
      return true;
    }

    // Check for common env vars
    const envKeyMap: Record<string, string> = {
      anthropic: 'ANTHROPIC_API_KEY',
      openai: 'OPENAI_API_KEY',
      google: 'GOOGLE_API_KEY',
      deepseek: 'DEEPSEEK_API_KEY',
      qwen: 'DASHSCOPE_API_KEY',
      glm: 'ZHIPU_API_KEY',
      moonshot: 'MOONSHOT_API_KEY',
      baichuan: 'BAICHUAN_API_KEY',
      yi: 'YI_API_KEY',
      minimax: 'MINIMAX_API_KEY',
      groq: 'GROQ_API_KEY',
      mistral: 'MISTRAL_API_KEY',
      together: 'TOGETHER_API_KEY',
      perplexity: 'PERPLEXITY_API_KEY',
      siliconflow: 'SILICONFLOW_API_KEY',
      'ollama-cloud': 'OLLAMA_CLOUD_API_KEY',
    };

    const envKey = envKeyMap[providerName] || envKeyMap[providerType] || `${providerName.toUpperCase()}_API_KEY`;
    return !!process.env[envKey];
  }

  /**
   * Get cached status without testing
   */
  getCachedStatus(providerName: string): ProviderConnectionStatus | undefined {
    return this.cache.get(providerName);
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    this.lastTestTime = 0;
  }

  /**
   * Test a specific model's connectivity (for providers that support it)
   */
  async testModel(providerName: string, modelId: string): Promise<ModelConnectionStatus> {
    const config = this.configManager.getConfig();
    const providerConfig = config.models.providers[providerName];
    
    if (!providerConfig) {
      return {
        provider: providerName,
        model: modelId,
        status: 'unconfigured',
        message: 'Provider not found',
      };
    }

    const hasCredentials = this.checkCredentials(providerName, providerConfig.type);
    
    if (!hasCredentials && providerConfig.type !== 'ollama') {
      return {
        provider: providerName,
        model: modelId,
        status: 'unconfigured',
        message: 'No API key configured',
      };
    }

    // For Ollama, check if model is installed
    if (providerConfig.type === 'ollama') {
      try {
        const ollamaCreds = this.authManager.getCredentials('ollama');
        const baseUrl = ollamaCreds?.baseUrl || process.env.OLLAMA_HOST || 'http://localhost:11434';
        const manager = new OllamaManager(baseUrl);
        
        const isRunning = await manager.ping();
        if (!isRunning) {
          return {
            provider: providerName,
            model: modelId,
            status: 'unavailable',
            message: 'Ollama not running',
          };
        }

        const modelInfo = await manager.showModel(modelId);
        return {
          provider: providerName,
          model: modelId,
          status: 'available',
          message: modelInfo.details?.parameter_size || 'Available',
        };
      } catch (err) {
        return {
          provider: providerName,
          model: modelId,
          status: 'unavailable',
          message: `Model not found: ${(err as Error).message}`,
        };
      }
    }

    // For other providers, we just check credentials
    return {
      provider: providerName,
      model: modelId,
      status: hasCredentials ? 'configured' : 'unconfigured',
    };
  }

  /**
   * Test actual API connection for a provider
   */
  private async testApiConnection(
    providerName: string, 
    providerConfig: any
  ): Promise<{ success: boolean; message?: string }> {
    try {
      const creds = this.authManager.getCredentials(providerName);
      const apiKey = creds?.apiKey || process.env[`${providerName.toUpperCase()}_API_KEY`];
      const baseUrl = creds?.baseUrl || providerConfig.baseUrl;

      if (!apiKey) {
        return { success: false, message: 'No API key available' };
      }

      // For OpenAI-compatible providers, try to list models
      if (providerConfig.type === 'custom' || providerConfig.type === 'openai' || 
          providerConfig.baseUrl?.includes('openai') || providerConfig.baseUrl) {
        try {
          const { OpenAICompatibleProvider } = await import('./providers/OpenAICompatibleProvider.js');
          const tester = new (class extends OpenAICompatibleProvider {
            constructor() {
              super({ apiKey, baseUrl, model: 'probe' });
            }
            get name() { return providerName; }
          })();
          
          const models = await tester.listModels();
          if (models.length > 0) {
            return { success: true, message: `${models.length} models available` };
          }
          return { success: true, message: 'Connected' };
        } catch (err) {
          // If listModels fails, try a simple completion as fallback
          return { success: false, message: `API error: ${(err as Error).message}` };
        }
      }

      // For other providers (Anthropic, etc.), just check credentials for now
      // They could be tested with specific provider SDK calls
      return { success: true, message: 'API key configured' };
    } catch (err) {
      return { success: false, message: `Connection failed: ${(err as Error).message}` };
    }
  }
}
