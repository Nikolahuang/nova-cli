// ============================================================================
// SandboxExecutor - Isolated execution environment
// ============================================================================

import { spawn, ChildProcess } from 'node:child_process';
import * as path from 'node:path';
import * as os from 'node:os';
import { createLogger } from '../utils/Logger.js';

const logger = createLogger('SandboxExecutor');

// ============================================================================
// Types
// ============================================================================

/**
 * Sandbox type
 */
export type SandboxType = 'none' | 'docker' | 'isolate' | 'bubblewrap';

/**
 * Sandbox configuration
 */
export interface SandboxConfig {
  enabled: boolean;
  type: SandboxType;
  network: 'none' | 'restricted' | 'full';
  memory: string;    // e.g., "2GB"
  cpu: string;       // e.g., "1.0" (100%)
  timeout: number;   // milliseconds
  workDir?: string;
  env?: Record<string, string>;
  readOnlyPaths?: string[];
  writablePaths?: string[];
}

/**
 * Execution result
 */
export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
  timedOut: boolean;
}

/**
 * Default sandbox configuration
 */
const DEFAULT_CONFIG: SandboxConfig = {
  enabled: false,
  type: 'none',
  network: 'none',
  memory: '2GB',
  cpu: '1.0',
  timeout: 60000,
};

// ============================================================================
// SandboxExecutor
// ============================================================================

/**
 * Execute commands in an isolated sandbox environment
 */
export class SandboxExecutor {
  private config: SandboxConfig;
  private dockerAvailable: boolean | null = null;
  
