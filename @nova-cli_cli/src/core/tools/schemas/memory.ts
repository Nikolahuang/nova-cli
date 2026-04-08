// ============================================================================
// Memory Tool Schemas - JSON schemas for memory operations
// ============================================================================

export const memoryReadSchema = {
  type: 'object' as const,
  properties: {
    key: {
      type: 'string',
      description: 'Memory key to read',
    },
    scope: {
      type: 'string',
      description: 'Memory scope ("session", "project", "global")',
      enum: ['session', 'project', 'global'],
      default: 'session',
    },
  },
  required: ['key'],
  additionalProperties: false,
};

export const memoryWriteSchema = {
  type: 'object' as const,
  properties: {
    key: {
      type: 'string',
      description: 'Memory key to write',
    },
    value: {
      type: 'string',
      description: 'Memory value to store',
    },
    scope: {
      type: 'string',
      description: 'Memory scope ("session", "project", "global")',
      enum: ['session', 'project', 'global'],
      default: 'session',
    },
    ttl: {
      type: 'number',
      description: 'Time-to-live in milliseconds',
    },
    tags: {
      type: 'array',
      items: { type: 'string' },
      description: 'Tags for categorization',
    },
  },
  required: ['key', 'value'],
  additionalProperties: false,
};
