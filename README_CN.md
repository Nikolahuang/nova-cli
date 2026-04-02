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

## 项目简介

Nova CLI 是一个生产级的终端 AI 代理框架，融合了 Claude Code、Aider、OpenAI Codex CLI 等主流工具的优秀设计理念，提供统一的、可扩展的 AI 编程助手解决方案。

### 为什么选择 Nova CLI？

- 🚀 **开箱即用** - 支持 Anthropic、OpenAI、DeepSeek、智谱 GLM 等主流模型
- 🔧 **功能强大** - 内置 11 种开发工具，支持文件操作、搜索、命令执行等
- 🛡️ **安全可靠** - 多级审批机制、文件过滤、生命周期钩子
- 💡 **智能上下文** - 自动记忆发现、上下文压缩、会话管理
- 🎨 **现代化界面** - 基于 Ink 的终端 UI，支持流式输出
- 🔌 **可扩展** - 支持 MCP 协议，轻松集成外部工具

### 核心特性

| 特性 | 描述 |
|------|------|
| **多模型支持** | Anthropic、OpenAI、DeepSeek、GLM、Gemini、Ollama 等 |
| **工具系统** | 11 个内置工具 + MCP 扩展支持 |
| **审批机制** | 5 种审批模式，从自动批准到 AI 辅助决策 |
| **会话管理** | AgentLoop 执行引擎，支持多轮对话 |
| **安全架构** | 文件过滤、命令审批、凭证加密 |

## 快速开始

### 安装

```bash
# 克隆仓库
git clone https://github.com/your-org/nova-cli.git
cd nova-cli

# 安装依赖
pnpm install

# 构建
pnpm build

# 验证
node packages/cli/bin/nova.js --version
```

### 配置

```bash
# 设置 API 密钥
nova auth set anthropic
# 或使用环境变量
export ANTHROPIC_API_KEY=sk-ant-...

# 创建配置文件
# ~/.nova/config.yaml
```

```yaml
core:
  defaultModel: claude-3-5-sonnet-20241022
  defaultApprovalMode: default
  maxTurns: 100
```

### 使用

```bash
# 交互式会话
nova

# 单次提示
nova -p "解释这个代码库"

# 指定模型
nova -m gpt-4o

# YOLO 模式（自动批准）
nova --approval-mode yolo
```

## 支持的模型

### 云端模型

| 提供商 | 模型 | 特点 |
|--------|------|------|
| **Anthropic** | Claude 3.5 Sonnet, Claude 3 Opus, Claude 3 Haiku | 推理能力强、代码质量高 |
| **OpenAI** | GPT-4o, GPT-4 Turbo | 通用性强、生态完善 |
| **DeepSeek** | DeepSeek V3, DeepSeek Coder | 性价比高、代码优化 |
| **智谱 GLM** | GLM-4, GLM-3 Turbo | 中文优化 |
| **Google** | Gemini Pro, Gemini Flash | 多模态、长上下文 |
| **Moonshot** | Moonshot V1 | 长文本处理 |

### 本地模型

| 提供商 | 模型 | 特点 |
|--------|------|------|
| **Ollama** | Llama 3, Qwen, Yi | 本地运行、隐私保护 |

## 内置工具

Nova CLI 提供 11 个核心工具：

### 文件操作
- `read_file` - 读取文件（支持偏移/限制）
- `write_file` - 写入文件
- `edit_file` - 编辑文件（安全替换）
- `list_directory` - 列出目录

### 搜索
- `search_file` - Glob 模式文件搜索
- `search_content` - 正则内容搜索

### 执行
- `execute_command` - Shell 命令执行

### 网络
- `web_search` - 网络搜索（Serper.dev API）
- `web_fetch` - URL 抓取

### 记忆
- `memory_read` - 读取记忆
- `memory_write` - 写入记忆

## 审批系统

Nova CLI 提供 5 种审批模式：

| 模式 | 描述 | 适用场景 |
|------|------|----------|
| `yolo` | 自动批准所有操作 | 开发环境、快速原型 |
| `default` | 仅询问高风险操作 | 日常使用（推荐） |
| `accepting_edits` | 自动批准文件编辑 | 代码重构 |
| `plan` | 任何操作前都需确认 | 生产环境 |
| `smart` | AI 辅助决策 | 智能模式 |