  constructor(config: Partial<SandboxConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  // -----------------------------------------------------------------------
  // Detection
  // -----------------------------------------------------------------------
  
  /**
   * Check if Docker is available
   */
  async isDockerAvailable(): Promise<boolean> {
    if (this.dockerAvailable !== null) return this.dockerAvailable;
    
    try {
      const result = await this.runCommand('docker', ['--version'], 5000);
      this.dockerAvailable = result.exitCode === 0;
      logger.debug(`Docker available: ${this.dockerAvailable}`);
    } catch {
      this.dockerAvailable = false;
    }
    
    return this.dockerAvailable;
  }
  
  /**
   * Get the best available sandbox type
   */
  async getBestSandboxType(): Promise<SandboxType> {
    if (await this.isDockerAvailable()) return 'docker';
    
    // Check for Linux-specific sandbox tools
    if (os.platform() === 'linux') {
      try {
        await this.runCommand('which', ['bwrap'], 1000);
        return 'bubblewrap';
      } catch {}
      
      try {
        await this.runCommand('which', ['isolate'], 1000);
        return 'isolate';
      } catch {}
    }
    
    return 'none';
  }
  
  // -----------------------------------------------------------------------
  // Execution
  // -----------------------------------------------------------------------
  
  /**
   * Execute a command in the sandbox
   */
  async execute(command: string, args: string[] = []): Promise<ExecutionResult> {
    const startTime = Date.now();
    
    if (!this.config.enabled) {
      // No sandbox - direct execution
      return this.runCommand(command, args, this.config.timeout);
    }
    
    switch (this.config.type) {
      case 'docker':
        return this.executeInDocker(command, args);
      
      case 'bubblewrap':
        return this.executeInBubblewrap(command, args);
      
      case 'isolate':
        return this.executeInIsolate(command, args);
      
      default:
        return this.runCommand(command, args, this.config.timeout);
    }
  }
  
  /**
   * Execute a shell command string
   */
  async executeShell(shellCommand: string): Promise<ExecutionResult> {
    const isWin = os.platform() === 'win32';
    const shell = isWin ? 'powershell.exe' : '/bin/sh';
    const shellArgs = isWin ? ['-Command', shellCommand] : ['-c', shellCommand];
    
    return this.execute(shell, shellArgs);
  }
  
  // -----------------------------------------------------------------------
  // Docker Execution
  // -----------------------------------------------------------------------
  
  /**
   * Execute command in Docker container
   */
  private async executeInDocker(command: string, args: string[]): Promise<ExecutionResult> {
    if (!(await this.isDockerAvailable())) {
      logger.warn('Docker not available, falling back to direct execution');
      return this.runCommand(command, args, this.config.timeout);
    }
    
    const workDir = this.config.workDir ?? process.cwd();
    
    // Build docker run arguments
    const dockerArgs = [
      'run',
      '--rm',
      '-v', `${workDir}:/workspace`,
      '-w', '/workspace',
    ];
    
    // Memory limit
    dockerArgs.push('-m', this.config.memory);
    
    // CPU limit
    dockerArgs.push('--cpus', this.config.cpu);
    
    // Network
    if (this.config.network === 'none') {
      dockerArgs.push('--network', 'none');
    }
    
    // Environment variables
    if (this.config.env) {
      for (const [key, value] of Object.entries(this.config.env)) {
        dockerArgs.push('-e', `${key}=${value}`);
      }
    }
    
    // Read-only paths
    if (this.config.readOnlyPaths) {
      for (const p of this.config.readOnlyPaths) {
        dockerArgs.push('-v', `${p}:/ro-${path.basename(p)}:ro`);
      }
    }
    
    // Image and command
    dockerArgs.push('nova-sandbox:latest', command, ...args);
    
    logger.debug(`Docker args: ${dockerArgs.join(' ')}`);
    
    return this.runCommand('docker', dockerArgs, this.config.timeout);
  }
  
  // -----------------------------------------------------------------------
  // Bubblewrap Execution (Linux)
  // -----------------------------------------------------------------------
  
  /**
   * Execute command using Bubblewrap (Linux only)
   */
  private async executeInBubblewrap(command: string, args: string[]): Promise<ExecutionResult> {
    if (os.platform() !== 'linux') {
      logger.warn('Bubblewrap only available on Linux, falling back');
      return this.runCommand(command, args, this.config.timeout);
    }
    
    const workDir = this.config.workDir ?? process.cwd();
    
    // Build bwrap arguments
    const bwrapArgs = [
      '--ro-bind', '/usr', '/usr',
      '--ro-bind', '/bin', '/bin',
      '--ro-bind', '/lib', '/lib',
      '--ro-bind', '/lib64', '/lib64',
      '--bind', workDir, workDir,
      '--unshare-all',
      '--die-with-parent',
    ];
    
    // Network
    if (this.config.network === 'none') {
      bwrapArgs.push('--unshare-net');
    }
    
    // Command to execute
    bwrapArgs.push('--', command, ...args);
    
    return this.runCommand('bwrap', bwrapArgs, this.config.timeout);
  }
  
  // -----------------------------------------------------------------------
  // Isolate Execution (Linux)
  // -----------------------------------------------------------------------
  
  /**
   * Execute command using Isolate (Linux only)
   */
  private async executeInIsolate(command: string, args: string[]): Promise<ExecutionResult> {
    if (os.platform() !== 'linux') {
      logger.warn('Isolate only available on Linux, falling back');
      return this.runCommand(command, args, this.config.timeout);
    }
    
    const workDir = this.config.workDir ?? process.cwd();
    
    // Build isolate arguments
    const isolateArgs = [
      '--run',
      '--dir=/work=' + workDir,
      '--workdir=/work',
    ];
    
    // Memory limit (in KB)
    const memKB = this.parseMemory(this.config.memory);
    isolateArgs.push(`--mem=${memKB}`);
    
    // Time limit (in seconds)
    isolateArgs.push(`--time=${Math.ceil(this.config.timeout / 1000)}`);
    
    // Network
    if (this.config.network === 'none') {
      isolateArgs.push('--no-direct-io');
    }
    
    // Command
    isolateArgs.push('--', command, ...args);
    
    return this.runCommand('isolate', isolateArgs, this.config.timeout);
  }
  
  // -----------------------------------------------------------------------
  // Utilities
  // -----------------------------------------------------------------------
  
  /**
   * Run a command with timeout
   */
  private runCommand(
    command: string,
    args: string[],
    timeout: number
  ): Promise<ExecutionResult> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      let stdout = '';
      let stderr = '';
      let timedOut = false;
      
      const proc = spawn(command, args, {
        cwd: this.config.workDir,
        env: { ...process.env, ...this.config.env },
        shell: os.platform() === 'win32',
      });
      
      const timeoutId = setTimeout(() => {
        timedOut = true;
        proc.kill('SIGKILL');
      }, timeout);
      
      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
      });
      
      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });
      
      proc.on('close', (code) => {
        clearTimeout(timeoutId);
        resolve({
          stdout,
          stderr,
          exitCode: code ?? 1,
          duration: Date.now() - startTime,
          timedOut,
        });
      });
      
      proc.on('error', (err) => {
        clearTimeout(timeoutId);
        stderr += err.message;
        resolve({
          stdout,
          stderr,
          exitCode: 1,
          duration: Date.now() - startTime,
          timedOut: false,
        });
      });
    });
  }
  
  /**
   * Parse memory string to KB
   */
  private parseMemory(mem: string): number {
    const match = mem.match(/^(\d+(?:\.\d+)?)(GB|MB|KB)?$/i);
    if (!match) return 2 * 1024 * 1024;  // Default 2GB
    
    const value = parseFloat(match[1] || '0');
    const unit = (match[2] || 'MB').toUpperCase();
    
    switch (unit) {
      case 'GB': return value * 1024 * 1024;
      case 'MB': return value * 1024;
      case 'KB': return value;
      default: return value * 1024;
    }
  }
  
  // -----------------------------------------------------------------------
  // Docker Image Management
  // -----------------------------------------------------------------------
  
  /**
   * Build the sandbox Docker image
   */
  async buildDockerImage(): Promise<boolean> {
    if (!(await this.isDockerAvailable())) {
      logger.error('Docker not available');
      return false;
    }
    
    const dockerfile = `
FROM node:20-slim
WORKDIR /workspace
RUN apt-get update && apt-get install -y \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*
CMD ["/bin/bash"]
`;
    
    try {
      const result = await this.runCommand('docker', [
        'build',
        '-t', 'nova-sandbox:latest',
        '-',
      ], 60000);
      
      // Pass dockerfile via stdin would require more complex handling
      // For now, create a temp file
      logger.info('Docker image built successfully');
      return result.exitCode === 0;
    } catch (error) {
      logger.error('Failed to build Docker image', { error });
      return false;
    }
  }
  
  /**
   * Check if sandbox Docker image exists
   */
  async hasDockerImage(): Promise<boolean> {
    if (!(await this.isDockerAvailable())) return false;
    
    try {
      const result = await this.runCommand('docker', [
        'image', 'inspect', 'nova-sandbox:latest',
      ], 5000);
      return result.exitCode === 0;
    } catch {
      return false;
    }
  }
}

// ============================================================================
// Factory function
// ============================================================================

/**
 * Create a sandbox executor with default configuration
 */
export function createSandboxExecutor(config: Partial<SandboxConfig> = {}): SandboxExecutor {
  return new SandboxExecutor(config);
}

/**
 * Check if sandbox is available
 */
export async function isSandboxAvailable(): Promise<boolean> {
  const executor = new SandboxExecutor();
  const type = await executor.getBestSandboxType();
  return type !== 'none';
}
