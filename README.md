# Nova CLI

> Next-generation CLI agent framework — more efficient, more multimodal, more intelligent.

[![npm version](https://img.shields.io/npm/v/iflow4nova.svg)](https://www.npmjs.com/package/iflow4nova)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Nova CLI is a production-grade terminal AI agent that combines the best ideas from Claude Code, iFlow CLI, and other tools into a unified, extensible framework. It provides a complete conversation loop with tool use, multi-provider LLM support, MCP integration, and a security-first architecture.

## 快速安装

### 1. 安装 Node.js

访问 [https://nodejs.org/zh-cn/download](https://nodejs.org/zh-cn/download) 下载最新的 Node.js 安装程序。

### 2. 运行安装程序

按照安装向导完成 Node.js 的安装。

### 3. 重启终端

- **Windows**: CMD（按 `Win + R`，输入 `cmd`）或 PowerShell
- **macOS/Linux**: 打开新的终端窗口

### 4. 安装 Nova CLI

```bash
npm install -g iflow4nova@latest
```

### 5. 启动 Nova CLI

```bash
nova
```

## 常用命令全集

### 基础命令

| 命令 | 说明 | 示例 |
|------|------|------|
| `nova` | 启动交互式 REPL | `nova` |
| `nova -p "提示词"` | 单次提问后退出 | `nova -p "解释这段代码"` |
| `nova -m 模型名` | 使用指定模型 | `nova -m claude-3-5-sonnet` |
| `nova -d 目录` | 指定工作目录 | `nova -d /path/to/project` |
| `nova -c` | 继续最近会话 | `nova -c` |
| `nova -r` | 恢复历史会话 | `nova -r` |

### 交互式命令

在 REPL 中可用的斜杠命令：

#### 会话管理
```
/help              显示帮助信息
/quit              退出 Nova CLI
/clear             清空当前会话
/reset             开始新会话
/sessions          显示会话统计
/compact           压缩上下文
```

#### 模型与配置
```
/model <name>      切换模型
/approval <mode>   更改审批模式 (yolo/default/accepting_edits/plan/smart)
/config show       显示当前配置
/project analyze   分析项目结构
```

#### 技能系统
```
/skills            管理技能
/skills list       列出所有技能
/skills add local <file>    添加本地技能
/skills add global <file>   添加全局技能
/skills rm <name>  删除技能
/skills author     从 SkillsHub 安装技能
/skills server     从 GitHub 安装技能
```

#### 项目分析
```
/init              快速分析项目
/init --deep       深度分析项目
```

#### 记忆系统
```
/memory save <key> <value>   保存记忆
/memory load <key>            加载记忆
/memory list                  列出所有记忆
/memory delete <key>          删除记忆
```

### 快捷输入方式

#### 文件引用
```bash
# 使用 @ 引用文件
@src/App.tsx
@package.json
@docs/README.md

# 同时引用多个文件
@src/App.tsx @src/utils.ts @package.json
```

#### Shell 命令
```bash
# 使用 ! 执行命令
!npm install
!git status
!python --version

# 命令输出会被捕获并发送给 AI
```

#### 多行输入
```bash
# 输入三个点号开始多行输入
...
这是第一行
这是第二行
这是第三行
...
```

### 审批模式

| 模式 | 行为 | 适用场景 |
|------|------|----------|
| `yolo` | 自动批准所有操作 | 快速原型开发、可信环境 |
| `default` | 只询问高风险操作 | 日常开发 |
| `accepting_edits` | 自动批准文件编辑 | 需要频繁修改代码 |
| `plan` | 所有操作前询问 | 谨慎操作、学习模式 |
| `smart` | AI 辅助决策 | 平衡安全与效率 |

## 使用技巧

### 1. 提高代码质量
```
# 使用项目分析功能
/init

# 然后让 AI 优化代码
帮我优化这个项目的代码结构和性能
```

### 2. 快速调试
```bash
# 引用文件并询问问题
@src/utils/errorHandler.ts 为什么这个函数会抛出异常？

# 执行测试并分析结果
!npm test
根据测试结果帮我修复问题
```

### 3. 代码审查
```bash
# 引用多个文件进行审查
@src/components/Header.tsx @src/components/Footer.tsx
请审查这两个组件的代码质量和潜在问题
```

### 4. 生成文档
```bash
# 基于代码生成文档
@src/api/
请为这些 API 文件生成完整的文档
```

### 5. 重构代码
```bash
# 先分析项目
/init --deep

# 然后进行重构
请帮我重构这个模块，使其更易于维护
```

### 6. 学习新技术
```
# 让 AI 解释新概念
请解释 React Hooks 的工作原理，并给出示例

# 让 AI 生成学习路径
我想学习 TypeScript，请给我一个详细的学习计划
```

### 7. 自动化任务
```bash
# 创建自动化脚本
请创建一个脚本来自动运行测试并生成报告

# 设置 Git hooks
请帮我设置 pre-commit hook 来运行代码检查
```

## 实战案例

### 案例 1: 创建新项目
```bash
# 1. 启动 Nova
nova

# 2. 让 AI 创建项目
请帮我创建一个 React + TypeScript 项目，包含以下功能：
- 用户认证
- 路由管理
- 状态管理
- API 集成

# 3. AI 会自动创建文件和配置
```

### 案例 2: 修复 Bug
```bash
# 1. 引用有问题的文件
@src/components/UserList.tsx

# 2. 描述问题
这个组件在渲染大量数据时会卡顿，请优化性能

# 3. AI 会分析并修复
```

### 案例 3: 添加新功能
```bash
# 1. 引用相关文件
@src/App.tsx @src/api/user.ts

# 2. 描述需求
请在用户列表中添加搜索和筛选功能

# 3. AI 会实现新功能
```

### 案例 4: 代码重构
```bash
# 1. 先分析项目
/init

# 2. 提出重构需求
请将这个项目从 JavaScript 迁移到 TypeScript

# 3. AI 会逐步迁移代码
```

### 案例 5: 性能优化
```bash
# 1. 运行性能分析
!npm run build

# 2. 让 AI 分析结果
根据构建结果，帮我优化项目性能

# 3. AI 会提供优化建议
```

## 高级技巧

### 1. 使用自定义技能
```bash
# 创建技能文件
# my-skill.md
---
name: code-reviewer
description: 专业代码审查技能
---

你是一个专业的代码审查员，请关注：
- 代码质量和可读性
- 潜在的安全问题
- 性能优化机会
- 最佳实践建议

# 添加技能
/skills add local my-skill.md

# 使用技能
请审查这段代码
```

### 2. 配置 MCP 服务器
```bash
# 配置文件位置
~/.nova/config.yaml

# 添加 MCP 服务器
mcp:
  servers:
    - name: my-server
      command: node
      args: ["path/to/server.js"]
```

### 3. 使用本地模型
```bash
# 启动 Ollama
ollama serve

# 使用本地模型
nova -m ollama/llama3.2

# 查看可用模型
nova ollama list
```

### 4. 配置国内平台
```bash
# 配置阿里云百炼
nova coding-plan add alibaba --key <api-key>

# 配置智谱 AI
nova coding-plan add zhipu --key <api-key>

# 配置腾讯云
nova coding-plan add tencent --key <api-key>
```

### 5. 使用 Git 集成
```bash
# 查看 Git 状态
!git status

# 提交代码
!git add .
!git commit -m "feat: add new feature"

# 让 AI 生成提交信息
!git diff
请根据这些更改生成合适的 commit message
```

## 故障排除

### 问题 1: 找不到 nova 命令
```bash
# 检查安装
npm list -g iflow4nova

# 重新安装
npm install -g iflow4nova@latest
```

### 问题 2: API 连接失败
```bash
# 检查认证状态
nova auth status

# 重新配置
nova auth set anthropic
```

### 问题 3: GitHub 速率限制
```bash
# 配置 GitHub Token
export GITHUB_TOKEN=your_token_here

# 或在交互模式中输入 token
/skills server
# 系统会提示输入 token
```

## 最佳实践

1. **定期使用 /init** - 保持 AI 对项目的最新理解
2. **使用 @ 引用文件** - 减少手动输入，提高准确性
3. **设置合适的审批模式** - 根据场景选择 yolo/default/plan
4. **利用技能系统** - 为特定任务创建专用技能
5. **保持对话简洁** - 分步骤描述复杂任务
6. **保存有用的记忆** - 使用 /memory save 保存重要信息
7. **善用项目分析** - 使用 /init 快速了解项目结构

## 配置 API Key

```bash
# 配置 Anthropic Claude
nova auth set anthropic

# 配置 OpenAI
nova auth set openai

# 查看认证状态
nova auth status
```

### 使用本地模型（Ollama）

如果你安装了 Ollama，Nova CLI 会自动检测本地模型：

```bash
# 查看本地模型
nova ollama list

# 使用本地模型启动
nova -m llama3.2
```

详细安装指南请参阅 [INSTALLATION.md](./INSTALLATION.md)。

## Architecture Overview

```
nova-cli/
├── packages/
│   ├── core/                    # @nova-cli/core - Engine library
│   │   └── src/
│   │       ├── types/           # Branded types, session, tools, config, errors
│   │       ├── tools/           # ToolRegistry, JSON schemas, 11 built-in tools
│   │       ├── model/           # Unified LLM client + Anthropic/OpenAI providers
│   │       ├── session/         # SessionManager + AgentLoop (execution engine)
│   │       ├── context/         # MemoryDiscovery + ContextBuilder + compression
│   │       ├── security/        # ApprovalManager + HookExecutor + FileFilter
│   │       ├── mcp/             # Model Context Protocol server management
│   │       ├── config/          # ConfigManager (YAML/JSON/env layered config)
│   │       ├── auth/            # Credential management (file + env vars)
│   │       ├── telemetry/       # Anonymous usage tracking
│   │       └── utils/           # Logger, helpers (retry, format, debounce)
│   └── cli/                     # @nova-cli/cli - Terminal interface
│       └── src/
│           ├── bin/nova.js      # Entry point
│           └── startup/         # NovaApp, InteractiveRepl, CLI argument parser
├── extensions/                  # Skills and agents
├── __tests__/                   # Unit and integration tests
└── scripts/                     # Build and utility scripts
```

## Key Features

### Multi-Provider LLM Support
- **Anthropic** — Claude 3.5 Sonnet, Claude 3 Opus, Claude 3 Haiku (streaming, tools, vision)
- **OpenAI** — GPT-4o, GPT-4o Mini, GPT-4 Turbo (streaming, function calling)
- Unified `ModelClient` interface — swap providers without code changes
- Automatic message format conversion between Anthropic and OpenAI formats

### 11 Built-in Tools

| Category | Tools | Description |
|----------|-------|-------------|
| **File** | `read_file`, `write_file`, `edit_file`, `list_directory` | File operations with offset/limit, occurrence-safe editing, recursive listing |
| **Search** | `search_file`, `search_content` | Glob-based file search, ripgrep-powered content search with context lines |
| **Execution** | `execute_command` | Shell command execution with PowerShell/bash auto-detection, timeout, abort |
| **Web** | `web_search`, `web_fetch` | Serper.dev API search, URL fetching with HTML-to-text conversion |
| **Memory** | `memory_read`, `memory_write` | Key-value store with session/project/global scopes and TTL |

### Agent Execution Loop
The `AgentLoop` is the heart of Nova CLI — a multi-turn conversation loop that:
1. Sends messages to the LLM with tool definitions
2. Processes tool use responses from the model
3. Executes tools through the `ToolRegistry` (with approval checks)
4. Feeds tool results back to the model
5. Repeats until the model stops calling tools or max turns reached

Supports both **blocking** (`run()`) and **streaming** (`runStream()`) modes.

### Approval System
Five approval modes for different use cases:

| Mode | Behavior |
|------|----------|
| `yolo` | Auto-approve everything (dangerous but fast) |
| `default` | Ask for high/critical risk tools only |
| `accepting_edits` | Auto-approve file edits, ask for the rest |
| `plan` | Always ask before any tool execution |
| `smart` | AI-assisted approval decisions |

Custom approval rules with glob patterns and input field conditions.

### MCP (Model Context Protocol) Integration
- Connect to external MCP servers via stdio JSON-RPC
- Automatically discover and register MCP tools
- Each MCP server's tools become native Nova tools

### Security
- **FileFilter**: Path-based access control, ignore patterns, size limits
- **HookExecutor**: Lifecycle hooks (PreToolUse, PostToolUse, SessionStart, etc.)
- **ApprovalManager**: Risk-based approval workflow
- Credential files stored with `chmod 600` permissions

### Context & Memory System
- **MemoryDiscovery**: Auto-discovers project context files (CLAUDE.md, .cursor/rules, ARCHITECTURE.md, etc.)
- **ContextBuilder**: Builds optimized system prompts from discovered memory
- **Context Compression**: Automatic conversation truncation when approaching token limits

### Project Analysis System
- **Quick Project Initialization**: `/init` command analyzes project structure in seconds
- **Tech Stack Detection**: Automatically identifies languages, frameworks, tools, and testing frameworks
- **Architecture Pattern Recognition**: Detects component-based architecture, state management patterns, API layers
- **Code Metrics**: File counts, line counts, language breakdown, largest files
- **Dependency Analysis**: Production dependencies, development dependencies, internal dependencies
- **Refactoring Suggestions**: AI-powered recommendations based on analysis results
- **Context Injection**: Analysis results automatically injected into system prompts for better AI understanding

### Skills System
- **Custom Skills**: Add domain-specific expertise via YAML frontmatter markdown files
- **Skill Scopes**: Global (all sessions) or local (current session only)
- **Skill Injection**: Active skills automatically integrated into system prompts
- **Built-in Skills**: Code simplifier, bug fixer, security auditor, performance optimizer, etc.
- **Easy Management**: Add, list, and remove skills with simple commands
- **Behavior Control**: Skills guide AI behavior, responses, and problem-solving approaches

## Getting Started

### Prerequisites
- Node.js >= 18.0.0
- npm (or pnpm >= 9.0.0)
- An Anthropic or OpenAI API key

### Installation

```bash
# Clone and install
git clone <your-repo>
cd nova-cli
npm install --workspaces=false

# Install core dependencies
cd packages/core && npm install

# Install CLI dependencies
cd ../cli && npm install

# Build core first
cd ../core && npx tsc -p tsconfig.json

# Build CLI (includes core source for local references)
cd ../cli && npx tsc -p tsconfig.json

# Or use the build script (requires pnpm)
cd ../.. && pnpm install && pnpm build
```

### Configuration

Set your API key:

```bash
# Via CLI
nova auth set anthropic
# Enter your API key when prompted

# Or via environment variable
export ANTHROPIC_API_KEY=sk-ant-...
export OPENAI_API_KEY=sk-...
```

Create a config file at `~/.nova/config.yaml`:

```yaml
core:
  defaultModel: claude-3-sonnet-20240229
  defaultApprovalMode: default
  maxTurns: 100
  maxTokens: 4096
  temperature: 0.7
  logLevel: info
```

Project-level config at `.nova/config.yaml` overrides global settings.

### Usage

```bash
# Start interactive session
nova

# Single prompt
nova -p "Explain this codebase"

# Use a specific model
nova -m gpt-4o

# YOLO mode (auto-approve all tools)
nova --approval-mode yolo

# Set working directory
nova -d /path/to/project

# Show current config
nova config show
```

### Interactive Commands

Inside the REPL:

```
/init              Analyze project and initialize context
/help              Show all commands
/quit              Exit
/clear             Clear conversation
/model <name>      Switch model
/approval <mode>   Change approval mode
/tools             List available tools
/skills            Manage skills
/skills add        Add a skill from file
/skills list       List available skills
/skills rm         Remove a skill
/project analyze   Analyze project structure
/sessions          Show session stats
/compact           Compress context
/reset             Start new session
```

**New Commands**:

- `/init` - Quickly analyze your project and provide context to the AI
- `/skills add local <file>` - Add a skill to current session
- `/skills add global <file>` - Add a skill globally (all sessions)
- `/skills list` - Show all available skills
- `/skills rm <name>` - Remove a skill
- `/project analyze` - Generate detailed project documentation

## Development

### Project Structure (Monorepo)

```
nova-cli/                 # pnpm workspace + Turborepo
├── packages/core/        # @nova-cli/core — reusable engine library
├── packages/cli/         # @nova-cli/cli — terminal application
├── extensions/           # Pluggable skills and agents
└── __tests__/            # Test suites
```

### Building

```bash
pnpm build           # Build all packages
pnpm dev             # Watch mode
pnpm test            # Run tests
pnpm lint            # Lint
pnpm typecheck       # Type check
```

### Adding a New Tool

1. Create a JSON schema in `packages/core/src/tools/schemas/my-tool.ts`
2. Export from `packages/core/src/tools/schemas/index.ts`
3. Create a handler in `packages/core/src/tools/impl/MyTool.ts`
4. Register in `NovaApp.ts`:

```typescript
this.toolRegistry.register({
  name: 'my_tool',
  description: 'What this tool does',
  category: 'file',
  inputSchema: myToolSchema,
  requiresApproval: false,
  riskLevel: 'low',
}, myToolHandler);
```

### Adding a New Model Provider

1. Create `packages/core/src/model/providers/MyProvider.ts`
2. Implement the `ModelProvider` interface
3. Add to `ModelClient.ts` constructor switch
4. Register models in `ConfigManager.ts` default config

### Type System

Nova CLI uses **branded TypeScript types** for compile-time safety:

```typescript
type SessionId = string & { readonly __brand: 'SessionId' };
type MessageId = string & { readonly __brand: 'MessageId' };
type ToolCallId = string & { readonly __brand: 'ToolCallId' };
```

### Error Handling

Hierarchical error classes:

```
NovaError (base)
├── ConfigError
├── ModelError
│   └── RateLimitError (retryable)
├── ToolError
│   └── ToolValidationError
├── SessionError
├── ApprovalError
├── HookError
├── McpError
├── SecurityError
├── ContextOverflowError
├── CancelledError
├── TimeoutError
└── AggregateError
```

## Design Decisions

### Why Monorepo?
Separation between `core` (library) and `cli` (application) allows:
- Reusing the engine in other projects (IDE plugins, web UIs)
- Independent versioning and testing
- Clean dependency boundaries

### Why Custom Tool System Instead of Raw MCP?
- Built-in tools work without external server dependencies
- Fine-grained approval control per tool
- Consistent error handling and streaming
- MCP tools are wrapped and exposed through the same registry

### Why Both Blocking and Streaming?
- Blocking mode (`run()`): simpler, good for scripts and testing
- Streaming mode (`runStream()`): better UX for interactive sessions

## Comparison with Alternatives

| Feature | Nova CLI | Claude Code | iFlow CLI |
|---------|----------|-------------|-----------|
| Multi-provider | Anthropic + OpenAI | Anthropic only | Multiple |
| Tool approval modes | 5 modes | 2 modes | 2 modes |
| MCP integration | Yes | Yes | Yes |
| Custom hooks | Shell-based | Limited | Limited |
| Context compression | Auto | Auto | Auto |
| Memory system | 3 scopes | Session only | File-based |
| Streaming | Yes | Yes | Yes |
| Extensible | Yes (extensions) | No | Limited |
| Open source | Yes | No | Yes |
## 友链认可
[LinuxDO](https://linux.do/) 众多技术爱好者的聚集地
## License

MIT
