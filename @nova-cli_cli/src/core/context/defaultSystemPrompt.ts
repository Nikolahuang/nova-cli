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
}

export function buildSystemPrompt(options: SystemPromptOptions): string {
  const os = options.os || process.platform;
  
  // Minimal prompt for simple tasks (saves ~60% tokens)
  if (options.minimal) {
    return `Nova CLI. Dir: ${options.workingDirectory}. OS: ${os}. Mode: ${options.approvalMode}.
Rules: Be concise. Use edit_file for edits. Read before write. Confirm destructive ops.`;
  }
  
  // Build tool list based on model's built-in search capability
  const tools = options.supportsBuiltinSearch
    ? 'read_file, write_file, edit_file, list_directory, search_file, search_content, execute_command, web_fetch, todo.'
    : 'read_file, write_file, edit_file, list_directory, search_file, search_content, execute_command, web_search, web_fetch, todo.';
  
  // Add search capability note for models with built-in search
  const searchNote = options.supportsBuiltinSearch
    ? '\n- You have built-in web search capability. Use it for real-time information.'
    : '';
  
  // Standard prompt (optimized)
  return `Nova CLI assistant. Dir: ${options.workingDirectory}. OS: ${os}. Shell: ${os === 'win32' ? 'PowerShell' : 'bash'}.

Rules:
- Be concise. No filler phrases.
- edit_file for changes, read_file first, write_file only for new files.
- Use search tools before modifying.
- Limit list_directory depth.
- Confirm destructive changes (unless yolo mode).
- Break complex tasks into steps.${searchNote}

Tools: ${tools}`;
}
