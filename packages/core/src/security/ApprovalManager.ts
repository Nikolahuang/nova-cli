// ============================================================================
// ApprovalManager - Manages tool approval workflow
// ============================================================================

import type { ApprovalRequest, ApprovalResponse, ApprovalMode } from '../types/session.js';
import type { ToolDefinition } from '../types/tools.js';
import { ApprovalError } from '../types/errors.js';

export interface ApprovalManagerOptions {
  /** Default approval mode */
  defaultMode: ApprovalMode;
  /** Auto-approve tools with 'low' risk */
  autoApproveLowRisk?: boolean;
  /** Always require approval for these tool names */
  alwaysRequireApproval?: string[];
  /** Never require approval for these tool names */
  neverRequireApproval?: string[];
  /** Custom approval rules */
  rules?: ApprovalRule[];
}

export interface ApprovalRule {
  /** Tool name pattern (glob) */
  toolPattern: string;
  /** Input field conditions */
  conditions?: Record<string, (value: unknown) => boolean>;
  /** Override approval requirement */
  requireApproval: boolean;
  /** Override risk level */
  riskOverride?: 'low' | 'medium' | 'high' | 'critical';
}

export interface ApprovalHandler {
  (request: ApprovalRequest): Promise<ApprovalResponse>;
}

export class ApprovalManager {
  private mode: ApprovalMode;
  private autoApproveLowRisk: boolean;
  private alwaysRequireApproval: Set<string>;
  private neverRequireApproval: Set<string>;
  private rules: ApprovalRule[];
  private pendingRequests = new Map<string, ApprovalRequest>();
  private handler: ApprovalHandler | null = null;

  constructor(options: ApprovalManagerOptions) {
    this.mode = options.defaultMode;
    this.autoApproveLowRisk = options.autoApproveLowRisk ?? false;
    this.alwaysRequireApproval = new Set(options.alwaysRequireApproval || []);
    this.neverRequireApproval = new Set(options.neverRequireApproval || []);
    this.rules = options.rules || [];
  }

  /** Set the approval handler (UI callback) */
  setHandler(handler: ApprovalHandler): void {
    this.handler = handler;
  }

  /** Update the approval mode */
  setMode(mode: ApprovalMode): void {
    this.mode = mode;
  }

  /** Get the current approval mode */
  getMode(): ApprovalMode {
    return this.mode;
  }

  /** Check if a tool call requires approval */
  requiresApproval(
    toolName: string,
    toolInput: Record<string, unknown>,
    toolDefinition?: ToolDefinition
  ): boolean {
    // YOLO mode: never require approval
    if (this.mode === 'yolo') return false;

    // Never-approve list
    if (this.neverRequireApproval.has(toolName)) return false;

    // Always-approve list
    if (this.alwaysRequireApproval.has(toolName)) return true;

    // Check custom rules
    for (const rule of this.rules) {
      if (this.matchPattern(toolName, rule.toolPattern)) {
        if (rule.conditions) {
          const matchesAll = Object.entries(rule.conditions).every(
            ([field, check]) => check(toolInput[field])
          );
          if (matchesAll) {
            return rule.requireApproval;
          }
        } else {
          return rule.requireApproval;
        }
      }
    }

    // Mode-specific default behaviors (check BEFORE tool definition)
    // accepting_edits: auto-approve file, search, memory tools
    if (this.mode === 'accepting_edits') {
      const cat = toolDefinition?.category;
      if (cat === 'file' || cat === 'search' || cat === 'memory') return false;
      // execution, web, orchestration, mcp tools still require approval
      return true;
    }

    // smart mode: auto-approve low risk tools
    if (this.mode === 'smart') {
      const risk = toolDefinition?.riskLevel || 'medium';
      if (risk === 'low') return false;
      return true;
    }

    // Tool definition check (for default and plan modes)
    if (toolDefinition) {
      if (typeof toolDefinition.requiresApproval === 'boolean') {
        return toolDefinition.requiresApproval;
      }
      return toolDefinition.requiresApproval(toolInput, this.mode);
    }

    // Fallback defaults for remaining modes
    if (this.mode === 'plan') return true;
    if (this.mode === 'default') {
      // Default mode: require approval for high/critical risk tools
      const risk = toolDefinition?.riskLevel || 'medium';
      return risk === 'high' || risk === 'critical';
    }

    // Should never reach here, but default to requiring approval
    return true;
  }

  /** Get the effective risk level for a tool call */
  getRiskLevel(
    toolName: string,
    toolInput: Record<string, unknown>,
    toolDefinition?: ToolDefinition
  ): 'low' | 'medium' | 'high' | 'critical' {
    // Check custom rules for risk override
    for (const rule of this.rules) {
      if (rule.riskOverride && this.matchPattern(toolName, rule.toolPattern)) {
        return rule.riskOverride;
      }
    }

    return toolDefinition?.riskLevel || 'medium';
  }

  /** Request user approval for a tool call */
  async requestApproval(request: ApprovalRequest): Promise<ApprovalResponse> {
    if (!this.handler) {
      // No handler set, auto-approve based on mode
      if (this.mode === 'yolo' || (this.autoApproveLowRisk && request.risk === 'low')) {
        return { requestId: request.id, approved: true };
      }
      throw new ApprovalError('No approval handler configured and approval is required');
    }

    this.pendingRequests.set(request.id, request);

    try {
      const response = await this.handler(request);
      if (!response.requestId) {
        response.requestId = request.id;
      }
      return response;
    } finally {
      this.pendingRequests.delete(request.id);
    }
  }

  /** Get pending approval requests */
  getPendingRequests(): ApprovalRequest[] {
    return Array.from(this.pendingRequests.values());
  }

  /** Cancel a pending request */
  cancelRequest(requestId: string): void {
    this.pendingRequests.delete(requestId);
  }

  /** Simple glob pattern matching */
  private matchPattern(name: string, pattern: string): boolean {
    const regexStr = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    return new RegExp(`^${regexStr}$`).test(name);
  }
}
