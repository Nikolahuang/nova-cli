---
name: test-driven-development
description: 强制执行 RED-GREEN-REFACTOR 循环：写失败的测试、看它失败、写最小代码、看它通过、提交。删除在测试前写的代码。
author: obra/superpowers
version: 1.0.0
tags: [test, tdd, quality]
requiredTools: [read_file, write_file, edit_file, execute_command]
---

# 测试驱动开发 (TDD)

## 概述
严格遵循 RED-GREEN-REFACTOR 循环。在写实现代码之前必须先写测试。

## RED-GREEN-REFACTOR 循环

### 🔴 RED - 写失败的测试

1. **写测试** - 描述期望行为
```typescript
test('should calculate total with tax', () => {
  const result = calculateTotal(100, 0.1);
  expect(result).toBe(110);
});
```

2. **运行测试** - 确认失败
```bash
npm test
# ❌ FAIL: calculateTotal is not defined
```

3. **失败原因** - 理解为什么失败
- 函数不存在？
- 逻辑错误？
- 接口不匹配？

### 🟢 GREEN - 写最小实现

1. **写最小代码** - 只让测试通过
```typescript
export function calculateTotal(amount: number, tax: rate): number {
  return amount * (1 + tax);
}
```

2. **运行测试** - 确认通过
```bash
npm test
# ✓ PASS: should calculate total with tax
```

3. **不要过度设计** - 只满足当前测试

### 🔵 REFACTOR - 改进代码

1. **保持测试通过** - 重构时持续运行测试
2. **消除重复** - DRY 原则
3. **改进命名** - 更清晰的命名
4. **优化结构** - 更好的组织

## TDD 规则

### 必须遵守
1. ✅ 只有测试失败时才写生产代码
2. ✅ 只写刚好让测试通过的最小代码
3. ✅ 每次重构前确保测试通过

### 禁止行为
1. ❌ 先写实现后写测试
2. ❌ 一次写多个测试
3. ❌ 跳过失败的测试

## 测试类型

### 单元测试
- 测试单个函数或类
- 隔离依赖
- 快速执行

### 集成测试
- 测试组件交互
- 使用真实依赖
- 覆盖关键路径

### 端到端测试
- 测试完整流程
- 模拟用户行为
- 覆盖主要场景

## 测试反模式

### 不要这样做
- ❌ 测试实现细节
- ❌ 测试私有方法
- ❌ 过度 mock
- ❌ 测试覆盖率至上

### 应该这样做
- ✅ 测试行为，不测实现
- ✅ 测试公共接口
- ✅ 使用真实依赖
- ✅ 覆盖关键路径

## 示例工作流

```markdown
### 任务: 添加用户验证功能

#### RED
1. 写测试 `user.test.ts`
   - 测试有效邮箱格式
   - 测试无效邮箱格式
2. 运行测试 → 失败 ✓

#### GREEN  
1. 实现 `validateEmail()` 函数
2. 运行测试 → 通过 ✓

#### REFACTOR
1. 提取正则表达式常量
2. 添加类型定义
3. 运行测试 → 通过 ✓

#### COMMIT
git commit -m "feat: add email validation"
```

## 关键原则

- **测试优先** - 永远先写测试
- **小步前进** - 每次只写一个测试
- **快速反馈** - 测试要快
- **简单设计** - 只实现需要的
