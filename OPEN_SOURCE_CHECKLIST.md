# 开源准备清单

## ✅ 必需文件

### 核心文档
- [x] README.md - 项目介绍和快速开始
- [x] LICENSE - MIT 许可证
- [x] CONTRIBUTING.md - 贡献指南
- [x] CODE_OF_CONDUCT.md - 行为准则
- [x] SECURITY.md - 安全政策
- [x] SUPPORT.md - 支持信息
- [x] CHANGELOG.md - 更新日志

### 用户文档
- [x] INSTALLATION.md - 安装指南
- [x] USER_GUIDE.md - 用户指南
- [x] COMMAND_REFERENCE.md - 命令参考
- [x] NOVA_CLI_用户命令操作手册.md - 中文用户手册

### GitHub 模板
- [x] .github/ISSUE_TEMPLATE/bug_report.md - Bug 报告模板
- [x] .github/ISSUE_TEMPLATE/feature_request.md - 功能请求模板
- [x] .github/PULL_REQUEST_TEMPLATE.md - PR 模板

## ✅ 核心功能

### 基础功能
- [x] 多提供商 LLM 支持（Anthropic, OpenAI, DeepSeek, GLM, Gemini, Ollama 等）
- [x] 11 个内置工具（文件、搜索、执行、网络、记忆）
- [x] 5 种审批模式（yolo, default, accepting_edits, plan, smart）
- [x] MCP（Model Context Protocol）集成
- [x] 会话管理和持久化
- [x] 上下文压缩
- [x] 记忆发现系统

### 新增功能
- [x] 项目分析系统（`/init` 命令）
- [x] 技能系统（`/skills` 命令集）
- [x] ProjectAnalyzer 核心分析引擎
- [x] 智能体系统提示注入

## ✅ 技术要求

### 代码质量
- [x] TypeScript 类型检查通过
- [x] 编译成功无错误
- [x] 代码结构清晰（core/cli 分离）
- [x] 错误处理完善

### 架构设计
- [x] Monorepo 结构（packages/core, packages/cli）
- [x] 清晰的依赖关系
- [x] 可扩展的插件系统
- [x] 统一的接口设计

### 安全性
- [x] 文件过滤系统
- [x] 凭证加密存储
- [x] 审批机制
- [x] 生命周期钩子

## 📋 发布前检查

### 仓库配置
- [ ] 设置 GitHub 仓库
- [ ] 配置 GitHub Actions CI/CD
- [ ] 设置分支保护规则
- [ ] 配置自动化发布（semantic-release 或类似工具）

### NPM 包
- [ ] 配置 @nova-cli/core 包发布
- [ ] 配置 @nova-cli/cli 包发布
- [ ] 设置 npm 发布脚本
- [ ] 配置 npm 自动发布

### 文档
- [ ] 确保所有文档链接正确
- [ ] 添加示例代码
- [ ] 创建架构图（如需要）
- [ ] 添加视频教程（可选）

### 测试
- [ ] 单元测试覆盖
- [ ] 集成测试
- [ ] E2E 测试
- [ ] 性能测试

### 社区
- [ ] 创建 GitHub Discussions
- [ ] 设置 Discord 社区
- [ ] 创建 Twitter/X 账号
- [ ] 准备发布公告

## 🚀 发布步骤

### 1. 准备工作
```bash
# 确保工作目录干净
git status

# 创建发布分支
git checkout -b release/v0.2.0

# 更新版本号
npm version 0.2.0 --workspaces

# 更新 CHANGELOG.md
# 添加发布说明
```

### 2. 测试
```bash
# 运行所有测试
pnpm test

# 编译项目
pnpm build

# 本地测试
npm link
nova --version
```

### 3. 文档
- [ ] 更新 README.md（添加发布说明）
- [ ] 更新 CHANGELOG.md（完整更新日志）
- [ ] 更新版本号在所有文档中

### 4. 提交和推送
```bash
git add .
git commit -m "chore: release v0.2.0"

git push origin release/v0.2.0

# 创建 Pull Request
# 合并到 main
```

### 5. 发布到 GitHub
- [ ] 创建 GitHub Release
- [ ] 添加发布说明
- [ ] 关联相关 Issue
- [ ] 标记里程碑

### 6. 发布到 NPM
```bash
# 发布 core 包
cd packages/core
npm publish

# 发布 CLI 包
cd ../cli
npm publish
```

### 7. 发布后
- [ ] 在社交媒体上发布公告
- [ ] 更新网站（如有）
- [ ] 通知社区
- [ ] 监控反馈和问题

## 📊 版本信息

**当前版本**: 0.2.0
**主要变更**:
- 新增项目分析系统
- 新增技能系统
- 完善文档
- 修复多个 bug

## 🔗 相关链接

- GitHub 仓库: https://github.com/your-org/nova-cli
- NPM 包: https://www.npmjs.com/package/@nova-cli/cli
- 文档网站: https://nova-cli.dev
- Discord 社区: [链接]
- Twitter/X: [链接]

---

## 备注

- 确保所有敏感信息已移除（API keys, tokens 等）
- 检查所有依赖项的许可证兼容性
- 确认没有包含不必要的文件（node_modules, dist, 等）
- 验证 .gitignore 配置正确