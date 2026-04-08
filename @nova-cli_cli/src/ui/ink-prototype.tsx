// ============================================================================
// Ink Prototype - Component-based UI framework evaluation
// ============================================================================

/**
 * This is a prototype to evaluate Ink as a replacement for readline.
 * To run this prototype:
 * 1. npm install ink react
 * 2. npx tsx ink-prototype.tsx
 */

import React, { useState, useEffect, useCallback } from 'react';
import { render, Box, Text, useInput, useApp, Spacer, Static } from 'ink';

// ============================================================================
// Types
// ============================================================================

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

interface ModelInfo {
  name: string;
  provider: string;
}

// ============================================================================
// StatusBar Component
// ============================================================================

interface StatusBarProps {
  model: ModelInfo;
  mode: string;
  contextPercent: number;
}

const StatusBar: React.FC<StatusBarProps> = ({ model, mode, contextPercent }) => {
  const getModeColor = (mode: string) => {
    switch (mode) {
      case 'AUTO': return 'green';
      case 'PLAN': return 'yellow';
      case 'ASK': return 'blue';
      default: return 'white';
    }
  };

  const getContextColor = (percent: number) => {
    if (percent > 80) return 'red';
    if (percent > 50) return 'yellow';
    return 'green';
  };

  return (
    <Box borderStyle="round" borderColor="magenta" paddingX={1}>
      <Text color="cyan">Model:</Text>
      <Text color="white"> {model.name} </Text>
      <Text color="dim">|</Text>
      <Text color="cyan"> Mode:</Text>
      <Text color={getModeColor(mode)}> {mode} </Text>
      <Text color="dim">|</Text>
      <Text color="cyan"> Context:</Text>
      <Text color={getContextColor(contextPercent)}> {contextPercent}% </Text>
      <Spacer />
    </Box>
  );
};

// ============================================================================
// InputBox Component
// ============================================================================

interface InputBoxProps {
  onSubmit: (input: string) => void;
  placeholder?: string;
}

const InputBox: React.FC<InputBoxProps> = ({ onSubmit, placeholder }) => {
  const [input, setInput] = useState('');

  useInput((input, key) => {
    if (key.return) {
      if (input.trim()) {
        onSubmit(input.trim());
        setInput('');
      }
    } else if (key.backspace || key.delete) {
      setInput(prev => prev.slice(0, -1));
    } else if (input) {
      setInput(prev => prev + input);
    }
  });

  return (
    <Box flexDirection="column">
      <Box borderStyle="single" borderColor="magenta" paddingLeft={1}>
        <Text color="cyan">❯</Text>
        <Text color="white"> {input}</Text>
        <Text color="gray">{placeholder?.slice(input.length) || ''}</Text>
      </Box>
    </Box>
  );
};

// ============================================================================
// MessageList Component
// ============================================================================

interface MessageListProps {
  messages: Message[];
  maxHeight?: number;
}

const MessageList: React.FC<MessageListProps> = ({ messages, maxHeight = 10 }) => {
  const visibleMessages = messages.slice(-maxHeight);

  return (
    <Box flexDirection="column">
      <Static items={visibleMessages}>
        {(message) => {
          const time = new Date(message.timestamp).toLocaleTimeString();
          const getColor = (role: string) => {
            switch (role) {
              case 'user': return 'white';
              case 'assistant': return 'green';
              case 'system': return 'dim';
              default: return 'white';
            }
          };

          return (
            <Box key={message.id} flexDirection="column" marginBottom={1}>
              <Box>
                <Text color="dim">[{time}]</Text>
                <Text color="cyan"> {message.role.toUpperCase()}</Text>
              </Box>
              <Box marginLeft={2}>
                <Text color={getColor(message.role)}>{message.content}</Text>
              </Box>
            </Box>
          );
        }}
      </Static>
    </Box>
  );
};

// ============================================================================
// ProgressBar Component
// ============================================================================

