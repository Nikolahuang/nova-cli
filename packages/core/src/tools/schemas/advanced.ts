// ============================================================================
// Advanced Tool Schemas - JSON schemas for advanced tools
// ============================================================================

export const lspSchema = {
  type: 'object' as const,
  properties: {
    operation: {
      type: 'string',
      enum: ['goto_definition', 'find_references', 'hover', 'rename', 'diagnostics', 'completion'],
      description: 'LSP operation to perform',
    },
    file: {
      type: 'string',
      description: 'Absolute path to the file',
    },
    line: {
      type: 'number',
      description: 'Line number (0-based)',
    },
    character: {
      type: 'number',
      description: 'Character position (0-based)',
    },
    newName: {
      type: 'string',
      description: 'New name for rename operation',
    },
  },
  required: ['operation', 'file', 'line', 'character'],
  additionalProperties: false,
};

export const applyPatchSchema = {
  type: 'object' as const,
  properties: {
    filePath: {
      type: 'string',
      description: 'Absolute path to the file to patch',
    },
    patch: {
      type: 'string',
      description: 'Unified diff format patch content',
    },
    dryRun: {
      type: 'boolean',
      description: 'If true, validate the patch without applying it',
      default: false,
    },
  },
  required: ['filePath', 'patch'],
  additionalProperties: false,
};

export const multieditSchema = {
  type: 'object' as const,
  properties: {
    filePath: {
      type: 'string',
      description: 'Absolute path to the file to edit',
    },
    edits: {
      type: 'array',
      description: 'List of edits to apply in sequence',
      items: {
        type: 'object',
        properties: {
          oldText: {
            type: 'string',
            description: 'Text to replace',
          },
          newText: {
            type: 'string',
            description: 'Replacement text',
          },
          replaceAll: {
            type: 'boolean',
            description: 'Replace all occurrences',
            default: false,
          },
        },
        required: ['oldText', 'newText'],
      },
    },
    dryRun: {
      type: 'boolean',
      description: 'If true, preview changes without applying',
      default: false,
    },
  },
  required: ['filePath', 'edits'],
  additionalProperties: false,
};

export const truncateSchema = {
  type: 'object' as const,
  properties: {
    content: {
      type: 'string',
      description: 'Content to truncate',
    },
    maxLines: {
      type: 'number',
      description: 'Maximum number of lines (default: 500)',
    },
    maxBytes: {
      type: 'number',
      description: 'Maximum bytes (default: 50000)',
    },
    direction: {
      type: 'string',
      enum: ['head', 'tail', 'middle'],
      description: 'Which part to keep',
      default: 'head',
    },
    outputPath: {
      type: 'string',
      description: 'Optional path to save full content',
    },
  },
  required: ['content'],
  additionalProperties: false,
};

export const questionSchema = {
  type: 'object' as const,
  properties: {
    question: {
      type: 'string',
      description: 'Question to ask the user',
    },
    options: {
      type: 'array',
      description: 'Predefined options for the user to choose from',
      items: {
        type: 'object',
        properties: {
          label: {
            type: 'string',
            description: 'Display label',
          },
          description: {
            type: 'string',
            description: 'Optional description',
          },
          value: {
            type: 'string',
            description: 'Value to return if selected',
          },
        },
        required: ['label', 'value'],
      },
    },
    allowOther: {
      type: 'boolean',
      description: 'Allow user to provide a custom answer',
      default: true,
    },
    default: {
      type: 'string',
      description: 'Default value if non-interactive',
    },
    context: {
      type: 'string',
      description: 'Additional context for the question',
    },
  },
  required: ['question'],
  additionalProperties: false,
};
