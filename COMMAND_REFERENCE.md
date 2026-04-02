# Nova CLI 完整指令参考手册

> 版本: v0.1.0 | Nova CLI 是一个 AI 驱动的终端助手，支持多种大语言模型提供商，具备代码生成、文件操作、Shell 执行、Web 搜索等能力。

---

## 目录

- [快速开始](#快速开始)
- [1. CLI 命令行指令](#1-cli-命令行指令)
  - [1.1 基础用法](#11-基础用法)
  - [1.2 全局选项](#12-全局选项)
  - [1.3 config — 配置管理](#13-config--配置管理)
  - [1.4 auth — 认证管理](#14-auth--认证管理)
  - [1.5 model — 模型管理](#15-model--模型管理)
  - [1.6 provider — 提供商管理](#16-provider--提供商管理)
  - [1.7 ollama — Ollama 本地模型](#17-ollama--ollama-本地模型)
  - [1.8 coding-plan — 国内编程计划平台](#18-coding-plan--国内编程计划平台)
  - [1.9 mcp — MCP 服务器管理](#19-mcp--mcp-服务器管理)
  - [1.10 skills — 技能系统](#110-skills--技能系统)
- [2. 交互式 REPL 斜杠命令](#2-交互式-repl-斜杠命令)
  - [2.1 导航命令](#21-导航命令)
  - [2.2 会话管理](#22-会话管理)
  - [2.3 模型与模式](#23-模型与模式)
  - [2.4 记忆系统](#24-记忆系统)
  - [2.5 扩展系统](#25-扩展系统)
  - [2.6 其他命令](#26-其他命令)
- [3. 快捷输入方式](#3-快捷输入方式)
  - [3.1 @文件引用](#31-文件引用)
  - [3.2 !Shell 命令](#32-shell-命令)
  - [3.3 多行输入](#33-多行输入)
- [4. 内置工具一览](#4-内置工具一览)
- [5. 交互模式详解](#5-交互模式详解)
- [6. 配置文件参考](#6-配置文件参考)
- [7. 完整使用案例](#7-完整使用案例)
- [8. 常见问题](#8-常见问题)

---

## 快速开始

```bash
# 1. 启动交互式会话
nova

# 2. 运行单条指令
nova -p "用 TypeScript 写一个快速排序"

# 3. 继续上一次会话
nova -c

# 4. 使用指定模型
nova -m gpt-4o "解释这段代码"
```

---

## 1. CLI 命令行指令

### 1.1 基础用法

| 命令 | 说明 |
|------|------|
| `nova` | 启动交互式 REPL 会话 |
| `nova <prompt>` | 直接输入提示词启动（等同于 `-p`） |
| `nova -p "<prompt>"` | 运行单条提示词后退出 |
| `nova -c` | 继续最近一次会话 |
| `nova -r` | 交互式选择历史会话恢复 |
| `nova -r <session-id>` | 恢复指定 ID 的会话 |
| `nova version` / `nova --version` / `nova -v` | 显示版本号 |
| `nova help` / `nova --help` / `nova -h` | 显示帮助信息 |

### 1.2 全局选项

| 选项 | 缩写 | 参数 | 说明 |
|------|------|------|------|
| `--prompt` | `-p` | `<text>` | 直接运行提示词后退出 |
| `--model` | `-m` | `<model-id>` | 指定使用的模型 |
| `--directory` | `-d` | `<path>` | 指定工作目录 |
| `--approval-mode` | | `yolo\|plan\|ask\|smart` | 设置审批模式 |
| `--max-turns` | | `<number>` | 最大对话轮次 |
| `--no-stream` | | | 禁用流式输出 |
| `--no-mcp` | | | 禁用 MCP 服务器连接 |
| `--continue` | `-c` | | 继续最近会话 |
| `--resume` | `-r` | `[<session-id>]` | 恢复历史会话 |

**使用示例：**

```bash
# 使用 Claude 3.5 Sonnet 在指定目录运行
nova -m claude-3.5-sonnet -d /my/project "分析项目结构"

# 使用 Ask 模式（只读问答，不修改文件）
nova --approval-mode ask "这个函数在做什么？"

# 限制最多 5 轮对话
nova --max-turns 5 -p "重构这个模块"

# 非流式输出（等待完整结果后一次性显示）
nova --no-stream "写一个 Python 脚本"

# 禁用 MCP 服务器，只用内置工具
nova --no-mcp "帮我写个测试"
```

---

### 1.3 config — 配置管理

管理 Nova CLI 的全局配置文件（`~/.nova/config.yaml`）。

| 子命令 | 说明 |
|--------|------|
| `nova config show` | 以 JSON 格式显示当前完整配置 |
| `nova config edit` | 用系统默认编辑器打开配置文件 |

**使用示例：**

```bash
# 查看当前配置
nova config show

# 在 VS Code 中编辑配置
EDITOR=code nova config edit

# 在 Vim 中编辑配置
nova config edit  # 自动使用 $EDITOR 环境变量
```

---

### 1.4 auth — 认证管理

管理各模型提供商的 API Key 和连接信息。

| 子命令 | 说明 |
|--------|------|
| `nova auth set <provider>` | 设置提供商的 API Key |
| `nova auth set <provider> --key <api-key>` | 通过命令行直接传入 API Key |
| `nova auth set <provider> --base-url <url>` | 设置自定义 Base URL |
| `nova auth remove <provider>` | 删除提供商的认证信息 |
| `nova auth status` | 查看所有提供商的认证状态 |

**支持的内置提供商：**

`anthropic` · `openai` · `google` · `deepseek` · `qwen` · `glm` · `moonshot` · `baichuan` · `minimax` · `yi` · `groq` · `mistral` · `together` · `perplexity` · `ollama` · `ollama-cloud` · `siliconflow`

**使用示例：**

```bash
# 设置 Anthropic API Key（交互式输入）
nova auth set anthropic

# 通过命令行直接设置
nova auth set openai --key sk-xxxxxxxxxxxx

# 设置 DeepSeek API Key
nova auth set deepseek --key sk-xxxxxxxxxxxx

# 配置 Ollama 地址（非默认端口）
nova auth set ollama --base-url http://192.168.1.100:11434

# 配置 Ollama Cloud
nova auth set ollama-cloud --key oll-xxxxxxxxxxxx

# 添加自定义提供商
nova auth set my-provider --base-url https://api.example.com/v1 --key sk-xxx

# 查看认证状态
nova auth status

# 删除认证
nova auth remove openai
```

**环境变量方式：**

也可以通过环境变量设置 API Key（优先级低于 `nova auth set`）：

```bash
# 基础认证
export ANTHROPIC_API_KEY=sk-ant-xxx
export OPENAI_API_KEY=sk-xxx
export GOOGLE_API_KEY=xxx
export DEEPSEEK_API_KEY=sk-xxx
export QWEN_API_KEY=sk-xxx
export GLM_API_KEY=xxx

# Ollama 配置
export OLLAMA_HOST=http://localhost:11434
export OLLAMA_API_KEY=oll-xxx  # Ollama Cloud

# Coding Plan 国内平台
export ALIBABA_CLOUD_ACCESS_KEY_ID=xxx
export ALIBABA_CLOUD_ACCESS_KEY_SECRET=xxx

# 自定义提供商
export MY_PROVIDER_API_KEY=sk-xxx
export MY_PROVIDER_BASE_URL=https://api.example.com/v1

# 调试和日志
export NOVA_LOG_LEVEL=debug
export NOVA_DEBUG=true
```

## 环境变量参考

| 变量名 | 说明 | 优先级 | 示例 |
|--------|------|---------|-------|
| `NOVA_CONFIG_PATH` | 自定义配置文件路径 | 最高 | `/custom/path/config.yaml` |
| `ANTHROPIC_API_KEY` | Anthropic API Key | 高 | `sk-ant-xxx` |
| `OPENAI_API_KEY` | OpenAI API Key | 高 | `sk-xxx` |
| `OLLAMA_HOST` | Ollama 服务地址 | 中 | `http://192.168.1.100:11434` |
| `OLLAMA_API_KEY` | Ollama Cloud Key | 中 | `oll-xxx` |
| `EDITOR` / `VISUAL` | 配置文件编辑器 | 系统默认 | `code`, `vim`, `nano` |
| `NO_COLOR` | 禁用 ANSI 颜色输出 | 全局 | `true` |
| `NODE_ENV` | Node.js 环境 | 影响行为 | `development`, `production` |
| `HTTPS_PROXY` | HTTP 代理 | 网络层 | `http://proxy:8080` |
| `HTTPS_NO_PROXY` | 绕过代理的主机 | 网络层 | `localhost,127.0.0.1` |

### Windows PowerShell

```powershell
# 设置单个变量
$env:ANTHROPIC_API_KEY="sk-ant-xxx"

# 设置多个变量
$env:ANTHROPIC_API_KEY="sk-ant-xxx"
$env:OLLAMA_HOST="http://192.168.1.100:11434"
$env:NODE_ENV="development"

# 永久设置（当前用户）
[Environment]::SetEnvironmentVariable("ANTHROPIC_API_KEY", "sk-ant-xxx", "User")
```

### Linux/macOS Bash

```bash
# 设置单个变量
export ANTHROPIC_API_KEY="sk-ant-xxx"

# 设置多个变量
export ANTHROPIC_API_KEY="sk-ant-xxx"
export OLLAMA_HOST="http://192.168.1.100:11434"
export NODE_ENV="development"

# 永久设置（添加到 ~/.bashrc 或 ~/.zshrc）
echo 'export ANTHROPIC_API_KEY="sk-ant-xxx"' >> ~/.bashrc
source ~/.bashrc
```

### Docker 容器

```dockerfile
FROM node:18-alpine

ENV ANTHROPIC_API_KEY=sk-ant-xxx
ENV OLLAMA_HOST=http://host.docker.internal:11434
ENV NOVA_LOG_LEVEL=info

COPY . /app
WORKDIR /app
RUN npm install -g nova-cli

CMD ["nova", "-p", "Hello World"]
```

```yaml
# docker-compose.yml
version: '3'
services:
  nova:
    image: your-nova-image
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - OLLAMA_HOST=${OLLAMA_HOST}
    volumes:
      - ~/.nova:/root/.nova
```

### .env 文件支持

Nova CLI 支持 `.env` 文件格式：

```env
# .env
ANTHROPIC_API_KEY=sk-ant-xxx
OPENAI_API_KEY=sk-xxx
OLLAMA_HOST=http://localhost:11434
DEBUG=true

# 注释以 # 开头
# 空行会被忽略
```

在项目目录中创建 `.env` 文件，Nova 会自动加载。

### 变量优先级顺序

1. **CLI 参数** (最高优先级)
   ```bash
   nova --key sk-xxx
   ```

2. **环境变量**
   ```bash
   export ANTHROPIC_API_KEY=sk-ant-xxx
   nova
   ```

3. **配置文件**
   ```yaml
   # config.yaml
   models:
     anthropic:
       apiKey: sk-ant-xxx
   ```

4. **默认值** (最低优先级)

### 敏感信息保护

**不要将 API Key 提交到 Git：**
```gitignore
# .gitignore
.env
*.local.*
config.local.yaml
```

**使用密钥管理服务：**
- AWS Secrets Manager
- Azure Key Vault  
- Google Secret Manager
- HashiCorp Vault

```bash
# 从密钥管理服务获取
export ANTHROPIC_API_KEY=$(aws secretsmanager get-secret-value --secret-id anthropic-key --query SecretString --output text)
```

---

### 1.5 model — 模型管理

查看和选择可用的 AI 模型。

| 子命令 | 说明 |
|--------|------|
| `nova model list` | 列出所有可用模型及其状态 |

**输出示例：**

```
Available Models:

* anthropic -- Anthropic Claude
    claude-3.5-sonnet (default) [vision, tools, thinking] ($3/$15 per 1M tok)
    claude-3.5-haiku            [vision, tools] ($0.8/$4 per 1M tok)

  openai -- OpenAI
    gpt-4o                      [vision, tools] ($2.5/$10 per 1M tok)
    gpt-4o-mini                 [vision, tools] ($0.15/$0.6 per 1M tok)

~ ollama -- Ollama (Local)
    llama3.1                    [tools] (local)
    qwen2.5-coder               [tools] (local)

* = API key configured  ~ = local (Ollama)
```

**图例说明：**
- `*` — API Key 已配置
- `~` — 本地 Ollama 模型
- `default` — 当前默认模型
- `alias: xxx` — 模型别名

**使用示例：**

```bash
# 查看所有可用模型
nova model list

# 指定模型运行
nova -m claude-3.5-sonnet "解释 React Hooks"
nova -m gpt-4o "写一个 Express API"
nova -m deepseek-v3.2 "代码审查"

# 使用模型别名
nova -m cloud "你好"  # 别名 "cloud" → "deepseek-v3.2"

# 使用提供商/模型格式
nova -m openai/gpt-4o "你好"
nova -m ollama/llama3.1 "你好"
```

---

### 1.6 provider — 提供商管理

添加、删除和管理模型提供商。

| 子命令 | 说明 |
|--------|------|
| `nova provider list` | 列出所有提供商（等同于 `model list`） |
| `nova provider add <name>` | 添加新的自定义提供商 |
| `nova provider add-model <provider>` | 向已有提供商添加模型 |
| `nova provider remove <name>` | 删除提供商 |

**provider add 选项：**

| 选项 | 说明 |
|------|------|
| `--base-url <url>` | **必需** — API 地址 |
| `--key <api-key>` | API Key |
| `--type <type>` | 提供商类型（默认 `custom`） |
| `--default-model <model>` | 默认模型名 |

**provider add-model 选项：**

| 选项 | 说明 |
|------|------|
| `--model-id <id>` | **必需** — 模型 ID |
| `--model-name <name>` | 显示名称 |
| `--features <list>` | 特性：`vision,tools,streaming,thinking`（逗号分隔） |
| `--max-context <n>` | 最大上下文 token 数 |
| `--max-output <n>` | 最大输出 token 数 |
| `--cost-in <n>` | 输入成本（美元/百万 token） |
| `--cost-out <n>` | 输出成本（美元/百万 token） |

**使用示例：**

```bash
# 添加自定义 OpenAI 兼容提供商
nova provider add my-api \
  --base-url https://api.myserver.com/v1 \
  --key sk-xxx \
  --default-model my-model

# 添加模型到已有提供商
nova provider add-model openai \
  --model-id gpt-4-turbo \
  --model-name "GPT-4 Turbo" \
  --features vision,tools,thinking \
  --max-context 128000 \
  --max-output 4096 \
  --cost-in 10 \
  --cost-out 30

# 删除提供商
nova provider remove my-api

# 使用自定义提供商的模型
nova -m my-api/my-model "你好"
```

---

### 1.7 ollama — Ollama 本地模型

管理本地 Ollama 服务的模型。

| 子命令 | 说明 |
|--------|------|
| `nova ollama status` | 查看 Ollama 服务状态 |
| `nova ollama list` | 列出已安装的本地模型 |
| `nova ollama pull <model>` | 从 Ollama Hub 拉取模型 |
| `nova ollama rm <model>` | 删除本地模型 |
| `nova ollama info <model>` | 查看模型详细信息 |
| `nova ollama run <model>` | 用指定模型启动 REPL |
| `nova ollama cloud` | 列出 Ollama Cloud 模型 |

**通用选项：**

| 选项 | 说明 |
|------|------|
| `--host <url>` | 指定 Ollama 服务地址（默认 `http://localhost:11434`） |

**使用示例：**

```bash
# 检查 Ollama 是否运行
nova ollama status

# 列出已安装模型
nova ollama list

# 拉取模型（带进度条）
nova ollama pull llama3.1
nova ollama pull qwen2.5-coder:7b
nova ollama pull deepseek-r1:14b

# 查看模型详情
nova ollama info llama3.1

# 删除模型
nova ollama rm unused-model

# 直接用某个模型启动交互会话
nova ollama run qwen2.5-coder

# 连接远程 Ollama 实例
nova ollama status --host http://192.168.1.100:11434
nova ollama list --host http://192.168.1.100:11434

# 查看 Ollama Cloud 模型
nova ollama cloud
```

---

### 1.8 coding-plan — 国内编程计划平台

快速接入国内 AI 编程平台的 API。

| 子命令 | 说明 |
|--------|------|
| `nova coding-plan list` | 列出所有支持的平台及定价 |
| `nova coding-plan add <platform> --key <api-key>` | 添加编程计划提供商 |

**支持的平台：**

| 平台 | 说明 | 可用模型 | 价格 |
|------|------|----------|------|
| `alibaba` | 阿里云百炼 | qwen3.5-plus, qwen3-coder, glm-5, minimax-m2.5, kimi-k2.5 | Lite ¥40/月, Pro ¥200/月 |
| `tencent` | 腾讯云 | hy-2.0-instruct, glm-5, kimi-k2.5, minimax-m2.5 | Lite ¥7.9/月, Pro ¥39.9/月 |
| `volcengine` | 火山引擎 | doubao-seed-code, deepseek-v3.2, glm-4.7, kimi-k2 | Lite ¥9.9/月, Pro ¥49.9/月 |
| `baidu` | 百度千帆 | glm-5, minimax-m2.5, kimi-k2.5, ernie-4.5 | ¥39.9/月 |
| `kimi` | Kimi Code | kimi-k2, kimi-k2.5 | ¥49/月 |
| `zhipu` | 智谱 | glm-4.7, glm-5 | ¥49/月 |
| `minimax` | MiniMax | minimax-2.7, abab6.5s-chat | ¥29/月 |

**使用示例：**

```bash
# 查看支持的平台
nova coding-plan list

# 添加阿里云百炼
nova coding-plan add alibaba --key sk-xxxxxxxxxxxx

# 添加腾讯云
nova coding-plan add tencent --key sk-xxxxxxxxxxxx

# 使用 Coding Plan 模型
nova -m coding-plan-alibaba/qwen3-coder "用 React 写一个 Todo 应用"
nova -m coding-plan-tencent/glm-5 "帮我写单元测试"
```

> **注意：** 添加 Coding Plan 提供商后，提供商名为 `coding-plan-<platform>`，使用时格式为 `coding-plan-<platform>/<model>`。

---

### 1.9 mcp — MCP 服务器管理

管理 Model Context Protocol (MCP) 服务器连接。

| 子命令 | 说明 |
|--------|------|
| `nova mcp status` | 显示所有 MCP 服务器连接状态 |
| `nova mcp list` | 同 `status` |
| `nova mcp tools` | 列出所有可用的 MCP 工具 |

**使用示例：**

```bash
# 查看 MCP 服务器状态
nova mcp status

# 列出所有 MCP 工具
nova mcp tools

# 输出示例（status）：
# MCP Server Status:
#
# ● filesystem          connected
#   Tools: 5  Resources: 0
# ● github              disconnected
#   Error: Connection refused

# 输出示例（tools）：
# MCP Tools
# ───────────────────────────────────────────
# ● github__create_pull_request
#   ○ filesystem__read_file
#   ○ sqlite__query
#
# 3 MCP tools available
```

**配置 MCP 服务器（编辑 `~/.nova/config.yaml`）：**

```yaml
mcp:
  filesystem:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/dir"]
  github:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-github"]
    env:
      GITHUB_TOKEN: your-token
  brave-search:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-brave-search"]
    env:
      BRAVE_API_KEY: your-key
  sqlite:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-sqlite", "--db-path", "/path/to/db.sqlite"]
```

**推荐的 MCP 服务器：**

| 包名 | 功能 |
|------|------|
| `@modelcontextprotocol/server-filesystem` | 文件系统操作 |
| `@modelcontextprotocol/server-github` | GitHub API |
| `@modelcontextprotocol/server-brave-search` | Brave 搜索引擎 |
| `@modelcontextprotocol/server-sqlite` | SQLite 数据库 |
| `@modelcontextprotocol/server-postgres` | PostgreSQL 数据库 |
| `@modelscope/mcp-server` | 魔搭（ModelScope） |

**MCP 工具调用格式：**

AI 通过 MCP 调用远程工具时，会显示命名空间前缀：

```
[INFO] Calling MCP tool: filesystem__read_file
  Input: {"path": "src/index.ts"}
```

**工具名称规则：**
- `provider__tool_name` — 提供商名 + 工具名
- 例如：`github__create_pull_request`, `filesystem__search_files`

**查看可用 MCP 工具：**
```bash
# CLI 方式
nova mcp tools

# REPL 方式  
/mcp tools
```

---

### 1.10 skills — 技能系统

管理 Nova 的扩展技能。

| 子命令 | 说明 |
|--------|------|
| `nova skills list` | 列出所有可用技能 |

## 安全注意事项

### 执行命令风险等级

| 操作 | 风险等级 | 默认审批 |
|------|----------|----------|
| 读取文件 | 低 ✅ | 自动 |
| 列出目录 | 低 ✅ | 自动 |
| 搜索内容 | 低 ✅ | 自动 |
| Web 搜索 | 低 ✅ | 自动 |
| 写入/编辑文件 | 高 ⚠️ | PLAN 模式需确认 |
| 执行 Shell 命令 | 关键 🔴 | PLAN 模式必须确认 |

### 推荐工作流

**新项目/实验性修改：**
```bash
nova --approval-mode plan
# 或
nova
/model
/mode plan
```

**熟悉项目/信任环境：**
```bash
nova --approval-mode yolo
# 或
nova
/mode auto
```

**只读分析/学习：**
```bash
nova --approval-mode ask
```

**使用示例：**

```bash
# 查看可用技能
nova skills list

# 输出示例：
# Available Skills:
#
#   react-expert          React 开发专家 [auto] (react, frontend)
#   python-debug          Python 调试助手 (python, debugging)
#   git-workflow          Git 工作流指南 (git, workflow)
#
# Total: 3 skills
```

**技能目录结构：**

```
~/.nova/skills/
  my-skill/
    SKILL.md     # 技能指令和元数据
    scripts/     # 可选脚本目录
```

## MCP 服务器开发指南

### 创建自定义 MCP 服务器

Nova CLI 支持通过 Model Context Protocol (MCP) 扩展功能。

#### 1. 基础 MCP 服务器模板

```javascript
// mcp-server.js
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');

class MyCustomServer {
  constructor() {
    this.server = new Server({
      name: 'my-custom-server',
      version: '1.0.0'
    });

    this.setupTools();
    this.setupResources();
  }

  setupTools() {
    // 注册工具
    this.server.addTool({
      name: 'get_weather',
      description: '获取天气信息',
      inputSchema: {
        type: 'object',
        properties: {
          city: { type: 'string', description: '城市名称' }
        },
        required: ['city']
      },
      handler: async (input) => {
        const weather = await fetchWeather(input.city);
        return { content: [{ type: 'text', text: JSON.stringify(weather) }] };
      }
    });
  }

  setupResources() {
    // 注册资源
    this.server.addResource({
      uri: 'memory://important-data',
      name: 'Important Data',
      description: '存储重要配置信息'
    });
  }

  async start() {
    await this.server.connect();
    console.log('MCP Server started');
  }
}

module.exports = MyCustomServer;
```

#### 2. Nova 配置文件集成

```yaml
# ~/.nova/config.yaml
mcp:
  weather-server:
    command: node
    args: ["-e", "require('./mcp-server.js'); const s = new MyCustomServer(); s.start();"]
    env:
      WEATHER_API_KEY: your-api-key
    enabled: true

  database-server:
    command: docker
    args: ["run", "-d", "--name", "mcp-db", "postgres:13"]
    env:
      POSTGRES_PASSWORD: secret
    enabled: false  # 按需启用
```

#### 3. 技能系统开发

**SKILL.md 模板：**

```markdown
# 技能名称：React 专家助手

## 描述
专门处理 React 相关问题的 AI 助手

## 版本
1.0.0

## 作者
Your Name <your.email@example.com>

## 标签
react, frontend, hooks, typescript

## 系统提示
你是一个专业的 React 开发专家。请遵循以下原则：

1. 使用最新的 React 18+ 最佳实践
2. 优先推荐函数式组件和 Hooks
3. 确保 TypeScript 类型安全
4. 遵循 Airbnb JavaScript 规范
5. 提供完整的代码示例

## 可用命令
- `create-component` - 创建新的 React 组件
- `optimize-hooks` - 优化现有 Hooks 实现
- `debug-problem` - 调试 React 问题

## 输入格式
用户输入应包含具体的问题描述或需求说明。

## 输出要求
- 代码必须完整可运行
- 添加必要的 JSDoc 注释
- 解释关键设计决策
```

**技能脚本示例：**

```bash
#!/bin/bash
# ~/.nova/skills/react-expert/scripts/generate-component.sh

echo "🔨 生成 React 组件"
echo "请输入组件名称："
read componentName

if [ -z "$componentName" ]; then
  echo "❌ 组件名称不能为空"
  exit 1
fi

# 生成组件文件
cat > "components/${componentName}.tsx" << EOF
import React from 'react';

interface ${componentName}Props {
  // Props 定义
}

export const ${componentName}: React.FC<${componentName}Props> = () => {
  return (
    <div>
      <h1>${componentName}</h1>
    </div>
  );
};
EOF

echo "✅ 组件已生成: components/${componentName}.tsx"
```

#### 4. 插件开发

**自定义工具插件：**

```typescript
// plugins/my-tool.ts
import { ToolRegistry } from '@nova/core/tools/ToolRegistry';

export class MyCustomTool {
  static register(registry: ToolRegistry) {
    registry.register({
      name: 'custom_api_call',
      description: '调用自定义 API',
      category: 'execution',
      riskLevel: 'medium',
      inputSchema: {
        type: 'object',
        properties: {
          endpoint: { type: 'string' },
          method: { type: 'string', enum: ['GET', 'POST'] },
          data: { type: 'object' }
        },
        required: ['endpoint']
      },
      handler: async (input) => {
        const response = await fetch(input.endpoint, {
          method: input.method || 'GET',
          body: input.data ? JSON.stringify(input.data) : undefined,
          headers: { 'Content-Type': 'application/json' }
        });
        
        return { 
          content: [{ type: 'text', text: await response.text() }],
          isError: !response.ok 
        };
      }
    });
  }
}
```

**插件配置文件：**

```json
{
  "name": "my-nova-plugin",
  "version": "1.0.0",
  "description": "Custom tools for Nova CLI",
  "main": "dist/plugin.js",
  "scripts": {
    "build": "tsc",
    "dev": "nodemon src/plugin.ts"
  },
  "dependencies": {
    "@nova/core": "^0.1.0"
  },
  "peerDependencies": {
    "nova-cli": "^0.1.0"
  }
}
```

#### 5. 第三方工具集成

**Git 工作流集成：**

```yaml
# .nova/git-workflow.yaml
workflows:
  feature-branch:
    steps:
      - git checkout -b feature/new-feature
      - nova -p "实现新功能"
      - git add .
      - git commit -m "feat: 新增功能"
      - git push origin feature/new-feature
  
  code-review:
    steps:
      - nova -p "审查代码质量"
      - nova -p "检查测试覆盖率"
      - git status
      - echo "Review completed!"
```

**CI/CD 集成：**

```yaml
# .github/workflows/nova.yml
name: Nova Code Review
on: [push, pull_request]

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Nova
        run: npm install -g nova-cli
        
      - name: Run Code Review
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: |
          nova -d . -p "进行代码审查，指出潜在问题和改进建议"
          
      - name: Upload Report
        uses: actions/upload-artifact@v3
        with:
          name: nova-review-report
          path: nova-report.md
```

#### 6. 性能监控插件

```typescript
// plugins/monitoring.ts
import { Plugin } from '@nova/core/plugins/Plugin';

export class MonitoringPlugin extends Plugin {
  onEnable() {
    this.logger.info('Monitoring plugin enabled');
    
    // 监控 Token 使用情况
    this.hook('before_tool_execute', (tool) => {
      if (tool.name === 'execute_command') {
        this.startTimer(tool.id);
      }
    });
    
    this.hook('after_tool_complete', (result) => {
      this.recordMetrics(result);
    });
  }
  
  private recordMetrics(result: any) {
    // 记录性能指标
    console.log(`Tool ${result.toolName} took ${result.duration}ms`);
  }
}
```

#### 7. 开发工具包

**项目脚手架：**

```bash
# 安装 Nova 插件开发工具
npm install -g @nova/dev-tools

# 创建新插件项目
nova-dev init my-awesome-plugin --type=mcp

# 启动开发环境
cd my-awesome-plugin
npm run dev

# 构建插件
npm run build

# 发布到 npm
npm publish
```

**调试工具：**

```bash
# 启动调试模式
nova --debug -p "test"

# 查看连接的所有 MCP 服务器
nova mcp list --verbose

# 测试技能加载
nova skills test my-skill

# 性能分析
nova profile start
nova profile stop --report=profile.json
```

#### 8. 最佳实践

**MCP 服务器开发：**
- 保持轻量级，避免阻塞操作
- 实现优雅的错误处理
- 提供详细的日志输出
- 支持热重载配置

**技能开发：**
- 遵循单一职责原则
- 提供清晰的文档
- 支持参数验证
- 包含单元测试

**插件开发：**
- 使用 TypeScript 确保类型安全
- 遵循 SemVer 版本规范
- 提供完整的 README
- 编写自动化测试

**性能考虑：**
- 缓存频繁访问的数据
- 异步处理耗时操作
- 限制内存使用
- 定期清理临时文件

通过这些扩展功能，Nova CLI 可以成为一个强大的 AI 编程助手生态系统。

---

## 2. 交互式 REPL 斜杠命令

进入 REPL 交互模式后，可以输入 `/` 开头的命令。

### 2.1 导航命令

| 命令 | 别名 | 说明 |
|------|------|------|
| `/help` | `/h`, `/?` | 显示帮助面板 |
| `/quit` | `/exit`, `/q` | 退出 REPL（会话自动保存） |
| `/clear` | `/reset` | 清除当前对话，开始新会话 |

### 2.2 会话管理

| 命令 | 说明 |
|------|------|
| `/status` | 显示当前会话的统计信息（会话 ID、轮次、Token、消息数） |
| `/history` | 列出最近 20 个历史会话 |
| `/history restore <n>` | 切换到第 n 个历史会话 |
| `/history delete <n>` | 删除第 n 个历史会话 |
| `/compress` | 手动触发上下文压缩，保存会话快照 |

**使用示例：**

```
[AUTO] gpt-4o → /status
  Session: a1b2c3d4
  Mode:    AUTO
  Turns:   12
  Tokens:  45000 in / 12000 out
  Msgs:    24

[AUTO] gpt-4o → /history
  Session History
  ───────────────────────────────────────────
  1. 重构用户认证模块 ← current
      a1b2c3d4  2026-03-27 14:30  12 turns  57,000 tok
  2. 编写 API 文档
      e5f6g7h8  2026-03-26 09:15  5 turns   23,000 tok
  3. 修复登录 Bug
      i9j0k1l2  2026-03-25 16:00  3 turns   12,000 tok

  /history restore <n>  — switch to session n
  /history delete <n>   — delete session n
```

### 2.3 模型与模式

| 命令 | 说明 |
|------|------|
| `/model` | 打开交互式模型选择器（上下键导航，Enter 选择） |
| `/model <model-id>` | 直接切换到指定模型 |

#### 交互式模型选择器详细操作

**操作流程：**
1. 输入 `/model` 后按回车
2. 使用键盘导航：
   - ↑ / k：向上移动
   - ↓ / j：向下移动  
   - 数字键 1-9：快速选择（对应列表位置）
   - Enter：确认选择
   - Esc / Ctrl+C：取消

**界面示例：**

```
  ╭──────────────────────────────────────────────────╮
  │ Select a model (↑↓ navigate, Enter select, Esc cancel) │
  │ Current: gpt-4o                                  │
  ├──────────────────────────────────────────────────┤
  ▶ ● GPT-4o (gpt-4o)
    ▶ ○ Claude 3.5 Sonnet (claude-3.5-sonnet)
      ○ Llama3.1 (llama3.1)
  ╰──────────────────────────────────────────────────╯
```

**状态说明：**
- `▶` — 当前选中项
- `●` — 当前正在使用的模型
- `○` — 其他可用模型
- 支持实时预览，选择后立即生效
| `/mode` | 循环切换模式：AUTO → PLAN → ASK |
| `/mode auto` | 设置为 AUTO 模式（全自动，无需审批） |
| `/mode plan` | 设置为 PLAN 模式（先制定计划，确认后执行） |
| `/mode ask` | 设置为 ASK 模式（只回答问题，不修改文件） |
| `/thinking` | 切换显示/隐藏思考过程 |
| `/compact` | 切换显示模式（compact / verbose） |
| `/tools` | 显示当前可用的内置工具列表 |

**使用示例：**

```
[AUTO] gpt-4o → /model claude-3.5-sonnet
  ✓ Switched to model: claude-3.5-sonnet

[PLAN] claude-3.5-sonnet → /mode
  → Mode: PLAN · Plan first, then confirm each action

[PLAN] claude-3.5-sonnet → /mode ask
  Mode: ASK — read-only, answer only
  Approval: plan

[ASK] claude-3.5-sonnet → /tools
  Tools (12): read_file, write_file, edit_file, list_directory, search_file...
```

### 2.4 记忆系统

| 命令 | 说明 |
|------|------|
| `/init` | 在当前目录生成 `NOVA.md` 项目记忆文件 |
| `/init <dir>` | 在指定目录生成 `NOVA.md` |
| `/init --force` | 强制重新生成（覆盖已有文件） |
| `/memory` | 显示持久化笔记 |
| `/memory show` | 同上 |
| `/memory add <text>` | 添加一条笔记 |
| `/memory clear` | 清空所有笔记 |
| `/memory edit` | 用编辑器打开笔记文件 |

**使用示例：**

```
[AUTO] gpt-4o → /init
  Scanning project structure...
  ✓ NOVA.md created at /my/project/NOVA.md
  This file helps the AI understand your project.
  Edit it to add custom instructions and context.

[AUTO] gpt-4o → /memory add 这个项目使用 pnpm，不要用 npm
  ✓ Memory saved: "这个项目使用 pnpm，不要用 npm"

[AUTO] gpt-4o → /memory add 测试命令是 pnpm test:coverage
  ✓ Memory saved: "测试命令是 pnpm test:coverage"

[AUTO] gpt-4o → /memory
  Nova Memory
  ───────────────────────────────────────────
  # Nova Memory
  ## Notes
  - [2026-03-27] 这个项目使用 pnpm，不要用 npm
  - [2026-03-27] 测试命令是 pnpm test:coverage
```

### 2.5 扩展系统

| 命令 | 说明 |
|------|------|
| `/mcp` | 显示 MCP 服务器状态（等同于 CLI `nova mcp status`） |
| `/mcp tools` | 列出所有 MCP 提供的工具 |
| `/skills` | 列出所有可用技能 |
| `/skills info <name>` | 查看技能详情 |
| `/skills use <name>` | 将技能注入到下一条消息中 |

**使用示例：**

```
# 查看 MCP 状态
[AUTO] gpt-4o → /mcp
  MCP Servers
  ───────────────────────────────────────────
  ✓ filesystem         connected
      5 tools
  ✗ github              disconnected: Connection refused

  1/2 servers connected

# 查看 MCP 工具
[AUTO] gpt-4o → /mcp tools
  MCP Tools
  ───────────────────────────────────────────
  ● github__create_pull_request
    ○ filesystem__read_file
    ○ sqlite__query

  3 MCP tools available

# 使用技能
[AUTO] gpt-4o → /skills use react-expert
  Skill "react-expert" will be injected into your next message.

[AUTO] gpt-4o → 帮我写一个自定义 Hook
  ⚡ Skill "react-expert" injected
  ...
```

### 2.6 其他命令

| 命令 | 说明 |
|------|------|
| `Ctrl+C` | 中断当前正在执行的任务（会话已保存） |
| `Ctrl+D` | 退出 REPL |

---

## 3. 快捷输入方式

### 3.1 @文件引用

在输入中用 `@` 引用文件或目录，Nova 会自动展开文件内容。

```bash
# 引用单个文件
@src/App.tsx 帮我优化这个组件

# 引用目录（自动列出目录结构并包含小文件内容）
@src/components/ 分析这些组件的代码结构

# 引用配置文件
@tsconfig.json 解释这些编译选项
@package.json 梳理项目的依赖关系
```

**规则：**
- 单个文件：最大 200KB，超过会提示
- 目录：最多 20 个文本文件，总计 100KB
- 自动识别文本文件类型（`.ts`, `.tsx`, `.js`, `.py`, `.go`, `.rs`, `.md` 等）

### 3.2 !Shell 命令

用 `!` 前缀直接执行 Shell 命令（不经过 AI）。

```bash
!ls -la
!git status
!npm test
!docker ps
!python --version
```

**特点：**
- 直接在终端执行，实时输出
- 不消耗 AI Token
- 支持所有平台 Shell（Windows 用 PowerShell，其他用 bash）
- 显示执行时间

### 3.3 多行输入

输入以 `\` 结尾时，进入多行输入模式。空行结束多行输入。

```
[AUTO] gpt-4o → 帮我写一个函数：\
  ↓
函数名是 calculateDiscount，\
  ↓
接收 price 和 discountPercentage 两个参数，\
  ↓
返回折扣后的价格。

  ↓（空行，结束多行输入）
```

---

## 4. 内置工具一览

Nova 内置 12 个工具，AI 可以根据需要自动调用：

| 工具名 | 分类 | 风险级别 | 说明 |
|--------|------|----------|------|
| `read_file` | file | low | 读取文件内容，支持 offset/limit 分段读取 |
| `write_file` | file | high | 创建新文件，支持自动创建目录 |
| `edit_file` | file | high | 编辑已有文件，精确替换文本片段 |
| `list_directory` | file | low | 列出目录内容 |
| `search_file` | search | low | 按文件名模式搜索（Glob 匹配） |
| `search_content` | search | low | 按内容正则搜索（Ripgrep 引擎） |
| `execute_command` | execution | critical | 执行 Shell 命令（需审批） |
| `web_search` | web | low | 搜索互联网获取最新信息 |
| `web_fetch` | web | low | 抓取网页内容，转换为文本 |
| `memory_read` | memory | low | 读取跨会话持久化记忆 |
| `memory_write` | memory | medium | 写入持久化记忆，支持 TTL 和标签 |
| `todo` | orchestration | medium | 任务进度跟踪（create/update/list） |

**审批机制：**
- `memory_read` — 自动批准
- `read_file`, `list_directory`, `search_file`, `search_content`, `web_search`, `web_fetch` — 低风险，自动批准
- `write_file`, `edit_file` — 高风险，PLAN 模式下需确认
- `execute_command` — 关键风险，PLAN 模式下必须确认

---

## 5. 交互模式详解

Nova 提供三种交互模式，通过 `/mode` 命令或 `--approval-mode` 参数切换：

### AUTO 模式

```
[AUTO] gpt-4o →
```

- **审批模式：** `yolo` — 所有操作自动批准
- **适用场景：** 信任的代码生成、熟悉的项目
- **特点：** AI 全自主运行，效率最高

### PLAN 模式

```
[PLAN] gpt-4o →
```

- **审批模式：** `plan` — 需确认每个工具调用
- **适用场景：** 重要修改、生产代码、代码审查
- **特点：** AI 会先分析并制定计划，每个文件修改和命令执行前会征求同意
- **交互提示：** `Allow? [y/N/a(ll)]`
  - `y` — 允许本次
  - `N` — 拒绝（默认）
  - `a` — 本次任务剩余操作全部允许（临时切换为 AUTO）

### ASK 模式

```
[ASK] gpt-4o →
```

- **审批模式：** `plan` — 只读模式
- **适用场景：** 代码分析、问答、学习
- **特点：** AI 只回答问题，不会修改文件或执行命令
- **系统提示：** `[ASK MODE] Only answer questions. Do NOT modify files or execute commands.`

---

## 6. 配置文件参考

配置文件位置：`~/.nova/config.yaml`

```yaml
# Nova CLI 配置文件

# 核心设置
core:
  defaultModel: "glm-5"           # 默认模型
  defaultApprovalMode: "default"  # 默认审批模式: yolo | default | plan | smart
  maxTurns: 20                    # 最大对话轮次
  maxTokens: 16384                # 每次响应最大 Token 数
  temperature: 0.7                # 温度（0-1）
  contextWindowTarget: 128000     # 上下文窗口大小
  streaming: true                 # 默认开启流式输出
  logLevel: "info"                # 日志级别: debug | info | warn | error | silent
  timeout: 120000                 # 全局超时（毫秒）

# 模型配置
models:
  # 模型别名
  aliases:
    "cloud": "deepseek-v3.2"
    "glm-cloud": "glm-5"
    "fast": "gpt-4o-mini"

  # 提供商
  providers:
    anthropic:
      type: "anthropic"
      models:
        claude-3.5-sonnet:
          name: "Claude 3.5 Sonnet"
          maxContextTokens: 200000
          maxOutputTokens: 8192
          supportsVision: true
          supportsTools: true
          supportsStreaming: true
          supportsThinking: true
          inputCostPerMToken: 3
          outputCostPerMToken: 15

    openai:
      type: "openai"
      models:
        gpt-4o:
          name: "GPT-4o"
          maxContextTokens: 128000
          maxOutputTokens: 4096
          supportsVision: true
          supportsTools: true
          supportsStreaming: true
          supportsThinking: false
          inputCostPerMToken: 2.5
          outputCostPerMToken: 10

    ollama:
      type: "ollama"
      baseUrl: "http://localhost:11434"
      models: {}  # 自动发现，无需手动配置

# MCP 服务器
mcp:
  filesystem:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/home/user/projects"]
    enabled: true
  github:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-github"]
    env:
      GITHUB_TOKEN: "ghp_xxx"
    enabled: true

# 钩子（在特定事件时执行命令）
hooks:
  - event: "before_tool_execute"
    matcher: "execute_command"
    command: "echo 'About to execute a command'"
    timeout: 5000
  - event: "after_file_write"
    command: "prettier --write $FILE_PATH"
    timeout: 10000

# 文件过滤
fileFilter:
  ignorePatterns:
    - "node_modules/**"
    - "dist/**"
    - ".git/**"
    - "*.min.js"
    - "*.lock"
  maxFileSize: 10485760    # 10MB
  maxBatchSize: 50
  forbiddenPaths:
    - "/etc"
    - "/System"
    - "C:\\Windows"

# 安全设置
security:
  sandbox: "none"           # none | restricted | full
  checkpoints: true
  blockedCommands:
    - "rm -rf /"
    - "format"
    - ":(){ :|:& };:"

# 用户偏好
preferences:
  theme: "dark"
  editor: "code"
  shell: "powershell"
  language: "zh-CN"
```

## 多语言支持

Nova CLI 提供完整的多语言支持，包括中文、英文等。

### 支持的语言列表

| 语言代码 | 语言名称 | 本地化程度 |
|----------|----------|------------|
| `zh-CN` | 简体中文（中国大陆） | 完全支持 |
| `zh-TW` | 繁体中文（台湾） | 基本支持 |
| `en-US` | 英语（美国） | 完全支持 |
| `ja-JP` | 日语（日本） | 基本支持 |
| `ko-KR` | 韩语（韩国） | 基本支持 |

---

## 7. 完整使用案例

## 7. 完整使用案例

### 案例 1：从零开始配置和使用

```bash
# 步骤 1：查看帮助
nova help

# 步骤 2：配置 API Key
nova auth set deepseek --key sk-xxxxxxxxxxxx

# 步骤 3：确认配置
nova auth status

# 步骤 4：查看可用模型
nova model list

# 步骤 5：启动交互式会话
nova

# REPL 中操作：
# /init                    # 生成 NOVA.md 项目记忆文件
# 分析一下这个项目的架构
# 帮我写一个用户登录模块
# /mode plan               # 切换为计划模式
# 重构这个模块的性能问题
# /memory add 登录模块已重构完成
# /status                  # 查看会话统计
# /quit                    # 退出（自动保存）
```

### 案例 2：使用 Ollama 本地模型

```bash
# 步骤 1：安装并启动 Ollama
ollama serve

# 步骤 2：配置 Nova 连接 Ollama
nova auth set ollama --base-url http://localhost:11434

# 步骤 3：查看 Ollama 状态
nova ollama status

# 步骤 4：拉取模型
nova ollama pull qwen2.5-coder:7b

# 步骤 5：列出已安装模型
nova ollama list

# 步骤 6：使用 Ollama 模型
nova -m qwen2.5-coder:7b "写一个快速排序"
# 或直接：
nova ollama run qwen2.5-coder:7b
```

### 案例 3：使用 Coding Plan 国内平台

```bash
# 步骤 1：查看支持的平台
nova coding-plan list

# 步骤 2：添加腾讯云 Coding Plan
nova coding-plan add tencent --key sk-xxxxxxxxxxxx

# 步骤 3：使用
nova -m coding-plan-tencent/glm-5 "帮我写一个 RESTful API"

# 查看模型列表（新添加的 Coding Plan 提供商会出现）
nova model list
```

### 案例 4：项目开发全流程

```bash
# 在项目目录中启动
cd /my/project
nova

# REPL 中的工作流：
# /init --force                # 重新生成项目记忆

# 分析阶段：
# @src/ 分析项目整体架构       # 用 @ 引用整个目录
# 找出代码中的潜在问题         # AI 自动搜索和分析

# 开发阶段：
# /mode auto                   # 全自动模式
# 在 UserService 中添加一个批量删除用户的方法
# 为这个方法编写单元测试
# 更新 API 文档

# 审查阶段：
# /mode plan                   # 切换为计划模式（需确认）
# 审查最近的代码变更
# 修复发现的性能问题

# 学习阶段：
# /mode ask                    # 只读模式
# 解释一下这个设计模式为什么这样用

# 整理阶段：
# /memory add 项目使用 TypeScript + Express
# /compress                    # 压缩上下文
# /status                      # 查看统计
# /history                     # 查看历史会话
```

### 案例 5：Shell 命令与文件操作

```bash
nova

# REPL 中：
# !git status                                        # 快速执行 Git 命令
# !npm test                                          # 运行测试
# !docker compose up -d                              # 启动容器

# @src/utils/helpers.ts 帮我给这个文件添加 JSDoc 注释
# @package.json 添加一个 lint 脚本
# @README.md 更新安装说明部分

# 多行输入示例：
# 帮我创建一个 Express 中间件：\
#   ↓
# 功能是验证 JWT Token，\
#   ↓
# 从 Authorization header 中提取，\
#   ↓
# 验证失败返回 401。
```

### 案例 6：MCP 扩展工具

```bash
# 1. 编辑配置添加 MCP 服务器
nova config edit

# 在 config.yaml 中添加：
# mcp:
#   filesystem:
#     command: npx
#     args: ["-y", "@modelcontextprotocol/server-filesystem", "/my/project"]

# 2. 查看 MCP 状态
nova mcp status

# 3. 在 REPL 中使用
nova

# /mcp                        # 查看连接状态
# /mcp tools                  # 查看可用的 MCP 工具

# AI 会自动使用 MCP 提供的额外工具
# 帮我在 GitHub 上创建一个 PR
# 查询 SQLite 数据库中的用户数据
```

### 案例 7：会话管理

```bash
# 继续上次中断的会话
nova -c

# 交互式选择历史会话
nova -r

# 在 REPL 中管理会话：
# /history                    # 列出历史
# /history restore 3          # 恢复第 3 个会话
# /status                     # 当前会话信息
# /clear                      # 开始新会话
```

### 案例 8：自定义提供商接入

```bash
# 接入一个 OpenAI 兼容的第三方 API

# 步骤 1：添加提供商
nova provider add my-llm \
  --base-url https://api.myprovider.com/v1 \
  --key sk-xxxxxxxxxxxx \
  --default-model my-model

# 步骤 2：添加更多模型
nova provider add-model my-llm \
  --model-id my-large-model \
  --model-name "My Large Model" \
  --features vision,tools,thinking \
  --max-context 200000 \
  --max-output 8192

# 步骤 3：使用
nova -m my-llm/my-model "你好"
nova -m my-llm/my-large-model "帮我写一个复杂的应用"

# 步骤 4：查看
nova model list
nova provider list
```

---

## 8. 常见问题

### Q: 如何切换默认模型？

```bash
# 方式 1：每次启动时指定
nova -m <model-id>

# 方式 2：在 REPL 中切换
/model <model-id>

# 方式 3：修改配置文件
nova config edit
# 修改 core.defaultModel 的值
```

## 9. 错误处理与故障排除

### 常见错误码

| 错误码 | HTTP 状态 | 说明 | 解决方案 |
|--------|-----------|------|----------|
| `AUTH_ERROR` | 401 | API Key 无效或过期 | `nova auth set <provider>` |
| `CONFIG_ERROR` | 400 | 配置文件语法错误 | `nova config edit` 检查 YAML 格式 |
| `NETWORK_ERROR` | 502/504 | 连接超时或中断 | 检查网络连接，重试命令 |
| `RATE_LIMIT` | 429 | 请求频率超限 | 降低调用频率，等待 1-2 分钟重试 |
| `MODEL_NOT_FOUND` | 404 | 模型 ID 不存在 | `nova model list` 查看可用模型 |
| `QUOTA_EXCEEDED` | 402 | 账户额度不足 | 检查提供商控制台，充值或升级套餐 |

### 调试模式启用

```bash
# 启动时启用详细日志
nova --log-level debug -p "test"

# 查看 Nova CLI 日志文件
cat ~/.nova/logs/latest.log
```

### 网络问题排查

**Ollama 连接失败：**
```bash
# 1. 检查 Ollama 是否运行
nova ollama status

# 2. 手动测试连接
curl http://localhost:11434/api/tags

# 3. 配置自定义地址
nova auth set ollama --base-url http://your-host:11434
```

**API 请求超时：**
- 检查网络代理设置
- 尝试更换 DNS（8.8.8.8）
- 使用国内 Coding Plan 平台替代

### 配置文件验证

```bash
# 检查配置文件语法
python -c "
import yaml
with open('~/.nova/config.yaml', 'r') as f:
    data = yaml.safe_load(f)
    print('Config valid:', bool(data))
"

# 重置为默认配置
rm ~/.nova/config.yaml
nova config edit  # 重新创建
```

### 会话恢复失败

```bash
# 列出所有会话
ls ~/.nova/sessions/

# 删除损坏的会话文件
rm ~/.nova/sessions/session-broken-id.json

# 清理缓存
rm -rf ~/.nova/cache/*
```

### 技能系统问题

**技能未加载：**
```bash
# 检查技能目录结构
ls ~/.nova/skills/

# 验证 SKILL.md 格式
head ~/.nova/skills/my-skill/SKILL.md

# 重启 Nova 使更改生效
pkill nova && nova
```

### MCP 服务器连接问题

```bash
# 检查 MCP 服务器进程
ps aux | grep mcp

# 查看 MCP 详细日志
nova mcp status --verbose

# 重新连接服务器
nova mcp disconnect <server-name>
nova mcp connect <server-name>
```

### 性能优化与监控

**查看 Token 使用情况：**
```bash
# 单次对话统计
nova -p "任务" --show-stats

# 历史会话分析
/repl /stats --detailed
```

**内存泄漏排查：**
```bash
# 监控内存使用
top -p $(pgrep nova)

# 强制垃圾回收
/repl /gc
```

### 安全审计日志

```bash
# 查看审批记录
cat ~/.nova/security/approval.log

# 审计文件操作
grep "FILE_WRITE" ~/.nova/security/audit.log

# 导出安全报告
nova security audit --export audit-report.json
```

```bash
# 方式 1：每次启动时指定
nova -m <model-id>

# 方式 2：在 REPL 中切换
/model <model-id>

# 方式 3：修改配置文件
nova config edit
# 修改 core.defaultModel 的值
```

### Q: 如何设置 API Key？

```bash
# 方式 1：命令行交互设置
nova auth set <provider>

# 方式 2：命令行直接传入
nova auth set <provider> --key <api-key>

# 方式 3：环境变量
export <PROVIDER>_API_KEY=<key>
```

### Q: 如何使用国内模型？

```bash
# 方式 1：通过 Coding Plan
nova coding-plan add tencent --key <key>
nova -m coding-plan-tencent/glm-5

# 方式 2：通过自定义 Provider
nova auth set deepseek --key <key>
nova -m deepseek-v3.2

# 方式 3：通过 SiliconFlow
nova auth set siliconflow --base-url https://api.siliconflow.cn/v1 --key <key>
```

### Q: 如何使用本地模型（Ollama）？

```bash
# 1. 安装并启动 Ollama
ollama serve

# 2. 配置 Nova
nova auth set ollama

# 3. 拉取模型
nova ollama pull llama3.1

# 4. 使用
nova -m llama3.1
# 或
nova ollama run llama3.1
```

### Q: 会话保存在哪里？

会话自动保存在 `~/.nova/sessions/` 目录下。每次对话结束后、`/quit` 退出时、`Ctrl+C` 中断时都会自动保存。可用 `-c` 继续上次会话，`-r` 选择历史会话。

## 性能优化建议

### Token 使用优化

1. **精确引用文件：**
   ```bash
   # ❌ 不好：@src/ 可能包含大量无关文件
   @src/
   
   # ✅ 好：指定具体文件
   @src/main.tsx
   ```

2. **使用多行输入减少交互：**
   ```bash
   # 一次性描述完整需求
   帮我重构用户认证模块：\
     1. 提取 JWT 验证逻辑为独立 Hook\
     2. 添加 refresh token 机制\
     3. 编写单元测试
   ```

3. **合理设置会话上下文：**
   ```bash
   # 复杂项目前手动压缩上下文
   /compress
   ```

### 网络请求优化

- Ollama 本地模型：零网络延迟
- Coding Plan 国内平台：国内节点加速
- 自定义 Base URL：就近接入

### 内存管理

- 每 20-30 轮对话建议 `/compress`
- 大项目使用 `@file` 而非 `@dir` 减少 Token 消耗
- ASK 模式不产生工具调用开销

### Q: 如何配置 MCP 服务器？

编辑 `~/.nova/config.yaml`，在 `mcp:` 下添加服务器配置。详见 [1.9 MCP 服务器管理](#19-mcp--mcp-服务器管理)。

### Q: 支持 Python 项目吗？

支持。Nova 的内置工具可以操作任何语言的文件。Ollama 本地模型特别适合处理 Python 项目。

```bash
nova -d /my/python/project "分析这个 Django 项目的结构"
@requirements.txt 帮我优化依赖版本
```

---

*本文档基于 Nova CLI v0.1.0 源码生成，如需最新信息请运行 `nova help`。*
