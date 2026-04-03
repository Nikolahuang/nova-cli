# 发布指南

本指南详细说明了如何将 Nova CLI 发布到 NPM。

## 前置条件

- Node.js >= 18.0.0
- npm 账户（如果还没有，请在 https://www.npmjs.com 注册）
- GitHub 账户（用于源码托管）
- 项目所有文件已提交到 Git

## 发布步骤

### 1. 准备工作

#### 1.1 更新版本号

```bash
# 更新根目录版本号
npm version 0.2.0

# 更新工作区版本号
cd packages/core
npm version 0.3.0

cd ../cli
npm version 0.3.0

# 更新 publish 目录版本号
cd ../../publish
npm version 0.3.0
```

#### 1.2 更新 CHANGELOG.md

在 `CHANGELOG.md` 中添加新的版本部分：

```markdown
## [0.3.0] - 2024-XX-XX

### 新增
- 新功能 1
- 新功能 2

### 变更
- 变更 1

### 修复
- 修复 1
```

#### 1.3 更新文档

确保以下文档是最新的：
- README.md
- INSTALLATION.md
- USER_GUIDE.md
- CHANGELOG.md

### 2. 构建项目

```bash
# 确保在项目根目录
cd /path/to/nova-cli

# 安装依赖
pnpm install

# 构建所有包
pnpm build
```

### 3. 本地测试

#### 3.1 测试 CLI

```bash
# 链接到本地 npm
npm link

# 测试命令
nova --version
nova help

# 测试核心功能
nova -p "你好"

# 取消链接
npm unlink -g nova
```

#### 3.2 测试 Core 包

```bash
cd packages/core
npm link

# 在其他项目中测试
# npm link @nova-cli/core
```

### 4. 发布准备

#### 4.1 检查 .npmignore

确保 `publish/.npmignore` 配置正确，不会包含不必要的文件。

#### 4.2 检查 package.json

确保以下字段正确：

```json
{
  "name": "@nova-cli/cli",
  "version": "0.3.0",
  "description": "Nova CLI - AI-powered terminal assistant",
  "author": "Nova CLI Team",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/your-org/nova-cli.git"
  },
  "homepage": "https://github.com/your-org/nova-cli#readme",
  "bugs": {
    "url": "https://github.com/your-org/nova-cli/issues"
  }
}
```

#### 4.3 检查发布内容

```bash
cd publish

# 查看将要发布的内容
npm pack --dry-run

# 如果一切正常，创建 tarball
npm pack
```

### 5. 发布到 NPM

#### 5.1 登录 NPM

```bash
npm login
# 输入用户名、密码和邮箱
```

#### 5.2 发布包

```bash
cd publish

# 发布到 NPM（正式发布）
npm publish

# 或者先发布到测试环境
npm publish --tag beta
```

#### 5.3 验证发布

```bash
# 查看已发布的包
npm view @nova-cli/cli

# 在新目录测试安装
cd /tmp
npm install -g nova-ai-terminal@latest
nova --version
```

### 6. Git 操作

#### 6.1 创建标签

```bash
git tag -a v0.3.0 -m "Release v0.3.0"
git push origin v0.3.0
```

#### 6.2 创建 GitHub Release

1. 访问 GitHub 仓库
2. 点击 "Releases"
3. 点击 "Draft a new release"
4. 选择标签 `v0.3.0`
5. 添加发布说明（使用 CHANGELOG.md 中的内容）
6. 点击 "Publish release"

## 自动化发布（可选）

### 使用 semantic-release

可以配置 `semantic-release` 实现自动化发布：

#### 1. 安装依赖

```bash
npm install -D semantic-release @semantic-release/git @semantic-release/changelog
```

#### 2. 配置 `.releaserc.json`

```json
{
  "branches": ["main"],
  "plugins": [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    "@semantic-release/changelog",
    "@semantic-release/npm",
    "@semantic-release/git",
    "@semantic-release/github"
  ]
}
```

#### 3. 配置 GitHub Actions

创建 `.github/workflows/release.yml`:

```yaml
name: Release

on:
  push:
    branches:
      - main

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm ci
      - run: npm test
      - run: npx semantic-release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

#### 4. 配置 NPM Token

在 GitHub 仓库设置中添加 `NPM_TOKEN` secret：
1. 在 NPM 上创建 access token
2. 在 GitHub 仓库 Settings > Secrets and variables > Actions 中添加

## 注意事项

### 包名选择

- `nova-cli` - 可能已被占用
- `@nova-cli/cli` - 推荐，使用作用域
- `nova-terminal-assistant` - 当前使用的名称

### 版本号规范

遵循 [语义化版本](https://semver.org/):
- `MAJOR.MINOR.PATCH`
- MAJOR：不兼容的 API 变更
- MINOR：向后兼容的功能新增
- PATCH：向后兼容的问题修复

### 依赖管理

- 确保所有依赖都是最新的
- 避免使用过于具体的版本号
- 定期更新依赖

### 安全性

- 使用 `npm audit` 检查安全漏洞
- 及时更新有漏洞的依赖
- 在 CI/CD 中运行安全检查

## 回滚发布

如果发现问题需要回滚：

```bash
# 取消发布（如果还在 24 小时内）
npm unpublish @nova-cli/cli@0.3.0

# 或发布新版本修复问题
npm version 0.3.1
npm publish
```

## 参考资源

- [npm 发布文档](https://docs.npmjs.com/cli/v8/commands/npm-publish)
- [语义化版本](https://semver.org/)
- [semantic-release](https://github.com/semantic-release/semantic-release)

---

如有问题，请参考 [SUPPORT.md](./SUPPORT.md) 或提交 Issue。