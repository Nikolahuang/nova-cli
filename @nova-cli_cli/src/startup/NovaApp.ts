// ============================================================================
// NovaApp - Application bootstrap and orchestration
// ============================================================================

import path from 'node:path';
import os from 'node:os';
import { ConfigManager } from '../../../core/src/config/ConfigManager.js';
import { AuthManager } from '../../../core/src/auth/AuthManager.js';
import { ToolRegistry } from '../../../core/src/tools/ToolRegistry.js';
import { SessionManager } from '../../../core/src/session/SessionManager.js';
import type { SessionId } from '../../../core/src/types/session.js';
import type { ModelConfig } from '../../../core/src/types/config.js';
import { AgentLoop } from '../../../core/src/session/AgentLoop.js';
import { ModelClient } from '../../../core/src/model/ModelClient.js';
import { ModelConnectionTester } from '../../../core/src/model/ModelConnectionTester.js';
import { McpManager } from '../../../core/src/mcp/McpManager.js';
import { SkillRegistry } from '../../../core/src/extensions/SkillRegistry.js';
import { SkillInstaller } from '../../../core/src/extensions/SkillInstaller.js';
import { ContextCompressor } from '../../../core/src/context/ContextCompressor.js';
import { ApprovalManager } from '../../../core/src/security/ApprovalManager.js';
import { HookExecutor } from '../../../core/src/security/HookExecutor.js';
import { NovaError, getErrorMessage } from '../../../core/src/types/errors.js';
import {
  readFileHandler,
  writeFileHandler,
  editFileHandler,
  listDirectoryHandler,
  searchFileHandler,
  searchContentHandler,
  shellHandler,
  webSearchHandler,
  webFetchHandler,
  memoryReadHandler,
  memoryWriteHandler,
  todoHandler,
  taskHandler,
} from '../../../core/src/tools/impl/index.js';
import {
  readFileSchema,
  writeFileSchema,
  editFileSchema,
  listDirectorySchema,
  searchFileSchema,
  searchContentSchema,
  executeCommandSchema,
  webSearchSchema,
  webFetchSchema,
  memoryReadSchema,
  memoryWriteSchema,
  todoSchema,
  taskSchema,
} from '../../../core/src/tools/schemas/index.js';
import type { NovaConfig } from '../../../core/src/types/config.js';
import { OllamaManager } from '../../../core/src/model/providers/OllamaManager.js';
import { ModelValidator } from '../../../core/src/model/ModelValidator.js';
import { parseCliArgs } from './parseArgs.js';
import { InteractiveRepl } from './InteractiveRepl.js';
import { InkBasedRepl } from './InkBasedRepl.js';

/** Providers that require an API key */
const REQUIRES_API_KEY = new Set(['anthropic', 'openai', 'azure', 'google', 'deepseek',
  'qwen', 'glm', 'moonshot', 'baichuan', 'minimax', 'yi', 'groq', 'mistral', 'together', 'perplexity']);
/** Providers that use baseUrl but may not need apiKey */
const BASE_URL_PROVIDERS = new Set(['ollama', 'custom', 'siliconflow']);

export class NovaApp {
  private configManager: ConfigManager;
  private authManager!: AuthManager;
  private toolRegistry!: ToolRegistry;
  private sessionManager!: SessionManager;
  private mcpManager!: McpManager;
  private skillRegistry!: SkillRegistry;
  private contextCompressor!: ContextCompressor;
  private approvalManager!: ApprovalManager;
  private hookExecutor!: HookExecutor;
  private modelConnectionTester!: ModelConnectionTester;

  constructor() {
    this.configManager = new ConfigManager();
  }

  async run(): Promise<void> {
    try {
      // 1. Parse CLI arguments
      const args = parseCliArgs(process.argv.slice(2));

      // 2. Load configuration
      const config = await this.configManager.load(args.projectDir);

      // 3. Initialize authentication
      this.authManager = new AuthManager();
      await this.authManager.loadCredentials();

      // 4. Handle special commands
      if (args.command === 'config') {
        await this.handleConfigCommand(args);
        return;
      }
      if (args.command === 'auth') {
        await this.handleAuthCommand(args);
        return;
      }
      // Run Ollama auto-discovery before model/provider/ollama commands
      await this.autoDiscoverOllamaModels();
      if (args.command === 'model') {
        await this.handleModelCommand(args);
        return;
      }
      if (args.command === 'provider') {
        await this.handleProviderCommand(args);
        return;
      }
      if (args.command === 'ollama') {
        await this.handleOllamaCommand(args);
        return;
      }
      if (args.command === 'coding-plan') {
        await this.handleCodingPlanCommand(args);
        return;
      }
      if (args.command === 'mcp') {
        await this.handleMcpCommand(args);
        return;
      }
      if (args.command === 'skills') {
        await this.handleSkillsCommand(args);
        return;
      }
      if (args.command === 'version') {
        console.log('nova-cli v0.1.0');
        return;
      }
      if (args.command === 'help') {
        this.printHelp();
        return;
      }

      // 4.5 First-time setup wizard (only for interactive sessions)
      const noInput = args.noInput || !process.stdin.isTTY;
      if (!noInput && !args.prompt && await this.isFirstTimeSetup(config)) {
        const setupComplete = await this.runFirstTimeSetupWizard(config);
        if (!setupComplete) {
          // User cancelled setup
          return;
        }
      }

      // 5. Override config with CLI args
      if (args.approvalMode) {
        config.core.defaultApprovalMode = args.approvalMode;
      }
      if (args.maxTurns) {
        config.core.maxTurns = args.maxTurns;
      }

      // 5.5 Initialize core components
      await this.initializeComponents(config, args);

      // 5.6 Determine non-interactive mode (--no-input flag or stdin is not TTY)
      // (already computed above for first-time setup check)

      // 5.7 Test model connections on startup (show status summary)
      if (!noInput && !args.prompt) {
        await this.showConnectionStatus(config);
      }

      // 6. Create model client
      const modelClient = await this.createModelClient(config, args.model, noInput);

      // 7. Start interactive REPL or run single prompt
      const cwd = args.projectDir || process.cwd();

      if (args.prompt) {
        await this.runSinglePrompt(args.prompt, cwd, modelClient, config, args.minimal, args.thinking);
      } else {
        // ---- Session restore logic (-c / -r) ----
        let restoreSessionId: SessionId | undefined;

        if (args.continueSession) {
          // -c: auto-load most recent session
          const latest = this.sessionManager.loadLatestSession();
          if (latest) {
            restoreSessionId = latest.id;
            console.log(`\x1b[36m  Continuing session: ${latest.id.slice(0, 8)} (${this.sessionManager.listPersistedSessions(1)[0]?.title || ''})\x1b[0m`);
          } else {
            console.log('\x1b[33m  No previous session found. Starting fresh.\x1b[0m');
          }
        } else if (args.resumeSession) {
          // -r: let user pick from history
          restoreSessionId = await this.pickSessionInteractive();
        } else if (args.sessionId) {
          // --resume <id>
          const s = this.sessionManager.loadFromDisk(args.sessionId);
          if (s) restoreSessionId = s.id;
        }

        // Use InkBasedRepl for modern UI (similar to Claude Code)
        const repl = new InkBasedRepl({
          modelClient,
          sessionManager: this.sessionManager,
          toolRegistry: this.toolRegistry,
          approvalManager: this.approvalManager,
          authManager: this.authManager,
          config,
          configManager: this.configManager,
          cwd,
          contextCompressor: this.contextCompressor,
          mcpManager: this.mcpManager,
          skillRegistry: this.skillRegistry,
          restoreSessionId,
          json: args.json,
          noInput,
          limit: args.limit,
        });
        await repl.start();
      }

    } catch (err) {
      if (err instanceof NovaError) {
        console.error(`[${err.code}] ${err.message}`);
      } else {
        console.error('Fatal error:', getErrorMessage(err));
      }
      process.exit(1);
    }
  }

  private async initializeComponents(config: NovaConfig, args: ReturnType<typeof parseCliArgs>): Promise<void> {
    // Tool Registry
    this.toolRegistry = new ToolRegistry();
    
    // Get model config to check for built-in search capability
    const modelConfigResult = this.configManager.getModelConfig(config.core.defaultModel);
    this.registerBuiltinTools(args.minimal, args.prompt, modelConfigResult?.model);
    // Session Manager
    this.sessionManager = new SessionManager();

    // Context Compressor (intelligent context management)
    this.contextCompressor = new ContextCompressor({
      maxTokens: config.core.maxTokens * 8 || 128000,
      summaryModel: config.core.defaultModel,
    });

    // Model Connection Tester
    this.modelConnectionTester = new ModelConnectionTester(this.authManager, this.configManager);

    // Skill Registry (auto-discovers skills from ~/.nova/skills/)
    const skillsDir = path.join(os.homedir(), '.nova', 'skills');
    this.skillRegistry = new SkillRegistry(skillsDir);
    try {
      await this.skillRegistry.initialize();
    } catch {
      // Skills are optional; don't block startup
    }

    // MCP Manager
    this.mcpManager = new McpManager();
    if (config.mcp) {
      for (const [name, serverConfig] of Object.entries(config.mcp)) {
        if (serverConfig.enabled !== false) {
          try {
            const tools = await this.mcpManager.connect({ name, ...serverConfig });
            // Register MCP tools
            for (const tool of tools) {
              this.toolRegistry.register(tool, async (input) => {
                const result = await this.mcpManager.callToolByNamespacedName(tool.name, input as unknown as Record<string, unknown>);
                return { content: result };
              });
            }
          } catch (err) {
            console.warn(`Failed to connect to MCP server "${name}": ${getErrorMessage(err)}`);
          }
        }
      }
    }

    // Approval Manager
    this.approvalManager = new ApprovalManager({
      defaultMode: config.core.defaultApprovalMode,
      autoApproveLowRisk: true,
    });

    // Hook Executor
    this.hookExecutor = new HookExecutor({
      workingDirectory: args.projectDir || process.cwd(),
      environment: {},
    });
    if (config.hooks) {
      for (const hook of config.hooks) {
        this.hookExecutor.register({
          event: hook.event as any,
          command: hook.command,
          timeout: hook.timeout,
          matcher: hook.matcher,
          description: hook.description,
        });
      }
    }
  }

