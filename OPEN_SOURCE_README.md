# Nova CLI

<div align="center">

**下一代 AI 编程助手 CLI 工具**

*更高效、更多模态、更智能*

[![TypeScript](https://img.shields.io/badge/TypeScript-5.4+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[English](#english) | [中文文档](#中文文档)

</div>

---

## 中文文档

### 📖 项目简介

Nova CLI 是一个生产级的终端 AI 代理框架，融合了 Claude Code、Aider、OpenAI Codex CLI 等主流工具的优秀设计理念，提供统一的、可扩展的 AI 编程助手解决方案。

**核心特性：**
- 🤖 **多模型支持** - 支持 Anthropic、OpenAI、DeepSeek、Google Gemini、智谱 GLM、Moonshot 等主流模型
- 🔧 **工具系统** - 内置 11 种开发工具，支持 MCP 协议扩展
- 🛡️ **安全架构** - 多级审批机制、文件过滤、生命周期钩子
- 💾 **智能上下文** - 自动记忆发现、上下文压缩、会话管理
- 🎨 **终端界面** - 基于 Ink 的现代化 TUI，支持流式输出

### 🏗️ 架构设计

```
nova-cli/
├── packages/
│   ├── core/                    # @nova-cli/core - 核心引擎库
│   │   └── src/
│   │       ├── types/           # 类型系统（会话ID、消息ID等品牌类型）
│   │       ├── tools/           # 工具注册中心 + 11 个内置工具实现
│   │       ├── model/           # 统一 LLM 客户端 + 多提供商支持
│   │       ├── session/         # 会话管理 + AgentLoop 执行引擎
│   │       ├── context/         # 记忆发现 + 上下文构建 + 压缩
│   │       ├── security/        # 审批管理 + 钩子执行 + 文件过滤
│   │       ├── mcp/             # Model Context Protocol 服务器管理
│   │       ├── config/          # 配置管理（YAML/JSON/环境变量分层）
│   │       ├── auth/            # 凭证管理（文件 + 环境变量）
│   │       ├── telemetry/       # 匿名使用统计
│   │       └── utils/           # 日志、重试、格式化等工具
│   └── cli/                     # @nova-cli/cli - 终端应用
│       └── src/
│           ├── bin/nova.js      # 入口点
│           └── startup/         # NovaApp、InteractiveRepl、CLI 参数解析
├── extensions/                  # 技能和代理扩展
├── __tests__/                   # 单元测试和集成测试
└── scripts/                     # 构建和工具脚本
```

### ✨ 功能特性

#### 1. 多提供商 LLM 支持

支持多种 AI 模型提供商，统一的 API 接口：

| 提供商 | 模型 | 特性 |
|--------|------|------|
| **Anthropic** | Claude 3.5 Sonnet, Claude 3 Opus, Claude 3 Haiku | 流式输出、工具调用、视觉理解 |
| **OpenAI** | GPT-4o, GPT-4o Mini, GPT-4 Turbo | 流式输出、函数调用 |
| **DeepSeek** | DeepSeek V3, DeepSeek Coder | 高性价比、代码优化 |
| **智谱 GLM** | GLM-4, GLM-3 Turbo | 中文优化 |
| **Google** | Gemini Pro, Gemini Flash | 多模态、长上下文 |
| **Ollama** | Llama 3, Qwen, Yi | 本地运行、隐私优先 |

#### 2. 内置工具系统

11 个核心工具，覆盖开发全流程：

| 分类 | 工具 | 功能描述 |
|------|------|----------|
| **文件操作** | `read_file`, `write_file`, `edit_file`, `list_directory` | 文件读写、偏移/限制读取、安全编辑、递归列出 |
| **搜索** | `search_file`, `search_content` | Glob 模式文件搜索、正则内容搜索（支持上下文行） |
| **执行** | `execute_command` | Shell 命令执行、超时控制、自动检测 PowerShell/bash |
| **网络** | `web_search`, `web_fetch` | Serper.dev API 搜索、URL 抓取（HTML 转文本） |
| **记忆** | `memory_read`, `memory_write` | 键值存储、会话/项目/全局作用域、TTL 支持 |

#### 3. 代理执行循环

`AgentLoop` 是 Nova CLI 的核心——一个多轮对话循环：

1. 发送消息给 LLM（附带工具定义）
2. 处理模型的工具调用请求
3. 通过 `ToolRegistry` 执行工具（带审批检查）
4. 将工具结果反馈给模型
5. 重复直到模型停止调用工具或达到最大轮次

支持**阻塞模式**（`run()`）和**流式模式**（`runStream()`）。

#### 4. 审批系统

五种审批模式，适应不同场景：

| 模式 | 行为 |
|------|------|
| `yolo` | 自动批准所有操作（危险但快速） |
| `default` | 仅询问高风险/关键工具 |
| `accepting_edits` | 自动批准文件编辑，询问其他操作 |
| `plan` | 任何工具执行前都询问 |
| `smart` | AI 辅助审批决策 |

支持自定义审批规则（glob 模式 + 输入字段条件）。

#### 5. MCP 协议集成

Model Context Protocol（模型上下文协议）支持：
- 通过 stdio JSON-RPC 连接外部 MCP 服务器
- 自动发现并注册 MCP 工具
- 每个 MCP 服务器的工具成为原生 Nova 工具

#### 6. 安全架构

- **FileFilter**: 基于路径的访问控制、忽略模式、文件大小限制
- **HookExecutor**: 生命周期钩子（PreToolUse、PostToolUse、SessionStart 等）
- **ApprovalManager**: 基于风险的审批工作流
- 凭证文件使用 `chmod 600` 权限存储

#### 7. 上下文与记忆系统

- **MemoryDiscovery**: 自动发现项目上下文文件（CLAUDE.md、.cursor/rules、ARCHITECTURE.md 等）
- **ContextBuilder**: 从发现的记忆构建优化的系统提示
- **Context Compression**: 接近令牌限制时自动截断对话

### 🚀 快速开始

#### 前置要求

- Node.js >= 18.0.0
- npm 或 pnpm >= 9.0.0
- AI 模型 API 密钥（Anthropic、OpenAI 等）

#### 安装

```bash
# 克隆仓库
git clone https://github.com/your-org/nova-cli.git
cd nova-cli

# 安装依赖（推荐使用 pnpm）
pnpm install

# 或使用 npm
npm install --workspaces=false
cd packages/core && npm install
cd ../cli && npm install

# 构建项目
pnpm build

# 或分步构建
cd packages/core && npx tsc -p tsconfig.json
cd ../cli && npx tsc -p tsconfig.json
```

#### 配置

设置 API 密钥：

```bash
# 通过 CLI 设置
nova auth set anthropic
# 根据提示输入 API 密钥

# 或通过环境变量
export ANTHROPIC_API_KEY=sk-ant-...
export OPENAI_API_KEY=sk-...
export DEEPSEEK_API_KEY=...
export GLM_API_KEY=...
```

创建配置文件 `~/.nova/config.yaml`：

```yaml
core:
  defaultModel: claude-3-sonnet-20240229
  defaultApprovalMode: default
  maxTurns: 100
  maxTokens: 4096
  temperature: 0.7
  logLevel: info
```

项目级配置 `.nova/config.yaml` 会覆盖全局设置。

#### 使用

```bash
# 启动交互式会话
nova

# 单次提示
nova -p "解释这个代码库"

# 指定模型
nova -m gpt-4o

# YOLO 模式（自动批准所有工具）
nova --approval-mode yolo

# 设置工作目录
nova -d /path/to/project

# 查看当前配置
nova config show

# 管理模型
nova model list
nova model select <model-id>

# 管理提供商
nova provider list
nova provider add <provider-name>

# Ollama 集成
nova ollama list
nova ollama pull <model-name>
```

#### 交互式命令

在 REPL 中：

```
/help              显示所有命令
/quit              退出
/clear             清空对话
/model <name>      切换模型
/approval <mode>   更改审批模式
/tools             列出可用工具
/sessions          显示会话统计
/compact           压缩上下文
/reset             开始新会话
```

### 🛠️ 开发指南

#### 项目结构（Monorepo）

```
nova-cli/                 # pnpm workspace + Turborepo
├── packages/core/        # @nova-cli/core — 可复用的引擎库
├── packages/cli/         # @nova-cli/cli — 终端应用
├── extensions/           # 可插拔的技能和代理
└── __tests__/            # 测试套件
```

#### 构建

```bash
pnpm build           # 构建所有包
pnpm dev             # 监听模式
pnpm test            # 运行测试
pnpm lint            # 代码检查
pnpm typecheck       # 类型检查
```

#### 添加新工具

1. 在 `packages/core/src/tools/schemas/my-tool.ts` 创建 JSON schema
2. 从 `packages/core/src/tools/schemas/index.ts` 导出
3. 在 `packages/core/src/tools/impl/MyTool.ts` 创建处理器
4. 在 `NovaApp.ts` 注册：

```typescript
this.toolRegistry.register({
  name: 'my_tool',
  description: '工具描述',
  category: 'file',
  inputSchema: myToolSchema,
  requiresApproval: false,
  riskLevel: 'low',
}, myToolHandler);
```

#### 添加新模型提供商

1. 创建 `packages/core/src/model/providers/MyProvider.ts`
2. 实现 `ModelProvider` 接口
3. 添加到 `ModelClient.ts` 构造函数 switch
4. 在 `ConfigManager.ts` 默认配置中注册模型

#### 类型系统

Nova CLI 使用 **品牌 TypeScript 类型** 进行编译时安全：

```typescript
type SessionId = string & { readonly __brand: 'SessionId' };
type MessageId = string & { readonly __brand: 'MessageId' };
type ToolCallId = string & { readonly __brand: 'ToolCallId' };
```

### 🤝 贡献指南

我们欢迎所有形式的贡献！

#### 如何贡献

1. **Fork 项目** - 点击右上角 Fork 按钮
2. **创建分支** - `git checkout -b feature/amazing-feature`
3. **提交更改** - `git commit -m 'Add amazing feature'`
4. **推送分支** - `git push origin feature/amazing-feature`
5. **创建 PR** - 打开 Pull Request

#### 开发流程

```bash
# 1. 克隆你的 fork
git clone https://github.com/your-username/nova-cli.git
cd nova-cli

# 2. 安装依赖
pnpm install

# 3. 创建功能分支
git checkout -b feature/my-feature

# 4. 进行开发
# ... 修改代码 ...

# 5. 运行测试
pnpm test

# 6. 代码检查
pnpm lint

# 7. 提交
git add .
git commit -m "feat: add my feature"

# 8. 推送
git push origin feature/my-feature
```

#### 代码规范

- 使用 TypeScript 编写代码
- 遵循 ESLint 规则
- 添加单元测试
- 更新相关文档
- 保持向后兼容

#### 提交信息格式

使用 [Conventional Commits](https://www.conventionalcommits.org/)：

```
feat: add new feature
fix: fix bug
docs: update documentation
style: format code
refactor: refactor code
test: add tests
chore: update build tasks
```

### 📋 路线图

查看 [ROADMAP.md](./ROADMAP.md) 了解详细的功能规划。

#### 已完成 ✅

- [x] 多提供商支持
- [x] Thinking 过程可视化
- [x] 基础工具系统
- [x] 审批机制
- [x] 会话管理

#### 进行中 🚧

- [ ] 上下文压缩与摘要
- [ ] Git 原生工作流
- [ ] MCP 协议集成

#### 计划中 📅

- [ ] 自修复循环
- [ ] 多模态输入
- [ ] 多模型路由
- [ ] 代码库映射
- [ ] 权限管理
- [ ] 沙箱执行
- [ ] 审计日志
- [ ] 语音编程
- [ ] 多代理协作

### 📄 许可证

本项目采用 MIT 许可证。查看 [LICENSE](LICENSE) 文件了解详情。

### 🙏 致谢

Nova CLI 的设计灵感来源于以下优秀项目：

- [Claude Code](https://code.claude.com/) - Anthropic 官方 CLI 工具
- [Aider](https://github.com/Aider-AI/aider) - AI 配对编程工具
- [OpenAI Codex CLI](https://github.com/openai/codex-cli) - OpenAI 命令行工具
- [Cursor](https://cursor.sh/) - AI 代码编辑器

特别感谢开源社区的贡献者们。

### 📞 联系方式

- **Issues**: [GitHub Issues](https://github.com/your-org/nova-cli/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/nova-cli/discussions)
- **Email**: your-email@example.com

---

## English

### 📖 Overview

Nova CLI is a production-grade terminal AI agent framework that combines the best ideas from Claude Code, Aider, OpenAI Codex CLI, and other tools into a unified, extensible solution.

**Key Features:**
- 🤖 **Multi-Provider Support** - Anthropic, OpenAI, DeepSeek, Google Gemini, GLM, Moonshot, and more
- 🔧 **Tool System** - 11 built-in tools with MCP protocol extension support
- 🛡️ **Security Architecture** - Multi-level approval, file filtering, lifecycle hooks
- 💾 **Intelligent Context** - Auto memory discovery, context compression, session management
- 🎨 **Terminal UI** - Modern TUI based on Ink with streaming output support

### 🚀 Quick Start

```bash
# Clone and install
git clone https://github.com/your-org/nova-cli.git
cd nova-cli
pnpm install

# Build
pnpm build

# Configure
nova auth set anthropic

# Run
nova
```

### 📚 Documentation

For detailed documentation, see:
- [Architecture Overview](#️-架构设计)
- [Feature List](#-功能特性)
- [Development Guide](#️-开发指南)
- [Contributing Guide](#-贡献指南)
- [Roadmap](./ROADMAP.md)

### 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

<div align="center">

**Made with ❤️ by the Nova CLI Team**

</div>