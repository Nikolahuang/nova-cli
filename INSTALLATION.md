# Nova CLI 安装指南

Nova CLI 是一个强大的 AI 编程助手命令行工具，支持多种 AI 模型提供商。

## 快速安装

### 前置要求

- Node.js 18.0.0 或更高版本

### 安装步骤

#### 1. 安装 Node.js

访问 [https://nodejs.org/zh-cn/download](https://nodejs.org/zh-cn/download) 下载最新的 Node.js 安装程序。

#### 2. 运行安装程序

按照安装向导完成 Node.js 的安装。

#### 3. 重启终端

安装完成后，重启你的终端：
- **Windows**: CMD（按 `Win + R`，输入 `cmd`）或 PowerShell
- **macOS/Linux**: 打开新的终端窗口

#### 4. 安装 Nova CLI

```bash
npm install -g @nikolahuang1/nova@latest
```

#### 5. 启动 Nova CLI

```bash
nova
```

## 配置 API Key

Nova CLI 支持多种 AI 模型提供商。你可以通过以下方式配置：

### 配置 Anthropic Claude

```bash
nova auth set anthropic
# 然后输入你的 API Key
```

### 配置 OpenAI

```bash
nova auth set openai
# 然后输入你的 API Key
```

### 配置 Ollama（本地模型）

如果你安装了 Ollama，Nova CLI 会自动检测本地运行的模型，无需额外配置。

```bash
# 查看可用的本地模型
nova ollama list

# 使用特定模型启动
nova -m llama3.2
```

### 配置国内平台

Nova CLI 支持国内主要 AI 平台：

```bash
# 查看支持的平台
nova coding-plan list

# 配置阿里云百炼
nova coding-plan add alibaba --key <api-key>

# 配置智谱 AI
nova coding-plan add zhipu --key <api-key>

# 配置腾讯云
nova coding-plan add tencent --key <api-key>
```

## 使用方式

### 交互式模式

```bash
nova
```

进入交互式命令行界面，与 AI 进行对话。

### 单次提问

```bash
nova -p "解释这段代码的作用"
```

### 指定模型

```bash
nova -m claude-3-5-sonnet
nova -m gpt-4o
nova -m ollama/llama3.2
```

### 继续上次会话

```bash
# 继续最近的会话
nova -c

# 选择历史会话恢复
nova -r
```

## 常用命令

在 Nova CLI 交互界面中：

| 命令 | 说明 |
|------|------|
| `/help` | 显示帮助信息 |
| `/model` | 切换模型 |
| `/mode` | 切换模式（auto/plan/ask） |
| `/skills` | 查看和使用技能 |
| `/history` | 查看会话历史 |
| `/clear` | 清空当前会话 |
| `/quit` | 退出 Nova CLI |

## 技能系统

Nova CLI 内置了多种专业技能：

```bash
# 列出所有技能
nova skills list

# 安装社区技能
nova skills install https://gitee.com/anderson2/superpowers.git

# 使用技能
/skills use code-review
```

## 卸载

```bash
# 卸载 npm 包
npm uninstall -g @nikolahuang1/nova

# (可选) 清理用户配置和缓存
# Windows PowerShell:
Remove-Item -Path "$env:USERPROFILE\.nova" -Recurse -Force
# macOS/Linux:
rm -rf ~/.nova
```

## 故障排除

### 找不到 nova 命令

确保 Node.js 已正确安装，并且 npm 全局目录在你的 PATH 环境变量中。

### 模型连接失败

检查你的 API Key 是否正确配置：

```bash
nova auth status
```

### Ollama 模型不可用

确保 Ollama 服务正在运行：

```bash
ollama serve
```

## 更多信息

- [完整文档](https://github.com/nova-cli/nova-cli#readme)
- [命令参考](./COMMAND_REFERENCE.md)
- [用户指南](./USER_GUIDE.md)

## 反馈问题

如遇问题，请在 [GitHub Issues](https://github.com/nova-cli/nova-cli/issues) 提交反馈。
