// ============================================================================
// Execution Tool Schemas - JSON schemas for shell command execution
// ============================================================================

export const executeCommandSchema = {
  type: 'object' as const,
  properties: {
    command: {
      type: 'string',
      description: 'The shell command to execute',
    },
    workingDirectory: {
      type: 'string',
      description: 'Working directory for the command (overrides session default)',
    },
    env: {
      type: 'object',
      description: 'Additional environment variables for the command',
      additionalProperties: { type: 'string' },
    },
    timeout: {
      type: 'number',
      description: 'Timeout in milliseconds (default: 30000)',
      default: 30000,
    },
    shell: {
      type: 'string',
      description: 'Shell to use (e.g., "bash", "powershell", "cmd")',
    },
    captureStderr: {
      type: 'boolean',
      description: 'Whether to capture stderr separately',
      default: true,
    },
    input: {
      type: 'string',
      description: 'Stdin input for the command',
    },
  },
  required: ['command'],
  additionalProperties: false,
};
