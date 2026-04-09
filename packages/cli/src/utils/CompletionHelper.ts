// ============================================================================
// Completion Helper - 命令自动补全助手
// ============================================================================

import { CliUI, Colors } from './CliUI.ts';

/**
 * 补全项
 */
export interface CompletionItem {
  text: string;
  description?: string;
  type?: 'command' | 'argument' | 'option' | 'file' | 'directory';
}

/**
 * 补全上下文
 */
export interface CompletionContext {
  command?: string;
  subcommand?: string;
  args: string[];
  currentArg: string;
  argIndex: number;
}

/**
 * 命令定义
 */
interface CommandDefinition {
  name: string;
  description: string;
  subcommands?: Record<string, SubcommandDefinition>;
  options?: OptionDefinition[];
  args?: ArgumentDefinition[];
}

/**
 * 子命令定义
 */
interface SubcommandDefinition {
  name: string;
  description: string;
  options?: OptionDefinition[];
  args?: ArgumentDefinition[];
}

/**
 * 选项定义
 */
interface OptionDefinition {
  name: string;
  short?: string;
  description: string;
  type?: 'string' | 'number' | 'boolean';
  requiresValue?: boolean;
}

/**
 * 参数定义
 */
interface ArgumentDefinition {
  name: string;
  description: string;
  type?: 'string' | 'number' | 'file' | 'directory';
}

/**
 * 命令自动补全助手
 */
export class CompletionHelper {
  private static commands: Map<string, CommandDefinition> = new Map();
  private static initialized = false;

  /**
   * 初始化命令定义
   */
  private static initialize(): void {
    if (this.initialized) return;

    // 核心命令
    this.registerCommand({
      name: 'init',
      description: 'Analyze project and initialize context',
      args: [],
    });

    this.registerCommand({
      name: 'config',
      description: 'Manage configuration',
      subcommands: {
        show: { name: 'show', description: 'Show current configuration' },
        edit: { name: 'edit', description: 'Open config file in editor' },
      },
    });

    this.registerCommand({
      name: 'auth',
      description: 'Manage API credentials',
      subcommands: {
        set: {
          name: 'set',
          description: 'Set API key for a provider',
          args: [{ name: 'provider', description: 'Provider name (anthropic, openai, etc.)' }],
          options: [
            { name: '--key', description: 'API key' },
            { name: '--base-url', description: 'Base URL' },
          ],
        },
        remove: {
          name: 'remove',
          description: 'Remove credentials for a provider',
          args: [{ name: 'provider', description: 'Provider name' }],
        },
        status: { name: 'status', description: 'Show credential status' },
      },
    });

    this.registerCommand({
      name: 'model',
      description: 'Manage AI models',
      subcommands: {
        list: { name: 'list', description: 'List available models' },
        switch: { name: 'switch', description: 'Switch to a model', args: [{ name: 'model-id', description: 'Model ID' }] },
      },
    });

    this.registerCommand({
      name: 'provider',
      description: 'Manage custom providers',
      subcommands: {
        add: { name: 'add', description: 'Add a custom provider' },
        'add-model': { name: 'add-model', description: 'Add a model to a provider' },
        remove: { name: 'remove', description: 'Remove a provider' },
        list: { name: 'list', description: 'List all providers' },
      },
    });

    this.registerCommand({
      name: 'mcp',
      description: 'Manage MCP servers',
      subcommands: {
        status: { name: 'status', description: 'Show MCP server status' },
        list: { name: 'list', description: 'List MCP servers' },
      },
    });

    this.registerCommand({
      name: 'skills',
      description: 'Manage skills',
      subcommands: {
        list: { name: 'list', description: 'List available skills' },
        add: {
          name: 'add',
          description: 'Add a skill from local file',
          args: [
            { name: 'scope', description: 'Scope: global (all sessions) or local (current session only)', type: 'string' },
            { name: 'file-path', description: 'Path to skill file (supports YAML frontmatter format)', type: 'file' }
          ],
        },
        rm: {
          name: 'rm',
          description: 'Remove a skill',
          args: [{ name: 'skill-name', description: 'Name of the skill to remove', type: 'string' }],
        },
      },
    });

    this.registerCommand({
      name: 'coding-plan',
      description: 'Manage Coding Plan providers',
      subcommands: {
        list: { name: 'list', description: 'List Coding Plan platforms' },
        add: { name: 'add', description: 'Add a Coding Plan provider' },
      },
    });

    this.registerCommand({
      name: 'project',
      description: 'Analyze and understand project structure',
      subcommands: {
        analyze: { name: 'analyze', description: 'Analyze current project and generate documentation' },
      },
    });

    this.registerCommand({
      name: 'ollama',
      description: 'Manage Ollama',
      subcommands: {
        list: { name: 'list', description: 'List local models' },
        pull: { name: 'pull', description: 'Pull a model' },
        rm: { name: 'rm', description: 'Remove a model' },
        info: { name: 'info', description: 'Show model info' },
        run: { name: 'run', description: 'Run a model' },
      },
    });

    this.initialized = true;
  }

  /**
   * 注册命令
   */
  static registerCommand(cmd: CommandDefinition): void {
    this.commands.set(cmd.name, cmd);
  }

