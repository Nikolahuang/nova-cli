// ============================================================================
// TestRunner - Execute test commands and parse results
// Reference: Aider-style automatic test execution
// ============================================================================

import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export interface FailedTest {
  /** Test file or test name */
  file: string;
  /** Error message */
  error: string;
  /** Line number if available */
  line?: number;
  /** Test framework that reported the failure */
  framework?: string;
}

export interface TestResult {
  /** Whether all tests passed */
  success: boolean;
  /** Raw stdout output */
  output: string;
  /** Raw stderr output */
  errors: string;
  /** List of failed tests */
  failedTests: FailedTest[];
  /** Total number of tests run (if parseable) */
  totalTests?: number;
  /** Number of passed tests (if parseable) */
  passedTests?: number;
  /** Duration in ms */
  duration: number;
  /** Exit code */
  exitCode: number;
}

export interface TestRunnerOptions {
  /** Working directory for the test command */
  cwd?: string;
  /** Timeout in ms (default: 60000) */
  timeout?: number;
  /** Environment variables */
  env?: Record<string, string>;
}

// --- Test result parsing patterns ---

const TEST_PATTERNS: Array<{
  framework: string;
  failPattern: RegExp;
  totalCountPattern?: RegExp;
  passCountPattern?: RegExp;
  errorLinePattern?: RegExp;
}> = [
  {
    framework: 'jest',
    failPattern: /FAIL\s+([^\s]+)/g,
    totalCountPattern: /Tests:\s+(\d+)\s+failed/,
    passCountPattern: /Tests:\s+(\d+)\s+passed,\s+(\d+)\s+total/,
    errorLinePattern: /at\s+([^\n]+):(\d+):\d+/,
  },
  {
    framework: 'vitest',
    failPattern: /×\s+([^\s]+)\s*\([^\)]*\)/g,
    totalCountPattern: /Tests\s+(\d+)\s+failed/,
    passCountPattern: /Tests\s+(\d+)\s+passed\s+\|/,
    errorLinePattern: /at\s+([^\n]+):(\d+):\d+/,
  },
  {
    framework: 'mocha',
    failPattern: /\s+\d+\)\s+([^\n:]+):/g,
    totalCountPattern: /(\d+)\s+passing/,
    errorLinePattern: /at\s+([^\n]+):(\d+):\d+/,
  },
  {
    framework: 'pytest',
    failPattern: /FAILED\s+([^\s-]+)/g,
    totalCountPattern: /(\d+)\s+failed/,
    passCountPattern: /(\d+)\s+passed/,
    errorLinePattern: /File\s+"([^"]+)",\s+line\s+(\d+)/,
  },
  {
    framework: 'go-test',
    failPattern: /---\s+FAIL:\s+([^\s]+)/g,
    totalCountPattern: /FAIL\s+\d+/,
    errorLinePattern: /([^/\\]+\.go):(\d+)/,
  },
  {
    framework: 'cargo-test',
    failPattern: /test\s+\.\.\.\s+FAILED/g,
    errorLinePattern: /----\s+([^\n]+)\s+stdout/,
  },
  {
    framework: 'generic',
    failPattern: /(?:FAIL|FAILED|ERROR|error)\s*[:\s]+(.+)/gi,
    errorLinePattern: /at\s+([^\n]+):(\d+):\d+/,
  },
];

// --- TestRunner ---

export class TestRunner {
  private options: TestRunnerOptions;

  constructor(options?: TestRunnerOptions) {
    this.options = {
      cwd: process.cwd(),
      timeout: 60000,
      ...options,
    };
  }

