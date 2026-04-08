// ============================================================================
// ConfigManager Tests
// ============================================================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConfigManager } from './ConfigManager.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

describe('ConfigManager', () => {
  let configManager: ConfigManager;
  const testConfigDir = path.join(os.tmpdir(), 'nova-test-config-' + Date.now());

  beforeEach(() => {
    // Create test config directory
    if (!fs.existsSync(testConfigDir)) {
      fs.mkdirSync(testConfigDir, { recursive: true });
    }
    configManager = new ConfigManager(testConfigDir);
  });

  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(testConfigDir)) {
      fs.rmSync(testConfigDir, { recursive: true, force: true });
    }
  });

  describe('load()', () => {
    it('should create default config if not exists', async () => {
      const config = await configManager.load();

      expect(config).toBeDefined();
      expect(config.core).toBeDefined();
      expect(config.models).toBeDefined();
      expect(config.models.providers).toBeDefined();
    });

    it('should load existing config', async () => {
      // First load creates default
      await configManager.load();

      // Second load should read from disk
      const configManager2 = new ConfigManager(testConfigDir);
      const config = await configManager2.load();

      expect(config).toBeDefined();
    });

    it('should have expected default providers', async () => {
      const config = await configManager.load();

      const providerNames = Object.keys(config.models.providers);
      expect(providerNames).toContain('anthropic');
      expect(providerNames).toContain('openai');
      expect(providerNames).toContain('ollama');
    });
  });

  describe('getConfig()', () => {
    it('should throw if not loaded', () => {
      expect(() => configManager.getConfig()).toThrow('Configuration not loaded');
    });

    it('should return config after load', async () => {
      await configManager.load();
      const config = configManager.getConfig();

      expect(config).toBeDefined();
    });
  });

  describe('getModelConfig()', () => {
    beforeEach(async () => {
      await configManager.load();
    });

    it('should return null for non-existent model', () => {
      const result = configManager.getModelConfig('non-existent-model');
      expect(result).toBeNull();
    });

    it('should find model by name', () => {
      // Add a test model
      const config = configManager.getConfig();
      config.models.providers['test-provider'] = {
        type: 'openai-compatible',
        baseUrl: 'https://api.test.com',
        models: {
          'test-model': {
            name: 'test-model',
            contextWindow: 4096,
            maxOutput: 2048,
            pricing: { input: 0.001, output: 0.002 },
          },
        },
      };

      const result = configManager.getModelConfig('test-model');
      expect(result).toBeDefined();
      expect(result?.model.name).toBe('test-model');
    });

    it('should parse provider/model format', () => {
      const config = configManager.getConfig();
      config.models.providers['test-provider'] = {
        type: 'openai-compatible',
        baseUrl: 'https://api.test.com',
        models: {
          'test-model': {
            name: 'test-model',
            contextWindow: 4096,
            maxOutput: 2048,
            pricing: { input: 0.001, output: 0.002 },
          },
        },
      };

      const result = configManager.getModelConfig('test-provider/test-model');
      expect(result).toBeDefined();
      expect(result?.provider.name).toBe('test-provider');
      expect(result?.model.name).toBe('test-model');
    });

    it('should return null for non-existent provider in provider/model format', () => {
      const result = configManager.getModelConfig('non-existent/model');
      expect(result).toBeNull();
    });

    it('should return null for non-existent model in existing provider', async () => {
      await configManager.load();
      const config = configManager.getConfig();
      const firstProvider = Object.keys(config.models.providers)[0];

      const result = configManager.getModelConfig(`${firstProvider}/non-existent-model`);
      expect(result).toBeNull();
    });
  });

  describe('save() and persist()', () => {
    it('should persist changes to disk', async () => {
      await configManager.load();

      const config = configManager.getConfig();
      config.core.defaultModel = 'test-default-model';

      await configManager.save(config);

      // Load again in new instance
      const configManager2 = new ConfigManager(testConfigDir);
      await configManager2.load();
      const loadedConfig = configManager2.getConfig();

      expect(loadedConfig.core.defaultModel).toBe('test-default-model');
    });
  });

  describe('aliases', () => {
    beforeEach(async () => {
      await configManager.load();
    });

    it('should resolve alias', () => {
      const config = configManager.getConfig();
      config.models.aliases = { 'alias-model': 'real-model' };
      config.models.providers['test'] = {
        type: 'openai-compatible',
        models: {
          'real-model': {
            name: 'real-model',
            contextWindow: 4096,
            maxOutput: 2048,
            pricing: { input: 0, output: 0 },
          },
        },
      };

      const result = configManager.getModelConfig('alias-model');
      expect(result?.model.name).toBe('real-model');
    });
  });
});
