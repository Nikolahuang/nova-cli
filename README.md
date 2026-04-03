# Nova CLI

> Next-generation CLI agent framework — more efficient, more multimodal, more intelligent.

[![npm version](https://img.shields.io/npm/v/@nova-cli/cli.svg)](https://www.npmjs.com/package/@nova-cli/cli)
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
npm install -g nova-terminal-ai@latest
```

### 5. 启动 Nova CLI

```bash
nova
```

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
