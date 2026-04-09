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
} from './InkComponents.ts';

export { NovaInkApp } from './NovaInkApp.ts';
export { InkAppRunner, createInkApp } from './InkAppRunner.ts';
export type { InkAppOptions } from './InkAppRunner.ts';

// Legacy components
export { ThinkingBlockRenderer } from './ThinkingBlockRenderer.ts';
export { ProgressBar as ProgressBarLegacy } from './ProgressBar.ts';
export { ConfirmDialog as ConfirmDialogLegacy } from './ConfirmDialog.ts';

// New UX enhancement components
export { TodoProgressPanel, createTodoProgressPanel } from './TodoProgressPanel.ts';
export type { TodoItem, TodoProgressOptions } from './TodoProgressPanel.ts';

export { 
  UserMessageHighlight, 
  createUserMessageHighlight, 
  highlightUserMessage 
} from './UserMessageHighlight.ts';
export type { UserMessageOptions } from './UserMessageHighlight.ts';

export { ThinkingContentDisplay, createThinkingContentDisplay } from './ThinkingContentDisplay.ts';
export type { ThinkingDisplayOptions } from './ThinkingContentDisplay.ts';

export { ToolCallStatusDisplay, createToolCallStatusDisplay } from './ToolCallStatusDisplay.ts';
export type { ToolCallInfo, ToolStatusOptions } from './ToolCallStatusDisplay.ts';

export {
  ActiveCursor,
  createActiveCursor,
  createPurpleCursor,
  createBlueCursor,
  createGreenCursor,
  RainbowCursor,
  createRainbowCursor,
  type CursorOptions,
} from './ActiveCursor.ts';
