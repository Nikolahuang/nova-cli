// ============================================================================
// EnhancedCompleter Tests
// ============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EnhancedCompleter } from './EnhancedCompleter.ts';
import type { ConfigManager } from '../../../core/src/config/ConfigManager.ts';

// Mock ConfigManager
function createMockConfigManager(): ConfigManager {
  return {
    getConfig: vi.fn(() => ({
      core: {
        defaultModel: 'test-model',
        maxTokens: 4096,
        temperature: 0.7,
      },
      models: {
        providers: {
          'test-provider': {
            type: 'openai-compatible',
            baseUrl: 'https://api.test.com',
            models: {
              'test-model-1': {
                name: 'test-model-1',
                contextWindow: 4096,
                maxOutput: 2048,
                pricing: { input: 0.001, output: 0.002 },
              },
              'test-model-2': {
                name: 'test-model-2',
                contextWindow: 8192,
                maxOutput: 4096,
                pricing: { input: 0.002, output: 0.004 },
              },
            },
          },
          'ollama': {
            type: 'ollama',
            baseUrl: 'http://localhost:11434',
            models: {
              'llama3.2': {
                name: 'llama3.2',
                contextWindow: 128000,
                maxOutput: 4096,
                pricing: { input: 0, output: 0 },
              },
            },
          },
        },
        aliases: {
          'alias-model': 'test-model-1',
        },
      },
    })),
    load: vi.fn(),
    save: vi.fn(),
    getModelConfig: vi.fn(),
  } as unknown as ConfigManager;
}

describe('EnhancedCompleter', () => {
  let completer: EnhancedCompleter;
  let mockConfigManager: ConfigManager;

  beforeEach(() => {
    mockConfigManager = createMockConfigManager();
    completer = new EnhancedCompleter({
      configManager: mockConfigManager,
      cwd: '/test/workspace',
      history: ['/help', '/model test-model-1', 'hello world', 'previous query'],
      skills: ['pdf', 'xlsx', 'browser'],
      mcpServers: [
        { name: 'playwright', status: 'running' },
        { name: 'filesystem', status: 'stopped' },
      ],
    });
  });

  describe('getCompletions()', () => {
    describe('empty input', () => {
      it('should return all commands for empty input', () => {
        const completions = completer.getCompletions('');
        expect(completions.length).toBeGreaterThan(0);
        expect(completions[0].type).toBe('command');
      });
    });

    describe('command completions', () => {
      it('should complete /help command', () => {
        const completions = completer.getCompletions('/hel');
        expect(completions.some(c => c.text === '/help')).toBe(true);
      });

      it('should complete /model command', () => {
        const completions = completer.getCompletions('/mod');
        expect(completions.some(c => c.text === '/model')).toBe(true);
      });

      it('should show all commands starting with /', () => {
        const completions = completer.getCompletions('/');
        expect(completions.length).toBeGreaterThan(5);
        completions.forEach(c => {
          expect(c.text.startsWith('/')).toBe(true);
        });
      });
    });

    describe('model completions', () => {
      it('should show all models after /model ', () => {
        const completions = completer.getCompletions('/model ');
        expect(completions.length).toBeGreaterThan(0);
        expect(completions[0].type).toBe('model');
      });

      it('should filter models by prefix', () => {
        const completions = completer.getCompletions('/model test');
        expect(completions.every(c => c.text.toLowerCase().includes('test'))).toBe(true);
      });
    });

    describe('subcommand completions', () => {
      it('should show subcommands for /skills ', () => {
        const completions = completer.getCompletions('/skills ');
        expect(completions.some(c => c.text === 'list')).toBe(true);
        expect(completions.some(c => c.text === 'use')).toBe(true);
      });

      it('should show subcommands for /mcp ', () => {
        const completions = completer.getCompletions('/mcp ');
        expect(completions.some(c => c.text === 'status')).toBe(true);
        expect(completions.some(c => c.text === 'list')).toBe(true);
      });

      it('should filter subcommands by prefix', () => {
        const completions = completer.getCompletions('/skills us');
        expect(completions.some(c => c.text === 'use')).toBe(true);
        expect(completions.some(c => c.text === 'list')).toBe(false);
      });
    });

    describe('skill completions', () => {
      it('should show skills after /skills use ', () => {
        const completions = completer.getCompletions('/skills use ');
        expect(completions.some(c => c.text === 'pdf')).toBe(true);
        expect(completions.some(c => c.text === 'xlsx')).toBe(true);
      });
    });

    describe('history completions', () => {
      it('should match history for partial input', () => {
        const completions = completer.getCompletions('hel');
        expect(completions.some(c => c.text === 'hello world')).toBe(true);
      });

      it('should not match slash commands as history', () => {
        const completions = completer.getCompletions('/hel');
        // Should return command type, not history
        expect(completions.every(c => c.type === 'command')).toBe(true);
      });
    });

    describe('file completions', () => {
      it('should trigger file completion for @', () => {
        // This will depend on actual filesystem, so just check type
        const completions = completer.getCompletions('@');
        expect(completions.every(c => c.type === 'file' || c.type === 'directory')).toBe(true);
      });
    });

    describe('shell completions', () => {
      it('should suggest common commands for !', () => {
        const completions = completer.getCompletions('!gi');
        expect(completions.some(c => c.text === 'git')).toBe(true);
      });
    });
  });

  describe('updateHistory()', () => {
    it('should update history for completions', () => {
      completer.updateHistory(['new', 'history']);
      const completions = completer.getCompletions('new');
      expect(completions.some(c => c.text === 'new')).toBe(true);
    });
  });

  describe('updateSkills()', () => {
    it('should update skills for completions', () => {
      completer.updateSkills(['new-skill']);
      const completions = completer.getCompletions('/skills use ');
      expect(completions.some(c => c.text === 'new-skill')).toBe(true);
    });
  });

  describe('updateMcpServers()', () => {
    it('should update MCP servers for completions', () => {
      completer.updateMcpServers([{ name: 'new-server', status: 'running' }]);
      // MCP server completions are for /mcp tools command
      const completions = completer.getCompletions('/mcp tools ');
      expect(completions.some(c => c.text === 'new-server')).toBe(true);
    });
  });

  describe('applyCompletion()', () => {
    it('should apply completion to input', () => {
      const result = completer.applyCompletion('/mod', { text: '/model ', displayText: '/model', description: '', type: 'command', priority: 100 }, 4);
      expect(result.text).toBe('/model ');
      expect(result.cursorPos).toBe(7);
    });
  });

  describe('formatCompletion()', () => {
    it('should format completion with icon', () => {
      const formatted = completer.formatCompletion({
        text: 'test',
        displayText: 'test',
        description: 'Test description',
        type: 'command',
        priority: 100,
      }, 40);

      expect(formatted).toContain('test');
      expect(formatted).toContain('Test description');
    });
  });
});
