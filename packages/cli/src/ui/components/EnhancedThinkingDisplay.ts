// ============================================================================
// Enhanced Thinking Display - Modern thinking/reasoning visualization
// Inspired by Claude Code's elegant thinking block presentation
// ============================================================================

import chalk from 'chalk';
import { createEnhancedBorder } from '../themes/claude-code-enhancements.ts';

// ============================================================================
// Types
// ============================================================================

export interface ThinkingSession {
  id: string;
  content: string;
  startTime: number;
  endTime?: number;
  isComplete: boolean;
  complexity: 'simple' | 'moderate' | 'complex';
  reasoningSteps?: ReasoningStep[];
}

export interface ReasoningStep {
  id: string;
  type: 'analysis' | 'planning' | 'execution' | 'verification';
  content: string;
  timestamp: number;
}

export interface EnhancedThinkingOptions {
  showComplexity?: boolean;
  showTimeline?: boolean;
  maxPreviewLines?: number;
  expandOnComplete?: boolean;
  theme?: any;
  compact?: boolean;
}

// ============================================================================
// Enhanced Thinking Renderer
// ============================================================================

export class EnhancedThinkingDisplay {
  private options: Required<EnhancedThinkingOptions>;
  private sessions: Map<string, ThinkingSession> = new Map();

  constructor(options: EnhancedThinkingOptions = {}) {
    this.options = {
      showComplexity: options.showComplexity ?? true,
      showTimeline: options.showTimeline ?? false,
      maxPreviewLines: options.maxPreviewLines ?? 5,
      expandOnComplete: options.expandOnComplete ?? false,
      theme: options.theme,
      compact: options.compact ?? false,
    };
  }

  // ========================================================================
  // Public API
  // ========================================================================

  /**
   * Start a new thinking session
   */
  startSession(sessionId: string, complexity: 'simple' | 'moderate' | 'complex' = 'simple'): void {
    const session: ThinkingSession = {
      id: sessionId,
      content: '',
      startTime: Date.now(),
      isComplete: false,
      complexity,
    };

    this.sessions.set(sessionId, session);

    if (this.options.compact) {
      this.renderCompactStart(session);
    } else {
      this.renderFullStart(session);
    }
  }

  /**
   * Append content to thinking session
   */
  appendContent(sessionId: string, delta: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.content += delta;

    // Update complexity based on content length and structure
    this.updateComplexity(session);

    if (!this.options.compact && session.content.length < 200) {
      this.renderStreamingUpdate(session);
    }
  }

  /**
   * Mark thinking session as complete
   */
  completeSession(sessionId: string, reasoningSteps?: ReasoningStep[]): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.isComplete = true;
    session.endTime = Date.now();
    session.reasoningSteps = reasoningSteps || [];

