// ============================================================================
// ConfigManager - Loads and manages application configuration
// ============================================================================

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import type { NovaConfig, CoreConfig, ModelProviderConfig, ModelConfig } from '../types/config.js';
import { ConfigError } from '../types/errors.js';

const DEFAULT_CONFIG: NovaConfig = {
  core: {
    defaultModel: 'glm-5',
    defaultApprovalMode: 'default',
    maxTurns: 100,
    maxTokens: 8192,
    temperature: 0.7,
    contextWindowTarget: 128000,
    streaming: true,
    logLevel: 'info',
    timeout: 300000,
  },
  models: {
    providers: {
      anthropic: {
        type: 'anthropic',
        models: {
          // Claude 4 Series
          'claude-sonnet-4-20250514': {
            name: 'Claude Sonnet 4',
            maxContextTokens: 200000,
            maxOutputTokens: 64000,
            supportsVision: true,
            supportsTools: true,
            supportsStreaming: true,
            supportsThinking: true,
            inputCostPerMToken: 3,
            outputCostPerMToken: 15,
          },
          'claude-opus-4-20250514': {
            name: 'Claude Opus 4',
            maxContextTokens: 200000,
            maxOutputTokens: 32000,
            supportsVision: true,
            supportsTools: true,
            supportsStreaming: true,
            supportsThinking: true,
            inputCostPerMToken: 15,
            outputCostPerMToken: 75,
          },
          // Claude 3.5 Series
          'claude-3-5-sonnet-20241022': {
            name: 'Claude 3.5 Sonnet',
            maxContextTokens: 200000,
            maxOutputTokens: 8192,
            supportsVision: true,
            supportsTools: true,
            supportsStreaming: true,
            supportsThinking: false,
            inputCostPerMToken: 3,
            outputCostPerMToken: 15,
          },
          'claude-3-5-sonnet-20240620': {
            name: 'Claude 3.5 Sonnet (Jun 2024)',
            maxContextTokens: 200000,
            maxOutputTokens: 8192,
            supportsVision: true,
            supportsTools: true,
            supportsStreaming: true,
            supportsThinking: false,
            inputCostPerMToken: 3,
            outputCostPerMToken: 15,
          },
          'claude-3-5-haiku-20241022': {
            name: 'Claude 3.5 Haiku',
            maxContextTokens: 200000,
            maxOutputTokens: 8192,
            supportsVision: true,
            supportsTools: true,
            supportsStreaming: true,
            supportsThinking: false,
            inputCostPerMToken: 1,
            outputCostPerMToken: 5,
          },
          // Claude 3 Series
          'claude-3-opus-20240229': {
            name: 'Claude 3 Opus',
            maxContextTokens: 200000,
            maxOutputTokens: 4096,
            supportsVision: true,
            supportsTools: true,
            supportsStreaming: true,
            supportsThinking: false,
            inputCostPerMToken: 15,
            outputCostPerMToken: 75,
          },
          'claude-3-sonnet-20240229': {
            name: 'Claude 3 Sonnet',
            maxContextTokens: 200000,
            maxOutputTokens: 4096,
            supportsVision: true,
            supportsTools: true,
            supportsStreaming: true,
            supportsThinking: false,
            inputCostPerMToken: 3,
            outputCostPerMToken: 15,
          },
          'claude-3-haiku-20240307': {
            name: 'Claude 3 Haiku',
            maxContextTokens: 200000,
            maxOutputTokens: 4096,
            supportsVision: true,
            supportsTools: true,
            supportsStreaming: true,
            supportsThinking: false,
            inputCostPerMToken: 0.25,
            outputCostPerMToken: 1.25,
          },
        },
        defaultModel: 'claude-3-5-sonnet-20241022',
      },
      openai: {
        type: 'openai',
        models: {
          // GPT-4o Series
          'gpt-4o': {
            name: 'GPT-4o',
            maxContextTokens: 128000,
            maxOutputTokens: 16384,
            supportsVision: true,
            supportsTools: true,
            supportsStreaming: true,
            supportsThinking: false,
            inputCostPerMToken: 2.5,
            outputCostPerMToken: 10,
          },
          'gpt-4o-2024-11-20': {
            name: 'GPT-4o (Nov 2024)',
            maxContextTokens: 128000,
            maxOutputTokens: 16384,
            supportsVision: true,
            supportsTools: true,
            supportsStreaming: true,
            supportsThinking: false,
            inputCostPerMToken: 2.5,
            outputCostPerMToken: 10,
          },
          'gpt-4o-mini': {
            name: 'GPT-4o Mini',
            maxContextTokens: 128000,
            maxOutputTokens: 16384,
            supportsVision: true,
            supportsTools: true,
            supportsStreaming: true,
            supportsThinking: false,
            inputCostPerMToken: 0.15,
            outputCostPerMToken: 0.6,
          },
          // o1 Series (reasoning)
          'o1': {
            name: 'o1',
            maxContextTokens: 200000,
            maxOutputTokens: 100000,
            supportsVision: true,
            supportsTools: false,
            supportsStreaming: false,
            supportsThinking: true,
            inputCostPerMToken: 15,
            outputCostPerMToken: 60,
          },
          'o1-mini': {
            name: 'o1-mini',
            maxContextTokens: 128000,
            maxOutputTokens: 65536,
            supportsVision: false,
            supportsTools: false,
            supportsStreaming: false,
            supportsThinking: true,
            inputCostPerMToken: 1.1,
            outputCostPerMToken: 4.4,
          },
          'o3-mini': {
            name: 'o3-mini',
            maxContextTokens: 200000,
            maxOutputTokens: 100000,
            supportsVision: false,
            supportsTools: false,
            supportsStreaming: true,
            supportsThinking: true,
            inputCostPerMToken: 1.1,
            outputCostPerMToken: 4.4,
          },
          // GPT-4 Turbo
          'gpt-4-turbo': {
            name: 'GPT-4 Turbo',
            maxContextTokens: 128000,
            maxOutputTokens: 4096,
            supportsVision: true,
            supportsTools: true,
            supportsStreaming: true,
            supportsThinking: false,
            inputCostPerMToken: 10,
            outputCostPerMToken: 30,
          },
        },
        defaultModel: 'gpt-4o',
      },
      google: {
        type: 'custom',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
        models: {
          'gemini-2.0-flash': {
            name: 'Gemini 2.0 Flash',
            maxContextTokens: 1048576,
            maxOutputTokens: 8192,
            supportsVision: true,
            supportsTools: true,
            supportsStreaming: true,
            supportsThinking: false,
            inputCostPerMToken: 0.1,
            outputCostPerMToken: 0.4,
          },
          'gemini-2.0-flash-lite': {
            name: 'Gemini 2.0 Flash Lite',
            maxContextTokens: 1048576,
            maxOutputTokens: 8192,
            supportsVision: true,
            supportsTools: true,
            supportsStreaming: true,
            supportsThinking: false,
            inputCostPerMToken: 0.05,
            outputCostPerMToken: 0.15,
          },
          'gemini-2.5-pro-preview-05-06': {
            name: 'Gemini 2.5 Pro Preview',
            maxContextTokens: 1048576,
            maxOutputTokens: 65536,
            supportsVision: true,
            supportsTools: true,
            supportsStreaming: true,
            supportsThinking: true,
            inputCostPerMToken: 1.25,
            outputCostPerMToken: 10,
          },
          'gemini-2.5-flash-preview-05-20': {
            name: 'Gemini 2.5 Flash Preview',
            maxContextTokens: 1048576,
            maxOutputTokens: 65536,
            supportsVision: true,
            supportsTools: true,
            supportsStreaming: true,
            supportsThinking: true,
            inputCostPerMToken: 0.15,
            outputCostPerMToken: 0.6,
          },
        },
        defaultModel: 'gemini-2.0-flash',
      },
      deepseek: {
        type: 'custom',
        baseUrl: 'https://api.deepseek.com',
        models: {
          'deepseek-chat': {
            name: 'DeepSeek V3',
            maxContextTokens: 65536,
            maxOutputTokens: 8192,
            supportsVision: false,
            supportsTools: true,
            supportsStreaming: true,
            supportsThinking: false,
            inputCostPerMToken: 0.27,
            outputCostPerMToken: 1.1,
          },
          'deepseek-reasoner': {
            name: 'DeepSeek R1',
            maxContextTokens: 65536,
            maxOutputTokens: 8192,
            supportsVision: false,
            supportsTools: false,
            supportsStreaming: true,
            supportsThinking: true,
            inputCostPerMToken: 0.55,
            outputCostPerMToken: 2.19,
          },
        },
        defaultModel: 'deepseek-chat',
      },
      ollama: {
        type: 'ollama',
        baseUrl: 'http://localhost:11434',
        models: {
          'llama3.1': {
            name: 'Llama 3.1 8B',
            maxContextTokens: 128000,
            maxOutputTokens: 4096,
            supportsVision: false,
            supportsTools: true,
            supportsStreaming: true,
            supportsThinking: false,
          },
          'llama3.1:70b': {
            name: 'Llama 3.1 70B',
            maxContextTokens: 128000,
            maxOutputTokens: 4096,
            supportsVision: false,
            supportsTools: true,
            supportsStreaming: true,
            supportsThinking: false,
          },
          'codellama': {
            name: 'Code Llama',
            maxContextTokens: 16384,
            maxOutputTokens: 4096,
            supportsVision: false,
            supportsTools: true,
            supportsStreaming: true,
            supportsThinking: false,
          },
          'mistral': {
            name: 'Mistral 7B',
            maxContextTokens: 32768,
            maxOutputTokens: 4096,
            supportsVision: false,
            supportsTools: true,
            supportsStreaming: true,
            supportsThinking: false,
          },
          'qwen2.5-coder': {
            name: 'Qwen 2.5 Coder',
            maxContextTokens: 131072,
            maxOutputTokens: 8192,
            supportsVision: false,
            supportsTools: true,
            supportsStreaming: true,
            supportsThinking: false,
          },
          'deepseek-coder-v2': {
            name: 'DeepSeek Coder V2',
            maxContextTokens: 128000,
            maxOutputTokens: 4096,
            supportsVision: false,
            supportsTools: true,
            supportsStreaming: true,
            supportsThinking: false,
          },
          'gemma2': {
            name: 'Gemma 2 9B',
            maxContextTokens: 8192,
            maxOutputTokens: 4096,
            supportsVision: false,
            supportsTools: true,
            supportsStreaming: true,
            supportsThinking: false,
          },
        },
        defaultModel: 'llama3.1',
      },
      // ==================== Ollama Cloud ====================
      'ollama-cloud': {
        type: 'ollama-cloud',
        baseUrl: 'https://ollama.com',
        models: {
          'deepseek-v3.2': {
            name: 'DeepSeek V3.2 (Cloud)',
            maxContextTokens: 131072,
            maxOutputTokens: 8192,
            supportsVision: false,
            supportsTools: true,
            supportsStreaming: true,
            supportsThinking: true,
          },
          'deepseek-v3.1:671b': {
            name: 'DeepSeek V3.1 671B (Cloud)',
            maxContextTokens: 131072,
            maxOutputTokens: 8192,
            supportsVision: false,
            supportsTools: true,
            supportsStreaming: true,
            supportsThinking: true,
          },
          'kimi-k2.5': {
            name: 'Kimi K2.5 (Cloud)',
            maxContextTokens: 131072,
            maxOutputTokens: 8192,
            supportsVision: false,
            supportsTools: true,
            supportsStreaming: true,
            supportsThinking: true,
          },
          'kimi-k2:1t': {
            name: 'Kimi K2 1T (Cloud)',
            maxContextTokens: 131072,
            maxOutputTokens: 8192,
            supportsVision: false,
            supportsTools: true,
            supportsStreaming: true,
            supportsThinking: true,
          },
          'qwen3-coder:480b': {
            name: 'Qwen3 Coder 480B (Cloud)',
            maxContextTokens: 131072,
            maxOutputTokens: 8192,
            supportsVision: false,
            supportsTools: true,
            supportsStreaming: true,
            supportsThinking: false,
          },
          'qwen3.5:397b': {
            name: 'Qwen3.5 397B (Cloud)',
            maxContextTokens: 131072,
            maxOutputTokens: 8192,
            supportsVision: false,
            supportsTools: true,
            supportsStreaming: true,
            supportsThinking: false,
          },
          'glm-5': {
            name: 'GLM-5 (Cloud)',
            maxContextTokens: 128000,
            maxOutputTokens: 8192,
            supportsVision: false,
            supportsTools: true,
            supportsStreaming: true,
            supportsThinking: true,
          },
          'glm-4.7': {
            name: 'GLM-4.7 (Cloud)',
            maxContextTokens: 128000,
            maxOutputTokens: 8192,
            supportsVision: false,
            supportsTools: true,
            supportsStreaming: true,
            supportsThinking: false,
          },
          'mistral-large-3:675b': {
            name: 'Mistral Large 3 675B (Cloud)',
            maxContextTokens: 131072,
            maxOutputTokens: 8192,
            supportsVision: false,
            supportsTools: false,
            supportsStreaming: true,
            supportsThinking: false,
          },
          'gpt-oss:120b': {
            name: 'GPT-OSS 120B (Cloud)',
            maxContextTokens: 131072,
            maxOutputTokens: 8192,
            supportsVision: false,
            supportsTools: false,
            supportsStreaming: true,
            supportsThinking: false,
          },
          'minimax-m2.7': {
            name: 'MiniMax M2.7 (Cloud)',
            maxContextTokens: 131072,
            maxOutputTokens: 8192,
            supportsVision: false,
            supportsTools: false,
            supportsStreaming: true,
            supportsThinking: false,
          },
        },
        defaultModel: 'deepseek-v3.2',
      },
      // ==================== Chinese Providers ====================
      qwen: {
        type: 'custom',
        baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        models: {
          'qwen-max': {
            name: 'Qwen Max',
            maxContextTokens: 32768,
            maxOutputTokens: 8192,
            supportsVision: true,
            supportsTools: true,
            supportsStreaming: true,
            supportsThinking: false,
            inputCostPerMToken: 2,
            outputCostPerMToken: 6,
          },
          'qwen-plus': {
            name: 'Qwen Plus',
            maxContextTokens: 131072,
            maxOutputTokens: 8192,
            supportsVision: false,
            supportsTools: true,
            supportsStreaming: true,
            supportsThinking: false,
            inputCostPerMToken: 0.8,
            outputCostPerMToken: 2,
          },
          'qwen-turbo': {
            name: 'Qwen Turbo',
            maxContextTokens: 131072,
            maxOutputTokens: 8192,
            supportsVision: false,
            supportsTools: true,
            supportsStreaming: true,
            supportsThinking: false,
            inputCostPerMToken: 0.3,
            outputCostPerMToken: 0.6,
          },
          'qwen-coder-plus': {
            name: 'Qwen Coder Plus',
            maxContextTokens: 131072,
            maxOutputTokens: 8192,
            supportsVision: false,
            supportsTools: true,
            supportsStreaming: true,
            supportsThinking: false,
            inputCostPerMToken: 1,
            outputCostPerMToken: 3,
          },
          'qwen-vl-max': {
            name: 'Qwen VL Max',
            maxContextTokens: 32768,
            maxOutputTokens: 8192,
            supportsVision: true,
            supportsTools: false,
            supportsStreaming: true,
            supportsThinking: false,
            inputCostPerMToken: 2,
            outputCostPerMToken: 6,
          },
        },
        defaultModel: 'qwen-max',
      },
      glm: {
        type: 'custom',
        baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
        models: {
          'glm-4-plus': {
            name: 'GLM-4 Plus',
            maxContextTokens: 128000,
            maxOutputTokens: 4096,
            supportsVision: false,
            supportsTools: true,
            supportsStreaming: true,
            supportsThinking: false,
            inputCostPerMToken: 0.5,
            outputCostPerMToken: 0.5,
          },
          'glm-4-flash': {
            name: 'GLM-4 Flash',
            maxContextTokens: 128000,
            maxOutputTokens: 4096,
            supportsVision: false,
            supportsTools: true,
            supportsStreaming: true,
            supportsThinking: false,
            inputCostPerMToken: 0.1,
            outputCostPerMToken: 0.1,
          },
          'glm-4v-plus': {
            name: 'GLM-4V Plus',
            maxContextTokens: 8192,
            maxOutputTokens: 4096,
            supportsVision: true,
            supportsTools: false,
            supportsStreaming: true,
            supportsThinking: false,
            inputCostPerMToken: 0.5,
            outputCostPerMToken: 0.5,
          },
          'glm-4-long': {
            name: 'GLM-4 Long',
            maxContextTokens: 1000000,
            maxOutputTokens: 4096,
            supportsVision: false,
            supportsTools: false,
            supportsStreaming: true,
            supportsThinking: false,
            inputCostPerMToken: 0.1,
            outputCostPerMToken: 0.1,
          },
        },
        defaultModel: 'glm-4-plus',
      },
      moonshot: {
        type: 'custom',
        baseUrl: 'https://api.moonshot.cn/v1',
        models: {
          'moonshot-v1-128k': {
            name: 'Moonshot V1 128K',
            maxContextTokens: 131072,
            maxOutputTokens: 4096,
            supportsVision: false,
            supportsTools: true,
            supportsStreaming: true,
            supportsThinking: false,
            inputCostPerMToken: 0.6,
            outputCostPerMToken: 1.6,
          },
          'moonshot-v1-32k': {
            name: 'Moonshot V1 32K',
            maxContextTokens: 32768,
            maxOutputTokens: 4096,
            supportsVision: false,
            supportsTools: true,
            supportsStreaming: true,
            supportsThinking: false,
            inputCostPerMToken: 0.24,
            outputCostPerMToken: 0.6,
          },
          'moonshot-v1-8k': {
            name: 'Moonshot V1 8K',
            maxContextTokens: 8192,
            maxOutputTokens: 4096,
            supportsVision: false,
            supportsTools: true,
            supportsStreaming: true,
            supportsThinking: false,
            inputCostPerMToken: 0.12,
            outputCostPerMToken: 0.3,
          },
        },
        defaultModel: 'moonshot-v1-128k',
      },
      baichuan: {
        type: 'custom',
        baseUrl: 'https://api.baichuan-ai.com/v1',
        models: {
          'baichuan4': {
            name: 'Baichuan 4',
            maxContextTokens: 131072,
            maxOutputTokens: 4096,
            supportsVision: false,
            supportsTools: true,
            supportsStreaming: true,
            supportsThinking: false,
            inputCostPerMToken: 4,
            outputCostPerMToken: 4,
          },
          'baichuan3-turbo': {
            name: 'Baichuan 3 Turbo',
            maxContextTokens: 32768,
            maxOutputTokens: 4096,
            supportsVision: false,
            supportsTools: true,
            supportsStreaming: true,
            supportsThinking: false,
            inputCostPerMToken: 0.4,
            outputCostPerMToken: 0.4,
          },
        },
        defaultModel: 'baichuan4',
      },
      minimax: {
        type: 'custom',
        baseUrl: 'https://api.minimax.chat/v1',
        models: {
          'abab6.5s': {
            name: 'MiniMax abab6.5s',
            maxContextTokens: 32768,
            maxOutputTokens: 8192,
            supportsVision: false,
            supportsTools: true,
            supportsStreaming: true,
            supportsThinking: false,
            inputCostPerMToken: 1,
            outputCostPerMToken: 1,
          },
        },
        defaultModel: 'abab6.5s',
      },
      yi: {
        type: 'custom',
        baseUrl: 'https://api.lingyiwanwu.com/v1',
        models: {
          'yi-large': {
            name: 'Yi Large',
            maxContextTokens: 16384,
            maxOutputTokens: 4096,
            supportsVision: false,
            supportsTools: true,
            supportsStreaming: true,
            supportsThinking: false,
            inputCostPerMToken: 2,
            outputCostPerMToken: 2,
          },
          'yi-medium': {
            name: 'Yi Medium',
            maxContextTokens: 16384,
            maxOutputTokens: 4096,
            supportsVision: false,
            supportsTools: true,
            supportsStreaming: true,
            supportsThinking: false,
            inputCostPerMToken: 0.35,
            outputCostPerMToken: 0.35,
          },
          'yi-coder': {
            name: 'Yi Coder',
            maxContextTokens: 16384,
            maxOutputTokens: 4096,
            supportsVision: false,
            supportsTools: true,
            supportsStreaming: true,
            supportsThinking: false,
            inputCostPerMToken: 1.5,
            outputCostPerMToken: 1.5,
          },
        },
        defaultModel: 'yi-large',
      },
      siliconflow: {
        type: 'custom',
        baseUrl: 'https://api.siliconflow.cn/v1',
        models: {
          'deepseek-ai/DeepSeek-V3': {
            name: 'DeepSeek V3 (SiliconFlow)',
            maxContextTokens: 65536,
            maxOutputTokens: 8192,
            supportsVision: false,
            supportsTools: true,
            supportsStreaming: true,
            supportsThinking: false,
            inputCostPerMToken: 0.27,
            outputCostPerMToken: 0.11,
          },
          'Qwen/Qwen2.5-72B-Instruct': {
            name: 'Qwen 2.5 72B (SiliconFlow)',
            maxContextTokens: 131072,
            maxOutputTokens: 8192,
            supportsVision: false,
            supportsTools: true,
            supportsStreaming: true,
            supportsThinking: false,
            inputCostPerMToken: 0.7,
            outputCostPerMToken: 0.7,
          },
          'THUDM/glm-4-9b-chat': {
            name: 'GLM-4 9B (SiliconFlow)',
            maxContextTokens: 128000,
            maxOutputTokens: 4096,
            supportsVision: false,
            supportsTools: true,
            supportsStreaming: true,
            supportsThinking: false,
            inputCostPerMToken: 0,
            outputCostPerMToken: 0,
          },
        },
        defaultModel: 'deepseek-ai/DeepSeek-V3',
      },
      // ==================== International Providers ====================
      groq: {
        type: 'custom',
        baseUrl: 'https://api.groq.com/openai/v1',
        models: {
          'llama-3.3-70b-versatile': {
            name: 'Llama 3.3 70B (Groq)',
            maxContextTokens: 131072,
            maxOutputTokens: 32768,
            supportsVision: false,
            supportsTools: true,
            supportsStreaming: true,
            supportsThinking: false,
            inputCostPerMToken: 0.59,
            outputCostPerMToken: 0.79,
          },
          'llama-3.1-8b-instant': {
            name: 'Llama 3.1 8B (Groq)',
            maxContextTokens: 131072,
            maxOutputTokens: 8192,
            supportsVision: false,
            supportsTools: true,
            supportsStreaming: true,
            supportsThinking: false,
            inputCostPerMToken: 0.05,
            outputCostPerMToken: 0.08,
          },
          'mixtral-8x7b-32768': {
            name: 'Mixtral 8x7B (Groq)',
            maxContextTokens: 32768,
            maxOutputTokens: 8192,
            supportsVision: false,
            supportsTools: true,
            supportsStreaming: true,
            supportsThinking: false,
            inputCostPerMToken: 0.24,
            outputCostPerMToken: 0.24,
          },
          'gemma2-9b-it': {
            name: 'Gemma 2 9B (Groq)',
            maxContextTokens: 8192,
            maxOutputTokens: 4096,
            supportsVision: false,
            supportsTools: true,
            supportsStreaming: true,
            supportsThinking: false,
            inputCostPerMToken: 0.05,
            outputCostPerMToken: 0.08,
          },
        },
        defaultModel: 'llama-3.3-70b-versatile',
      },
      mistral: {
        type: 'custom',
        baseUrl: 'https://api.mistral.ai/v1',
        models: {
          'mistral-large-latest': {
            name: 'Mistral Large',
            maxContextTokens: 131072,
            maxOutputTokens: 8192,
            supportsVision: false,
            supportsTools: true,
            supportsStreaming: true,
            supportsThinking: false,
            inputCostPerMToken: 2,
            outputCostPerMToken: 6,
          },
          'codestral-latest': {
            name: 'Codestral',
            maxContextTokens: 32768,
            maxOutputTokens: 8192,
            supportsVision: false,
            supportsTools: true,
            supportsStreaming: true,
            supportsThinking: false,
            inputCostPerMToken: 0.3,
            outputCostPerMToken: 0.9,
          },
          'mistral-small-latest': {
            name: 'Mistral Small',
            maxContextTokens: 131072,
            maxOutputTokens: 8192,
            supportsVision: false,
            supportsTools: true,
            supportsStreaming: true,
            supportsThinking: false,
            inputCostPerMToken: 0.2,
            outputCostPerMToken: 0.6,
          },
        },
        defaultModel: 'mistral-large-latest',
      },
      together: {
        type: 'custom',
        baseUrl: 'https://api.together.xyz/v1',
        models: {
          'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo': {
            name: 'Llama 3.1 70B (Together)',
            maxContextTokens: 131072,
            maxOutputTokens: 8192,
            supportsVision: false,
            supportsTools: true,
            supportsStreaming: true,
            supportsThinking: false,
            inputCostPerMToken: 0.88,
            outputCostPerMToken: 0.88,
          },
          'mistralai/Mixtral-8x7B-Instruct-v0.1': {
            name: 'Mixtral 8x7B (Together)',
            maxContextTokens: 32768,
            maxOutputTokens: 8192,
            supportsVision: false,
            supportsTools: true,
            supportsStreaming: true,
            supportsThinking: false,
            inputCostPerMToken: 0.24,
            outputCostPerMToken: 0.24,
          },
        },
        defaultModel: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
      },
      perplexity: {
        type: 'custom',
        baseUrl: 'https://api.perplexity.ai',
        models: {
          'sonar-pro': {
            name: 'Sonar Pro',
            maxContextTokens: 200000,
            maxOutputTokens: 8192,
            supportsVision: false,
            supportsTools: false,
            supportsStreaming: true,
            supportsThinking: false,
            inputCostPerMToken: 3,
            outputCostPerMToken: 15,
          },
          'sonar': {
            name: 'Sonar',
            maxContextTokens: 127000,
            maxOutputTokens: 8192,
            supportsVision: false,
            supportsTools: false,
            supportsStreaming: true,
            supportsThinking: false,
            inputCostPerMToken: 1,
            outputCostPerMToken: 1,
          },
        },
        defaultModel: 'sonar-pro',
      },
    },
    aliases: {
      // Claude aliases
      'claude': 'claude-3-5-sonnet-20241022',
      'sonnet': 'claude-3-5-sonnet-20241022',
      'sonnet4': 'claude-sonnet-4-20250514',
      'opus': 'claude-3-opus-20240229',
      'opus4': 'claude-opus-4-20250514',
      'haiku': 'claude-3-5-haiku-20241022',
      // OpenAI aliases
      'gpt4': 'gpt-4o',
      'gpt4mini': 'gpt-4o-mini',
      'o1': 'o1',
      'o1mini': 'o1-mini',
      'o3mini': 'o3-mini',
      // Google aliases
      'gemini': 'gemini-2.0-flash',
      'gemflash': 'gemini-2.0-flash',
      'gempro': 'gemini-2.5-pro-preview-05-06',
      // DeepSeek aliases
      'deepseek': 'deepseek-chat',
      'dsr1': 'deepseek-reasoner',
      // Chinese provider aliases
      'qwen': 'qwen-max',
      'qwenplus': 'qwen-plus',
      'qwen-turbo': 'qwen-turbo',
      'qwen-coder': 'qwen-coder-plus',
      'glm': 'glm-4-plus',
      'glm4': 'glm-4-plus',
      'moonshot': 'moonshot-v1-128k',
      'baichuan': 'baichuan4',
      'yi': 'yi-large',
      // International provider aliases
      'groq': 'llama-3.3-70b-versatile',
      'mistral': 'mistral-large-latest',
      'codestral': 'codestral-latest',
      'sonar': 'sonar-pro',
      // Ollama aliases
      'local': 'llama3.1',
      // Ollama Cloud aliases
      'cloud': 'deepseek-v3.2',
      'deepseek-cloud': 'deepseek-v3.2',
      'kimi': 'kimi-k2.5',
      'qwen-cloud': 'qwen3-coder:480b',
      'glm-cloud': 'glm-5',
    },
  },
  security: {
    sandbox: 'restricted',
    checkpoints: true,
    blockedCommands: ['rm -rf /', 'mkfs', 'dd if=', ':(){ :|:& };:'],
    allowedCommands: ['ls', 'cat', 'pwd', 'echo', 'which', 'node', 'npm', 'pnpm'],
  },
  fileFilter: {
    ignorePatterns: ['node_modules/**', '.git/**', 'dist/**', 'build/**', '*.log', '.env', '.env.local'],
    maxFileSize: 10 * 1024 * 1024,
    maxBatchSize: 100,
  },
  telemetry: {
    enabled: false,
    track: { usage: false, errors: true, performance: false },
  },
  extensions: {
    enabled: [],
  },
  preferences: {
    theme: 'auto',
    language: 'en',
  },
};