  /**
   * 获取补全建议
   */
  static getCompletions(context: CompletionContext): CompletionItem[] {
    this.initialize();

    const completions: CompletionItem[] = [];

    // 如果没有命令,补全命令
    if (!context.command) {
      return this.getCommandCompletions();
    }

    const command = this.commands.get(context.command);
    if (!command) {
      return [];
    }

    // 如果有子命令但没有输入子命令,补全子命令
    if (command.subcommands && !context.subcommand) {
      return this.getSubcommandCompletions(command.subcommands);
    }

    // 补全选项
    const options = this.getOptionsForContext(command, context.subcommand);
    completions.push(...this.getOptionCompletions(options));

    // 补全参数
    const args = this.getArgsForContext(command, context.subcommand);
    completions.push(...this.getArgCompletions(args, context));

    return completions;
  }

  /**
   * 获取命令补全
   */
  private static getCommandCompletions(): CompletionItem[] {
    return Array.from(this.commands.values()).map(cmd => ({
      text: cmd.name,
      description: cmd.description,
      type: 'command',
    }));
  }

  /**
   * 获取子命令补全
   */
  private static getSubcommandCompletions(subcommands: Record<string, SubcommandDefinition>): CompletionItem[] {
    return Object.values(subcommands).map(sub => ({
      text: sub.name,
      description: sub.description,
      type: 'command',
    }));
  }

  /**
   * 获取选项补全
   */
  private static getOptionCompletions(options: OptionDefinition[]): CompletionItem[] {
    return options.map(opt => {
      const texts = [];
      if (opt.short) texts.push(opt.short);
      texts.push(opt.name);

      return {
        text: texts[0],
        description: opt.description || texts.join(', '),
        type: 'option',
      };
    });
  }

  /**
   * 获取参数补全
   */
  private static getArgCompletions(args: ArgumentDefinition[], context: CompletionContext): CompletionItem[] {
    const currentArgIndex = context.argIndex;

    if (currentArgIndex >= args.length) {
      return [];
    }

    const arg = args[currentArgIndex];
    if (!arg) {
      return [];
    }

    // 如果是文件或目录类型,可以添加文件/目录补全
    if (arg.type === 'file' || arg.type === 'directory') {
      return [{
        text: context.currentArg,
        description: arg.description,
        type: arg.type as 'file' | 'directory',
      }];
    }

    return [{
      text: arg.name,
      description: arg.description,
      type: 'argument',
    }];
  }

  /**
   * 获取上下文的选项
   */
  private static getOptionsForContext(command: CommandDefinition, subcommand?: string): OptionDefinition[] {
    if (!subcommand) {
      return command.options || [];
    }

    const sub = command.subcommands?.[subcommand];
    return sub?.options || [];
  }

  /**
   * 获取上下文的参数
   */
  private static getArgsForContext(command: CommandDefinition, subcommand?: string): ArgumentDefinition[] {
    if (!subcommand) {
      return command.args || [];
    }

    const sub = command.subcommands?.[subcommand];
    return sub?.args || [];
  }

  /**
   * 显示补全提示
   */
  static showCompletionTip(context: CompletionContext): void {
    const completions = this.getCompletions(context);

    if (completions.length === 0) {
      return;
    }

    // 过滤匹配的补全
    const filtered = completions.filter(c =>
      c.text.toLowerCase().startsWith(context.currentArg.toLowerCase())
    );

    if (filtered.length === 0) {
      return;
    }

    console.log('');
    console.log(`${Colors.info}  Available completions:${Colors.reset}`);
    console.log('');

    const maxTextLength = Math.max(...filtered.map(c => c.text.length));
    filtered.forEach(c => {
      const typeIcon = this.getTypeIcon(c.type);
      const text = c.text.padEnd(maxTextLength + 2);
      const desc = c.description || '';
      console.log(`  ${typeIcon} ${Colors.primary}${text}${Colors.reset}${Colors.dim}${desc}${Colors.reset}`);
    });

    console.log('');
  }

  /**
   * 获取类型图标
   */
  private static getTypeIcon(type?: string): string {
    const icons: Record<string, string> = {
      command: '⌘',
      argument: '◇',
      option: '⚙',
      file: '📄',
      directory: '📁',
    };
    return icons[type || ''] || icons['•'];
  }

  /**
   * 智能提示
   */
  static showSmartHint(input: string): void {
    const trimmed = input.trim();

    // 如果输入以 - 开头,可能是选项
    if (trimmed.startsWith('-')) {
      console.log(`${Colors.dim}  💡 Tip: Use ${Colors.info}--help${Colors.dim} to see all options${Colors.reset}`);
      return;
    }

    // 如果输入是已知命令
    if (this.commands.has(trimmed)) {
      const cmd = this.commands.get(trimmed);
      if (cmd?.subcommands && Object.keys(cmd.subcommands).length > 0) {
        const subcommands = Object.keys(cmd.subcommands).join(', ');
        console.log(`${Colors.dim}  💡 Tip: ${Colors.primary}${trimmed}${Colors.dim} has subcommands: ${Colors.info}${subcommands}${Colors.reset}`);
      }
      return;
    }

    // 模糊匹配
    const matches = Array.from(this.commands.keys()).filter(cmd =>
      cmd.includes(trimmed.toLowerCase()) || trimmed.toLowerCase().includes(cmd)
    );

    if (matches.length > 0 && matches.length < 5) {
      console.log(`${Colors.dim}  💡 Did you mean: ${matches.map(m => Colors.info + m + Colors.dim).join(', ')}?${Colors.reset}`);
    }
  }
}