    this.renderCompletion(session);
    this.sessions.delete(sessionId);
  }

  /**
   * Cancel thinking session
   */
  cancelSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.isComplete = true;
    session.endTime = Date.now();

    console.log('');
    console.log(chalk.gray.dim('💭 Thinking session cancelled'));
    console.log('');

    this.sessions.delete(sessionId);
  }

  /**
   * Get current active sessions
   */
  getActiveSessions(): ThinkingSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Clear all sessions
   */
  clearAll(): void {
    this.sessions.clear();
    console.log('');
    console.log(chalk.gray.dim('🧠 All thinking sessions cleared'));
    console.log('');
  }

  // ========================================================================
  // Private Rendering Methods
  // ========================================================================

  /**
   * Render compact thinking start
   */
  private renderCompactStart(session: ThinkingSession): void {
    const elapsed = this.formatElapsed(session.startTime);
    const complexityIcon = this.getComplexityIcon(session.complexity);

    process.stdout.write(
      chalk.gray.dim('  ') +
      chalk.hex('#7C3AED').bold('💭') +
      chalk.gray.dim(' ') +
      chalk.gray.dim.italic('thinking') +
      chalk.gray.dim(` ${complexityIcon} `) +
      chalk.gray.dim(`(${elapsed})...`) +
      '\r'
    );
  }

  /**
   * Render full thinking start
   */
  private renderFullStart(session: ThinkingSession): void {
    const theme = this.options.theme || { colors: { brand: '#7C3AED', info: '#3B82F6' } };

    console.log('');
    console.log(chalk.hex(theme.colors.brand).bold('🧠 Thinking Process Started'));

    if (this.options.showComplexity) {
      const complexityText = this.getComplexityDescription(session.complexity);
      console.log(chalk.hex(theme.colors.info).dim(`Complexity: ${complexityText}`));
    }

    console.log(chalk.gray.dim('─'.repeat(40)));
  }

  /**
   * Render streaming update for short thinking sessions
   */
  private renderStreamingUpdate(session: ThinkingSession): void {
    const lines = session.content.split('\n');
    const previewLines = lines.slice(-3); // Show last 3 lines

    console.log('');
    console.log(chalk.gray.dim('  ' + previewLines.join('\n')));
    console.log(chalk.gray.dim('  [continuing...]'));
    console.log(chalk.gray.dim('─'.repeat(40)));
  }

  /**
   * Render thinking completion
   */
  private renderCompletion(session: ThinkingSession): void {
    const theme = this.options.theme || { colors: { success: '#10B981', dim: '#6B7280' } };

    console.log('');
    console.log(chalk.hex(theme.colors.success).bold('✅ Thinking Complete'));

    // Duration
    if (session.endTime) {
      const duration = session.endTime - session.startTime;
      const durationStr = duration < 1000 ? `${duration}ms` : `${(duration / 1000).toFixed(1)}s`;
      console.log(chalk.gray.dim(`⏱ Duration: ${durationStr}`));
    }

    // Content summary
    if (session.content.trim()) {
      const content = session.content.trim();
      const charCount = content.length;
      const lineCount = content.split('\n').length;

      console.log(chalk.gray.dim(`📝 Content: ${charCount} characters, ${lineCount} lines`));

      if (this.options.expandOnComplete || content.length < 500) {
        this.renderExpandedContent(content);
      } else {
        this.renderCollapsedSummary(content);
      }
    }

    // Reasoning steps
    if (session.reasoningSteps && session.reasoningSteps.length > 0) {
      console.log('');
      console.log(chalk.hex(theme.colors.brand).bold('Reasoning Steps:'));
      session.reasoningSteps.forEach((step, index) => {
        console.log(chalk.gray.dim(`  ${index + 1}. ${step.type}: ${step.content.slice(0, 80)}${step.content.length > 80 ? '...' : ''}`));
      });
    }

    console.log('');
  }

  /**
   * Render expanded thinking content
   */
  private renderExpandedContent(content: string): void {
    const theme = this.options.theme || { colors: { border: '#4B5563', dim: '#6B7280' } };

    const border = createEnhancedBorder(80, 'modern', theme);
    const lines = content.split('\n').slice(0, this.options.maxPreviewLines!);

    console.log(border.top);
    console.log(
      border.sides +
      chalk.hex(theme.colors.dim).bold(' Thinking Content:') +
      ' '.repeat(Math.max(0, 74)) +
      border.sides
    );
    console.log(border.sides + chalk.gray.dim('  ') + border.sides);

    lines.forEach(line => {
      const truncated = line.slice(0, 74);
      console.log(border.sides + chalk.gray.dim('  ') + truncated + ' '.repeat(Math.max(0, 74 - truncated.length)) + border.sides);
    });

    if (content.split('\n').length > this.options.maxPreviewLines!) {
      console.log(border.sides + chalk.gray.dim('  ... and more content') + ' '.repeat(Math.max(0, 74)) + border.sides);
    }

    console.log(border.bottom);
  }

  /**
   * Render collapsed thinking summary
   */
  private renderCollapsedSummary(content: string): void {
    const words = content.trim().split(/\s+/);
    const wordCount = words.length;
    const previewWords = words.slice(0, 20).join(' ');

    console.log(chalk.gray.dim(`  Summary: ${previewWords}${wordCount > 20 ? '...' : ''}`));
    console.log(chalk.gray.dim(`  (${wordCount} total words)`));
  }

  // ========================================================================
  // Helper Methods
  // ========================================================================

  /**
   * Update session complexity based on content analysis
   */
  private updateComplexity(session: ThinkingSession): void {
    const content = session.content.toLowerCase();

    // Simple heuristics for complexity detection
    const complexityIndicators = {
      complex: [
        /analyze|evaluate|consider|examine|investigate/i,
        /multiple|several|various|different|alternative/i,
        /trade.*off|balance|prioritize|optimize/i,
        /algorithm|approach|strategy|methodology/i,
      ],
      moderate: [
        /plan|organize|structure|outline/i,
        /compare|contrast|difference|summarize/i,
        /implement|execute|perform|process/i,
      ],
      simple: [
        /think|consider|note|remember/i,
        /simple|straightforward|basic|direct/i,
      ],
    };

    let score = 0;
    Object.values(complexityIndicators).forEach(indicators =>
      indicators.forEach(pattern => {
        if (pattern.test(content)) score++;
      })
    );

    if (score >= 3) {
      session.complexity = 'complex';
    } else if (score >= 1) {
      session.complexity = 'moderate';
    }
  }

  /**
   * Get complexity icon
   */
  private getComplexityIcon(complexity: string): string {
    switch (complexity) {
      case 'simple': return '○';
      case 'moderate': return '◐';
      case 'complex': return '◑';
      default: return '○';
    }
  }

  /**
   * Get complexity description
   */
  private getComplexityDescription(complexity: string): string {
    switch (complexity) {
      case 'simple':
        return chalk.green.bold('Simple');
      case 'moderate':
        return chalk.yellow.bold('Moderate');
      case 'complex':
        return chalk.red.bold('Complex');
      default:
        return 'Unknown';
    }
  }

  /**
   * Format elapsed time
   */
  private formatElapsed(startTime: number): string {
    const elapsed = Date.now() - startTime;
    if (elapsed < 1000) return `${elapsed}ms`;
    if (elapsed < 60000) return `${(elapsed / 1000).toFixed(1)}s`;
    return `${Math.floor(elapsed / 60000)}m ${Math.floor((elapsed % 60000) / 1000)}s`;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createEnhancedThinkingDisplay(options?: EnhancedThinkingOptions): EnhancedThinkingDisplay {
  return new EnhancedThinkingDisplay(options);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a thinking progress indicator
 */
export function createThinkingProgress(
  progress: number, // 0-100
  options: {
    width?: number;
    showPercent?: boolean;
    animated?: boolean;
  } = {}
): string {
  const opts = {
    width: 20,
    showPercent: true,
    animated: false,
    ...options,
  };

  const filledWidth = Math.round((progress / 100) * opts.width!);
  const emptyWidth = opts.width! - filledWidth;

  const filled = '█'.repeat(filledWidth);
  const empty = '░'.repeat(emptyWidth);

  const progressBar = filled + empty;
  const percentText = opts.showPercent ? ` ${progress}%` : '';

  return chalk.yellow(progressBar) + percentText;
}

/**
 * Format reasoning step for display
 */
export function formatReasoningStep(step: ReasoningStep): string {
  const icons = {
    analysis: '🔍',
    planning: '📋',
    execution: '⚡',
    verification: '✓',
  };

  const colors = {
    analysis: 'blue',
    planning: 'cyan',
    execution: 'yellow',
    verification: 'green',
  };

  const icon = icons[step.type] || '•';
  const color = colors[step.type] || 'gray';

  return chalk[color].bold(`${icon} ${step.type}`) + ': ' + step.content;
}