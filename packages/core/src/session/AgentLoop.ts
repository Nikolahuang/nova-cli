// ============================================================================
// AgentLoop - Core agent execution loop with tool use
// ============================================================================

import type {
  SessionId,
  Message,
  ContentBlock,
  ToolUseContent,
  ToolResultContent,
  ToolCallId,
  SessionConfig,
  ApprovalMode,
  ApprovalRequest,
  ApprovalResponse,
} from '../types/session.js';
import type { ToolDefinition, ToolHandlerInput, ToolHandlerOutput } from '../types/tools.js';
import type { ModelClient } from '../model/ModelClient.js';
import type { SessionManager } from './SessionManager.js';
import type { ContextCompressor } from '../context/ContextCompressor.js';
import { ToolRegistry } from '../tools/ToolRegistry.js';
import { createMessageId, createToolCallId } from '../types/session.js';
import { ToolError, CancelledError, SessionError, TimeoutError } from '../types/errors.js';

/** Maximum tool result size in characters (to prevent token waste) */
const MAX_TOOL_RESULT_CHARS = 10_000;

function truncateToolResult(content: string): string {
  if (content.length <= MAX_TOOL_RESULT_CHARS) return content;
  return content.slice(0, MAX_TOOL_RESULT_CHARS) +
    `\n... [truncated: ${content.length} total chars, showing first ${MAX_TOOL_RESULT_CHARS}]`;
}

export interface AgentLoopOptions {
  modelClient: ModelClient;
  sessionManager: SessionManager;
  toolRegistry: ToolRegistry;
  /** System prompt to send with every request */
  systemPrompt?: string;
  /** Context compressor for intelligent context management */
  contextCompressor?: ContextCompressor;
  /** Maximum context window tokens (for compression decisions) */
  maxContextTokens?: number;
  /** Control thinking mode: enabled|disabled|auto */
  thinking?: string;
  /** Called when tool approval is needed */
  onApprovalRequired?: (request: ApprovalRequest) => Promise<ApprovalResponse>;
  /** Called for each streaming text delta */
  onTextDelta?: (text: string) => void;
  /** Called when a tool starts executing */
  onToolStart?: (toolName: string, toolCallId: string, toolInput?: Record<string, unknown>) => void;
  /** Called when a tool finishes */
  onToolComplete?: (toolName: string, toolCallId: string, result: ToolHandlerOutput) => void;
  /** Called when the loop iteration starts */
  onTurnStart?: (turn: number) => void;
  /** Called when the loop iteration ends */
  onTurnEnd?: (turn: number) => void;
  /** Called when thinking/reasoning content starts streaming */
  onThinkingStart?: () => void;
  /** Called for each thinking content delta */
  onThinkingDelta?: (delta: string) => void;
  /** Called when thinking content ends */
  onThinkingEnd?: () => void;
  /** Called when context compression happens */
  onContextCompress?: (originalTokens: number, resultingTokens: number, action: string) => void;
}

export interface AgentLoopResult {
  messages: Message[];
  turnsCompleted: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  stopReason: string;
}

export class AgentLoop {
  private modelClient: ModelClient;
  private sessionManager: SessionManager;
  private toolRegistry: ToolRegistry;
  private options: Omit<AgentLoopOptions, 'modelClient' | 'sessionManager' | 'toolRegistry'>;
  private systemPrompt?: string;
  private abortController: AbortController | null = null;
  private isRunning = false;
  private contextCompressor?: ContextCompressor;
  private maxContextTokens: number;
  private thinking?: string;

  constructor(options: AgentLoopOptions) {
    this.modelClient = options.modelClient;
    this.sessionManager = options.sessionManager;
    this.toolRegistry = options.toolRegistry;
    this.systemPrompt = options.systemPrompt;
    this.contextCompressor = options.contextCompressor;
    this.maxContextTokens = options.maxContextTokens || 128000;
    this.thinking = options.thinking;
    this.options = {
      onApprovalRequired: options.onApprovalRequired,
      onTextDelta: options.onTextDelta,
      onToolStart: options.onToolStart,
      onToolComplete: options.onToolComplete,
      onTurnStart: options.onTurnStart,
      onTurnEnd: options.onTurnEnd,
      onThinkingStart: options.onThinkingStart,
      onThinkingDelta: options.onThinkingDelta,
      onThinkingEnd: options.onThinkingEnd,
      onContextCompress: options.onContextCompress,
    };
  }

