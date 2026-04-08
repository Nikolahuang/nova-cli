// ============================================================================
// Tool Types - Tool definitions, schemas, and execution
// ============================================================================

import type { ToolCallId, ApprovalMode, ApprovalRequest, ApprovalResponse } from './session.js';

// --- Tool Categories ---
export type ToolCategory =
  | 'file'           // File read/write/edit operations
  | 'search'         // Search & grep operations
  | 'execution'      // Shell command execution
  | 'web'            // Web search & fetch
  | 'memory'         // Memory & context management
  | 'orchestration'  // Agent orchestration (task, plan, etc.)
  | 'mcp';           // MCP server tools

// --- Tool Definition ---
export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required?: boolean;
  default?: unknown;
  enum?: string[];
  items?: ToolParameter;
  properties?: Record<string, ToolParameter>;
}

export interface ToolDefinition {
  /** Unique tool name */
  name: string;
  /** Human-readable description for the LLM */
  description: string;
  /** Category for organizational purposes */
  category: ToolCategory;
  /** JSON Schema for input parameters */
  inputSchema: Record<string, unknown>;
  /** Whether this tool requires approval */
  requiresApproval: boolean | ((input: Record<string, unknown>, mode: ApprovalMode) => boolean);
  /** Risk level when tool is used */
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  /** Timeout in milliseconds */
  timeout?: number;
  /** Whether the tool can be cancelled mid-execution */
  cancellable?: boolean;
  /** Tags for searchability */
  tags?: string[];
}

// --- Tool Execution ---
export type ToolExecutionStatus = 'pending' | 'running' | 'completed' | 'error' | 'cancelled';

export interface ToolCall {
  id: ToolCallId;
  toolName: string;
  input: Record<string, unknown>;
  status: ToolExecutionStatus;
  startTime?: number;
  endTime?: number;
  result?: ToolResult;
  error?: ToolErrorData;
}

export interface ToolResult {
  output: string;
  metadata?: Record<string, unknown>;
  filesAffected?: string[];
  duration: number;
}

export interface ToolErrorData {
  code: string;
  message: string;
  details?: unknown;
  retryable: boolean;
}

// --- Tool Registry ---
export interface ToolRegistryEntry {
  definition: ToolDefinition;
  handler: ToolHandler;
  enabled: boolean;
}

export type ToolHandler = (input: ToolHandlerInput) => Promise<ToolHandlerOutput>;

export interface ToolHandlerInput {
  params: Record<string, unknown>;
  context: ToolExecutionContext;
  abortSignal?: AbortSignal;
}

export interface ToolExecutionContext {
  sessionId: string;
  workingDirectory: string;
  environment: Record<string, string>;
  model: string;
  approvalMode: ApprovalMode;
  metadata?: Record<string, unknown>;
  /** Maximum tokens for the model */
  maxTokens?: number;
  /** Approval required callback */
  onApprovalRequired?: (request: ApprovalRequest) => Promise<ApprovalResponse>;
  /** Session manager instance */
  sessionManager?: unknown;
  /** Tool registry instance */
  toolRegistry?: unknown;
  /** Model client instance */
  modelClient?: unknown;
  /** Context compressor instance */
  contextCompressor?: unknown;
}

export interface ToolHandlerOutput {
  content: string;
  isError?: boolean;
  metadata?: Record<string, unknown>;
  filesAffected?: string[];
}

// --- Streaming Events ---
export type ToolStreamEvent =
  | { type: 'stdout'; data: string }
  | { type: 'stderr'; data: string }
  | { type: 'progress'; current: number; total: number; message?: string }
  | { type: 'status'; message: string }
  | { type: 'complete' };

// --- Builtin Tool Names ---
export const BUILTIN_TOOLS = {
  // File operations
  READ_FILE: 'read_file',
  WRITE_FILE: 'write_file',
  EDIT_FILE: 'edit_file',
  LIST_DIRECTORY: 'list_directory',
  APPLY_PATCH: 'apply_patch',
  MULTIEDIT: 'multiedit',
  
  // Search operations
  SEARCH_FILE: 'search_file',
  SEARCH_CONTENT: 'search_content',
  GLOB: 'glob',
  
  // Code intelligence
  LSP: 'lsp',
  
  // Execution
  EXECUTE_COMMAND: 'execute_command',
  
  // Web
  WEB_SEARCH: 'web_search',
  WEB_FETCH: 'web_fetch',
  
  // Memory
  MEMORY_READ: 'memory_read',
  MEMORY_WRITE: 'memory_write',
  
  // Processing
  IMAGE_PROCESSOR: 'image_processor',
  FILE_PROCESSOR: 'file_processor',
  
  // Orchestration
  TODO: 'todo',
  TASK: 'task',
  
  // Interaction
  QUESTION: 'question',
  
  // Output
  TRUNCATE: 'truncate',
} as const;

export type BuiltinToolName = (typeof BUILTIN_TOOLS)[keyof typeof BUILTIN_TOOLS];
