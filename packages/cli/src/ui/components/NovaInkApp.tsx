// ============================================================================
// NovaInkApp - Main Ink-based CLI application
// Enhanced with theme system for better visual aesthetics
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { StatusBar, InputBox, MessageList, ToolCallPanel, Spinner, ThinkingBlock } from './InkComponents.js';
import { getTheme, Theme } from '../themes/theme-config.js';

// ============================================================================
// Types
// ============================================================================

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: Date;
}

interface ToolCall {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'success' | 'error';
  duration?: number;
}

interface AppState {
  model: string;
  mode: 'auto' | 'plan' | 'ask';
  contextUsage: number;
  sessionId: string;
  messages: Message[];
  activeTools: ToolCall[];
  processing: boolean;
  thinkingContent: string;
  showThinking: boolean;
}

interface NovaAppProps {
  initialModel?: string;
  initialMode?: 'auto' | 'plan' | 'ask';
  sessionId?: string;
  onSubmit?: (input: string) => Promise<void>;
  onCommand?: (command: string) => Promise<void>;
}

// ============================================================================
// Help Screen Component - Enhanced with theme system
// ============================================================================

const HelpScreen: React.FC<{ onDismiss: () => void }> = ({ onDismiss }) => {
  const t = getTheme();
  
  useInput((char, key) => {
    if (key.escape || char === 'q') {
      onDismiss();
    }
  });
  
  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color={t.colors.brand}>Nova CLI - Help</Text>
      <Text></Text>
      
      <Text bold color={t.colors.primary}>Navigation</Text>
      <Text color={t.colors.dim}>  /help        Show this help</Text>
      <Text color={t.colors.dim}>  /quit        Exit Nova CLI</Text>
      <Text color={t.colors.dim}>  /clear       Clear conversation</Text>
      <Text></Text>
      
      <Text bold color={t.colors.primary}>Model & Mode</Text>
      <Text color={t.colors.dim}>  /model       Switch model (interactive)</Text>
      <Text color={t.colors.dim}>  /mode        Cycle mode: AUTO → SMART → EDITS → PLAN → ASK</Text>
      <Text color={t.colors.dim}>  /status      Show session status</Text>
      <Text></Text>
      
      <Text bold color={t.colors.primary}>Memory & Context</Text>
      <Text color={t.colors.dim}>  /init        Generate NOVA.md</Text>
      <Text color={t.colors.dim}>  /memory      Manage memory</Text>
      <Text color={t.colors.dim}>  /compact     Toggle compact mode</Text>
      <Text></Text>
      
      <Text bold color={t.colors.primary}>Tools & Extensions</Text>
      <Text color={t.colors.dim}>  /tools       List available tools</Text>
      <Text color={t.colors.dim}>  /mcp         MCP server status</Text>
      <Text color={t.colors.dim}>  /skills      Available skills</Text>
      <Text color={t.colors.dim}>  /ollama      Ollama status</Text>
      <Text></Text>
      
      <Text bold color={t.colors.primary}>Shortcuts</Text>
      <Text color={t.colors.dim}>  @file        Inject file content</Text>
      <Text color={t.colors.dim}>  !command     Run shell command</Text>
      <Text color={t.colors.dim}>  \            Multi-line input</Text>
      <Text color={t.colors.dim}>  Tab          Command completion</Text>
      <Text></Text>
      
      <Text color={t.colors.muted}>Press Escape or Q to close</Text>
    </Box>
  );
};

// ============================================================================
// Mode Badge Component
// ============================================================================

const ModeBadge: React.FC<{ mode: 'auto' | 'plan' | 'ask' }> = ({ mode }) => {
  const colors = { auto: 'green', plan: 'yellow', ask: 'cyan' };
  const labels = { auto: 'AUTO', plan: 'PLAN', ask: 'ASK' };
  const descriptions = {
    auto: 'Full autonomous',
    plan: 'Plan first',
    ask: 'Answer only',
  };
  
  return (
    <Box>
      <Text bold color={colors[mode]}>[{labels[mode]}]</Text>
      <Text dimColor> {descriptions[mode]}</Text>
    </Box>
  );
};

// ============================================================================
// Main NovaInkApp Component
// ============================================================================