  /**
   * Check if context compression is needed and apply it.
   * Returns the (possibly compressed) message list.
   */
  private maybeCompressContext(messages: Message[]): Message[] {
    if (!this.contextCompressor) return messages;

    const result = this.contextCompressor.compress(messages, {
      maxTokens: this.maxContextTokens,
    });

    if (result.action !== 'keep' && result.originalTokens !== result.resultingTokens) {
      this.options.onContextCompress?.(
        result.originalTokens,
        result.resultingTokens,
        result.action
      );
    }

    return result.messages;
  }

  /** Run the agent loop until completion or max turns */
  async run(sessionId: SessionId, userMessage?: string): Promise<AgentLoopResult> {
    if (this.isRunning) {
      throw new SessionError('Agent loop is already running', sessionId);
    }

    this.isRunning = true;
    this.abortController = new AbortController();

    const sessionManager = this.sessionManager;
    const config = sessionManager.getConfig(sessionId);

    // Set state to running
    sessionManager.setState(sessionId, 'running');

    try {
      // Add user message if provided
      if (userMessage) {
        sessionManager.addMessage(sessionId, 'user', [
          { type: 'text', text: userMessage },
        ]);
      }

      let turnsCompleted = 0;
      let totalInputTokens = 0;
      let totalOutputTokens = 0;
      let finalStopReason = 'end_turn';

      // Agent loop
      while (turnsCompleted < (config.maxTurns || 100)) {
        if (this.abortController.signal.aborted) {
          throw new CancelledError('Agent loop cancelled');
        }

        turnsCompleted++;
        this.options.onTurnStart?.(turnsCompleted);

        // Get current messages (with optional context compression)
        let messages = sessionManager.getMessages(sessionId);
        messages = this.maybeCompressContext(messages);
        const tools = this.toolRegistry.getAllDefinitions();

        // Call the model
        const response = await this.modelClient.complete(messages, tools, sessionId, {
          systemPrompt: this.systemPrompt,
          thinking: this.thinking,
        });

        // Update token usage
        totalInputTokens += response.usage.inputTokens;
        totalOutputTokens += response.usage.outputTokens;
        sessionManager.updateTokenUsage(sessionId, response.usage.inputTokens, response.usage.outputTokens);

        // Add assistant message
        sessionManager.addMessage(sessionId, 'assistant', response.content);

        // Check if we need to execute tools
        const toolUseBlocks = response.content.filter(
          (c): c is ToolUseContent => c.type === 'tool_use'
        );

        if (toolUseBlocks.length === 0 || response.stopReason === 'end_turn') {
          finalStopReason = response.stopReason;
          break;
        }

        // Execute each tool
        for (const toolUse of toolUseBlocks) {
          if (this.abortController.signal.aborted) {
            throw new CancelledError('Agent loop cancelled');
          }

          const result = await this.executeTool(
            sessionId,
            toolUse.id,
            toolUse.name,
            toolUse.input,
            config
          );

          // Add tool result message
          const truncatedContent = truncateToolResult(
            typeof result.content === 'string' ? result.content : JSON.stringify(result.content)
          );
          sessionManager.addMessage(sessionId, 'tool', [
            {
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: truncatedContent,
              is_error: result.isError,
            } as ToolResultContent,
          ]);
        }

        finalStopReason = response.stopReason;
        this.options.onTurnEnd?.(turnsCompleted);

        // Increment turn
        const newTurn = sessionManager.incrementTurn(sessionId);
        if (sessionManager.getState(sessionId) === 'completed') {
          break;
        }
      }

      sessionManager.setState(sessionId, 'idle');
      return {
        messages: sessionManager.getMessages(sessionId),
        turnsCompleted,
        totalInputTokens,
        totalOutputTokens,
        stopReason: finalStopReason,
      };
    } catch (err) {
      sessionManager.setState(sessionId, 'error');
      throw err;
    } finally {
      this.isRunning = false;
      this.abortController = null;
    }
  }

