// ============================================================================
// ToolRegistry - Central registry for tool management
// ============================================================================

import type {
  ToolDefinition,
  ToolHandler,
  ToolRegistryEntry,
  ToolCategory,
  ToolHandlerInput,
  ToolHandlerOutput,
  BuiltinToolName,
} from '../types/tools.js';
import type { ApprovalMode } from '../types/session.js';
import { ToolError, ToolValidationError } from '../types/errors.js';
import { BUILTIN_TOOLS } from '../types/tools.js';

export class ToolRegistry {
  private tools = new Map<string, ToolRegistryEntry>();
  private categories = new Map<ToolCategory, Set<string>>();

  /** Register a tool */
  register(definition: ToolDefinition, handler: ToolHandler): void {
    if (this.tools.has(definition.name)) {
      throw new ToolError(`Tool "${definition.name}" is already registered`, definition.name);
    }

    this.tools.set(definition.name, {
      definition,
      handler,
      enabled: true,
    });

    // Add to category index
    const cat = definition.category;
    if (!this.categories.has(cat)) {
      this.categories.set(cat, new Set());
    }
    this.categories.get(cat)!.add(definition.name);
  }

  /** Unregister a tool by name */
  unregister(name: string): boolean {
    const entry = this.tools.get(name);
    if (!entry) return false;

    this.tools.delete(name);
    this.categories.get(entry.definition.category)?.delete(name);
    return true;
  }

  /** Get a tool entry by name */
  get(name: string): ToolRegistryEntry | undefined {
    return this.tools.get(name);
  }

  /** Get a tool's definition */
  getDefinition(name: string): ToolDefinition | undefined {
    return this.tools.get(name)?.definition;
  }

  /** Get a tool's handler */
  getHandler(name: string): ToolHandler | undefined {
    return this.tools.get(name)?.handler;
  }

  /** Check if a tool exists */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /** Enable a tool */
  enable(name: string): void {
    const entry = this.tools.get(name);
    if (entry) entry.enabled = true;
  }

  /** Disable a tool */
  disable(name: string): void {
    const entry = this.tools.get(name);
    if (entry) entry.enabled = false;
  }

  /** Check if a tool is enabled */
  isEnabled(name: string): boolean {
    return this.tools.get(name)?.enabled ?? false;
  }

  /** Get all tool names */
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /** Get all enabled tool names */
  getEnabledToolNames(): string[] {
    return Array.from(this.tools.entries())
      .filter(([, entry]) => entry.enabled)
      .map(([name]) => name);
  }

  /** Get tools by category */
  getToolsByCategory(category: ToolCategory): ToolRegistryEntry[] {
    const names = this.categories.get(category);
    if (!names) return [];
    return Array.from(names)
      .map((name) => this.tools.get(name)!)
      .filter(Boolean);
  }

  /** Get all tool definitions (for LLM schema) */
  getAllDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values())
      .filter((entry) => entry.enabled)
      .map((entry) => entry.definition);
  }

  /** Get tool definitions in Anthropic tool use format */
  getAnthropicToolDefinitions(): Array<{
    name: string;
    description: string;
    input_schema: Record<string, unknown>;
  }> {
    return this.getAllDefinitions().map((def) => ({
      name: def.name,
      description: def.description,
      input_schema: def.inputSchema,
    }));
  }

  /** Get tool definitions in OpenAI function calling format */
  getOpenAIToolDefinitions(): Array<{
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  }> {
    return this.getAllDefinitions().map((def) => ({
      type: 'function' as const,
      function: {
        name: def.name,
        description: def.description,
        parameters: def.inputSchema,
      },
    }));
  }

  /** Check if a tool requires approval for given input and mode */
  requiresApproval(name: string, input: Record<string, unknown>, mode: ApprovalMode): boolean {
    const entry = this.tools.get(name);
    if (!entry) return false;

    // yolo mode: never require approval
    if (mode === 'yolo') return false;
    // accepting_edits: never require approval
    if (mode === 'accepting_edits') return false;

    const { requiresApproval } = entry.definition;
    if (requiresApproval === undefined) return false;
    if (typeof requiresApproval === 'boolean') return requiresApproval;
    return requiresApproval(input, mode);
  }

  /** Get the risk level of a tool */
  getRiskLevel(name: string): 'low' | 'medium' | 'high' | 'critical' {
    return this.tools.get(name)?.definition.riskLevel ?? 'medium';
  }

  /** Validate tool input against its schema */
  validateInput(name: string, input: Record<string, unknown>): { valid: true } | { valid: false; errors: Array<{ field: string; message: string }> } {
    const entry = this.tools.get(name);
    if (!entry) {
      return { valid: false, errors: [{ field: '_', message: `Tool "${name}" not found` }] };
    }

    const schema = entry.definition.inputSchema;
    // Basic validation against JSON Schema properties
    const errors: Array<{ field: string; message: string }> = [];
    const properties = (schema.properties || {}) as Record<string, Record<string, unknown>>;
    const required = (schema.required || []) as string[];

    // Check required fields
    for (const fieldName of required) {
      if (input[fieldName] === undefined || input[fieldName] === null) {
        errors.push({ field: fieldName, message: `Required field "${fieldName}" is missing` });
      }
    }

    // Check property types
    for (const [fieldName, value] of Object.entries(input)) {
      const propSchema = properties[fieldName];
      if (!propSchema) continue;

      const expectedType = propSchema.type as string | string[];
      const actualType = Array.isArray(value) ? 'array' : typeof value;

      if (Array.isArray(expectedType)) {
        if (!expectedType.includes(actualType)) {
          errors.push({
            field: fieldName,
            message: `Expected type ${expectedType.join('|')}, got ${actualType}`,
          });
        }
      } else if (expectedType && expectedType !== actualType) {
        errors.push({
          field: fieldName,
          message: `Expected type ${expectedType}, got ${actualType}`,
        });
      }
    }

    return errors.length === 0 ? { valid: true } : { valid: false, errors };
  }

  /** Execute a tool with the given input */
  async execute(
    name: string,
    input: ToolHandlerInput
  ): Promise<ToolHandlerOutput> {
    const entry = this.tools.get(name);
    if (!entry) {
      throw new ToolError(`Tool "${name}" not found`, name);
    }
    if (!entry.enabled) {
      throw new ToolError(`Tool "${name}" is disabled`, name);
    }

    // Validate input
    const validation = this.validateInput(name, input.params);
    if (!validation.valid) {
      const errors = 'errors' in validation ? validation.errors : [];
      throw new ToolValidationError(
        `Invalid input for tool "${name}"`,
        name,
        errors
      );
    }

    return entry.handler(input);
  }

  /** Get all builtin tool names */
  getBuiltinToolNames(): BuiltinToolName[] {
    return Object.values(BUILTIN_TOOLS);
  }

  /** Get statistics about registered tools */
  getStats(): { total: number; enabled: number; byCategory: Record<string, number> } {
    const byCategory: Record<string, number> = {};
    for (const [cat, names] of this.categories) {
      byCategory[cat] = names.size;
    }
    return {
      total: this.tools.size,
      enabled: this.getEnabledToolNames().length,
      byCategory,
    };
  }
}
