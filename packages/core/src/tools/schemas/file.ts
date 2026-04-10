// ============================================================================
// File Tool Schemas - JSON schemas for file operation tools
// ============================================================================

export const readFileSchema = {
  type: 'object' as const,
  properties: {
    filePath: {
      type: 'string',
      description: 'Absolute path to the file to read',
    },
    offset: {
      type: 'number',
      description: 'Line number to start reading from (1-based)',
    },
    limit: {
      type: 'number',
      description: 'Number of lines to read',
    },
    encoding: {
      type: 'string',
      description: 'File encoding (default: utf-8)',
      default: 'utf-8',
    },
    timeout: {
      type: 'number',
      description: 'Timeout in milliseconds (default: 30000)',
      default: 30000,
    },
    allowExternalAccess: {
      type: 'boolean',
      description: 'Allow reading files outside the working directory (default: false for security)',
      default: false,
    },
    additionalAllowedPaths: {
      type: 'array',
      items: { type: 'string' },
      description: 'Additional allowed paths for external access. Only used when allowExternalAccess is true.',
    },
  },
  required: ['filePath'],
  additionalProperties: false,
};

export const writeFileSchema = {
  type: 'object' as const,
  properties: {
    filePath: {
      type: 'string',
      description: 'Absolute path to the file to write',
    },
    content: {
      type: 'string',
      description: 'Content to write to the file',
    },
    createDirectories: {
      type: 'boolean',
      description: 'Create parent directories if they do not exist',
      default: false,
    },
    encoding: {
      type: 'string',
      description: 'File encoding (default: utf-8)',
      default: 'utf-8',
    },
    timeout: {
      type: 'number',
      description: 'Timeout in milliseconds (default: 60000 for large files)',
      default: 60000,
    },
    allowExternalAccess: {
      type: 'boolean',
      description: 'Allow writing files outside the working directory (default: false for security)',
      default: false,
    },
    additionalAllowedPaths: {
      type: 'array',
      items: { type: 'string' },
      description: 'Additional allowed paths for external access. Only used when allowExternalAccess is true.',
    },
  },
  required: ['filePath', 'content'],
  additionalProperties: false,
};

export const editFileSchema = {
  type: 'object' as const,
  properties: {
    filePath: {
      type: 'string',
      description: 'Absolute path to the file to edit',
    },
    oldText: {
      type: 'string',
      description: 'The text to replace (must be unique in the file)',
    },
    newText: {
      type: 'string',
      description: 'The replacement text',
    },
    allOccurrences: {
      type: 'boolean',
      description: 'Replace all occurrences of oldText (default: false, replaces first only)',
      default: false,
    },
    dryRun: {
      type: 'boolean',
      description: 'Preview the change without modifying the file',
      default: false,
    },
    timeout: {
      type: 'number',
      description: 'Timeout in milliseconds (default: 30000)',
      default: 30000,
    },
    allowExternalAccess: {
      type: 'boolean',
      description: 'Allow editing files outside the working directory (default: false for security)',
      default: false,
    },
    additionalAllowedPaths: {
      type: 'array',
      items: { type: 'string' },
      description: 'Additional allowed paths for external access. Only used when allowExternalAccess is true.',
    },
  },
  required: ['filePath', 'oldText', 'newText'],
  additionalProperties: false,
};

export const listDirectorySchema = {
  type: 'object' as const,
  properties: {
    dirPath: {
      type: 'string',
      description: 'Absolute path to the directory to list',
    },
    recursive: {
      type: 'boolean',
      description: 'List files recursively',
      default: false,
    },
    includeHidden: {
      type: 'boolean',
      description: 'Include hidden files and directories',
      default: false,
    },
    pattern: {
      type: 'string',
      description: 'Glob pattern to filter results',
    },
    depth: {
      type: 'number',
      description: 'Maximum depth for recursive listing',
    },
    limit: {
      type: 'number',
      description: 'Maximum number of entries to return (default: 500). Use smaller values for faster results.',
      default: 500,
    },
    timeout: {
      type: 'number',
      description: 'Timeout in milliseconds (default: 15000)',
      default: 15000,
    },
    allowExternalAccess: {
      type: 'boolean',
      description: 'Allow listing directories outside the working directory (default: false for security)',
      default: false,
    },
    additionalAllowedPaths: {
      type: 'array',
      items: { type: 'string' },
      description: 'Additional allowed paths for external access. Only used when allowExternalAccess is true.',
    },
  },
  required: ['dirPath'],
  additionalProperties: false,
};