export const NovaInkApp: React.FC<NovaAppProps> = ({
  initialModel = 'claude-3-sonnet',
  initialMode = 'auto',
  sessionId,
  onSubmit,
  onCommand,
}) => {
  const { exit } = useApp();
  const [showHelp, setShowHelp] = useState(false);
  const [state, setState] = useState<AppState>({
    model: initialModel,
    mode: initialMode,
    contextUsage: 0,
    sessionId: sessionId || 'new',
    messages: [],
    activeTools: [],
    processing: false,
    thinkingContent: '',
    showThinking: true,
  });
  
  // Handle global keyboard shortcuts
  useInput((char, key) => {
    if (showHelp) {
      if (key.escape || char === 'q') {
        setShowHelp(false);
      }
      return;
    }
    
    // Ctrl+C to exit
    if (key.ctrl && char === 'c') {
      exit();
    }
  });
  
  // Handle input submission
  const handleSubmit = useCallback(async (input: string) => {
    if (!input.trim()) return;
    
    // Handle commands
    if (input.startsWith('/')) {
      const command = input.slice(1).toLowerCase();
      
      switch (command) {
        case 'help':
        case 'h':
        case '?':
          setShowHelp(true);
          return;
          
        case 'quit':
        case 'exit':
        case 'q':
          exit();
          return;
          
        case 'clear':
          setState(s => ({ ...s, messages: [], contextUsage: 0 }));
          return;
          
        case 'mode':
          setState(s => ({
            ...s,
            mode: s.mode === 'auto' ? 'plan' : s.mode === 'plan' ? 'ask' : 'auto',
          }));
          return;
          
        case 'thinking':
          setState(s => ({ ...s, showThinking: !s.showThinking }));
          return;
      }
      
      // Forward other commands
      if (onCommand) {
        await onCommand(input);
      }
      return;
    }
    
    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };
    
    setState(s => ({
      ...s,
      messages: [...s.messages, userMessage],
      processing: true,
    }));
    
    // Call submit handler
    if (onSubmit) {
      try {
        await onSubmit(input);
      } finally {
        setState(s => ({ ...s, processing: false }));
      }
    } else {
      // Demo mode - simulate response
      setTimeout(() => {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'I received your message. In demo mode, this is a simulated response.',
          timestamp: new Date(),
        };
        
        setState(s => ({
          ...s,
          messages: [...s.messages, assistantMessage],
          processing: false,
          contextUsage: Math.min(100, s.contextUsage + 5),
        }));
      }, 1000);
    }
  }, [onSubmit, onCommand, exit]);
  
  // Render help screen
  if (showHelp) {
    return <HelpScreen onDismiss={() => setShowHelp(false)} />;
  }
  
  return (
    <Box flexDirection="column" height="100%">
      {/* Status Bar */}
      <StatusBar
        model={state.model}
        mode={state.mode}
        contextUsage={state.contextUsage}
        sessionId={state.sessionId}
      />
      
      {/* Message List */}
      <Box flexGrow={1} flexDirection="column" overflow="hidden" marginY={1}>
        {state.messages.length === 0 ? (
          <Box flexDirection="column" alignItems="center" justifyContent="center" height="100%">
            <Text bold color={getTheme().colors.brand}>Nova CLI</Text>
            <Text color={getTheme().colors.secondary}>AI-powered terminal assistant</Text>
            <Text></Text>
            <Text color={getTheme().colors.muted}>Type a message or /help for commands</Text>
          </Box>
        ) : (
          <MessageList messages={state.messages} />
        )}
        
        {/* Thinking Block */}
        {state.thinkingContent && state.showThinking && (
          <ThinkingBlock content={state.thinkingContent} />
        )}
        
        {/* Tool Calls */}
        {state.activeTools.length > 0 && (
          <ToolCallPanel tools={state.activeTools} />
        )}
      </Box>
      
      {/* Processing Indicator */}
      {state.processing && (
        <Box marginBottom={1}>
          <Spinner message="Thinking..." />
        </Box>
      )}
      
      {/* Input Box */}
      <InputBox
        onSubmit={handleSubmit}
        placeholder={state.processing ? 'Processing...' : 'Type a message or /help'}
        disabled={state.processing}
      />
      
      {/* Footer */}
      <Box justifyContent="space-between" marginTop={1}>
        <ModeBadge mode={state.mode} />
        <Text dimColor>/help for commands | Ctrl+C to exit</Text>
      </Box>
    </Box>
  );
};

// ============================================================================
// Export
// ============================================================================

export default NovaInkApp;
