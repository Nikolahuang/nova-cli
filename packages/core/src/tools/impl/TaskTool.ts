// ============================================================================
// Task Tool - Launch sub-agents for parallel task execution
// ============================================================================

import type { ToolHandler, ToolHandlerInput, ToolHandlerOutput } from '../../types/tools.js';
import { ToolError } from '../../types/errors.js';
import { AgentLoop } from '../../session/AgentLoop.js';
import { SessionManager } from '../../session/SessionManager.js';
import { ToolRegistry } from '../../tools/ToolRegistry.js';
import { ModelClient } from '../../model/ModelClient.js';
import { buildSystemPrompt } from '../../context/defaultSystemPrompt.js';
import type { ContextCompressor } from '../../context/ContextCompressor.js';

interface TaskInput {
  description: string;
  prompt: string;
  subagentType: 'code-explorer' | 'research' | 'executor';
  maxTurns?: number;
  mode?: 'acceptEdits' | 'bypassPermissions' | 'default' | 'plan';
  name?: string;
  teamName?: string;
}

/**
 * Task handler - launches a sub-agent to perform a specific task
 * 
 * This enables parallel task execution and specialized agent behaviors:
 * - code-explorer: Analyzes codebases and provides insights
 * - research: Gathers information from web and documentation
 * - executor: Performs actions and executes commands
 */
export const taskHandler: ToolHandler = async (input: ToolHandlerInput): Promise<ToolHandlerOutput> => {
  // Validate required fields
  const { description, prompt, subagentType, maxTurns = 10, mode = 'default', name } = input.params as Record<string, unknown>;
  
  if (typeof description !== 'string' || typeof prompt !== 'string' || typeof subagentType !== 'string') {
    throw new ToolError('Task requires description, prompt, and subagentType parameters to be strings', 'task');
  }
  
  if (!description || !prompt || !subagentType) {
    throw new ToolError('Task requires description, prompt, and subagentType parameters', 'task');
  }
  
  const params: TaskInput = {
    description,
    prompt,
    subagentType: subagentType as TaskInput['subagentType'],
    maxTurns: typeof maxTurns === 'number' ? maxTurns : 10,
    mode: typeof mode === 'string' ? mode as TaskInput['mode'] : 'default',
    name: typeof name === 'string' ? name : undefined,
  };

  const sessionManager = input.context.sessionManager as SessionManager;
  const toolRegistry = input.context.toolRegistry as ToolRegistry;
  const modelClient = input.context.modelClient as ModelClient;
  const contextCompressor = input.context.contextCompressor as ContextCompressor;

  if (!sessionManager || !toolRegistry || !modelClient) {
    throw new ToolError('Task tool requires sessionManager, toolRegistry, and modelClient in context', 'task');
  }

  // Create a new session for the sub-agent
  const subSession = sessionManager.create({
    workingDirectory: input.context.workingDirectory,
    model: modelClient.getModel(),
    streaming: false,
    parentSessionId: input.context.sessionId,
  });

  // Configure approval mode based on task mode
  let approvalMode = input.context.approvalMode || 'plan';
  if (mode === 'acceptEdits') {
    approvalMode = 'plan';
  } else if (mode === 'bypassPermissions') {
    approvalMode = 'yolo';
  }

  // Build system prompt for sub-agent
  const subSystemPrompt = buildSystemPrompt({
    workingDirectory: input.context.workingDirectory,
    model: modelClient.getModel(),
    approvalMode,
  });

  // Add sub-agent specialization to system prompt
  const specializations: Record<string, string> = {
    'code-explorer': `You are a Code Explorer agent. Your specialty is analyzing codebases, understanding architecture, identifying patterns, and providing code insights. 
Focus on:
- Code structure and organization
- Design patterns and architecture
- Potential issues and improvements
- Dependencies and relationships

Be thorough in your analysis and provide actionable insights.`,
    
    'research': `You are a Research agent. Your specialty is gathering information, investigating problems, and finding solutions.
Focus on:
- Searching for relevant documentation and examples
- Investigating error messages and issues
- Finding best practices and patterns
- Gathering context and background information

Be comprehensive in your research and cite sources when possible.`,
    
    'executor': `You are an Executor agent. Your specialty is performing tasks, running commands, and making changes.
Focus on:
- Executing commands and scripts
- Modifying files and code
- Running tests and builds
- Implementing solutions

Be careful and precise in your actions, following best practices.`
  };

  const specializedSystemPrompt = subSystemPrompt + '\n\n' + specializations[subagentType];

  // Create agent loop for sub-agent
  const agentLoop = new AgentLoop({
    modelClient,
    sessionManager,
    toolRegistry,
    systemPrompt: specializedSystemPrompt,
    contextCompressor,
    maxContextTokens: input.context.maxTokens * 8 || 128000,
    onApprovalRequired: input.context.onApprovalRequired,
  });

  // Run the sub-agent
  const result = await agentLoop.run(subSession.id, prompt);

  // Get all messages from the sub-session
  const messages = sessionManager.getMessages(subSession.id);
  const assistantMessages = messages.filter(m => m.role === 'assistant');
  
  // Extract the final response
  let finalResponse = '';
  if (assistantMessages.length > 0) {
    const lastMessage = assistantMessages[assistantMessages.length - 1];
    const textBlocks = lastMessage.content.filter(block => block.type === 'text');
    finalResponse = textBlocks.map(block => (block as any).text).join('\n\n');
  }

  // Clean up sub-session
  sessionManager.delete(subSession.id);

  // Format the result
  const output = `
### 🤖 Sub-agent Task Complete

**Task**: ${description}  
**Type**: ${subagentType}  
**Agent**: ${name || 'Unnamed'}  
**Turns**: ${result.turnsCompleted}  
**Tokens**: ${result.totalInputTokens + result.totalOutputTokens}

---

${finalResponse}

---

**Status**: ✅ Completed successfully
  `.trim();

  return { content: output };
};

export const taskSchema = {
  type: 'object' as const,
  properties: {
    description: {
      type: 'string',
      description: 'Brief description of the task (3-5 words)',
    },
    prompt: {
      type: 'string',
      description: 'Detailed task description for the sub-agent',
    },
    subagentType: {
      type: 'string',
      description: 'Type of sub-agent to spawn',
      enum: ['code-explorer', 'research', 'executor'],
      default: 'research',
    },
    maxTurns: {
      type: 'number',
      description: 'Maximum number of agentic turns',
      default: 10,
    },
    mode: {
      type: 'string',
      description: 'Permission mode for the sub-agent',
      enum: ['acceptEdits', 'bypassPermissions', 'default', 'plan'],
      default: 'default',
    },
    name: {
      type: 'string',
      description: 'Name for the sub-agent (enables team mode)',
    },
    teamName: {
      type: 'string',
      description: 'Team to join (enables team mode)',
    },
  },
  required: ['description', 'prompt', 'subagentType'],
  additionalProperties: false,
};
