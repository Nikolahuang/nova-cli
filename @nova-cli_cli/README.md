# Nova CLI

Next-generation AI-powered terminal assistant.

## Installation

```bash
npm install -g nova-ai-terminal@latest
```

## Quick Start

```bash
# First run will show setup wizard
nova

# Or manually configure a provider
nova auth set ollama-cloud --key YOUR_API_KEY
```

## Features

- **Multiple AI Providers**: Anthropic, OpenAI, Ollama (local/cloud), DeepSeek, Qwen, GLM, and more
- **Coding Plan Support**: 国内平台 (阿里云/腾讯云/智谱等) 固定月费
- **Interactive REPL**: Modern terminal UI with session management
- **MCP Integration**: Model Context Protocol for tool extensions
- **Skills System**: Extensible skill framework

## First-Time Setup

When you run `nova` for the first time, you'll see a setup wizard:

1. **Ollama (Local)** - Run models locally, free, no API key needed
2. **Ollama Cloud** - Cloud-hosted models, requires API key
3. **Coding Plan** - 国内平台 (阿里云/腾讯云/智谱等), 固定月费
4. **Custom Provider** - Enter your own API endpoint
5. **Skip setup** - Configure later with `nova auth set`

## Commands

```bash
nova                          # Start interactive session
nova -p "your prompt"         # Single prompt mode
nova -c                       # Continue last session
nova -r                       # Resume session from history
nova -m <model>               # Use specific model

nova model list               # List available models
nova auth set <provider>      # Configure API key
nova config show              # Show configuration

nova coding-plan list         # List Coding Plan platforms
nova coding-plan add <name>   # Add Coding Plan provider

nova mcp status               # Show MCP server status
nova skills list              # List installed skills
```

## Supported Providers

### International
- Anthropic (Claude)
- OpenAI (GPT)
- Google (Gemini)
- DeepSeek
- Ollama (local & cloud)
- Groq, Mistral, Together AI, Perplexity

### 国内平台 (Coding Plan)
- 阿里云百炼 (Alibaba)
- 腾讯云 (Tencent)
- 火山引擎 (Volcengine)
- 百度千帆 (Baidu)
- Kimi
- 智谱 AI (Zhipu)
- MiniMax

## Documentation

Full documentation: https://github.com/nova-cli/nova-cli

## License

MIT
