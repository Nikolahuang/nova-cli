import { spawn } from 'node:child_process';
import { isAbsolute, resolve } from 'node:path';
import { promisify } from 'node:util';
import os from 'node:os';
import type { ToolHandler, ToolHandlerInput, ToolHandlerOutput } from '../../types/tools.js';
import { ToolError, TimeoutError } from '../../types/errors.js';

export const shellHandler: ToolHandler = async (input: ToolHandlerInput): Promise<ToolHandlerOutput> => {
  const {
    command,
    workingDirectory,
    env: extraEnv,
    timeout = 30000,
    shell: shellOverride,
    input: stdinInput,
  } = input.params as {
    command: string;
    workingDirectory?: string;
    env?: Record<string, string>;
    timeout?: number;
    shell?: string;
    input?: string;
  };

  const cwd = workingDirectory
    ? isAbsolute(workingDirectory) ? workingDirectory : resolve(workingDirectory)
    : input.context.workingDirectory;

  // Determine shell
  const isWindows = os.platform() === 'win32';
  const shellCmd = shellOverride || (isWindows ? 'powershell.exe' : '/bin/bash');
  const shellArgs = isWindows && !shellOverride ? ['-NoProfile', '-Command', command] : ['-c', command];

  return new Promise<ToolHandlerOutput>((resolveResult, reject) => {
    const proc = spawn(shellCmd, shellArgs, {
      cwd,
      env: { ...process.env, ...input.context.environment, ...extraEnv },
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    if (stdinInput) {
      proc.stdin.write(stdinInput);
      proc.stdin.end();
    } else {
      proc.stdin.end();
    }

    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      reject(new TimeoutError(`Command timed out after ${timeout}ms`, timeout));
    }, timeout);

    proc.on('close', (code) => {
      clearTimeout(timer);
      const exitCode = code ?? 1;
      
      // Enhanced truncation with actionable guidance for Agent
      const MAX = 10_000;
      const truncated = (s: string, label: string = 'output') => {
        if (s.length <= MAX) return s;
        const truncatedLen = s.length - MAX;
        return s.slice(0, MAX) + 
          `\n\n[TRUNCATED: Showing ${MAX.toLocaleString()} of ${s.length.toLocaleString()} chars. ` +
          `To see more, redirect to a file: ${command} > output.txt, then read_file output.txt]`;
      };

      if (exitCode === 0) {
        resolveResult({
          content: truncated(stdout) || (stderr ? `stderr: ${truncated(stderr, 'stderr')}` : 'Command completed successfully (no output)'),
          metadata: {
            exitCode: 0,
            duration: timeout,
            cwd,
            shell: shellCmd,
            outputLength: stdout.length,
            truncated: stdout.length > MAX,
          },
        });
      } else {
        resolveResult({
          content: truncated(stderr, 'stderr') || truncated(stdout, 'stdout') || `Command exited with code ${exitCode}`,
          isError: true,
          metadata: {
            exitCode,
            duration: timeout,
            cwd,
            shell: shellCmd,
            outputLength: stderr.length || stdout.length,
            truncated: stderr.length > MAX || stdout.length > MAX,
          },
        });
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(new ToolError(`Failed to execute command: ${err.message}`, 'execute_command'));
    });

    // Handle abort signal
    input.abortSignal?.addEventListener('abort', () => {
      proc.kill('SIGKILL');
      reject(new ToolError('Command cancelled', 'execute_command'));
    }, { once: true });
  });
};
