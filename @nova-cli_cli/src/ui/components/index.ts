// ============================================================================
// UI Components Export
// ============================================================================

// Ink-based components
export { 
  Spinner,
  StatusBar,
  InputBox,
  MessageList,
  ToolCallPanel,
  ThinkingBlock,
  ProgressBar,
  ConfirmDialog,
  SelectList,
  Toast,
  Colors,
} from './InkComponents.js';

export { NovaInkApp } from './NovaInkApp.js';
export { InkAppRunner, createInkApp } from './InkAppRunner.js';
export type { InkAppOptions } from './InkAppRunner.js';

// Legacy components
export { ThinkingBlockRenderer } from './ThinkingBlockRenderer.js';
export { ProgressBar as ProgressBarLegacy } from './ProgressBar.js';
export { ConfirmDialog as ConfirmDialogLegacy } from './ConfirmDialog.js';

// New UX enhancement components
export { TodoProgressPanel, createTodoProgressPanel } from './TodoProgressPanel.js';
export type { TodoItem, TodoProgressOptions } from './TodoProgressPanel.js';

export { 
  UserMessageHighlight, 
  createUserMessageHighlight, 
  highlightUserMessage 
} from './UserMessageHighlight.js';
export type { UserMessageOptions } from './UserMessageHighlight.js';

export { ThinkingContentDisplay, createThinkingContentDisplay } from './ThinkingContentDisplay.js';
export type { ThinkingDisplayOptions } from './ThinkingContentDisplay.js';

export { ToolCallStatusDisplay, createToolCallStatusDisplay } from './ToolCallStatusDisplay.js';
export type { ToolCallInfo, ToolStatusOptions } from './ToolCallStatusDisplay.js';

export {
  ActiveCursor,
  createActiveCursor,
  createPurpleCursor,
  createBlueCursor,
  createGreenCursor,
  RainbowCursor,
  createRainbowCursor,
  type CursorOptions,
} from './ActiveCursor.js';
