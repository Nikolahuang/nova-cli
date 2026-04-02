# Nova CLI 创新路线图 (2026)

基于对 Claude Code、Aider、OpenAI Codex CLI、Cursor CLI、Gemini CLI 等主流工具的深度研究，以下是 Nova CLI 的创新功能规划。

---

## 🎯 第一优先级：核心差异化功能

### 1. 智能上下文管理 (Intelligent Context Management)

**问题**：固定上下文窗口限制、跨会话记忆缺失、长对话信息衰减

**解决方案**：

#### 1.1 自动压缩与摘要
- 当上下文接近限制时，自动生成摘要
- 保留关键决策、架构选择、未解决的 bug
- 实现 Claude Code 风格的 NOTES.md 持久化

```typescript
// 新增: core/src/context/ContextCompressor.ts
interface CompressionResult {
  summary: string;
  keyDecisions: string[];
  pendingTasks: string[];
  importantFiles: string[];
}
```

#### 1.2 结构化笔记系统
- 自动记录构建命令、测试结果、调试记录
- 支持 `NOVA.md` 项目规范文件
- 跨会话记忆持久化

#### 1.3 子代理架构 (Sub-Agent Architecture)
- 主代理协调高级计划
- 子代理处理专注任务（如代码搜索、测试运行）
- 子代理返回摘要，隔离详细上下文

**优先级**: ⭐⭐⭐⭐⭐ (最高)

---

### 2. Git 原生工作流 (Git-Native Workflow)

**灵感来源**: Aider 的自动提交、语义化消息

**功能设计**：

#### 2.1 自动提交与回滚
- 每次 AI 修改后自动创建 commit
- 生成语义化提交消息 (feat/fix/refactor/docs)
- 支持一键回滚到任意 AI 操作点

```bash
nova commit "Add user authentication"
nova rollback --last        # 回滚上一次 AI 操作
nova rollback --to abc123   # 回滚到指定 commit
```

#### 2.2 智能 PR 生成
- 自动生成 PR 描述
- 包含变更摘要、测试建议、审核要点
- 集成 GitHub CLI

#### 2.3 变更可视化
- 实时 diff 预览
- 变更统计 (文件数、行数)
- 风险评估提示

**优先级**: ⭐⭐⭐⭐⭐

---

### 3. MCP 协议集成 (Model Context Protocol)

**问题**：工具集成碎片化，每个数据源需要定制连接器

**解决方案**：实现 Anthropic 开源标准 MCP

#### 3.1 核心架构
```
Nova CLI (MCP Client)
    ├── MCP Server: Filesystem
    ├── MCP Server: GitHub
    ├── MCP Server: Database
    ├── MCP Server: Slack
    └── Custom MCP Servers...
```

#### 3.2 配置文件
```json
// ~/.nova/mcp.json
{
  "mcpServers": {
    "github": {
      "command": "mcp-server-github",
      "args": ["--repo", "owner/repo"]
    },
    "postgres": {
      "command": "mcp-server-postgres",
      "env": { "DATABASE_URL": "postgresql://..." }
    }
  }
}
```

#### 3.3 预构建服务器支持
- Google Drive, Slack, GitHub, Postgres
- Linear, Jira, Notion
- 自定义服务器支持

**优先级**: ⭐⭐⭐⭐⭐

---

## 🚀 第二优先级：用户体验创新

### 4. 多模态输入支持

**功能**：
- 📷 图像输入：UI 截图、设计稿
- 🌐 网页内容：直接引用网页作为上下文
- 📄 文档上传：参考文档解析

**实现**：
```bash
nova --image screenshot.png "修复这个 UI bug"
nova --url https://docs.xxx.com "根据文档实现这个功能"
```

**优先级**: ⭐⭐⭐⭐

---

### 5. 自修复代码循环 (Self-Healing Loop)

**灵感来源**: Aider 的实时 linting 和测试

**功能设计**：

#### 5.1 自动测试运行
- 每次代码修改后自动运行相关测试
- 检测到失败自动尝试修复
- 最大重试次数限制

#### 5.2 Lint 错误自动修复
- 集成 ESLint/Prettier/TypeScript
- 自动修复格式问题
- 代码质量报告

#### 5.3 循环流程
```
生成代码 → 运行测试 → 检测失败 → 分析错误 → 修复代码 → 重新测试
                    ↓
                成功 → 提交变更
```

**优先级**: ⭐⭐⭐⭐

---

### 6. 多模型智能路由

**功能**：根据任务类型自动选择最佳模型

| 任务类型 | 推荐模型 | 原因 |
|---------|---------|------|
| 快速编辑 | Gemini Flash | 速度快、成本低 |
| 复杂推理 | Claude Opus | SWE-bench 72%+ |
| 代码审查 | GPT-5 Codex | 专门优化 |
| 简单问答 | DeepSeek V3 | 性价比高 |
| 本地开发 | Ollama Llama | 隐私优先 |