  /** Run the agent loop with streaming */
  async runStream(sessionId: SessionId, userMessage?: string): Promise<AgentLoopResult> {
    if (this.isRunning) {
      throw new SessionError('Agent loop is already running', sessionId);
    }

    this.isRunning = true;
    this.abortController = new AbortController();

    const sessionManager = this.sessionManager;
    const config = sessionManager.getConfig(sessionId);

    sessionManager.setState(sessionId, 'running');

    try {
      if (userMessage) {
        sessionManager.addMessage(sessionId, 'user', [
          { type: 'text', text: userMessage },
        ]);
      }

      let turnsCompleted = 0;
      let totalInputTokens = 0;
      let totalOutputTokens = 0;
      let finalStopReason = 'end_turn';

      while (turnsCompleted < (config.maxTurns || 100)) {
        if (this.abortController.signal.aborted) {
          throw new CancelledError('Agent loop cancelled');
        }

        turnsCompleted++;
        this.options.onTurnStart?.(turnsCompleted);

        // Get current messages (with optional context compression)
        let messages = sessionManager.getMessages(sessionId);
        messages = this.maybeCompressContext(messages);
        const tools = this.toolRegistry.getAllDefinitions();

        // Streaming call
        let currentText = '';
        let currentThinking = '';
        let thinkingActive = false;
        const toolCalls = new Map<string, { name: string; inputJson: string }>();

        for await (const event of this.modelClient.stream(messages, tools, sessionId, {
          systemPrompt: this.systemPrompt,
          thinking: this.thinking,
        })) {
          if (event.type === 'text_delta') {
            // If we were thinking and now get text, close thinking block
            if (thinkingActive) {
              this.options.onThinkingEnd?.();
              thinkingActive = false;
            }
            currentText += event.delta;
            this.options.onTextDelta?.(event.delta);
          } else if (event.type === 'thinking_delta') {
            // If thinking just started, emit start event
            if (!thinkingActive) {
              this.options.onThinkingStart?.();
              thinkingActive = true;
            }
            currentThinking += event.delta;
            this.options.onThinkingDelta?.(event.delta);
          } else if (event.type === 'tool_call_start') {
            // Close thinking block if active
            if (thinkingActive) {
              this.options.onThinkingEnd?.();
              thinkingActive = false;
            }
            toolCalls.set(event.toolCallId, { name: event.toolName, inputJson: '' });
            // onToolStart is called from executeTool() with full input
          } else if (event.type === 'tool_call_delta') {
            const tc = toolCalls.get(event.toolCallId);
            if (tc) tc.inputJson += event.delta;
          } else if (event.type === 'message_complete') {
            // Close thinking block if still active
            if (thinkingActive) {
              this.options.onThinkingEnd?.();
              thinkingActive = false;
            }
            totalInputTokens += event.usage.inputTokens;
            totalOutputTokens += event.usage.outputTokens;
            sessionManager.updateTokenUsage(sessionId, event.usage.inputTokens, event.usage.outputTokens);
            finalStopReason = event.stopReason;
          } else if (event.type === 'error') {
            throw event.error;
          }
        }

        // Build assistant content blocks
        const content: ContentBlock[] = [];
        if (currentThinking) {
          content.push({ type: 'thinking', thinking: currentThinking });
        }
        if (currentText) {
          content.push({ type: 'text', text: currentText });
        }

        for (const [id, tc] of toolCalls) {
          let input: Record<string, unknown>;
          try {
            input = JSON.parse(tc.inputJson);
          } catch {
            input = { raw: tc.inputJson };
          }
          content.push({
            type: 'tool_use',
            id: id as ToolCallId,
            name: tc.name,
            input,
          });
        }

        sessionManager.addMessage(sessionId, 'assistant', content);

        const toolUseBlocks = content.filter(
          (c): c is ToolUseContent => c.type === 'tool_use'
        );

        if (toolUseBlocks.length === 0 || finalStopReason === 'end_turn') {
          break;
        }

        for (const toolUse of toolUseBlocks) {
          if (this.abortController.signal.aborted) {
            throw new CancelledError('Agent loop cancelled');
          }

          const result = await this.executeTool(
            sessionId,
            toolUse.id,
            toolUse.name,
            toolUse.input,
            config
          );

          const truncatedContent = truncateToolResult(
            typeof result.content === 'string' ? result.content : JSON.stringify(result.content)
          );

          sessionManager.addMessage(sessionId, 'tool', [
            {
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: truncatedContent,
              is_error: result.isError,
            } as ToolResultContent,
          ]);
        }

        this.options.onTurnEnd?.(turnsCompleted);
        const newTurn = sessionManager.incrementTurn(sessionId);
        if (sessionManager.getState(sessionId) === 'completed') {
          break;
        }
      }

      sessionManager.setState(sessionId, 'idle');
      return {
        messages: sessionManager.getMessages(sessionId),
        turnsCompleted,
        totalInputTokens,
        totalOutputTokens,
        stopReason: finalStopReason,
      };
    } catch (err) {
      sessionManager.setState(sessionId, 'error');
      throw err;
    } finally {
      this.isRunning = false;
      this.abortController = null;
    }
  }

