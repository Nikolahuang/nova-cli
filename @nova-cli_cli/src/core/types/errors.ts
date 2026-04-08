// ============================================================================
// Error Types - Custom error classes and error handling
// ============================================================================

/** Base error class for all Nova CLI errors */
export class NovaError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = 'NovaError';
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      retryable: this.retryable,
    };
  }
}

/** Error in configuration loading or validation */
export class ConfigError extends NovaError {
  constructor(message: string, details?: unknown) {
    super(message, 'CONFIG_ERROR', details, false);
    this.name = 'ConfigError';
  }
}

/** Error in model API communication */
export class ModelError extends NovaError {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly provider?: string,
    details?: unknown
  ) {
    super(message, 'MODEL_ERROR', details, statusCode !== 429 && statusCode !== 503);
    this.name = 'ModelError';
  }
}

/** Error from rate limiting */
export class RateLimitError extends ModelError {
  declare readonly code: string;
  declare readonly retryable: boolean;
  constructor(
    message: string,
    public readonly retryAfterMs: number,
    provider?: string
  ) {
    super(message, 429, provider, { retryAfterMs });
    this.name = 'RateLimitError';
    (this as any).code = 'RATE_LIMIT_ERROR';
    (this as any).retryable = true;
  }
}

/** Error in tool execution */
export class ToolError extends NovaError {
  constructor(
    message: string,
    public readonly toolName: string,
    public readonly toolCallId?: string,
    details?: unknown
  ) {
    super(message, 'TOOL_ERROR', details, false);
    this.name = 'ToolError';
  }
}

/** Error from tool input validation */
export class ToolValidationError extends ToolError {
  declare readonly code: string;
  constructor(
    message: string,
    toolName: string,
    public readonly validationErrors: Array<{ field: string; message: string }>
  ) {
    super(message, toolName, undefined, { validationErrors });
    this.name = 'ToolValidationError';
    (this as any).code = 'TOOL_VALIDATION_ERROR';
  }
}

/** Error in session management */
export class SessionError extends NovaError {
  constructor(
    message: string,
    public readonly sessionId?: string,
    details?: unknown
  ) {
    super(message, 'SESSION_ERROR', details, false);
    this.name = 'SessionError';
  }
}

/** Error from approval system */
export class ApprovalError extends NovaError {
  constructor(message: string, details?: unknown) {
    super(message, 'APPROVAL_ERROR', details, false);
    this.name = 'ApprovalError';
  }
}

/** Error from hook execution */
export class HookError extends NovaError {
  constructor(
    message: string,
    public readonly hookEvent: string,
    public readonly exitCode?: number,
    details?: unknown
  ) {
    super(message, 'HOOK_ERROR', details, false);
    this.name = 'HookError';
  }
}

/** Error from MCP server */
export class McpError extends NovaError {
  constructor(
    message: string,
    public readonly serverName?: string,
    details?: unknown
  ) {
    super(message, 'MCP_ERROR', details, false);
    this.name = 'McpError';
  }
}

/** Error from security/sandbox */
export class SecurityError extends NovaError {
  constructor(message: string, details?: unknown) {
    super(message, 'SECURITY_ERROR', details, false);
    this.name = 'SecurityError';
  }
}

/** Error when context window is exceeded */
export class ContextOverflowError extends NovaError {
  constructor(
    message: string,
    public readonly currentTokens: number,
    public readonly maxTokens: number
  ) {
    super(message, 'CONTEXT_OVERFLOW', { currentTokens, maxTokens }, false);
    this.name = 'ContextOverflowError';
  }
}

/** Error when operation is cancelled */
export class CancelledError extends NovaError {
  constructor(message: string = 'Operation cancelled') {
    super(message, 'CANCELLED', undefined, false);
    this.name = 'CancelledError';
  }
}

/** Error from timeout */
export class TimeoutError extends NovaError {
  constructor(
    message: string,
    public readonly timeoutMs: number
  ) {
    super(message, 'TIMEOUT', { timeoutMs }, false);
    this.name = 'TimeoutError';
  }
}

/** Aggregate error for multiple failures */
export class AggregateError extends NovaError {
  constructor(
    message: string,
    public readonly errors: Error[]
  ) {
    super(message, 'AGGREGATE_ERROR', { errorCount: errors.length }, false);
    this.name = 'AggregateError';
  }
}

/** Error type guard */
export function isNovaError(error: unknown): error is NovaError {
  return error instanceof NovaError;
}

/** Get user-friendly error message */
export function getErrorMessage(error: unknown): string {
  if (isNovaError(error)) {
    return `[${error.code}] ${error.message}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unknown error occurred';
}
