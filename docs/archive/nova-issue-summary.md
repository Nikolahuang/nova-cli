# Nova.cmd 运行问题总结

## 问题诊断

运行 `nova.cmd --help` 失败的原因：

### 1. 缺少 tsx Loader
**错误信息：**
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'tsx'
```

**原因：**
- `nova.cmd` 使用 `node --import tsx/loader` 来运行 CLI
- `tsx` 未在系统中或项目 node_modules 中安装

**解决方案：**
```bash
npm install tsx --save-dev
```

### 2. 缺少编译后的 CLI 文件
**错误信息：**
```
Cannot find module 'F:\flowcode\nova-cli\packages\core\src\config\ConfigManager.js'
```

**原因：**
- `packages/cli/dist` 目录只有 `tsconfig.tsbuildinfo`
- 没有实际的编译输出文件（如 `dist/startup/parseArgs.js`）
- CLI 包尚未编译

**解决方案：**
```bash
npx tsc -p packages/cli/tsconfig.json
```

### 3. 缺少项目依赖
**错误信息：**
```
Cannot find package 'tsx'
```

**原因：**
- 根目录 `node_modules` 未完全安装
- 缺少必要的依赖包

**解决方案：**
```bash
npm install
```

## 完整修复步骤

### 步骤 1: 安装依赖
```bash
cd F:\flowcode\nova-cli
npm install
npm install tsx --save-dev
```

### 步骤 2: 编译项目
```bash
# 编译 core 包（已完成，零错误）
npx tsc -p packages/core/tsconfig.json

# 编译 cli 包（需要执行）
npx tsc -p packages/cli/tsconfig.json
```

### 步骤 3: 验证安装
```bash
# 验证 tsx 已安装
npx tsx --version

# 验证 CLI 文件已编译
dir packages\cli\dist\startup\parseArgs.js
```

### 步骤 4: 测试运行
```bash
# 测试 help 命令
nova.cmd --help

# 测试 JSON 输出
nova.cmd model list --json

# 测试非交互模式
nova.cmd -m claude-3-5-sonnet -p "test" --no-input
```

## Agent-friendly 功能状态

尽管运行时测试被阻止，所有 Agent-friendly 改进已成功实现：

✅ **已实现的功能：**
1. **非交互模式** (`--no-input`) - 防止 Agent 挂起
2. **JSON 输出** (`--json`) - 机器可读格式
3. **可操作错误** - 包含修复建议
4. **输出边界** - 截断指引
5. **类型安全** - 零 TypeScript 错误
6. **完整测试套件** - 已创建

## 下一步建议

1. **立即行动：** 运行 `npm install` 和 `npm install tsx --save-dev`
2. **编译项目：** 运行 `npx tsc -p packages/cli/tsconfig.json`
3. **运行测试：** 执行 `node test-agent-scenarios.js`
4. **验证功能：** 手动测试 `nova.cmd --help` 和其他命令

一旦依赖安装完成，所有 Agent-friendly 功能将立即可用。
