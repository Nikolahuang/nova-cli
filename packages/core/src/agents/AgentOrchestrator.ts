// ============================================================================
// AgentOrchestrator - Multi-agent coordination system
// ============================================================================

import { createLogger } from '../utils/Logger.js';
import { generateId } from '../utils/helpers.js';
import type { Message, SessionId } from '../types/session.js';
import type { ToolDefinition } from '../types/tools.js';

const logger = createLogger('AgentOrchestrator');

// ============================================================================
// Types
// ============================================================================

/**
 * Agent role definitions
 */
export type AgentRole = 'coordinator' | 'coder' | 'tester' | 'reviewer' | 'architect' | 'doc-writer';

/**
 * Sub-agent configuration
 */
export interface SubAgentConfig {
  id: string;
  role: AgentRole;
  name: string;
  description: string;
  systemPrompt: string;
  tools: string[];  // Tool names this agent can use
  contextBudget: number;  // Max tokens for context
  modelPreferences?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  };
}

/**
 * Task to be delegated to an agent
 */
export interface AgentTask {
  id: string;
  description: string;
  type: 'code' | 'test' | 'review' | 'design' | 'doc' | 'analysis';
  priority: 'low' | 'medium' | 'high';
  dependencies: string[];  // Task IDs that must complete first
  input: {
    files?: string[];
    context?: string;
    requirements?: string[];
  };
  assignedAgent?: AgentRole;
}

/**
 * Result from an agent execution
 */
export interface AgentResult {
  taskId: string;
  agentId: string;
  status: 'success' | 'partial' | 'failed';
  output: {
    summary: string;
    details?: string;
    artifacts?: Array<{
      type: 'file' | 'code' | 'test' | 'doc';
      path?: string;
      content?: string;
    }>;
    recommendations?: string[];
  };
  metrics: {
    tokensUsed: number;
    duration: number;
    toolCalls: number;
  };
  error?: string;
}

/**
 * Orchestrator state
 */
export interface OrchestratorState {
  sessionId: SessionId;
  tasks: Map<string, AgentTask>;
  results: Map<string, AgentResult>;
  activeAgents: Set<string>;
  completedTasks: Set<string>;
}

// ============================================================================
// Agent Definitions
// ============================================================================

/**
 * Built-in agent configurations
 */
const BUILTIN_AGENTS: Record<AgentRole, SubAgentConfig> = {
  coordinator: {
    id: 'coordinator',
    role: 'coordinator',
    name: 'Coordinator Agent',
    description: 'Orchestrates tasks and coordinates other agents',
    systemPrompt: `You are the Coordinator Agent. Your role is to:
- Analyze complex tasks and break them into subtasks
- Assign subtasks to appropriate specialized agents
- Monitor progress and handle dependencies
- Aggregate results and provide unified responses

Always think step-by-step and maintain clear communication with other agents.`,
    tools: ['read_file', 'list_directory', 'search_content'],
    contextBudget: 8000,
  },
  
  coder: {
    id: 'coder',
    role: 'coder',
    name: 'Coder Agent',
    description: 'Writes and modifies code',
    systemPrompt: `You are the Coder Agent. Your role is to:
- Write clean, efficient, and well-documented code
- Follow project coding conventions
- Implement features and fix bugs
- Ensure code is testable and maintainable

Always consider edge cases and error handling. Write code incrementally and verify changes.`,
    tools: ['read_file', 'write_file', 'edit_file', 'search_content', 'execute_command'],
    contextBudget: 16000,
    modelPreferences: { temperature: 0.2 },
  },
  
  tester: {
    id: 'tester',
    role: 'tester',
    name: 'Tester Agent',
    description: 'Writes and runs tests, analyzes failures',
    systemPrompt: `You are the Tester Agent. Your role is to:
- Write comprehensive unit and integration tests
- Run tests and analyze failures
- Identify edge cases and boundary conditions
- Suggest improvements to test coverage

Focus on meaningful tests that verify behavior, not just coverage numbers.`,
    tools: ['read_file', 'write_file', 'edit_file', 'execute_command', 'search_content'],
    contextBudget: 12000,
  },
  
  reviewer: {
    id: 'reviewer',
    role: 'reviewer',
    name: 'Code Reviewer Agent',
    description: 'Reviews code for quality, security, and best practices',
    systemPrompt: `You are the Code Reviewer Agent. Your role is to:
- Review code for correctness and quality
- Identify potential bugs and security issues
- Check adherence to coding standards
- Suggest improvements and optimizations

Be thorough but constructive. Focus on actionable feedback.`,
    tools: ['read_file', 'search_content', 'list_directory'],
    contextBudget: 12000,
  },
  
  architect: {
    id: 'architect',
    role: 'architect',
    name: 'Architect Agent',
    description: 'Designs system architecture and makes high-level decisions',
    systemPrompt: `You are the Architect Agent. Your role is to:
- Design system architecture and component interactions
- Make technology and design decisions
- Identify potential scalability and maintainability issues
- Create technical documentation and diagrams

Think at a high level while remaining practical.`,
    tools: ['read_file', 'list_directory', 'search_content', 'write_file'],
    contextBudget: 16000,
  },
  
  'doc-writer': {
    id: 'doc-writer',
    role: 'doc-writer',
    name: 'Documentation Agent',
    description: 'Writes and updates documentation',
    systemPrompt: `You are the Documentation Agent. Your role is to:
- Write clear and comprehensive documentation
- Update existing documentation to reflect changes
- Create API documentation and usage examples
- Maintain consistency in documentation style

Focus on clarity and completeness. Include examples where helpful.`,
    tools: ['read_file', 'write_file', 'edit_file', 'search_content'],
    contextBudget: 8000,
  },
};