  /** Cancel the running agent loop */
  cancel(): void {
    this.abortController?.abort();
  }

  /** Check if the loop is running */
  isActive(): boolean {
    return this.isRunning;
  }

  /** Execute a single tool */
  private async executeTool(
    sessionId: SessionId,
    toolCallId: string,
    toolName: string,
    toolInput: Record<string, unknown>,
    config: SessionConfig
  ): Promise<ToolHandlerOutput> {
    // Notify UI that tool execution has started (with full input)
    this.options.onToolStart?.(toolName, toolCallId, toolInput);

    // Check if tool requires approval
    if (this.toolRegistry.requiresApproval(toolName, toolInput, config.approvalMode)) {
      if (this.options.onApprovalRequired) {
        const request: ApprovalRequest = {
          id: toolCallId,
          sessionId,
          toolName,
          toolInput,
          risk: this.toolRegistry.getRiskLevel(toolName),
          description: `Tool "${toolName}" with input: ${JSON.stringify(toolInput).slice(0, 200)}`,
          timestamp: Date.now(),
        };

        const response = await this.options.onApprovalRequired(request);
        if (!response.approved) {
          return {
            content: `Tool execution denied by user: ${response.reason || 'No reason provided'}`,
            isError: true,
          };
        }

        // Use modified input if provided
        if (response.modifiedInput) {
          toolInput = response.modifiedInput;
        }
      }
    }

    const context: ToolHandlerInput = {
      params: toolInput,
      context: {
        sessionId,
        workingDirectory: config.workingDirectory,
        environment: {},
        model: config.model,
        approvalMode: config.approvalMode,
      },
      abortSignal: this.abortController?.signal,
    };

    try {
      const startTime = Date.now();
      const result = await this.toolRegistry.execute(toolName, context);
      const duration = Date.now() - startTime;

      // Debug: Log tool result
      if (process.env.NOVA_DEBUG) {
        console.log(`\n[DEBUG] Tool result:`);
        console.log(`  Success: ${!result.isError}`);
        console.log(`  Duration: ${duration}ms`);
        console.log(`  Content preview:`, result.content?.toString().slice(0, 200));
      }

      this.options.onToolComplete?.(toolName, toolCallId, result);
      return result;
    } catch (err) {
      // Debug: Log error
      if (process.env.NOVA_DEBUG) {
        console.log(`\n[DEBUG] Tool error:`);
        console.log(`  Error:`, err);
      }

      if (err instanceof ToolError) {
        return { content: `[${err.code}] ${err.message}`, isError: true };
      }
      return { content: `Tool error: ${(err as Error).message}`, isError: true };
    }
  }
}
