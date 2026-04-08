// ============================================================================
// OptimizedAgentLoop - Performance-optimized agent execution loop
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
import { ToolRegistry } from '../tools/ToolRegistry.js';
import { ToolError, CancelledError, SessionError } from '../types/errors.js';
import { OptimizedContextCompressor } from '../context/OptimizedContextCompressor.js';

const MAX_TOOL_RESULT_CHARS = 10_000;

function truncateToolResult(content: string): string {
  if (content.length <= MAX_TOOL_RESULT_CHARS) return content;
  return content.slice(0, MAX_TOOL_RESULT_CHARS) +
    `\n... [truncated: ${content.length} total chars, showing first ${MAX_TOOL_RESULT_CHARS}]`;
}

export interface OptimizedAgentLoopOptions {
  modelClient: ModelClient;
  sessionManager: SessionManager;
  toolRegistry: ToolRegistry;
  systemPrompt?: string;
  contextCompressor?: OptimizedContextCompressor;
  maxContextTokens?: number;
  thinking?: string;
  onApprovalRequired?: (request: ApprovalRequest) => Promise<ApprovalResponse>;
  onTextDelta?: (text: string) => void;
  onToolStart?: (toolName: string, toolCallId: string, toolInput?: Record<string, unknown>) => void;
  onToolComplete?: (toolName: string, toolCallId: string, result: ToolHandlerOutput) => void;
  onTurnStart?: (turn: number) => void;
  onTurnEnd?: (turn: number) => void;
  onThinkingStart?: () => void;
  onThinkingDelta?: (delta: string) => void;
  onThinkingEnd?: () => void;
  onContextCompress?: (originalTokens: number, resultingTokens: number, action: string) => void;
  /** Maximum concurrent tool executions (default: 3) */
  maxConcurrentTools?: number;
  /** Enable incremental compression (default: true) */
  incrementalCompression?: boolean;
}

export interface AgentLoopResult {
  messages: Message[];
  turnsCompleted: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  stopReason: string;
}

export class OptimizedAgentLoop {
  private modelClient: ModelClient;
  private sessionManager: SessionManager;
  private toolRegistry: ToolRegistry;
  private options: Omit<OptimizedAgentLoopOptions, 'modelClient' | 'sessionManager' | 'toolRegistry'>;
  private systemPrompt?: string;
  private abortController: AbortController | null = null;
  private isRunning = false;
  private contextCompressor?: OptimizedContextCompressor;
  private maxContextTokens: number;
  private thinking?: string;
  private maxConcurrentTools: number;
  private incrementalCompression: boolean;

  // Performance tracking
  private toolExecutionTimes = new Map<string, number>();
  private compressionTimes: number[] = [];
  private modelCallTimes: number[] = [];

