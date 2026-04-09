// ============================================================================
// EnhancedCompleter - 高级自动补全系统
// 支持命令、模型、文件路径、历史命令补全
// ============================================================================

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ConfigManager } from '../../../core/src/config/ConfigManager.ts';

export interface CompletionCandidate {
  text: string;
  displayText: string;
  description: string;
  type: 'command' | 'model' | 'file' | 'directory' | 'history' | 'option' | 'skill' | 'mcp';
  priority: number;
}

export interface CompleterOptions {
  configManager: ConfigManager;
  cwd: string;
  history: string[];
  skills: string[];
  mcpServers: { name: string; status: string }[];
}

/**
 * REPL 命令定义
 */
interface ReplCommand {
  name: string;
  description: string;
  subcommands?: Record<string, { description: string; args?: string[] }>;
  requiresArg?: boolean;
  argHint?: string;
}

const REPL_COMMANDS: ReplCommand[] = [
  { name: '/help', description: '显示帮助信息' },
  { name: '/quit', description: '退出 Nova' },
  { name: '/clear', description: '清空对话历史' },
  { name: '/status', description: '显示会话状态' },
  { name: '/model', description: '切换模型', requiresArg: true, argHint: '<model-id>' },
  { name: '/mode', description: '切换交互模式', subcommands: {
    auto: { description: '自动执行模式' },
    plan: { description: '计划确认模式' },
    ask: { description: '仅回答模式' },
  }},
  { name: '/thinking', description: '切换思考显示' },
  { name: '/compact', description: '切换紧凑模式' },
  { name: '/init', description: '初始化项目 NOVA.md' },
  { name: '/memory', description: '管理记忆', subcommands: {
    add: { description: '添加记忆', args: ['<text>'] },
    show: { description: '显示记忆' },
    clear: { description: '清空记忆' },
    edit: { description: '编辑记忆' },
  }},
  { name: '/history', description: '管理历史会话', subcommands: {
    list: { description: '列出历史' },
    restore: { description: '恢复会话', args: ['<id>'] },
    delete: { description: '删除会话', args: ['<id>'] },
  }},
  { name: '/mcp', description: 'MCP 服务器管理', subcommands: {
    status: { description: '查看状态' },
    list: { description: '列出服务器' },
    tools: { description: '列出工具', args: ['<server>'] },
  }},
  { name: '/skills', description: '技能管理', subcommands: {
    list: { description: '列出技能' },
    use: { description: '激活技能', args: ['<name>'] },
    info: { description: '查看技能详情', args: ['<name>'] },
  }},
  { name: '/ollama', description: 'Ollama 管理', subcommands: {
    list: { description: '列出本地模型' },
    pull: { description: '拉取模型', args: ['<model>'] },
    rm: { description: '删除模型', args: ['<model>'] },
  }},
];

/**
 * 增强版自动补全器
 */
export class EnhancedCompleter {
  private configManager: ConfigManager;
  private cwd: string;
  private history: string[];
  private skills: string[];
  private mcpServers: { name: string; status: string }[];
  private modelCache: string[] = [];
  private modelCacheTime = 0;
  private readonly MODEL_CACHE_TTL = 5000; // 5 seconds

  constructor(options: CompleterOptions) {
    this.configManager = options.configManager;
    this.cwd = options.cwd;
    this.history = options.history;
    this.skills = options.skills;
    this.mcpServers = options.mcpServers;
  }

  /**
   * 更新历史记录
   */
  updateHistory(history: string[]): void {
    this.history = history;
  }

  /**
   * 更新技能列表
   */
  updateSkills(skills: string[]): void {
    this.skills = skills;
  }

  /**
   * 更新 MCP 服务器列表
   */
  updateMcpServers(servers: { name: string; status: string }[]): void {
    this.mcpServers = servers;
  }

  /**
   * 获取可用模型列表（带缓存）
   */
  private getAvailableModels(): string[] {
    const now = Date.now();
    if (this.modelCache.length > 0 && now - this.modelCacheTime < this.MODEL_CACHE_TTL) {
      return this.modelCache;
    }

    try {
      const config = this.configManager.getConfig();
      const models: string[] = [];

      for (const [providerName, provider] of Object.entries(config.models.providers)) {
        for (const modelName of Object.keys(provider.models)) {
          // 同时支持 provider/model 和单独 model 两种格式
          models.push(modelName);
          if (providerName !== modelName) {
            models.push(`${providerName}/${modelName}`);
          }
        }
      }

      // 添加别名
      if (config.models.aliases) {
        models.push(...Object.keys(config.models.aliases));
      }

      this.modelCache = [...new Set(models)];
      this.modelCacheTime = now;
      return this.modelCache;
    } catch {
      return [];
    }
  }

