// ============================================================================
// Session Types - Session lifecycle and state management
// ============================================================================

/** Branded type for session identifiers */
export type SessionId = string & { readonly __brand: 'SessionId' };
/** Branded type for message identifiers */
export type MessageId = string & { readonly __brand: 'MessageId' };
/** Branded type for tool call identifiers */
export type ToolCallId = string & { readonly __brand: 'ToolCallId' };

/** Create a branded SessionId */
export function createSessionId(id: string): SessionId {
  return id as SessionId;
}

/** Create a branded MessageId */
export function createMessageId(id: string): MessageId {
  return id as MessageId;
}

/** Create a branded ToolCallId */
export function createToolCallId(id: string): ToolCallId {
  return id as ToolCallId;
}

// --- Session States ---
export type SessionState =
  | 'idle'
  | 'initializing'
  | 'running'
  | 'awaiting_approval'
  | 'paused'
  | 'completed'
  | 'error'
  | 'cancelled';

export type SessionEventType =
  | 'state_change'
  | 'message_added'
  | 'tool_call_start'
  | 'tool_call_complete'
  | 'tool_call_error'
  | 'error'
  | 'context_update'
  | 'approval_required'
  | 'approval_response'
  | 'streaming_start'
  | 'streaming_delta'
  | 'streaming_complete';

export interface SessionEvent<T = unknown> {
  type: SessionEventType;
  sessionId: SessionId;
  timestamp: number;
  data: T;
}

// --- Message Types ---
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

export type ContentBlockType =
  | 'text'
  | 'image'
  | 'thinking'
  | 'tool_use'
  | 'tool_result';

export interface TextContent {
  type: 'text';
  text: string;
}

export interface ImageContent {
  type: 'image';
  source: {
    type: 'base64' | 'url';
    media_type: string;
    data?: string;
    url?: string;
  };
}

export interface ThinkingContent {
  type: 'thinking';
  thinking: string;
}

export interface ToolUseContent {
  type: 'tool_use';
  id: ToolCallId;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultContent {
  type: 'tool_result';
  tool_use_id: ToolCallId;
  content: string | Array<TextContent | ImageContent>;
  is_error?: boolean;
}

export type ContentBlock =
  | TextContent
  | ImageContent
  | ThinkingContent
  | ToolUseContent
  | ToolResultContent;

export interface Message {
    id: MessageId;
    role: MessageRole;
    content: ContentBlock[];
    timestamp: number;
    createdAt: Date;
    metadata?: Record<string, unknown>;
  }
// --- Conversation ---
export interface Conversation {
  messages: Message[];
  systemPrompt?: string;
  context?: ConversationContext;
}

export interface ConversationContext {
  workingDirectory: string;
  environment: Record<string, string>;
  sessionId: SessionId;
  toolResults: Map<string, unknown>;
}

// --- Session Config ---
export interface SessionConfig {
  /** Unique session identifier */
  id: SessionId;
  /** Human-readable session name */
  name?: string;
  /** Model identifier (e.g., 'claude-3-opus-20240229') */
  model: string;
  /** Maximum tokens for model responses */
  maxTokens: number;
  /** Temperature for sampling (0-1) */
  temperature?: number;
  /** System prompt */
  systemPrompt?: string;
  /** Working directory for file operations */
  workingDirectory: string;
  /** Approval mode */
  approvalMode: ApprovalMode;
  /** Whether to enable streaming responses */
  streaming: boolean;
  /** Maximum number of conversation turns */
  maxTurns?: number;
  /** Custom tool definitions */
  tools?: string[];
  /** MCP servers to connect */
  mcpServers?: string[];
  /** Hook scripts configuration */
  hooks?: HookConfig[];
  /** Session metadata */
  metadata?: Record<string, unknown>;
  /** Parent session ID for sub-sessions */
  parentSessionId?: string;
}

// --- Approval ---
export type ApprovalMode =
  | 'yolo'           // Auto-approve everything
  | 'default'        // Ask for approval on potentially destructive ops
  | 'accepting_edits' // Auto-approve file edits only
  | 'plan'           // Always ask before executing
  | 'smart';         // AI-assisted approval decisions

export interface ApprovalRequest {
  id: string;
  sessionId: SessionId;
  toolName: string;
  toolInput: Record<string, unknown>;
  risk: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  timestamp: number;
}

export interface ApprovalResponse {
  requestId: string;
  approved: boolean;
  modifiedInput?: Record<string, unknown>;
  reason?: string;
}

// --- Hooks ---
export type HookEvent =
  | 'PreToolUse'
  | 'PostToolUse'
  | 'SetUpEnvironment'
  | 'Stop'
  | 'SessionStart'
  | 'SessionEnd'
  | 'UserPromptSubmit'
  | 'Notification';

export interface HookConfig {
  event: HookEvent;
  command: string;
  timeout?: number;
  condition?: string;
  matcher?: string;
  description?: string;
}

export interface HookResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  duration: number;
}
