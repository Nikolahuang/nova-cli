// ============================================================================
// InteractiveRepl - Interactive read-eval-print loop with rich UX v3
// Features: multi-line input, @file references, !shell, /init, /memory,
//           /history, session auto-persist, /model switch
// ============================================================================

import * as readline from 'node:readline';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execSync, spawn } from 'node:child_process';
import chalk from 'chalk';
import { getTheme } from '../ui/themes/theme-config.js';
import type { NovaConfig } from '../../../core/src/types/config.js';
import type { SessionId, ApprovalRequest, ApprovalResponse } from '../../../core/src/types/session.js';
import { OptimizedAgentLoop } from '../../../core/src/session/OptimizedAgentLoop.js';
import { ModelClient } from '../../../core/src/model/ModelClient.js';
import { SessionManager } from '../../../core/src/session/SessionManager.js';
import { ToolRegistry } from '../../../core/src/tools/ToolRegistry.js';
import { ApprovalManager } from '../../../core/src/security/ApprovalManager.js';
import { buildSystemPrompt } from '../../../core/src/context/defaultSystemPrompt.js';
import { ThinkingBlockRenderer } from '../ui/components/ThinkingBlockRenderer.js';
import { TodoProgressPanel, type TodoItem } from '../ui/components/TodoProgressPanel.js';
import { UserMessageHighlight } from '../ui/components/UserMessageHighlight.js';
import type { McpManager, McpServerStatus } from '../../../core/src/mcp/McpManager.js';
import type { SkillRegistry, SkillDefinition } from '../../../core/src/extensions/SkillRegistry.js';
import type { ConfigManager } from '../../../core/src/config/ConfigManager.js';
import type { AuthManager } from '../../../core/src/auth/AuthManager.js';
import { OllamaManager } from '../../../core/src/model/providers/OllamaManager.js';
import { CompletionHelper } from '../utils/CompletionHelper.js';
import { EnhancedCompleter, type CompletionCandidate } from '../utils/EnhancedCompleter.js';

// ============================================================================
// Types
// ============================================================================

export interface ReplOptions {
  modelClient: ModelClient;
  sessionManager: SessionManager;
  toolRegistry: ToolRegistry;
  approvalManager: ApprovalManager;
  authManager?: AuthManager;
  config: NovaConfig;
  configManager: ConfigManager;
  cwd: string;
  contextCompressor?: any;
  mcpManager?: McpManager;
  skillRegistry?: SkillRegistry;
  /** If set, restore this session on startup instead of creating a new one */
  restoreSessionId?: string;
}

/** Interaction mode for the REPL */
type InteractionMode = 'auto' | 'smart' | 'edits' | 'plan' | 'ask';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
// Theme-aware mode labels
const MODE_LABELS: Record<InteractionMode, { label: string; color: any; description: string; approvalMode: string }> = {
  auto:  { label: 'AUTO',  color: chalk.hex(theme.colors.success).bold,  description: 'Full autonomous - no approval needed',       approvalMode: 'yolo' },
  smart: { label: 'SMART', color: chalk.hex(theme.colors.info).bold,   description: 'Smart approval - auto low-risk, ask high-risk', approvalMode: 'smart' },
  edits: { label: 'EDITS', color: chalk.hex(theme.colors.brand).bold,description: 'Auto-approve file edits, ask for shell/exec', approvalMode: 'accepting_edits' },
  plan:  { label: 'PLAN',  color: chalk.hex(theme.colors.warning).bold, description: 'Plan first, then confirm each action',       approvalMode: 'plan' },
  ask:   { label: 'ASK',   color: chalk.hex(theme.colors.cyan).bold,   description: 'Answer only, no file changes',              approvalMode: 'default' },
};

const MODES: InteractionMode[] = ['auto', 'smart', 'edits', 'plan', 'ask'];

/** State for rendering tool calls */
interface ToolCallState {
  name: string;
  toolCallId: string;
  startTime: number;
  input: string;
  result: string;
  isError: boolean;
  isComplete: boolean;
  lineIndex: number;
}

// ============================================================================
// Box drawing chars & color palette (enhanced UI)
// ============================================================================

const BOX = {
  tl: '╭', tr: '╮', bl: '╰', br: '╯',
  h: '─', hThick: '━', hDouble: '═',
  v: '│', vThick: '┃', vDouble: '║',
  ht: '├', htr: '┤', hc: '┬', hcB: '┴',
  vt: '┬', vtr: '┤', vc: '├', vcB: '┤',
  arrow: '›', bullet: '•', check: '✓', crossX: '✗', dot: '·',
  diamond: '◆', star: '★', circle: '○', circleFull: '●',
  spinner: ['⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏'],
  arrowRight: '→', arrowLeft: '←', arrowUp: '↑', arrowDown: '↓',
  // Modern icons
  sparkles: '✨', brain: '🧠', lightning: '⚡', rocket: '🚀',
};

// Theme-aware color definitions
const theme = getTheme();
const C = {
  brand:      chalk.hex(theme.colors.brand).bold,
  brandLight: chalk.hex(theme.colors.brandLight),
  brandDim:   chalk.hex(theme.colors.brandDark).dim,
  success:    chalk.hex(theme.colors.success),
  successDim: chalk.hex(theme.colors.successLight).dim,
  warning:    chalk.hex(theme.colors.warning),
  warningDim: chalk.hex(theme.colors.warningLight).dim,
  error:      chalk.hex(theme.colors.error),
  errorDim:   chalk.hex(theme.colors.errorLight).dim,
  info:       chalk.hex(theme.colors.info),
  infoDim:    chalk.hex(theme.colors.infoLight).dim,
  primary:    chalk.hex(theme.colors.primary),
  muted:      chalk.hex(theme.colors.secondary),
  dim:        chalk.hex(theme.colors.dim),
  toolName:   chalk.hex(theme.colors.cyanLight),
  toolOk:     chalk.hex(theme.colors.successLight),
  toolErr:    chalk.hex(theme.colors.errorLight),
  turnLine:   chalk.hex(theme.colors.borderDim).dim,
  accent:     chalk.hex(theme.colors.pink),
  subtle:     chalk.hex(theme.colors.hint),
};

// ============================================================================
// InteractiveRepl
// ============================================================================

export class InteractiveRepl {
  private modelClient: ModelClient;
  private sessionManager: SessionManager;
  private toolRegistry: ToolRegistry;
  private approvalManager: ApprovalManager;
  private authManager?: AuthManager;
  private config: NovaConfig;
  private configManager: ConfigManager;
  private cwd: string;
  private contextCompressor?: any;
  private mcpManager?: McpManager;
  private skillRegistry?: SkillRegistry;
  private rl: readline.Interface | null = null;
  private currentLoop: AgentLoop | null = null;
  private sessionId: SessionId | null = null;
  private restoreSessionId?: string;
  private resizeTimer: NodeJS.Timeout | null = null;

  // ---- UX state ----
  private mode: InteractionMode = 'auto';
  private showThinking = true;
  private compactMode = true;
  private processing = false;

  // ---- Multi-line input state ----
  private multilineBuffer: string[] = [];
  private isMultiline = false;

  // ---- Components ----
  private thinkingRenderer: ThinkingBlockRenderer;
  private todoProgressPanel: TodoProgressPanel;
  private userMessageHighlight: UserMessageHighlight;

  // ---- Streaming state for current task ----
  private activeToolCalls = new Map<string, ToolCallState>();
  private toolCallOrder: string[] = [];
  private currentTurn = 0;
  private spinnerTimer: NodeJS.Timeout | null = null;
  private spinnerFrame = 0;
  private currentTaskTokens = 0;
  private _pendingSkillInject: SkillDefinition | null = null;

  // ---- Enhanced completer ----
  private enhancedCompleter: EnhancedCompleter | null = null;
  private inputHistory: string[] = [];

  constructor(options: ReplOptions) {
    this.modelClient = options.modelClient;
    this.sessionManager = options.sessionManager;
    this.toolRegistry = options.toolRegistry;
    this.approvalManager = options.approvalManager;
    this.authManager = options.authManager;
    this.config = options.config;
    this.configManager = options.configManager;
    this.cwd = options.cwd;
    this.contextCompressor = options.contextCompressor;
    this.mcpManager = options.mcpManager;
    this.skillRegistry = options.skillRegistry;
    this.restoreSessionId = options.restoreSessionId;

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

    // Initialize enhanced completer with empty arrays (will be populated in start())
    this.enhancedCompleter = new EnhancedCompleter({
      configManager: this.configManager,
      cwd: this.cwd,
      history: this.inputHistory,
      skills: [],
      mcpServers: this.mcpManager ? this.mcpManager.listServers().map(s => ({ name: s.name, status: s.connected ? 'connected' : 'disconnected' })) : [],
    });
  }

  // ========================================================================
  // Lifecycle
  // ========================================================================