interface ProgressBarProps {
  label: string;
  percent: number;
  color?: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ label, percent, color = 'green' }) => {
  const width = 40;
  const filled = Math.floor((percent / 100) * width);
  const empty = width - filled;

  return (
    <Box flexDirection="column">
      <Text color="cyan">{label}</Text>
      <Box>
        <Text color="magenta">╭</Text>
        <Text color={color}>{'━'.repeat(filled)}</Text>
        <Text color="dim">{'─'.repeat(empty)}</Text>
        <Text color="magenta">╮</Text>
        <Text color="white"> {percent.toFixed(1)}%</Text>
      </Box>
    </Box>
  );
};

// ============================================================================
// Main App Component
// ============================================================================

interface AppProps {
  onExit?: () => void;
}

const App: React.FC<AppProps> = ({ onExit }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'system',
      content: 'Nova CLI with Ink UI Framework',
      timestamp: Date.now(),
    },
    {
      id: '2',
      role: 'assistant',
      content: 'Hello! This is a prototype of Nova CLI using Ink framework.',
      timestamp: Date.now() + 1000,
    },
  ]);
  
  const [model] = useState<ModelInfo>({
    name: 'claude-3-opus',
    provider: 'Anthropic',
  });
  
  const [mode] = useState('AUTO');
  const [contextPercent] = useState(23);
  const [isProcessing, setIsProcessing] = useState(false);

  const { exit } = useApp();

  useInput((input, key) => {
    if (key.escape) {
      exit();
      onExit?.();
    }
  });

  const handleSubmit = useCallback((input: string) => {
    if (isProcessing) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMessage]);

    // Simulate AI processing
    setIsProcessing(true);
    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `I received: "${input}"`,
        timestamp: Date.now() + 1000,
      };
      setMessages(prev => [...prev, assistantMessage]);
      setIsProcessing(false);
    }, 1500);
  }, [isProcessing]);

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box borderStyle="double" borderColor="magenta" paddingX={1} marginBottom={1}>
        <Text bold color="magenta">NOVA CLI</Text>
        <Spacer />
        <Text color="dim">AI-Powered Terminal Assistant</Text>
      </Box>

      {/* Status Bar */}
      <StatusBar model={model} mode={mode} contextPercent={contextPercent} />

      {/* Messages */}
      <Box marginY={1}>
        <MessageList messages={messages} />
      </Box>

      {/* Processing Indicator */}
      {isProcessing && (
        <Box marginBottom={1}>
          <Text color="yellow">⏳ Processing...</Text>
        </Box>
      )}

      {/* Input */}
      <InputBox 
        onSubmit={handleSubmit}
        placeholder="Type your message and press Enter..."
      />

      {/* Footer */}
      <Box marginTop={1}>
        <Text color="dim">Press ESC to exit</Text>
      </Box>
    </Box>
  );
};

// ============================================================================
// Render Function
// ============================================================================

export function renderInkUI(): void {
  render(<App onExit={() => {
    console.log('Goodbye!');
    process.exit(0);
  }} />);
}

// ============================================================================
// Demo - Progress Bar Showcase
// ============================================================================

export function renderProgressDemo(): void {
  const DemoApp: React.FC = () => {
    const [progress, setProgress] = useState(0);

    useEffect(() => {
      const interval = setInterval(() => {
        setProgress(prev => {
          const next = prev + Math.random() * 10;
          return next >= 100 ? 0 : next;
        });
      }, 200);

      return () => clearInterval(interval);
    }, []);

    return (
      <Box flexDirection="column" padding={2}>
        <Box marginBottom={1}>
          <Text bold color="magenta">
            ProgressBar Component Demo
          </Text>
        </Box>
        
        <ProgressBar label="Processing files" percent={progress} color="green" />
        
        <Box marginTop={1}>
          <Text color="cyan">Mode:</Text>
          <Text color="yellow"> AUTO </Text>
          <Text color="dim">|</Text>
          <Text color="cyan"> Model:</Text>
          <Text color="white"> claude-3-opus </Text>
        </Box>
      </Box>
    );
  };

  render(<DemoApp />);
}

// ============================================================================
// Main
// ============================================================================

if (require.main === module) {
  // Run the prototype if executed directly
  renderInkUI();
}
