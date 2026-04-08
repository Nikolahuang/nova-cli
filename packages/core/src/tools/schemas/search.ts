// ============================================================================
// Search Tool Schemas - JSON schemas for search operations
// ============================================================================

export const searchFileSchema = {
  type: 'object' as const,
  properties: {
    pattern: {
      type: 'string',
      description: 'Glob pattern to search for (e.g., "*.ts", "test*.js")',
    },
    directory: {
      type: 'string',
      description: 'Absolute path to the directory to search in',
    },
    recursive: {
      type: 'boolean',
      description: 'Search in subdirectories',
      default: true,
    },
    caseSensitive: {
      type: 'boolean',
      description: 'Case-sensitive search',
      default: false,
    },
    excludePatterns: {
      type: 'array',
      items: { type: 'string' },
      description: 'Glob patterns to exclude (e.g., ["node_modules", "*.test.ts"])',
    },
    allowExternalAccess: {
      type: 'boolean',
      description: 'Allow searching directories outside the working directory (default: false for security)',
      default: false,
    },
    additionalAllowedPaths: {
      type: 'array',
      items: { type: 'string' },
      description: 'Additional allowed paths for external access. Only used when allowExternalAccess is true.',
    },
  },
  required: ['pattern', 'directory'],
  additionalProperties: false,
};

export const searchContentSchema = {
  type: 'object' as const,
  properties: {
    pattern: {
      type: 'string',
      description: 'Regular expression pattern to search for in file contents',
    },
    directory: {
      type: 'string',
      description: 'Absolute path to the directory to search in',
    },
    filePattern: {
      type: 'string',
      description: 'Glob pattern to filter files (e.g., "*.ts", "*.{js,tsx}")',
    },
    caseSensitive: {
      type: 'boolean',
      description: 'Case-sensitive search',
      default: false,
    },
    includeHidden: {
      type: 'boolean',
      description: 'Include hidden files',
      default: false,
    },
    maxResults: {
      type: 'number',
      description: 'Maximum number of matches to return',
    },
    contextBefore: {
      type: 'number',
      description: 'Number of lines to show before each match',
    },
    contextAfter: {
      type: 'number',
      description: 'Number of lines to show after each match',
    },
    multiline: {
      type: 'boolean',
      description: 'Enable multiline mode',
      default: false,
    },
    allowExternalAccess: {
      type: 'boolean',
      description: 'Allow searching directories outside the working directory (default: false for security)',
      default: false,
    },
    additionalAllowedPaths: {
      type: 'array',
      items: { type: 'string' },
      description: 'Additional allowed paths for external access. Only used when allowExternalAccess is true.',
    },
  },
  required: ['pattern', 'directory'],
  additionalProperties: false,
};

export const globSchema = {
  type: 'object' as const,
  properties: {
    pattern: {
      type: 'string',
      description: 'Glob pattern (e.g., "src/**/*.ts", "**/*.test.ts")',
    },
    directory: {
      type: 'string',
      description: 'Base directory for the glob pattern',
    },
    ignore: {
      type: 'array',
      items: { type: 'string' },
      description: 'Patterns to ignore',
    },
    absolute: {
      type: 'boolean',
      description: 'Return absolute paths',
      default: false,
    },
    dot: {
      type: 'boolean',
      description: 'Include dotfiles',
      default: false,
    },
    allowExternalAccess: {
      type: 'boolean',
      description: 'Allow glob operations outside the working directory (default: false for security)',
      default: false,
    },
    additionalAllowedPaths: {
      type: 'array',
      items: { type: 'string' },
      description: 'Additional allowed paths for external access. Only used when allowExternalAccess is true.',
    },
  },
  required: ['pattern', 'directory'],
  additionalProperties: false,
};
