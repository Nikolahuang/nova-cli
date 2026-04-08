// ============================================================================
// ToolRegistry Tests
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { ToolRegistry } from './ToolRegistry.js';
import type { ToolDefinition, ToolHandler, ToolExecutionContext } from '../types/tools.js';

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  const mockToolDefinition: ToolDefinition = {
    name: 'test_tool',
    description: 'A test tool',
    category: 'utility',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'A message' },
      },
      required: ['message'],
    },
  };

  const mockToolHandler: ToolHandler = async (input: { message: string }) => {
    return { result: `Echo: ${input.message}` };
  };

  const dangerousToolDefinition: ToolDefinition = {
    name: 'dangerous_tool',
    description: 'A dangerous tool',
    category: 'system',
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string' },
      },
    },
    requiresApproval: true,
  };

  const dangerousToolHandler: ToolHandler = async () => ({ success: true });

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  describe('register()', () => {
    it('should register a tool with definition and handler', () => {
      registry.register(mockToolDefinition, mockToolHandler);
      expect(registry.has('test_tool')).toBe(true);
    });

    it('should throw when registering duplicate tool', () => {
      registry.register(mockToolDefinition, mockToolHandler);
      expect(() => {
        registry.register(mockToolDefinition, mockToolHandler);
      }).toThrow('already registered');
    });
  });

  describe('get()', () => {
    it('should return tool entry by name', () => {
      registry.register(mockToolDefinition, mockToolHandler);
      const entry = registry.get('test_tool');

      expect(entry).toBeDefined();
      expect(entry?.definition.name).toBe('test_tool');
    });

    it('should return undefined for non-existent tool', () => {
      const entry = registry.get('non_existent');
      expect(entry).toBeUndefined();
    });
  });

  describe('getDefinition()', () => {
    it('should return tool definition', () => {
      registry.register(mockToolDefinition, mockToolHandler);
      const def = registry.getDefinition('test_tool');

      expect(def).toBeDefined();
      expect(def?.name).toBe('test_tool');
    });
  });

  describe('getHandler()', () => {
    it('should return tool handler', () => {
      registry.register(mockToolDefinition, mockToolHandler);
      const handler = registry.getHandler('test_tool');

      expect(handler).toBeDefined();
    });
  });

  describe('has()', () => {
    it('should return true for registered tool', () => {
      registry.register(mockToolDefinition, mockToolHandler);
      expect(registry.has('test_tool')).toBe(true);
    });

    it('should return false for non-existent tool', () => {
      expect(registry.has('non_existent')).toBe(false);
    });
  });

  describe('unregister()', () => {
    it('should remove tool from registry', () => {
      registry.register(mockToolDefinition, mockToolHandler);
      expect(registry.has('test_tool')).toBe(true);

      registry.unregister('test_tool');
      expect(registry.has('test_tool')).toBe(false);
    });

    it('should return false for non-existent tool', () => {
      expect(registry.unregister('non_existent')).toBe(false);
    });
  });

  describe('enable() and disable()', () => {
    it('should disable a tool', () => {
      registry.register(mockToolDefinition, mockToolHandler);
      registry.disable('test_tool');

      expect(registry.isEnabled('test_tool')).toBe(false);
    });

    it('should re-enable a disabled tool', () => {
      registry.register(mockToolDefinition, mockToolHandler);
      registry.disable('test_tool');
      registry.enable('test_tool');

      expect(registry.isEnabled('test_tool')).toBe(true);
    });
  });

  describe('getToolNames()', () => {
    it('should return empty array when no tools registered', () => {
      expect(registry.getToolNames()).toHaveLength(0);
    });

    it('should return all registered tool names', () => {
      registry.register(mockToolDefinition, mockToolHandler);
      registry.register(dangerousToolDefinition, dangerousToolHandler);

      const names = registry.getToolNames();
      expect(names).toHaveLength(2);
      expect(names).toContain('test_tool');
      expect(names).toContain('dangerous_tool');
    });
  });

  describe('getEnabledToolNames()', () => {
    it('should return only enabled tools', () => {
      registry.register(mockToolDefinition, mockToolHandler);
      registry.register(dangerousToolDefinition, dangerousToolHandler);
      registry.disable('dangerous_tool');

      const names = registry.getEnabledToolNames();
      expect(names).toHaveLength(1);
      expect(names).toContain('test_tool');
    });
  });

  describe('getAllDefinitions()', () => {
    it('should return definitions for all enabled tools', () => {
      registry.register(mockToolDefinition, mockToolHandler);

      const defs = registry.getAllDefinitions();
      expect(defs.length).toBeGreaterThan(0);
      expect(defs[0].name).toBe('test_tool');
    });
  });

  describe('requiresApproval()', () => {
    it('should return false for tool without approval requirement in plan mode', () => {
      registry.register(mockToolDefinition, mockToolHandler);
      // ToolRegistry must be accessed after registration
      const result = registry.requiresApproval('test_tool', {}, 'plan');
      expect(result).toBe(false);
    });

    it('should return true for tool with approval requirement in plan mode', () => {
      registry.register(dangerousToolDefinition, dangerousToolHandler);
      expect(registry.requiresApproval('dangerous_tool', {}, 'plan')).toBe(true);
    });

    it('should return false for all tools in yolo mode', () => {
      registry.register(dangerousToolDefinition, dangerousToolHandler);
      expect(registry.requiresApproval('dangerous_tool', {}, 'yolo')).toBe(false);
    });
  });

  describe('unregister()', () => {
    it('should remove all tools when called for each', () => {
      registry.register(mockToolDefinition, mockToolHandler);
      registry.register(dangerousToolDefinition, dangerousToolHandler);

      registry.unregister('test_tool');
      registry.unregister('dangerous_tool');

      expect(registry.getToolNames()).toHaveLength(0);
    });
  });
});