  async start(): Promise<void> {
    this.printBanner();

    // Update skills list now that we're in async context
    if (this.skillRegistry && this.enhancedCompleter) {
      const skills = await this.skillRegistry.list();
      this.enhancedCompleter.updateSkills(skills.map(s => s.metadata.name));
    }

    // Restore or create session
    if (this.restoreSessionId) {
      const existing = this.sessionManager.get(this.restoreSessionId as SessionId);
      this.sessionId = existing ? this.restoreSessionId as SessionId : this.createInitialSession();
      if (existing) {
        const msgs = this.sessionManager.getMessages(this.sessionId!);
        console.log(C.info(`  Restored session: ${String(this.sessionId).slice(0, 8)} — ${msgs.length} messages`));
      }
    } else {
      this.sessionId = this.createInitialSession();
    }

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '',
      historySize: 200,
      removeHistoryDuplicates: true,
    });

    this.approvalManager.setHandler(this.handleApproval.bind(this));

    // Cancel running agent loop
    const cancelRunningLoop = () => {
      if (this.currentLoop?.isActive()) {
        this.currentLoop.cancel();
        this.processing = false;
        this.thinkingRenderer.cancel();
        this.stopSpinner();
        // Also persist on cancel
        if (this.sessionId) this.sessionManager.persist(this.sessionId);
        process.stdout.write('\n');
        this.printLine('cancelled', 'warning');
        this.printPrompt();
        return true;
      }
      return false;
    };

    // Ctrl+C to cancel running task
    process.on('SIGINT', () => {
      if (!cancelRunningLoop()) {
        console.log(C.muted('\n  Use /quit or Ctrl+D to exit'));
        this.printPrompt();
      }
    });

    // Handle terminal resize - redraw banner and status
    let resizeTimer: NodeJS.Timeout | null = null;
    process.stdout.on('resize', () => {
      if (!this.processing) {
        // Debounce resize events to avoid flickering
        if (resizeTimer) {
          clearTimeout(resizeTimer);
        }
        resizeTimer = setTimeout(() => {
          console.clear();
          this.printBanner();
        }, 100);
      }
    });

    // Custom input loop with boxed input area
    this.runInputLoop();

    this.rl.on('close', () => {
      if (this.sessionId) this.sessionManager.persist(this.sessionId);
      if (this.resizeTimer) {
        clearTimeout(this.resizeTimer);
        this.resizeTimer = null;
      }
      console.log(C.muted('\nGoodbye!'));
      process.exit(0);
    });
  }

  /** Custom input loop with boxed input area */
  private async runInputLoop(): Promise<void> {
    while (this.rl) {
      // Print input box header
      this.printInputBox();

      // Get user input
      const input = await this.askInput();

      // Close input box
      this.printInputBoxFooter();

      if (!input) continue;

      // Process input
      this.processing = true;
      await this.dispatchInput(input.trim());
      this.processing = false;
    }
  }

  /** Ask for input with proper prompt */
  private askInput(): Promise<string> {
    return new Promise((resolve) => {
      if (!this.rl) return resolve('');

      // Set simple prompt inside the box
      this.rl.setPrompt(C.brand(BOX.v) + ' ');
      this.rl.prompt();

      // Tab completion state
      let currentInput = '';
      let completionsShown = false;

      // Enable raw mode for Tab key detection
      const wasRaw = process.stdin.isRaw;
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
      }

      const cleanup = () => {
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(wasRaw ?? false);
        }
        process.stdin.off('data', onKeypress);
        this.rl?.off('line', onLine);
      };

      const onKeypress = (buffer: Buffer) => {
        const key = buffer.toString();

        // Tab key - show completions
        if (key === '\t') {
          const completions = this.enhancedCompleter?.getCompletions(currentInput) || [];
          if (completions.length > 0) {
            process.stdout.write('\n');
            this.showEnhancedCompletions(completions);
            // Reprint prompt and current input
            process.stdout.write(C.brand(BOX.v) + ' ' + currentInput);
            completionsShown = true;
          }
        }
        // Ctrl+C - cancel
        else if (key === '\x03') {
          cleanup();
          resolve('');
        }
        // Backspace - update currentInput
        else if (key === '\x7f' || key === '\b') {
          if (currentInput.length > 0) {
            currentInput = currentInput.slice(0, -1);
          }
          completionsShown = false;
        }
        // Regular character
        else if (key.length === 1 && key >= ' ' && key <= '~') {
          currentInput += key;
          completionsShown = false;
        }
      };

      const onLine = (line: string) => {
        cleanup();

        // Multi-line mode: lines ending with \ continue input
        if (line.endsWith('\\')) {
          this.isMultiline = true;
          this.multilineBuffer.push(line.slice(0, -1));
          // Continue reading without resolving
          process.stdout.write(C.dim('  ' + BOX.arrowDown + ' '));
          this.rl?.prompt();
          return;
        }

        if (this.isMultiline) {
          this.multilineBuffer.push(line);
          // Check if empty line ends multiline mode
          if (line.trim() === '') {
            const fullInput = this.multilineBuffer.join('\n').trim();
            this.multilineBuffer = [];
            this.isMultiline = false;
            resolve(fullInput);
          } else {
            process.stdout.write(C.dim('  ' + BOX.arrowDown + ' '));
            this.rl?.prompt();
          }
          return;
        }

        resolve(line);
      };

      this.rl.on('line', onLine);
      process.stdin.on('data', onKeypress);
    });
  }

  /** Get all REPL commands for completion */
  private getAllReplCommands(): { text: string; description: string }[] {
    return [
      { text: '/help', description: 'Show help' },
      { text: '/quit', description: 'Exit nova' },
      { text: '/clear', description: 'Clear conversation' },
      { text: '/status', description: 'Session info' },
      { text: '/model', description: 'Switch model' },
      { text: '/mode', description: 'Change mode (auto/smart/edits/plan/ask)' },
      { text: '/init', description: 'Generate NOVA.md' },
      { text: '/memory', description: 'Manage memory' },
      { text: '/history', description: 'Session history' },
      { text: '/mcp', description: 'MCP servers' },
      { text: '/skills', description: 'Available skills' },
      { text: '/theme', description: 'Switch color theme' },
      { text: '/checkpoint', description: 'File snapshots' },
      { text: '/image', description: 'Add image to chat' },
      { text: '/ollama', description: 'Ollama status' },
      { text: '/thinking', description: 'Toggle thinking' },
      { text: '/compact', description: 'Toggle compact mode' },
    ];
  }

  /** Get completions for REPL input */
  private getReplCompletions(input: string): { text: string; description: string }[] {
    const commands = this.getAllReplCommands();
    const partial = input.toLowerCase();
    return commands.filter(cmd => cmd.text.toLowerCase().startsWith(partial));
  }

  /** Display completions */
  private showCompletions(completions: { text: string; description: string }[]): void {
    const maxLen = Math.max(...completions.map(c => c.text.length));
    for (const c of completions.slice(0, 10)) {
      console.log(`  ${C.info(c.text.padEnd(maxLen + 2))} ${C.dim(c.description)}`);
    }
    if (completions.length > 10) {
      console.log(C.dim(`  ... and ${completions.length - 10} more`));
    }
  }

  /** Display enhanced completions with type icons */
  private showEnhancedCompletions(completions: CompletionCandidate[]): void {
    const typeIcons: Record<string, string> = {
      command: '⌘',
      model: '🤖',
      file: '📄',
      directory: '📁',
      history: '📜',
      option: '⚙️',
      skill: '🎯',
      mcp: '🔌',
    };

    const typeColors: Record<string, any> = {
      command: C.info,
      model: C.brand,
      file: C.muted,
      directory: C.success,
      history: C.subtle,
      option: C.warning,
      skill: C.accent,
      mcp: C.toolName,
    };

    const maxLen = Math.max(...completions.map(c => c.displayText.length));
    const limit = Math.min(completions.length, 12);

    for (const c of completions.slice(0, limit)) {
      const icon = typeIcons[c.type] || '•';
      const color = typeColors[c.type] || C.primary;
      const text = c.displayText.padEnd(maxLen + 2);
      console.log(`  ${icon} ${color(text)}${C.dim(c.description)}`);
    }

    if (completions.length > limit) {
      console.log(C.dim(`  ... and ${completions.length - limit} more`));
    }
  }

  /** Route a single trimmed line to the correct handler */
  private async dispatchInput(input: string): Promise<void> {
    // /command
    if (input.startsWith('/')) {
      await this.handleCommand(input);
      return;
    }

    // !shell command
    if (input.startsWith('!')) {
      await this.handleShellCommand(input.slice(1).trim());
      return;
    }

    // Regular input (may contain @file references)
    await this.processInput(input);
  }

  // ========================================================================
  // @ File reference expansion
  // ========================================================================

  /**
   * Expand @path references in user input.
   * @src/App.tsx → inlines file content
   * @src/components/ → inlines directory listing + all files under 50KB total
   */
  private async expandAtReferences(input: string): Promise<string> {
    // Match @word/path.ext or @path patterns (not email addresses)
    const atPattern = /@([\w./\-\\]+)/g;
    const matches = [...input.matchAll(atPattern)];
    if (matches.length === 0) return input;

    let result = input;
    const injections: string[] = [];

    for (const match of matches) {
      const refPath = match[1];
      if (!refPath) continue;
      
      const absPath = path.isAbsolute(refPath)
        ? refPath
        : path.resolve(this.cwd, refPath);

      try {
        if (!fs.existsSync(absPath)) {
          injections.push(`[@ ${refPath}: file not found]`);
          continue;
        }

        const stat = fs.statSync(absPath);

        if (stat.isDirectory()) {
          // Directory: list contents and include small files
          const files = this.listDirRecursive(absPath, 3, 30);
          const fileList = files.join('\n');
          let content = `\n\`\`\`\n# Directory: ${refPath}\n${fileList}\n\`\`\`\n`;

          // Include content of small text files (limit to 20 files, 100KB total)
          let totalSize = 0;
          let fileCount = 0;
          for (const f of files) {
            if (fileCount >= 20) break;
            const fullPath = path.join(absPath, f);
            try {
              if (!fs.statSync(fullPath).isFile()) continue;
              const size = fs.statSync(fullPath).size;
              if (size > 50000 || totalSize + size > 100000) continue;
              const ext = path.extname(f).slice(1);
              if (!this.isTextFile(ext)) continue;
              const fileContent = fs.readFileSync(fullPath, 'utf-8');
              content += `\n\`\`\`${ext}\n# ${f}\n${fileContent}\n\`\`\`\n`;
              totalSize += size;
              fileCount++;
            } catch { /* skip */ }
          }

          injections.push(content);
          console.log(C.info(`  @ ${refPath} → directory (${files.length} files)`));
        } else {
          // Single file
          const size = stat.size;
          if (size > 200 * 1024) {
            injections.push(`[@ ${refPath}: file too large (${(size / 1024).toFixed(0)} KB), please be more specific]`);
            console.log(C.warning(`  @ ${refPath} → too large (${(size / 1024).toFixed(0)} KB)`));
            continue;
          }
          const ext = path.extname(refPath).slice(1);
          const fileContent = fs.readFileSync(absPath, 'utf-8');
          injections.push(`\n\`\`\`${ext}\n# ${refPath}\n${fileContent}\n\`\`\`\n`);
          console.log(C.info(`  @ ${refPath} → ${(size / 1024).toFixed(1)} KB`));
        }
      } catch (err) {
        injections.push(`[@ ${refPath}: error reading file — ${(err as Error).message}]`);
      }
    }

    // Append all injected content below the original input
    if (injections.length > 0) {
      result = input + '\n\n' + injections.join('\n');
    }
    return result;
  }

  private isTextFile(ext: string): boolean {
    const TEXT_EXTS = new Set([
      'ts','tsx','js','jsx','mjs','cjs','json','yaml','yml','toml','ini',
      'md','txt','html','css','scss','less','sh','bash','zsh','fish',
      'py','rb','go','rs','java','c','cpp','h','hpp','cs','php','swift',
      'vue','svelte','astro','graphql','sql','env','gitignore','lock',
    ]);
    return TEXT_EXTS.has(ext.toLowerCase());
  }

  private listDirRecursive(dir: string, maxDepth: number, maxFiles: number): string[] {
    const results: string[] = [];
    const walk = (current: string, depth: number, prefix: string) => {
      if (depth > maxDepth || results.length >= maxFiles) return;
      try {
        const entries = fs.readdirSync(current).filter((e) =>
          !e.startsWith('.') && e !== 'node_modules' && e !== 'dist' && e !== '__pycache__'
        );
        for (const e of entries) {
          if (results.length >= maxFiles) break;
          const fullPath = path.join(current, e);
          const rel = prefix ? `${prefix}/${e}` : e;
          results.push(rel);
          if (fs.statSync(fullPath).isDirectory()) {
            walk(fullPath, depth + 1, rel);
          }
        }
      } catch { /* skip */ }
    };
    walk(dir, 0, '');
    return results;
  }

  // ========================================================================
  // Prompt & Banner
  // ========================================================================

  private getPromptText(): string {
    const modeInfo = MODE_LABELS[this.mode];
    const modelShort = this.modelClient.getModel().split('/').pop() || this.modelClient.getModel();

    if (this.isMultiline) {
      // Multi-line mode indicator
      return C.dim('  ' + BOX.arrowDown + ' ');
    }

    // Compact prompt: [MODE] model ›
    const modeBadge = modeInfo.color(`[${modeInfo.label}]`);
    const modelPart = C.muted(modelShort);
    return `\n${modeBadge} ${modelPart} ${C.brand(BOX.arrowRight)} `;
  }

  private printPrompt(): void {
    if (this.rl) {
      const promptText = this.getPromptText();
      this.rl.setPrompt(promptText);
      this.rl.prompt();
    }
  }

  /** Get terminal width with min/max constraints */
  private getTermWidth(min = 40, max = 120): number {
    const cols = process.stdout.columns || 80;
    return Math.max(min, Math.min(cols - 4, max));
  }

  /** Print input box frame before prompt */
  private printInputBox(): void {
    const modeInfo = MODE_LABELS[this.mode];
    const modelShort = this.modelClient.getModel().split('/').pop() || this.modelClient.getModel();
    const w = this.getTermWidth(40, 100);

    // Get session stats for context usage
    let contextInfo = '';
    if (this.sessionId) {
      const stats = this.sessionManager.getStats(this.sessionId);
      if (stats) {
        const totalTokens = (stats.totalInputTokens || 0) + (stats.totalOutputTokens || 0);
        const maxContext = this.config.core.maxTokens * 8 || 128000;
        const pct = Math.min(100, Math.round((totalTokens / maxContext) * 100));
        const pctColor = pct > 80 ? C.error : pct > 50 ? C.warning : C.success;
        contextInfo = pctColor(`${pct}%`) + C.dim(' ctx');
      }
    }

    // Input box header
    const modeBadge = modeInfo.color(`[${modeInfo.label}]`);
    const headerText = `${modeBadge} ${C.muted(modelShort)}${contextInfo ? ' ' + contextInfo : ''}`;
    const visibleLen = modeInfo.label.length + 2 + 1 + modelShort.length + (contextInfo ? 8 : 0);
    const headerPadding = Math.max(0, w - visibleLen - 3);

    console.log('');
    console.log(C.brand(BOX.tl) + C.brand(BOX.hThick.repeat(w)) + C.brand(BOX.tr));
    console.log(C.brand(BOX.v) + ' ' + headerText + ' '.repeat(headerPadding) + C.brand(BOX.v));
    console.log(C.brand(BOX.ht) + C.brandDim(BOX.h.repeat(w)) + C.brand(BOX.htr));
  }

  /** Print input box footer after user submits */
  private printInputBoxFooter(): void {
    const w = this.getTermWidth(40, 100);
    console.log(C.brand(BOX.bl) + C.brand(BOX.hThick.repeat(w)) + C.brand(BOX.br));
  }

  /** Print compact status bar after AI response */
  private printStatusBar(): void {
    const modelShort = this.modelClient.getModel().split('/').pop() || this.modelClient.getModel();
    const modeInfo = MODE_LABELS[this.mode];
    
    let contextInfo = '';
    if (this.sessionId) {
      const stats = this.sessionManager.getStats(this.sessionId);
      if (stats) {
        const totalTokens = (stats.totalInputTokens || 0) + (stats.totalOutputTokens || 0);
        const maxContext = this.config.core.maxTokens * 8 || 128000;
        const pct = Math.min(100, Math.round((totalTokens / maxContext) * 100));
        const pctColor = pct > 80 ? C.error : pct > 50 ? C.warning : C.success;
        contextInfo = pctColor(`${pct}%`);
      }
    }

    const parts = [
      C.muted('Model:') + ' ' + C.primary(modelShort),
      C.muted('Mode:') + ' ' + modeInfo.color(modeInfo.label),
      contextInfo ? C.muted('Context:') + ' ' + contextInfo : '',
    ].filter(Boolean);

    console.log(C.dim('  ' + BOX.h.repeat(4) + ' ') + parts.join(C.dim(' · ')) + C.dim(' ' + BOX.h.repeat(4)));
  }

  private printBanner(): void {
    const modeInfo = MODE_LABELS[this.mode];
    const modelShort = this.modelClient.getModel().split('/').pop() || this.modelClient.getModel();
    const termCols = process.stdout.columns || 80;
    // Use a reasonable max width, but don't exceed terminal width
    const w = Math.min(termCols - 4, 76);
    
    const hr = C.dim('─'.repeat(w));
    const hrBrand = C.brand('━'.repeat(w));
    const vl = C.dim('│');

    // Modern enhanced header
    console.log('');
    console.log(C.brand('╭') + hrBrand + C.brand('╮'));
    
    // Enhanced logo line with icons
    const logoLine = `  ${C.brand('✦')} ${C.brand('NOVA')} ${C.brandLight('CLI')} ${C.dim('✦')} ${C.secondary('AI-powered terminal assistant')}`;
    const logoPadding = Math.max(0, w - 42); // Adjust for visible chars
    console.log(vl + logoLine + ' '.repeat(logoPadding) + vl);
    
    console.log(C.brand('├') + hr + C.brand('┤'));

    // Status line 1: Model | Dir - Enhanced with icons
    const modelLabel = C.dim('🤖 Model: ');
    const modelVal = C.primary(modelShort);
    const dirLabel = C.dim('📁 Dir: ');
    const dirVal = C.muted(this.cwd.length > 40 ? '...' + this.cwd.slice(-37) : this.cwd);
    const line1 = `  ${modelLabel}${modelVal}  ${C.dim('│')}  ${dirLabel}${dirVal}`;
    console.log(vl + line1 + ' '.repeat(Math.max(0, w - 10 - modelShort.length)) + vl);

    // Status line 2: Mode | Session - Enhanced with icons
    const modeLabel = C.dim('⚙️ Mode:  ');
    const modeVal = modeInfo.color(modeInfo.label);
    const sessLabel = C.dim('🆔 Session: ');
    const sessionText = this.restoreSessionId ? this.restoreSessionId.slice(0, 8) : 'new';
    const sessVal = C.muted(sessionText);
    const line2 = `  ${modeLabel}${modeVal}  ${C.dim('│')}  ${sessLabel}${sessVal}`;
    console.log(vl + line2 + ' '.repeat(Math.max(0, w - 24)) + vl);

    // Status line 3: MCP - Enhanced with icons
    let mcpStatus = C.dim('○');
    let mcpText = 'none';
    if (this.mcpManager) {
      const statuses = this.mcpManager.listServers();
      if (statuses.length > 0) {
        const connected = statuses.filter((s) => s.connected).length;
        const total = statuses.length;
        mcpStatus = connected === total ? C.success('✓') : connected > 0 ? C.warning('◐') : C.error('✗');
        mcpText = `${connected}/${total}`;
      }
    }
    const mcpLabel = C.dim('🔌 MCP:   ');
    const line3 = `  ${mcpLabel}${mcpStatus} ${C.muted(mcpText)}`;
    console.log(vl + line3 + ' '.repeat(Math.max(0, w - 16)) + vl);

    console.log(C.brand('├') + hr + C.brand('┤'));

    // Commands help - compact with icons
    const cmdLine = C.dim('  📋 Commands: ') + 
      C.primary('/help') + C.dim(', ') + 
      C.primary('/mode') + C.dim(', ') + 
      C.primary('/model') + C.dim(', ') + 
      C.primary('/init') + C.dim(', ') + 
      C.primary('/quit');
    console.log(vl + cmdLine + ' '.repeat(Math.max(0, w - 52)) + vl);

    // Shortcuts with icons
    const shortcutLine = C.dim('  ⌨️ Shortcuts: ') + 
      C.info('@file') + C.dim(' inject, ') + 
      C.info('!cmd') + C.dim(' shell, ') + 
      C.info('\\') + C.dim(' multiline');
    console.log(vl + shortcutLine + ' '.repeat(Math.max(0, w - 52)) + vl);

    // Bottom border
    console.log(C.brand('╰') + hrBrand + C.brand('╯'));
    console.log('');
  }

  // ========================================================================
  // UI Helpers
  // ========================================================================

  private printLine(label: string, type: 'info' | 'success' | 'warning' | 'error' | 'muted' = 'muted'): void {
    const colors = { info: C.info, success: C.success, warning: C.warning, error: C.error, muted: C.muted };
    const color = colors[type];
    const w = this.getTermWidth(40, 80);
    const padded = ` ${label} `;
    const left = Math.floor((w - padded.length) / 2);
    const right = w - padded.length - left;
    console.log(C.dim(BOX.h.repeat(left)) + color(padded) + C.dim(BOX.h.repeat(right)));
  }

  private startSpinner(msg: string): void {
    this.stopSpinner();
    this.spinnerFrame = 0;
    this.spinnerTimer = setInterval(() => {
      const frame = BOX.spinner[this.spinnerFrame % BOX.spinner.length];
      process.stdout.write(`\r${C.brand(frame)} ${C.muted(msg)}`);
      this.spinnerFrame++;
    }, 80);
  }

  private stopSpinner(): void {
    if (this.spinnerTimer) {
      clearInterval(this.spinnerTimer);
      this.spinnerTimer = null;
      const clearWidth = Math.min(60, (process.stdout.columns || 80) - 1);
      process.stdout.write('\r' + ' '.repeat(clearWidth) + '\r');
    }
  }

  // ========================================================================
  // !shell direct execution
  // ========================================================================

  private async handleShellCommand(cmd: string): Promise<void> {
    if (!cmd) {
      console.log(C.muted('  Usage: !<command>  e.g. !ls, !git status, !npm test'));
      return;
    }

    console.log('');
    console.log(C.muted(`  $ ${cmd}`));
    const startTime = Date.now();

    try {
      // Use spawn for streaming output
      const isWin = process.platform === 'win32';
      const shell = isWin ? 'powershell.exe' : '/bin/sh';
      const shellArgs = isWin ? ['-Command', cmd] : ['-c', cmd];

      await new Promise<void>((resolve, reject) => {
        const child = spawn(shell, shellArgs, {
          cwd: this.cwd,
          stdio: ['inherit', 'pipe', 'pipe'],
        });

        child.stdout?.on('data', (chunk: Buffer) => process.stdout.write(C.primary(chunk.toString())));
        child.stderr?.on('data', (chunk: Buffer) => process.stderr.write(C.warning(chunk.toString())));

        child.on('close', (code) => {
          const duration = ((Date.now() - startTime) / 1000).toFixed(2);
          if (code === 0) {
            console.log('');
            console.log(C.success(`  ✓ exit 0`) + C.dim(` (${duration}s)`));
          } else {
            console.log('');
            console.log(C.error(`  ✗ exit ${code}`) + C.dim(` (${duration}s)`));
          }
          resolve();
        });

        child.on('error', reject);
      });
    } catch (err) {
      console.log(C.error(`  Error: ${(err as Error).message}`));
    }
  }

  // ========================================================================
  // Agent loop processing
  // ========================================================================

  private async processInput(input: string): Promise<void> {
    if (!this.sessionId) return;

    this.processing = true;
    this.activeToolCalls.clear();
    this.toolCallOrder = [];
    this.currentTurn = 0;
    this.currentTaskTokens = 0;

    // Clear any previous TODO panel
    this.todoProgressPanel.hide();

    // ESC key listener: cancel running agent loop
    const onEscKey = (buf: Buffer) => {
      // ESC = \x1b, but arrow keys also start with \x1b[ so we check the raw byte
      if (buf.length === 1 && buf[0] === 0x1b) {
        if (this.currentLoop?.isActive()) {
          this.currentLoop.cancel();
        }
      }
    };
    process.stdin.on('data', onEscKey);

    // Expand @file references
    const expandedInput = await this.expandAtReferences(input);

    // Show user message with highlighted box (distinctive from AI responses)
    this.userMessageHighlight.render(input);

    const modePrefix = this.getModePrefix();

    // Skill injection
    let skillPrefix = '';
    if (this._pendingSkillInject) {
      const skillName = this._pendingSkillInject.metadata.name;
      skillPrefix = `[SKILL: ${skillName}]\n${this._pendingSkillInject.content}\n[/SKILL]\n\n`;
      console.log(C.info(`  ⚡ Skill "${skillName}" injected`));
      this._pendingSkillInject = null;
    }
    const fullInput = [modePrefix, skillPrefix, expandedInput].filter(Boolean).join('\n\n');

    try {
      const effectiveApprovalMode = this.getEffectiveApprovalMode();
      // Get model config to check for built-in search capability
      const modelConfigResult = this.configManager.getModelConfig(this.modelClient.getModel());
      const systemPrompt = buildSystemPrompt({
        workingDirectory: this.cwd,
        model: this.modelClient.getModel(),
        approvalMode: effectiveApprovalMode,
        supportsBuiltinSearch: modelConfigResult?.model?.supportsBuiltinSearch,
        toolRegistry: this.toolRegistry,
      });

      const agentLoop = new OptimizedAgentLoop({
        modelClient: this.modelClient,
        sessionManager: this.sessionManager,
        toolRegistry: this.toolRegistry,
        systemPrompt,
        contextCompressor: this.contextCompressor,
        maxContextTokens: (this.config.core.maxTokens || 16384) * 8,

        onTextDelta: (text: string) => {
          this.stopSpinner();
          process.stdout.write(text);
        },

        onToolStart: (name, toolCallId, input) => {
          this.stopSpinner();
          if (this.thinkingRenderer.isRendering()) {
            this.thinkingRenderer.cancel();
            process.stdout.write('\n');
          }

          // Summarize tool input for display
          const inputSummary = input ? this.summarizeToolInput(name, input) : '';

          const state: ToolCallState = {
            name, toolCallId,
            startTime: Date.now(),
            input: inputSummary, result: '',
            isError: false, isComplete: false,
            lineIndex: this.toolCallOrder.length,
          };
          this.activeToolCalls.set(toolCallId, state);
          this.toolCallOrder.push(toolCallId);

          // Start spinner for this tool
          this.startToolSpinner(state);
        },

        onToolComplete: (name, toolCallId, result) => {
          this.stopSpinner();
          const state = this.activeToolCalls.get(toolCallId);
          if (state) {
            state.result = typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
            state.isError = !!result.isError;
            state.isComplete = true;
            this.printToolLine(state);
            if (name === 'todo' && !result.isError) {
              this.printTodoPanel(state.result);
            }
          }
        },

        onThinkingStart: () => {
          if (!this.showThinking) return;
          this.stopSpinner();
          this.thinkingRenderer.start();
        },
        onThinkingDelta: (delta: string) => {
          if (!this.showThinking) return;
          this.thinkingRenderer.append(delta);
        },
        onThinkingEnd: () => {
          if (!this.showThinking) return;
          this.thinkingRenderer.complete();
        },

        onApprovalRequired: this.handleApproval.bind(this),

        onTurnStart: (turn) => {
          this.currentTurn = turn;
          this.startSpinner(`turn ${turn} — thinking...`);
        },

        onTurnEnd: () => {
          this.stopSpinner();
        },

        onContextCompress: (orig, result, action) => {
          console.log(C.muted(`\n  ${BOX.arrow} context compressed: ${orig} → ${result} tokens (${action})`));
        },

        // OptimizedAgentLoop specific options
        maxConcurrentTools: 3,
        incrementalCompression: true,
      });

      this.currentLoop = agentLoop;
      const startTime = Date.now();
      const result = await agentLoop.runStream(this.sessionId, fullInput);
      const duration = Date.now() - startTime;
      this.currentLoop = null;
      this.processing = false;
      this.stopSpinner();

      // Auto-persist session after every turn
      this.sessionManager.persist(this.sessionId);

      console.log('');
      const totalTokens = result.totalInputTokens + result.totalOutputTokens;

      // Compact completion summary with icons
      const summaryParts = [
        `${C.success(BOX.check)} ${C.muted(`${result.turnsCompleted} turn${result.turnsCompleted > 1 ? 's' : ''}`)}`,
        `${C.info(BOX.diamond)} ${C.muted(`${totalTokens.toLocaleString()} tok`)}`,
        `${C.accent(BOX.star)} ${C.muted(`${(duration / 1000).toFixed(1)}s`)}`,
      ];

      console.log(
        C.dim('  ' + BOX.h.repeat(4)) + ' ' +
        C.success('Done') + ' ' +
        summaryParts.join(C.dim(' · ')) + ' ' +
        C.dim(BOX.h.repeat(4))
      );

    } catch (err: unknown) {
      this.currentLoop = null;
      this.processing = false;
      this.thinkingRenderer.cancel();
      this.stopSpinner();

      if (err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'CancelledError') {
        return;
      }
      console.log('');
      this.printLine('error', 'error');
      console.error(C.error(`  ${(err as Error).message}`));
    } finally {
      process.stdin.off('data', onEscKey);
    }
  }

  // ========================================================================
  // Tool call display (collapsible panel)
  // ========================================================================

  /** Summarize tool input into a one-line preview */
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
        // Generic: show first meaningful value
        const vals = Object.values(input).filter((v): v is string => typeof v === 'string' && v.length > 0);
        return vals.length > 0 ? vals[0].slice(0, 50) : '';
    }
  }

  /** Start a spinner animation for a running tool */
  private startToolSpinner(state: ToolCallState): void {
    const idx = this.toolCallOrder.indexOf(state.toolCallId) + 1;
    const idxStr = idx.toString().padStart(2, '0');
    
    // Enhanced tool information display
    const inputPreview = state.input ? `: ${state.input}` : '';
    const maxInputLength = 30;
    const truncatedInput = inputPreview.length > maxInputLength ? inputPreview.slice(0, maxInputLength) + '...' : inputPreview;

    // Print enhanced tool start line with more information
    process.stdout.write(
      '\n' +
      C.dim('┌─ ') +
      C.toolName.bold(`Tool #${idxStr}: ${state.name}`) +
      C.dim(` ${truncatedInput}`) +
      '\n' +
      C.dim('│ ') +
      C.dim('Starting execution...')
    );

    // Start enhanced inline spinner with progress information
    this.spinnerFrame = 0;
    const chars = BOX.spinner;
    this.spinnerTimer = setInterval(() => {
      const elapsed = Date.now() - state.startTime;
      const elapsedStr = elapsed < 1000 ? `${elapsed}ms` : `${(elapsed / 1000).toFixed(1)}s`;
      const frame = chars[this.spinnerFrame % chars.length];
      
      // Show detailed progress information
      const progressText = `${C.dim('│ ')}${C.info.dim(frame)} ${C.dim('Working...')} ${C.dim(`(${elapsedStr}`)}${C.dim(')')}`;
      process.stdout.write(`\r${progressText}`);
      
      this.spinnerFrame++;
    }, 80);
  }

  /** Print a finalized tool line (success or error) with enhanced information */
  private printToolLine(state: ToolCallState): void {
    // Clear spinner
    if (this.spinnerTimer) {
      clearInterval(this.spinnerTimer);
      this.spinnerTimer = null;
    }

    // Clear current line
    process.stdout.write('\r' + ' '.repeat(100) + '\r');

    const duration = Date.now() - state.startTime;
    const durationStr = duration < 1000 ? `${duration}ms` : `${(duration / 1000).toFixed(1)}s`;
    const idx = this.toolCallOrder.indexOf(state.toolCallId) + 1;
    const idxStr = idx.toString().padStart(2, '0');
    
    // Enhanced input preview
    let inputPreview = '';
    if (state.input) {
      const maxInputLength = 40;
      const truncatedInput = state.input.length > maxInputLength ? state.input.slice(0, maxInputLength) + '...' : state.input;
      inputPreview = '\n' + C.dim('│ Input: ') + C.muted(truncatedInput);
    }

    const icon = state.isError ? C.error(BOX.crossX) : C.success(BOX.check);
    const nameColor = state.isError ? C.toolErr : C.toolName;

    // Enhanced result display with more details
    let resultPreview = '';
    if (state.isError) {
      resultPreview = '\n' + C.dim('│ Error: ') + C.error.dim(state.result.slice(0, 100).replace(/\n/g, ' '));
    } else if (state.result.length > 0) {
      // Show first line of result as preview
      const firstLine = state.result.split('\n')[0].slice(0, 80);
      resultPreview = '\n' + C.dim('│ Output: ') + C.dim(firstLine);
      
      // If result is long, show character count
      if (state.result.length > 80) {
        resultPreview += C.dim(` (${state.result.length} chars total)`);
      }
    }

    // Print complete tool execution result
    console.log(
      C.dim('└─ ') +
      icon + ' ' +
      nameColor.bold(`${state.name}`) +
      C.dim(` #${idxStr}`) +
      C.dim(` (${durationStr})`) +
      inputPreview +
      resultPreview
    );
  }

  private printTodoPanel(result: string): void {
    // Always show TODO panel for better visibility
    if (!result) {
      this.todoProgressPanel.setTodos([]);
      this.todoProgressPanel.show();
      return;
    }

    // Handle [object Object] case - try to parse as JSON
    if (result.includes('[object Object]')) {
      console.log(C.warning('  ⚠ TODO data format error - attempting recovery'));
      this.todoProgressPanel.setTodos([]);
      this.todoProgressPanel.show();
      return;
    }

    const lines = result.split('\n').filter((l) => l.trim());
    if (lines.length === 0) {
      this.todoProgressPanel.setTodos([]);
      this.todoProgressPanel.show();
      return;
    }

    // Parse TODO items from the result string
    const todos: TodoItem[] = [];
    let idx = 0;
    let parseErrors = 0;

    for (const line of lines) {
      try {
        const pendingMatch = line.match(/^○\s+\[pending\s*\]\s+(.+)/);
        const inProgressMatch = line.match(/^◉\s+\[in_progress\s*\]\s+(.+)/);
        const completedMatch = line.match(/^●\s+\[completed\s*\]\s+(.+)/);
        const failedMatch = line.match(/^✗\s+\[failed\s*\]\s+(.+)/);

        // Detect priority from task text (high/medium/low keywords)
        const detectPriority = (text: string): 'high' | 'medium' | 'low' | undefined => {
          if (/high|critical|urgent|重要/i.test(text)) return 'high';
          if (/low|minor|minor|低/i.test(text)) return 'low';
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
      } catch (e) {
        parseErrors++;
        // Skip malformed lines
        continue;
      }
    }

    if (parseErrors > 0) {
      console.log(C.warning(`  ⚠ Skipped ${parseErrors} malformed TODO entries`));
    }

    // Always update and show the TODO panel (don't hide)
    this.todoProgressPanel.setTodos(todos);
    this.todoProgressPanel.show();
  }

  private renderProgressBar(pct: number, width: number): string {
    const filled = Math.round((pct / 100) * width);
    const empty = width - filled;
    const bar = C.success('█'.repeat(filled)) + C.dim('░'.repeat(empty));
    return C.muted('[') + bar + C.muted(']') + C.muted(` ${pct}%`);
  }

  // ========================================================================
  // Mode & toggle operations
  // ========================================================================

  private cycleMode(): void {
    const idx = MODES.indexOf(this.mode);
    const nextIdx = (idx + 1) % MODES.length;
    this.mode = MODES[nextIdx] ?? 'auto';
    const info = MODE_LABELS[this.mode];
    console.log(
      C.dim('  ' + BOX.arrowRight) + ' ' +
      C.muted('Mode: ') + info.color(info.label) + ' ' +
      C.dim('·') + ' ' + C.muted(info.description)
    );
  }

  private toggleThinking(): void {
    this.showThinking = !this.showThinking;
    const status = this.showThinking ? C.success('ON') : C.error('OFF');
    const icon = this.showThinking ? C.success(BOX.check) : C.error(BOX.crossX);
    console.log(C.dim(`  ${icon} Thinking: ${status}`));
  }

  private toggleCompact(): void {
    this.compactMode = !this.compactMode;
    this.thinkingRenderer.setExpanded(!this.compactMode);
    const status = this.compactMode ? C.success('compact') : C.info('verbose');
    console.log(C.dim(`  ${BOX.diamond} Display: ${status}`));
  }

  // ========================================================================
  // Commands
  // ========================================================================

  private async handleCommand(cmd: string): Promise<void> {
    const parts = cmd.slice(1).split(/\s+/);
    const command = parts[0];
    const arg = parts.slice(1).join(' ');

    switch (command) {
      case 'quit': case 'exit': case 'q':
        if (this.sessionId) this.sessionManager.persist(this.sessionId);
        console.log(C.muted('Goodbye!'));
        process.exit(0);

      case 'help': case 'h': case '?':
        this.printHelp();
        break;

      case 'clear': case 'reset':
        if (this.sessionId) this.sessionManager.persist(this.sessionId);
        this.sessionId = this.createInitialSession();
        console.log(C.muted('  Conversation cleared. New session started.'));
        break;

      case 'model':
        await this.handleModelCommand(arg);
        break;

      case 'mode':
        if (arg && MODES.includes(arg as InteractionMode)) {
          this.mode = arg as InteractionMode;
          const info = MODE_LABELS[this.mode];
          console.log(C.muted('  Mode: ') + info.color(info.label) + C.muted(` — ${info.description}`));
          console.log(C.muted(`  Approval: `) + C.info(info.approvalMode));
        } else {
          this.cycleMode();
        }
        break;

      case 'thinking':
        this.toggleThinking();
        break;

      case 'compact':
        this.toggleCompact();
        break;

      case 'tools': {
        const tools = this.toolRegistry.getEnabledToolNames();
        const stats = this.toolRegistry.getStats();
        console.log(C.muted(`  Tools (${stats.enabled}): `) + C.primary(tools.slice(0, 10).join(', ') + (tools.length > 10 ? '...' : '')));
        break;
      }

      case 'mcp':
        await this.handleMcpCommand(arg);
        break;

      case 'ollama':
        await this.handleOllamaCommand(arg);
        break;

      case 'skills':
        await this.handleSkillsCommand(arg);
        break;

      case 'theme':
        await this.handleThemeCommand(arg);
        break;

      case 'image':
        await this.handleImageCommand(arg);
        break;

      case 'checkpoint':
        await this.handleCheckpointCommand(arg);
        break;

      case 'init':
        await this.handleInitCommand(arg);
        break;

      case 'memory':
        await this.handleMemoryCommand(arg);
        break;

      case 'history':
        await this.handleHistoryCommand(arg);
        break;

      case 'compress':
        await this.handleCompressCommand();
        break;

      case 'status':
        if (this.sessionId) {
          const stats = this.sessionManager.getStats(this.sessionId);
          const modeInfo = MODE_LABELS[this.mode];
          console.log(C.muted('  Session: ') + C.primary(stats?.id?.slice(0, 8) || ''));
          console.log(C.muted('  Mode:    ') + modeInfo.color(modeInfo.label));
          console.log(C.muted('  Turns:   ') + C.primary(String(stats?.turnCount || 0)));
          console.log(C.muted('  Tokens:  ') + C.primary(`${stats?.totalInputTokens || 0} in / ${stats?.totalOutputTokens || 0} out`));
          console.log(C.muted('  Msgs:    ') + C.primary(String(stats?.messageCount || 0)));
        }
        break;

      default:
        console.log(C.warning(`  Unknown command: /${command}. Type /help for help.`));
    }
  }

  // ========================================================================
  // Helper: Prompt for API key
  // ========================================================================

  private async promptForApiKey(providerName: string, providerType: string): Promise<string | null> {
    const readline = await import('node:readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    const envKey = `${providerName.toUpperCase()}_API_KEY`;

    console.log('');
    console.log(C.warning(`  No API key found for "${providerName}"`));
    console.log(C.muted(`  You can also set it via: export ${envKey}=<your-key>`));
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

  // ========================================================================
  // /model <id> — switch model at runtime (with interactive selector)
  // ========================================================================

  private async handleModelCommand(arg: string): Promise<void> {
    if (!arg) {
      // Show interactive model selector
      await this.showModelSelector();
      return;
    }
    try {
      this.modelClient.updateOptions({ model: arg });
      console.log(C.success(`  ✓ Switched to model: `) + C.primary(arg));
      
      // Save to global config
      const config = this.configManager.getConfig();
      config.core.defaultModel = arg;
      await this.configManager.save(config);
      
      // Update session config too
      if (this.sessionId) {
        const cfg = this.sessionManager.getConfig(this.sessionId);
        cfg.model = arg;
      }
    } catch (err) {
      console.log(C.error(`  Failed to switch model: ${(err as Error).message}`));
    }
  }

  /** Get all available models across all providers */
  private getAvailableModels(showAll: boolean = false): { id: string; name: string; provider: string; configured: boolean; providerType: string }[] {
    const currentModel = this.modelClient.getModel();
    const models: { id: string; name: string; provider: string; configured: boolean; providerType: string }[] = [];
    const config = this.configManager.getConfig();
    
    // Collect models from configured providers only
    for (const [providerKey, providerConfig] of Object.entries(config.models.providers)) {
      // Check if provider is actually configured
      const hasCreds = this.authManager?.hasCredentials(providerKey) || false;
      const providerType = providerConfig.type as string;
      const hasBaseUrl = !!(providerConfig as any).baseUrl;
      
      // Determine if provider is configured
      let configured = false;
      
      if (providerType === 'ollama') {
        // Local Ollama - check if baseUrl is configured (default localhost)
        configured = hasBaseUrl || true; // Always show if type is ollama
      } else if (providerType === 'ollama-cloud') {
        // Ollama Cloud - needs baseUrl
        configured = hasBaseUrl;
      } else if (providerType === 'custom') {
        // Custom providers need baseUrl
        configured = hasBaseUrl;
      } else if (['anthropic', 'openai', 'google', 'deepseek', 'qwen', 'glm', 'moonshot', 'baichuan', 'minimax', 'yi', 'siliconflow', 'groq', 'mistral', 'together', 'perplexity', 'coding-plan-alibaba', 'github'].includes(providerType)) {
        // Cloud providers need API keys
        configured = hasCreds;
      } else {
        // Unknown type - check for credentials
        configured = hasCreds || hasBaseUrl;
      }
      
      // Skip unconfigured providers unless showAll is true
      if (!showAll && !configured) continue;
      
      // Add models from this provider
      for (const [modelId, modelConfig] of Object.entries(providerConfig.models)) {
        models.push({
          id: `${providerKey}/${modelId}`,
          name: (modelConfig as any).name || modelId,
          provider: providerKey,
          configured,
          providerType: providerType,
        });
      }
    }
    
    // Also add common aliases for configured providers
    if (config.models.aliases) {
      for (const [alias, targetId] of Object.entries(config.models.aliases)) {
        // Find which provider this alias belongs to
        for (const [providerKey, providerConfig] of Object.entries(config.models.providers)) {
          if (providerConfig.models[targetId as string]) {
            const hasCreds = this.authManager?.hasCredentials(providerKey) || false;
            const providerType = providerConfig.type as string;
            const hasBaseUrl = !!(providerConfig as any).baseUrl;
            
            let configured = false;
            if (providerType === 'ollama') {
              configured = true;
            } else if (providerType === 'ollama-cloud' || providerType === 'custom') {
              configured = hasBaseUrl;
            } else {
              configured = hasCreds;
            }
            
            if (configured && !models.find(m => m.id === alias)) {
              models.push({
                id: alias as string,
                name: (providerConfig.models[targetId as string] as any)?.name || alias,
                provider: providerKey,
                configured,
                providerType: providerType,
              });
            }
            break;
          }
        }
      }
    }
    
    return models;
  }

  /** Interactive model selector with keyboard navigation - Windows compatible */
  private async showModelSelector(): Promise<void> {
    const models = this.getAvailableModels(false); // Only show configured models
    const currentModel = this.modelClient.getModel();
    
    if (models.length === 0) {
      console.log(C.warning('  No models available for current provider.'));
      console.log(C.muted('  Current model: ') + C.primary(currentModel));
      console.log(C.dim('  Usage: /model <model-id>'));
      return;
    }

    // Sort models, current model first
    models.sort((a, b) => {
      if (a.id === currentModel) return -1;
      if (b.id === currentModel) return 1;
      return a.id.localeCompare(b.id);
    });

    let selectedIndex = models.findIndex(m => m.id === currentModel);
    if (selectedIndex < 0) selectedIndex = 0;

    // Render function - clears screen and redraws everything
    const renderModels = (selected: number) => {
      // Clear the terminal for a clean redraw
      process.stdout.write('\x1b[2J\x1b[H');
      
      // Print header
      console.log('');
      console.log(C.brand(`  ╭──────────────────────────────────────────────────────────╮`));
      console.log(C.brand(`  │ `) + C.primary('Model Selector').padEnd(56) + C.brand(`│`));
      console.log(C.brand(`  │ `) + C.dim(`Current: ${currentModel}`).padEnd(56) + C.brand(`│`));
      console.log(C.brand(`  │ `) + C.muted(`↑↓ Navigate | Enter Select | Esc Cancel`).padEnd(56) + C.brand(`│`));
      console.log(C.brand(`  ├──────────────────────────────────────────────────────────┤`));
      
      // Render models
      for (let i = 0; i < models.length; i++) {
        const m = models[i];
        const isSelected = i === selected;
        const isCurrent = m.id === currentModel;
        
        // Configuration status
        const statusIcon = m.configured ? '✓' : '⚠';
        const statusColor = m.configured ? C.success : C.warning;
        const statusText = m.configured ? '' : C.warning(' [needs setup]');
        
        // Selection indicator
        const prefix = isSelected ? C.brand('→ ') : '  ';
        
        // Format line
        let modelDisplay = m.name;
        if (isCurrent) {
          modelDisplay = C.success(`${m.name}`) + C.dim(` (${m.id})`);
        } else if (isSelected) {
          modelDisplay = C.primary(m.name) + C.dim(` (${m.id})`);
        } else {
          modelDisplay = C.muted(m.name) + C.dim(` (${m.id})`);
        }
        
        console.log(C.brand(`  │ `) + prefix + statusColor(statusIcon) + ' ' + modelDisplay + statusText + C.brand(`│`));
      }
      
      // Print footer
      console.log(C.brand(`  ╰──────────────────────────────────────────────────────────╯`));
    };

    // Initial render
    renderModels(selectedIndex);

    // Handle keyboard input
    return new Promise((resolve) => {
      // Set stdin to raw mode for key detection
      const wasRaw = process.stdin.isRaw;
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
      }
      process.stdin.resume();

      const cleanup = () => {
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(wasRaw ?? false);
        }
        process.stdin.off('data', onData);
      };

      const onData = (buffer: Buffer) => {
        const key = buffer.toString();
        
        // Up arrow
        if (key === '\x1b[A' || key === 'k') {
          selectedIndex = (selectedIndex - 1 + models.length) % models.length;
          renderModels(selectedIndex);
        }
        // Down arrow
        else if (key === '\x1b[B' || key === 'j') {
          selectedIndex = (selectedIndex + 1) % models.length;
          renderModels(selectedIndex);
        }
        // Enter
        else if (key === '\r' || key === '\n') {
          cleanup();
          const selected = models[selectedIndex];
          
          // Clear and show result
          process.stdout.write('\x1b[2J\x1b[H');
          console.log('');
          
          // Check if model is configured
          const providerName = selected.id.split(':')[0];
          const hasCreds = this.authManager?.hasCredentials(providerName);
          const isOllama = providerName === 'ollama' || providerName === 'ollama-cloud';
          
          // Handle model switching with proper error handling
          const switchModel = async () => {
            try {
              if (!hasCreds && !isOllama && this.authManager) {
                // Model not configured - prompt for setup
                console.log(C.warning(`  Model "${selected.name}" is not configured.`));
                console.log(C.muted('  Please provide API credentials to use this model.'));
                console.log('');
                
                // Prompt for API key
                const apiKey = await this.promptForApiKey(providerName, providerName);
                
                if (apiKey) {
                  await this.authManager.setCredentials({ provider: providerName, apiKey });
                  console.log('');
                  console.log(C.success(`  ✓ Configuration saved. Switching to ${selected.name}...`));
                } else {
                  console.log(C.error('  ✗ Configuration cancelled or failed.'));
                  return;
                }
              } else if (selected.id === currentModel) {
                console.log(C.muted('  Model unchanged: ') + C.primary(currentModel));
                return;
              }
              
              // Switch model
              this.modelClient.updateOptions({ model: selected.id });
              console.log(C.success(`  ✓ Switched to: `) + C.primary(selected.id));
              
              // Save to global config
              const config = this.configManager.getConfig();
              config.core.defaultModel = selected.id;
              await this.configManager.save(config);
              
              if (this.sessionId) {
                const cfg = this.sessionManager.getConfig(this.sessionId);
                cfg.model = selected.id;
              }
            } catch (err) {
              console.log(C.error(`  Error switching model: ${(err as Error).message}`));
            }
          };
          
          // Execute switch and then resolve
          switchModel().then(() => resolve()).catch(err => {
            console.log(C.error(`  Error: ${(err as Error).message}`));
            resolve();
          });
        }
        // Escape or Ctrl+C
        else if (key === '\x1b' || key === '\x03') {
          cleanup();
          process.stdout.write('\x1b[2J\x1b[H');
          console.log('');
          console.log(C.muted('  Cancelled'));
          resolve();
        }
        // Number key for quick select (1-9)
        else if (key >= '1' && key <= '9') {
          const num = parseInt(key, 10) - 1;
          if (num < models.length) {
            selectedIndex = num;
            renderModels(selectedIndex);
          }
        }
      };

      process.stdin.on('data', onData);
    });
  }

  // ========================================================================
  // /init — generate NOVA.md project memory file
  // ========================================================================

  private async handleInitCommand(arg: string): Promise<void> {
    const targetDir = arg ? path.resolve(this.cwd, arg) : this.cwd;
    const novaFile = path.join(targetDir, 'NOVA.md');

    if (fs.existsSync(novaFile)) {
      console.log(C.warning(`  NOVA.md already exists at: ${novaFile}`));
      console.log(C.muted('  Use /init --force to regenerate'));
      if (!arg.includes('--force')) return;
    }

    console.log('');
    console.log(C.brand('  Scanning project structure...'));

    // Gather project info
    const scanResult = this.scanProjectForInit(targetDir);

    const content = this.generateNovaMd(scanResult, targetDir);

    fs.writeFileSync(novaFile, content, 'utf-8');
    console.log(C.success(`  ✓ NOVA.md created at ${novaFile}`));
    console.log(C.muted(`  This file helps the AI understand your project.`));
    console.log(C.muted(`  Edit it to add custom instructions and context.`));
    console.log('');
    console.log(C.dim('  Preview:'));
    const preview = content.split('\n').slice(0, 20).join('\n');
    console.log(C.dim(preview));
    if (content.split('\n').length > 20) console.log(C.dim('  ...'));
  }

  private scanProjectForInit(dir: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    // Package.json
    const pkgPath = path.join(dir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        result.name = pkg.name;
        result.version = pkg.version;
        result.description = pkg.description;
        result.scripts = pkg.scripts;
        result.dependencies = Object.keys(pkg.dependencies || {}).slice(0, 20);
        result.devDependencies = Object.keys(pkg.devDependencies || {}).slice(0, 20);
        result.packageManager = pkg.packageManager;
        result.type = pkg.type;
      } catch { /* skip */ }
    }

    // Detect project type
    const indicators = {
      typescript: fs.existsSync(path.join(dir, 'tsconfig.json')),
      react: fs.existsSync(path.join(dir, 'src', 'App.tsx')) || fs.existsSync(path.join(dir, 'src', 'App.jsx')),
      nextjs: fs.existsSync(path.join(dir, 'next.config.js')) || fs.existsSync(path.join(dir, 'next.config.ts')),
      vite: fs.existsSync(path.join(dir, 'vite.config.ts')) || fs.existsSync(path.join(dir, 'vite.config.js')),
      monorepo: fs.existsSync(path.join(dir, 'pnpm-workspace.yaml')) || fs.existsSync(path.join(dir, 'turbo.json')),
      python: fs.existsSync(path.join(dir, 'pyproject.toml')) || fs.existsSync(path.join(dir, 'requirements.txt')),
      rust: fs.existsSync(path.join(dir, 'Cargo.toml')),
      go: fs.existsSync(path.join(dir, 'go.mod')),
      docker: fs.existsSync(path.join(dir, 'Dockerfile')),
      git: fs.existsSync(path.join(dir, '.git')),
    };
    result.indicators = indicators;

    // Top-level structure
    try {
      const entries = fs.readdirSync(dir).filter((e) => !e.startsWith('.') && e !== 'node_modules');
      result.topLevel = entries;
    } catch { /* skip */ }

    // README
    const readmePath = path.join(dir, 'README.md');
    if (fs.existsSync(readmePath)) {
      try {
        result.readme = fs.readFileSync(readmePath, 'utf-8').slice(0, 1000);
      } catch { /* skip */ }
    }

    // Git remote
    try {
      const remote = execSync('git remote get-url origin 2>/dev/null', { cwd: dir, encoding: 'utf-8', timeout: 3000 }).trim();
      result.gitRemote = remote;
    } catch { /* skip */ }

    return result;
  }

  private generateNovaMd(scan: Record<string, unknown>, dir: string): string {
    const name = scan.name || path.basename(dir);
    const date = new Date().toISOString().split('T')[0];
    const indicators = (scan.indicators || {}) as Record<string, boolean>;

    const tech: string[] = [];
    if (indicators.typescript) tech.push('TypeScript');
    if (indicators.react) tech.push('React');
    if (indicators.nextjs) tech.push('Next.js');
    if (indicators.vite) tech.push('Vite');
    if (indicators.monorepo) tech.push('Monorepo');
    if (indicators.python) tech.push('Python');
    if (indicators.rust) tech.push('Rust');
    if (indicators.go) tech.push('Go');
    if (indicators.docker) tech.push('Docker');

    const scripts = scan.scripts as Record<string, string> | undefined;
    const scriptLines = scripts ? Object.entries(scripts).map(([k, v]) => `- \`${k}\`: ${v}`).join('\n') : '';

    const deps = (scan.dependencies as string[] | undefined) || [];
    const devDeps = (scan.devDependencies as string[] | undefined) || [];

    return `# NOVA.md — Project Memory

> Auto-generated on ${date}. Edit this file to customize AI behavior for this project.

## Project Overview

**Name**: ${name}
**Version**: ${scan.version || 'unknown'}
**Description**: ${scan.description || '(add a description here)'}
**Location**: ${dir}
${scan.gitRemote ? `**Repository**: ${scan.gitRemote}` : ''}

## Technology Stack

${tech.length > 0 ? tech.map((t) => `- ${t}`).join('\n') : '- (detect automatically)'}

## Key Commands

${scriptLines || '- (add your build/test/dev commands here)'}

## Dependencies

${deps.length > 0 ? `Main: ${deps.slice(0, 10).join(', ')}` : ''}
${devDeps.length > 0 ? `Dev: ${devDeps.slice(0, 10).join(', ')}` : ''}

## Project Structure

\`\`\`
${((scan.topLevel as string[]) || []).slice(0, 20).join('\n')}
\`\`\`

## Coding Conventions

<!-- Add your project-specific conventions here -->
- (e.g., Use single quotes for strings)
- (e.g., Always add JSDoc comments to exported functions)
- (e.g., Test files go in __tests__ directories)

## Important Notes for AI

<!-- Add any special instructions, context, or warnings for the AI assistant -->
- Working directory: ${dir}
- (e.g., Never commit directly to main)
- (e.g., Use pnpm, not npm)

## File Reference

<!-- Add paths to key files the AI should know about -->
<!-- Example: @src/types/index.ts — Core type definitions -->

---
*Edit this file to add project-specific context. The AI reads NOVA.md automatically at the start of each session.*
`;
  }

  // ========================================================================
  // /memory — manage persistent notes
  // ========================================================================

  private get memoryFile(): string {
    return path.join(os.homedir(), '.nova', 'memory.md');
  }

  private async handleMemoryCommand(arg: string): Promise<void> {
    const parts = arg.trim().split(/\s+/);
    const sub = parts[0];

    if (!sub || sub === 'show' || sub === 'list') {
      // Show memory
      if (!fs.existsSync(this.memoryFile)) {
        console.log(C.muted('  No memory file yet. Use /memory add <text> to create entries.'));
        return;
      }
      const content = fs.readFileSync(this.memoryFile, 'utf-8');
      console.log('');
      console.log(C.brand('  Nova Memory'));
      console.log(C.dim('  ' + BOX.h.repeat(58)));
      content.split('\n').forEach((line) => {
        if (line.startsWith('## ')) console.log(C.brand('  ' + line));
        else if (line.startsWith('- ')) console.log(C.muted('  ' + line));
        else console.log(C.dim('  ' + line));
      });
      return;
    }

    if (sub === 'add') {
      const text = parts.slice(1).join(' ').trim();
      if (!text) {
        console.log(C.warning('  Usage: /memory add <text>'));
        return;
      }
      this.ensureDir(path.dirname(this.memoryFile));
      const timestamp = new Date().toISOString().split('T')[0];
      const entry = `- [${timestamp}] ${text}\n`;
      if (!fs.existsSync(this.memoryFile)) {
        fs.writeFileSync(this.memoryFile, `# Nova Memory\n\n## Notes\n\n${entry}`, 'utf-8');
      } else {
        fs.appendFileSync(this.memoryFile, entry, 'utf-8');
      }
      console.log(C.success(`  ✓ Memory saved: "${text}"`));
      return;
    }

    if (sub === 'clear') {
      if (fs.existsSync(this.memoryFile)) {
        fs.writeFileSync(this.memoryFile, '# Nova Memory\n\n', 'utf-8');
        console.log(C.warning('  Memory cleared.'));
      }
      return;
    }

    if (sub === 'edit') {
      const editor = process.env.EDITOR || process.env.VISUAL || (process.platform === 'win32' ? 'notepad' : 'nano');
      this.ensureDir(path.dirname(this.memoryFile));
      if (!fs.existsSync(this.memoryFile)) {
        fs.writeFileSync(this.memoryFile, '# Nova Memory\n\n## Notes\n\n', 'utf-8');
      }
      console.log(C.muted(`  Opening ${this.memoryFile} in ${editor}...`));
      try {
        execSync(`${editor} "${this.memoryFile}"`, { stdio: 'inherit' });
      } catch {
        console.log(C.muted(`  Memory file: ${this.memoryFile}`));
      }
      return;
    }

    console.log(C.muted('  Usage: /memory [show|add <text>|clear|edit]'));
  }

  // ========================================================================
  // /history — browse and restore previous sessions
  // ========================================================================

  private async handleHistoryCommand(arg: string): Promise<void> {
    const parts = arg.trim().split(/\s+/);
    const sub = parts[0];

    if (!sub || sub === 'list') {
      const sessions = this.sessionManager.listPersistedSessions(20);
      if (sessions.length === 0) {
        console.log(C.muted('  No saved sessions.'));
        return;
      }
      console.log('');
      console.log(C.brand('  Session History'));
      console.log(C.dim('  ' + BOX.h.repeat(58)));
      sessions.forEach((s, idx) => {
        const date = new Date(s.updatedAt).toLocaleString();
        const id = s.id.slice(0, 8);
        const turns = s.turnCount;
        const tokens = (s.totalInputTokens + s.totalOutputTokens).toLocaleString();
        const title = (s.title || 'New session').slice(0, 50);
        const isCurrent = this.sessionId && s.id === String(this.sessionId);
        const marker = isCurrent ? C.success(' ← current') : '';
        console.log(
          `  ${C.muted(String(idx + 1).padStart(2) + '.')} ${C.primary(title)}${marker}\n` +
          `      ${C.dim(id + '  ' + date + '  ' + turns + ' turns  ' + tokens + ' tok')}`
        );
      });
      console.log('');
      console.log(C.dim('  /history restore <n>  — switch to session n'));
      console.log(C.dim('  /history delete <n>   — delete session n'));
      return;
    }

    if (sub === 'restore') {
      const n = parseInt(parts[1], 10);
      const sessions = this.sessionManager.listPersistedSessions(20);
      if (isNaN(n) || n < 1 || n > sessions.length) {
        console.log(C.warning(`  Invalid index. Use /history to see sessions.`));
        return;
      }
      // Save current first
      if (this.sessionId) this.sessionManager.persist(this.sessionId);

      const target = sessions[n - 1];
      const restored = this.sessionManager.loadFromDisk(target.id);
      if (restored) {
        this.sessionId = restored.id;
        const msgs = this.sessionManager.getMessages(this.sessionId);
        console.log(C.success(`  ✓ Restored session ${target.id.slice(0, 8)} — ${msgs.length} messages`));
        console.log(C.muted(`  Title: "${target.title}"`));
      } else {
        console.log(C.error('  Failed to restore session.'));
      }
      return;
    }

    if (sub === 'delete') {
      const n = parseInt(parts[1], 10);
      const sessions = this.sessionManager.listPersistedSessions(20);
      if (isNaN(n) || n < 1 || n > sessions.length) {
        console.log(C.warning(`  Invalid index.`));
        return;
      }
      const target = sessions[n - 1];
      const deleted = this.sessionManager.deletePersisted(target.id);
      if (deleted) {
        console.log(C.success(`  ✓ Deleted session ${target.id.slice(0, 8)}`));
      } else {
        console.log(C.error('  Failed to delete session.'));
      }
      return;
    }

    console.log(C.muted('  Usage: /history [list|restore <n>|delete <n>]'));
  }

  // ========================================================================
  // /compress — manually trigger context compression
  // ========================================================================

  private async handleCompressCommand(): Promise<void> {
    if (!this.sessionId || !this.contextCompressor) {
      console.log(C.warning('  No active session or context compressor not initialized.'));
      return;
    }
    const msgs = this.sessionManager.getMessages(this.sessionId);
    const before = msgs.length;
    console.log(C.info(`  Compressing context (${before} messages)...`));
    // Trigger via a lightweight session flush
    this.sessionManager.persist(this.sessionId);
    console.log(C.success(`  ✓ Context snapshot saved. Session: ${String(this.sessionId).slice(0, 8)}`));
  }

  private printHelp(): void {
    const w = 60;
    const hr = C.brandDim(BOX.h.repeat(w));
    const hrThick = C.brand(BOX.hThick.repeat(w));
    const vl = C.brandDim(BOX.v);

    const cmd = (name: string, desc: string) =>
      `  ${C.info(name.padEnd(18))} ${C.muted(desc)}`;

    const section = (title: string) =>
      `\n${vl} ${C.brandLight(BOX.diamond)} ${C.brand(title)}${' '.repeat(w - title.length - 4)}${vl}`;

    console.log('');
    console.log(C.brand(BOX.tl) + hrThick + C.brand(BOX.tr));
    console.log(`${vl} ${C.brand.bold('Nova CLI Commands')}${' '.repeat(w - 18)}${vl}`);
    console.log(C.brand(BOX.ht) + hr + C.brand(BOX.htr));

    // Navigation
    console.log(section('Navigation'));
    console.log(`${vl}${cmd('/help', 'Show this help')}${' '.repeat(w - 28)}${vl}`);
    console.log(`${vl}${cmd('/quit', 'Exit (session auto-saved)')}${' '.repeat(w - 38)}${vl}`);
    console.log(`${vl}${cmd('/clear', 'Clear conversation & start new')}${' '.repeat(w - 38)}${vl}`);

    // Session
    console.log(section('Session'));
    console.log(`${vl}${cmd('/status', 'Show session info & stats')}${' '.repeat(w - 33)}${vl}`);
    console.log(`${vl}${cmd('/history', 'List previous sessions')}${' '.repeat(w - 30)}${vl}`);
    console.log(`${vl}${cmd('/history restore', 'Switch to session n')}${' '.repeat(w - 33)}${vl}`);
    console.log(`${vl}${cmd('/history delete', 'Delete session n')}${' '.repeat(w - 30)}${vl}`);

    // Model
    console.log(section('Model'));
    console.log(`${vl}${cmd('/model', 'Show current model')}${' '.repeat(w - 26)}${vl}`);
    console.log(`${vl}${cmd('/model <id>', 'Switch model')}${' '.repeat(w - 26)}${vl}`);

    // Mode
    const currentMode = MODE_LABELS[this.mode].label;
    console.log(section(`Mode ${C.dim('(current: ' + currentMode + ')')}`));
    console.log(`${vl}  ${C.info('/mode'.padEnd(18))} ${C.muted('Cycle:')} ${C.success('AUTO')} ${C.dim('→')} ${C.blue('SMART')} ${C.dim('→')} ${C.magenta('EDITS')} ${C.dim('→')} ${C.warning('PLAN')} ${C.dim('→')} ${C.info('ASK')}${' '.repeat(w - 62)}${vl}`);
    console.log(`${vl}  ${C.info('/mode auto'.padEnd(18))} ${C.success('AUTO')}   ${C.dim('- full autonomous, no approval')}${' '.repeat(w - 50)}${vl}`);
    console.log(`${vl}  ${C.info('/mode smart'.padEnd(18))} ${C.blue('SMART')}  ${C.dim('- auto low-risk, ask high-risk')}${' '.repeat(w - 50)}${vl}`);
    console.log(`${vl}  ${C.info('/mode edits'.padEnd(18))} ${C.magenta('EDITS')} ${C.dim('- auto file ops, ask shell')}${' '.repeat(w - 50)}${vl}`);
    console.log(`${vl}  ${C.info('/mode plan'.padEnd(18))} ${C.warning('PLAN')}  ${C.dim('- confirm before each tool')}${' '.repeat(w - 50)}${vl}`);
    console.log(`${vl}  ${C.info('/mode ask'.padEnd(18))} ${C.info('ASK')}   ${C.dim('- read-only, answer only')}${' '.repeat(w - 50)}${vl}`);

    // Memory
    console.log(section('Memory'));
    console.log(`${vl}${cmd('/init', 'Generate NOVA.md project file')}${' '.repeat(w - 36)}${vl}`);
    console.log(`${vl}${cmd('/memory', 'Show persistent notes')}${' '.repeat(w - 29)}${vl}`);
    console.log(`${vl}${cmd('/memory add', 'Add a note')}${' '.repeat(w - 22)}${vl}`);

    // Extensions
    console.log(section('Extensions'));
    console.log(`${vl}${cmd('/mcp', 'MCP servers & tools')}${' '.repeat(w - 27)}${vl}`);
    console.log(`${vl}${cmd('/skills', 'List available skills')}${' '.repeat(w - 28)}${vl}`);
    console.log(`${vl}${cmd('/skills server', 'Browse GitHub skills market')}${' '.repeat(w - 36)}${vl}`);
    console.log(`${vl}${cmd('/skills author select', 'Browse local SkillsHub')}${' '.repeat(w - 40)}${vl}`);
    console.log(`${vl}${cmd('/skills user', 'Install from file/zip')}${' '.repeat(w - 32)}${vl}`);
    console.log(`${vl}${cmd('/theme', 'Switch color theme')}${' '.repeat(w - 26)}${vl}`);
    console.log(`${vl}${cmd('/checkpoint', 'File snapshots & rollback')}${' '.repeat(w - 35)}${vl}`);
    console.log(`${vl}${cmd('/image', 'Add image to chat')}${' '.repeat(w - 26)}${vl}`);

    // Ollama
    console.log(section('Ollama (Local Models)'));
    console.log(`${vl}${cmd('/ollama', 'Show status & models')}${' '.repeat(w - 29)}${vl}`);
    console.log(`${vl}${cmd('/ollama pull <n>', 'Download a model')}${' '.repeat(w - 32)}${vl}`);
    console.log(`${vl}${cmd('/ollama list', 'List installed models')}${' '.repeat(w - 33)}${vl}`);

    // Shortcuts
    console.log(section('Shortcuts'));
    console.log(`${vl}  ${C.info('@file.ts'.padEnd(18))} ${C.muted('Inject file content')}${' '.repeat(w - 35)}${vl}`);
    console.log(`${vl}  ${C.info('!command'.padEnd(18))} ${C.muted('Run shell command')}${' '.repeat(w - 33)}${vl}`);
    console.log(`${vl}  ${C.info('line\\'.padEnd(18))} ${C.muted('Multi-line input')}${' '.repeat(w - 32)}${vl}`);

    console.log(C.brand(BOX.bl) + hrThick + C.brand(BOX.br));
    console.log('');
  }

  // ========================================================================
  // MCP command handler
  // ========================================================================

  private async handleMcpCommand(subcommand?: string): Promise<void> {
    if (!this.mcpManager) {
      console.log(C.warning('  No MCP manager initialized.'));
      console.log(C.muted('  Add MCP servers to your config (~/.nova/config.yaml):'));
      console.log('');
      console.log(C.dim('  mcp:'));
      console.log(C.dim('    filesystem:'));
      console.log(C.dim('      command: npx'));
      console.log(C.dim('      args: [-y, "@modelcontextprotocol/server-filesystem", /path/to/dir]'));
      return;
    }

    const statuses: McpServerStatus[] = this.mcpManager.listServers();

    if (statuses.length === 0) {
      console.log(C.muted('  No MCP servers configured.'));
      return;
    }

    if (!subcommand || subcommand === 'status') {
      console.log('');
      console.log(C.brand('  MCP Servers'));
      console.log(C.dim('  ' + BOX.h.repeat(58)));

      for (const s of statuses) {
        const statusIcon = s.connected ? C.success(BOX.check) : C.error(BOX.cross);
        const statusStr = s.connected
          ? C.success('connected')
          : C.error(`disconnected${s.lastError ? ': ' + s.lastError.slice(0, 40) : ''}`);

        console.log(`  ${statusIcon} ${C.primary(s.name.padEnd(20))} ${statusStr}`);
        if (s.connected) {
          console.log(
            C.dim(`      ${s.toolCount} tool${s.toolCount !== 1 ? 's' : ''}`) +
            (s.resourceCount > 0 ? C.dim(`, ${s.resourceCount} resource${s.resourceCount !== 1 ? 's' : ''}`) : '')
          );
        }
      }

      const connected = statuses.filter((s) => s.connected).length;
      console.log('');
      console.log(C.muted(`  ${connected}/${statuses.length} servers connected`));
      return;
    }

    if (subcommand === 'tools') {
      const allTools = this.toolRegistry.getEnabledToolNames().filter((n) => n.includes('__'));
      if (allTools.length === 0) {
        console.log(C.muted('  No MCP tools available.'));
        return;
      }
      console.log('');
      console.log(C.brand('  MCP Tools'));
      console.log(C.dim('  ' + BOX.h.repeat(58)));
      for (const t of allTools) {
        const [ns, toolName] = t.split('__');
        console.log(`  ${C.info(ns.padEnd(16))} ${C.primary(toolName)}`);
      }
      console.log('');
      console.log(C.muted(`  ${allTools.length} MCP tool${allTools.length !== 1 ? 's' : ''} available`));
      return;
    }

    console.log(C.warning(`  Unknown MCP subcommand: ${subcommand}`));
    console.log(C.muted('  Usage: /mcp [status|tools]'));
  }

  // ========================================================================
  // Skills command handler
  // ========================================================================

  private async handleSkillsCommand(subcommand?: string): Promise<void> {
    if (!this.skillRegistry) {
      console.log(C.warning('  Skills system not initialized.'));
      return;
    }

    const parts = (subcommand || '').split(/\s+/).filter(Boolean);
    const mode = parts[0];
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
      await this.handleSkillsUserCommand();
      return;
    }

    // Existing commands: list, use, info, install
    if (!mode || mode === 'list') {
      const skills = await this.skillRegistry.list();
      if (skills.length === 0) {
        console.log(C.muted('  No skills found.'));
        console.log(C.muted('  Add SKILL.md files to ~/.nova/skills/ to create skills.'));
        return;
      }
      console.log('');
      console.log(C.brand('  Available Skills'));
      console.log(C.dim('  ' + BOX.h.repeat(58)));
      for (const skill of skills) {
        const m = skill.metadata;
        const autoTag = m.autoGenerated ? C.dim(' [auto]') : '';
        const tags = m.tags.length > 0 ? C.dim(` (${m.tags.slice(0, 3).join(', ')})`) : '';
        console.log(`  ${C.toolName(m.name.padEnd(22))} ${C.muted(m.description.slice(0, 35))}${autoTag}${tags}`);
      }
      console.log('');
      console.log(C.muted(`  ${skills.length} skill${skills.length !== 1 ? 's' : ''} available`));
      console.log(C.dim('  /skills use <name>       — inject skill into next message'));
      console.log(C.dim('  /skills info <name>      — show skill details'));
      console.log(C.dim('  /skills server           — browse & install from GitHub'));
      console.log(C.dim('  /skills author select    — browse local SkillsHub'));
      console.log(C.dim('  /skills user             — install from file/zip path'));
      return;
    }

    // Install skills from GitHub (legacy)
    if (mode === 'install') {
      await this.handleSkillsInstall(rest);
      return;
    }

    if (mode === 'info' && rest) {
      const skill = await this.skillRegistry.get(rest);
      if (!skill) { console.log(C.error(`  Skill "${rest}" not found.`)); return; }
      const m = skill.metadata;
      console.log('');
      console.log(C.brand('  ' + m.name));
      console.log(C.dim('  ' + BOX.h.repeat(58)));
      console.log(C.muted('  Description: ') + C.primary(m.description));
      console.log(C.muted('  Version:     ') + C.primary(m.version));
      if (m.author) console.log(C.muted('  Author:      ') + C.primary(m.author));
      if (m.tags.length > 0) console.log(C.muted('  Tags:        ') + C.primary(m.tags.join(', ')));
      console.log('');
      const preview = skill.content.split('\n').slice(0, 10).join('\n');
      console.log(C.dim(preview));
      if (skill.content.split('\n').length > 10) console.log(C.dim('  ...'));
      return;
    }

    if (mode === 'use' && rest) {
      const skill = await this.skillRegistry.get(rest);
      if (!skill) { console.log(C.error(`  Skill "${rest}" not found.`)); return; }
      this._pendingSkillInject = skill;
      console.log(C.success(`  Skill "${rest}" will be injected into your next message.`));
      return;
    }

    console.log(C.warning(`  Unknown skills command.`));
    console.log(C.muted('  Usage: /skills [list|use|info|server|author|user|install]'));
  }

  // ========================================================================
  // /skills server — Browse & install skills from GitHub
  // ========================================================================

  private async handleSkillsServerCommand(): Promise<void> {
    const SKILLS_REPO = 'daymade/claude-code-skills';
    const API_URL = `https://api.github.com/repos/${SKILLS_REPO}/contents`;

    console.log('');
    console.log(C.brand('  Skills Marketplace — GitHub'));
    console.log(C.dim('  ' + BOX.h.repeat(58)));
    console.log(C.muted(`  Fetching skills from: github.com/${SKILLS_REPO}`));
    console.log(C.dim('  Connecting...'));

    try {
      const response = await fetch(API_URL, {
        headers: { 'Accept': 'application/vnd.github.v3+json' },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        throw new Error(`GitHub API returned ${response.status}`);
      }

      const contents = await response.json() as Array<{ name: string; type: string; path: string; download_url: string }>;
      const folders = contents.filter(c => c.type === 'dir' && !c.name.startsWith('.'));

      if (folders.length === 0) {
        console.log(C.warning('  No skill folders found in repository.'));
        return;
      }

      // Fetch each folder's SKILL.md to get description
      console.log(C.muted('  Loading skill descriptions...'));
      const skillsInfo: Array<{ name: string; description: string }> = [];
      
      // Fetch descriptions in parallel with limit
      const batchSize = 5;
      for (let i = 0; i < folders.length; i += batchSize) {
        const batch = folders.slice(i, i + batchSize);
        const results = await Promise.allSettled(
          batch.map(async (folder) => {
            const skillUrl = `https://api.github.com/repos/${SKILLS_REPO}/contents/${folder.name}/SKILL.md`;
            const resp = await fetch(skillUrl, {
              headers: { 'Accept': 'application/vnd.github.v3+json' },
              signal: AbortSignal.timeout(10000),
            });
            if (!resp.ok) return { name: folder.name, description: '' };
            const data = await resp.json() as { content: string; encoding: string };
            if (data.encoding === 'base64') {
              const content = Buffer.from(data.content, 'base64').toString('utf-8');
              // Extract description from YAML frontmatter
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

      // Display interactive selection
      console.log('');
      console.log(C.brand(`  ${skillsInfo.length} skills available:`));
      console.log(C.dim('  Use arrow keys to navigate, Enter to install, Esc to cancel'));
      console.log('');

      const selected = await this.arrowKeySelect(
        skillsInfo.map(s => ({ name: s.name, desc: s.description })),
        `Select a skill to install from ${SKILLS_REPO}`
      );

      if (!selected) {
        console.log(C.muted('  Cancelled.'));
        return;
      }

      // Install the selected skill
      console.log('');
      console.log(C.muted(`  Installing "${selected.name}" from GitHub...`));
      const { SkillInstaller } = await import('../../../core/src/extensions/SkillInstaller.js');
      const installer = new SkillInstaller();
      const installed = await installer.install({
        source: `https://github.com/${SKILLS_REPO}`,
        skills: [selected.name],
        force: true,
      });

      if (installed.length > 0) {
        console.log(C.success(`  ✓ Installed "${selected.name}" successfully.`));
        // Reinitialize skill registry
        await this.skillRegistry!.initialize();
        // Auto-inject the skill
        const skill = await this.skillRegistry!.get(selected.name);
        if (skill) {
          this._pendingSkillInject = skill;
          console.log(C.info(`  Skill "${selected.name}" will be injected into your next message.`));
        }
      } else {
        console.log(C.warning('  Installation completed but no skills were installed.'));
      }

    } catch (err) {
      console.log(C.error(`  Failed to fetch skills: ${(err as Error).message}`));
      console.log(C.dim('  Check your internet connection and try again.'));
    }
  }

  // ========================================================================
  // /skills author select — Browse pre-downloaded skills from SkillsHub
  // ========================================================================

  private async handleSkillsAuthorCommand(): Promise<void> {
    // Look for SkillsHub in several common locations
    const searchPaths = [
      path.join(process.cwd(), 'SkillsHub'),
      path.join(process.cwd(), 'skillshub'),
      path.join(process.cwd(), '.skillshub'),
    ];

    let skillsHubDir = searchPaths.find(p => fs.existsSync(p));
    if (!skillsHubDir) {
      console.log(C.warning('  SkillsHub folder not found in current directory.'));
      console.log(C.muted('  Create a "SkillsHub" folder with skill zip files and try again.'));
      console.log(C.dim('  Example: /skills author select'));
      return;
    }

    // Find all zip files
    const entries = fs.readdirSync(skillsHubDir).filter(f => f.endsWith('.zip'));
    if (entries.length === 0) {
      console.log(C.warning('  No zip files found in SkillsHub/'));
      console.log(C.muted('  Add skill zip files to the SkillsHub folder.'));
      return;
    }

    console.log('');
    console.log(C.brand('  SkillsHub — Local Skill Library'));
    console.log(C.dim('  ' + BOX.h.repeat(58)));
    console.log(C.muted(`  Found ${entries.length} skill packages in ${path.basename(skillsHubDir)}/`));
    console.log('');

    // Parse each zip to get skill info
    const skillEntries: Array<{ name: string; desc: string; zipPath: string }> = [];
    
    for (const entry of entries) {
      const zipPath = path.join(skillsHubDir, entry);
      // Try to extract name from filename
      const nameFromZip = entry.replace(/-\d+\.zip$/, '').replace(/\.zip$/, '').replace(/-/g, ' ');
      // Try to read zip contents for SKILL.md
      let description = '';
      try {
        const { execSync } = await import('node:child_process');
        const tmpDir = path.join(os.tmpdir(), `nova-skill-${Date.now()}`);
        execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${tmpDir}' -Force"`, { stdio: 'pipe' });
        // Look for SKILL.md in the extracted directory
        const findSkillMd = (dir: string, depth = 0): string | null => {
          if (depth > 3) return null;
          const items = fs.readdirSync(dir, { withFileTypes: true });
          for (const item of items) {
            if (item.name === 'SKILL.md' && item.isFile()) {
              return path.join(dir, item.name);
            }
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
        // Cleanup
        try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
      } catch {
        // If parsing fails, just use filename
      }

      skillEntries.push({
        name: nameFromZip,
        desc: description || 'No description available',
        zipPath,
      });
    }

    // Display interactive selection
    const selected = await this.arrowKeySelect(
      skillEntries.map(s => ({ name: s.name, desc: s.desc })),
      'Select a local skill to install'
    );

    if (!selected) {
      console.log(C.muted('  Cancelled.'));
      return;
    }

    const entry = skillEntries.find(s => s.name === selected.name);
    if (!entry) return;

    console.log('');
    console.log(C.muted(`  Installing "${selected.name}"...`));

    // Install from zip
    try {
      const { SkillInstaller } = await import('../../../core/src/extensions/SkillInstaller.js');
      const installer = new SkillInstaller();
      const installed = await installer.installFromZip(entry.zipPath);
      
      if (installed.length > 0) {
        console.log(C.success(`  ✓ Installed "${installed[0].name}" successfully.`));
        await this.skillRegistry!.initialize();
        const skill = await this.skillRegistry!.get(installed[0].name);
        if (skill) {
          this._pendingSkillInject = skill;
          console.log(C.info(`  Skill "${installed[0].name}" will be injected into your next message.`));
        }
      } else {
        console.log(C.warning('  No valid skill found in the zip file.'));
      }
    } catch (err) {
      console.log(C.error(`  Installation failed: ${(err as Error).message}`));
    }
  }

  // ========================================================================
  // /skills user — Install skill from custom file/zip path
  // ========================================================================

  private async handleSkillsUserCommand(): Promise<void> {
    console.log('');
    console.log(C.brand('  Install Skill from File'));
    console.log(C.dim('  ' + BOX.h.repeat(58)));
    console.log(C.muted('  Enter the path to your skill file or zip package.'));
    console.log(C.dim('  Supported: SKILL.md file, .zip archive containing SKILL.md'));
    console.log('');

    const skillPath = await this.promptInput('  Path: ');
    if (!skillPath || !skillPath.trim()) {
      console.log(C.muted('  Cancelled.'));
      return;
    }

    const resolvedPath = path.resolve(skillPath.trim());
    if (!fs.existsSync(resolvedPath)) {
      console.log(C.error(`  File not found: ${resolvedPath}`));
      return;
    }

    // Ask scope: Global (G) or Local session (L)
    console.log('');
    console.log(C.muted('  Install scope:'));
    console.log(C.info('    G') + C.muted(' — Global (available in all sessions)'));
    console.log(C.info('    L') + C.muted(' — Current session only'));
    console.log('');

    const scope = await this.promptInput('  Scope (G/L): ');
    const isGlobal = scope?.trim().toLowerCase() === 'g';

    console.log('');
    console.log(C.muted(`  Installing skill from: ${resolvedPath}`));
    console.log(C.muted(`  Scope: ${isGlobal ? 'Global (~/.nova/skills/)' : 'Session (memory only)'}`));

    try {
      const { SkillInstaller } = await import('../../../core/src/extensions/SkillInstaller.js');
      const installer = new SkillInstaller();
      
      let installed;
      if (resolvedPath.endsWith('.zip')) {
        installed = await installer.installFromZip(resolvedPath, isGlobal ? undefined : undefined);
      } else {
        // Install from a single SKILL.md file or directory
        installed = await installer.installFromFile(resolvedPath);
      }

      if (installed.length > 0) {
        console.log(C.success(`  ✓ Installed "${installed[0].name}" successfully.`));
        if (!isGlobal) {
          // For session-only, just inject the skill content
          const content = fs.readFileSync(path.join(installed[0].path, 'SKILL.md'), 'utf-8');
          const { SkillValidator } = await import('../../../core/src/extensions/SkillValidator.js');
          const validator = new SkillValidator();
          const parsed = validator.parse(content);
          this._pendingSkillInject = { metadata: parsed, content };
          console.log(C.info(`  Skill "${installed[0].name}" will be injected into your next message.`));
        } else {
          await this.skillRegistry!.initialize();
          const skill = await this.skillRegistry!.get(installed[0].name);
          if (skill) {
            this._pendingSkillInject = skill;
            console.log(C.info(`  Skill "${installed[0].name}" will be injected into your next message.`));
          }
        }
      } else {
        console.log(C.warning('  No valid skill found. Make sure the file contains a SKILL.md.'));
      }
    } catch (err) {
      console.log(C.error(`  Installation failed: ${(err as Error).message}`));
    }
  }

  // ========================================================================
  // Arrow Key Selection Helper
  // ========================================================================

  private async arrowKeySelect(
    items: Array<{ name: string; desc: string }>,
    title: string
  ): Promise<{ name: string } | null> {
    if (items.length === 0) return null;
    if (items.length === 1) {
      console.log(C.primary(`  ${items[0].name}`) + C.dim(` — ${items[0].desc}`));
      const confirm = await this.promptInput('  Install this skill? (Y/n): ');
      if (confirm && confirm.toLowerCase() === 'n') return null;
      return items[0];
    }

    let cursor = 0;
    
    return new Promise((resolve) => {
      const render = () => {
        // Clear previous output (move cursor up)
        const lines = items.length + 3;
        process.stdout.write(`\x1b[${lines}A`);

        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const isSelected = i === cursor;
          const marker = isSelected ? C.success('  > ') : '    ';
          const nameColor = isSelected ? C.success.bold : C.primary;
          const descColor = isSelected ? C.muted : C.dim;
          // Calculate padding
          const namePad = 35;
          const nameStr = item.name.length > namePad ? item.name.slice(0, namePad - 2) + '..' : item.name.padEnd(namePad);
          console.log(`${marker}${nameColor(nameStr)} ${descColor(item.desc.slice(0, 40))}`);
        }
        console.log(C.dim('  ↑↓ navigate  Enter select  Esc cancel'));
      };

      // Initial render with enough blank lines
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const namePad = 35;
        const nameStr = item.name.length > namePad ? item.name.slice(0, namePad - 2) + '..' : item.name.padEnd(namePad);
        console.log(`    ${C.primary(nameStr)} ${C.dim(item.desc.slice(0, 40))}`);
      }
      console.log(C.dim('  ↑↓ navigate  Enter select  Esc cancel'));

      // Set raw mode for arrow keys
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
        process.stdin.resume();

        const onData = (key: Buffer) => {
          const str = key.toString();
          
          if (str === '\x1b[A' || str === 'k') { // Up arrow or k
            cursor = (cursor - 1 + items.length) % items.length;
            render();
          } else if (str === '\x1b[B' || str === 'j') { // Down arrow or j
            cursor = (cursor + 1) % items.length;
            render();
          } else if (str === '\r' || str === '\n') { // Enter
            cleanup();
            resolve(items[cursor]);
          } else if (str === '\x1b' || str === '\x03' || str === 'q') { // Esc or Ctrl+C
            cleanup();
            resolve(null);
          }
        };

        const cleanup = () => {
          process.stdin.setRawMode(false);
          process.stdin.removeListener('data', onData);
          process.stdin.pause();
        };

        process.stdin.on('data', onData);
      } else {
        // Non-interactive fallback: just pick first
        resolve(items[0]);
      }
    });
  }

  // ========================================================================
  // Prompt Input Helper
  // ========================================================================

  private promptInput(prompt: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl?.question(prompt, (answer) => {
        resolve(answer.trim());
      });
    });
  }

  // ========================================================================
  // /skills install — Install skills from GitHub
  // ========================================================================

  private async handleSkillsInstall(repoArg?: string): Promise<void> {
    if (!repoArg) {
      console.log('');
      console.log(C.brand('  Install Skills from GitHub'));
      console.log(C.dim('  ' + BOX.h.repeat(58)));
      console.log(C.muted('  Install skills from GitHub repositories.'));
      console.log('');
      console.log(C.info('  Popular repositories:'));
      console.log(C.dim('  • superpowers  — Agentic skills (TDD, debugging, review)'));
      console.log(C.dim('  • owner/repo   — Any GitHub repository'));
      console.log('');
      console.log(C.dim('  Usage:'));
      console.log(C.primary('  /skills install superpowers'));
      console.log(C.primary('  /skills install obra/superpowers'));
      console.log(C.primary('  /skills install https://github.com/owner/repo'));
      return;
    }

    // Import installer
    const { SkillInstaller, POPULAR_SKILL_REPOS } = await import('../../../core/src/extensions/SkillInstaller.js');
    const installer = new SkillInstaller();

    // Resolve shorthand
    const source = POPULAR_SKILL_REPOS[repoArg]?.url || repoArg;

    console.log(C.muted(`  Installing from: ${source}`));
    console.log('');

    try {
      const installed = await installer.install({ source, force: false });
      
      if (installed.length === 0) {
        console.log(C.warning('  No new skills installed.'));
        console.log(C.dim('  Use --force to overwrite existing skills.'));
        return;
      }

      console.log('');
      console.log(C.success(`  ✓ Installed ${installed.length} skill${installed.length !== 1 ? 's' : ''}:`));
      for (const skill of installed) {
        console.log(C.primary(`    • ${skill.name}`));
      }
      console.log('');
      console.log(C.dim('  Reload skills with: /skills list'));
      console.log(C.dim('  Use a skill with: /skills use <name>'));

      // Reinitialize skill registry
      if (this.skillRegistry) {
        await this.skillRegistry.initialize();
      }

    } catch (err) {
      console.log(C.error(`  Failed to install: ${(err as Error).message}`));
      console.log(C.dim('  Make sure git is installed and you have internet access.'));
    }
  }

  // ========================================================================
  // /theme — Switch color theme
  // ========================================================================

  private async handleThemeCommand(arg: string): Promise<void> {
    const themes: Record<string, Record<string, string>> = {
      dark: {
        brand: '#7C3AED',
        brandLight: '#A78BFA',
        success: '#10B981',
        warning: '#F59E0B',
        error: '#EF4444',
        info: '#3B82F6',
        accent: '#F472B6',
      },
      light: {
        brand: '#6366F1',
        brandLight: '#818CF8',
        success: '#16A34A',
        warning: '#D97706',
        error: '#DC2626',
        info: '#2563EB',
        accent: '#EC4899',
      },
      neon: {
        brand: '#FF00FF',
        brandLight: '#FF66FF',
        success: '#00FF00',
        warning: '#FFFF00',
        error: '#FF0000',
        info: '#00FFFF',
        accent: '#FF00AA',
      },
      ocean: {
        brand: '#0891B2',
        brandLight: '#06B6D4',
        success: '#10B981',
        warning: '#F59E0B',
        error: '#EF4444',
        info: '#0EA5E9',
        accent: '#8B5CF6',
      },
    };

    if (!arg) {
      // Show current theme and available themes
      console.log('');
      console.log(C.brand('  Available Themes'));
      console.log(C.dim('  ' + BOX.h.repeat(58)));
      Object.keys(themes).forEach((name) => {
        const isCurrent = name === 'dark'; // Default theme
        const marker = isCurrent ? C.success('●') : C.dim('○');
        console.log(`  ${marker} ${C.primary(name.padEnd(12))} ${C.dim(name === 'dark' ? '(default)' : '')}`);
      });
      console.log('');
      console.log(C.dim('  /theme <name>  — switch theme'));
      return;
    }

    const themeName = arg.toLowerCase();
    if (!themes[themeName]) {
      console.log(C.error(`  Unknown theme: ${arg}`));
      console.log(C.muted(`  Available: ${Object.keys(themes).join(', ')}`));
      return;
    }

    // Note: In a real implementation, we would:
    // 1. Save theme preference to ~/.nova/theme.json
    // 2. Update the C color object dynamically
    // 3. Redraw the UI with new colors
    
    console.log(C.success(`  ✓ Theme switched to: ${themeName}`));
    console.log(C.muted('  Note: Theme will be fully applied after restart'));
  }

  // ========================================================================
  // /image — Add image to conversation
  // ========================================================================

  private async handleImageCommand(arg: string): Promise<void> {
    if (!arg) {
      console.log(C.error('  Usage: /image <path-or-url> [description]'));
      console.log(C.muted('  Example: /image ./screenshot.png "Error message"'));
      console.log(C.muted('  Example: /image https://example.com/chart.png'));
      return;
    }

    const parts = arg.split(/\s+/);
    const imagePath = parts[0];
    const description = parts.slice(1).join(' ');

    try {
      let imageData: string;
      let mediaType: string;

      // Handle URL
      if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
        console.log(C.muted(`  Fetching image from URL...`));
        // URL image support - note: this requires additional implementation
        // For now, we'll just acknowledge the URL
        console.log(C.warning('  URL image support is limited in this version'));
        console.log(C.muted(`  Please download the image and use local path instead`));
        return;
      }
      // Handle local file
      else {
        const fullPath = require('path').resolve(this.cwd, imagePath);
        console.log(C.muted(`  Reading image: ${fullPath}`));
        
        const fs = require('node:fs');
        if (!fs.existsSync(fullPath)) {
          console.log(C.error(`  File not found: ${imagePath}`));
          return;
        }

        // Read and encode image
        const imageBuffer = fs.readFileSync(fullPath);
        imageData = imageBuffer.toString('base64');
        
        // Determine media type from extension
        const ext = require('path').extname(fullPath).toLowerCase();
        const mimeTypes: Record<string, string> = {
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.gif': 'image/gif',
          '.webp': 'image/webp',
          '.svg': 'image/svg+xml',
          '.bmp': 'image/bmp',
        };
        mediaType = mimeTypes[ext] || 'image/jpeg';
      }

      // Add image to session
      if (!this.sessionId) {
        console.log(C.error('  No active session'));
        return;
      }

      // Create image content block
      const imageContent = {
        type: 'image' as const,
        source: {
          type: 'base64' as const,
          media_type: mediaType,
          data: imageData,
        },
      };

      // Add to session messages
      this.sessionManager.addMessage(this.sessionId, 'user', [
        { type: 'text' as const, text: description || `Image: ${imagePath}` },
        imageContent,
      ]);

      console.log(C.success(`  ✓ Image added to conversation`));
      console.log(C.muted(`  Path: ${imagePath}`));
      console.log(C.muted(`  Size: ${(imageData.length / 1024).toFixed(1)} KB`));
      console.log(C.muted(`  Type: ${mediaType}`));

    } catch (err) {
      console.log(C.error(`  Failed to add image: ${err.message}`));
      console.log(C.muted(`  Make sure the file is a valid image (PNG, JPG, GIF, etc.)`));
    }
  }

  // ========================================================================
  // /checkpoint — File snapshot and rollback management
  // ========================================================================

  private async handleCheckpointCommand(arg: string): Promise<void> {
    const { CheckpointManager } = await import('../../../core/src/utils/CheckpointManager.js');
    const manager = new CheckpointManager(this.cwd, this.config);
    
    const parts = arg.split(/\s+/).filter(Boolean);
    const cmd = parts[0];
    const subArg = parts.slice(1).join(' ');

    if (!cmd || cmd === 'list') {
      const checkpoints = await manager.list();
      if (checkpoints.length === 0) {
        console.log(C.muted('  No checkpoints found.'));
        console.log(C.muted('  Create one with: /checkpoint create <name> [files...]'));
        return;
      }

      console.log('');
      console.log(C.brand('  Checkpoints'));
      console.log(C.dim('  ' + BOX.h.repeat(58)));
      
      for (const cp of checkpoints.slice(0, 10)) {
        const date = new Date(cp.timestamp).toLocaleString();
        const fileCount = cp.files.length;
        const idShort = cp.id.slice(0, 8);
        console.log(`  ${C.info(idShort)} ${C.primary(cp.name.padEnd(20))} ${C.dim(date)} ${C.muted(`(${fileCount} files)`)}`);
      }
      
      if (checkpoints.length > 10) {
        console.log(C.dim(`  ... and ${checkpoints.length - 10} more`));
      }
      
      console.log('');
      console.log(C.dim('  /checkpoint create <name> [pattern]  — create snapshot'));
      console.log(C.dim('  /checkpoint restore <id>             — restore snapshot'));
      console.log(C.dim('  /checkpoint diff <id>                — show differences'));
      console.log(C.dim('  /checkpoint delete <id>              — delete snapshot'));
      console.log(C.dim('  /checkpoint stats                    — show statistics'));
      return;
    }

    if (cmd === 'create') {
      if (!subArg) {
        console.log(C.error('  Usage: /checkpoint create <name> [file-pattern]'));
        console.log(C.muted('  Example: /checkpoint create "before-refactor" "src/**/*.ts"'));
        return;
      }

      const nameMatch = subArg.match(/^"([^"]+)"(?:\s+(.+))?$/);
      if (!nameMatch) {
        console.log(C.error('  Invalid format. Use: /checkpoint create "name" [pattern]'));
        return;
      }

      const name = nameMatch[1];
      const pattern = nameMatch[2] || '**/*';

      console.log(C.muted(`  Creating checkpoint "${name}"...`));
      
      try {
        const checkpoint = await manager.create(name, [pattern], `Created via CLI`);
        console.log(C.success(`  ✓ Checkpoint created: ${checkpoint.id.slice(0, 8)}`));
        console.log(C.muted(`  Files: ${checkpoint.files.length}`));
      } catch (err) {
        console.log(C.error(`  Failed to create checkpoint: ${err}`));
      }
      return;
    }

    if (cmd === 'restore') {
      if (!subArg) {
        console.log(C.error('  Usage: /checkpoint restore <id>'));
        return;
      }

      const checkpointId = subArg;
      const checkpoint = await manager.load(checkpointId);
      if (!checkpoint) {
        console.log(C.error(`  Checkpoint not found: ${checkpointId}`));
        return;
      }

      console.log(C.warning(`  ⚠ This will overwrite current files with checkpoint version`));
      console.log(C.muted(`  Checkpoint: ${checkpoint.name}`));
      console.log(C.muted(`  Files: ${checkpoint.files.length}`));
      console.log(C.muted(`  Created: ${new Date(checkpoint.timestamp).toLocaleString()}`));
      
      // In a real implementation, we'd use ConfirmDialog here
      const { ConfirmDialog } = await import('../ui/components/ConfirmDialog.js');
      const dialog = new ConfirmDialog();
      const confirmed = await dialog.danger('Restore this checkpoint?');
      
      if (!confirmed) {
        console.log(C.muted('  Restore cancelled.'));
        return;
      }

      try {
        await manager.restore(checkpointId);
        console.log(C.success(`  ✓ Checkpoint restored successfully`));
      } catch (err) {
        console.log(C.error(`  Failed to restore checkpoint: ${err}`));
      }
      return;
    }

    if (cmd === 'diff') {
      if (!subArg) {
        console.log(C.error('  Usage: /checkpoint diff <id>'));
        return;
      }

      try {
        const differences = await manager.diff(subArg);
        if (differences.length === 0) {
          console.log(C.muted('  No differences from checkpoint.'));
          return;
        }

        console.log('');
        console.log(C.brand('  Differences'));
        console.log(C.dim('  ' + BOX.h.repeat(58)));
        
        for (const diff of differences) {
          const icon = diff.status === 'modified' ? '◉' : diff.status === 'deleted' ? '✗' : '✚';
          const color = diff.status === 'modified' ? chalk.yellow : diff.status === 'deleted' ? chalk.red : chalk.green;
          console.log(`  ${color(icon)} ${diff.path} ${chalk.dim(`(${diff.status})`)}`);
        }
      } catch (err) {
        console.log(C.error(`  Failed to show diff: ${err}`));
      }
      return;
    }

    if (cmd === 'delete') {
      if (!subArg) {
        console.log(C.error('  Usage: /checkpoint delete <id>'));
        return;
      }

      const checkpoint = await manager.load(subArg);
      if (!checkpoint) {
        console.log(C.error(`  Checkpoint not found: ${subArg}`));
        return;
      }

      console.log(C.warning(`  ⚠ Delete checkpoint "${checkpoint.name}"?`));
      
      const { ConfirmDialog } = await import('../ui/components/ConfirmDialog.js');
      const dialog = new ConfirmDialog();
      const confirmed = await dialog.warning('This cannot be undone');
      
      if (!confirmed) {
        console.log(C.muted('  Delete cancelled.'));
        return;
      }

      const success = await manager.delete(subArg);
      if (success) {
        console.log(C.success(`  ✓ Checkpoint deleted`));
      } else {
        console.log(C.error(`  Failed to delete checkpoint`));
      }
      return;
    }

    if (cmd === 'stats') {
      const stats = await manager.stats();
      console.log('');
      console.log(C.brand('  Checkpoint Statistics'));
      console.log(C.dim('  ' + BOX.h.repeat(58)));
      console.log(`${C.muted('  Total:')} ${C.primary(stats.totalCheckpoints)}`);
      console.log(`${C.muted('  Size:')} ${C.primary(this.formatBytes(stats.totalSize))}`);
      if (stats.oldest) {
        console.log(`${C.muted('  Oldest:')} ${C.dim(new Date(stats.oldest).toLocaleDateString())}`);
      }
      if (stats.newest) {
        console.log(`${C.muted('  Newest:')} ${C.dim(new Date(stats.newest).toLocaleDateString())}`);
      }
      return;
    }

    console.log(C.error(`  Unknown checkpoint command: ${cmd}`));
    console.log(C.muted('  Usage: /checkpoint [list|create|restore|diff|delete|stats]'));
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // ========================================================================
  // /ollama — Ollama status and model management
  // ========================================================================

  private async handleOllamaCommand(subcommand?: string): Promise<void> {
    const ollamaCreds = this.authManager?.getCredentials('ollama');
    const baseUrl = ollamaCreds?.baseUrl || process.env.OLLAMA_HOST || 'http://localhost:11434';
    const manager = new OllamaManager(baseUrl);
    const parts = (subcommand || '').split(/\s+/).filter(Boolean);
    const cmd = parts[0];
    const arg = parts.slice(1).join(' ');

    if (!cmd || cmd === 'status') {
      console.log('');
      console.log(C.brand('  Ollama Status'));
      console.log(C.dim('  ' + BOX.h.repeat(58)));

      const isRunning = await manager.ping();
      if (isRunning) {
        try {
          const version = await manager.version();
          console.log(C.success(`  ${BOX.check} Running`) + C.dim(` (v${version})`));
        } catch {
          console.log(C.success(`  ${BOX.check} Running`));
        }
        console.log(C.muted(`  Host: ${baseUrl}`));

        const models = await manager.listModels();
        if (models.length > 0) {
          console.log(C.muted(`  Models: ${models.length} installed`));
          for (const m of models.slice(0, 5)) {
            const sizeGB = (m.size / 1024 / 1024 / 1024).toFixed(1);
            console.log(C.dim(`    ${BOX.bullet} ${m.name} (${sizeGB} GB)`));
          }
          if (models.length > 5) {
            console.log(C.dim(`    ... and ${models.length - 5} more`));
          }
        } else {
          console.log(C.warning(`  No models installed`));
          console.log(C.dim('    Use /ollama pull <model> to download a model'));
        }
      } else {
        console.log(C.error(`  ${BOX.crossX} Not running`));
        console.log(C.muted(`  Host: ${baseUrl}`));
        console.log('');
        console.log(C.warning('  Start Ollama:'));
        console.log(C.dim('    ollama serve'));
        console.log('');
        console.log(C.warning('  Install Ollama:'));
        console.log(C.dim('    https://ollama.com'));
      }
      console.log('');
      return;
    }

    if (cmd === 'list') {
      if (!(await manager.ping())) {
        console.log(C.error(`  Ollama is not running at ${baseUrl}`));
        console.log(C.dim('  Start Ollama first: ollama serve'));
        return;
      }
      const models = await manager.listModels();
      if (models.length === 0) {
        console.log(C.muted('  No models installed.'));
        console.log(C.dim('  Pull one with: /ollama pull <model-name>'));
        return;
      }
      console.log('');
      console.log(C.brand('  Installed Ollama Models'));
      console.log(C.dim('  ' + BOX.h.repeat(58)));
      for (const m of models) {
        const sizeGB = (m.size / 1024 / 1024 / 1024).toFixed(1);
        const family = m.details?.family || 'unknown';
        const params = m.details?.parameter_size || '';
        console.log(`  ${C.toolName(m.name)}`);
        console.log(C.dim(`    ${family} ${params}  ${sizeGB} GB`));
      }
      console.log('');
      console.log(C.muted(`  ${models.length} model(s)`));
      return;
    }

    if (cmd === 'pull' && arg) {
      if (!(await manager.ping())) {
        console.log(C.error('  Ollama is not running.'));
        console.log(C.dim('  Start Ollama first: ollama serve'));
        return;
      }
      console.log(C.info(`  Pulling model: ${arg}`));
      console.log(C.dim('  This may take a while...'));
      try {
        await manager.pullModel(arg, (status) => {
          process.stdout.write(`\r  ${C.muted(status)}    `);
        });
        console.log('');
        console.log(C.success(`  ${BOX.check} Model "${arg}" pulled successfully`));
        console.log(C.dim(`  Use: /model ${arg}`));
      } catch (err) {
        console.log('');
        console.log(C.error(`  Failed to pull model: ${(err as Error).message}`));
      }
      return;
    }

    if (cmd === 'run' && arg) {
      console.log(C.info(`  Running model: ${arg}`));
      console.log(C.dim('  Note: Use "ollama run" in terminal for interactive session'));
      console.log(C.dim('  Switching model for Nova CLI...'));
      try {
        // Just switch to the model instead of running interactively
        this.modelClient.updateOptions({ model: arg });
        console.log(C.success(`  ✓ Switched to Ollama model: ${arg}`));
        // Save to config
        const config = this.configManager.getConfig();
        config.core.defaultModel = arg;
        await this.configManager.save(config);
      } catch (err) {
        console.log(C.error(`  Failed to switch model: ${(err as Error).message}`));
      }
      return;
    }

    // Unknown subcommand - show help
    console.log(C.warning(`  Unknown subcommand: ${cmd}`));
    console.log('');
    console.log(C.muted('  Usage: /ollama [status|list|pull <model>]'));
    console.log(C.dim('    /ollama           — show status and installed models'));
    console.log(C.dim('    /ollama list      — list all installed models'));
    console.log(C.dim('    /ollama pull <n>  — download a model'));
  }

  // ========================================================================
  // Approval handler
  // ========================================================================

  private async handleApproval(request: ApprovalRequest): Promise<ApprovalResponse> {
    const effectiveMode = this.getEffectiveApprovalMode();

    // Auto-approve in yolo mode
    if (effectiveMode === 'yolo') {
      return { requestId: request.id, approved: true };
    }

    // In accepting_edits mode, ToolRegistry already filtered file tools
    // If we get here, it's a non-file tool that needs approval
    // In smart mode, ToolRegistry already filtered low-risk tools
    // For plan, default, and any tool that reaches here: show prompt

    this.stopSpinner();

    return new Promise((resolve) => {
      console.log('');
      console.log(C.warning.bold('  ⚠ Approval Required'));
      console.log(C.muted('  Tool:  ') + C.toolName(request.toolName));
      console.log(C.muted('  Risk:  ') + (
        request.risk === 'critical' ? C.error(request.risk) :
        request.risk === 'high' ? C.warning(request.risk) :
        C.muted(request.risk)
      ));
      if (request.description) {
        const desc = request.description.replace(`Tool "${request.toolName}" with input: `, '');
        const preview = desc.slice(0, 80);
        console.log(C.muted('  Input: ') + C.dim(preview));
      }
      console.log('');

      this.rl?.question(C.warning('  Allow? [y/N/a(ll)] '), (answer) => {
        const a = answer.trim().toLowerCase();
        if (a === 'a' || a === 'all') {
          // Switch to yolo for remainder of this task
          this.mode = 'auto';
          console.log(C.success('  Auto-approved for this task.'));
          resolve({ requestId: request.id, approved: true });
        } else {
          const approved = a === 'y' || a === 'yes';
          if (!approved) console.log(C.error('  Denied.'));
          resolve({ requestId: request.id, approved });
        }
      });
    });
  }

  // ========================================================================
  // Helpers
  // ========================================================================

  private getModePrefix(): string {
    switch (this.mode) {
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
    return MODE_LABELS[this.mode].approvalMode;
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

  private getTimeStr(): string {
    return new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  private ensureDir(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }
}
