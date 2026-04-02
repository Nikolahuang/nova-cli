// ============================================================================
// CodingPlanProvider - Support for Chinese Coding Plan platforms
// ============================================================================
//
// Supports multiple Coding Plan platforms with a single API key:
// - Alibaba Cloud (阿里云百炼)
// - Tencent Cloud (腾讯云)
// - Volcengine (火山引擎)
// - Baidu Qianfan (百度千帆)
// - Kimi Code
// - Zhipu AI (智谱)
// - MiniMax
//
// All platforms use OpenAI-compatible API with custom base URLs
// ============================================================================

import { OpenAICompatibleProvider, type OpenAICompatibleConfig } from './OpenAICompatibleProvider.js';

/** Coding Plan platform identifiers */
export type CodingPlanPlatform = 
  | 'alibaba' 
  | 'tencent' 
  | 'volcengine' 
  | 'baidu' 
  | 'kimi' 
  | 'zhipu' 
  | 'minimax'
  | 'custom';

/** Coding Plan configuration */
export interface CodingPlanConfig extends Omit<OpenAICompatibleConfig, 'baseUrl'> {
  platform: CodingPlanPlatform;
  /** Custom base URL (required if platform is 'custom') */
  customBaseUrl?: string;
}

/** Platform-specific configurations */
const PLATFORM_CONFIGS: Record<CodingPlanPlatform, { 
  name: string; 
  baseUrl: string;
  models: string[];
  anthropicBaseUrl?: string;
}> = {
  alibaba: {
    name: 'Alibaba Cloud Coding Plan',
    baseUrl: 'https://coding.dashscope.aliyuncs.com/v1',
    anthropicBaseUrl: 'https://coding.dashscope.aliyuncs.com/apps/anthropic',
    models: ['qwen3.5-plus', 'qwen3-coder', 'glm-5', 'minimax-m2.5', 'kimi-k2.5'],
  },
  tencent: {
    name: 'Tencent Cloud Coding Plan',
    baseUrl: 'https://api.hunyuan.cloud.tencent.com/v1', // 需要从控制台获取实际URL
    models: ['hy-2.0-instruct', 'glm-5', 'kimi-k2.5', 'minimax-m2.5'],
  },
  volcengine: {
    name: 'Volcengine Coding Plan',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', // 需要从控制台获取实际URL
    models: ['doubao-seed-code', 'deepseek-v3.2', 'glm-4.7', 'kimi-k2'],
  },
  baidu: {
    name: 'Baidu Qianfan Coding Plan',
    baseUrl: 'https://qianfan.baidubce.com/v2', // 需要从控制台获取实际URL
    models: ['glm-5', 'minimax-m2.5', 'kimi-k2.5', 'ernie-4.5'],
  },
  kimi: {
    name: 'Kimi Code',
    baseUrl: 'https://api.moonshot.cn/v1',
    models: ['kimi-k2', 'kimi-k2.5'],
  },
  zhipu: {
    name: 'Zhipu AI Coding Plan',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    models: ['glm-4.7', 'glm-5'],
  },
  minimax: {
    name: 'MiniMax Coding Plan',
    baseUrl: 'https://api.minimax.chat/v1',
    models: ['minimax-2.7', 'abab6.5s-chat'],
  },
  custom: {
    name: 'Custom Coding Plan',
    baseUrl: '',
    models: [],
  },
};

/**
 * Coding Plan Provider - Access multiple AI models through Chinese Coding Plan platforms
 * 
 * @example
 * ```typescript
 * // 使用阿里云百炼 Coding Plan
 * const provider = new CodingPlanProvider({
 *   platform: 'alibaba',
 *   apiKey: 'your-coding-plan-api-key',
 *   model: 'qwen3-coder',
 * });
 * 
 * // 使用自定义 Coding Plan
 * const provider = new CodingPlanProvider({
 *   platform: 'custom',
 *   customBaseUrl: 'https://your-coding-plan-endpoint.com/v1',
 *   apiKey: 'your-api-key',
 *   model: 'custom-model',
 * });
 * ```
 */
export class CodingPlanProvider extends OpenAICompatibleProvider {
  readonly name: string;
  readonly platform: CodingPlanPlatform;
  readonly supportedModels: string[];

  constructor(config: CodingPlanConfig) {
    const platformConfig = PLATFORM_CONFIGS[config.platform];
    
    if (!platformConfig) {
      throw new Error(`Unknown Coding Plan platform: ${config.platform}`);
    }

    if (config.platform === 'custom' && !config.customBaseUrl) {
      throw new Error('customBaseUrl is required when platform is "custom"');
    }

    const baseUrl = config.platform === 'custom' 
      ? config.customBaseUrl 
      : platformConfig.baseUrl;

    super({
      apiKey: config.apiKey,
      baseUrl: baseUrl,
      model: config.model,
      headers: config.headers,
    });

    this.name = platformConfig.name;
    this.platform = config.platform;
    this.supportedModels = platformConfig.models;

    // Validate model if platform has known models
    if (platformConfig.models.length > 0 && !platformConfig.models.includes(config.model)) {
      console.warn(
        `[CodingPlanProvider] Model "${config.model}" may not be supported by ${platformConfig.name}. ` +
        `Known models: ${platformConfig.models.join(', ')}`
      );
    }
  }

  /**
   * Get list of supported models for this platform
   */
  getSupportedModels(): string[] {
    return [...this.supportedModels];
  }

  /**
   * Get platform info
   */
  getPlatformInfo(): { name: string; platform: CodingPlanPlatform; baseUrl: string } {
    const config = PLATFORM_CONFIGS[this.platform];
    return {
      name: this.name,
      platform: this.platform,
      baseUrl: this.platform === 'custom' ? '' : config.baseUrl,
    };
  }

  /**
   * Get Anthropic-compatible base URL (for Alibaba Cloud only)
   */
  getAnthropicBaseUrl(): string | null {
    const config = PLATFORM_CONFIGS[this.platform];
    return config.anthropicBaseUrl || null;
  }
}

/**
 * Get all supported Coding Plan platforms
 */
export function getSupportedCodingPlanPlatforms(): Array<{
  platform: CodingPlanPlatform;
  name: string;
  baseUrl: string;
  models: string[];
}> {
  return Object.entries(PLATFORM_CONFIGS)
    .filter(([key]) => key !== 'custom')
    .map(([platform, config]) => ({
      platform: platform as CodingPlanPlatform,
      name: config.name,
      baseUrl: config.baseUrl,
      models: config.models,
    }));
}

/**
 * Quick factory for creating Coding Plan providers
 */
export function createCodingPlanProvider(
  platform: CodingPlanPlatform,
  apiKey: string,
  model: string,
  customBaseUrl?: string
): CodingPlanProvider {
  return new CodingPlanProvider({
    platform,
    apiKey,
    model,
    customBaseUrl,
  });
}
