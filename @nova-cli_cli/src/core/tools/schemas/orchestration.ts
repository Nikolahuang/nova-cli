// ============================================================================
// Orchestration Tool Schemas - JSON schemas for agent orchestration
// ============================================================================

export const taskSchema = {
  type: 'object' as const,
  properties: {
    description: {
      type: 'string',
      description: 'Brief description of the task (3-5 words)',
    },
    prompt: {
      type: 'string',
      description: 'Detailed task description for the sub-agent',
    },
    subagentType: {
      type: 'string',
      description: 'Type of sub-agent to spawn',
      enum: ['code-explorer', 'research', 'executor'],
      default: 'research',
    },
    maxTurns: {
      type: 'number',
      description: 'Maximum number of agentic turns',
      default: 10,
    },
    mode: {
      type: 'string',
      description: 'Permission mode for the sub-agent',
      enum: ['acceptEdits', 'bypassPermissions', 'default', 'plan'],
      default: 'default',
    },
    name: {
      type: 'string',
      description: 'Name for the sub-agent (enables team mode)',
    },
    teamName: {
      type: 'string',
      description: 'Team to join (enables team mode)',
    },
  },
  required: ['description', 'prompt', 'subagentType'],
  additionalProperties: false,
};
