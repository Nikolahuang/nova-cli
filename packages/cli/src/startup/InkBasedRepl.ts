// ============================================================================
// InkBasedRepl - Interactive REPL using Ink UI framework
// A modern, component-based terminal UI similar to Claude Code
// ============================================================================

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { spawn, execSync } from 'node:child_process';
import chalk from 'chalk';
import React from 'react';
import { render } from 'ink';
import type { NovaConfig } from '../../../core/src/types/config.ts';
import type { SessionId, ApprovalRequest, ApprovalResponse } from '../../../core/src/types/session.ts';
import type { McpManager, McpServerStatus } from '../../../core/src/mcp/McpManager.ts';
import type { SkillRegistry, SkillDefinition } from '../../../core/src/extensions/SkillRegistry.ts';
import type { ConfigManager } from '../../../core/src/config/ConfigManager.ts';
import type { AuthManager } from '../../../core/src/auth/AuthManager.ts';
import { AgentLoop } from '../../../core/src/session/AgentLoop.ts';
import { ModelClient } from '../../../core/src/model/ModelClient.ts';
import { SessionManager } from '../../../core/src/session/SessionManager.ts';
import { ToolRegistry } from '../../../core/src/tools/ToolRegistry.ts';
import { ApprovalManager } from '../../../core/src/security/ApprovalManager.ts';
import { buildSystemPrompt } from '../../../core/src/context/defaultSystemPrompt.ts';
import { ThinkingBlockRenderer } from '../ui/components/ThinkingBlockRenderer.ts';
import { TodoProgressPanel, type TodoItem } from '../ui/components/TodoProgressPanel.ts';
import { UserMessageHighlight } from '../ui/components/UserMessageHighlight.ts';
import { ThinkingContentDisplay } from '../ui/components/ThinkingContentDisplay.ts';
import { ToolCallStatusDisplay } from '../ui/components/ToolCallStatusDisplay.ts';
import { selectModelInteractive, selectSkillInteractive } from '../ui/SimpleSelector2.ts';

// Import Ink components
import { 
  NovaInkApp, 
  Spinner, 
  StatusBar, 
  InputBox, 
  MessageList, 
  ToolCallPanel, 
  ThinkingBlock,
  ProgressBar,
  ConfirmDialog,
  SelectList,
  Toast,
  Colors,
} from '../ui/components/index.ts';

// ============================================================================
// Types
// ============================================================================

export interface ReplOptions {
  modelClient: ModelClient;
  sessionManager: SessionManager;
  toolRegistry: ToolRegistry;
  approvalManager: ApprovalManager;
  authManager: AuthManager;
  config: NovaConfig;
  configManager: ConfigManager;
  cwd: string;
  contextCompressor?: any;
  mcpManager?: McpManager;
  skillRegistry?: SkillRegistry;
  restoreSessionId?: SessionId;
  /** --json: output in JSON format for machine parsing */
  json?: boolean;
  /** --no-input: non-interactive mode, never prompt for input */
  noInput?: boolean;
  /** --limit: maximum number of items to display */
  limit?: number;
}

type InteractionMode = 'auto' | 'smart' | 'edits' | 'plan' | 'ask';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: Date;
  isThinking?: boolean;
}

interface ToolCall {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'success' | 'error';
  duration?: number;
  input?: string;
}

interface AppState {
  model: string;
  mode: InteractionMode;
  contextUsage: number;
  sessionId: string;
  messages: Message[];
  activeTools: ToolCall[];
  processing: boolean;
  thinkingContent: string;
  showThinking: boolean;
  mcpConnected: number;
  mcpTotal: number;
  activeSkills?: Array<{
    name: string;
    description: string;
    model?: string;
    content: string;
  }>;
  projectAnalysis?: string;
}

// ============================================================================
// Box drawing characters
// ============================================================================

const BOX = {
  tl: '╭', tr: '╮', bl: '╰', br: '╯',
  h: '─', v: '│', ht: '├', htr: '┤',
  hThick: '━', vThick: '┃',
  arrow: '›', bullet: '•', check: '✓', crossX: '✗', dot: '·',
  diamond: '◆', star: '★',
  spinner: ['⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏'],
};

const MODE_LABELS: Record<InteractionMode, { label: string; color: any; description: string; approvalMode: string; icon: string }> = {
  auto:  { label: 'AUTO',  color: chalk.green.bold,  description: 'Full autonomous - no approval needed',       approvalMode: 'yolo',  icon: '●' },
  smart: { label: 'SMART', color: chalk.blue.bold,   description: 'Smart approval - auto low-risk, ask high-risk', approvalMode: 'smart', icon: '◆' },
  edits: { label: 'EDITS', color: chalk.magenta.bold,description: 'Auto-approve file edits, ask for shell/exec', approvalMode: 'accepting_edits', icon: '◇' },
  plan:  { label: 'PLAN',  color: chalk.yellow.bold, description: 'Plan first, then confirm each action',       approvalMode: 'plan',  icon: '◆' },
  ask:   { label: 'ASK',   color: chalk.cyan.bold,   description: 'Answer only, no file changes',              approvalMode: 'default', icon: '◉' },
};

const MODES: InteractionMode[] = ['auto', 'smart', 'edits', 'plan', 'ask'];

// ============================================================================
// InkBasedRepl Class
// ============================================================================

export class InkBasedRepl {
  private modelClient: ModelClient;
  private sessionManager: SessionManager;
  private toolRegistry: ToolRegistry;
  private approvalManager: ApprovalManager;
  private authManager: AuthManager;
  private config: NovaConfig;
  private configManager: ConfigManager;
  private cwd: string;
  private contextCompressor?: any;
  private mcpManager?: McpManager;
  private skillRegistry?: SkillRegistry;
  private _pendingSkillInject: any = null;
  private sessionId: SessionId | null = null;
  private restoreSessionId?: SessionId;

  private currentLoop: AgentLoop | null = null;
  private state: AppState;
  private _pendingSkillInject: SkillDefinition | null = null;
  
  // Thinking renderer for non-Ink fallback
  private thinkingRenderer: ThinkingBlockRenderer;
  
  // New UI components
  private todoProgressPanel: TodoProgressPanel;
  private userMessageHighlight: UserMessageHighlight;
  private thinkingContentDisplay: ThinkingContentDisplay;
  private toolCallStatusDisplay: ToolCallStatusDisplay;
  private activeCursor: any; // ActiveCursor instance

  // Execution tracking for compact display
  private turnCount: number = 0;
  private toolCallCount: number = 0;
  private lastStatusLine: string = '';
  
  // UI state
  private showHelp = false;
  private showModelSelector = false;
  private processing = false;
  private currentText: string = '';
  private pendingToolCalls: Map<string, { name: string; startTime: number }> = new Map();
  
  // Store initial config for recreating ModelClient
  private initialConfig: NovaConfig;
  
  // Agent-first options
  private json: boolean;
  private noInput: boolean;
  private limit: number;

  constructor(options: ReplOptions) {
    this.modelClient = options.modelClient;
    this.sessionManager = options.sessionManager;
    this.toolRegistry = options.toolRegistry;
    this.approvalManager = options.approvalManager;
    this.authManager = options.authManager;
    this.config = options.config;
    this.initialConfig = JSON.parse(JSON.stringify(options.config)); // Deep copy
    this.configManager = options.configManager;
    this.cwd = options.cwd;
    this.contextCompressor = options.contextCompressor;
    this.mcpManager = options.mcpManager;
    this.skillRegistry = options.skillRegistry;
    this.restoreSessionId = options.restoreSessionId;
    
    // Agent-first options
    this.json = options.json ?? false;
    this.noInput = options.noInput ?? false;
    this.limit = options.limit ?? 20; // Default limit for bounded output

    this.thinkingRenderer = new ThinkingBlockRenderer({
      expanded: false,
      maxPreviewLines: 4,
      maxLineLength: 80,
      showStreamingPreview: false,
    });

    // Initialize TODO progress panel for fixed-position task display
    this.todoProgressPanel = new TodoProgressPanel({
      showPriority: true,
      compact: true,
    });

    // Initialize user message highlighter
    this.userMessageHighlight = new UserMessageHighlight({
      highlightColor: 'purple',
      showTimestamp: true,
    });

    // Initialize thinking content display (green dashed box)
    this.thinkingContentDisplay = new ThinkingContentDisplay({
      maxPreviewLines: 6,
      expanded: false,
    });

    // Initialize tool call status display
    this.toolCallStatusDisplay = new ToolCallStatusDisplay({
      showInput: true,
      showResult: false,
    });

    // Initialize active cursor (purple circle animation)
    // Note: ActiveCursor will be initialized when first needed
    this.activeCursor = null;

    // Initialize state
    this.state = {
      model: this.modelClient.getModel(),
      mode: (this.config.core.defaultApprovalMode === 'yolo' ? 'auto' : 
             this.config.core.defaultApprovalMode === 'smart' ? 'smart' :
             this.config.core.defaultApprovalMode === 'accepting_edits' ? 'edits' :
             this.config.core.defaultApprovalMode === 'plan' ? 'plan' : 'ask') as InteractionMode,
      contextUsage: 0,
      sessionId: 'new',
      messages: [],
      activeTools: [],
      processing: false,
      thinkingContent: '',
      showThinking: true,
      mcpConnected: 0,
      mcpTotal: 0,
    };
  }

  // ========================================================================
  // Lifecycle
  // ========================================================================

