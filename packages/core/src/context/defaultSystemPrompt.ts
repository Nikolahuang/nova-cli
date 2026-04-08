// ============================================================================
// Default System Prompt - Optimized for token efficiency
// ============================================================================

export interface SystemPromptOptions {
  workingDirectory: string;
  model: string;
  approvalMode: string;
  os?: string;
  /** Minimal mode: reduces prompt size by 60% */
  minimal?: boolean;
  /** Whether the model has built-in search capability */
  supportsBuiltinSearch?: boolean;
  /** Tool registry to dynamically get available tools */
  toolRegistry?: any;
}

export function buildSystemPrompt(options: SystemPromptOptions): string {
  const os = options.os || process.platform;
  
  // Minimal prompt for simple tasks (saves ~60% tokens)
  if (options.minimal) {
    return `Nova CLI. Dir: ${options.workingDirectory}. OS: ${os}. Mode: ${options.approvalMode}.
Rules: Be concise. Use edit_file for edits. Read before write. Confirm destructive ops.`;
  }
  
  // Build tool list dynamically from toolRegistry
  let tools: string;
  if (options.toolRegistry && typeof options.toolRegistry.getToolNames === 'function') {
    const toolNames = options.toolRegistry.getToolNames();
    // Filter out web_search if model has built-in search
    const filteredTools = options.supportsBuiltinSearch 
      ? toolNames.filter((t: string) => t !== 'web_search')
      : toolNames;
    tools = filteredTools.join(', ') + '.';
  } else {
    // Fallback to hardcoded list if toolRegistry not provided
    tools = options.supportsBuiltinSearch
      ? 'read_file, write_file, edit_file, list_directory, search_file, search_content, execute_command, web_fetch, todo.'
      : 'read_file, write_file, edit_file, list_directory, search_file, search_content, execute_command, web_search, web_fetch, todo.';
  }
  
  // Add search capability note for models with built-in search
  const searchNote = options.supportsBuiltinSearch
    ? '\n- You have built-in web search capability. Use it for real-time information.'
    : '';
  
  // Standard prompt (optimized with task management)
  return `Nova CLI assistant. Dir: ${options.workingDirectory}. OS: ${os}. Shell: ${os === 'win32' ? 'PowerShell' : 'bash'}.

Rules:
- Be concise. No filler phrases.
- edit_file for changes, read_file first, write_file only for new files.
- Use search tools before modifying.
- Limit list_directory depth.
- Confirm destructive changes (unless yolo mode).
- Break complex tasks into steps.${searchNote}

Task Management:
- For complex tasks (>2 operations), use the todo tool to track progress.
- Create tasks with: todo([{"task": "task description", "status": "pending"}])
- Update status: todo([{"task": "existing task", "status": "in_progress"}])
- Mark complete: todo([{"task": "completed task", "status": "completed"}])
- This provides real-time progress visibility to users.

Progress Reporting:
- For long-running operations (>5s), provide intermediate status updates.
- Use clear, specific descriptions of current activity.
- Example: "Installing dependencies (Step 2/5)..." rather than "Working..."

Tools: ${tools}`;
}
