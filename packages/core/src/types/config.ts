// ============================================================================
// Config Types - Application configuration
// ============================================================================

/**
 * Session information for UI display
 */
export interface SessionInfo {
  /** Session ID */
  id: string;
  /** Current model being used */
  model: string;
  /** Provider name */
  provider?: string;
  /** Current approval mode */
  mode?: string;
  /** Number of turns completed */
  turnCount?: number;
  /** Total input tokens used */
  totalInputTokens?: number;
  /** Total output tokens used */
  totalOutputTokens?: number;
  /** Current session state */
  state?: 'idle' | 'running' | 'paused' | 'error';
  /** Working directory */
  workingDirectory?: string;
  /** Session start time */
  startTime?: Date;
  /** Last activity time */
  lastActivity?: Date;
}

export interface NovaConfig {
  /** Core engine settings */
  core: CoreConfig;
  /** Model provider settings */
  models: ModelsConfig;
  /** MCP server configuration */
  mcp?: Record<string, McpServerConfig>;
  /** Hook configuration */
  hooks?: HookConfigEntry[];
  /** File filter rules */
  fileFilter?: FileFilterConfig;
  /** Security settings */
  security?: SecurityConfig;
  /** Telemetry settings */
  telemetry?: TelemetryConfig;
  /** Extension settings */
  extensions?: ExtensionsConfig;
  /** User preferences */
  preferences?: PreferencesConfig;
}

export interface CoreConfig {
  /** Default model to use */
  defaultModel: string;
  /** Default approval mode */
  defaultApprovalMode: 'yolo' | 'default' | 'accepting_edits' | 'plan' | 'smart';
  /** Maximum conversation turns */
  maxTurns: number;
  /** Maximum tokens per response */
  maxTokens: number;
  /** Default temperature */
  temperature: number;
  /** Context window size for compression */
  contextWindowTarget: number;
  /** Whether streaming is enabled by default */
  streaming: boolean;
  /** Session persistence directory */
  sessionsDir?: string;
  /** Log level */
  logLevel: 'debug' | 'info' | 'warn' | 'error' | 'silent';
  /** Global timeout in milliseconds */
  timeout?: number;
  /** Maximum number of checkpoints to keep */
  maxCheckpoints?: number;
  /** Maximum age of checkpoints in days */
  checkpointMaxAgeDays?: number;
}

export interface ModelsConfig {
  /** Available model providers */
  providers: Record<string, ModelProviderConfig>;
  /** Model aliases */
  aliases?: Record<string, string>;
}

export interface ModelProviderConfig {
  /** Provider type */
  type: 'anthropic' | 'openai' | 'azure' | 'ollama' | 'ollama-cloud' | 'coding-plan' | 'custom';
  /** Provider name (optional, for display purposes) */
  name?: string;
  /** API key (reference to env var or direct value) */
  apiKey?: string;
  /** Base URL for API */
  baseUrl?: string;
  /** API version */
  apiVersion?: string;
  /** Organization ID */
  organizationId?: string;
  /** Coding Plan platform (required when type is 'coding-plan') */
  codingPlanPlatform?: 'alibaba' | 'tencent' | 'volcengine' | 'baidu' | 'kimi' | 'zhipu' | 'minimax' | 'custom';
  /** Available models from this provider */
  models: Record<string, ModelConfig>;
  /** Default model for this provider */
  defaultModel?: string;
  /** Rate limits */
  rateLimit?: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
}

export interface ModelConfig {
  /** Display name */
  name?: string;
  /** Maximum context window */
  maxContextTokens: number;
  /** Maximum output tokens */
  maxOutputTokens: number;
  /** Whether the model supports vision */
  supportsVision: boolean;
  /** Whether the model supports tool use */
  supportsTools: boolean;
  /** Whether the model supports streaming */
  supportsStreaming: boolean;
  /** Whether the model supports thinking/reasoning */
  supportsThinking: boolean;
  /** Whether the model has built-in search capability */
  supportsBuiltinSearch?: boolean;
  /** Cost per 1M input tokens (USD) */
  inputCostPerMToken?: number;
  /** Cost per 1M output tokens (USD) */
  outputCostPerMToken?: number;
}

export interface McpServerConfig {
  /** Command to start the MCP server */
  command: string;
  /** Arguments */
  args?: string[];
  /** Environment variables */
  env?: Record<string, string>;
  /** Whether the server is enabled */
  enabled?: boolean;
  /** Connection timeout in ms */
  timeout?: number;
}

export interface HookConfigEntry {
  /** Hook event type */
  event: string;
  /** Command to execute */
  command: string;
  /** Matcher pattern (glob for tool names) */
  matcher?: string;
  /** Timeout in ms */
  timeout?: number;
  /** Description */
  description?: string;
}

export interface FileFilterConfig {
  /** Glob patterns to always ignore */
  ignorePatterns: string[];
  /** Glob patterns to always allow */
  allowPatterns?: string[];
  /** Maximum file size to read (bytes) */
  maxFileSize?: number;
  /** Maximum number of files for batch operations */
  maxBatchSize?: number;
  /** Directories to never access */
  forbiddenPaths?: string[];
  /** Allow access to files outside working directory */
  allowExternalAccess?: boolean;
  /** Additional allowed paths outside working directory */
  additionalAllowedPaths?: string[];
}

export interface SecurityConfig {
  /** Sandbox mode */
  sandbox: 'none' | 'restricted' | 'full';
  /** Whether to enable checkpoint/recovery */
  checkpoints: boolean;
  /** Maximum checkpoint age (ms) */
  checkpointMaxAge?: number;
  /** Commands that are always blocked */
  blockedCommands?: string[];
  /** Commands that are always allowed (even in strict mode) */
  allowedCommands?: string[];
}

export interface TelemetryConfig {
  /** Whether telemetry is enabled */
  enabled: boolean;
  /** Telemetry endpoint */
  endpoint?: string;
  /** Unique anonymous identifier */
  clientId?: string;
  /** What to track */
  track: {
    usage?: boolean;
    errors?: boolean;
    performance?: boolean;
  };
}

export interface ExtensionsConfig {
  /** Path to extensions directory */
  extensionsDir?: string;
  /** List of enabled extensions */
  enabled: string[];
}

export interface PreferencesConfig {
  /** Theme */
  theme?: 'light' | 'dark' | 'auto';
  /** Editor to use for file editing */
  editor?: string;
  /** Shell to use */
  shell?: string;
  /** Language */
  language?: string;
  /** Key bindings */
  keyBindings?: Record<string, string>;
}

// --- Config Resolution ---
export type ConfigSource = 'default' | 'config_file' | 'env' | 'cli_arg';

export interface ResolvedConfig {
  value: unknown;
  source: ConfigSource;
}
