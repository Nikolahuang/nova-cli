// ============================================================================
// HookExecutor - Executes lifecycle hooks
// ============================================================================

import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import type { HookConfig, HookResult, HookEvent } from '../types/session.js';
import { HookError, TimeoutError } from '../types/errors.js';

export interface HookExecutorOptions {
  /** Default timeout for hook execution (ms) */
  defaultTimeout?: number;
  /** Working directory */
  workingDirectory: string;
  /** Environment variables */
  environment?: Record<string, string>;
  /** Whether hooks are enabled */
  enabled?: boolean;
}

export class HookExecutor extends EventEmitter {
  private hooks = new Map<string, HookConfig[]>();
  private defaultTimeout: number;
  private workingDirectory: string;
  private environment: Record<string, string>;
  private enabled: boolean;

  constructor(options: HookExecutorOptions) {
    super();
    this.defaultTimeout = options.defaultTimeout || 30000;
    this.workingDirectory = options.workingDirectory;
    this.environment = options.environment || {};
    this.enabled = options.enabled ?? true;
  }

  /** Register a hook configuration */
  register(config: HookConfig): void {
    const event = config.event;
    if (!this.hooks.has(event)) {
      this.hooks.set(event, []);
    }
    this.hooks.get(event)!.push(config);
  }

  /** Register multiple hooks */
  registerAll(configs: HookConfig[]): void {
    for (const config of configs) {
      this.register(config);
    }
  }

  /** Execute all hooks for a given event */
  async execute(
    event: HookEvent,
    context?: Record<string, unknown>
  ): Promise<HookResult[]> {
    if (!this.enabled) return [];

    const hooks = this.hooks.get(event) || [];
    const results: HookResult[] = [];

    for (const hook of hooks) {
      // Check condition
      if (hook.condition) {
        try {
          const meets = this.evaluateCondition(hook.condition, context || {});
          if (!meets) continue;
        } catch {
          continue;
        }
      }

      const result = await this.executeHook(hook, context);
      results.push(result);

      this.emit('hook_executed', { event, hook, result });

      // If hook failed, stop chain
      if (result.exitCode !== 0) {
        this.emit('hook_failed', { event, hook, result });
        break;
      }
    }

    return results;
  }

  /** Execute a single hook */
  private async executeHook(hook: HookConfig, context?: Record<string, unknown>): Promise<HookResult> {
    const timeout = hook.timeout || this.defaultTimeout;
    const startTime = Date.now();

    return new Promise<HookResult>((resolve) => {
      // Build environment with context variables
      const env: Record<string, string> = {
        ...this.environment,
        NOVA_HOOK_EVENT: hook.event,
        NOVA_WORKING_DIR: this.workingDirectory,
        ...(context ? this.flattenContext(context) : {}),
      };

      const proc = spawn('sh', ['-c', hook.command], {
        cwd: this.workingDirectory,
        env: { ...process.env, ...env },
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
      proc.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });
      proc.stdin.end();

      const timer = setTimeout(() => {
        proc.kill('SIGKILL');
        resolve({
          exitCode: -1,
          stdout,
          stderr: stderr || `Hook timed out after ${timeout}ms`,
          duration: Date.now() - startTime,
        });
      }, timeout);

      proc.on('close', (code) => {
        clearTimeout(timer);
        resolve({
          exitCode: code ?? -1,
          stdout,
          stderr,
          duration: Date.now() - startTime,
        });
      });

      proc.on('error', (err) => {
        clearTimeout(timer);
        resolve({
          exitCode: -1,
          stdout: '',
          stderr: err.message,
          duration: Date.now() - startTime,
        });
      });
    });
  }

  /** Evaluate a simple condition expression */
  private evaluateCondition(condition: string, context: Record<string, unknown>): boolean {
    // Support simple conditions like "tool == write_file" or "risk == critical"
    const match = condition.match(/^(\w+)\s*==\s*(\w+)$/);
    if (match) {
      const [, key, value] = match;
      return String(context[key]) === value;
    }
    return false;
  }

  /** Flatten context object into NOVA_ prefixed env vars */
  private flattenContext(context: Record<string, unknown>): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(context)) {
      const envKey = `NOVA_${key.toUpperCase().replace(/[^A-Z0-9_]/g, '_')}`;
      result[envKey] = typeof value === 'string' ? value : JSON.stringify(value);
    }
    return result;
  }

  /** Enable/disable hooks */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /** Get all registered hooks */
  getHooks(): Map<string, HookConfig[]> {
    return new Map(this.hooks);
  }
}