// ============================================================================
// AgentOrchestrator
// ============================================================================

/**
 * Multi-agent orchestrator for complex task coordination
 */
export class AgentOrchestrator {
  private agents: Map<AgentRole, SubAgentConfig> = new Map();
  private state: OrchestratorState;
  private callbacks: {
    onTaskStart?: (task: AgentTask, agent: SubAgentConfig) => void;
    onTaskComplete?: (result: AgentResult) => void;
    onProgress?: (message: string) => void;
  } = {};
  
  constructor(sessionId: SessionId) {
    // Register built-in agents
    for (const [role, config] of Object.entries(BUILTIN_AGENTS)) {
      this.agents.set(role as AgentRole, config);
    }
    
    // Initialize state
    this.state = {
      sessionId,
      tasks: new Map(),
      results: new Map(),
      activeAgents: new Set(),
      completedTasks: new Set(),
    };
  }
  
  // -----------------------------------------------------------------------
  // Configuration
  // -----------------------------------------------------------------------
  
  /**
   * Register a custom agent
   */
  registerAgent(config: SubAgentConfig): void {
    this.agents.set(config.role, config);
    logger.info(`Registered agent: ${config.name} (${config.role})`);
  }
  
  /**
   * Set callbacks for monitoring
   */
  setCallbacks(callbacks: typeof this.callbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }
  
  // -----------------------------------------------------------------------
  // Task Management
  // -----------------------------------------------------------------------
  
  /**
   * Create a new task
   */
  createTask(
    description: string,
    type: AgentTask['type'],
    options: Partial<Omit<AgentTask, 'id' | 'description' | 'type'>> = {}
  ): AgentTask {
    const task: AgentTask = {
      id: generateId(),
      description,
      type,
      priority: options.priority ?? 'medium',
      dependencies: options.dependencies ?? [],
      input: options.input ?? {},
      assignedAgent: options.assignedAgent,
    };
    
    this.state.tasks.set(task.id, task);
    logger.debug(`Created task: ${task.id}`, { type, description });
    
    return task;
  }
  
  /**
   * Get tasks ready to execute (dependencies satisfied)
   */
  getReadyTasks(): AgentTask[] {
    const ready: AgentTask[] = [];
    
    for (const [id, task] of this.state.tasks) {
      // Skip completed tasks
      if (this.state.completedTasks.has(id)) continue;
      
      // Check dependencies
      const depsMet = task.dependencies.every(depId => 
        this.state.completedTasks.has(depId)
      );
      
      if (depsMet) {
        ready.push(task);
      }
    }
    
    return ready;
  }
  
  /**
   * Select best agent for a task
   */
  selectAgent(task: AgentTask): SubAgentConfig | null {
    // If agent is explicitly assigned, use it
    if (task.assignedAgent && this.agents.has(task.assignedAgent)) {
      return this.agents.get(task.assignedAgent)!;
    }
    
    // Auto-select based on task type
    const roleMap: Record<AgentTask['type'], AgentRole> = {
      code: 'coder',
      test: 'tester',
      review: 'reviewer',
      design: 'architect',
      doc: 'doc-writer',
      analysis: 'coordinator',
    };
    
    const role = roleMap[task.type];
    return this.agents.get(role) ?? null;
  }
  
  // -----------------------------------------------------------------------
  // Execution
  // -----------------------------------------------------------------------
  
