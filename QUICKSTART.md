# Nova CLI 快速开始

## 安装

### 方式 1: 直接使用脚本 (推荐开发使用)

```bash
# 进入项目目录
cd nova-cli

# Windows
.\nova.cmd --help

# Linux/Mac
./nova --help
```

### 方式 2: 全局安装 (推荐用户使用)

```bash
# 进入项目目录
cd nova-cli

# 安装依赖
pnpm install

# 全局链接
npm link

# 现在可以在任何地方使用 nova 命令
nova --help
nova
```

### 方式 3: 使用 npx (无需安装)

```bash
npx tsx packages/cli/bin/nova.js --help
```

## 配置 Ollama 本地模型

### 1. 安装 Ollama

访问 https://ollama.com 下载并安装

### 2. 拉取模型

```bash
# 使用 Nova CLI 拉取模型
nova ollama pull llama3.2
nova ollama pull qwen2.5-coder

# 或使用 ollama 命令
ollama pull llama3.2
```

### 3. 使用本地模型

```bash
# 直接使用模型名称启动
nova -m llama3.2

# 或使用 ollama 别名
nova -m local
```

## 配置云端 API

### Ollama Cloud (默认)
```bash
nova auth set ollama-cloud
# 输入你的 API key
```

### Anthropic
```bash
nova auth set anthropic
# 输入你的 ANTHROPIC_API_KEY
```

### OpenAI
```bash
nova auth set openai
# 输入你的 OPENAI_API_KEY
```

### 其他提供商
```bash
nova auth set <provider>
# 支持的提供商: google, deepseek, qwen, glm, moonshot, baichuan, minimax, yi, groq, mistral, together, perplexity
```

## 常用命令

```bash
nova                          # 启动交互式会话 (默认使用 glm-5)
nova -m gpt-4o               # 使用 GPT-4o
nova -m claude-sonnet-4      # 使用 Claude Sonnet 4
nova -m llama3.2             # 使用本地 Ollama 模型
nova -p "解释这段代码"        # 单条命令模式
nova -c                      # 继续上次会话
nova -r                      # 恢复历史会话
nova model list              # 列出所有可用模型
nova ollama status           # 检查 Ollama 状态
nova ollama list             # 列出本地模型
```

## 快捷方式

- `@file.ts` - 注入文件内容到对话
- `!git status` - 直接执行 shell 命令
- `line\` - 多行输入（行尾加反斜杠）
- `/help` - 查看所有命令
- `/quit` - 退出

## 支持的模型提供商

- **国际**: Anthropic, OpenAI, Google, DeepSeek, Groq, Mistral, Together AI, Perplexity
- **中国**: 通义千问(Qwen), 智谱(GLM), 月之暗面(Moonshot), 百川(Baichuan), MiniMax, 零一万物(Yi), SiliconFlow
- **本地**: Ollama (本地部署任意模型)
- **云端**: Ollama Cloud (托管模型)

## 自定义提供商

```bash
nova provider add my-api \
  --base-url https://api.example.com/v1 \
  --key sk-xxx
```
