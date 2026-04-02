# 贡献指南

感谢您考虑为 Nova CLI 做出贡献！本文档将帮助您了解如何参与项目开发。

## 📋 目录

- [行为准则](#行为准则)
- [如何贡献](#如何贡献)
- [开发环境设置](#开发环境设置)
- [代码规范](#代码规范)
- [提交信息规范](#提交信息规范)
- [Pull Request 流程](#pull-request-流程)
- [问题报告](#问题报告)
- [功能建议](#功能建议)

## 行为准则

### 我们的承诺

为了营造一个开放和友好的环境，我们承诺：

- 使用包容性语言
- 尊重不同的观点和经验
- 优雅地接受建设性批评
- 关注对社区最有利的事情
- 对其他社区成员表示同理心

### 不可接受的行为

- 使用性化的语言或图像
- 侮辱性或贬损性评论
- 公开或私下的骚扰
- 未经明确许可，发布他人的私人信息
- 其他不道德或不专业的行为

## 如何贡献

### 报告 Bug

如果您发现了 bug，请创建 [Issue](https://github.com/your-org/nova-cli/issues/new?template=bug_report.md) 并包含：

1. **Bug 描述** - 清晰简洁地描述问题
2. **复现步骤** - 详细说明如何复现
3. **预期行为** - 您期望发生什么
4. **实际行为** - 实际发生了什么
5. **截图** - 如果适用，添加截图
6. **环境信息**：
   - 操作系统和版本
   - Node.js 版本
   - Nova CLI 版本
   - 使用的模型提供商

### 建议新功能

如果您有新功能建议，请创建 [Feature Request](https://github.com/your-org/nova-cli/issues/new?template=feature_request.md)：

1. **功能描述** - 清晰描述您想要的功能
2. **使用场景** - 为什么需要这个功能
3. **替代方案** - 您考虑过的其他解决方案
4. **额外信息** - 任何其他相关信息

### 提交代码

1. Fork 仓库
2. 创建功能分支（`git checkout -b feature/amazing-feature`）
3. 进行更改
4. 提交更改（`git commit -m 'feat: add amazing feature'`）
5. 推送到分支（`git push origin feature/amazing-feature`）
6. 创建 Pull Request

## 开发环境设置

### 前置要求

- Node.js >= 18.0.0
- pnpm >= 9.0.0（推荐）或 npm
- Git
- 一个 AI 模型 API 密钥（用于测试）

### 安装步骤

```bash
# 1. 克隆仓库
git clone https://github.com/your-org/nova-cli.git
cd nova-cli

# 2. 安装依赖
pnpm install

# 3. 构建项目
pnpm build

# 4. 运行测试
pnpm test

# 5. 设置 API 密钥（用于集成测试）
export ANTHROPIC_API_KEY=your-key-here
# 或
export OPENAI_API_KEY=your-key-here
```

### 项目结构

```
nova-cli/
├── packages/
│   ├── core/           # 核心引擎库
│   │   ├── src/
│   │   │   ├── types/  # 类型定义
│   │   │   ├── tools/  # 工具实现
│   │   │   ├── model/  # 模型客户端
│   │   │   └── ...
│   │   └── package.json
│   └── cli/            # CLI 应用
│       ├── src/
│       ├── bin/       # 入口点
│       └── package.json
├── extensions/         # 扩展
├── __tests__/         # 测试
└── scripts/          # 脚本
```

### 开发工作流

```bash
# 监听模式开发
pnpm dev

# 运行特定测试
pnpm test packages/core/src/tools/

# 类型检查
pnpm typecheck

# 代码检查
pnpm lint

# 代码格式化
pnpm format
```

## 代码规范

### TypeScript 规范

- 使用 TypeScript 编写所有代码
- 启用严格模式（`strict: true`）
- 为所有公共 API 添加类型注释
- 使用品牌类型进行类型安全

```typescript
// ✅ 好的做法
type SessionId = string & { readonly __brand: 'SessionId' };
function createSession(): SessionId { ... }

// ❌ 避免
function createSession(): string { ... }
```

### 代码风格

- 使用 ESLint 和 Prettier
- 遵循项目配置
- 最大行宽：100 字符
- 使用 2 空格缩进

```bash
# 检查代码风格
pnpm lint

# 自动修复
pnpm lint --fix
```

### 文件命名

- 文件名：`kebab-case.ts`
- 类名：`PascalCase`
- 函数名：`camelCase`
- 常量：`UPPER_SNAKE_CASE`
- 接口：`PascalCase`（不带 `I` 前缀）

### 注释规范

```typescript
/**
 * 创建新的会话
 * @param config - 会话配置
 * @returns 会话 ID
 * @throws {NovaError} 如果配置无效
 */
export function createSession(config: SessionConfig): SessionId {
  // 实现...
}
```

## 提交信息规范

我们使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

### 格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

### 类型

| 类型 | 描述 |
|------|------|
| `feat` | 新功能 |
| `fix` | Bug 修复 |
| `docs` | 文档更新 |
| `style` | 代码格式（不影响功能） |
| `refactor` | 重构（不是新功能也不是修复） |
| `perf` | 性能优化 |
| `test` | 添加或修改测试 |
| `chore` | 构建过程或辅助工具的变动 |
| `ci` | CI 配置更改 |

### 范围

- `core` - 核心包
- `cli` - CLI 包
- `tools` - 工具系统
- `model` - 模型客户端
- `config` - 配置系统
- `docs` - 文档

### 示例

```bash
# 新功能
git commit -m "feat(tools): add web scraping tool"

# Bug 修复
git commit -m "fix(model): resolve streaming timeout issue"

# 文档更新
git commit -m "docs: update installation guide"

# 破坏性变更
git commit -m "feat(core): redesign session API

BREAKING CHANGE: The session API has been redesigned.
See migration guide in docs/migration.md."
```

## Pull Request 流程

### 创建 PR 前检查清单

- [ ] 代码通过所有测试
- [ ] 代码通过 lint 检查
- [ ] 代码通过类型检查
- [ ] 更新了相关文档
- [ ] 添加了必要的测试
- [ ] 遵循代码规范
- [ ] 提交信息符合规范

### PR 标题格式

使用与提交信息相同的格式：

```
feat(tools): add web scraping tool
fix(model): resolve streaming timeout issue
docs: update installation guide
```

### PR 描述模板

```markdown
## 更改类型
- [ ] Bug 修复
- [ ] 新功能
- [ ] 重构
- [ ] 文档更新
- [ ] 其他：___

## 描述
清晰描述您的更改...

## 相关 Issue
Fixes #123

## 测试
描述如何测试这些更改...

## 截图
如果适用，添加截图...
```

### 代码审查

所有 PR 都需要至少一位维护者的审查。审查时会关注：

1. **代码质量** - 代码是否清晰、可维护
2. **测试覆盖** - 是否有足够的测试
3. **文档** - 文档是否更新
4. **性能** - 是否有性能问题
5. **安全性** - 是否有安全隐患

### 合并要求

- 所有 CI 检查通过
- 至少一位审查者批准
- 没有 unresolved 的讨论
- 遵循项目规范

## 问题报告

### Bug 报告模板

```markdown
## Bug 描述
[清晰简洁地描述 bug]

## 复现步骤
1. 执行 '...'
2. 点击 '....'
3. 滚动到 '....'
4. 看到错误

## 预期行为
[描述您期望发生什么]

## 实际行为
[描述实际发生了什么]

## 截图
[如果适用，添加截图]

## 环境信息
- 操作系统: [e.g. Windows 11, macOS 14]
- Node.js 版本: [e.g. 20.10.0]
- Nova CLI 版本: [e.g. 0.1.0]
- 模型提供商: [e.g. Anthropic, OpenAI]

## 额外信息
[添加任何其他相关信息]
```

## 功能建议

### 功能请求模板

```markdown
## 功能描述
[清晰描述您想要的功能]

## 使用场景
[描述为什么需要这个功能，它解决什么问题]

## 建议的解决方案
[描述您建议如何实现]

## 替代方案
[描述您考虑过的其他解决方案]

## 额外信息
[添加任何其他相关信息或截图]
```

## 获得帮助

- 💬 [GitHub Discussions](https://github.com/your-org/nova-cli/discussions) - 一般讨论和问题
- 🐛 [GitHub Issues](https://github.com/your-org/nova-cli/issues) - Bug 报告和功能请求
- 📧 邮件: your-email@example.com

## 许可证

通过贡献代码，您同意您的贡献将根据项目的 MIT 许可证进行许可。

---

再次感谢您的贡献！🙏