  async start(): Promise<void> {
    // Restore or create session
    if (this.restoreSessionId) {
      const existing = this.sessionManager.get(this.restoreSessionId);
      this.sessionId = existing ? this.restoreSessionId : this.createInitialSession();
    } else {
      this.sessionId = this.createInitialSession();
    }

    // Set approval handler
    this.approvalManager.setHandler(this.handleApproval.bind(this));

    // Print initial banner (simplified)
    this.printBanner();

    // Start interactive loop
    await this.runInputLoop();
  }

  private createInitialSession(): SessionId {
    const session = this.sessionManager.create({
      workingDirectory: this.cwd,
      model: this.modelClient.getModel(),
      maxTokens: this.config.core.maxTokens,
      temperature: this.config.core.temperature,
      approvalMode: this.getEffectiveApprovalMode() as any,
      streaming: true,
      maxTurns: this.config.core.maxTurns,
    });
    return session.id;
  }

  // ========================================================================
  // Agent-First: JSON Output Helpers
  // ========================================================================

  /**
   * Output structured JSON data when --json flag is set
   * This enables machine-parseable output for Agent consumers
   */
  private outputJSON(data: any): void {
    if (this.json) {
      console.log(JSON.stringify(data, null, 2));
    }
  }

  /**
   * Output structured error in JSON format
   */
  private outputErrorJSON(code: string, message: string, suggestion?: string, example?: string): void {
    if (this.json) {
      console.log(JSON.stringify({
        error: {
          code,
          message,
          suggestion,
          example
        }
      }, null, 2));
    }
  }

  /**
   * Check if we should suppress interactive elements
   */
  private shouldSuppressInteractive(): boolean {
    return this.noInput || this.json;
  }

  /**
   * Apply limit to array results for bounded output
   */
  private applyLimit<T>(items: T[]): { items: T[]; total: number; showing: string; hint?: string } {
    const total = items.length;
    const limited = items.slice(0, this.limit);
    const showing = `Showing ${limited.length} of ${total}`;
    const hint = total > this.limit ? `Use --limit ${total} to see all items` : undefined;
    
    return { items: limited, total, showing, hint };
  }

  // ========================================================================
  // Banner & UI
  // ========================================================================

  private printBanner(): void {
    const w = 70;
    const hr = chalk.hex('#7C3AED').dim(BOX.h.repeat(w));
    const hrThick = chalk.hex('#7C3AED')(BOX.hThick.repeat(w));
    const vl = chalk.hex('#7C3AED').dim(BOX.v);

    const modelShort = this.modelClient.getModel().split('/').pop() || this.modelClient.getModel();
    const modeInfo = MODE_LABELS[this.state.mode];

    console.log('');
    console.log(chalk.hex('#7C3AED')('╭') + hrThick + chalk.hex('#7C3AED')('╮'));
    
    // Logo (exact iFlow CLI style)
    console.log(vl + '  NOVA CLI · AI-powered terminal assistant' + ' '.repeat(29) + vl);
    
    console.log(chalk.hex('#7C3AED')('├') + hr + chalk.hex('#7C3AED')('┤'));

    // Status lines (exact iFlow CLI style)
    console.log(vl + '  Model: ' + modelShort + ' '.repeat(Math.max(0, 62 - modelShort.length)) + vl);
    console.log(vl + '  Mode:  ' + modeInfo.icon + ' ' + modeInfo.label + ' '.repeat(Math.max(0, 61 - modeInfo.label.length)) + vl);
    console.log(vl + '  Dir:   ' + this.cwd.slice(-60) + ' '.repeat(Math.max(0, 62 - Math.min(60, this.cwd.length))) + vl);

    console.log(chalk.hex('#7C3AED')('╰') + hrThick + chalk.hex('#7C3AED')('╯'));
    console.log('');
  }

  private printPrompt(): void {
    const modeInfo = MODE_LABELS[this.state.mode];
    const modelShort = this.modelClient.getModel().split('/').pop() || this.modelClient.getModel();
    
    // Exact iFlow CLI prompt style: [◉ MODE] model ›
    const modeBadge = modeInfo.color(`[${modeInfo.icon} ${modeInfo.label}]`);
    const ctxStr = this.state.contextUsage > 0 ? 
      chalk.dim(` (${this.state.contextUsage}% ctx)`) : '';
    
    process.stdout.write(`\n${modeBadge} ${chalk.gray(modelShort)}${ctxStr} ${chalk.hex('#7C3AED')('›')} `);
  }

  // ========================================================================
  // Input Loop
  // ========================================================================

  private async runInputLoop(): Promise<void> {
    const readline = await import('node:readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      historySize: 200,
      removeHistoryDuplicates: true,
    });

    // Guard flag: when true, rl 'close' is a false alarm from raw-mode pause/resume
    let closeGuard = false;

    // Handle Ctrl+C
    process.on('SIGINT', () => {
      if (this.currentLoop?.isActive()) {
        this.currentLoop.cancel();
        this.processing = false;
        process.stdout.write('\n');
        this.printPrompt();
      } else {
        console.log(chalk.dim('\n  Use /quit or Ctrl+D to exit'));
        this.printPrompt();
      }
    });

    rl.on('close', () => {
      // Ignore close events triggered by raw-mode pause/resume during
      // interactive selectors (SimpleSelector2, etc.)
      if (closeGuard) {
        closeGuard = false;
        process.stdin.resume();
        return;
      }
      if (this.sessionId) this.sessionManager.persist(this.sessionId);
      console.log(chalk.dim('\nGoodbye!'));
      process.exit(0);
    });