## 架构设计

```
nova-cli/
├── packages/
│   ├── core/           # 核心引擎库
│   │   ├── types/      # 类型系统
│   │   ├── tools/      # 工具注册与实现
│   │   ├── model/      # 统一模型客户端
│   │   ├── session/    # 会话管理
│   │   ├── context/    # 上下文构建
│   │   ├── security/   # 安全机制
│   │   ├── mcp/        # MCP 协议
│   │   ├── config/     # 配置管理
│   │   └── auth/       # 认证管理
│   └── cli/            # 终端应用
│       ├── bin/        # 入口点
│       └── startup/   # 启动逻辑
├── extensions/         # 扩展
└── __tests__/        # 测试
```

## 开发指南

### 构建

```bash
pnpm build       # 构建所有包
pnpm dev         # 监听模式
pnpm test        # 运行测试
pnpm lint        # 代码检查
pnpm typecheck   # 类型检查
```

### 添加新工具

```typescript
// 1. 创建 schema
// packages/core/src/tools/schemas/my-tool.ts
export const myToolSchema = { ... };

// 2. 创建 handler
// packages/core/src/tools/impl/MyTool.ts
export async function myToolHandler(params) { ... }

// 3. 注册工具
// packages/cli/src/startup/NovaApp.ts
this.toolRegistry.register({
  name: 'my_tool',
  description: '工具描述',
  category: 'file',
  inputSchema: myToolSchema,
}, myToolHandler);
```

### 添加新模型提供商

```typescript
// packages/core/src/model/providers/MyProvider.ts
export class MyProvider implements ModelProvider {
  async chat(messages, tools, options) { ... }
}

// packages/core/src/model/ModelClient.ts
case 'my-provider':
  this.provider = new MyProvider(config);
  break;
```

## 文档

- [快速开始指南](./QUICKSTART.md) - 5 分钟上手
- [完整文档](./OPEN_SOURCE_README.md) - 详细功能说明
- [路线图](./ROADMAP.md) - 功能规划
- [贡献指南](./CONTRIBUTING.md) - 如何贡献
- [更新日志](./CHANGELOG.md) - 版本历史

## 路线图

### 已完成 ✅
- [x] 多提供商支持
- [x] Thinking 过程可视化
- [x] 基础工具系统
- [x] 审批机制
- [x] 会话管理

### 进行中 🚧
- [ ] 上下文压缩与摘要
- [ ] Git 原生工作流
- [ ] MCP 协议集成

### 计划中 📅
- [ ] 自修复循环
- [ ] 多模态输入
- [ ] 多模型路由
- [ ] 代码库映射
- [ ] 权限管理
- [ ] 沙箱执行

详见 [ROADMAP.md](./ROADMAP.md)。

## 贡献

我们欢迎所有形式的贡献！

### 贡献方式

- 🐛 报告 Bug - [创建 Issue](https://github.com/your-org/nova-cli/issues/new?template=bug_report.md)
- 💡 建议功能 - [功能请求](https://github.com/your-org/nova-cli/issues/new?template=feature_request.md)
- 📝 改进文档 - Fork -> 修改 -> PR
- 🔧 提交代码 - Fork -> Branch -> Commit -> PR

详见 [CONTRIBUTING.md](./CONTRIBUTING.md)。

## 社区

- 💬 [GitHub Discussions](https://github.com/your-org/nova-cli/discussions) - 问题讨论
- 🐛 [GitHub Issues](https://github.com/your-org/nova-cli/issues) - Bug 报告
- 📧 Email - your-email@example.com

## 许可证

[MIT License](./LICENSE)

## 致谢

感谢以下项目的启发：

- [Claude Code](https://code.claude.com/) - Anthropic 官方 CLI
- [Aider](https://github.com/Aider-AI/aider) - AI 配对编程
- [OpenAI Codex CLI](https://github.com/openai/codex-cli) - OpenAI CLI
- [Cursor](https://cursor.sh/) - AI 代码编辑器

---

<div align="center">

**Made with ❤️ by Nova CLI Team**

[⬆ 返回顶部](#nova-cli)

</div>