**实现**：
```typescript
interface TaskRouter {
  analyzeTask(input: string): TaskType;
  selectModel(task: TaskType): ModelId;
  fallbackChain: ModelId[];
}
```

**优先级**: ⭐⭐⭐

---

## 🔧 第三优先级：企业级功能

### 7. 权限管理模式

**灵感来源**: Claude Code 的 5 种企业权限模式

**权限级别**：
1. **yolo** - 全自动执行（开发环境）
2. **default** - 敏感操作需确认（默认）
3. **accepting_edits** - 文件编辑自动接受
4. **plan** - 先制定计划，确认后执行
5. **smart** - AI 判断是否需要确认

**文件级权限**：
```json
// .nova/permissions.json
{
  "read": ["**/*"],
  "write": ["src/**", "!src/secrets/**"],
  "execute": ["npm run *", "git *"],
  "deny": ["rm -rf", "sudo *"]
}
```

**优先级**: ⭐⭐⭐

---

### 8. 沙箱执行环境

**功能**：
- Docker 容器隔离
- 网络访问控制
- 文件系统沙箱
- 资源限制 (CPU/Memory)

**配置**：
```json
{
  "sandbox": {
    "enabled": true,
    "type": "docker",
    "network": "none",
    "memory": "2GB",
    "timeout": 300000
  }
}
```

**优先级**: ⭐⭐⭐

---

### 9. 审计日志

**功能**：
- 记录所有 AI 操作
- 变更历史追踪
- 合规报告生成
- 回滚支持

**日志格式**：
```json
{
  "timestamp": "2026-03-25T14:00:00Z",
  "action": "file_write",
  "file": "src/index.ts",
  "reason": "Add error handling",
  "tokens": { "input": 500, "output": 200 },
  "model": "claude-3.5-sonnet"
}
```

**优先级**: ⭐⭐⭐

---

## 🌟 第四优先级：前沿探索

### 10. 语音编程 (Voice Coding)

**灵感来源**: Aider 的语音输入、Gemini CLI GSoC 2026 计划

**功能**：
- 语音转文字输入
- 自然语言指令
- 解放双手的开发体验

**实现**：
```bash
nova voice start    # 开始语音监听
nova voice stop     # 停止并处理
```

**优先级**: ⭐⭐

---

### 11. 代码库映射 (Codebase Mapping)

**灵感来源**: Aider 的仓库级理解

**功能**：
- 自动生成项目结构图
- 依赖关系可视化
- 智能上下文检索

**输出示例**：
```
src/
├── auth/           # 认证模块
│   ├── login.ts    # 登录逻辑
│   └── session.ts  # 会话管理
├── api/            # API 层
│   └── routes.ts   # 路由定义
└── utils/          # 工具函数
    └── helpers.ts  # 辅助函数

依赖图: auth → api → utils
```

**优先级**: ⭐⭐

---

### 12. 多代理协作 (Multi-Agent Collaboration)

**功能**：
- 并行处理多个任务
- 专业代理分工（测试、文档、审查）
- 结果聚合

**架构**：
```
Main Agent (Coordinator)
    ├── Test Agent: 编写测试
    ├── Doc Agent: 更新文档
    └── Review Agent: 代码审查
```

**优先级**: ⭐⭐

---

## 📊 实施计划

### Phase 1: 核心能力 (Q2 2026)
- [x] 多 Provider 支持 (已完成)
- [x] Thinking 过程可视化 (已完成)
- [ ] 上下文压缩与摘要
- [ ] Git 原生工作流
- [ ] MCP 协议集成

### Phase 2: 用户体验 (Q3 2026)
- [ ] 自修复循环
- [ ] 多模态输入
- [ ] 多模型路由
- [ ] 代码库映射

### Phase 3: 企业级 (Q4 2026)
- [ ] 权限管理
- [ ] 沙箱执行
- [ ] 审计日志

### Phase 4: 前沿探索 (2027)
- [ ] 语音编程
- [ ] 多代理协作

---

## 🎨 技术栈演进

### 当前技术栈
- TypeScript + Node.js
- tsx 运行时
- readline + chalk

### 建议增强
- **Ink** - React for CLI，更好的 TUI
- **Oclif** - 企业级 CLI 框架
- **MCP SDK** - 协议集成
- **Docker SDK** - 沙箱执行

---

## 📚 参考资源

- [Claude Code Docs](https://code.claude.com/docs)
- [Aider GitHub](https://github.com/Aider-AI/aider)
- [MCP Specification](https://modelcontextprotocol.io/)
- [Anthropic Context Engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- [Terminal AI Agents 2025](https://wal.sh/research/2025-terminal-ai-agents.html)