  constructor(options: OptimizedAgentLoopOptions) {
    this.modelClient = options.modelClient;
    this.sessionManager = options.sessionManager;
    this.toolRegistry = options.toolRegistry;
    this.systemPrompt = options.systemPrompt;
    this.contextCompressor = options.contextCompressor;
    this.maxContextTokens = options.maxContextTokens || 128000;
    this.thinking = options.thinking;
    this.maxConcurrentTools = options.maxConcurrentTools || 3;
    this.incrementalCompression = options.incrementalCompression !== false;
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
   * Optimized context compression with caching
   */
  private maybeCompressContext(messages: Message[]): Message[] {
    if (!this.contextCompressor) return messages;

    const start = Date.now();
    const result = this.contextCompressor.compress(messages, {
      maxTokens: this.maxContextTokens,
    });
    const duration = Date.now() - start;

    this.compressionTimes.push(duration);

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

        // Get current messages (with optimized context compression)
        let messages = sessionManager.getMessages(sessionId);
        messages = this.maybeCompressContext(messages);
        const tools = this.toolRegistry.getAllDefinitions();

        // Call the model with timing
        const modelStart = Date.now();
        const response = await this.modelClient.complete(messages, tools, sessionId, {
          systemPrompt: this.systemPrompt,
          thinking: this.thinking,
        });
        const modelDuration = Date.now() - modelStart;
        this.modelCallTimes.push(modelDuration);

        totalInputTokens += response.usage.inputTokens;
        totalOutputTokens += response.usage.outputTokens;
        sessionManager.updateTokenUsage(sessionId, response.usage.inputTokens, response.usage.outputTokens);

        sessionManager.addMessage(sessionId, 'assistant', response.content);

        const toolUseBlocks = response.content.filter(
          (c): c is ToolUseContent => c.type === 'tool_use'
        );

        if (toolUseBlocks.length === 0 || response.stopReason === 'end_turn') {
          finalStopReason = response.stopReason;
          break;
        }

        // Execute tools in parallel batches
        await this.executeToolsParallel(sessionId, toolUseBlocks, config);

        finalStopReason = response.stopReason;
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

  /**
   * Execute tools in parallel batches for better performance
   */
  private async executeToolsParallel(
    sessionId: SessionId,
    toolUseBlocks: ToolUseContent[],
    config: SessionConfig
  ): Promise<void> {
    // Split into batches for parallel execution
    const batches: ToolUseContent[][] = [];
    for (let i = 0; i < toolUseBlocks.length; i += this.maxConcurrentTools) {
      batches.push(toolUseBlocks.slice(i, i + this.maxConcurrentTools));
    }

    for (const batch of batches) {
      if (this.abortController?.signal.aborted) {
        throw new CancelledError('Agent loop cancelled');
      }

      // Execute batch in parallel
      const results = await Promise.all(
        batch.map(toolUse => this.executeTool(sessionId, toolUse, config))
      );

      // Add results to session
      for (let i = 0; i < batch.length; i++) {
        const toolUse = batch[i];
        const result = results[i];
        
        const truncatedContent = truncateToolResult(
          typeof result.content === 'string' ? result.content : JSON.stringify(result.content)
        );
        
        this.sessionManager.addMessage(sessionId, 'tool', [
          {
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: truncatedContent,
            is_error: result.isError,
          } as ToolResultContent,
        ]);
      }
    }
  }

  /** Execute a single tool with timing */
  private async executeTool(
    sessionId: SessionId,
    toolUse: ToolUseContent,
    config: SessionConfig
  ): Promise<ToolHandlerOutput> {
    const start = Date.now();
    
    this.options.onToolStart?.(toolUse.name, toolUse.id, toolUse.input);

    // Check approval
    if (this.toolRegistry.requiresApproval(toolUse.name, toolUse.input, config.approvalMode)) {
      if (this.options.onApprovalRequired) {
        const request: ApprovalRequest = {
          id: toolUse.id,
          sessionId,
          toolName: toolUse.name,
          toolInput: toolUse.input,
          risk: this.toolRegistry.getRiskLevel(toolUse.name),
          description: `Tool "${toolUse.name}" with input: ${JSON.stringify(toolUse.input).slice(0, 200)}`,
          timestamp: Date.now(),
        };

        const response = await this.options.onApprovalRequired(request);
        if (!response.approved) {
          return {
            content: `Tool execution denied by user: ${response.reason || 'No reason provided'}`,
            isError: true,
          };
        }

        if (response.modifiedInput) {
          toolUse = { ...toolUse, input: response.modifiedInput };
        }
      }
    }

    const context: ToolHandlerInput = {
      params: toolUse.input,
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
      const result = await this.toolRegistry.execute(toolUse.name, context);
      const duration = Date.now() - start;
      
      this.toolExecutionTimes.set(toolUse.name, duration);
      this.options.onToolComplete?.(toolUse.name, toolUse.id, result);
      
      return result;
    } catch (err) {
      const duration = Date.now() - start;
      this.toolExecutionTimes.set(toolUse.name, duration);
      
      if (err instanceof ToolError) {
        return { content: `[${err.code}] ${err.message}`, isError: true };
      }
      return { content: `Tool error: ${(err as Error).message}`, isError: true };
    }
  }

  /** Get performance metrics */
  getPerformanceMetrics() {
    return {
      toolExecutionTimes: Object.fromEntries(this.toolExecutionTimes),
      avgCompressionTime: this.compressionTimes.length > 0 
        ? this.compressionTimes.reduce((a, b) => a + b, 0) / this.compressionTimes.length 
        : 0,
      avgModelCallTime: this.modelCallTimes.length > 0
        ? this.modelCallTimes.reduce((a, b) => a + b, 0) / this.modelCallTimes.length
        : 0,
      totalCompressions: this.compressionTimes.length,
      totalModelCalls: this.modelCallTimes.length,
    };
  }

  /** Cancel the running agent loop */
  cancel(): void {
    this.abortController?.abort();
  }

  /** Check if the loop is running */
  isActive(): boolean {
    return this.isRunning;
  }
}