  /**
   * Select tools based on the user's prompt to optimize token usage
   * Returns a list of tool names that are likely needed for the task
   */
  private selectToolsForPrompt(prompt: string, minimal: boolean = false): string[] {
    if (minimal) {
      return ['read_file', 'write_file', 'edit_file', 'list_directory', 'execute_command'];
    }

    const promptLower = prompt.toLowerCase();
    const selectedTools: string[] = [];

    // Essential tools (always included)
    const essentialTools = ['read_file', 'write_file', 'edit_file', 'list_directory', 'execute_command', 'search_file', 'search_content'];
    selectedTools.push(...essentialTools);

    // Search tools (if user wants to search/find)
    if (promptLower.includes('搜索') || promptLower.includes('查找') || 
        promptLower.includes('search') || promptLower.includes('find') ||
        promptLower.includes('where') || promptLower.includes('定位')) {
      selectedTools.push('search_file', 'search_content');
    }

    // Web tools (if user asks about web/URL/http)
    if (promptLower.includes('网站') || promptLower.includes('url') || 
        promptLower.includes('http') || promptLower.includes('web') ||
        promptLower.includes('搜索') && (promptLower.includes('网上') || promptLower.includes('online'))) {
      selectedTools.push('web_search', 'web_fetch');
    }

    // Memory tools (if user asks to remember/save)
    if (promptLower.includes('记住') || promptLower.includes('记忆') || 
        promptLower.includes('memory') || promptLower.includes('save') ||
        promptLower.includes('存储') || promptLower.includes('记住')) {
      selectedTools.push('memory_read', 'memory_write');
    }

    // Todo tools (if user mentions task/todo/plan)
    if (promptLower.includes('任务') || promptLower.includes('todo') || 
        promptLower.includes('计划') || promptLower.includes('plan') ||
        promptLower.includes('待办')) {
      selectedTools.push('todo');
    }

    // Task tools (if user mentions agent/sub-agent)
    if (promptLower.includes('agent') || promptLower.includes('子代理') || 
        promptLower.includes('subagent') || promptLower.includes('并行') ||
        promptLower.includes('parallel')) {
      selectedTools.push('task');
    }

    // Remove duplicates
    return [...new Set(selectedTools)];
  }

  private registerBuiltinTools(minimal: boolean = false, prompt?: string, modelConfig?: ModelConfig): void {
    // All available tools
    const allTools = [
      { name: 'read_file', handler: readFileHandler, schema: readFileSchema },
      { name: 'write_file', handler: writeFileHandler, schema: writeFileSchema },
      { name: 'edit_file', handler: editFileHandler, schema: editFileSchema },
      { name: 'list_directory', handler: listDirectoryHandler, schema: listDirectorySchema },
      { name: 'execute_command', handler: shellHandler, schema: executeCommandSchema },
      { name: 'search_file', handler: searchFileHandler, schema: searchFileSchema },
      { name: 'search_content', handler: searchContentHandler, schema: searchContentSchema },
      { name: 'web_search', handler: webSearchHandler, schema: webSearchSchema },
      { name: 'web_fetch', handler: webFetchHandler, schema: webFetchSchema },
      { name: 'memory_read', handler: memoryReadHandler, schema: memoryReadSchema },
      { name: 'memory_write', handler: memoryWriteHandler, schema: memoryWriteSchema },
      { name: 'todo', handler: todoHandler, schema: todoSchema },
      { name: 'task', handler: taskHandler, schema: taskSchema },
    ];

    // Select tools based on prompt (if provided) or use minimal mode
    let selectedToolNames: string[];
    if (prompt && !minimal) {
      selectedToolNames = this.selectToolsForPrompt(prompt, minimal);
      console.log(`Using ${selectedToolNames.length} tools based on your prompt`);
    } else {
      // Use essential tools only in minimal mode (saves ~1000 tokens)
      selectedToolNames = minimal 
        ? ['read_file', 'write_file', 'edit_file', 'list_directory', 'execute_command']
        : allTools.map(t => t.name);
    }

    // Filter out web_search tool if model has built-in search capability
    if (modelConfig?.supportsBuiltinSearch) {
      const filteredTools = selectedToolNames.filter(t => t !== 'web_search');
      if (filteredTools.length !== selectedToolNames.length) {
        console.log(`Model has built-in search capability, excluding web_search tool`);
      }
      selectedToolNames = filteredTools;
    }

    // Register selected tools
    const toolsToRegister = allTools.filter(t => selectedToolNames.includes(t.name));
    
    for (const { name, handler, schema } of toolsToRegister) {
      this.toolRegistry.register({
        name,
        description: this.getToolDescription(name),
        category: this.getToolCategory(name),
        inputSchema: schema,
        requiresApproval: this.getToolApproval(name),
        riskLevel: this.getToolRisk(name),
      }, handler);
    }
  }

  private getToolDescription(name: string): string {
    const descriptions: Record<string, string> = {
      read_file: 'Read file contents from disk. Use offset/limit for large files (e.g. 200 lines max per read). Always read a file before editing it.',
      write_file: 'Create a NEW file with content. Only use for new files - prefer edit_file for existing files. Set createDirectories=true to auto-create parent dirs.',
      edit_file: 'Edit an existing file by replacing oldText with newText. The oldText must be unique in the file. Prefer this over write_file for modifications.',
      list_directory: 'List files and directories at a path. Use depth=1 by default; avoid recursive=true on large directories to prevent excessive output.',
      search_file: 'Find files by glob pattern (e.g. "*.ts"). Returns relative paths. Prefer this over listing all files.',
      search_content: 'Search file contents using regex. Returns matching lines with context. Use headLimit to cap results.',
      execute_command: 'Execute a shell command (PowerShell on Windows, bash on Linux/macOS). Use for building, testing, git, npm, etc. Set timeout for long-running commands.',
      web_search: 'Search the web for current information. Use when you need up-to-date facts or are unsure about something.',
      web_fetch: 'Fetch and read a web page URL. Returns converted text. Use for reading documentation, articles, or API docs.',
      memory_read: 'Read a value from persistent memory by key and scope. Use for cross-session context.',
      memory_write: 'Write a value to persistent memory with optional TTL and tags. Use to remember important context across turns.',
      todo: 'Track tasks and progress. Use "create" to add tasks, "update" to change status (pending/in_progress/completed), "list" to show current state. Break complex tasks into sub-tasks and track progress.',
      task: 'Launch a sub-agent to perform a specific task. Use subagentType: code-explorer (analyze code), research (gather info), or executor (perform actions).',
    };
    return descriptions[name] || name;
  }

  private getToolCategory(name: string): 'file' | 'search' | 'execution' | 'web' | 'memory' | 'orchestration' {
    if (name.startsWith('read_') || name.startsWith('write_') || name.startsWith('edit_') || name.startsWith('list_')) return 'file';
    if (name.startsWith('search_')) return 'search';
    if (name.startsWith('execute_')) return 'execution';
    if (name.startsWith('web_')) return 'web';
    if (name === 'todo' || name === 'task') return 'orchestration';
    if (name.startsWith('memory_')) return 'memory';
    return 'orchestration';
  }

  private getToolApproval(name: string): boolean {
    const alwaysApprove = new Set(['memory_read']);
    const risky = new Set(['execute_command', 'write_file', 'edit_file', 'task']);
    if (alwaysApprove.has(name)) return false;
    if (risky.has(name)) return true;
    return false;
  }

  private getToolRisk(name: string): 'low' | 'medium' | 'high' | 'critical' {
    const critical = new Set(['execute_command']);
    const high = new Set(['write_file', 'edit_file', 'task']);
    const low = new Set(['read_file', 'list_directory', 'search_file', 'search_content', 'memory_read', 'web_search', 'web_fetch']);
    if (critical.has(name)) return 'critical';
    if (high.has(name)) return 'high';
    if (low.has(name)) return 'low';
    return 'medium';
  }

  private async createModelClient(config: NovaConfig, cliModel?: string, noInput?: boolean): Promise<ModelClient> {
    const rawModelId = cliModel || config.core.defaultModel;
    const configModel = this.configManager.getModelConfig(rawModelId);

    if (!configModel) {
      // Check if it might be an Ollama model (user can specify any ollama model name)
      if (this.authManager.hasCredentials('ollama') || process.env.OLLAMA_HOST) {
        const creds = this.authManager.getCredentials('ollama');
        return new ModelClient({
          provider: 'ollama',
          baseUrl: creds?.baseUrl || 'http://localhost:11434',
          model: rawModelId,
          maxTokens: config.core.maxTokens,
          temperature: config.core.temperature,
        });
      }
      throw new NovaError(
        `Model "${rawModelId}" not found in configuration. Use "nova model list" to see available models.`,
        'CONFIG_ERROR'
      );
    }

    // Extract model ID from provider/model format or resolve alias
    let actualModelId: string;
    if (rawModelId.includes('/')) {
      // For provider/model format, use the model part directly
      actualModelId = rawModelId.split('/')[1];
    } else {
      // Resolve alias (e.g., "glm-cloud" → "glm-5")
      actualModelId = this.resolveModelAlias(rawModelId);
    }

    const providerType = configModel.provider.type;
    const providerName = configModel.provider.name;
    let creds = this.authManager.getCredentials(providerName);

    // For ollama and ollama-cloud, apiKey is handled differently
    if (providerType !== 'ollama' && providerType !== 'ollama-cloud' && !creds?.apiKey) {
      // In non-interactive mode, fail fast with actionable error
      if (noInput) {
        const envKey = providerType === 'anthropic' ? 'ANTHROPIC_API_KEY'
          : providerType === 'openai' ? 'OPENAI_API_KEY'
          : `${providerName.toUpperCase().replace(/-/g, '_')}_API_KEY`;
        
        throw new NovaError(
          `Missing API key for "${providerName}".\n\n` +
          `Solutions:\n` +
          `  1. Set environment variable: export ${envKey}=<your-key>\n` +
          `  2. Or run: nova auth set ${providerName} --key <your-key>\n` +
          `  3. Or use a local model: nova -m ollama/llama3.2`,
          'AUTH_ERROR'
        );
      }
      
      // Interactive prompt for API key
      const apiKey = await this.promptForApiKey(providerName, providerType);
      if (apiKey) {
        await this.authManager.setCredentials({ provider: providerName, apiKey });
        creds = { apiKey };
      } else {
        // User cancelled - fallback to ollama if available
        console.log('\x1b[33m  Falling back to local Ollama...\x1b[0m');
        return this.createOllamaClient(config, 'llama3.2');
      }
    }

    return new ModelClient({
      provider: providerType as any,
      apiKey: creds?.apiKey,
      baseUrl: creds?.baseUrl || configModel.provider.baseUrl,
      model: actualModelId,
      maxTokens: config.core.maxTokens,
      temperature: config.core.temperature,
      organizationId: creds?.organizationId,
      codingPlanPlatform: configModel.provider.codingPlanPlatform as any,
    });
  }

  /** Create an Ollama client as fallback */
  private createOllamaClient(config: NovaConfig, model: string): ModelClient {
    const creds = this.authManager.getCredentials('ollama');
    return new ModelClient({
      provider: 'ollama',
      baseUrl: creds?.baseUrl || process.env.OLLAMA_HOST || 'http://localhost:11434',
      model,
      maxTokens: config.core.maxTokens,
      temperature: config.core.temperature,
    });
  }

