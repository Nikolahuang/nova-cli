// ============================================================================
// InkComponents - Premium terminal UI components for Nova CLI
// Inspired by Claude Code and iFlow CLI design patterns
// ============================================================================

import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import TextInput from 'ink-text-input';

// ============================================================================
// Design System - Colors & Styles
// ============================================================================

export const Colors = {
  // Brand colors (Purple theme)
  brand: '#7C3AED',
  brandLight: '#A78BFA',
  brandDark: '#5B21B6',
  
  // Semantic colors
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
  
  // Text colors
  primary: '#F9FAFB',
  secondary: '#9CA3AF',
  muted: '#6B7280',
  dim: '#4B5563',
  
  // Accent colors
  cyan: '#06B6D4',
  pink: '#EC4899',
  orange: '#F97316',
  lime: '#84CC16',
  
  // Background
  bgDark: '#1F2937',
  bgDarker: '#111827',
};

// ============================================================================
// Spinner Component
// ============================================================================

interface SpinnerProps {
  message?: string;
  color?: string;
}

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export const Spinner: React.FC<SpinnerProps> = ({ 
  message = 'Loading...', 
  color = Colors.brand 
}) => {
  const [frame, setFrame] = useState(0);
  
  useEffect(() => {
    const timer = setInterval(() => {
      setFrame(f => (f + 1) % SPINNER_FRAMES.length);
    }, 80);
    return () => clearInterval(timer);
  }, []);
  
  return (
    <Box>
      <Text color={color}>{SPINNER_FRAMES[frame]}</Text>
      <Text> {message}</Text>
    </Box>
  );
};

// ============================================================================
// Status Bar Component
// ============================================================================

interface StatusBarProps {
  model: string;
  mode: 'auto' | 'plan' | 'ask';
  contextUsage: number;
  sessionId: string;
  mcpConnected?: number;
  mcpTotal?: number;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  model,
  mode,
  contextUsage,
  sessionId,
  mcpConnected = 0,
  mcpTotal = 0,
}) => {
  const modeColors = { auto: Colors.success, plan: Colors.warning, ask: Colors.info };
  const modeLabels = { auto: 'AUTO', plan: 'PLAN', ask: 'ASK' };
  
  // Context usage color
  let contextColor = Colors.success;
  if (contextUsage > 80) contextColor = Colors.error;
  else if (contextUsage > 50) contextColor = Colors.warning;
  
  // Model short name
  const modelShort = model.split('/').pop() || model;
  
  return (
    <Box 
      borderStyle="round" 
      borderColor={Colors.brand}
      paddingX={1}
    >
      <Box flexGrow={1}>
        {/* Model */}
        <Text bold color={Colors.brand}>◆ </Text>
        <Text bold>{modelShort}</Text>
        <Text dimColor> │ </Text>
        
        {/* Mode */}
        <Text bold color={modeColors[mode]}>● {modeLabels[mode]}</Text>
        <Text dimColor> │ </Text>
        
        {/* Context */}
        <Text>ctx: </Text>
        <Text bold color={contextColor}>{contextUsage}%</Text>
      </Box>
      
      <Box>
        {/* MCP Status */}
        {mcpTotal > 0 && (
          <>
            <Text dimColor>mcp: </Text>
            <Text color={mcpConnected === mcpTotal ? Colors.success : Colors.warning}>
              {mcpConnected}/{mcpTotal}
            </Text>
            <Text dimColor> │ </Text>
          </>
        )}
        
        {/* Session */}
        <Text dimColor>session: </Text>
        <Text>{sessionId.slice(0, 8)}</Text>
      </Box>
    </Box>
  );
};

// ============================================================================
// Input Box Component
// ============================================================================

interface InputBoxProps {
  onSubmit: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  initialValue?: string;
}

export const InputBox: React.FC<InputBoxProps> = ({
  onSubmit,
  placeholder = 'Type a message...',
  disabled = false,
  initialValue = '',
}) => {
  const [value, setValue] = useState(initialValue);
  const [multiline, setMultiline] = useState(false);
  const [lines, setLines] = useState<string[]>([]);
  
  const handleSubmit = (submittedValue: string) => {
    if (disabled) return;
    
    if (submittedValue.endsWith('\\')) {
      // Multi-line mode
      setMultiline(true);
      setLines([...lines, submittedValue.slice(0, -1)]);
      setValue('');
      return;
    }
    
    if (multiline && lines.length > 0) {
      // End multi-line mode
      const fullInput = [...lines, submittedValue].join('\n');
      onSubmit(fullInput);
      setLines([]);
      setMultiline(false);
    } else {
      onSubmit(submittedValue);
    }
    setValue('');
  };
  
  const showPrompt = multiline ? '│ ' : '❯ ';
  
  return (
    <Box flexDirection="column" borderStyle="round" borderColor={disabled ? Colors.dim : Colors.brand}>
      {multiline && (
        <Box flexDirection="column" paddingX={1}>
          {lines.map((line, i) => (
            <Text key={i} dimColor>│ {line}</Text>
          ))}
        </Box>
      )}
      <Box>
        <Text bold color={Colors.brand}>{showPrompt}</Text>
        {disabled ? (
          <Text dimColor>{placeholder}</Text>
        ) : (
          <TextInput
            value={value}
            onChange={setValue}
            onSubmit={handleSubmit}
            placeholder={multiline ? '(empty line to finish)' : placeholder}
            showCursor={true}
          />
        )}
      </Box>
    </Box>
  );
};

