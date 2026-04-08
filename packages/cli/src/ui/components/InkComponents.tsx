// ============================================================================
// InkComponents - Premium terminal UI components for Nova CLI
// Inspired by Claude Code and iFlow CLI design patterns
// Enhanced with theme system for better visual aesthetics
// ============================================================================

import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { getTheme, Theme } from '../themes/theme-config.js';
import {
  getBorderCharacters,
  getEnhancedIcon,
  createStatusIndicator,
  getSpinnerFrame,
  createEnhancedProgressBar,
  getSpacing,
} from '../themes/style-utils.js';

// ============================================================================
// Design System - Colors & Styles (Backward Compatible)
// ============================================================================

// Legacy Colors object - kept for backward compatibility
export const Colors = {
  // Brand colors (Purple theme)
  brand: '#7C3AED',
  brandLight: '#A78BFA',
  brandDark: '#5B21B6',
  brandAccent: '#8B5CF6',
  
  // Semantic colors with light variants
  success: '#10B981',
  successLight: '#34D399',
  warning: '#F59E0B',
  warningLight: '#FBBF24',
  error: '#EF4444',
  errorLight: '#F87171',
  info: '#3B82F6',
  infoLight: '#60A5FA',
  
  // Text colors - better contrast
  primary: '#F9FAFB',
  secondary: '#E5E7EB',
  muted: '#9CA3AF',
  dim: '#6B7280',
  hint: '#4B5563',
  
  // Accent colors - expanded palette
  cyan: '#06B6D4',
  cyanLight: '#22D3EE',
  pink: '#EC4899',
  pinkLight: '#F472B6',
  orange: '#F97316',
  orangeLight: '#FB923C',
  lime: '#84CC16',
  limeLight: '#A3E635',
  violet: '#8B5CF6',
  violetLight: '#A78BFA',
  
  // Background - layered depth
  bgPrimary: '#1F2937',
  bgSecondary: '#111827',
  bgTertiary: '#0F172A',
  bgHighlight: '#374151',
  bgDark: '#1F2937',
  bgDarker: '#111827',
  
  // Border - subtle distinction
  border: '#4B5563',
  borderLight: '#6B7280',
  borderDim: '#374151',
};

// ============================================================================
// Spinner Component - Enhanced with theme system
// ============================================================================

interface SpinnerProps {
  message?: string;
  color?: string;
  theme?: Theme;
}

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export const Spinner: React.FC<SpinnerProps> = ({ 
  message = 'Loading...', 
  color,
  theme,
}) => {
  const [frame, setFrame] = useState(0);
  const t = theme || getTheme();
  const spinnerColor = color || t.colors.brand;
  
  useEffect(() => {
    const timer = setInterval(() => {
      setFrame(f => (f + 1) % SPINNER_FRAMES.length);
    }, 80);
    return () => clearInterval(timer);
  }, []);
  
  // Use enhanced spinner with theme system
  const spinnerData = getSpinnerFrame(t, frame);
  
  return (
    <Box>
      <Text color={spinnerColor}>{spinnerData.char}</Text>
      <Text color={t.colors.secondary}> {message}</Text>
    </Box>
  );
};

// ============================================================================
// Status Bar Component - Enhanced with theme system
// ============================================================================