  /**
   * Execute a single task
   */
  async executeTask(
    task: AgentTask,
    executeFn: (agent: SubAgentConfig, task: AgentTask) => Promise<AgentResult>
  ): Promise<AgentResult> {
    const agent = this.selectAgent(task);
    
    if (!agent) {
      return {
        taskId: task.id,
        agentId: 'none',
        status: 'failed',
        output: { summary: 'No suitable agent found for task' },
        metrics: { tokensUsed: 0, duration: 0, toolCalls: 0 },
        error: 'No suitable agent found',
      };
    }
    
    this.state.activeAgents.add(agent.id);
    this.callbacks.onTaskStart?.(task, agent);
    
    const startTime = Date.now();
    
    try {
      const result = await executeFn(agent, task);
      result.metrics.duration = Date.now() - startTime;
      
      this.state.results.set(task.id, result);
      this.state.completedTasks.add(task.id);
      
      this.callbacks.onTaskComplete?.(result);
      
      return result;
    } catch (error) {
      const result: AgentResult = {
        taskId: task.id,
        agentId: agent.id,
        status: 'failed',
        output: { summary: 'Execution failed' },
        metrics: {
          tokensUsed: 0,
          duration: Date.now() - startTime,
          toolCalls: 0,
        },
        error: error instanceof Error ? error.message : String(error),
      };
      
      this.state.results.set(task.id, result);
      this.callbacks.onTaskComplete?.(result);
      
      return result;
    } finally {
      this.state.activeAgents.delete(agent.id);
    }
  }
  
  /**
   * Execute all pending tasks
   */
  async executeAll(
    executeFn: (agent: SubAgentConfig, task: AgentTask) => Promise<AgentResult>,
    options: { parallel?: boolean; maxConcurrent?: number } = {}
  ): Promise<AgentResult[]> {
    const { parallel = false, maxConcurrent = 3 } = options;
    const results: AgentResult[] = [];
    
    while (true) {
      const readyTasks = this.getReadyTasks();
      
      if (readyTasks.length === 0) {
        // Check if there are pending tasks with unmet dependencies
        const pending = Array.from(this.state.tasks.values())
          .filter(t => !this.state.completedTasks.has(t.id));
        
        if (pending.length > 0) {
          logger.warn('Deadlock detected: tasks with unmet dependencies', { 
            pending: pending.map(t => t.id) 
          });
          break;
        }
        
        // All tasks completed
        break;
      }
      
      if (parallel) {
        // Execute up to maxConcurrent tasks in parallel
        const batch = readyTasks.slice(0, maxConcurrent);
        const batchResults = await Promise.all(
          batch.map(task => this.executeTask(task, executeFn))
        );
        results.push(...batchResults);
      } else {
        // Execute sequentially
        for (const task of readyTasks) {
          const result = await this.executeTask(task, executeFn);
          results.push(result);
        }
      }
    }
    
    return results;
  }
  
  // -----------------------------------------------------------------------
  // State Management
  // -----------------------------------------------------------------------
  
  /**
   * Get orchestrator state
   */
  getState(): OrchestratorState {
    return {
      ...this.state,
      tasks: new Map(this.state.tasks),
      results: new Map(this.state.results),
      activeAgents: new Set(this.state.activeAgents),
      completedTasks: new Set(this.state.completedTasks),
    };
  }
  
  /**
   * Get result for a task
   */
  getResult(taskId: string): AgentResult | undefined {
    return this.state.results.get(taskId);
  }
  
  /**
   * Get all results
   */
  getAllResults(): AgentResult[] {
    return Array.from(this.state.results.values());
  }
  
  /**
   * Get execution summary
   */
  getSummary(): {
    totalTasks: number;
    completed: number;
    failed: number;
    totalTokens: number;
    totalDuration: number;
  } {
    const results = Array.from(this.state.results.values());
    
    return {
      totalTasks: this.state.tasks.size,
      completed: results.filter(r => r.status !== 'failed').length,
      failed: results.filter(r => r.status === 'failed').length,
      totalTokens: results.reduce((sum, r) => sum + r.metrics.tokensUsed, 0),
      totalDuration: results.reduce((sum, r) => sum + r.metrics.duration, 0),
    };
  }
  
  /**
   * Reset orchestrator state
   */
  reset(): void {
    this.state = {
      sessionId: this.state.sessionId,
      tasks: new Map(),
      results: new Map(),
      activeAgents: new Set(),
      completedTasks: new Set(),
    };
  }
}

// ============================================================================
// Factory function
// ============================================================================

/**
 * Create an agent orchestrator
 */
export function createAgentOrchestrator(sessionId: SessionId): AgentOrchestrator {
  return new AgentOrchestrator(sessionId);
}

/**
 * Get built-in agent configurations
 */
export function getBuiltinAgents(): Record<AgentRole, SubAgentConfig> {
  return { ...BUILTIN_AGENTS };
}