    // Main loop
    while (true) {
      this.printPrompt();
      
      const input = await new Promise<string>((resolve) => {
        rl.question('', resolve);
      });

      if (!input.trim()) continue;

      // Set guard before dispatching — commands may enter/leave raw mode
      closeGuard = true;
      this.processing = true;
      await this.dispatchInput(input.trim());
      this.processing = false;
      closeGuard = false;
    }
  }

  private async dispatchInput(input: string): Promise<void> {
    // Handle commands
    if (input.startsWith('/')) {
      await this.handleCommand(input);
      return;
    }

    // Handle shell commands
    if (input.startsWith('!')) {
      await this.handleShellCommand(input.slice(1).trim());
      return;
    }

    // Process normal input
    await this.processInput(input);
  }

  // ========================================================================
  // Command Handlers
  // ========================================================================

  private async handleCommand(cmd: string): Promise<void> {
    const parts = cmd.slice(1).split(/\s+/);
    const command = (parts[0] || '').toLowerCase();
    const arg = parts.slice(1).join(' ');

    switch (command) {
      case 'init':
        await this.handleProjectAnalyze();
        break;

      case 'quit':
      case 'exit':
      case 'q':
        if (this.sessionId) this.sessionManager.persist(this.sessionId);
        if (this.activeCursor) this.activeCursor.stop();
        console.log(chalk.dim('Goodbye!'));
        process.exit(0);

      case 'help':
      case 'h':
      case '?':
        this.printHelp();
        break;

      case 'clear':
        if (this.sessionId) this.sessionManager.persist(this.sessionId);
        this.sessionId = this.createInitialSession();
        this.state.messages = [];
        this.state.contextUsage = 0;
        console.log(chalk.dim('  Conversation cleared.'));
        break;

      case 'mode':
        if (arg && MODES.includes(arg as InteractionMode)) {
          this.state.mode = arg as InteractionMode;
          const info = MODE_LABELS[this.state.mode];
          console.log(chalk.dim('  Mode: ') + info.color(info.label) + chalk.dim(` — ${info.description}`));
          console.log(chalk.dim(`  Approval: `) + chalk.hex('#3B82F6')(info.approvalMode));
        } else {
          // Cycle mode
          const idx = MODES.indexOf(this.state.mode);
          this.state.mode = MODES[(idx + 1) % MODES.length] as InteractionMode;
          const info = MODE_LABELS[this.state.mode];
          console.log(chalk.dim('  Mode: ') + info.color(info.label) + ' ' + chalk.dim('·') + ' ' + chalk.dim(info.description));
        }
        break;

      case 'model':
        await this.handleModelCommand(arg);
        break;

      case 'ollama':
        await this.handleOllamaCommand(arg);
        break;

      case 'status':
        this.printStatus();
        break;

      case 'mcp':
        await this.handleMcpCommand(arg);
        break;

      case 'skills':
        await this.handleSkillsCommand(arg);
        break;

      case 'thinking':
        this.state.showThinking = !this.state.showThinking;
        console.log(chalk.dim(`  Thinking: ${this.state.showThinking ? 'ON' : 'OFF'}`));
        break;

      case 'project':
        await this.handleProjectCommand(arg);
        break;

      default:
        console.log(chalk.yellow(`  Unknown command: /${command}`));
    }
  }

  private printHelp(): void {
    console.log('');
    console.log(chalk.hex('#7C3AED').bold('  Commands:'));
    console.log(chalk.gray('  /help, /h        Show this help'));
    console.log(chalk.gray('  /init            Analyze project and initialize context'));
    console.log(chalk.gray('  /quit, /q        Exit Nova CLI'));
    console.log(chalk.gray('  /clear           Clear conversation'));
    console.log(chalk.gray('  /mode            Cycle mode (AUTO → SMART → EDITS → PLAN → ASK)'));
    console.log(chalk.gray('  /model           Switch model'));
    console.log(chalk.gray('  /ollama          Ollama status'));
    console.log(chalk.gray('  /status          Session status'));
    console.log(chalk.gray('  /mcp             MCP servers'));
    console.log(chalk.gray('  /skills          Available skills (server/author/user)'));
    console.log(chalk.gray('  /thinking        Toggle thinking display'));
    console.log('');
    console.log(chalk.gray('  @file            Inject file content'));
    console.log(chalk.gray('  !command         Run shell command'));
    console.log('');
  }

  private async handleModelCommand(arg: string): Promise<void> {
    if (!arg) {
      // Interactive model selection — only show configured providers
      const config = this.configManager.getConfig();
      const models: Array<{provider: string, model: string, description?: string}> = [];

      // Collect models only from configured/available providers
      for (const [provider, providerConfig] of Object.entries(config.models.providers)) {
        const hasCreds = this.authManager.hasCredentials(provider);
        const isOllama = providerConfig.type === 'ollama';
        const isOllamaCloud = providerConfig.type === 'ollama-cloud';

        // Skip providers that are not configured
        if (!hasCreds && !isOllama && !isOllamaCloud) continue;

        // For Ollama, verify it's actually running
        if (isOllama && !hasCreds) {
          try {
            const baseUrl = process.env.OLLAMA_HOST || 'http://localhost:11434';
            const resp = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(2000) });
            if (!resp.ok) continue; // Ollama not running
          } catch {
            continue; // Ollama not running
          }
        }

        for (const [modelId, modelConfig] of Object.entries(providerConfig.models)) {
          const features: string[] = [];
          if (modelConfig.supportsVision) features.push('vision');
          if (modelConfig.supportsTools) features.push('tools');
          if (modelConfig.supportsThinking) features.push('thinking');

          const description = features.length > 0 ? `[${features.join(', ')}]` : '';
          models.push({
            provider,
            model: modelId,
            description,
          });
        }
      }

      if (models.length === 0) {
        console.log(chalk.yellow('  No models available. Configure a provider first.'));
        console.log(chalk.gray('  Use: nova auth set <provider>'));
        return;
      }

      // Show interactive selector (returns "provider/model" format)
      const selectedModel = await selectModelInteractive(models);

      if (selectedModel && selectedModel !== 'separator' && !selectedModel.startsWith('provider:')) {
        const success = await this.switchModel(selectedModel);
        if (success) {
          console.log(chalk.green(`  ✓ Switched to: ${selectedModel}`));
        }
        // If failed, switchModel already printed an error message
      } else if (selectedModel && selectedModel.startsWith('provider:')) {
        console.log(chalk.dim('  Please select a specific model, not a provider header'));
      } else {
        console.log(chalk.dim('  Model selection cancelled'));
      }
    } else {
      // Direct model switch
      const success = await this.switchModel(arg);
      if (success) {
        console.log(chalk.green(`  ✓ Switched to: ${arg}`));
      }
    }
  }

  private async handleOllamaCommand(arg: string): Promise<void> {
    const creds = this.authManager.getCredentials('ollama');
    const baseUrl = creds?.baseUrl || process.env.OLLAMA_HOST || 'http://localhost:11434';
    
    console.log(chalk.hex('#7C3AED')('\n  Ollama Status:'));
    console.log(chalk.gray(`  Host: ${baseUrl}`));
    
    try {
      const response = await fetch(`${baseUrl}/api/tags`);
      if (response.ok) {
        const data = await response.json() as { models: Array<{ name: string; size: number }> };
        console.log(chalk.green('  Status: Running'));
        console.log(chalk.gray(`  Models: ${data.models?.length || 0} installed`));
        if (data.models?.length > 0) {
          data.models.slice(0, 5).forEach((m: any) => {
            console.log(chalk.gray(`    - ${m.name}`));
          });
        }
      } else {
        console.log(chalk.yellow('  Status: Not responding'));
      }
    } catch {
      console.log(chalk.red('  Status: Not running'));
      console.log(chalk.gray('  Start with: ollama serve'));
    }
    console.log('');
  }

  /**
   * Switch to a different model, potentially across providers.
   * Accepts "provider/model" or bare "model" format.
   * Persists selection to global config.
   */
  private async switchModel(modelId: string): Promise<boolean> {
    try {
      // Parse provider/model format (e.g., "ollama/gemma3:4b")
      let providerName: string;
      let actualModelId: string;

      if (modelId.includes('/')) {
        const idx = modelId.indexOf('/');
        providerName = modelId.substring(0, idx);
        actualModelId = modelId.substring(idx + 1);
      } else {
        // Bare model name — look up in config to find provider
        const modelConfig = this.configManager.getModelConfig(modelId);
        if (!modelConfig) {
          // Might be an Ollama model
          if (this.authManager.hasCredentials('ollama') || process.env.OLLAMA_HOST) {
            providerName = 'ollama';
            actualModelId = modelId;
          } else {
            console.log(chalk.red(`  ✗ Model "${modelId}" not found in config`));
            return false;
          }
        } else {
          const config = this.configManager.getConfig();
          for (const [name, p] of Object.entries(config.models.providers)) {
            if (p === modelConfig.provider || p.models === modelConfig.provider.models) {
              providerName = name;
              break;
            }
          }
          actualModelId = modelId;
          if (!providerName) {
            console.log(chalk.red(`  ✗ Cannot determine provider for "${modelId}"`));
            return false;
          }
        }
      }

      // Get provider config
      const config = this.configManager.getConfig();
      const providerConfig = config.models.providers[providerName];
      if (!providerConfig) {
        console.log(chalk.red(`  ✗ Unknown provider: "${providerName}"`));
        return false;
      }

      const providerType = providerConfig.type;
      const creds = this.authManager.getCredentials(providerName);

      // For non-Ollama providers, require API key
      const isOllamaType = providerType === 'ollama' || providerName === 'ollama' || providerName === 'ollama-cloud';
      if (!isOllamaType && !creds?.apiKey) {
        console.log(chalk.yellow(`  ⚠ No API key found for "${providerName}"`));
        console.log(chalk.gray(`  Set it with: nova auth set ${providerName}`));
        return false;
      }

      // Create new ModelClient with correct provider
      this.modelClient = new ModelClient({
        provider: providerType as any,
        apiKey: creds?.apiKey,
        baseUrl: creds?.baseUrl || providerConfig.baseUrl,
        model: actualModelId,
        maxTokens: this.config.core.maxTokens,
        temperature: this.config.core.temperature,
        organizationId: creds?.organizationId,
        codingPlanPlatform: providerConfig.codingPlanPlatform as any,
      });

      // Update state
      this.state.model = `${providerName}/${actualModelId}`;

      // Persist to global config
      config.core.defaultModel = `${providerName}/${actualModelId}`;
      await this.configManager.save(config);

      return true;
    } catch (err) {
      console.log(chalk.red(`  ✗ Error switching model: ${(err as Error).message}`));
      return false;
    }
  }

  private printStatus(): void {
    console.log(chalk.hex('#7C3AED')('\n  Session Status:'));
    console.log(chalk.gray(`  Session: ${this.sessionId?.slice(0, 8) || 'none'}`));
    console.log(chalk.gray(`  Model:   ${this.state.model}`));
    console.log(chalk.gray(`  Mode:    ${this.state.mode}`));
    console.log(chalk.gray(`  Context: ${this.state.contextUsage}%`));
    console.log(chalk.gray(`  Messages: ${this.state.messages.length}`));
    console.log('');
  }

  private printMcpStatus(): void {
    if (!this.mcpManager) {
      console.log(chalk.gray('  MCP not initialized'));
      return;
    }
    
    const statuses = this.mcpManager.listServers();
    if (statuses.length === 0) {
      console.log(chalk.gray('  No MCP servers configured'));
      return;
    }

    console.log(chalk.hex('#7C3AED')('\n  MCP Servers:'));
    for (const s of statuses) {
      const icon = s.connected ? chalk.green('✓') : chalk.red('✗');
      console.log(chalk.gray(`  ${icon} ${s.name}: ${s.connected ? 'connected' : 'disconnected'}`));
    }
    console.log('');
  }

  private async handleMcpCommand(arg: string): Promise<void> {
    if (!this.mcpManager) {
      console.log(chalk.gray('  MCP not initialized'));
      return;
    }
    
    const statuses = this.mcpManager.listServers();
    
    if (statuses.length === 0) {
      console.log(chalk.gray('  No MCP servers configured'));
      console.log(chalk.dim('  Add servers to ~/.nova/config.yaml under "mcp:"'));
      return;
    }

    if (!arg) {
      // Show status (non-interactive for now)
      this.printMcpStatus();
    } else {
      // Specific server action requested
      console.log(chalk.green(`  MCP server: ${arg}`));
      console.log(chalk.dim('  Note: MCP server management not yet implemented in interactive mode'));
    }
  }

  private printSkillsStatus(): void {
    if (!this.skillRegistry) {
      console.log(chalk.gray('  Skills not initialized'));
      return;
    }

    // We'd need async for this, but for now just show a message
    console.log(chalk.hex('#7C3AED')('\n  Skills:'));
    console.log(chalk.gray('  Use /skills <name> to inject a skill'));
    console.log('');
  }

  private async handleSkillsCommand(arg: string): Promise<void> {
    if (!this.skillRegistry) {
      console.log(chalk.gray('  Skills not initialized'));
      return;
    }

    // Parse command arguments
    const parts = arg.trim().split(/\s+/);
    const mode = parts[0]?.toLowerCase();
    const rest = parts.slice(1).join(' ');

    // Mode 1: /skills server — Browse and install skills from GitHub repo
    if (mode === 'server') {
      await this.handleSkillsServerCommand();
      return;
    }

    // Mode 2: /skills author select — Browse pre-downloaded skills from SkillsHub
    if (mode === 'author' || mode === 'authorSkills') {
      await this.handleSkillsAuthorCommand();
      return;
    }

    // Mode 3: /skills user — Install skill from custom file/zip path
    if (mode === 'user') {
      await this.handleSkillsUserCommand(rest);
      return;
    }

    if (mode === 'add') {
      // Handle /skills add <global|local> [file-path]
      const scope = parts[1]?.toLowerCase();
      const filePath = parts.slice(2).join(' ').trim();

      if (!scope || (scope !== 'global' && scope !== 'local')) {
        await this.handleAddSkillCommand('local');
        return;
      }

      if (!filePath) {
        await this.handleAddSkillCommand(scope);
        return;
      }

      await this.handleAddSkillFromFile(scope, filePath);
      return;
    }

    if (mode === 'list' || !mode) {
      // Handle /skills list (or bare /skills)
      try {
        const skills = await this.skillRegistry.list();
        const localSkills = this.state.activeSkills || [];

        if (skills.length === 0 && localSkills.length === 0) {
          console.log(chalk.dim('  No skills found.'));
          console.log(chalk.dim('  Add SKILL.md files to ~/.nova/skills/ to create skills.'));
          console.log('');
          console.log(chalk.dim('  /skills server           — browse & install from GitHub'));
          console.log(chalk.dim('  /skills author select    — browse local SkillsHub'));
          console.log(chalk.dim('  /skills user             — install from file/zip path'));
          return;
        }

        console.log('');
        console.log(chalk.hex('#7C3AED').bold('  Available Skills:'));
        console.log('');

        // Show global skills
        if (skills.length > 0) {
          skills.forEach(skill => {
            const m = skill.metadata;
            const autoTag = m.autoGenerated ? chalk.dim(' [auto]') : '';
            const tags = m.tags.length > 0 ? chalk.dim(` (${m.tags.slice(0, 3).join(', ')})`) : '';
            console.log(chalk.white(`  • ${m.name}${autoTag}${tags}`));
            console.log(chalk.dim(`    ${m.description}`));
          });
        }

        // Show local skills (current session)
        if (localSkills.length > 0) {
          console.log('');
          console.log(chalk.hex('#7C3AED').bold('  Session Skills:'));
          console.log('');
          localSkills.forEach(skill => {
            console.log(chalk.white(`  • ${skill.name}`));
            console.log(chalk.dim(`    ${skill.description}`));
          });
        }

        console.log('');
        console.log(chalk.dim(`  ${skills.length + localSkills.length} skill${(skills.length + localSkills.length) !== 1 ? 's' : ''} available`));
        console.log(chalk.dim('  /skills use <name>       — inject skill into next message'));
        console.log(chalk.dim('  /skills server           — browse & install from GitHub'));
        console.log(chalk.dim('  /skills author select    — browse local SkillsHub'));
        console.log(chalk.dim('  /skills user             — install from file/zip path'));
      } catch (error) {
        console.log(chalk.red(`  Error loading skills: ${(error as Error).message}`));
      }
      return;
    }

    if (mode === 'info' && rest) {
      const skill = await this.skillRegistry.get(rest);
      if (!skill) { console.log(chalk.red(`  Skill "${rest}" not found.`)); return; }
      const m = skill.metadata;
      console.log('');
      console.log(chalk.hex('#7C3AED').bold(`  ${m.name}`));
      console.log(chalk.dim(`  Description: ${m.description}`));
      console.log(chalk.dim(`  Version: ${m.version}`));
      if (m.author) console.log(chalk.dim(`  Author: ${m.author}`));
      if (m.tags.length > 0) console.log(chalk.dim(`  Tags: ${m.tags.join(', ')}`));
      console.log('');
      const preview = skill.content.split('\n').slice(0, 10).join('\n');
      console.log(chalk.dim(preview));
      if (skill.content.split('\n').length > 10) console.log(chalk.dim('  ...'));
      return;
    }

    if (mode === 'use' && rest) {
      const skill = await this.skillRegistry.get(rest);
      if (!skill) { console.log(chalk.red(`  Skill "${rest}" not found.`)); return; }
      this._pendingSkillInject = skill;
      console.log(chalk.green(`  ✓ Skill "${rest}" will be injected into your next message.`));
      return;
    }

    if (mode === 'rm') {
      const skillName = rest;
      if (!skillName) {
        console.log(chalk.yellow('  Usage: /skills rm <skill-name>'));
        console.log(chalk.dim('  Example: /skills rm code-simplifier'));
        return;
      }
      await this.handleRemoveSkillCommand(skillName);
      return;
    }

    if (mode === 'install') {
      await this.handleSkillsInstall(rest);
      return;
    }

    // Default: unknown subcommand
    console.log(chalk.yellow(`  Unknown skills command.`));
    console.log(chalk.dim('  Usage: /skills [list|use|info|server|author|user|install|add|rm]'));
  }

  // ========================================================================
  // /skills server — Browse & install skills from GitHub
  // ========================================================================

  private async handleSkillsServerCommand(): Promise<void> {
    const SKILLS_REPO = 'daymade/claude-code-skills';
    
    // Helper function to fetch skills with optional auth
    const fetchSkills = async (token?: string): Promise<any> => {
      const API_URL = `https://api.github.com/repos/${SKILLS_REPO}/contents`;
      const headers: { [key: string]: string } = {
        'Accept': 'application/vnd.github.v3+json'
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(API_URL, {
        headers,
        timeout: 15000,
      } as any);

      if (!response.ok) {
        throw new Error(`GitHub API returned ${response.status}`);
      }

      const contents = await response.json() as Array<{ name: string; type: string; path: string; download_url: string }>;
      const folders = contents.filter(c => c.type === 'dir' && !c.name.startsWith('.'));

      if (folders.length === 0) {
        throw new Error('No skill folders found in repository.');
      }

      // Fetch each folder's SKILL.md to get description
      const skillsInfo: Array<{ name: string; description: string }> = [];

      const batchSize = 5;
      for (let i = 0; i < folders.length; i += batchSize) {
        const batch = folders.slice(i, i + batchSize);
        const results = await Promise.allSettled(
          batch.map(async (folder) => {
            const skillUrl = `https://api.github.com/repos/${SKILLS_REPO}/contents/${folder.name}/SKILL.md`;
            const skillHeaders: { [key: string]: string } = {
              'Accept': 'application/vnd.github.v3+json'
            };
            if (token) {
              skillHeaders['Authorization'] = `Bearer ${token}`;
            }
            const resp = await fetch(skillUrl, {
              headers: skillHeaders,
              timeout: 10000,
            } as any);
            if (!resp.ok) return { name: folder.name, description: '' };
            const data = await resp.json() as { content: string; encoding: string };
            if (data.encoding === 'base64') {
              const content = Buffer.from(data.content, 'base64').toString('utf-8');
              const descMatch = content.match(/description:\s*(.+)/);
              return { name: folder.name, description: descMatch ? descMatch[1].trim() : '' };
            }
            return { name: folder.name, description: '' };
          })
        );
        for (const r of results) {
          if (r.status === 'fulfilled') skillsInfo.push(r.value);
        }
      }

      return skillsInfo;
    };

    console.log('');
    console.log(chalk.hex('#7C3AED').bold('  Skills Marketplace — GitHub'));
    console.log(chalk.dim(`  Fetching skills from: github.com/${SKILLS_REPO}`));
    console.log(chalk.dim('  Connecting...'));

    try {
      let skillsInfo = await fetchSkills();
      
      // Display interactive selection
      console.log('');
      console.log(chalk.hex('#7C3AED').bold(`  ${skillsInfo.length} skills available:`));
      console.log(chalk.dim('  Use arrow keys to navigate, Enter to install, Esc to cancel'));
      console.log('');

      const selected = await selectSkillInteractive(
        skillsInfo.map((s: any) => ({ name: s.name, description: s.description }))
      );

      if (!selected) {
        console.log(chalk.dim('  Cancelled.'));
        return;
      }

      // Install the selected skill
      console.log('');
      console.log(chalk.dim(`  Installing "${selected}" from GitHub...`));
      const { SkillInstaller } = await import('../../../core/src/extensions/SkillInstaller.js');
      const installer = new SkillInstaller();
      const installed = await installer.install({
        source: `https://github.com/${SKILLS_REPO}`,
        skills: [selected],
        force: true,
      });

      if (installed.length > 0) {
        console.log(chalk.green(`  ✓ Installed "${selected}" successfully.`));
        await this.skillRegistry!.initialize();
        const skill = await this.skillRegistry!.get(selected);
        if (skill) {
          this._pendingSkillInject = skill;
          console.log(chalk.hex('#3B82F6')(`  Skill "${selected}" will be injected into your next message.`));
        }
      } else {
        console.log(chalk.yellow('  Installation completed but no skills were installed.'));
      }
    } catch (err) {
      const error = err as Error;
      if (error.message.includes('403')) {
        console.log('');
        console.log(chalk.red('  GitHub API rate limit exceeded or access denied.'));
        console.log(chalk.yellow('  To continue, you need to provide a GitHub Personal Access Token.'));
        console.log(chalk.dim('  Get your token at: https://github.com/settings/tokens'));
        console.log(chalk.dim('  Required scopes: repo (public_repo is sufficient)'));
        console.log('');
        
        const readline = await import('readline');
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });
        
        const token = await new Promise<string>((resolve) => {
          rl.question(chalk.cyan('  Enter your GitHub token (leave empty to skip): '), (answer) => {
            rl.close();
            resolve(answer.trim());
          });
        });
        
        if (token) {
          console.log('');
          console.log(chalk.dim('  Retrying with token...'));
          try {
            let skillsInfo = await fetchSkills(token);
            
            console.log('');
            console.log(chalk.hex('#7C3AED').bold(`  ${skillsInfo.length} skills available:`));
            console.log(chalk.dim('  Use arrow keys to navigate, Enter to install, Esc to cancel'));
            console.log('');

            const selected = await selectSkillInteractive(
              skillsInfo.map((s: any) => ({ name: s.name, description: s.description }))
            );

            if (!selected) {
              console.log(chalk.dim('  Cancelled.'));
              return;
            }

            // Install the selected skill
            console.log('');
            console.log(chalk.dim(`  Installing "${selected}" from GitHub...`));
            const { SkillInstaller } = await import('../../../core/src/extensions/SkillInstaller.js');
            const installer = new SkillInstaller();
            const installed = await installer.install({
              source: `https://github.com/${SKILLS_REPO}`,
              skills: [selected],
              force: true,
            });

            if (installed.length > 0) {
              console.log(chalk.green(`  ✓ Installed "${selected}" successfully.`));
              await this.skillRegistry!.initialize();
              const skill = await this.skillRegistry!.get(selected);
              if (skill) {
                this._pendingSkillInject = skill;
                console.log(chalk.hex('#3B82F6')(`  Skill "${selected}" will be injected into your next message.`));
              }
            } else {
              console.log(chalk.yellow('  Installation completed but no skills were installed.'));
            }
          } catch (retryErr) {
            console.log(chalk.red(`  Failed to fetch skills with token: ${(retryErr as Error).message}`));
            console.log(chalk.dim('  Please check your token and try again.'));
          }
        } else {
          console.log(chalk.dim('  Skipped. You can use /skills author to install local skills.'));
        }
      } else {
        console.log(chalk.red(`  Failed to fetch skills: ${error.message}`));
        console.log(chalk.dim('  Check your internet connection and try again.'));
      }
    }
  }

  // ========================================================================
  // /skills author select — Browse pre-downloaded skills from SkillsHub
  // ========================================================================

  private async handleSkillsAuthorCommand(): Promise<void> {
    const fs = await import('fs');
    const path = await import('path');
    const os = await import('os');

    // Look for SkillsHub in several common locations
    const searchPaths = [
      path.join(process.cwd(), 'SkillsHub'),
      path.join(process.cwd(), 'skillshub'),
      path.join(process.cwd(), '.skillshub'),
    ];

    let skillsHubDir = searchPaths.find((p: string) => fs.existsSync(p));
    if (!skillsHubDir) {
      console.log(chalk.yellow('  SkillsHub folder not found in current directory.'));
      console.log(chalk.dim('  Create a "SkillsHub" folder with skill zip files and try again.'));
      console.log(chalk.dim('  Example: /skills author select'));
      return;
    }

    // Find all zip files
    const entries = fs.readdirSync(skillsHubDir).filter((f: string) => f.endsWith('.zip'));
    if (entries.length === 0) {
      console.log(chalk.yellow('  No zip files found in SkillsHub/'));
      console.log(chalk.dim('  Add skill zip files to the SkillsHub folder.'));
      return;
    }

    console.log('');
    console.log(chalk.hex('#7C3AED').bold('  SkillsHub — Local Skill Library'));
    console.log(chalk.dim(`  Found ${entries.length} skill packages in ${path.basename(skillsHubDir)}/`));
    console.log('');

    // Parse each zip to get skill info
    const skillEntries: Array<{ name: string; description: string; zipPath: string }> = [];
    const { execSync } = await import('child_process');

    for (const entry of entries) {
      const zipPath = path.join(skillsHubDir, entry);
      const nameFromZip = entry.replace(/-\d+\.zip$/, '').replace(/\.zip$/, '').replace(/-/g, ' ');
      let description = '';
      try {
        const tmpDir = path.join(os.tmpdir(), `nova-skill-${Date.now()}`);
        execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${tmpDir}' -Force"`, { stdio: 'pipe' });
        const findSkillMd = (dir: string, depth = 0): string | null => {
          if (depth > 3) return null;
          const items = fs.readdirSync(dir, { withFileTypes: true });
          for (const item of items) {
            if (item.name === 'SKILL.md' && item.isFile()) return path.join(dir, item.name);
            if (item.isDirectory() && !item.name.startsWith('.') && item.name !== 'node_modules') {
              const found = findSkillMd(path.join(dir, item.name), depth + 1);
              if (found) return found;
            }
          }
          return null;
        };
        const skillMdPath = findSkillMd(tmpDir);
        if (skillMdPath) {
          const content = fs.readFileSync(skillMdPath, 'utf-8');
          const descMatch = content.match(/description:\s*(.+)/);
          if (descMatch) description = descMatch[1].trim();
        }
        try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
      } catch {
        // If parsing fails, just use filename
      }
      skillEntries.push({ name: nameFromZip, description: description || 'No description available', zipPath });
    }

    // Display interactive selection
    const selected = await selectSkillInteractive(
      skillEntries.map(s => ({ name: s.name, description: s.description }))
    );

    if (!selected) {
      console.log(chalk.dim('  Cancelled.'));
      return;
    }

    const entry = skillEntries.find(s => s.name === selected);
    if (!entry) return;

    console.log('');
    console.log(chalk.dim(`  Installing "${selected}"...`));

    try {
      const { SkillInstaller } = await import('../../../core/src/extensions/SkillInstaller.js');
      const installer = new SkillInstaller();
      const installed = await installer.installFromZip(entry.zipPath);

      if (installed.length > 0) {
        console.log(chalk.green(`  ✓ Installed "${installed[0].name}" successfully.`));
        await this.skillRegistry!.initialize();
        const skill = await this.skillRegistry!.get(installed[0].name);
        if (skill) {
          this._pendingSkillInject = skill;
          console.log(chalk.hex('#3B82F6')(`  Skill "${installed[0].name}" will be injected into your next message.`));
        }
      } else {
        console.log(chalk.yellow('  No valid skill found in the zip file.'));
      }
    } catch (err) {
      console.log(chalk.red(`  Installation failed: ${(err as Error).message}`));
    }
  }

  // ========================================================================
  // /skills user — Install skill from custom file/zip path
  // ========================================================================

  private async handleSkillsUserCommand(pathArg?: string): Promise<void> {
    const fs = await import('fs');
    const path = await import('path');

    console.log('');
    console.log(chalk.hex('#7C3AED').bold('  Install Skill from File'));
    console.log(chalk.dim('  Enter the path to your skill file or zip package.'));
    console.log(chalk.dim('  Supported: SKILL.md file, .zip archive containing SKILL.md'));
    console.log('');

    let skillPath: string | undefined;
    
    // Use provided path argument if available, otherwise prompt for input
    if (pathArg && pathArg.trim()) {
      skillPath = pathArg.trim();
      console.log(chalk.dim(`  Using path: ${skillPath}`));
    } else {
      skillPath = await this.promptInput('  Path: ');
    }
    
    if (!skillPath || !skillPath.trim()) {
      console.log(chalk.dim('  Cancelled.'));
      return;
    }

    const resolvedPath = path.resolve(skillPath.trim());
    if (!fs.existsSync(resolvedPath)) {
      console.log(chalk.red(`  File not found: ${resolvedPath}`));
      return;
    }

    // Ask scope: Global (G) or Local session (L)
    console.log('');
    console.log(chalk.dim('  Install scope:'));
    console.log(chalk.hex('#3B82F6')('    G') + chalk.dim(' — Global (available in all sessions)'));
    console.log(chalk.hex('#3B82F6')('    L') + chalk.dim(' — Current session only'));
    console.log('');

    const scope = await this.promptInput('  Scope (G/L): ');
    const isGlobal = scope?.trim().toLowerCase() === 'g';

    console.log('');
    console.log(chalk.dim(`  Installing skill from: ${resolvedPath}`));
    console.log(chalk.dim(`  Scope: ${isGlobal ? 'Global (~/.nova/skills/)' : 'Session (memory only)'}`));

    try {
      const { SkillInstaller } = await import('../../../core/src/extensions/SkillInstaller.js');
      const { SkillValidator } = await import('../../../core/src/extensions/SkillValidator.js');
      const installer = new SkillInstaller();

      let installed;
      if (resolvedPath.endsWith('.zip')) {
        installed = await installer.installFromZip(resolvedPath);
      } else {
        installed = await installer.installFromFile(resolvedPath);
      }

      if (installed.length > 0) {
        console.log(chalk.green(`  ✓ Installed "${installed[0].name}" successfully.`));
        if (!isGlobal) {
          const content = fs.readFileSync(path.join(installed[0].path, 'SKILL.md'), 'utf-8');
          const validator = new SkillValidator();
          const parsed = validator.parse(content);
          this._pendingSkillInject = { metadata: parsed, content };
          console.log(chalk.hex('#3B82F6')(`  Skill "${installed[0].name}" will be injected into your next message.`));
        } else {
          await this.skillRegistry!.initialize();
          const skill = await this.skillRegistry!.get(installed[0].name);
          if (skill) {
            this._pendingSkillInject = skill;
            console.log(chalk.hex('#3B82F6')(`  Skill "${installed[0].name}" will be injected into your next message.`));
          }
        }
      } else {
        console.log(chalk.yellow('  No valid skill found. Make sure the file contains a SKILL.md.'));
      }
    } catch (err) {
      console.log(chalk.red(`  Installation failed: ${(err as Error).message}`));
    }
  }

  // ========================================================================
  // /skills install — Install skills from GitHub
  // ========================================================================

  private async handleSkillsInstall(repoArg?: string): Promise<void> {
    if (!repoArg) {
      console.log('');
      console.log(chalk.hex('#7C3AED').bold('  Install Skills from GitHub'));
      console.log(chalk.dim('  Install skills from GitHub repositories.'));
      console.log('');
      console.log(chalk.hex('#3B82F6')('  Popular repositories:'));
      console.log(chalk.dim('  • superpowers  — Agentic skills (TDD, debugging, review)'));
      console.log(chalk.dim('  • owner/repo   — Any GitHub repository'));
      console.log('');
      console.log(chalk.dim('  Usage:'));
      console.log(chalk.hex('#7C3AED')('  /skills install superpowers'));
      console.log(chalk.hex('#7C3AED')('  /skills install obra/superpowers'));
      return;
    }

    const { SkillInstaller, POPULAR_SKILL_REPOS } = await import('../../../core/src/extensions/SkillInstaller.js');
    const installer = new SkillInstaller();
    const source = (POPULAR_SKILL_REPOS as any)[repoArg]?.url || repoArg;

    console.log(chalk.dim(`  Installing from: ${source}`));
    console.log('');

    try {
      const installed = await installer.install({ source, force: false });
      if (installed.length === 0) {
        console.log(chalk.yellow('  No new skills installed.'));
        console.log(chalk.dim('  Use --force to overwrite existing skills.'));
        return;
      }
      console.log('');
      console.log(chalk.green(`  ✓ Installed ${installed.length} skill${installed.length !== 1 ? 's' : ''}:`));
      for (const skill of installed) {
        console.log(chalk.white(`    • ${skill.name}`));
      }
      console.log('');
      console.log(chalk.dim('  Reload skills with: /skills list'));
      console.log(chalk.dim('  Use a skill with: /skills use <name>'));
      if (this.skillRegistry) await this.skillRegistry.initialize();
    } catch (err) {
      console.log(chalk.red(`  Failed to install: ${(err as Error).message}`));
      console.log(chalk.dim('  Make sure git is installed and you have internet access.'));
    }
  }

  private promptInput(prompt: string): Promise<string> {
    return new Promise((resolve) => {
      if (this.rl) {
        this.rl.question(prompt, (answer) => {
          resolve(answer.trim());
        });
      } else {
        resolve('');
      }
    });
  }

  // ========================================================================
  // Add Skill Handler
  // ========================================================================

  private async handleAddSkillCommand(scope: 'global' | 'local'): Promise<void> {
    const { resolve } = await import('path');
    const { readFile } = await import('fs/promises');

    console.log('');
    console.log(chalk.hex('#7C3AED').bold(`  ${scope === 'global' ? 'Add Skill (Global)' : 'Add Skill (Local)'}`));
    console.log(chalk.dim(`  Scope: ${scope === 'global' ? 'All sessions' : 'Current session only'}`));
    console.log('');
    console.log(chalk.yellow('  Usage: /skills add <global|local> <file-path>'));
    console.log(chalk.dim('  Example: /skills add local code-simplifier.md'));
    console.log('');
  }

  /**
   * Add skill from file path (called with file path argument)
   */
  private async handleAddSkillFromFile(scope: 'global' | 'local', filePath: string): Promise<void> {
    const { resolve } = await import('path');
    const { readFile } = await import('fs/promises');

    console.log('');
    console.log(chalk.hex('#7C3AED').bold(`  ${scope === 'global' ? 'Add Skill (Global)' : 'Add Skill (Local)'}`));
    console.log(chalk.dim(`  Scope: ${scope === 'global' ? 'All sessions' : 'Current session only'}`));
    console.log('');

    if (!filePath) {
      console.log(chalk.yellow('  No file path provided.'));
      console.log(chalk.dim('  Usage: /skills add <global|local> <file-path>'));
      return;
    }

    // Resolve absolute path
    const absolutePath = resolve(filePath);

    // Read file
    let fileContent: string;
    try {
      fileContent = await readFile(absolutePath, 'utf-8');
    } catch (error) {
      console.log(chalk.red(`  Error reading file: ${(error as Error).message}`));
      return;
    }

    // Parse skill file
    const skill = this.parseSkillFile(absolutePath, fileContent);

    if (!skill) {
      console.log(chalk.red('  Invalid skill file format.'));
      console.log(chalk.dim('  Expected format: YAML frontmatter with name, description, and content'));
      return;
    }

    console.log('');
    console.log(chalk.hex('#7C3AED').bold('  Skill Information:'));
    console.log(chalk.white(`  Name: ${skill.name}`));
    console.log(chalk.white(`  Description: ${skill.description}`));
    console.log(chalk.dim(`  Model: ${skill.model || 'default'}`));
    console.log('');

    // Store skill based on scope
    if (scope === 'global') {
      // Register to SkillRegistry
      try {
        await this.skillRegistry!.register({
          metadata: {
            name: skill.name,
            description: skill.description,
            version: '1.0.0',
            tags: ['user-added'],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          content: skill.content,
        });
        console.log(chalk.green(`  ✓ Skill "${skill.name}" added to global configuration`));
      } catch (error) {
        console.log(chalk.red(`  Error registering skill: ${(error as Error).message}`));
        return;
      }
    } else {
      // Add to current session
      if (!this.state.activeSkills) {
        this.state.activeSkills = [];
      }
      this.state.activeSkills.push(skill);
      console.log(chalk.green(`  ✓ Skill "${skill.name}" added to current session`));
    }

    console.log('');
    console.log(chalk.dim('  The skill will be applied to all subsequent conversations.'));
  }

  /**
   * Remove skill from current session or global configuration
   */
  private async handleRemoveSkillCommand(skillName: string): Promise<void> {
    console.log('');

    // First, try to remove from current session (local skills)
    if (this.state.activeSkills) {
      const localIndex = this.state.activeSkills.findIndex(s => s.name.toLowerCase() === skillName);

      if (localIndex !== -1) {
        const removed = this.state.activeSkills.splice(localIndex, 1)[0];
        console.log(chalk.hex('#7C3AED').bold('  Remove Skill (Local)'));
        console.log('');
        console.log(chalk.white(`  Name: ${removed.name}`));
        console.log(chalk.white(`  Description: ${removed.description}`));
        console.log('');
        console.log(chalk.green(`  ✓ Skill "${removed.name}" removed from current session`));
        console.log('');
        return;
      }
    }

    // If not found in local skills, try global skills
    try {
      const globalSkills = await this.skillRegistry!.list();
      const globalSkill = globalSkills.find(s => s.metadata.name.toLowerCase() === skillName);

      if (globalSkill) {
        console.log(chalk.hex('#7C3AED').bold('  Remove Skill (Global)'));
        console.log('');
        console.log(chalk.white(`  Name: ${globalSkill.metadata.name}`));
        console.log(chalk.white(`  Description: ${globalSkill.metadata.description}`));
        console.log('');

        const success = await this.skillRegistry!.remove(globalSkill.metadata.name);

        if (success) {
          console.log(chalk.green(`  ✓ Skill "${globalSkill.metadata.name}" removed from global configuration`));
        } else {
          console.log(chalk.red(`  ✗ Failed to remove skill "${globalSkill.metadata.name}"`));
        }
        console.log('');
        return;
      }
    } catch (error) {
      console.log(chalk.red(`  Error removing skill: ${(error as Error).message}`));
      console.log('');
      return;
    }

    // Skill not found
    console.log(chalk.yellow(`  Skill "${skillName}" not found`));
    console.log(chalk.dim('  Use "/skills list" to see available skills'));
    console.log('');
  }

  /**
   * Parse skill file with YAML frontmatter
   */
  private parseSkillFile(filePath: string, content: string): {
    name: string;
    description: string;
    model?: string;
    content: string;
  } | null {
    // Match YAML frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

    if (!frontmatterMatch) {
      return null;
    }

    const frontmatter = frontmatterMatch[1];
    const body = frontmatterMatch[2];

    // Parse fields
    const parseField = (field: string): string => {
      const match = frontmatter.match(new RegExp(`^${field}:\\s*(.+)$`, 'm'));
      return match ? match[1].trim() : '';
    };

    const name = parseField('name');
    const description = parseField('description');
    const model = parseField('model') || undefined;

    if (!name || !description) {
      return null;
    }

    return {
      name,
      description,
      model,
      content: body,
    };
  }

  // ========================================================================
  // Project Analysis Handler
  // ========================================================================

  private async handleProjectCommand(arg: string): Promise<void> {
    const { ProjectAnalyzer } = await import('../../../core/src/analysis/ProjectAnalyzer.js');

    // Parse command arguments
    const args = arg.trim().split(/\s+/);
    const subcommand = args[0]?.toLowerCase();

    if (subcommand === 'analyze') {
      await this.handleProjectAnalyze();
      return;
    }

    // Default: show usage
    console.log('');
    console.log(chalk.hex('#7C3AED').bold('  Project Analysis'));
    console.log('');
    console.log(chalk.yellow('  Usage: /project analyze'));
    console.log(chalk.dim('    Analyze current project and generate documentation'));
    console.log('');
  }

  /**
   * Analyze current project and generate documentation
   */
  private async handleProjectAnalyze(): Promise<void> {
    const { ProjectAnalyzer } = await import('../../../core/src/analysis/ProjectAnalyzer.js');

    console.log('');
    console.log(chalk.hex('#7C3AED').bold('  Analyzing Project...'));
    console.log('');

    try {
      const analyzer = new ProjectAnalyzer(this.cwd, {
        maxDepth: 5,
        includeTests: true,
        includeNodeModules: false,
        analyzeImports: true,
      });

      const structure = await analyzer.analyze();

      console.log(chalk.green('  ✓ Analysis complete'));
      console.log('');

      // Generate markdown documentation
      const markdown = analyzer.generateMarkdown(structure);

      // Save to file
      const { writeFile } = await import('fs/promises');
      const { join } = await import('path');
      const docPath = join(this.cwd, 'PROJECT_ANALYSIS.md');

      await writeFile(docPath, markdown, 'utf-8');

      console.log(chalk.hex('#7C3AED').bold('  Project Summary:'));
      console.log('');
      console.log(chalk.white(`  Name: ${structure.name}`));
      console.log(chalk.white(`  Type: ${this.formatProjectType(structure.type)}`));
      console.log(chalk.white(`  Files: ${structure.codeMetrics.totalFiles}`));
      console.log(chalk.white(`  Lines: ${structure.codeMetrics.totalLines.toLocaleString()}`));
      console.log('');
      console.log(chalk.hex('#7C3AED').bold('  Tech Stack:'));
      console.log('');

      if (structure.techStack.languages.length > 0) {
        console.log(chalk.white('  Languages:'));
        structure.techStack.languages.forEach(lang => console.log(chalk.dim(`    - ${lang}`)));
      }

      if (structure.techStack.frameworks.length > 0) {
        console.log(chalk.white('  Frameworks:'));
        structure.techStack.frameworks.forEach(fw => console.log(chalk.dim(`    - ${fw}`)));
      }

      console.log('');
      console.log(chalk.hex('#7C3AED').bold('  Key Directories:'));
      console.log('');
      structure.directories.slice(0, 5).forEach(dir => {
        console.log(chalk.white(`  ${dir.name}/`));
        console.log(chalk.dim(`    ${dir.purpose} (${dir.fileCount} files)`));
      });

      console.log('');
      console.log(chalk.green(`  ✓ Full documentation saved to: ${docPath}`));
      console.log('');
      console.log(chalk.dim('  The analysis will be used to help the AI understand your project structure.'));
      console.log('');

      // Store analysis in state for injection into system prompt
      this.state.projectAnalysis = markdown;

    } catch (error) {
      console.log(chalk.red(`  ✗ Error analyzing project: ${(error as Error).message}`));
      console.log('');
    }
  }

  /**
   * Format project type for display
   */
  private formatProjectType(type: string): string {
    const typeNames: Record<string, string> = {
      unknown: 'Unknown',
      frontend: 'Frontend Application',
      backend: 'Backend Application',
      fullstack: 'Full Stack Application',
      mobile: 'Mobile Application',
      desktop: 'Desktop Application',
      library: 'Library/Package',
      cli: 'CLI Tool',
      monorepo: 'Monorepo',
    };

    return typeNames[type] || type;
  }

  // ========================================================================
  // Shell Command Handler
  // ========================================================================

  private async handleShellCommand(cmd: string): Promise<void> {
    if (!cmd) {
      console.log(chalk.gray('  Usage: !<command>'));
      return;
    }

    console.log(chalk.gray(`  $ ${cmd}`));
    const startTime = Date.now();

    try {
      const isWin = process.platform === 'win32';
      const shell = isWin ? 'powershell.exe' : '/bin/sh';
      const shellArgs = isWin ? ['-Command', cmd] : ['-c', cmd];

      await new Promise<void>((resolve, reject) => {
        const child = spawn(shell, shellArgs, {
          cwd: this.cwd,
          stdio: ['inherit', 'pipe', 'pipe'],
        });

        child.stdout?.on('data', (chunk: Buffer) => process.stdout.write(chunk.toString()));
        child.stderr?.on('data', (chunk: Buffer) => process.stderr.write(chunk.toString()));

        child.on('close', (code) => {
          const duration = ((Date.now() - startTime) / 1000).toFixed(2);
          if (code === 0) {
            console.log(chalk.green(`  ✓ exit 0`) + chalk.dim(` (${duration}s)`));
          } else {
            console.log(chalk.red(`  ✗ exit ${code}`) + chalk.dim(` (${duration}s)`));
          }
          resolve();
        });

        child.on('error', reject);
      });
    } catch (err) {
      console.log(chalk.red(`  Error: ${(err as Error).message}`));
    }
  }

  // ========================================================================
  // Input Processing
  // ========================================================================

  private async processInput(input: string): Promise<void> {
    if (!this.sessionId) return;

    // Initialize active cursor on first use
    if (!this.activeCursor) {
      const { createPurpleCursor } = await import('../ui/components/ActiveCursor.js');
      this.activeCursor = createPurpleCursor();
    }

    // Expand @file references
    const expandedInput = await this.expandAtReferences(input);

    // Show user message with highlighted box (distinctive from AI responses)
    this.userMessageHighlight.render(input);

    // Clear any previous TODO panel
    this.todoProgressPanel.hide();

    // Add to messages
    this.state.messages.push({
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    });

    // Get mode prefix
    const modePrefix = this.getModePrefix();

    // Skill injection
    let skillPrefix = '';
    if (this._pendingSkillInject) {
      const skillName = this._pendingSkillInject.metadata.name;
      skillPrefix = `[SKILL: ${skillName}]\n${this._pendingSkillInject.content}\n[/SKILL]\n\n`;
      console.log(chalk.hex('#3B82F6')(`  ⚡ Skill "${skillName}" injected`));
      this._pendingSkillInject = null;
    }
    const fullInput = [modePrefix, skillPrefix, expandedInput].filter(Boolean).join('\n\n');

    // Get model config to check for built-in search capability
    const modelConfigResult = this.configManager.getModelConfig(this.modelClient.getModel());

    // Build system prompt
    // Build system prompt with active skills
        let systemPrompt = buildSystemPrompt({
          workingDirectory: this.cwd,
          model: this.modelClient.getModel(),
          approvalMode: this.getEffectiveApprovalMode(),
          supportsBuiltinSearch: modelConfigResult?.model?.supportsBuiltinSearch,
          toolRegistry: this.toolRegistry,
        });
    
        // Inject active skills into system prompt
            if (this.state.activeSkills && this.state.activeSkills.length > 0) {
              systemPrompt += '\n\n';
              systemPrompt += '# Active Skills\n\n';
              for (const skill of this.state.activeSkills) {
                systemPrompt += `## ${skill.name}\n`;
                systemPrompt += `${skill.description}\n\n`;
                systemPrompt += `${skill.content}\n\n`;
                systemPrompt += '---\n\n';
              }
            }
        
            // Inject project analysis into system prompt
            if (this.state.projectAnalysis) {
              systemPrompt += '\n\n';
              systemPrompt += '# Project Context\n\n';
              systemPrompt += 'The following is an analysis of the current project structure and tech stack:\n\n';
              systemPrompt += this.state.projectAnalysis;
              systemPrompt += '\n';
            }
        
            // Reset tracking counters
    this.turnCount = 0;
    this.toolCallCount = 0;
    this.toolCallStatusDisplay.clear();

    // Start active cursor (purple circle animation)
    this.activeCursor.start();

    // Don't show execution header (iFlow CLI style - just start output)

    // Create agent loop
    this.currentLoop = new AgentLoop({
      modelClient: this.modelClient,
      sessionManager: this.sessionManager,
      toolRegistry: this.toolRegistry,
      systemPrompt,
      contextCompressor: this.contextCompressor,
      maxContextTokens: (this.config.core.maxTokens || 16384) * 8,

      onTextDelta: (text: string) => {
        // Stop cursor when text output starts (prevents cursor symbols in output)
        if (this.activeCursor && this.activeCursor.isVisible()) {
          this.activeCursor.stop();
        }
        this.currentText += text;
        process.stdout.write(text);
      },

      onToolStart: (name: string, toolCallId: string, input?: Record<string, unknown>) => {
        this.toolCallCount++;
        this.toolCallStatusDisplay.startCall(toolCallId, name, input);
        this.updateStatusLine();
      },

      onToolComplete: (name: string, toolCallId: string, result: any) => {
        if (result.isError) {
          this.toolCallStatusDisplay.completeError(toolCallId, result.content || 'Unknown error');
        } else {
          this.toolCallStatusDisplay.completeSuccess(toolCallId, result.content);
        }
        
        // Handle TODO panel display for todo tool
        if (name === 'todo' && !result.isError && result.content) {
          this.handleTodoResult(result.content);
        }
        
        // Handle code file changes display
        if ((name === 'write_file' || name === 'replace' || name === 'edit_file') && !result.isError) {
          this.showCodeChangeIndicator(name, result.content);
        }
        
        this.updateStatusLine();
      },

      onThinkingStart: () => {
        if (this.state.showThinking) {
          this.thinkingContentDisplay.start();
        }
      },

      onThinkingDelta: (delta: string) => {
        if (this.state.showThinking) {
          this.thinkingContentDisplay.append(delta);
        }
      },

      onThinkingEnd: () => {
        if (this.state.showThinking) {
          this.thinkingContentDisplay.complete();
        }
      },

      onApprovalRequired: this.handleApproval.bind(this),

      onTurnStart: (turn: number) => {
        this.turnCount = turn;
        this.updateStatusLine();
      },

      onTurnEnd: () => {
        // Nothing
      },

      onContextCompress: (orig: number, result: number, action: string) => {
        console.log(chalk.dim(`  🔄 context: ${orig} → ${result} tokens (${action})`));
      },
    });

    try {
      const result = await this.currentLoop.runStream(this.sessionId, fullInput);
      
      // Add assistant message
      this.state.messages.push({
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: this.currentText,
        timestamp: new Date(),
      });

      // Update context usage
      const totalTokens = result.totalInputTokens + result.totalOutputTokens;
      this.state.contextUsage = Math.min(100, Math.round((totalTokens / 128000) * 100));

      // Show summary
      console.log('');
      console.log(chalk.dim(`  ✓ ${result.turnsCompleted} turns · ${totalTokens.toLocaleString()} tokens`));

      // Persist session
      this.sessionManager.persist(this.sessionId);

    } catch (err) {
      if ((err as any).name !== 'CancelledError') {
        console.log(chalk.red(`\n  Error: ${(err as Error).message}`));
      }
    } finally {
      this.currentLoop = null;
      this.currentText = '';

      // Stop active cursor
      if (this.activeCursor) this.activeCursor.stop();
    }
  }

  // ========================================================================
  // @ File Reference Expansion
  // ========================================================================

  private async expandAtReferences(input: string): Promise<string> {
    const atPattern = /@([\w./\-\\]+)/g;
    const matches = [...input.matchAll(atPattern)];
    if (matches.length === 0) return input;

    const injections: string[] = [];

    for (const match of matches) {
      const refPath = match[1];
      if (!refPath) continue;
      
      const absPath = path.isAbsolute(refPath) 
        ? refPath 
        : path.resolve(this.cwd, refPath);

      try {
        if (!fs.existsSync(absPath)) {
          injections.push(`[@${refPath}: not found]`);
          continue;
        }

        const stat = fs.statSync(absPath);
        if (stat.isDirectory()) {
          const files = fs.readdirSync(absPath).slice(0, 20);
          injections.push(`\n\`\`\`\n# Directory: ${refPath}\n${files.join('\n')}\n\`\`\`\n`);
        } else {
          const content = fs.readFileSync(absPath, 'utf-8');
          const ext = path.extname(refPath).slice(1) || 'txt';
          injections.push(`\n\`\`\`${ext}\n# ${refPath}\n${content}\n\`\`\`\n`);
        }
        console.log(chalk.dim(`  @ ${refPath}`));
      } catch (err) {
        injections.push(`[@${refPath}: error]`);
      }
    }

    return input + '\n' + injections.join('\n');
  }

  // ========================================================================
  // Approval Handler
  // ========================================================================

  private async handleApproval(request: ApprovalRequest): Promise<ApprovalResponse> {
    const mode = this.getEffectiveApprovalMode();

    // Auto-approve in yolo mode
    if (mode === 'yolo') {
      return { requestId: request.id, approved: true };
    }

    console.log('');
    console.log(chalk.yellow.bold('  ⚠ Approval Required'));
    console.log(chalk.gray(`  Tool: ${request.toolName}`));
    console.log(chalk.gray(`  Risk: ${request.risk}`));
    if (request.description) {
      const desc = request.description.replace(`Tool "${request.toolName}" with input: `, '');
      console.log(chalk.gray(`  Input: ${desc.slice(0, 80)}`));
    }
    console.log('');

    // For now, auto-approve in non-interactive mode
    // In a full implementation, this would use a ConfirmDialog
    return { requestId: request.id, approved: true };
  }

  // ========================================================================
  // Helpers
  // ========================================================================

  private getModePrefix(): string {
    switch (this.state.mode) {
      case 'plan':
        return '[PLAN MODE] First analyze and create a step-by-step plan. Wait for confirmation before executing.';
      case 'ask':
        return '[ASK MODE] Only answer questions. Do NOT modify files or execute commands.';
      case 'smart':
        return '[SMART MODE] Intelligent approval: low-risk operations auto-approved, high-risk ones ask for confirmation.';
      case 'edits':
        return '[EDITS MODE] File read/write/edit auto-approved. Shell commands and other operations may ask for confirmation.';
      default:
        return '';
    }
  }

  private getEffectiveApprovalMode(): string {
    return MODE_LABELS[this.state.mode].approvalMode;
  }

  private summarizeToolInput(name: string, input: Record<string, unknown>): string {
    switch (name) {
      case 'read_file':
      case 'list_directory':
        return String(input.file_path || input.path || input.target_directory || '').replace(/\\/g, '/').split('/').slice(-2).join('/');
      case 'write_file':
        return String(input.file_path || input.path || '').replace(/\\/g, '/').split('/').slice(-2).join('/') + ' (write)';
      case 'edit_file':
      case 'replace_in_file':
        return String(input.file_path || '').replace(/\\/g, '/').split('/').slice(-2).join('/') + ' (edit)';
      case 'execute_command':
        return String(input.command || '').slice(0, 60);
      case 'search_file':
        return String(input.pattern || '') + ' in ' + String(input.path || '.').split('/').pop();
      case 'search_content':
        return '"' + String(input.pattern || '').slice(0, 40) + '"';
      case 'web_search':
        return '"' + String(input.query || '').slice(0, 40) + '"';
      default:
        const vals = Object.values(input).filter((v): v is string => typeof v === 'string' && v.length > 0);
        return vals.length > 0 ? vals[0].slice(0, 50) : '';
    }
  }

  /**
   * Handle TODO tool result and display in fixed-position panel
   */
  private handleTodoResult(result: string): void {
    if (!result || result === 'No tasks tracked.' || result === 'All tasks cleared.') {
      this.todoProgressPanel.hide();
      return;
    }

    const lines = result.split('\n').filter((l) => l.trim());
    if (lines.length === 0) {
      this.todoProgressPanel.hide();
      return;
    }

    // Parse TODO items from the result string
    const todos: TodoItem[] = [];
    let idx = 0;

    for (const line of lines) {
      const pendingMatch = line.match(/^○\s+\[pending\s*\]\s+(.+)/);
      const inProgressMatch = line.match(/^◉\s+\[in_progress\s*\]\s+(.+)/);
      const completedMatch = line.match(/^●\s+\[completed\s*\]\s+(.+)/);
      const failedMatch = line.match(/^✗\s+\[failed\s*\]\s+(.+)/);

      // Detect priority from task text
      const detectPriority = (text: string): 'high' | 'medium' | 'low' | undefined => {
        if (/high|critical|urgent|重要/i.test(text)) return 'high';
        if (/low|minor|低/i.test(text)) return 'low';
        if (/medium|normal|中/i.test(text)) return 'medium';
        return undefined;
      };

      if (completedMatch) {
        todos.push({
          id: String(idx++),
          task: completedMatch[1].trim(),
          status: 'completed',
          priority: detectPriority(completedMatch[1]),
        });
      } else if (inProgressMatch) {
        todos.push({
          id: String(idx++),
          task: inProgressMatch[1].trim(),
          status: 'in_progress',
          priority: detectPriority(inProgressMatch[1]),
        });
      } else if (pendingMatch) {
        todos.push({
          id: String(idx++),
          task: pendingMatch[1].trim(),
          status: 'pending',
          priority: detectPriority(pendingMatch[1]),
        });
      } else if (failedMatch) {
        todos.push({
          id: String(idx++),
          task: failedMatch[1].trim(),
          status: 'failed',
          priority: detectPriority(failedMatch[1]),
        });
      }
    }

    // Update and show the fixed-position TODO panel
    if (todos.length > 0) {
      this.todoProgressPanel.setTodos(todos);
      this.todoProgressPanel.show();
    }
  }

  /**
   * Show compact execution status header
   */
  private showExecutionHeader(): void {
    // No decorative frame, just start output directly (iFlow CLI style)
  }

  /**
   * Update the compact status line showing current progress
   */
  private updateStatusLine(): void {
    const stats = this.toolCallStatusDisplay.getStats();
    const statusIcon = stats.error > 0 ? chalk.red('⚠') : stats.running > 0 ? chalk.yellow('◉') : chalk.green('✓');
    const turnStr = this.turnCount > 0 ? `turn ${this.turnCount}` : 'init';
    const toolStr = `${stats.success}✓ ${stats.error}✗`;
    
    const status = `${statusIcon} ${chalk.dim(turnStr)} ${chalk.dim('·')} ${chalk.dim(toolStr)}`;
    
    // Only update if changed
    if (status !== this.lastStatusLine) {
      this.lastStatusLine = status;
      // Write status to a fixed position (compact inline update)
      process.stdout.write(`\r${status}  `);
    }
  }

  /**
   * Show indicator when code files are modified
   */
  private showCodeChangeIndicator(name: string, result: string): void {
    // Extract file path from result if available
    const pathMatch = result?.match(/(.+\.\w+)/);
    const filePath = pathMatch ? pathMatch[1].split('/').slice(-2).join('/') : 'file';
    
    // Show compact code change indicator
    const icon = name === 'write_file' ? chalk.cyan('📝') : chalk.yellow('✏️');
    console.log(`\n  ${icon} ${chalk.dim(filePath)}`);
  }
}