interface StatusBarProps {
  model: string;
  mode: 'auto' | 'plan' | 'ask';
  contextUsage: number;
  sessionId: string;
  mcpConnected?: number;
  mcpTotal?: number;
  theme?: Theme;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  model,
  mode,
  contextUsage,
  sessionId,
  mcpConnected = 0,
  mcpTotal = 0,
  theme,
}) => {
  const t = theme || getTheme();
  
  // Enhanced mode configuration with better visual distinction
  const modeConfig = {
    auto: { color: t.colors.success, icon: '●', label: 'AUTO' },
    plan: { color: t.colors.warning, icon: '◆', label: 'PLAN' },
    ask: { color: t.colors.info, icon: '◉', label: 'ASK' },
  };
  
  // Enhanced context usage color with gradient-like effect
  let contextColor = t.colors.success;
  let contextIcon = '✓';
  if (contextUsage > 80) {
    contextColor = t.colors.error;
    contextIcon = '⚠';
  } else if (contextUsage > 50) {
    contextColor = t.colors.warning;
    contextIcon = '◐';
  }
  
  // Model short name with better visual
  const modelShort = model.split('/').pop() || model;
  
  return (
    <Box 
      borderStyle="round" 
      borderColor={t.colors.border}
      paddingX={1}
      backgroundColor={t.colors.bgSecondary}
    >
      <Box flexGrow={1}>
        {/* Model - enhanced with decorative icon */}
        <Text bold color={t.colors.brand}>{t.styles.icons.tool} </Text>
        <Text bold color={t.colors.primary}>{modelShort}</Text>
        <Text color={t.colors.muted}> {t.styles.decorations.separator} </Text>
        
        {/* Mode - enhanced with dynamic icon */}
        <Text bold color={modeConfig[mode].color}>
          {modeConfig[mode].icon} {modeConfig[mode].label}
        </Text>
        <Text color={t.colors.muted}> {t.styles.decorations.separator} </Text>
        
        {/* Context - enhanced with status icon */}
        <Text color={t.colors.secondary}>ctx: </Text>
        <Text bold color={contextColor}>{contextIcon} {contextUsage}%</Text>
      </Box>
      
      <Box>
        {/* MCP Status - enhanced with visual indicator */}
        {mcpTotal > 0 && (
          <>
            <Text color={t.colors.secondary}>mcp: </Text>
            <Text color={mcpConnected === mcpTotal ? t.colors.success : t.colors.warning}>
              {mcpConnected === mcpTotal ? '✓' : '◐'} {mcpConnected}/{mcpTotal}
            </Text>
            <Text color={t.colors.muted}> {t.styles.decorations.separator} </Text>
          </>
        )}
        
        {/* Session - enhanced with better visual */}
        <Text color={t.colors.secondary}>session: </Text>
        <Text color={t.colors.primary}>{sessionId.slice(0, 8)}</Text>
      </Box>
    </Box>
  );
};

// ============================================================================
// Input Box Component - Enhanced with theme system
// ============================================================================

interface InputBoxProps {
  onSubmit: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  initialValue?: string;
  theme?: Theme;
}