// ============================================================================
// Message List Component
// ============================================================================

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: Date;
}

interface MessageListProps {
  messages: Message[];
  maxVisible?: number;
}

export const MessageList: React.FC<MessageListProps> = ({ 
  messages,
  maxVisible = 50,
}) => {
  const visibleMessages = messages.slice(-maxVisible);
  
  return (
    <Box flexDirection="column">
      {visibleMessages.map((msg, index) => (
        <MessageItem 
          key={msg.id} 
          message={msg}
          isLast={index === visibleMessages.length - 1}
        />
      ))}
    </Box>
  );
};

// ============================================================================
// Message Item Component
// ============================================================================

interface MessageItemProps {
  message: Message;
  isLast?: boolean;
}

const MessageItem: React.FC<MessageItemProps> = ({ message, isLast }) => {
  const roleIcons = {
    user: '👤',
    assistant: '◆',
    tool: '⚙',
  };
  
  const roleColors = {
    user: Colors.info,
    assistant: Colors.brand,
    tool: Colors.cyan,
  };
  
  // Truncate long content
  const content = message.content.length > 500 
    ? message.content.slice(0, 500) + '...'
    : message.content;
  
  // Format timestamp
  const time = message.timestamp.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false,
  });
  
  return (
    <Box flexDirection="column" marginBottom={1}>
      {/* Header */}
      <Box>
        <Text bold color={roleColors[message.role]}>
          {roleIcons[message.role]} {message.role === 'user' ? 'You' : 'Nova'}
        </Text>
        <Text dimColor> {time}</Text>
      </Box>
      
      {/* Content */}
      <Box marginLeft={2}>
        <Text wrap="wrap">{content}</Text>
      </Box>
    </Box>
  );
};

// ============================================================================
// Tool Call Panel Component
// ============================================================================

interface ToolCall {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'success' | 'error';
  duration?: number;
  input?: string;
  output?: string;
}

interface ToolCallPanelProps {
  tools: ToolCall[];
}

export const ToolCallPanel: React.FC<ToolCallPanelProps> = ({ tools }) => {
  if (tools.length === 0) return null;
  
  return (
    <Box flexDirection="column" marginTop={1} borderStyle="round" borderColor={Colors.dim}>
      <Box>
        <Text bold color={Colors.cyan}>⚡ Tool Calls</Text>
        <Text dimColor> ({tools.length})</Text>
      </Box>
      {tools.map(tool => (
        <ToolCallItem key={tool.id} tool={tool} />
      ))}
    </Box>
  );
};

// ============================================================================
// Tool Call Item Component
// ============================================================================

interface ToolCallItemProps {
  tool: ToolCall;
}

const ToolCallItem: React.FC<ToolCallItemProps> = ({ tool }) => {
  const statusIcons = {
    pending: '○',
    running: '◐',
    success: '●',
    error: '✗',
  };
  
  const statusColors = {
    pending: Colors.dim,
    running: Colors.warning,
    success: Colors.success,
    error: Colors.error,
  };
  
  return (
    <Box>
      <Text color={statusColors[tool.status]}>{statusIcons[tool.status]}</Text>
      <Text> {tool.name}</Text>
      {tool.duration && (
        <Text dimColor> ({tool.duration}ms)</Text>
      )}
      {tool.status === 'running' && (
        <Spinner message="" color={statusColors[tool.status]} />
      )}
    </Box>
  );
};

// ============================================================================
// Thinking Block Component
// ============================================================================

interface ThinkingBlockProps {
  content: string;
  expanded?: boolean;
}

