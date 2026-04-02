// ============================================================================
// Todo Tool Schema
// ============================================================================

export const todoSchema = {
  type: 'object' as const,
  properties: {
    action: {
      type: 'string',
      enum: ['list', 'create', 'update', 'clear'],
      description: 'Action to perform: list (show tasks), create (add tasks), update (change status), clear (remove all)',
    },
    items: {
      type: 'string',
      description: 'JSON array of task strings to create (for action=create). Example: \'["Task 1", "Task 2"]\'',
    },
    id: {
      type: 'string',
      description: 'Task ID to update (for action=update)',
    },
    content: {
      type: 'string',
      description: 'New content for the task (for action=update)',
    },
    status: {
      type: 'string',
      enum: ['pending', 'in_progress', 'completed'],
      description: 'New status for the task (for action=update)',
    },
  },
  additionalProperties: false,
};