  /**
   * 主补全入口
   */
  getCompletions(input: string, cursorPosition?: number): CompletionCandidate[] {
    const trimmed = input.trim();
    const pos = cursorPosition ?? input.length;

    // 空输入 - 显示所有命令
    if (trimmed === '') {
      return this.getCommandCompletions('');
    }

    // !shell 命令补全
    if (trimmed.startsWith('!')) {
      return this.getShellCompletions(trimmed.slice(1));
    }

    // @file 文件补全
    if (trimmed.startsWith('@')) {
      return this.getFileCompletions(trimmed.slice(1));
    }

    // /command 命令补全 - 使用原始 input 以保留尾随空格
    if (trimmed.startsWith('/')) {
      return this.getSlashCommandCompletions(input);
    }

    // 普通输入 - 检查是否匹配历史
    return this.getHistoryCompletions(trimmed);
  }

  /**
   * 命令补全
   */
  private getCommandCompletions(partial: string): CompletionCandidate[] {
    const candidates: CompletionCandidate[] = [];

    for (const cmd of REPL_COMMANDS) {
      if (cmd.name.startsWith(partial.toLowerCase())) {
        candidates.push({
          text: cmd.name,
          displayText: cmd.name,
          description: cmd.description,
          type: 'command',
          priority: 100,
        });
      }
    }

    return candidates.sort((a, b) => b.priority - a.priority);
  }

  /**
   * /command 格式补全
   */
  private getSlashCommandCompletions(input: string): CompletionCandidate[] {
    const inputEndsWithSpace = input.endsWith(' ');
    const parts = input.trim().split(/\s+/);
    const mainCmd = parts[0].toLowerCase();
    const subCmd = parts.length > 1 ? parts[1].toLowerCase() : '';
    const argValue = parts.length > 2 ? parts[2] : '';

    // 找到匹配的主命令
    const matchedCmd = REPL_COMMANDS.find(cmd => cmd.name === mainCmd);

    // 仅输入了主命令的一部分（没有空格）
    if (!inputEndsWithSpace && parts.length === 1) {
      return this.getCommandCompletions(mainCmd);
    }

    // 主命令后有空格，需要子命令或参数
    if (matchedCmd) {
      // /model 需要模型参数
      if (matchedCmd.name === '/model') {
        return this.getModelCompletions(subCmd);
      }

      // 有子命令的命令
      if (matchedCmd.subcommands) {
        // 正在输入子命令（还没有空格）
        if (!inputEndsWithSpace && parts.length === 2) {
          return this.getSubcommandCompletions(matchedCmd, subCmd);
        }
        // 子命令后有空格，需要参数
        if (inputEndsWithSpace && parts.length >= 2) {
          const sub = matchedCmd.subcommands[subCmd];
          if (sub?.args) {
            // /skills use <name> 补全技能名
            if (matchedCmd.name === '/skills' && subCmd === 'use') {
              return this.getSkillCompletions(argValue);
            }
            // /mcp tools <server> 补全服务器名
            if (matchedCmd.name === '/mcp' && subCmd === 'tools') {
              return this.getMcpServerCompletions(argValue);
            }
          }
        }
        // 主命令后空格，显示所有子命令
        return this.getSubcommandCompletions(matchedCmd, subCmd);
      }
    }

    return [];
  }

  /**
   * 子命令补全
   */
  private getSubcommandCompletions(cmd: ReplCommand, partial: string): CompletionCandidate[] {
    if (!cmd.subcommands) return [];

    const candidates: CompletionCandidate[] = [];

    for (const [name, sub] of Object.entries(cmd.subcommands)) {
      if (name.startsWith(partial.toLowerCase())) {
        candidates.push({
          text: name,
          displayText: name,
          description: sub.description,
          type: 'command',
          priority: 90,
        });
      }
    }

    return candidates;
  }

  /**
   * 模型补全
   */
  private getModelCompletions(partial: string): CompletionCandidate[] {
    const models = this.getAvailableModels();
    const candidates: CompletionCandidate[] = [];
    const lowerPartial = partial.toLowerCase();

    for (const model of models) {
      if (model.toLowerCase().startsWith(lowerPartial)) {
        candidates.push({
          text: model,
          displayText: model,
          description: 'AI 模型',
          type: 'model',
          priority: model.includes('/') ? 95 : 85, // provider/model 优先
        });
      }
    }

    return candidates.sort((a, b) => b.priority - a.priority);
  }

  /**
   * 技能补全
   */
  private getSkillCompletions(partial: string): CompletionCandidate[] {
    const candidates: CompletionCandidate[] = [];
    const lowerPartial = partial.toLowerCase();

    for (const skill of this.skills) {
      if (skill.toLowerCase().startsWith(lowerPartial)) {
        candidates.push({
          text: skill,
          displayText: skill,
          description: '可用技能',
          type: 'skill',
          priority: 80,
        });
      }
    }

    return candidates;
  }