export const InputBox: React.FC<InputBoxProps> = ({
  onSubmit,
  placeholder = 'Type a message...',
  disabled = false,
  initialValue = '',
  theme,
}) => {
  const [value, setValue] = useState(initialValue);
  const [multiline, setMultiline] = useState(false);
  const [lines, setLines] = useState<string[]>([]);
  const t = theme || getTheme();
  
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
  
  // Enhanced prompt with theme system
  const showPrompt = multiline ? `${t.styles.decorations.separator} ` : `${t.styles.decorations.chevron} `;
  const promptColor = multiline ? t.colors.muted : t.colors.brand;
  
  return (
    <Box flexDirection="column" borderStyle="round" borderColor={disabled ? t.colors.borderDim : t.colors.borderLight}>
      {multiline && (
        <Box flexDirection="column" paddingX={getSpacing('md', t)}>
          {lines.map((line, i) => (
            <Text key={i} color={t.colors.dim}>
              {t.styles.decorations.separator} {line}
            </Text>
          ))}
        </Box>
      )}
      <Box>
        <Text bold color={promptColor}>{showPrompt}</Text>
        {disabled ? (
          <Text color={t.colors.dim}>{placeholder}</Text>
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
// Tool Call Panel Component - Enhanced with theme system
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
  theme?: Theme;
}

export const ToolCallPanel: React.FC<ToolCallPanelProps> = ({ tools, theme }) => {
  if (tools.length === 0) return null;
  const t = theme || getTheme();
  
  return (
    <Box flexDirection="column" marginTop={getSpacing('md', t)} borderStyle="round" borderColor={t.colors.borderDim}>
      <Box>
        <Text bold color={t.colors.cyan}>{t.styles.icons.tool} Tool Calls</Text>
        <Text color={t.colors.muted}> ({tools.length})</Text>
      </Box>
      {tools.map(tool => (
        <ToolCallItem key={tool.id} tool={tool} theme={t} />
      ))}
    </Box>
  );
};

// ============================================================================
// Tool Call Item Component - Enhanced with theme system
// ============================================================================

interface ToolCallItemProps {
  tool: ToolCall;
  theme: Theme;
}

const ToolCallItem: React.FC<ToolCallItemProps> = ({ tool, theme }) => {
  const t = theme;
  
  // Enhanced status configuration with theme system
  const statusConfig = {
    pending: { icon: '○', color: t.colors.dim, label: 'PENDING' },
    running: { icon: '◐', color: t.colors.warning, label: 'RUNNING' },
    success: { icon: '●', color: t.colors.success, label: 'SUCCESS' },
    error: { icon: '✗', color: t.colors.error, label: 'ERROR' },
  };
  
  const status = statusConfig[tool.status];
  
  return (
    <Box>
      <Text color={status.color}>{status.icon}</Text>
      <Text color={t.colors.primary}> {tool.name}</Text>
      {tool.duration && (
        <Text color={t.colors.dim}> ({tool.duration}ms)</Text>
      )}
      {tool.status === 'running' && (
        <Spinner message="" color={status.color} theme={t} />
      )}
    </Box>
  );
};

// ============================================================================
// Thinking Block Component - Enhanced with theme system
// ============================================================================

interface ThinkingBlockProps {
  content: string;
  expanded?: boolean;
  theme?: Theme;
}

export const ThinkingBlock: React.FC<ThinkingBlockProps> = ({ 
  content, 
  expanded = false,
  theme,
}) => {
  const [isExpanded, setIsExpanded] = useState(expanded);
  const t = theme || getTheme();
  
  const displayContent = isExpanded 
    ? content 
    : content.slice(0, 100) + (content.length > 100 ? '...' : '');
  
  // Enhanced thinking block with theme system
  const toggleText = isExpanded ? '[-] collapse' : '[+] expand';
  const thinkingIcon = t.styles.icons.thinking;
  
  return (
    <Box 
      flexDirection="column" 
      borderStyle="round" 
      borderColor={t.colors.borderDim}
      marginTop={getSpacing('md', t)}
      backgroundColor={t.colors.bgTertiary}
    >
      <Box>
        <Text color={t.colors.violet}>{thinkingIcon} Thinking</Text>
        <Text color={t.colors.dim}> ({content.length} chars)</Text>
        <Text color={t.colors.muted}>
          {' '}{toggleText}
        </Text>
      </Box>
      <Box marginLeft={getSpacing('md', t)}>
        <Text color={t.colors.dim} wrap="wrap">{displayContent}</Text>
      </Box>
    </Box>
  );
};

// ============================================================================
// Progress Bar Component - Enhanced with theme system
// ============================================================================

interface ProgressBarProps {
  percent: number;
  label?: string;
  width?: number;
  showPercent?: boolean;
  color?: string;
  style?: 'blocks' | 'dashes' | 'dots' | 'braille';
  theme?: Theme;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  percent,
  label,
  width = 30,
  showPercent = true,
  color,
  style = 'blocks',
  theme,
}) => {
  const t = theme || getTheme();
  const progressColor = color || t.colors.brand;
  
  // Use enhanced progress bar with theme system
  const progress = createEnhancedProgressBar(percent, width, style, progressColor);
  
  return (
    <Box>
      {label && <Text color={t.colors.secondary}>{label} </Text>}
      <Text color={progressColor}>{progress.filled}</Text>
      <Text color={t.colors.dim}>{progress.empty}</Text>
      {showPercent && <Text color={t.colors.primary}> {progress.percent}%</Text>}
    </Box>
  );
};

// ============================================================================
// Confirm Dialog Component - Enhanced with theme system
// ============================================================================

interface ConfirmDialogProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
  theme?: Theme;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  message,
  onConfirm,
  onCancel,
  danger = false,
  theme,
}) => {
  const t = theme || getTheme();
  
  useInput((char, key) => {
    if (char === 'y' || char === 'Y') {
      onConfirm();
    } else if (char === 'n' || char === 'N' || key.escape) {
      onCancel();
    }
  });
  
  // Enhanced dialog with theme system
  const dialogColor = danger ? t.colors.error : t.colors.warning;
  const dialogIcon = danger ? t.styles.icons.warning : '❓';
  const dialogTitle = danger ? 'Warning' : 'Confirm';
  
  return (
    <Box 
      flexDirection="column" 
      borderStyle="round" 
      borderColor={dialogColor}
      padding={getSpacing('md', t)}
      backgroundColor={t.colors.bgSecondary}
    >
      <Text bold color={dialogColor}>
        {dialogIcon} {dialogTitle}
      </Text>
      <Text color={t.colors.primary}>{message}</Text>
      <Text color={t.colors.dim}>
        Press <Text color={t.colors.success} bold>Y</Text> to confirm, 
        <Text color={t.colors.error} bold> N</Text> or Escape to cancel
      </Text>
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