  /** Prompt user for API key interactively */
  private async promptForApiKey(providerName: string, providerType: string): Promise<string | null> {
    const readline = await import('node:readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    const envKey = providerType === 'anthropic' ? 'ANTHROPIC_API_KEY'
      : providerType === 'openai' ? 'OPENAI_API_KEY'
      : providerType === 'google' ? 'GOOGLE_API_KEY'
      : providerType === 'deepseek' ? 'DEEPSEEK_API_KEY'
      : `${providerName.toUpperCase()}_API_KEY`;

    console.log('');
    console.log(`\x1b[33m  ⚠ No API key found for "${providerName}"\x1b[0m`);
    console.log(`\x1b[90m  You can also set it via: export ${envKey}=<your-key>\x1b[0m`);
    console.log('');

    const question = (prompt: string): Promise<string> =>
      new Promise((resolve) => rl.question(prompt, resolve));

    try {
      const answer = await question(`  Enter ${providerName} API key (or press Enter to skip): `);
      rl.close();
      return answer.trim() || null;
    } catch {
      rl.close();
      return null;
    }
  }

  /** Resolve a model alias (e.g., "glm-cloud" → "glm-5", "cloud" → "deepseek-v3.2") */
  private resolveModelAlias(modelId: string): string {
    const aliases = this.configManager.getConfig().models.aliases;
    return aliases?.[modelId] || modelId;
  }

  private async runSinglePrompt(prompt: string, cwd: string, modelClient: ModelClient, config: NovaConfig, minimal: boolean = false, thinking?: string): Promise<void> {
    const session = this.sessionManager.create({
      workingDirectory: cwd,
      model: config.core.defaultModel,
      streaming: true,
    });

    // Get model config to check for built-in search capability
    const modelConfigResult = this.configManager.getModelConfig(config.core.defaultModel);

    const { buildSystemPrompt } = await import('../../../core/src/context/defaultSystemPrompt.js');
    const chalk = await import('chalk');
    const systemPrompt = buildSystemPrompt({
      workingDirectory: cwd,
      model: modelClient.getModel(),
      approvalMode: config.core.defaultApprovalMode,
      minimal,
      supportsBuiltinSearch: modelConfigResult?.model?.supportsBuiltinSearch,
    });

    const agentLoop = new AgentLoop({
      modelClient,
      sessionManager: this.sessionManager,
      toolRegistry: this.toolRegistry,
      systemPrompt,
      contextCompressor: this.contextCompressor,
      maxContextTokens: config.core.maxTokens * 8 || 128000,
      thinking,
      onTextDelta: (text) => {
        process.stdout.write(text);
      },
      onToolStart: (name) => {
        const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        process.stdout.write(`\n${chalk.default.cyan(`  [${time}] `)}${chalk.default.white.bold(name)}\n`);
      },
      onToolComplete: (name, _id, result) => {
        if (result.isError) {
          process.stdout.write(`${chalk.default.red('  [error]')}\n`);
        } else {
          process.stdout.write(`${chalk.default.gray('  [done]')}\n`);
        }
      },
      onApprovalRequired: async (request) => {
        return { requestId: request.id, approved: true };
      },
    });

    const result = await agentLoop.runStream(session.id, prompt);
    const totalTokens = result.totalInputTokens + result.totalOutputTokens;
    console.log(chalk.default.gray(`\n---\n${result.turnsCompleted} turn${result.turnsCompleted > 1 ? 's' : ''} | ${totalTokens} tokens (${result.totalInputTokens} in / ${result.totalOutputTokens} out)`));
  }

  private async handleConfigCommand(args: ReturnType<typeof parseCliArgs>): Promise<void> {
    if (args.subcommand === 'show') {
      const config = this.configManager.getConfig();
      console.log(JSON.stringify(config, null, 2));
    } else if (args.subcommand === 'edit') {
      const editor = process.env.EDITOR || process.env.VISUAL || 'code';
      const configPath = path.join(os.homedir(), '.nova', 'config.yaml');
      console.log(`Opening config: ${configPath}`);
      const { execFile } = await import('node:child_process');
      const { promisify } = await import('node:util');
      await promisify(execFile)(editor, [configPath]);
    } else {
      console.log('Usage: nova config [show|edit]');
    }
  }

  private async handleAuthCommand(args: ReturnType<typeof parseCliArgs>): Promise<void> {
    if (args.subcommand === 'set') {
      const provider = args.provider;
      if (!provider) {
        // Enhanced error with actionable suggestions
        console.error('');
        console.error('\x1b[31m╭──────────────────────────────────────────────────────────────────╮\x1b[0m');
        console.error('\x1b[31m│\x1b[0m  Error: Missing required argument <provider>                    \x1b[31m│\x1b[0m');
        console.error('\x1b[31m│\x1b[0m  Command: nova auth set                                         \x1b[31m│\x1b[0m');
        console.error('\x1b[31m╰──────────────────────────────────────────────────────────────────╯\x1b[0m');
        console.error('');
        console.error('  Correct Usage:');
        console.error('    \x1b[36mnova auth set <provider> [--key <api-key>] [--base-url <url>]\x1b[0m');
        console.error('');
        console.error('  Built-in providers:');
        console.error('    \x1b[90m• anthropic  \x1b[0m - Claude (claude-3.5-sonnet, etc.)');
        console.error('    \x1b[90m• openai     \x1b[0m - GPT (gpt-4o, gpt-4-turbo, etc.)');
        console.error('    \x1b[90m• google     \x1b[0m - Gemini (gemini-1.5-pro, etc.)');
        console.error('    \x1b[90m• deepseek   \x1b[0m - DeepSeek (deepseek-v3, etc.)');
        console.error('    \x1b[90m• ollama     \x1b[0m - Local models (llama3.2, etc.)');
        console.error('');
        console.error('  Examples:');
        console.error('    \x1b[90mnova auth set anthropic --key sk-ant-xxx\x1b[0m');
        console.error('    \x1b[90mnova auth set openai --key sk-xxx\x1b[0m');
        console.error('    \x1b[90mnova auth set ollama --base-url http://localhost:11434\x1b[0m');
        console.error('    \x1b[90mnova auth set my-provider --base-url https://api.example.com/v1 --key xxx\x1b[0m');
        return;
      }

      const readline = await import('node:readline');
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

      const askQuestion = (prompt: string): Promise<string> => {
        return new Promise((resolve) => {
          rl.question(prompt, (answer) => resolve(answer.trim()));
        });
      };

      try {
        const providerType = this.getProviderType(provider);
        const isOllama = providerType === 'ollama';
        const isCustom = BASE_URL_PROVIDERS.has(provider) && !isOllama;

        // API Key (skip for ollama)
        let apiKey = args.apiKey || '';
        if (!apiKey && !isOllama && REQUIRES_API_KEY.has(providerType)) {
          apiKey = await askQuestion(`Enter API key for ${provider}: `);
        }

        // Base URL (optional for API providers, important for ollama/custom)
        let baseUrl = args.baseUrl || '';
        if (!baseUrl && isOllama) {
          const defaultUrl = 'http://localhost:11434';
          baseUrl = await askQuestion(`Ollama base URL [${defaultUrl}]: `);
          if (!baseUrl) baseUrl = defaultUrl;
        } else if (!baseUrl && args.provider && !['anthropic', 'openai'].includes(args.provider)) {
          // For custom/other providers, ask about baseUrl
          const config = this.configManager.getConfig();
          const providerConfig = config.models.providers[args.provider];
          if (providerConfig?.baseUrl) {
            // Already has a default baseUrl in config
          } else {
            baseUrl = await askQuestion(`Base URL [skip to use default]: `);
          }
        }

        await this.authManager.setCredentials({
          provider,
          apiKey: apiKey || 'no-key-required',
          baseUrl: baseUrl || undefined,
        });

        console.log(`Credentials saved for \x1b[32m${provider}\x1b[0m (type: ${providerType})`);
      } finally {
        rl.close();
      }
    } else if (args.subcommand === 'remove') {
      const provider = args.provider;
      if (!provider) {
        console.error('Usage: nova auth remove <provider>');
        return;
      }
      const removed = await this.authManager.removeCredentials(provider);
      console.log(removed ? `Credentials removed for ${provider}` : `No credentials found for ${provider}`);
    } else if (args.subcommand === 'status') {
      const config = this.configManager.getConfig();
      const providerNames = Object.keys(config.models.providers);
      const extraProviders = this.authManager.listProviders().filter((p) => !providerNames.includes(p));

      console.log('\x1b[1mConfigured Providers:\x1b[0m');
      for (const p of providerNames) {
        const has = this.authManager.hasCredentials(p);
        const providerConfig = config.models.providers[p];
        const typeLabel = providerConfig.type === 'custom' ? `custom (${providerConfig.baseUrl || 'no baseUrl'})` : providerConfig.type;
        const status = has ? '\x1b[32mconfigured\x1b[0m' : '\x1b[31mnot configured\x1b[0m';
        console.log(`  ${p.padEnd(14)} ${status.padEnd(20)} [${typeLabel}]`);
      }
      for (const p of extraProviders) {
        const creds = this.authManager.getCredentials(p);
        console.log(`  ${p.padEnd(14)} \x1b[33mcustom\x1b[0m               [baseUrl: ${creds?.baseUrl || 'not set'}]`);
      }
    } else {
      console.log('Usage: nova auth [set|remove|status]');
      console.log('');
      console.log('  nova auth set <provider> [--key <api-key>] [--base-url <url>]');
      console.log('  nova auth remove <provider>');
      console.log('  nova auth status');
    }
  }

  private async handleModelCommand(args: ReturnType<typeof parseCliArgs>): Promise<void> {
    if (args.subcommand === 'list') {
      const config = this.configManager.getConfig();
      const currentDefault = config.core.defaultModel;

      // Test all providers connection status
      console.log('\x1b[90mTesting model connectivity...\x1b[0m\n');
      const tester = this.modelConnectionTester || new ModelConnectionTester(this.authManager, this.configManager);
      const providerStatuses = await tester.testAllProviders();

      // JSON output for Agent consumers
      if (args.json) {
        const output = {
          currentDefault,
          providers: providerStatuses.map(status => ({
            name: status.provider,
            type: status.type,
            status: status.status,
            hasCredentials: status.hasCredentials,
            message: status.message,
            latency: status.latency,
            models: status.models.map(m => ({
              id: m.model,
              status: m.status,
              message: m.message,
              latency: m.latency
            }))
          }))
        };
        console.log(JSON.stringify(output, null, 2));
        return;
      }

      // Human-readable output with enhanced status display
      console.log('\x1b[1mAvailable Models:\x1b[0m\n');

      // Sort providers: available > configured > unconfigured > unavailable
      const sortedStatuses = providerStatuses.sort((a, b) => {
        const order = { available: 0, configured: 1, partial: 2, unconfigured: 3, unavailable: 4, error: 5 };
        return (order[a.status] ?? 99) - (order[b.status] ?? 99);
      });

      for (const status of sortedStatuses) {
        const providerConfig = config.models.providers[status.provider];
        if (!providerConfig) continue;

        // Status icons and colors
        const statusConfig = {
          available: { icon: '\x1b[32m✓\x1b[0m', color: '\x1b[1m', desc: '' },
          configured: { icon: '\x1b[32m*\x1b[0m', color: '\x1b[1m', desc: '' },
          partial: { icon: '\x1b[33m~\x1b[0m', color: '\x1b[1m', desc: ' (partial)' },
          unconfigured: { icon: '\x1b[90m○\x1b[0m', color: '\x1b[90m', desc: ' (not configured)' },
          unavailable: { icon: '\x1b[31m✗\x1b[0m', color: '\x1b[90m', desc: ' (unavailable)' },
          error: { icon: '\x1b[31m!\x1b[0m', color: '\x1b[90m', desc: ' (error)' },
        };
        const sc = statusConfig[status.status] || statusConfig.unconfigured;

        const typeLabels: Record<string, string> = {
          anthropic: 'Anthropic Claude',
          openai: 'OpenAI',
          azure: 'Azure OpenAI',
          ollama: 'Ollama (Local)',
          'ollama-cloud': 'Ollama (Cloud)',
          custom: 'Custom',
          qwen: 'Qwen (DashScope)',
          glm: 'GLM (Zhipu AI)',
          moonshot: 'Moonshot',
          baichuan: 'Baichuan',
          minimax: 'MiniMax',
          yi: 'Yi (01.AI)',
          siliconflow: 'SiliconFlow',
          groq: 'Groq (Ultra-fast)',
          mistral: 'Mistral AI',
          together: 'Together AI',
          perplexity: 'Perplexity',
        };
        const providerLabel = typeLabels[providerConfig.type] || providerConfig.type;
        const latencyStr = status.latency ? ` \x1b[90m(${status.latency}ms)\x1b[0m` : '';

        console.log(`${sc.color}${sc.icon} ${status.provider}\x1b[0m -- ${providerLabel}${sc.desc}${latencyStr}`);

        // Show models with their connection status
        const models = Object.entries(providerConfig.models);
        for (const [modelId, modelConfig] of models) {
          const mc = modelConfig as ModelConfig;
          const modelStatus = status.models.find(m => m.model === modelId);
          
          const isDefault = modelId === currentDefault || modelId === config.models.aliases?.[currentDefault];
          const defaultMarker = isDefault ? ' \x1b[32m(default)\x1b[0m' : '';
          
          const alias = Object.entries(config.models.aliases || {})
            .find(([, v]) => v === modelId)?.[0];
          const aliasStr = alias ? ` \x1b[90malias: ${alias}\x1b[0m` : '';

          // Model status indicator
          let modelStatusIcon = '  ';
          if (modelStatus) {
            if (modelStatus.status === 'available') modelStatusIcon = '\x1b[32m  ✓\x1b[0m ';
            else if (modelStatus.status === 'configured') modelStatusIcon = '\x1b[32m  *\x1b[0m ';
            else if (modelStatus.status === 'unconfigured') modelStatusIcon = '\x1b[90m  ○\x1b[0m ';
            else if (modelStatus.status === 'unavailable') modelStatusIcon = '\x1b[31m  ✗\x1b[0m ';
          }

          const features: string[] = [];
          if (mc.supportsVision) features.push('vision');
          if (mc.supportsTools) features.push('tools');
          if (mc.supportsThinking) features.push('thinking');
          const featureStr = features.length > 0 ? ` [${features.join(', ')}]` : '';

          const costStr = mc.inputCostPerMToken
            ? ` ($${mc.inputCostPerMToken}/${mc.outputCostPerMToken} per 1M tok)`
            : ' (local)';

          // Dim unconfigured/unavailable models
          const dimStart = status.status === 'unconfigured' || status.status === 'unavailable' || status.status === 'error' ? '\x1b[90m' : '';
          const dimEnd = status.status === 'unconfigured' || status.status === 'unavailable' || status.status === 'error' ? '\x1b[0m' : '';

          console.log(`${dimStart}${modelStatusIcon}${modelId}${defaultMarker}${featureStr}${costStr}${aliasStr}${dimEnd}`);
        }
        console.log('');
      }

      console.log('\x1b[32m✓\x1b[0m = connected  \x1b[32m*\x1b[0m = configured  \x1b[33m~\x1b[0m = partial  \x1b[90m○\x1b[0m = not configured  \x1b[31m✗\x1b[0m = unavailable');
      console.log('\n\x1b[90mUsage: nova -m <model-id> or nova -m <alias>\x1b[0m');
      console.log('\x1b[90mConfigure: nova auth set <provider> --key <api-key>\x1b[0m');
    } else {
      console.log('Usage: nova model list');
    }
  }

  /** Determine provider type from provider name or config */
  private getProviderType(provider: string): string {
    const config = this.configManager.getConfig();
    const providerConfig = config.models.providers[provider];
    if (providerConfig) return providerConfig.type;
    // Check auth for custom providers
    if (this.authManager.hasCredentials(provider)) return 'custom';
    return 'custom';
  }

  /** Auto-discover Ollama models and register them dynamically */
  private async autoDiscoverOllamaModels(): Promise<void> {
    try {
      const ollamaCreds = this.authManager.getCredentials('ollama');
      const baseUrl = ollamaCreds?.baseUrl || process.env.OLLAMA_HOST || 'http://localhost:11434';
      const manager = new OllamaManager(baseUrl);

      if (!(await manager.ping())) return; // Ollama not running, skip silently

      const models = await manager.listModels();
      let registered = 0;
      for (const model of models) {
        const wasNew = this.configManager.registerModel(
          'ollama',
          model.name,
          manager.toModelConfig(model),
        );
        if (wasNew) registered++;
      }
      if (registered > 0) {
        // Also register aliases for newly discovered models
        // (silent, no output - this runs on every startup)
      }
    } catch {
      // Ollama discovery is best-effort, never block startup
    }
  }

  /** Show connection status summary on startup */
  private async showConnectionStatus(config: NovaConfig): Promise<void> {
    const statuses = await this.modelConnectionTester.testAllProviders();

    const connected = statuses.filter(s => s.status === 'configured');
    const partial = statuses.filter(s => s.status === 'partial');
    const unconfigured = statuses.filter(s => s.status === 'unconfigured');
    const unavailable = statuses.filter(s => s.status === 'unavailable');
    const errors = statuses.filter(s => s.status === 'error');

    // Quick summary line
    const parts: string[] = [];
    if (connected.length > 0) {
      parts.push(`\x1b[32m${connected.length} connected\x1b[0m`);
    }
    if (partial.length > 0) {
      parts.push(`\x1b[36m${partial.length} partial\x1b[0m`);
    }
    if (partial.length > 0) {
      parts.push(`\x1b[33m${partial.length} partial\x1b[0m`);
    }
    if (unconfigured.length > 0) {
      parts.push(`\x1b[90m${unconfigured.length} unconfigured\x1b[0m`);
    }
    if (unavailable.length > 0) {
      parts.push(`\x1b[33m${unavailable.length} unavailable\x1b[0m`);
    }
    if (errors.length > 0) {
      parts.push(`\x1b[31m${errors.length} error\x1b[0m`);
    }

    if (parts.length > 0) {
      console.log(`\n\x1b[90m  Model Status: ${parts.join(' | ')}\x1b[0m`);
    }

    // Show connected providers with latency
    for (const status of connected) {
      const latencyStr = status.latency ? ` (${status.latency}ms)` : '';
      console.log(`\x1b[32m  ✓ ${status.provider}${latencyStr}\x1b[0m`);
    }

    // Show warnings for unavailable providers
    for (const status of unavailable) {
      console.log(`\x1b[33m  ⚠ ${status.provider}: ${status.message}\x1b[0m`);
    }

    // Show errors
    for (const status of errors) {
      console.log(`\x1b[31m  ✗ ${status.provider}: ${status.message}\x1b[0m`);
    }

    // Show unconfigured hint if any
    if (unconfigured.length > 0 && connected.length === 0) {
      console.log(`\x1b[90m  Run "nova auth set <provider> --key <api-key>" to configure\x1b[0m`);
    }

    console.log('');
  }

  // ==================== Provider Command ====================

  private async handleProviderCommand(args: ReturnType<typeof parseCliArgs>): Promise<void> {
    if (args.subcommand === 'list') {
      await this.handleModelCommand({ ...args, command: 'model', subcommand: 'list' } as any);
      return;
    }

    if (args.subcommand === 'add') {
      const baseUrl = args.baseUrl;
      const apiKey = args.apiKey;
      
      if (!baseUrl) {
        // Enhanced error with actionable suggestions
        console.error('');
        console.error('\x1b[31m╭──────────────────────────────────────────────────────────────────╮\x1b[0m');
        console.error('\x1b[31m│\x1b[0m  Error: Missing required argument <base-url>                  \x1b[31m│\x1b[0m');
        console.error('\x1b[31m│\x1b[0m  Command: nova provider add                                    \x1b[31m│\x1b[0m');
        console.error('\x1b[31m╰──────────────────────────────────────────────────────────────────╯\x1b[0m');
        console.error('');
        console.error('  Correct Usage:');
        console.error('    \x1b[36mnova provider add <base-url> <api-key> [-m <model>] [-n <name>]\x1b[0m');
        console.error('');
        console.error('  Flags:');
        console.error('    \x1b[90m-m, --model <id>\x1b[0m      Default model ID (default: auto-detected)');
        console.error('    \x1b[90m-n, --name <name>\x1b[0m    Provider name (auto-generated from URL if omitted)');
        console.error('    \x1b[90m-k, --key <key>\x1b[0m      API key (alternative to positional arg)');
        console.error('    \x1b[90m-u, --base-url <url>\x1b[0m  Base URL (alternative to positional arg)');
        console.error('');
        console.error('  Examples:');
        console.error('    \x1b[90mnova provider add https://api.example.com sk-xxx\x1b[0m');
        console.error('    \x1b[90mnova provider add https://api.example.com sk-xxx -m gpt-4\x1b[0m');
        console.error('    \x1b[90mnova provider add -u https://api.example.com -k sk-xxx -n my-provider\x1b[0m');
        return;
      }

      // Auto-generate provider name from URL if not provided
      let providerName = args.provider;
      if (!providerName) {
        try {
          const url = new URL(baseUrl);
          // Extract name from hostname: api.example.com -> example
          const parts = url.hostname.split('.');
          providerName = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
        } catch {
          providerName = 'custom-api';
        }
      }

      const type = args.providerType || 'custom';
      const key = apiKey || 'no-key-required';

      // Probe available models from the API
      console.log(`\x1b[90mProbing ${baseUrl} for available models...\x1b[0m`);
      let availableModels: string[] = [];
      let defaultModel = args.defaultModel || '';
      
      try {
        const { OpenAICompatibleProvider } = await import('../../../core/src/model/providers/OpenAICompatibleProvider.js');
        const probe = new (class extends OpenAICompatibleProvider {
          constructor() {
            super({ apiKey: key, baseUrl, model: 'probe' });
          }
          get name() { return 'probe'; }
        })();
        availableModels = await probe.listModels();
      } catch (err) {
        console.error(`\x1b[33mWarning: Could not probe models - ${(err as Error).message}\x1b[0m`);
      }

      // Determine default model
      if (!defaultModel && availableModels.length > 0) {
        // Prefer models with common names
        const preferred = ['gpt-4', 'gpt-4o', 'gpt-3.5-turbo', 'claude-3', 'llama', 'qwen', 'glm'];
        for (const p of preferred) {
          const found = availableModels.find(m => m.toLowerCase().includes(p));
          if (found) {
            defaultModel = found;
            break;
          }
        }
        // Fall back to first model
        if (!defaultModel) {
          defaultModel = availableModels[0];
        }
      }
      
      if (!defaultModel) {
        defaultModel = 'default';
      }

      // Save credentials
      await this.authManager.setCredentials({
        provider: providerName,
        apiKey: key,
        baseUrl,
      });

      // Register provider in config if not already known
      const config = this.configManager.getConfig();
      const existingProvider = config.models.providers[providerName];

      if (!existingProvider) {
        // New provider: create with model
        this.configManager.registerProvider(providerName, {
          type: type as any,
          baseUrl,
          models: {
            [defaultModel]: {
              name: defaultModel,
              maxContextTokens: 128000,
              maxOutputTokens: 8192,
              supportsVision: false,
              supportsTools: true,
              supportsStreaming: true,
              supportsThinking: false,
            },
          },
          defaultModel,
        });
      } else if (!existingProvider.models[defaultModel]) {
        // Provider exists but model doesn't: add model
        existingProvider.models[defaultModel] = {
          name: defaultModel,
          maxContextTokens: 128000,
          maxOutputTokens: 8192,
          supportsVision: false,
          supportsTools: true,
          supportsStreaming: true,
          supportsThinking: false,
        };
        existingProvider.defaultModel = defaultModel;
      }

      // Set as default model (format: provider/model)
      const fullModelId = `${providerName}/${defaultModel}`;
      config.core.defaultModel = fullModelId;
      
      // Save configuration to disk
      await this.configManager.save(config);

      console.log(`\x1b[32m✓ Provider "${providerName}" added\x1b[0m`);
      console.log(`  Base URL: ${baseUrl}`);
      if (availableModels.length > 0) {
        console.log(`  Available models (${availableModels.length}):`);
        // Show first 10 models, indicate if more
        const shown = availableModels.slice(0, 10);
        for (const m of shown) {
          const marker = m === defaultModel ? ' \x1b[33m← selected\x1b[0m' : '';
          console.log(`    - ${m}${marker}`);
        }
        if (availableModels.length > 10) {
          console.log(`    ... and ${availableModels.length - 10} more`);
        }
      } else {
        console.log(`  Model: ${fullModelId}`);
      }
      console.log('');
      console.log(`\x1b[36mDefault set to ${fullModelId}. Run \x1b[33mnova\x1b[36m to start.\x1b[0m`);
      console.log(`\x1b[90mTo change model: nova -m ${providerName}/<model-id>\x1b[0m`);
      return;
    }

    if (args.subcommand === 'add-model') {
      const providerName = args.provider;
      if (!providerName) {
        console.error('Usage: nova provider add-model <provider> --model-id <id> --model-name <name> [--max-context <n>] [--max-output <n>] [--features vision,tools,streaming] [--cost-in <n>] [--cost-out <n>]');
        return;
      }

      const modelId = args.ollamaModel;
      if (!modelId) {
        console.error('Error: --model-id is required');
        return;
      }

      const features = (args.features || '').split(',').map((f: string) => f.trim()).filter(Boolean);
      const modelConfig: Record<string, unknown> = {
        name: args.modelName || modelId,
        maxContextTokens: args.maxContext || 128000,
        maxOutputTokens: args.maxOutput || 8192,
        supportsVision: features.includes('vision'),
        supportsTools: features.includes('tools'),
        supportsStreaming: features.includes('streaming') || true,
        supportsThinking: features.includes('thinking'),
      };
      if (args.costIn) modelConfig.inputCostPerMToken = args.costIn;
      if (args.costOut) modelConfig.outputCostPerMToken = args.costOut;

      this.configManager.registerModel(providerName, modelId, modelConfig as any);
      // Save configuration to disk
      await this.configManager.save(this.configManager.getConfig());

      console.log(`\x1b[32mModel "${modelId}" added to provider "${providerName}"\x1b[0m`);
      console.log(`  Use: nova -m ${modelId}`);
      return;
    }

    if (args.subcommand === 'remove') {
      const providerName = args.provider;
      if (!providerName) {
        console.error('Usage: nova provider remove <name>');
        return;
      }
      await this.authManager.removeCredentials(providerName);
      console.log(`Provider "${providerName}" removed`);
      return;
    }

    console.log('Usage: nova provider [add|add-model|remove|list]');
    console.log('');
    console.log('  nova provider add <url> <key> [-m <model>] [-n <name>]');
    console.log('  nova provider add-model <provider> --model-id <id> --model-name <name> [--features ...]');
    console.log('  nova provider remove <name>');
    console.log('  nova provider list');
    console.log('');
    console.log('Examples:');
    console.log('  nova provider add https://api.example.com sk-xxx');
    console.log('  nova provider add https://api.example.com sk-xxx -m gpt-4');
    console.log('  nova provider add https://api.example.com sk-xxx -m gpt-4 -n my-api');
  }

  // ==================== Coding Plan Command ====================

  private async handleCodingPlanCommand(args: ReturnType<typeof parseCliArgs>): Promise<void> {
    if (args.subcommand === 'list' || !args.subcommand) {
      console.log('\x1b[1mSupported Coding Plan Platforms:\x1b[0m\n');
      
      const platforms = [
        { name: 'alibaba', display: 'Alibaba Cloud (阿里云百炼)', models: 'qwen3.5-plus, qwen3-coder, glm-5', price: 'Lite ¥40/mo, Pro ¥200/mo' },
        { name: 'tencent', display: 'Tencent Cloud (腾讯云)', models: 'hy-2.0-instruct, glm-5, kimi-k2.5', price: 'Lite ¥7.9/mo, Pro ¥39.9/mo' },
        { name: 'volcengine', display: 'Volcengine (火山引擎)', models: 'doubao-seed-code, deepseek-v3.2, glm-4.7', price: 'Lite ¥9.9/mo, Pro ¥49.9/mo' },
        { name: 'baidu', display: 'Baidu Qianfan (百度千帆)', models: 'glm-5, kimi-k2.5, ernie-4.5', price: '¥39.9/mo' },
        { name: 'kimi', display: 'Kimi Code', models: 'kimi-k2, kimi-k2.5', price: '¥49/mo' },
        { name: 'zhipu', display: 'Zhipu AI (智谱)', models: 'glm-4.7, glm-5', price: '¥49/mo' },
        { name: 'minimax', display: 'MiniMax', models: 'minimax-2.7, abab6.5s-chat', price: '¥29/mo' },
      ];

      for (const p of platforms) {
        console.log(`  \x1b[36m${p.name}\x1b[0m - ${p.display}`);
        console.log(`    Models: ${p.models}`);
        console.log(`    Price: ${p.price}`);
        console.log('');
      }

      console.log('\x1b[90m  Get your API key from the platform console, then configure:\x1b[0m');
      console.log('\x1b[90m    nova coding-plan add <platform> --key <your-api-key>\x1b[0m');
      console.log('');
      return;
    }

    if (args.subcommand === 'add') {
      const platform = args.provider; // reuse provider arg for platform name
      if (!platform) {
        console.error('Usage: nova coding-plan add <platform> --key <api-key>');
        console.error('Platforms: alibaba, tencent, volcengine, baidu, kimi, zhipu, minimax');
        return;
      }

      const validPlatforms = ['alibaba', 'tencent', 'volcengine', 'baidu', 'kimi', 'zhipu', 'minimax', 'custom'];
      if (!validPlatforms.includes(platform)) {
        console.error(`Invalid platform: ${platform}`);
        console.error(`Valid platforms: ${validPlatforms.join(', ')}`);
        return;
      }

      const apiKey = args.apiKey;
      if (!apiKey) {
        console.error('Usage: nova coding-plan add <platform> --key <api-key>');
        return;
      }

      // Register the coding-plan provider with models
      const providerName = `coding-plan-${platform}`;
      
      // Platform-specific model configurations
      const platformModels: Record<string, Record<string, any>> = {
        alibaba: {
          'qwen3.5-plus': { name: 'Qwen 3.5 Plus', maxContextTokens: 131072, supportsTools: true, supportsStreaming: true },
          'qwen3-coder': { name: 'Qwen 3 Coder', maxContextTokens: 131072, supportsTools: true, supportsStreaming: true },
          'glm-5': { name: 'GLM-5', maxContextTokens: 128000, supportsTools: true, supportsStreaming: true, supportsThinking: true },
          'minimax-m2.5': { name: 'MiniMax M2.5', maxContextTokens: 131072, supportsTools: true, supportsStreaming: true },
          'kimi-k2.5': { name: 'Kimi K2.5', maxContextTokens: 131072, supportsTools: true, supportsStreaming: true },
        },
        tencent: {
          'hy-2.0-instruct': { name: 'Hunyuan 2.0', maxContextTokens: 131072, supportsTools: true, supportsStreaming: true },
          'glm-5': { name: 'GLM-5', maxContextTokens: 128000, supportsTools: true, supportsStreaming: true, supportsThinking: true },
          'kimi-k2.5': { name: 'Kimi K2.5', maxContextTokens: 131072, supportsTools: true, supportsStreaming: true },
          'minimax-m2.5': { name: 'MiniMax M2.5', maxContextTokens: 131072, supportsTools: true, supportsStreaming: true },
        },
        volcengine: {
          'doubao-seed-code': { name: 'Doubao Seed Code', maxContextTokens: 131072, supportsTools: true, supportsStreaming: true },
          'deepseek-v3.2': { name: 'DeepSeek V3.2', maxContextTokens: 131072, supportsTools: true, supportsStreaming: true, supportsThinking: true },
          'glm-4.7': { name: 'GLM-4.7', maxContextTokens: 128000, supportsTools: true, supportsStreaming: true },
          'kimi-k2': { name: 'Kimi K2', maxContextTokens: 131072, supportsTools: true, supportsStreaming: true },
        },
        baidu: {
          'glm-5': { name: 'GLM-5', maxContextTokens: 128000, supportsTools: true, supportsStreaming: true, supportsThinking: true },
          'minimax-m2.5': { name: 'MiniMax M2.5', maxContextTokens: 131072, supportsTools: true, supportsStreaming: true },
          'kimi-k2.5': { name: 'Kimi K2.5', maxContextTokens: 131072, supportsTools: true, supportsStreaming: true },
          'ernie-4.5': { name: 'ERNIE 4.5', maxContextTokens: 131072, supportsTools: true, supportsStreaming: true },
        },
        kimi: {
          'kimi-k2': { name: 'Kimi K2', maxContextTokens: 131072, supportsTools: true, supportsStreaming: true },
          'kimi-k2.5': { name: 'Kimi K2.5', maxContextTokens: 131072, supportsTools: true, supportsStreaming: true },
        },
        zhipu: {
          'glm-4.7': { name: 'GLM-4.7', maxContextTokens: 128000, supportsTools: true, supportsStreaming: true },
          'glm-5': { name: 'GLM-5', maxContextTokens: 128000, supportsTools: true, supportsStreaming: true, supportsThinking: true },
        },
        minimax: {
          'minimax-2.7': { name: 'MiniMax 2.7', maxContextTokens: 131072, supportsTools: true, supportsStreaming: true },
          'abab6.5s-chat': { name: 'abab6.5s Chat', maxContextTokens: 32768, supportsTools: true, supportsStreaming: true },
        },
        custom: {},
      };

      const defaultModels: Record<string, string> = {
        alibaba: 'qwen3-coder',
        tencent: 'glm-5',
        volcengine: 'doubao-seed-code',
        baidu: 'glm-5',
        kimi: 'kimi-k2.5',
        zhipu: 'glm-5',
        minimax: 'minimax-2.7',
        custom: 'glm-5',
      };

      this.configManager.registerProvider(providerName, {
        type: 'coding-plan',
        codingPlanPlatform: platform as any,
        models: platformModels[platform] || {},
        defaultModel: defaultModels[platform] || 'glm-5',
      });

      // Save configuration to disk
      await this.configManager.save(this.configManager.getConfig());

      // Save API key
      await this.authManager.setCredentials({ provider: providerName, apiKey });

      console.log(`\x1b[32m✓ Coding Plan provider "${platform}" added\x1b[0m`);
      console.log(`  Provider name: ${providerName}`);
      console.log(`  Default model: ${defaultModels[platform] || 'glm-5'}`);
      console.log(`  Available models: ${Object.keys(platformModels[platform] || {}).join(', ') || '(custom)'}`);
      console.log(`  Use: nova -m ${providerName}/${defaultModels[platform] || 'glm-5'}`);
      return;
    }

    console.log('Usage: nova coding-plan [list|add]');
    console.log('');
    console.log('  nova coding-plan list              List supported platforms');
    console.log('  nova coding-plan add <platform> --key <api-key>  Add a Coding Plan provider');
  }

  // ==================== Ollama Command ====================

  private async handleOllamaCommand(args: ReturnType<typeof parseCliArgs>): Promise<void> {
    const ollamaCreds = this.authManager.getCredentials('ollama');
    const baseUrl = args.ollamaHost || ollamaCreds?.baseUrl || 'http://localhost:11434';
    const manager = new OllamaManager(baseUrl);

    if (args.subcommand === 'status' || !args.subcommand) {
      const isRunning = await manager.ping();
      if (isRunning) {
        try {
          const version = await manager.version();
          console.log(`\x1b[32mOllama is running\x1b[0m (v${version})`);
          console.log(`  Host: ${baseUrl}`);
        } catch {
          console.log(`\x1b[32mOllama is running\x1b[0m`);
          console.log(`  Host: ${baseUrl}`);
        }
      } else {
        console.log(`\x1b[31mOllama is not running\x1b[0m`);
        console.log('');
        console.log(`  Start Ollama:`);
        console.log(`    ollama serve`);
        console.log('');
        console.log(`  Install Ollama:`);
        console.log(`    https://ollama.com`);
        console.log('');
        console.log(`  Configure custom host:`);
        console.log(`    nova auth set ollama --base-url http://your-host:11434`);
      }
      return;
    }

    if (args.subcommand === 'list') {
      if (!(await manager.ping())) {
        console.log(`\x1b[31mOllama is not running\x1b[0m at ${baseUrl}`);
        console.log('Start Ollama first: ollama serve');
        return;
      }
      const models = await manager.listModels();
      if (models.length === 0) {
        console.log('No models installed. Pull one with: nova ollama pull <model-name>');
        return;
      }
      console.log(`\x1b[1mInstalled Ollama Models:\x1b[0m\n`);
      for (const m of models) {
        const sizeGB = (m.size / 1024 / 1024 / 1024).toFixed(1);
        const family = m.details?.family || '';
        const params = m.details?.parameter_size || '';
        console.log(`  \x1b[1m${m.name}\x1b[0m`);
        console.log(`    ${family} ${params}  ${sizeGB} GB`);
      }
      console.log(`\nTotal: ${models.length} model(s)`);
      return;
    }

    if (args.subcommand === 'pull') {
      const modelName = args.ollamaModel;
      if (!modelName) {
        console.error('Usage: nova ollama pull <model-name>');
        console.error('Example: nova ollama pull llama3.1');
        return;
      }
      if (!(await manager.ping())) {
        console.log(`\x1b[31mOllama is not running\x1b[0m at ${baseUrl}`);
        return;
      }
      console.log(`Pulling ${modelName}...`);
      try {
        await manager.pullModel(modelName, (progress) => {
          if (progress.total && progress.completed) {
            const pct = ((progress.completed / progress.total) * 100).toFixed(0);
            process.stdout.write(`\r  ${progress.status} ${pct}%`);
          } else {
            process.stdout.write(`\r  ${progress.status}`);
          }
        });
        console.log('\n\x1b[32mPull complete!\x1b[0m');
        console.log(`  Use: nova -m ${modelName}`);
      } catch (err) {
        console.log(`\n\x1b[31mPull failed:\x1b[0m ${(err as Error).message}`);
      }
      return;
    }

    if (args.subcommand === 'rm') {
      const modelName = args.ollamaModel;
      if (!modelName) {
        console.error('Usage: nova ollama rm <model-name>');
        return;
      }
      try {
        await manager.deleteModel(modelName);
        console.log(`\x1b[32mModel "${modelName}" deleted\x1b[0m`);
      } catch (err) {
        console.log(`\x1b[31mDelete failed:\x1b[0m ${(err as Error).message}`);
      }
      return;
    }

    if (args.subcommand === 'info') {
      const modelName = args.ollamaModel;
      if (!modelName) {
        console.error('Usage: nova ollama info <model-name>');
        return;
      }
      try {
        const info = await manager.showModel(modelName);
        console.log(`\x1b[1m${modelName}\x1b[0m`);
        if (info.details) {
          console.log(`  Family:          ${info.details.family}`);
          console.log(`  Parameter Size:  ${info.details.parameter_size}`);
          console.log(`  Quantization:    ${info.details.quantization_level}`);
          console.log(`  Format:          ${info.details.format}`);
        }
        if (info.license) console.log(`  License:         ${info.license}`);
      } catch (err) {
        console.log(`\x1b[31mFailed to show model info:\x1b[0m ${(err as Error).message}`);
      }
      return;
    }

    if (args.subcommand === 'run') {
      const modelName = args.ollamaModel;
      if (!modelName) {
        console.error('Usage: nova ollama run <model-name>');
        return;
      }
      // Save ollama host if custom
      if (args.ollamaHost) {
        await this.authManager.setCredentials({
          provider: 'ollama',
          apiKey: 'ollama',
          baseUrl: args.ollamaHost,
        });
      }
      // Re-run with this model selected
      process.argv = ['nova', '-m', modelName, ...process.argv.slice(process.argv.indexOf('run') + 2)];
      // Just switch to model selection
      const newArgs = parseCliArgs(['-m', modelName]);
      const config = this.configManager.getConfig();
      try {
        const modelClient = await this.createModelClient(config, modelName);
        const cwd = process.cwd();
        const repl = new InkBasedRepl({
          modelClient,
          sessionManager: this.sessionManager!,
          toolRegistry: this.toolRegistry!,
          approvalManager: this.approvalManager!,
          authManager: this.authManager,
          config,
          configManager: this.configManager,
          cwd,
          contextCompressor: this.contextCompressor,
          mcpManager: this.mcpManager,
          skillRegistry: this.skillRegistry,
        });
        await repl.start();
      } catch (err) {
        console.error(`\x1b[31mFailed to start with model "${modelName}":\x1b[0m ${(err as Error).message}`);
      }
      return;
    }

    if (args.subcommand === 'cloud') {
      await this.handleOllamaCloudList();
      return;
    }

    console.log('Usage: nova ollama [status|list|pull|rm|info|run|cloud]');
    console.log('');
    console.log('  nova ollama status              Show Ollama server status');
    console.log('  nova ollama list                List installed models');
    console.log('  nova ollama pull <model>        Pull a model from Ollama Hub');
    console.log('  nova ollama rm <model>          Delete a local model');
    console.log('  nova ollama info <model>        Show model details');
    console.log('  nova ollama run <model>         Start REPL with model');
    console.log('  nova ollama cloud              List Ollama Cloud models');
  }

  /** List available Ollama Cloud models */
  private async handleOllamaCloudList(): Promise<void> {
    const creds = this.authManager.getCredentials('ollama-cloud');
    const apiKey = creds?.apiKey || process.env.OLLAMA_API_KEY;

    if (!apiKey) {
      console.log('\x1b[33mNo Ollama Cloud API key configured.\x1b[0m');
      console.log('');
      console.log('Set your API key:');
      console.log('  nova auth set ollama-cloud --key <your-api-key>');
      console.log('  or export OLLAMA_API_KEY=<your-api-key>');
      console.log('');
      console.log('Get an API key at: https://ollama.com/settings/keys');
      return;
    }

    try {
      const baseUrl = creds?.baseUrl || 'https://ollama.com';
      const res = await fetch(`${baseUrl}/api/tags`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        console.log(`\x1b[31mFailed to fetch cloud models: ${res.status} ${res.statusText}\x1b[0m`);
        return;
      }

      const data = await res.json() as { models: Array<{ name: string; size: number; details?: { parameter_size: string } }> };
      const models = data.models || [];

      if (models.length === 0) {
        console.log('No models available on Ollama Cloud.');
        return;
      }

      console.log(`\x1b[1mOllama Cloud Models (${models.length}):\x1b[0m\n`);
      for (const m of models) {
        const sizeGB = m.size > 0 ? (m.size / 1024 / 1024 / 1024).toFixed(1) + ' GB' : '';
        const params = m.details?.parameter_size || '';
        console.log(`  \x1b[1m${m.name}\x1b[0m`);
        if (params || sizeGB) {
          console.log(`    ${params}${params && sizeGB ? '  ' : ''}${sizeGB}`);
        }
      }
      console.log(`\nUse: nova -m deepseek-v3.2 "your prompt"`);
      console.log('Set API key: nova auth set ollama-cloud');
    } catch (err) {
      console.log(`\x1b[31mFailed to connect to Ollama Cloud:\x1b[0m ${(err as Error).message}`);
    }
  }

  // ==================== MCP Command ====================

  private async handleMcpCommand(args: ReturnType<typeof parseCliArgs>): Promise<void> {
    // Initialize MCP only (no model needed for status command)
    if (!this.mcpManager) {
      this.mcpManager = new McpManager();
      const config = this.configManager.getConfig();
      if (config.mcp) {
        for (const [name, serverConfig] of Object.entries(config.mcp)) {
          if (serverConfig.enabled !== false) {
            try {
              await this.mcpManager.connect({ name, ...serverConfig });
            } catch {
              // Ignore connection errors for status display
            }
          }
        }
      }
    }

    if (args.subcommand === 'status' || !args.subcommand) {
      const statuses = this.mcpManager.listServers();
      if (statuses.length === 0) {
        console.log('No MCP servers configured.');
        console.log('Add servers to ~/.nova/config.yaml under "mcp:".');
        return;
      }
      console.log('\x1b[1mMCP Server Status:\x1b[0m\n');
      for (const s of statuses) {
        const icon = s.connected ? '\x1b[32m●\x1b[0m' : '\x1b[31m●\x1b[0m';
        const status = s.connected ? '\x1b[32mconnected\x1b[0m' : '\x1b[31mdisconnected\x1b[0m';
        console.log(`  ${icon} ${s.name.padEnd(20)} ${status}`);
        if (s.connected) {
          console.log(`    Tools: ${s.toolCount}  Resources: ${s.resourceCount}`);
        }
        if (s.lastError) {
          console.log(`    Error: \x1b[31m${s.lastError}\x1b[0m`);
        }
      }
      return;
    }

    if (args.subcommand === 'list') {
      // Alias for status
      await this.handleMcpCommand({ ...args, subcommand: 'status' } as any);
      return;
    }

    console.log('Usage: nova mcp [status|list]');
    console.log('');
    console.log('  nova mcp status    Show all MCP server connections');
    console.log('  nova mcp list      Alias for status');
    console.log('');
    console.log('Configure MCP servers in ~/.nova/config.yaml:');
    console.log('');
    console.log('  mcp:');
    console.log('    filesystem:');
    console.log('      command: npx');
    console.log('      args: [-y, "@modelcontextprotocol/server-filesystem", /path]');
    console.log('    github:');
    console.log('      command: npx');
    console.log('      args: [-y, "@modelcontextprotocol/server-github"]');
    console.log('      env:');
    console.log('        GITHUB_TOKEN: your-token');
    console.log('');
    console.log('Popular MCP servers (install via npm):');
    console.log('  @modelcontextprotocol/server-filesystem   — file system');
    console.log('  @modelcontextprotocol/server-github       — GitHub API');
    console.log('  @modelcontextprotocol/server-brave-search — web search');
    console.log('  @modelcontextprotocol/server-sqlite       — SQLite');
    console.log('  @modelcontextprotocol/server-postgres     — PostgreSQL');
    console.log('  @modelscope/mcp-server                    — ModelScope (魔搭)');
  }

  // ==================== Skills Command ====================

  private async handleSkillsCommand(args: ReturnType<typeof parseCliArgs>): Promise<void> {
    if (!this.skillRegistry) {
      // Initialize just the skill registry
      const skillsDir = path.join(os.homedir(), '.nova', 'skills');
      this.skillRegistry = new SkillRegistry(skillsDir);
      await this.skillRegistry.initialize();
    }

    if (args.subcommand === 'list' || !args.subcommand) {
      const skills = await this.skillRegistry.list();
      if (skills.length === 0) {
        console.log('No skills found.');
        console.log('');
        console.log('Skills directory: ~/.nova/skills/');
        console.log('Each skill is a directory containing a SKILL.md file.');
        console.log('');
        console.log('Example skill structure:');
        console.log('  ~/.nova/skills/');
        console.log('    my-skill/');
        console.log('      SKILL.md   (skill instructions & metadata)');
        console.log('      scripts/   (optional scripts)');
        console.log('');
        console.log('To install skills from superpowers repository:');
        console.log('  nova skills install obra/superpowers');
        console.log('  nova skills install superpowers');
        return;
      }
      console.log('\x1b[1mAvailable Skills:\x1b[0m\n');
      for (const skill of skills) {
        const m = skill.metadata;
        const auto = m.autoGenerated ? ' \x1b[90m[auto]\x1b[0m' : '';
        const tags = m.tags.length > 0 ? ` \x1b[90m(${m.tags.join(', ')})\x1b[0m` : '';
        console.log(`  \x1b[36m${m.name.padEnd(22)}\x1b[0m ${m.description}${auto}${tags}`);
      }
      console.log(`\nTotal: ${skills.length} skill${skills.length !== 1 ? 's' : ''}`);
      return;
    }

    if (args.subcommand === 'install') {
      const source = args.provider || args.source || 'gitee:anderson2/superpowers';
      const force = args.force === true;
      
      console.log(`Installing skills from ${source}...`);
      
      try {
        const installer = new SkillInstaller();
        const installed = await installer.install({
          source,
          force,
        });
        
        if (installed.length === 0) {
          console.log('\x1b[33mNo skills installed (already exist). Use --force to overwrite.\x1b[0m');
        } else {
          console.log(`\x1b[32mSuccessfully installed ${installed.length} skill${installed.length !== 1 ? 's' : ''}:\x1b[0m`);
          for (const skill of installed) {
            console.log(`  \x1b[36m✓ ${skill.name}\x1b[0m`);
          }
        }
      } catch (error: any) {
        console.error(`\x1b[31mFailed to install skills:\x1b[0m ${error.message}`);
        console.error('');
        console.error('Supported formats:');
        console.error('  nova skills install obra/superpowers');
        console.error('  nova skills install https://github.com/owner/repo');
        console.error('  nova skills install owner/repo');
        console.error('');
        console.error('Options:');
        console.error('  --force    Overwrite existing skills');
        console.error('  --source   GitHub repository (default: obra/superpowers)');
      }
      return;
    }

    console.log('Usage: nova skills [list|install]');
    console.log('');
    console.log('  nova skills list                     List installed skills');
    console.log('  nova skills install [source]         Install skills from GitHub/Gitee');
    console.log('');
    console.log('Examples:');
    console.log('  nova skills install                  Install from gitee:anderson2/superpowers');
    console.log('  nova skills install anderson2/superpowers');
    console.log('  nova skills install gitee:anderson2/superpowers');
    console.log('  nova skills install https://gitee.com/anderson2/superpowers.git');
    console.log('  nova skills install --force          Overwrite existing skills');
    console.log('');
    console.log('Supported formats:');
    console.log('  owner/repo              - GitHub shorthand');
    console.log('  gitee:owner/repo        - Gitee shorthand');
    console.log('  https://...             - Full Git URL');
    console.log('');
    console.log('Popular repositories:');
    console.log('  gitee:anderson2/superpowers - Agentic skills framework (default)');
    console.log('  obra/superpowers              - GitHub mirror');
  }

  private printHelp(): void {
    const B = {
      brand: '\x1b[38;5;93m',
      brandLight: '\x1b[38;5;141m',
      primary: '\x1b[1m',
      muted: '\x1b[90m',
      info: '\x1b[36m',
      success: '\x1b[32m',
      warning: '\x1b[33m',
      reset: '\x1b[0m',
    };

    const BOX = {
      tl: '╭', tr: '╮', bl: '╰', br: '╯',
      h: '─', v: '│', ht: '├', htr: '┤',
      hThick: '━', diamond: '◆', arrow: '→',
    };

    const termCols = process.stdout.columns || 80;
    const w = Math.min(termCols - 4, 76);
    const hr = B.muted + BOX.h.repeat(w) + B.reset;
    const hrThick = B.brand + BOX.hThick.repeat(w) + B.reset;

    const cmd = (name: string, desc: string) =>
      `  ${B.info}${name.padEnd(20)}${B.reset} ${B.muted}${desc}${B.reset}`;

    console.log('');
    console.log(B.brand + BOX.tl + hrThick + BOX.tr + B.reset);

    // Compact header
    const header = '  ' + B.brand + 'NOVA' + B.reset + B.brandLight + ' CLI' + B.reset + ' · AI-powered terminal assistant';
    const headerPad = ' '.repeat(Math.max(0, w - 45));
    console.log(B.brand + BOX.v + B.reset + header + headerPad + B.brand + BOX.v + B.reset);

    console.log(B.brand + BOX.bl + hrThick + BOX.br + B.reset);
    console.log('');

    // Commands section
    console.log(B.brand + BOX.diamond + B.reset + ' ' + B.primary + 'COMMANDS' + B.reset);
    console.log('');

    console.log(cmd('(default)', 'Start interactive REPL session'));
    console.log(cmd('-p, --prompt', 'Run a single prompt and exit'));
    console.log(cmd('-c, --continue', 'Continue the most recent session'));
    console.log(cmd('-r, --resume', 'Interactively pick a session to resume'));
    console.log(cmd('model list', 'List all available models'));
    console.log(cmd('config show/edit', 'Show or edit configuration'));
    console.log(cmd('auth set <provider>', 'Configure API key'));
    console.log(cmd('coding-plan list', 'List Coding Plan platforms'));
    console.log(cmd('coding-plan add', 'Add Coding Plan provider'));
    console.log(cmd('mcp status', 'Show MCP server connections'));
    console.log(cmd('skills list', 'List installed skills'));
    console.log(cmd('skills install', 'Install skills from GitHub/Gitee'));
    console.log(cmd('version', 'Show version'));
    console.log('');

    // Options section
    console.log(B.brand + BOX.diamond + B.reset + ' ' + B.primary + 'OPTIONS' + B.reset);
    console.log('');
    console.log(cmd('-m, --model', 'Model to use'));
    console.log(cmd('-d, --directory', 'Working directory'));
    console.log(cmd('--approval-mode', 'yolo | plan | ask | smart'));
    console.log(cmd('--max-turns', 'Maximum conversation turns'));
    console.log(cmd('--no-stream', 'Disable streaming output'));
    console.log(cmd('--no-mcp', 'Disable MCP server connections'));
    console.log(cmd('--thinking <mode>', 'Control thinking mode: enabled|disabled|auto'));
    console.log('');

    // Providers
    console.log(B.brand + BOX.diamond + B.reset + ' ' + B.primary + 'PROVIDERS' + B.reset);
    console.log('');
    console.log(B.muted + '  anthropic, openai, google, deepseek, qwen, glm, moonshot,' + B.reset);
    console.log(B.muted + '  baichuan, yi, siliconflow, groq, mistral, together, perplexity,' + B.reset);
    console.log(B.muted + '  ollama (local), ollama-cloud, coding-plan (国内平台), <custom>' + B.reset);
    console.log('');

    // Coding Plan
    console.log(B.brand + BOX.diamond + B.reset + ' ' + B.primary + 'CODING PLAN' + B.reset);
    console.log('');
    console.log(B.muted + '  alibaba (阿里云), tencent (腾讯云), volcengine (火山引擎),' + B.reset);
    console.log(B.muted + '  baidu (百度千帆), kimi, zhipu (智谱), minimax' + B.reset);
    console.log('');

    // Examples
    console.log(B.brand + BOX.diamond + B.reset + ' ' + B.primary + 'EXAMPLES' + B.reset);
    console.log('');
    console.log(B.muted + '  nova                              # Start interactive session' + B.reset);
    console.log(B.muted + '  nova -c                           # Continue last session' + B.reset);
    console.log(B.muted + '  nova -p "Explain this code"       # Single prompt' + B.reset);
    console.log(B.muted + '  nova -m gpt-4o                    # Use GPT-4o' + B.reset);
    console.log(B.muted + '  nova coding-plan add alibaba --key <key>  # Add Coding Plan' + B.reset);
    console.log('');
  }

  /** Check if this is a first-time setup (no configured providers) */
  private async isFirstTimeSetup(config: NovaConfig): Promise<boolean> {
    // Check if any provider has credentials
    const providerNames = Object.keys(config.models.providers);
    
    for (const providerName of providerNames) {
      if (this.authManager.hasCredentials(providerName)) {
        return false; // Has at least one configured provider
      }
    }
    
    // Also check if Ollama is running locally
    const ollamaCreds = this.authManager.getCredentials('ollama');
    const baseUrl = ollamaCreds?.baseUrl || process.env.OLLAMA_HOST || 'http://localhost:11434';
    const manager = new OllamaManager(baseUrl);
    if (await manager.ping()) {
      return false; // Ollama is available
    }
    
    return true; // No providers configured and Ollama not running
  }

  /** First-time setup wizard */
  private async runFirstTimeSetupWizard(config: NovaConfig): Promise<boolean> {
    const readline = await import('node:readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    const askQuestion = (prompt: string): Promise<string> => {
      return new Promise((resolve) => {
        rl.question(prompt, (answer) => resolve(answer.trim()));
      });
    };

    const B = {
      brand: '\x1b[38;5;93m',
      brandLight: '\x1b[38;5;141m',
      primary: '\x1b[1m',
      muted: '\x1b[90m',
      info: '\x1b[36m',
      success: '\x1b[32m',
      warning: '\x1b[33m',
      reset: '\x1b[0m',
    };

    // Welcome banner
    console.log('');
    console.log(`${B.brand}╔══════════════════════════════════════════════════════════════╗${B.reset}`);
    console.log(`${B.brand}║${B.reset}                                                              ${B.brand}║${B.reset}`);
    console.log(`${B.brand}║${B.reset}   ${B.primary}Welcome to NOVA CLI!${B.reset}                                   ${B.brand}║${B.reset}`);
    console.log(`${B.brand}║${B.reset}   ${B.muted}Your AI-powered terminal assistant${B.reset}                       ${B.brand}║${B.reset}`);
    console.log(`${B.brand}║${B.reset}                                                              ${B.brand}║${B.reset}`);
    console.log(`${B.brand}╚══════════════════════════════════════════════════════════════╝${B.reset}`);
    console.log('');
    console.log(`${B.muted}It looks like this is your first time using Nova CLI.${B.reset}`);
    console.log(`${B.muted}Let's set up your AI model provider:${B.reset}`);
    console.log('');

    // Show available options
    console.log(`${B.primary}Choose your AI provider:${B.reset}`);
    console.log('');
    console.log(`  ${B.info}1.${B.reset} ${B.primary}Ollama (Local)${B.reset} - ${B.muted}Run models locally, free, no API key needed${B.reset}`);
    console.log(`  ${B.info}2.${B.reset} ${B.primary}Ollama Cloud${B.reset} - ${B.muted}Cloud-hosted models, requires API key${B.reset}`);
    console.log(`  ${B.info}3.${B.reset} ${B.primary}Coding Plan${B.reset} - ${B.muted}国内平台 (阿里云/腾讯云/智谱等), 固定月费${B.reset}`);
    console.log(`  ${B.info}4.${B.reset} ${B.primary}Custom Provider${B.reset} - ${B.muted}Enter your own API endpoint${B.reset}`);
    console.log(`  ${B.info}5.${B.reset} ${B.muted}Skip setup${B.reset} - ${B.muted}Configure later with nova auth set${B.reset}`);
    console.log('');

    try {
      const choice = await askQuestion(`  Select [1-5]: `);
      
      switch (choice) {
        case '1': {
          // Ollama Local
          console.log('');
          console.log(`${B.muted}Checking for Ollama...${B.reset}`);
          const manager = new OllamaManager('http://localhost:11434');
          
          if (await manager.ping()) {
            console.log(`${B.success}✓ Ollama is running!${B.reset}`);
            const models = await manager.listModels();
            
            if (models.length > 0) {
              console.log(`${B.muted}Available models:${B.reset}`);
              for (const m of models.slice(0, 5)) {
                console.log(`  - ${m.name}`);
              }
              
              const defaultModel = models[0].name;
              config.core.defaultModel = defaultModel;
              await this.configManager.save(config);
              
              console.log('');
              console.log(`${B.success}✓ Setup complete!${B.reset}`);
              console.log(`${B.muted}Default model: ${defaultModel}${B.reset}`);
              console.log(`${B.muted}Run 'nova' to start chatting!${B.reset}`);
              rl.close();
              return true;
            } else {
              console.log(`${B.warning}No models installed.${B.reset}`);
              console.log(`${B.muted}Pull a model with: ollama pull llama3.2${B.reset}`);
              console.log(`${B.muted}Then run: nova${B.reset}`);
              rl.close();
              return false;
            }
          } else {
            console.log(`${B.warning}Ollama is not running.${B.reset}`);
            console.log('');
            console.log(`${B.muted}To use local models:${B.reset}`);
            console.log(`  1. Install Ollama: ${B.info}https://ollama.com${B.reset}`);
            console.log(`  2. Start Ollama: ${B.primary}ollama serve${B.reset}`);
            console.log(`  3. Pull a model: ${B.primary}ollama pull llama3.2${B.reset}`);
            console.log(`  4. Run Nova: ${B.primary}nova${B.reset}`);
            console.log('');
            console.log(`${B.muted}Or choose option 2 to use Ollama Cloud instead.${B.reset}`);
            rl.close();
            return false;
          }
          break;
        }
        
        case '2': {
          // Ollama Cloud
          console.log('');
          console.log(`${B.primary}Configure Ollama Cloud${B.reset}`);
          console.log(`${B.muted}Get your API key at: ${B.info}https://ollama.com/settings/keys${B.reset}`);
          console.log('');
          
          const apiKey = await askQuestion(`  Enter API key: `);
          
          if (!apiKey) {
            console.log(`${B.warning}API key is required.${B.reset}`);
            rl.close();
            return false;
          }
          
          // Save credentials
          await this.authManager.setCredentials({
            provider: 'ollama-cloud',
            apiKey,
            baseUrl: 'https://ollama.com',
          });
          
          // Register provider if not exists
          if (!config.models.providers['ollama-cloud']) {
            this.configManager.registerProvider('ollama-cloud', {
              type: 'ollama-cloud',
              baseUrl: 'https://ollama.com',
              models: {
                'glm-5': {
                  name: 'GLM-5',
                  maxContextTokens: 128000,
                  maxOutputTokens: 8192,
                  supportsTools: true,
                  supportsStreaming: true,
                  supportsThinking: true,
                  supportsVision: true,
                },
                'deepseek-v3.2': {
                  name: 'DeepSeek V3.2',
                  maxContextTokens: 131072,
                  maxOutputTokens: 8192,
                  supportsTools: true,
                  supportsStreaming: true,
                  supportsThinking: true,
                  supportsVision: true,
                },
                'qwen3-coder': {
                  name: 'Qwen 3 Coder',
                  maxContextTokens: 131072,
                  maxOutputTokens: 8192,
                  supportsTools: true,
                  supportsStreaming: true,
                  supportsVision: false,
                  supportsThinking: true,
                },
              },
              defaultModel: 'glm-5',
            });
          }
          
          config.core.defaultModel = 'ollama-cloud/glm-5';
          await this.configManager.save(config);
          
          console.log('');
          console.log(`${B.success}✓ Setup complete!${B.reset}`);
          console.log(`${B.muted}Default model: glm-5${B.reset}`);
          console.log(`${B.muted}Run 'nova' to start chatting!${B.reset}`);
          rl.close();
          return true;
        }
        
        case '3': {
          // Coding Plan (国内平台)
          console.log('');
          await this.handleCodingPlanCommand({ ...{} as any, command: 'coding-plan', subcommand: 'list' });
          console.log('');
          
          const platform = await askQuestion(`  Enter platform name (e.g., alibaba, tencent, zhipu): `);
          
          if (!platform) {
            console.log(`${B.warning}Platform name is required.${B.reset}`);
            rl.close();
            return false;
          }
          
          const validPlatforms = ['alibaba', 'tencent', 'volcengine', 'baidu', 'kimi', 'zhipu', 'minimax'];
          if (!validPlatforms.includes(platform)) {
            console.log(`${B.warning}Invalid platform. Valid: ${validPlatforms.join(', ')}${B.reset}`);
            rl.close();
            return false;
          }
          
          const apiKey = await askQuestion(`  Enter API key: `);
          
          if (!apiKey) {
            console.log(`${B.warning}API key is required.${B.reset}`);
            rl.close();
            return false;
          }
          
          // Use existing coding-plan add logic
          await this.handleCodingPlanCommand({
            ...{} as any,
            command: 'coding-plan',
            subcommand: 'add',
            provider: platform,
            apiKey,
          });
          
          rl.close();
          return true;
        }
        
        case '4': {
          // Custom Provider
          console.log('');
          console.log(`${B.primary}Configure Custom Provider${B.reset}`);
          console.log('');
          
          const baseUrl = await askQuestion(`  Base URL (e.g., https://api.example.com/v1): `);
          
          if (!baseUrl) {
            console.log(`${B.warning}Base URL is required.${B.reset}`);
            rl.close();
            return false;
          }
          
          const apiKey = await askQuestion(`  API key (press Enter if not required): `);
          const modelName = await askQuestion(`  Default model name (press Enter for 'default'): `);
          
          // Use existing provider add logic
          await this.handleProviderCommand({
            ...{} as any,
            command: 'provider',
            subcommand: 'add',
            baseUrl,
            apiKey: apiKey || 'no-key-required',
            defaultModel: modelName || 'default',
          });
          
          rl.close();
          return true;
        }
        
        case '5': {
          // Skip
          console.log('');
          console.log(`${B.muted}Setup skipped.${B.reset}`);
          console.log('');
          console.log(`${B.muted}To configure later:${B.reset}`);
          console.log(`  ${B.info}nova auth set <provider> --key <api-key>${B.reset}`);
          console.log(`  ${B.info}nova model list${B.reset}  ${B.muted}- see available models${B.reset}`);
          console.log(`  ${B.info}nova --help${B.reset}     ${B.muted}- show all commands${B.reset}`);
          rl.close();
          return false;
        }
        
        default: {
          console.log(`${B.warning}Invalid choice. Run 'nova' again to restart setup.${B.reset}`);
          rl.close();
          return false;
        }
      }
    } catch (err) {
      rl.close();
      return false;
    }
  }

  /** Interactive picker: list recent sessions for -r / --resume */
  private async pickSessionInteractive(): Promise<SessionId | undefined> {
    const sessions = this.sessionManager.listPersistedSessions(20);
    if (sessions.length === 0) {
      console.log('\x1b[33m  No previous sessions found.\x1b[0m');
      return undefined;
    }

    console.log('\n\x1b[1m  Recent Sessions\x1b[0m\n');
    sessions.forEach((s, idx) => {
      const date = new Date(s.updatedAt).toLocaleString();
      const id = s.id.slice(0, 8);
      const turns = s.turnCount;
      const tokens = (s.totalInputTokens + s.totalOutputTokens).toLocaleString();
      const title = (s.title || 'New session').slice(0, 60);
      const model = s.config.model?.split('/').pop() || '';
      console.log(
        `  \x1b[36m${String(idx + 1).padStart(2)}.\x1b[0m ${title}\n` +
        `      \x1b[90m${id}  ${date}  ${turns} turns  ${tokens} tok  ${model}\x1b[0m`
      );
    });
    console.log('');

    const readline = await import('node:readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    return new Promise((resolve) => {
      rl.question('  Select session (1-' + sessions.length + ', or Enter to start fresh): ', (answer) => {
        rl.close();
        const n = parseInt(answer.trim(), 10);
        if (!isNaN(n) && n >= 1 && n <= sessions.length) {
          const selected = sessions[n - 1];
          const session = this.sessionManager.loadFromDisk(selected.id);
          if (session) {
            console.log(`\x1b[36m  Restoring session: ${selected.id.slice(0, 8)} — ${selected.title}\x1b[0m`);
            resolve(session.id);
          } else {
            console.log('\x1b[33m  Could not load session. Starting fresh.\x1b[0m');
            resolve(undefined);
          }
        } else {
          resolve(undefined);
        }
      });
    });
  }
}

// Entry point
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  const app = new NovaApp();
  app.run().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
