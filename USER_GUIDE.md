# Nova CLI 用户指南

**版本**: v0.3.0 (Phase 3)
**最后更新**: 2026-03-27

---

## 目录

1. [安装与启动](#安装与启动)
2. [快速开始](#快速开始)
3. [CLI命令详解](#cli命令详解)
4. [Skills系统](#skills系统)
5. [Checkpointing功能](#checkpointing功能)
6. [图片支持](#图片支持)
7. [UI组件](#ui组件)
8. [高级技巧](#高级技巧)
9. [故障排除](#故障排除)
10. [最佳实践](#最佳实践)

---

## 安装与启动

### 系统要求

- **操作系统**: Windows 10/11, macOS 10.15+, Linux (Ubuntu 18.04+)
- **Node.js**: v18.0.0 或更高版本
- **内存**: 至少 2GB RAM
- **存储**: 至少 500MB 可用空间

### 安装步骤

1. **安装 Node.js**
   ```bash
   # 访问 https://nodejs.org/ 下载并安装最新LTS版本
   node --version  # 验证安装
   ```

2. **安装 Nova CLI**
   ```bash
   npm install -g nova-cli
   
   # 或从源码安装
   git clone https://github.com/your-org/nova-cli.git
   cd nova-cli
   npm install
   npm run build
   npm link
   ```

3. **验证安装**
   ```bash
   nova --version
   # 输出: nova-cli v0.3.0
   ```

### 首次启动

```bash
# 启动 Nova CLI
nova

# 你会看到欢迎界面和当前状态
```

---

## 快速开始

### 基本对话

```bash
$ nova

# 直接输入你的问题
> 如何创建一个React组件？

# AI会分析你的问题并提供详细的回答
```

### 使用文件引用

```bash
# 使用 @ 符号引用文件
> 请审查这个文件 @src/App.tsx

# AI会读取文件内容并进行分析
```

### 执行Shell命令

```bash
# 使用 ! 符号执行shell命令
> !npm test

# AI会执行测试并显示结果
```

### 多行输入

```bash
# 使用反斜杠 \ 进行多行输入
> 我需要创建一个函数，它应该：\
  1. 接受一个数组作为参数\
  2. 返回数组中的最大值\
  3. 处理空数组的情况
```

---

## CLI命令详解

### 基础命令

#### `/help` - 显示帮助
```bash
> /help

# 显示所有可用命令及其说明
```

#### `/quit` 或 `/exit` - 退出
```bash
> /quit

# 退出Nova CLI，会话会自动保存
```

#### `/clear` - 清除对话
```bash
> /clear

# 清除当前对话，开始新的会话
```

#### `/status` - 显示状态
```bash
> /status

# 显示当前会话信息：
# - Session ID
# - 当前模式 (AUTO/PLAN/ASK)
# - 回合数
# - Token使用量
# - 消息数量
```

### 模型和模式

#### `/model` - 切换模型
```bash
> /model

# 交互式选择可用模型

> /model claude-3-opus

# 直接切换到指定模型
```

#### `/mode` - 切换模式
```bash
> /mode

# 在三种模式间切换：
# - AUTO: 全自动，无需确认
# - PLAN: 先计划，每个操作需确认
# - ASK:  只回答，不修改文件

> /mode auto
> /mode plan
> /mode ask
```

### 会话管理

#### `/history` - 会话历史
```bash
> /history

# 显示所有历史会话

> /history restore

# 恢复之前的会话
```

#### `/memory` - 持久化记忆
```bash
> /memory

# 显示保存的笔记

> /memory add 这个项目使用TypeScript和React

# 添加新笔记

> /memory clear

# 清除所有笔记
```

### 扩展功能

#### `/skills` - Skills系统
```bash
> /skills

# 列出所有可用skills

> /skills info security-audit

# 查看skill详细信息

> /skills use security-audit

# 在下次对话中使用该skill
```

#### `/theme` - 主题切换
```bash
> /theme

# 显示可用主题

> /theme dark
> /theme light
> /theme neon
> /theme ocean

# 切换到指定主题
```

#### `/checkpoint` - 文件快照 ⭐ NEW

**创建快照**
```bash
> /checkpoint create "before-refactor" "src/**/*.ts"

# 创建名为"before-refactor"的快照
# 包含所有 src/ 目录下的 TypeScript 文件
```

**列出快照**
```bash
> /checkpoint list

# 显示所有快照及其信息
# - ID (前8位)
# - 名称
# - 创建时间
# - 文件数量
```

**恢复快照**
```bash
> /checkpoint restore cp-abc123

# 恢复到指定ID的快照
# 会覆盖当前文件，请谨慎操作
```

**查看差异**
```bash
> /checkpoint diff cp-abc123

# 显示当前文件与快照的差异
# 标记修改、删除、新增的文件
```

**删除快照**
```bash
> /checkpoint delete cp-abc123

# 删除指定快照（不可撤销）
```

**查看统计**
```bash
> /checkpoint stats

# 显示快照统计信息
# - 总快照数
# - 总大小
# - 最旧/最新快照
```

#### `/image` - 添加图片 ⭐ NEW

```bash
> /image ./screenshot.png "第42行的错误信息"

# 添加本地图片到对话
# 可选：添加描述帮助AI理解上下文

> /image https://example.com/diagram.png

# 添加网络图片（功能有限，建议下载后使用本地文件）
```

**支持的格式**:
- PNG (`.png`)
- JPEG (`.jpg`, `.jpeg`)
- GIF (`.gif`)
- WebP (`.webp`)
- SVG (`.svg`)
- BMP (`.bmp`)

#### `/ollama` - Ollama管理

```bash
> /ollama

# 显示Ollama状态

> /ollama list

# 列出已安装的模型

> /ollama pull llama3.2

# 下载新模型
```

---

## Skills系统

### 什么是Skills？

Skills是Nova CLI的专业化模块，让AI在特定领域表现更专业。每个skill都有:
- **专业领域知识** (如代码审查、安全审计)
- **专用工具** (如read_file、search_content)
- **最佳实践** (行业标准和工作流程)

### 可用Skills

#### 1. code-review - 代码审查

**用途**: 自动审查代码质量、安全性和最佳实践

**使用**:
```bash
> /skills use code-review
> 请审查这个文件 @src/utils.ts
```

**会检查**:
- 代码坏味道 (过长函数、大类、重复代码)
- 安全漏洞 (SQL注入、XSS、命令注入)
- 性能问题 (低效算法、资源泄漏)
- 最佳实践 (错误处理、测试覆盖率)

**输出**: 详细的审查报告，包括问题等级、影响和建议

#### 2. test-generator - 测试生成

**用途**: 自动生成单元测试、集成测试和端到端测试

**使用**:
```bash
> /skills use test-generator
> 为这个函数生成测试 @src/calculate.ts
```

**会生成**:
- 正常路径测试
- 边界值测试
- 异常情况测试
- 性能测试

**支持框架**: Jest, Mocha, Vitest, pytest, unittest等

#### 3. doc-writer - 文档生成

**用途**: 自动生成代码文档、API文档和项目文档

**使用**:
```bash
> /skills use doc-writer
> 为这个API生成文档 @src/api/users.ts
```

**会生成**:
- 函数文档 (参数、返回值、异常)
- 类文档 (属性、方法、示例)
- API文档 (端点、请求/响应格式)
- 使用示例和最佳实践

#### 4. bug-fixer - 错误修复

**用途**: 自动诊断和修复代码中的错误

**使用**:
```bash
> /skills use bug-fixer
> 这个错误是什么意思？ TypeError: Cannot read property 'map' of undefined
```

**会**:
- 分析错误信息和堆栈跟踪
- 定位问题代码
- 提供修复方案
- 验证修复效果

#### 5. refactor - 代码重构 ⭐ NEW

**用途**: 智能代码重构，改善代码结构和可维护性

**使用**:
```bash
> /skills use refactor
> 重构这个遗留代码，使用现代模式 @src/legacy.js
```

**会**:
- 识别代码坏味道
- 应用设计模式
- 拆分过长函数/类
- 解耦紧耦合组件
- 提高代码可测试性

**重构技术**:
- Extract Function/Class/Variable
- Move Method
- Dependency Injection
- Strategy/Observer/Repository patterns

#### 6. security-audit - 安全审计 ⭐ NEW

**用途**: 全面的安全审计，识别漏洞和安全风险

**使用**:
```bash
> /skills use security-audit
> 审计这个项目的安全性
```

**会检查**:
- **注入攻击**: SQL注入、XSS、命令注入、路径遍历
- **认证授权**: 密码安全、会话管理、权限控制
- **敏感数据**: API密钥、加密实现、日志安全
- **依赖安全**: 过时依赖、已知漏洞
- **架构安全**: CORS、CSRF、Rate Limiting

**输出**: CVSS评分、风险等级、修复优先级

#### 7. performance - 性能优化 ⭐ NEW

**用途**: 性能分析和优化，识别瓶颈并提供优化方案

**使用**:
```bash
> /skills use performance
> 优化这个慢函数 @src/slow.ts
```

**会分析**:
- **代码级别**: 算法复杂度、循环优化、缓存策略
- **数据库**: 查询优化、索引、连接池
- **前端**: 渲染性能、资源加载、网络请求
- **系统级别**: 并发处理、I/O优化、资源监控

**优化技术**:
- Memoization、动态规划
- 数据库索引、批量操作
- 虚拟滚动、懒加载
- 异步处理、缓存策略

#### 8. git-expert - Git专家 ⭐ NEW

**用途**: Git操作专家，解决复杂的版本控制问题

**使用**:
```bash
> /skills use git-expert
> 如何解决这个合并冲突？
```

**会处理**:
- **复杂问题**: 恢复丢失的提交、重写历史
- **冲突解决**: 复杂的合并冲突
- **工作流优化**: Git Flow、GitHub Flow
- **团队协作**: PR审查、权限管理
- **高级技巧**: Rebase、Bisect、Cherry-pick

**常见场景**:
- 恢复误删的提交
- 处理复杂的合并冲突
- 清理提交历史
- 子模块管理

---

## Checkpointing功能

### 什么是Checkpointing？

Checkpointing是Nova CLI的文件快照系统，让你在危险操作前创建文件备份，随时可以回滚。

### 为什么需要Checkpointing？

**场景1**: 重构大型代码库
```bash
# 创建快照
/checkpoint create "before-refactor" "src/**/*.ts"

# 进行重构...
# 如果出错，轻松恢复
/checkpoint restore cp-abc123
```

**场景2**: 实验性更改
```bash
/checkpoint create "experiment-1" "src/"

# 尝试新想法...
# 不满意？一键回滚
/checkpoint restore cp-abc123
```

**场景3**: 安全网
```bash
# 每天开始工作前
checkpoint create "daily-$(date +%Y%m%d)" "**/*"

# 放心工作，有备份
```

### 最佳实践

1. **命名规范**
   ```bash
   /checkpoint create "feature/add-login" "src/"
   /checkpoint create "bugfix/memory-leak" "src/"
   /checkpoint create "refactor/api-client" "src/api/"
   ```

2. **定期创建**
   - 开始新功能前
   - 复杂重构前
   - 每天开始工作前

3. **清理旧快照**
   ```bash
   /checkpoint stats
   # 查看哪些快照可以删除
   
   /checkpoint delete cp-old123
   # 删除不需要的快照
   ```

---

## 图片支持

### 什么时候使用图片？

**场景1**: 错误截图
```bash
> /image ./error-screenshot.png "登录页面显示500错误"
> 这个错误是什么原因？
```

**场景2**: 架构图
```bash
> /image ./architecture.png "当前系统架构"
> 如何优化这个架构？
```

**场景3**: UI设计
```bash
> /image ./mockup.png "新的用户界面设计"
> 请帮我实现这个界面
```

**场景4**: 数据可视化
```bash
> /image ./performance-chart.png "性能测试结果显示50%下降"
> 如何优化性能？
```

### 最佳实践

1. **添加描述**
   ```bash
   # 好
   /image ./error.png "点击提交按钮后出现错误"
   
   # 不好
   /image ./error.png
   ```

2. **裁剪图片**
   - 只包含相关部分
   - 减少文件大小
   - 提高AI理解速度

3. **使用合适的格式**
   - 截图: PNG
   - 照片: JPEG
   - 图表: PNG或SVG
   - 动画: GIF

4. **注意文件大小**
   - 建议 < 2MB
   - 大图片可能超出API限制

---

## UI组件

### ProgressBar - 进度条

**用途**: 显示长时间操作的进度

**使用场景**:
```typescript
import { ProgressBar } from './ui/components/ProgressBar';

const bar = new ProgressBar({
  label: 'Processing files',
  total: files.length,
  color: '#10B981'
});

for (const file of files) {
  await processFile(file);
  bar.increment();
}

bar.complete();
```

**特性**:
- 实时进度更新
- ETA计算
- 自定义颜色和标签
- 防闪烁渲染

### ConfirmDialog - 确认对话框

**用途**: 在危险操作前获取用户确认

**使用场景**:
```typescript
import { ConfirmDialog } from './ui/components/ConfirmDialog';

const dialog = new ConfirmDialog();

// 普通确认
const confirmed = await dialog.show({
  message: 'Do you want to continue?',
  default: true
});

// 危险操作确认
const deleteConfirmed = await dialog.danger(
  'Delete all files in dist/ folder?'
);

if (deleteConfirmed) {
  // 执行删除
}
```

**特性**:
- 三种模式: normal, warning, danger
- 自定义按钮标签
- 默认值支持
- 输入验证

### ThinkingBlockRenderer - 思考块渲染

**用途**: 显示AI的思考过程

**特性**:
- 可折叠/展开
- 流式更新
- 自定义图标
- 显示耗时

---

## 高级技巧

### 1. 组合使用Skills

```bash
# 先审查代码
> /skills use code-review
> 审查这个文件 @src/auth.ts

# 然后修复发现的问题
> /skills use bug-fixer
> 修复审查中发现的SQL注入问题

# 最后生成测试
> /skills use test-generator
> 为修复后的代码生成安全测试
```

### 2. 复杂工作流

```bash
# 1. 创建快照
> /checkpoint create "feature/auth" "src/"

# 2. 添加相关文件
> 我需要实现用户认证 @src/auth.ts @src/user.ts

# 3. 使用多个skills
> /skills use security-audit
> 审计认证实现的安全性

# 4. 添加参考图片
> /image ./auth-flow.png "认证流程图"

# 5. 生成文档
> /skills use doc-writer
> 为认证模块生成文档

# 6. 创建最终快照
> /checkpoint create "feature/auth-complete" "src/"
```

### 3. 调试复杂问题

```bash
# 1. 截图错误
> /image ./error.png "控制台错误信息"

# 2. 添加相关代码
> 这个错误相关的代码 @src/api.ts @src/utils.ts

# 3. 使用bug-fixer skill
> /skills use bug-fixer
> 分析这个错误并提供修复方案

# 4. 测试修复
> !npm test

# 5. 如果失败，恢复快照重试
> /checkpoint restore cp-before-fix
```

### 4. 性能优化工作流

```bash
# 1. 创建性能基线快照
> /checkpoint create "performance-baseline" "src/"

# 2. 识别性能瓶颈
> /skills use performance
> 分析这个慢函数 @src/slow.ts

# 3. 实施优化
> 根据分析结果优化代码

# 4. 验证优化效果
> !npm run benchmark

# 5. 对比结果
> /skills use performance
> 比较优化前后的性能数据
```

---

## 故障排除

### 问题1: 无法启动Nova CLI

**症状**: `command not found: nova`

**解决方案**:
```bash
# 检查Node.js是否安装
node --version

# 如果使用npm全局安装，检查npm bin路径
npm config get prefix

# 确保路径在PATH中
export PATH="$PATH:/usr/local/bin"

# 或直接使用完整路径
./path/to/nova
```

### 问题2: API密钥错误

**症状**: `Error: No API key found for "anthropic"`

**解决方案**:
```bash
# 设置API密钥
export ANTHROPIC_API_KEY="your-api-key-here"

# 或使用nova auth命令
nova auth set anthropic --key your-api-key-here

# 验证设置
nova auth status
```

### 问题3: 图片无法加载

**症状**: `File not found: ./image.png`

**解决方案**:
```bash
# 检查文件是否存在
ls -la ./image.png

# 使用绝对路径
/image /full/path/to/image.png

# 检查文件权限
chmod 644 ./image.png

# 确保是支持的格式
file ./image.png  # 应该是 PNG image data
```

### 问题4: Checkpoint恢复失败

**症状**: `Failed to restore checkpoint: cp-abc123`

**解决方案**:
```bash
# 检查checkpoint是否存在
/checkpoint list

# 验证checkpoint ID
/checkpoint diff cp-abc123

# 检查文件权限
ls -la .nova/checkpoints/

# 手动恢复（如果自动恢复失败）
cp -r .nova/checkpoints/cp-abc123/* ./
```

### 问题5: Skill无法加载

**症状**: `Skill "security-audit" not found`

**解决方案**:
```bash
# 检查skills目录
ls -la ~/.nova/skills/

# 验证skill文件存在
ls -la ~/.nova/skills/security-audit/SKILL.md

# 检查文件权限
chmod 644 ~/.nova/skills/security-audit/SKILL.md

# 重新加载skills
/skills list
```

### 问题6: 终端显示异常

**症状**: 乱码、颜色不正确、布局错乱

**解决方案**:
```bash
# 检查终端支持
echo $TERM  # 应该是 xterm-256color 或类似

# 尝试基本模式
export NO_COLOR=1

# 切换主题
/theme light

# 更新终端
# Windows: 使用Windows Terminal
# macOS: 使用iTerm2或内置Terminal
# Linux: 使用GNOME Terminal或Konsole
```

### 问题7: 内存不足

**症状**: `JavaScript heap out of memory`

**解决方案**:
```bash
# 增加Node.js内存限制
export NODE_OPTIONS="--max-old-space-size=4096"

# 或减少上下文大小
# 在配置文件中设置 maxTokens: 4000

# 定期清理会话
/checkpoint stats
# 删除旧的checkpoint
```

---

## 最佳实践

### 1. 安全第一

```bash
# 任何危险操作前创建快照
/checkpoint create "before-dangerous-change" "**/*"

# 使用ConfirmDialog确认危险操作
# 系统会自动提示确认
```

### 2. 小步前进

```bash
# 频繁创建快照
/checkpoint create "step-1-setup"
# 工作...
/checkpoint create "step-2-implementation"
# 工作...
/checkpoint create "step-3-testing"
```

### 3. 善用Skills

```bash
# 不要问通用问题
❌ "这个代码怎么样？"

# 使用专业skill
✅ /skills use code-review
✅ "审查这个代码的安全性"
```

### 4. 提供上下文

```bash
# 不要只问问题
❌ "为什么这个报错？"

# 提供完整信息
✅ /image ./error.png "点击登录后出现这个错误"
✅ @src/login.ts "相关的登录代码"
✅ "Node.js v18, Express 4.18"
```

### 5. 验证结果

```bash
# AI建议修改后
> !npm test  # 运行测试

# 或使用skill验证
> /skills use test-generator
> "为刚才的修改生成测试"
```

### 6. 保持组织

```bash
# 使用描述性的checkpoint名称
/checkpoint create "2024-03-27-add-user-auth"

# 定期清理
/checkpoint stats
/checkpoint delete cp-old-unused
```

### 7. 学习和改进

```bash
# 查看历史
/history

# 分析使用模式
# 哪些skills最有用？
# 哪些命令最常用？

# 创建自定义workflow
# 记录有效的命令序列
```

---

## 快捷键和技巧

### 终端快捷键

- **Tab**: 自动补全命令和文件路径
- **Ctrl+C**: 取消当前操作
- **Ctrl+D**: 退出（等同于/quit）
- **↑/↓**: 浏览命令历史
- **Esc**: 清除当前输入

### Nova CLI技巧

- **多行输入**: 使用 `\` 继续下一行
- **文件引用**: 使用 `@path/to/file` 引用文件
- **Shell命令**: 使用 `!command` 执行shell命令
- **快速退出**: 按 `Ctrl+D` 或输入 `/quit`

### 提高生产力的技巧

1. **别名和函数**
   ```bash
   # 在~/.bashrc或~/.zshrc中添加
   alias n='nova'
   alias nc='nova -c'  # 继续上次会话
   ```

2. **常用命令模板**
   ```bash
   # 创建文件模板
   function nova-review() {
     echo "/skills use code-review" | nova
     echo "审查这个文件 @$1" | nova
   }
   ```

3. **集成到编辑器**
   ```vim
   " Vim配置
   :command Nova !nova
   :nnoremap <leader>n :!nova<CR>
   ```

---

## 获取更多帮助

### 文档资源

- **本指南**: 完整的用户手册
- **命令参考**: `COMMAND_REFERENCE.md` - 所有命令的快速参考
- **API文档**: 开发相关文档

### 社区支持

- **GitHub Issues**: 报告bug或请求功能
- **Discussions**: 提问和交流
- **Discord/Slack**: 实时聊天支持

### 示例和模板

查看 `examples/` 目录:
- 常见工作流示例
- Skill使用模板
- 配置文件示例

---

## 版本历史

### v0.3.0 (当前) - Phase 3
- ✅ 8个专业skills
- ✅ Checkpointing系统
- ✅ 图片支持 (/image)
- ✅ UI组件 (ProgressBar, ConfirmDialog)
- ✅ Sub-agent支持 (task工具)

### v0.2.0 - Phase 2
- ✅ 4个基础skills
- ✅ /theme命令
- ✅ Tab补全
- ✅ Todo工具

### v0.1.0 - Phase 1
- ✅ 基础CLI框架
- ✅ Session管理
- ✅ 工具系统
- ✅ MCP集成

---

**感谢您使用 Nova CLI！**

如有问题或建议，请访问我们的GitHub仓库或加入社区讨论。

**Happy Coding!** 🚀