  /**
   * Run a test command and parse the results.
   */
  async run(testCommand: string): Promise<TestResult> {
    const startTime = Date.now();

    try {
      const { stdout, stderr } = await execAsync(testCommand, {
        cwd: this.options.cwd,
        timeout: this.options.timeout,
        env: { ...process.env, ...this.options.env },
        maxBuffer: 1024 * 1024, // 1MB
      });

      const duration = Date.now() - startTime;
      const combinedOutput = `${stdout}\n${stderr}`;
      const failedTests = this.parseFailedTests(combinedOutput);
      const { totalTests, passedTests } = this.parseTestCounts(combinedOutput);

      return {
        success: failedTests.length === 0,
        output: stdout,
        errors: stderr,
        failedTests,
        totalTests,
        passedTests,
        duration,
        exitCode: 0,
      };
    } catch (err: any) {
      const duration = Date.now() - startTime;
      const output = err.stdout || '';
      const stderr = err.stderr || '';
      const combinedOutput = `${output}\n${stderr}`;
      const failedTests = this.parseFailedTests(combinedOutput);
      const { totalTests, passedTests } = this.parseTestCounts(combinedOutput);

      return {
        success: false,
        output,
        errors: stderr || err.message,
        failedTests,
        totalTests,
        passedTests,
        duration,
        exitCode: err.code || 1,
      };
    }
  }

  /**
   * Auto-detect the test command for the current project.
   */
  async detectTestCommand(): Promise<string | null> {
    const fs = await import('node:fs/promises');

    // Check for test scripts in package.json
    try {
      const pkg = JSON.parse(await fs.readFile('package.json', 'utf-8'));
      if (pkg.scripts?.test) return pkg.scripts.test;
      if (pkg.scripts?.['test:unit']) return pkg.scripts['test:unit'];
      if (pkg.scripts?.['test:ci']) return pkg.scripts['test:ci'];
    } catch {
      // No package.json
    }

    // Check for test files
    const testIndicators = [
      { file: 'jest.config.js', cmd: 'npx jest' },
      { file: 'jest.config.ts', cmd: 'npx jest' },
      { file: 'vitest.config.ts', cmd: 'npx vitest run' },
      { file: 'vitest.config.js', cmd: 'npx vitest run' },
      { file: '.mocharc.yml', cmd: 'npx mocha' },
      { file: 'pytest.ini', cmd: 'python -m pytest' },
      { file: 'Cargo.toml', cmd: 'cargo test' },
    ];

    for (const indicator of testIndicators) {
      try {
        await fs.access(indicator.file);
        return indicator.cmd;
      } catch {
        // File doesn't exist
      }
    }

    return null;
  }

  /**
   * Parse failed tests from test output.
   */
  private parseFailedTests(output: string): FailedTest[] {
    const failures: FailedTest[] = [];

    for (const pattern of TEST_PATTERNS) {
      const failRegex = new RegExp(pattern.failPattern.source, pattern.failPattern.flags);
      const matches = output.matchAll(failRegex);

      for (const match of matches) {
        const testName = match[1]?.trim() || '';
        if (!testName || testName.length < 2) continue;
        // Skip internal framework messages
        if (testName.startsWith('PASS') || testName.startsWith('FAIL')) continue;

        let line: number | undefined;
        const errorLineRegex = new RegExp(pattern.errorLinePattern.source, 'g');
        const lineMatch = errorLineRegex.exec(output);
        if (lineMatch) {
          line = parseInt(lineMatch[2], 10) || undefined;
        }

        failures.push({
          file: testName,
          error: '',
          line,
          framework: pattern.framework,
        });
      }
    }

    // Deduplicate by file name
    const seen = new Set<string>();
    return failures.filter((f) => {
      if (seen.has(f.file)) return false;
      seen.add(f.file);
      return true;
    });
  }

  /**
   * Parse total and passed test counts from output.
   */
  private parseTestCounts(output: string): { totalTests?: number; passedTests?: number } {
    for (const pattern of TEST_PATTERNS) {
      if (pattern.passCountPattern) {
        const match = output.match(pattern.passCountPattern);
        if (match) {
          return {
            totalTests: parseInt(match[2], 10) || undefined,
            passedTests: parseInt(match[1], 10) || undefined,
          };
        }
      }
    }

    return {};
  }
}