  /**
   * MCP 服务器补全
   */
  private getMcpServerCompletions(partial: string): CompletionCandidate[] {
    const candidates: CompletionCandidate[] = [];
    const lowerPartial = partial.toLowerCase();

    for (const server of this.mcpServers) {
      if (server.name.toLowerCase().startsWith(lowerPartial)) {
        candidates.push({
          text: server.name,
          displayText: server.name,
          description: `MCP 服务器 (${server.status})`,
          type: 'mcp',
          priority: 80,
        });
      }
    }

    return candidates;
  }

  /**
   * 文件路径补全
   */
  private getFileCompletions(partial: string): CompletionCandidate[] {
    const candidates: CompletionCandidate[] = [];

    try {
      // 解析路径
      const isAbsolute = path.isAbsolute(partial);
      const baseDir = isAbsolute
        ? path.dirname(partial) || '/'
        : path.join(this.cwd, path.dirname(partial) || '.');
      const prefix = path.basename(partial);

      // 列出目录内容
      if (fs.existsSync(baseDir)) {
        const entries = fs.readdirSync(baseDir, { withFileTypes: true });

        for (const entry of entries) {
          if (entry.name.startsWith(prefix)) {
            const fullPath = isAbsolute
              ? path.join(baseDir, entry.name)
              : path.relative(this.cwd, path.join(baseDir, entry.name));

            const isDir = entry.isDirectory();
            candidates.push({
              text: isDir ? fullPath + '/' : fullPath,
              displayText: entry.name + (isDir ? '/' : ''),
              description: isDir ? '目录' : '文件',
              type: isDir ? 'directory' : 'file',
              priority: isDir ? 75 : 70,
            });
          }
        }
      }
    } catch {
      // 忽略错误
    }

    return candidates.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Shell 命令补全（简单实现）
   */
  private getShellCompletions(partial: string): CompletionCandidate[] {
    // 提取命令名
    const cmdName = partial.split(' ')[0];

    // 常用命令提示
    const commonCommands = [
      { cmd: 'git', desc: 'Git 版本控制' },
      { cmd: 'npm', desc: 'Node 包管理器' },
      { cmd: 'pnpm', desc: '快速包管理器' },
      { cmd: 'node', desc: 'Node.js 运行时' },
      { cmd: 'ls', desc: '列出文件' },
      { cmd: 'cd', desc: '切换目录' },
      { cmd: 'cat', desc: '查看文件' },
      { cmd: 'grep', desc: '搜索文本' },
    ];

    const candidates: CompletionCandidate[] = [];

    if (!partial.includes(' ')) {
      for (const { cmd, desc } of commonCommands) {
        if (cmd.startsWith(partial.toLowerCase())) {
          candidates.push({
            text: cmd,
            displayText: cmd,
            description: desc,
            type: 'command',
            priority: 60,
          });
        }
      }
    }

    return candidates;
  }

  /**
   * 历史命令补全
   */
  private getHistoryCompletions(partial: string): CompletionCandidate[] {
    const candidates: CompletionCandidate[] = [];
    const lowerPartial = partial.toLowerCase();
    const seen = new Set<string>();

    // 从最近的开始
    for (let i = this.history.length - 1; i >= 0; i--) {
      const item = this.history[i];
      if (item.toLowerCase().startsWith(lowerPartial) && !seen.has(item)) {
        seen.add(item);
        candidates.push({
          text: item,
          displayText: item.length > 50 ? item.slice(0, 47) + '...' : item,
          description: '历史命令',
          type: 'history',
          priority: 50 - candidates.length, // 最近的优先
        });

        if (candidates.length >= 5) break;
      }
    }

    return candidates;
  }

  /**
   * 应用补全到输入
   */
  applyCompletion(input: string, candidate: CompletionCandidate, cursorPos: number): { text: string; cursorPos: number } {
    // 确定要替换的范围
    const beforeCompletion = input.slice(0, this.getCompletionStart(input, cursorPos));
    const afterCursor = input.slice(cursorPos);

    // 构建新输入
    let newText = candidate.text;

    // 如果是命令，添加空格
    if (candidate.type === 'command' && !candidate.text.includes(' ')) {
      newText += ' ';
    }

    return {
      text: beforeCompletion + newText + afterCursor,
      cursorPos: beforeCompletion.length + newText.length,
    };
  }

  /**
   * 获取补全起始位置
   */
  private getCompletionStart(input: string, cursorPos: number): number {
    // 找到当前词的起始位置
    let start = cursorPos;
    while (start > 0 && !/\s/.test(input[start - 1])) {
      start--;
    }
    return start;
  }

  /**
   * 格式化补全项显示
   */
  formatCompletion(candidate: CompletionCandidate, maxWidth: number): string {
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

    const icon = typeIcons[candidate.type] || '•';
    const text = candidate.displayText.padEnd(Math.min(maxWidth - 20, 30));
    return `  ${icon} ${text} ${candidate.description}`;
  }
}
