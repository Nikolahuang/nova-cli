// ============================================================================
// Agents Module - Multi-agent orchestration system
// ============================================================================

export { 
  AgentOrchestrator, 
  createAgentOrchestrator, 
  getBuiltinAgents 
} from './AgentOrchestrator.js';

export type {
  AgentRole,
  SubAgentConfig,
  AgentTask,
  AgentResult,
  OrchestratorState,
} from './AgentOrchestrator.js';