export const ThinkingBlock: React.FC<ThinkingBlockProps> = ({ 
  content, 
  expanded = false 
}) => {
  const [isExpanded, setIsExpanded] = useState(expanded);
  
  const displayContent = isExpanded 
    ? content 
    : content.slice(0, 100) + (content.length > 100 ? '...' : '');
  
  return (
    <Box 
      flexDirection="column" 
      borderStyle="round" 
      borderColor={Colors.dim}
      marginTop={1}
    >
      <Box>
        <Text dimColor>💭 Thinking</Text>
        <Text dimColor> ({content.length} chars)</Text>
        <Text dimColor>
          {' '}[{isExpanded ? 'collapse' : 'expand'}]
        </Text>
      </Box>
      <Box marginLeft={2}>
        <Text dimColor wrap="wrap">{displayContent}</Text>
      </Box>
    </Box>
  );
};

// ============================================================================
// Progress Bar Component
// ============================================================================

interface ProgressBarProps {
  percent: number;
  label?: string;
  width?: number;
  showPercent?: boolean;
  color?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  percent,
  label,
  width = 30,
  showPercent = true,
  color = Colors.brand,
}) => {
  const filled = Math.round((percent / 100) * width);
  const empty = width - filled;
  
  return (
    <Box>
      {label && <Text>{label} </Text>}
      <Text color={color}>{'█'.repeat(filled)}</Text>
      <Text dimColor>{'░'.repeat(empty)}</Text>
      {showPercent && <Text> {percent}%</Text>}
    </Box>
  );
};

// ============================================================================
// Confirm Dialog Component
// ============================================================================

interface ConfirmDialogProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  message,
  onConfirm,
  onCancel,
  danger = false,
}) => {
  useInput((char, key) => {
    if (char === 'y' || char === 'Y') {
      onConfirm();
    } else if (char === 'n' || char === 'N' || key.escape) {
      onCancel();
    }
  });
  
  return (
    <Box 
      flexDirection="column" 
      borderStyle="round" 
      borderColor={danger ? Colors.error : Colors.warning}
      padding={1}
    >
      <Text bold color={danger ? Colors.error : Colors.warning}>
        {danger ? '⚠️ Warning' : '❓ Confirm'}
      </Text>
      <Text>{message}</Text>
      <Text dimColor>Press Y to confirm, N or Escape to cancel</Text>
    </Box>
  );
};

// ============================================================================
// Select List Component (for model selection, etc.)
// ============================================================================

interface SelectItem {
  label: string;
  value: string;
  description?: string;
}

interface SelectListProps {
  items: SelectItem[];
  onSelect: (item: SelectItem) => void;
  onCancel: () => void;
  title?: string;
}

export const SelectList: React.FC<SelectListProps> = ({
  items,
  onSelect,
  onCancel,
  title = 'Select an option',
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  useInput((char, key) => {
    if (key.upArrow) {
      setSelectedIndex(i => Math.max(0, i - 1));
    } else if (key.downArrow) {
      setSelectedIndex(i => Math.min(items.length - 1, i + 1));
    } else if (key.return) {
      const selectedItem = items[selectedIndex];
      if (selectedItem) {
        onSelect(selectedItem);
      }
    } else if (key.escape) {
      onCancel();
    }
  });
  
  return (
    <Box flexDirection="column" borderStyle="round" borderColor={Colors.brand}>
      <Text bold color={Colors.brand}>{title}</Text>
      <Text dimColor>↑↓ to navigate, Enter to select, Esc to cancel</Text>
      <Text></Text>
      
      {items.map((item, index) => (
        <Box key={item.value}>
          <Text color={index === selectedIndex ? Colors.brand : undefined}>
            {index === selectedIndex ? '❯ ' : '  '}
          </Text>
          <Text bold={index === selectedIndex}>{item.label}</Text>
          {item.description && (
            <Text dimColor> - {item.description}</Text>
          )}
        </Box>
      ))}
    </Box>
  );
};

// ============================================================================
// Toast Notification Component
// ============================================================================

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  onDismiss: () => void;
}

export const Toast: React.FC<ToastProps> = ({
  message,
  type,
  duration = 3000,
  onDismiss,
}) => {
  const icons = {
    success: '✓',
    error: '✗',
    warning: '⚠',
    info: 'ℹ',
  };
  
  const colors = {
    success: Colors.success,
    error: Colors.error,
    warning: Colors.warning,
    info: Colors.info,
  };
  
  useEffect(() => {
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [duration, onDismiss]);
  
  return (
    <Box borderStyle="round" borderColor={colors[type]}>
      <Text color={colors[type]} bold>{icons[type]}</Text>
      <Text> {message}</Text>
    </Box>
  );
};

// ============================================================================
// Export All Components
// ============================================================================

export default {
  Spinner,
  StatusBar,
  InputBox,
  MessageList,
  MessageItem,
  ToolCallPanel,
  ToolCallItem,
  ThinkingBlock,
  ProgressBar,
  ConfirmDialog,
  SelectList,
  Toast,
};