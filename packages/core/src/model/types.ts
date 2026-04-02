// ============================================================================
// Model Types - Shared types for model providers
// ============================================================================

import type { Message, ContentBlock, ToolUseContent, TextContent, SessionId, ToolCallId } from '../types/session.js';
import type { ToolDefinition } from '../types/tools.js';

/** Options for a model completion request */
export interface ModelRequestOptions {
  model: string;
  maxTokens: number;
  temperature: number;
  tools: ToolDefinition[];
  sessionId: SessionId;
  stopSequences?: string[];
  systemPrompt?: string;
  /** Control thinking mode: enabled|disabled|auto */
  thinking?: string;
}

/** Response from a model completion request */
export interface ModelResponse {
  /** The assistant's message content blocks */
  content: ContentBlock[];
  /** The model that generated the response */
  model: string;
  /** Stop reason */
  stopReason: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence';
  /** Token usage */
  usage: TokenUsage;
  /** The full session ID */
  sessionId: SessionId;
}

/** Token usage information */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}

/** Streaming event types */
export type StreamEvent =
  | { type: 'text_delta'; delta: string }
  | { type: 'thinking_delta'; delta: string }
  | { type: 'tool_call_start'; toolCallId: string; toolName: string }
  | { type: 'tool_call_delta'; toolCallId: string; delta: string }
  | { type: 'tool_call_complete'; toolCallId: string; toolName: string; input: Record<string, unknown> }
  | { type: 'message_start'; model: string }
  | { type: 'message_complete'; stopReason: ModelResponse['stopReason']; usage: TokenUsage }
  | { type: 'error'; error: unknown };

/** Interface that all model providers must implement */
export interface ModelProvider {
  /** Provider display name */
  readonly name: string;

  /** Non-streaming completion */
  complete(messages: Message[], options: ModelRequestOptions): Promise<ModelResponse>;

  /** Streaming completion */
  stream(messages: Message[], options: ModelRequestOptions): AsyncGenerator<StreamEvent>;

  /** Token counting (approximate) */
  countTokens(messages: Message[]): Promise<number>;
}

/** Helper to create a text content block */
export function textContent(text: string): TextContent {
  return { type: 'text', text };
}

/** Helper to create a tool use content block */
export function toolUseContent(id: string, name: string, input: Record<string, unknown>): ToolUseContent {
  return { type: 'tool_use', id: id as ToolCallId, name, input };
}
