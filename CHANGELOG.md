# 更新日志

所有重要的项目更改都将记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
并且本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [未发布]

### 新增

#### 项目分析系统
- ✨ `/init` 命令 - 快速项目初始化和分析
  - 自动识别项目类型（前端、后端、全栈、CLI 工具等）
  - 技术栈检测（语言、框架、工具、测试框架）
  - 目录结构分析和用途推断
  - 关键文件识别（配置文件、入口文件、文档）
  - 依赖关系分析（生产依赖、开发依赖）
  - 代码统计（文件数、代码行数、语言分布）
  - 架构模式检测（组件化、状态管理等）
  - 重构建议生成
  - 生成 PROJECT_ANALYSIS.md 文档
  - 分析结果自动注入到系统提示

#### 技能系统
- ✨ `/skills` 命令集 - 自定义技能管理
  - `/skills add local <file>` - 添加技能到当前会话
  - `/skills add global <file>` - 添加技能到全局配置
  - `/skills list` - 列出所有可用技能（全局 + 本地）
  - `/skills rm <name>` - 移除技能（优先本地，其次全局）
  - 支持 YAML frontmatter 格式的技能文件
  - 技能自动注入到系统提示
  - 智能体严格按照技能要求进行思考和回答

#### ProjectAnalyzer 类
- ✨ 核心分析引擎
  - 智能项目类型识别
  - 全面的技术栈检测
  - 依赖关系分析
  - 代码度量统计
  - 架构模式识别
  - Markdown 文档生成

#### 文档更新
- 📝 更新用户操作手册 - 添加 `/init` 和 `/skills` 命令说明
- 📝 更新 README.md - 添加项目分析和技能系统介绍
- 📝 创建 SUPPORT.md - 完整的支持文档

### 变更
- 🔧 优化命令补全系统 - 支持新命令的参数补全
- 🔧 改进系统提示构建 - 支持技能和项目分析的注入
- 🔧 增强 AppState 接口 - 添加 activeSkills 和 projectAnalysis 字段

### 修复
- 🐛 修复 readline 与 Ink 渲染系统冲突的问题
- 🐛 修复技能文件交互式输入导致的显示混乱
- 🐛 修复命令行参数解析的问题

## [0.1.0] - 2024-XX-XX

### 新增

#### 核心功能
- ✨ 多提供商 LLM 支持
  - Anthropic (Claude 3.5 Sonnet, Claude 3 Opus, Claude 3 Haiku)
  - OpenAI (GPT-4o, GPT-4o Mini, GPT-4 Turbo)
  - DeepSeek (DeepSeek V3, DeepSeek Coder)
  - 智谱 GLM (GLM-4, GLM-3 Turbo)
  - Google Gemini (Gemini Pro, Gemini Flash)
  - Moonshot、Yi、Groq、Mistral、Together 等
  - Ollama 本地模型支持

- 🔧 工具系统
  - 11 个内置工具：文件读写、搜索、执行、网络、记忆
  - 工具注册中心架构
  - JSON Schema 参数验证
  - 工具审批机制

- 🛡️ 安全架构
  - 5 种审批模式 (yolo, default, accepting_edits, plan, smart)
  - 文件过滤系统
  - 生命周期钩子
  - 凭证加密存储

- 💾 会话管理
  - AgentLoop 执行引擎
  - 会话持久化
  - 上下文压缩
  - 记忆发现系统

- 🎨 终端界面
  - 基于 Ink 的 TUI
  - 流式输出支持
  - Thinking 过程可视化
  - 交互式 REPL

- 📦 配置系统
  - YAML/JSON/环境变量分层配置
  - 全局和项目级配置
  - 动态配置重载

- 🔌 MCP 协议
  - Model Context Protocol 支持
  - 外部 MCP 服务器集成
  - 工具自动发现

#### CLI 命令
- `nova` - 启动交互式会话
- `nova -p <prompt>` - 单次提示模式
- `nova -m <model>` - 指定模型
- `nova -d <dir>` - 设置工作目录
- `nova --approval-mode <mode>` - 设置审批模式
- `nova config show` - 显示配置
- `nova auth set <provider>` - 设置认证
- `nova model list` - 列出模型
- `nova model select <model>` - 选择模型
- `nova provider list` - 列出提供商
- `nova provider add <provider>` - 添加提供商
- `nova ollama list` - 列出 Ollama 模型
- `nova ollama pull <model>` - 拉取 Ollama 模型

#### 交互式命令
- `/help` - 显示帮助
- `/quit` - 退出会话
- `/clear` - 清空对话
- `/model <name>` - 切换模型
- `/approval <mode>` - 更改审批模式
- `/tools` - 列出工具
- `/sessions` - 显示会话统计
- `/compact` - 压缩上下文
- `/reset` - 重置会话

### 架构设计

#### Monorepo 结构
```
nova-cli/
├── packages/
│   ├── core/        # @nova-cli/core - 核心引擎库
│   └── cli/         # @nova-cli/cli - 终端应用
├── extensions/      # 扩展
├── __tests__/      # 测试
└── scripts/        # 脚本
```

#### 核心模块
- `types/` - 品牌类型系统
- `tools/` - 工具注册与实现
- `model/` - 统一模型客户端
- `session/` - 会话管理
- `context/` - 上下文构建
- `security/` - 安全机制
- `mcp/` - MCP 协议
- `config/` - 配置管理
- `auth/` - 认证管理
- `telemetry/` - 使用统计

### 技术栈
- TypeScript 5.4+
- Node.js 18+
- tsx 运行时
- Ink (React for CLI)
- Commander / Yargs
- Anthropic SDK
- OpenAI SDK

### 文档
- README.md - 项目说明
- ROADMAP.md - 功能路线图
- CONTRIBUTING.md - 贡献指南
- LICENSE - MIT 许可证

---

## 版本说明

### 版本号格式
遵循 [语义化版本 2.0.0](https://semver.org/lang/zh-CN/)：

- **主版本号（MAJOR）**：不兼容的 API 更改
- **次版本号（MINOR）**：向后兼容的功能新增
- **修订号（PATCH）**：向后兼容的问题修复

### 更改类型

- `新增 (Added)` - 新功能
- `变更 (Changed)` - 现有功能的更改
- `弃用 (Deprecated)` - 即将移除的功能
- `移除 (Removed)` - 已移除的功能
- `修复 (Fixed)` - Bug 修复
- `安全 (Security)` - 安全相关修复

---

## 路线图

查看 [ROADMAP.md](./ROADMAP.md) 了解未来规划。

### 计划功能

#### Phase 1: 核心能力 (进行中)
- [x] 多 Provider 支持
- [x] Thinking 过程可视化
- [x] 上下文压缩与摘要
- [ ] Git 原生工作流
- [x] MCP 协议集成

#### Phase 2: 用户体验
- [x] 自修复循环
- [x] 多模态输入
- [ ] 多模型路由
- [ ] 代码库映射

#### Phase 3: 企业级
- [ ] 权限管理
- [ ] 沙箱执行
- [ ] 审计日志

#### Phase 4: 前沿探索
- [ ] 语音编程
- [ ] 多代理协作

---

[未发布]: https://github.com/your-org/nova-cli/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/your-org/nova-cli/releases/tag/v0.1.0