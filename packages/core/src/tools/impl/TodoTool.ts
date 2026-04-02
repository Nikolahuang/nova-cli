// ============================================================================
// Todo Tool - Task tracking and progress display
// ============================================================================

import type { ToolHandler, ToolHandlerInput, ToolHandlerOutput } from '../../types/tools.js';
import { ToolError } from '../../types/errors.js';

interface TodoItem {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
}

/** In-memory todo storage per session */
const sessionTodos = new Map<string, TodoItem[]>();

function getTodos(sessionId: string): TodoItem[] {
  if (!sessionTodos.has(sessionId)) {
    sessionTodos.set(sessionId, []);
  }
  return sessionTodos.get(sessionId)!;
}

function renderTodos(todos: TodoItem[]): string {
  if (todos.length === 0) return 'No tasks tracked.';
  const statusIcons: Record<string, string> = {
    pending: '○',
    in_progress: '◉',
    completed: '●',
  };
  return todos.map((t) => `${statusIcons[t.status]} [${t.status.padEnd(12)}] ${t.content}`).join('\n');
}

export const todoHandler: ToolHandler = async (input: ToolHandlerInput): Promise<ToolHandlerOutput> => {
  const { action, items, id, content, status } = input.params as {
    action?: string;
    items?: string;
    id?: string;
    content?: string;
    status?: string;
  };
  const sessionId = input.context.sessionId;
  const todos = getTodos(sessionId);

  switch (action) {
    case 'list': {
      return { content: renderTodos(todos) };
    }

    case 'create': {
      if (!items) {
        throw new ToolError('Missing "items" parameter. Provide a JSON array of task strings.', 'todo');
      }
      let parsed: unknown[];
      try {
        parsed = JSON.parse(typeof items === 'string' ? items : JSON.stringify(items));
      } catch {
        parsed = [String(items)];
      }
      for (const item of parsed) {
        todos.push({ id: `t${todos.length + 1}`, content: String(item), status: 'pending' });
      }
      return { content: `Added ${parsed.length} task(s).\n${renderTodos(todos)}` };
    }

    case 'update': {
      if (!id || !status) {
        throw new ToolError('Missing "id" or "status" parameter.', 'todo');
      }
      const target = todos.find((t) => t.id === id || t.id === `t${id}`);
      if (!target) {
        throw new ToolError(`Task "${id}" not found.`, 'todo');
      }
      const validStatuses = ['pending', 'in_progress', 'completed'];
      if (!validStatuses.includes(status)) {
        throw new ToolError(`Invalid status "${status}". Use: ${validStatuses.join(', ')}`, 'todo');
      }
      if (content) target.content = content;
      target.status = status as TodoItem['status'];
      return { content: renderTodos(todos) };
    }

    case 'clear': {
      todos.length = 0;
      return { content: 'All tasks cleared.' };
    }

    default: {
      // If no action, show current state
      return { content: renderTodos(todos) };
    }
  }
};

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
