// ============================================================================
// Test script for UI components visualization
// ============================================================================

import { TodoProgressPanel, type TodoItem } from './packages/cli/src/ui/components/TodoProgressPanel.js';
import { UserMessageHighlight } from './packages/cli/src/ui/components/UserMessageHighlight.js';

console.log('\n');
console.log('═'.repeat(60));
console.log('  UI Components Visual Test');
console.log('═'.repeat(60));
console.log('\n');

// ============================================================================
// Test 1: UserMessageHighlight
// ============================================================================
console.log('─'.repeat(60));
console.log('  TEST 1: UserMessageHighlight Component');
console.log('─'.repeat(60));
console.log('\n');

const userHighlight = new UserMessageHighlight({
  highlightColor: 'purple',
  showTimestamp: true,
});

// Test full render
userHighlight.render('请帮我创建一个新的 React 组件，包含状态管理和样式。');

console.log('\n');

// Test compact render
userHighlight.renderCompact('这是一个简短的用户消息测试。');

// ============================================================================
// Test 2: TodoProgressPanel
// ============================================================================
console.log('\n');
console.log('─'.repeat(60));
console.log('  TEST 2: TodoProgressPanel Component');
console.log('─'.repeat(60));
console.log('\n');

const todoPanel = new TodoProgressPanel({
  showPriority: true,
  compact: true,
});

const sampleTodos: TodoItem[] = [
  { id: '1', task: '分析当前 UI 组件结构和消息显示逻辑', status: 'completed', priority: 'high' },
  { id: '2', task: '创建固定位置 TODO 进度表组件', status: 'completed', priority: 'high' },
  { id: '3', task: '创建用户消息高亮方框组件', status: 'completed', priority: 'high' },
  { id: '4', task: '集成到 InteractiveRepl 主界面', status: 'in_progress', priority: 'medium' },
  { id: '5', task: '验证并测试前端显示效果', status: 'pending', priority: 'medium' },
];

todoPanel.setTodos(sampleTodos);
todoPanel.show();

// ============================================================================
// Test 3: Different highlight colors
// ============================================================================
console.log('\n');
console.log('─'.repeat(60));
console.log('  TEST 3: Different Highlight Colors');
console.log('─'.repeat(60));
console.log('\n');

const colors: ('blue' | 'purple' | 'cyan' | 'green')[] = ['blue', 'purple', 'cyan', 'green'];

for (const color of colors) {
  const highlight = new UserMessageHighlight({ highlightColor: color });
  highlight.renderCompact(`This message uses ${color} highlight style.`);
}

// ============================================================================
// Summary
// ============================================================================
console.log('\n');
console.log('═'.repeat(60));
console.log('  ✓ All UI component tests completed');
console.log('═'.repeat(60));
console.log('\n');