export class ConfigManager {
  private config: NovaConfig | null = null;
  private configPath: string;
  private projectConfigPath: string | null = null;

  constructor() {
    this.configPath = path.join(os.homedir(), '.nova', 'config.yaml');
  }

  /** Load configuration from file, merging with defaults */
  async load(projectDir?: string): Promise<NovaConfig> {
    this.config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));

    // Load global config
    try {
      const globalContent = await fs.readFile(this.configPath, 'utf-8');
      const globalConfig = this.parseConfig(globalContent);
      this.config = this.mergeConfig(this.config, globalConfig);
    } catch {
      // Global config doesn't exist yet, that's fine
    }

    // Load project config
    if (projectDir) {
      const projectPaths = [
        path.join(projectDir, '.nova', 'config.yaml'),
        path.join(projectDir, '.nova', 'config.json'),
        path.join(projectDir, '.nova.json'),
      ];

      for (const p of projectPaths) {
        try {
          const content = await fs.readFile(p, 'utf-8');
          const projectConfig = p.endsWith('.json') ? JSON.parse(content) : this.parseConfig(content);
          this.config = this.mergeConfig(this.config, projectConfig);
          this.projectConfigPath = p;
          break;
        } catch {
          continue;
        }
      }
    }

    this.applyEnvOverrides();
    return this.config;
  }

  /** Get the loaded configuration */
  getConfig(): NovaConfig {
    if (!this.config) {
      throw new ConfigError('Configuration not loaded. Call load() first.');
    }
    return this.config;
  }

  /** Get core config */
  getCoreConfig(): CoreConfig {
    return this.getConfig().core;
  }

  /** Get model configuration */
  getModelConfig(modelId: string): { provider: ModelProviderConfig; model: ModelConfig } | null {
    const config = this.getConfig();

    // Handle provider/model format (e.g., "coding-plan-alibaba/glm-5")
    let targetProvider: string | null = null;
    let targetModelId: string = modelId;

    if (modelId.includes('/')) {
      const [providerKey, modelKey] = modelId.split('/');
      targetProvider = providerKey;
      targetModelId = modelKey;
    }

    // Resolve alias for the model ID (not for provider/model format)
    const resolvedId = targetProvider ? targetModelId : (config.models.aliases?.[modelId] || modelId);

    // If provider was specified, look only in that provider
    if (targetProvider) {
      const provider = config.models.providers[targetProvider];
      if (provider) {
        const model = provider.models[targetModelId];
        if (model) {
          return {
            provider: { ...provider, name: targetProvider },
            model,
          };
        }
      }
      return null; // Provider specified but not found or model not in provider
    }

    // Otherwise, search across all providers
    for (const [providerName, provider] of Object.entries(config.models.providers)) {
      const model = provider.models[resolvedId];
      if (model) {
        return {
          provider: { ...provider, name: providerName },
          model,
        };
      }
    }

    return null;
  }

  /**
   * Dynamically register a model to an existing provider.
   * Useful for Ollama runtime model discovery and custom provider model addition.
   * Returns true if the model was newly registered, false if it already existed.
   */
  registerModel(
    providerName: string,
    modelId: string,
    modelConfig: ModelConfig,
    providerOverrides?: Partial<ModelProviderConfig>
  ): boolean {
    if (!this.config) return false;

    if (!this.config.models.providers[providerName]) {
      // Create a new provider entry
      this.config.models.providers[providerName] = {
        type: providerOverrides?.type || 'custom',
        models: {},
        ...(providerOverrides?.baseUrl && { baseUrl: providerOverrides.baseUrl }),
        ...(providerOverrides?.defaultModel && { defaultModel: providerOverrides.defaultModel }),
      };
    }

    const provider = this.config.models.providers[providerName];
    if (provider.models[modelId]) return false; // Already exists

    provider.models[modelId] = modelConfig;
    if (!provider.defaultModel) {
      provider.defaultModel = modelId;
    }
    return true;
  }

  /**
   * Dynamically register a complete provider with models.
   */
  registerProvider(providerName: string, providerConfig: ModelProviderConfig): boolean {
    if (!this.config) return false;
    this.config.models.providers[providerName] = providerConfig;
    return true;
  }

  /**
   * Add a model alias.
   */
  registerAlias(alias: string, targetModelId: string): void {
    if (!this.config) return;
    if (!this.config.models.aliases) {
      this.config.models.aliases = {};
    }
    this.config.models.aliases[alias] = targetModelId;
  }

  /** Get config file path */
  getConfigPath(): string {
    return this.configPath;
  }

  /** Set the default model */
  setDefaultModel(modelId: string): void {
    if (!this.config) return;
    this.config.core.defaultModel = modelId;
  }

  /** Save configuration */
  async save(config: Partial<NovaConfig>): Promise<void> {
    const dir = path.dirname(this.configPath);
    await fs.mkdir(dir, { recursive: true });
    const content = JSON.stringify(config, null, 2);
    await fs.writeFile(this.configPath, content, 'utf-8');
  }

  /** Deep merge two configurations */
  private mergeConfig(base: NovaConfig, source: Partial<NovaConfig>): NovaConfig {
    const result = { ...base };
    for (const [key, value] of Object.entries(source)) {
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        (result as any)[key] = { ...((base as any)[key] || {}), ...value };
      } else if (value !== undefined) {
        (result as any)[key] = value;
      }
    }
    return result;
  }

  /** Apply environment variable overrides */
  private applyEnvOverrides(): void {
    if (!this.config) return;

    const overrides: Record<string, (v: string) => void> = {
      NOVA_MODEL: (v) => { this.config!.core.defaultModel = v; },
      NOVA_LOG_LEVEL: (v) => { this.config!.core.logLevel = v as any; },
      NOVA_MAX_TURNS: (v) => { this.config!.core.maxTurns = parseInt(v, 10); },
      NOVA_MAX_TOKENS: (v) => { this.config!.core.maxTokens = parseInt(v, 10); },
      NOVA_TEMPERATURE: (v) => { this.config!.core.temperature = parseFloat(v); },
      NOVA_APPROVAL_MODE: (v) => { this.config!.core.defaultApprovalMode = v as any; },
    };

    for (const [envKey, setter] of Object.entries(overrides)) {
      const value = process.env[envKey];
      if (value) setter(value);
    }
  }

  /** Simple config parser (YAML-like or JSON) */
  private parseConfig(content: string): Record<string, unknown> {
    try {
      // Try JSON first
      return JSON.parse(content);
    } catch {
      // Fallback: simple line-based parsing
      const result: Record<string, unknown> = {};
      const lines = content.split('\n');
      let currentKey = '';

      for (const line of lines) {
        if (line.trim().startsWith('#') || !line.trim()) continue;
        const indent = line.search(/\S/);

        if (indent === 0) {
          const [key, ...valueParts] = line.trim().split(':');
          const value = valueParts.join(':').trim();
          currentKey = key;
          result[key] = value ? this.parseValue(value) : {};
        } else if (currentKey && typeof result[currentKey] === 'object') {
          const [key, ...valueParts] = line.trim().split(':');
          const value = valueParts.join(':').trim();
          (result[currentKey] as Record<string, unknown>)[key] = this.parseValue(value);
        }
      }
      return result;
    }
  }

  /** Parse a scalar value */
  private parseValue(value: string): unknown {
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (value === 'null' || value === '~') return null;
    if (/^-?\d+$/.test(value)) return parseInt(value, 10);
    if (/^-?\d+\.\d+$/.test(value)) return parseFloat(value);
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      return value.slice(1, -1);
    }
    return value;
  }
}
