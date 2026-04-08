// ============================================================================
// Agent CLI Tests - Comprehensive test suite for Agent-friendly CLI features
// ============================================================================

import { spawn } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../../..');

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

interface TestSuite {
  name: string;
  tests: TestResult[];
  passed: number;
  failed: number;
}

// Helper to run CLI command
async function runNovaCommand(args: string[], stdin?: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const cliPath = path.join(projectRoot, 'packages/cli/bin/nova.js');
    const child = spawn('node', [cliPath, ...args], {
      cwd: projectRoot,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (exitCode) => {
      resolve({ stdout, stderr, exitCode: exitCode || 0 });
    });

    child.on('error', reject);

    if (stdin) {
      child.stdin.write(stdin);
    }
    child.stdin.end();
  });
}

// Test Suite 1: Non-interactive mode (--no-input)
async function testNonInteractiveMode(): Promise<TestSuite> {
  const suite: TestSuite = {
    name: 'Non-interactive Mode Tests',
    tests: [],
    passed: 0,
    failed: 0,
  };

  // Test 1: --no-input flag prevents interactive prompts
  const start = Date.now();
  try {
    const result = await runNovaCommand(['auth', 'set', 'anthropic', '--no-input']);
    const duration = Date.now() - start;
    
    // Should exit quickly without hanging
    if (duration < 5000 && result.exitCode !== 0) {
      suite.tests.push({
        name: 'API Key missing returns error (non-interactive)',
        passed: true,
        duration,
      });
      suite.passed++;
    } else {
      suite.tests.push({
        name: 'API Key missing returns error (non-interactive)',
        passed: false,
        error: `Command took too long (${duration}ms) or exited with code 0`,
        duration,
      });
      suite.failed++;
    }
  } catch (err) {
    const duration = Date.now() - start;
    suite.tests.push({
      name: 'API Key missing returns error (non-interactive)',
      passed: false,
      error: (err as Error).message,
      duration,
    });
    suite.failed++;
  }

  // Test 2: --no-input with --json returns structured error
  const start2 = Date.now();
  try {
    const result = await runNovaCommand(['auth', 'set', 'anthropic', '--no-input', '--json']);
    const duration = Date.now() - start2;
    
    // Should return JSON error
    const jsonOutput = JSON.parse(result.stdout || result.stderr);
    if (jsonOutput.error && jsonOutput.suggestions) {
      suite.tests.push({
        name: 'JSON error format includes actionable suggestions',
        passed: true,
        duration,
      });
      suite.passed++;
    } else {
      suite.tests.push({
        name: 'JSON error format includes actionable suggestions',
        passed: false,
        error: 'JSON output missing error or suggestions',
        duration,
      });
      suite.failed++;
    }
  } catch (err) {
    const duration = Date.now() - start2;
    suite.tests.push({
      name: 'JSON error format includes actionable suggestions',
      passed: false,
      error: (err as Error).message,
      duration,
    });
    suite.failed++;
  }

  return suite;
}

// Test Suite 2: Structured output (--json)
async function testStructuredOutput(): Promise<TestSuite> {
  const suite: TestSuite = {
    name: 'Structured Output Tests',
    tests: [],
    passed: 0,
    failed: 0,
  };

  // Test 1: model list --json returns valid JSON
  const start = Date.now();
  try {
    const result = await runNovaCommand(['model', 'list', '--json']);
    const duration = Date.now() - start;
    
    const jsonOutput = JSON.parse(result.stdout);
    if (Array.isArray(jsonOutput.models) && jsonOutput.models.length > 0) {
      suite.tests.push({
        name: 'model list --json returns valid JSON array',
        passed: true,
        duration,
      });
      suite.passed++;
    } else {
      suite.tests.push({
        name: 'model list --json returns valid JSON array',
        passed: false,
        error: 'JSON output is not a valid array or is empty',
        duration,
      });
      suite.failed++;
    }
  } catch (err) {
    const duration = Date.now() - start;
    suite.tests.push({
      name: 'model list --json returns valid JSON array',
      passed: false,
      error: (err as Error).message,
      duration,
    });
    suite.failed++;
  }

  // Test 2: auth status --json returns structured data
  const start2 = Date.now();
  try {
    const result = await runNovaCommand(['auth', 'status', '--json']);
    const duration = Date.now() - start2;
    
    const jsonOutput = JSON.parse(result.stdout);
    if (jsonOutput.providers && typeof jsonOutput.providers === 'object') {
      suite.tests.push({
        name: 'auth status --json returns structured provider data',
        passed: true,
        duration,
      });
      suite.passed++;
    } else {
      suite.tests.push({
        name: 'auth status --json returns structured provider data',
        passed: false,
        error: 'JSON output missing providers object',
        duration,
      });
      suite.failed++;
    }
  } catch (err) {
    const duration = Date.now() - start2;
    suite.tests.push({
      name: 'auth status --json returns structured provider data',
      passed: false,
      error: (err as Error).message,
      duration,
    });
    suite.failed++;
  }

  return suite;
}

// Test Suite 3: Actionable error messages
async function testActionableErrors(): Promise<TestSuite> {
  const suite: TestSuite = {
    name: 'Actionable Error Messages Tests',
    tests: [],
    passed: 0,
    failed: 0,
  };

  // Test 1: Missing API key shows environment variable suggestion
  const start = Date.now();
  try {
    const result = await runNovaCommand(['-m', 'claude-3-5-sonnet', '-p', 'test', '--no-input']);
    const duration = Date.now() - start;
    
    if (result.stderr.includes('ANTHROPIC_API_KEY') || result.stderr.includes('export')) {
      suite.tests.push({
        name: 'Error message includes environment variable suggestion',
        passed: true,
        duration,
      });
      suite.passed++;
    } else {
      suite.tests.push({
        name: 'Error message includes environment variable suggestion',
        passed: false,
        error: 'Error message missing environment variable suggestion',
        duration,
      });
      suite.failed++;
    }
  } catch (err) {
    const duration = Date.now() - start;
    suite.tests.push({
      name: 'Error message includes environment variable suggestion',
      passed: false,
      error: (err as Error).message,
      duration,
    });
    suite.failed++;
  }

  // Test 2: Invalid command shows usage examples
  const start2 = Date.now();
  try {
    const result = await runNovaCommand(['invalid-command', '--no-input']);
    const duration = Date.now() - start2;
    
    if (result.stderr.includes('Usage:') || result.stderr.includes('Example:')) {
      suite.tests.push({
        name: 'Invalid command shows usage examples',
        passed: true,
        duration,
      });
      suite.passed++;
    } else {
      suite.tests.push({
        name: 'Invalid command shows usage examples',
        passed: false,
        error: 'Error message missing usage examples',
        duration,
      });
      suite.failed++;
    }
  } catch (err) {
    const duration = Date.now() - start2;
    suite.tests.push({
      name: 'Invalid command shows usage examples',
      passed: false,
      error: (err as Error).message,
      duration,
    });
    suite.failed++;
  }

  return suite;
}

// Test Suite 4: Bounded output with truncation guidance
async function testBoundedOutput(): Promise<TestSuite> {
  const suite: TestSuite = {
    name: 'Bounded Output Tests',
    tests: [],
    passed: 0,
    failed: 0,
  };

  // Test 1: Large directory listing shows truncation message
  const start = Date.now();
  try {
    // Create a test directory with many files
    const testDir = path.join(projectRoot, 'test-large-dir');
    await fs.mkdir(testDir, { recursive: true });
    
    // Create 100 test files
    for (let i = 0; i < 100; i++) {
      await fs.writeFile(path.join(testDir, `file${i}.txt`), `content ${i}`);
    }
    
    const result = await runNovaCommand(['--json', '-p', `list_directory ${testDir} --recursive`]);
    const duration = Date.now() - start;
    
    // Cleanup
    await fs.rm(testDir, { recursive: true, force: true });
    
    if (result.stdout.includes('TRUNCATED') || result.stdout.includes('limit')) {
      suite.tests.push({
        name: 'Large directory listing shows truncation message',
        passed: true,
        duration,
      });
      suite.passed++;
    } else {
      suite.tests.push({
        name: 'Large directory listing shows truncation message',
        passed: false,
        error: 'Output missing truncation message',
        duration,
      });
      suite.failed++;
    }
  } catch (err) {
    const duration = Date.now() - start;
    suite.tests.push({
      name: 'Large directory listing shows truncation message',
      passed: false,
      error: (err as Error).message,
      duration,
    });
    suite.failed++;
  }

  // Test 2: Shell command with large output shows continuation guidance
  const start2 = Date.now();
  try {
    const result = await runNovaCommand(['--json', '-p', 'execute_command "dir /s"']);
    const duration = Date.now() - start2;
    
    if (result.stdout.includes('TRUNCATED') || result.stdout.includes('redirect')) {
      suite.tests.push({
        name: 'Large command output shows continuation guidance',
        passed: true,
        duration,
      });
      suite.passed++;
    } else {
      suite.tests.push({
        name: 'Large command output shows continuation guidance',
        passed: false,
        error: 'Output missing continuation guidance',
        duration,
      });
      suite.failed++;
    }
  } catch (err) {
    const duration = Date.now() - start2;
    suite.tests.push({
      name: 'Large command output shows continuation guidance',
      passed: false,
      error: (err as Error).message,
      duration,
    });
    suite.failed++;
  }

  return suite;
}

// Test Suite 5: Real-world Agent scenarios
async function testRealWorldScenarios(): Promise<TestSuite> {
  const suite: TestSuite = {
    name: 'Real-world Agent Scenarios',
    tests: [],
    passed: 0,
    failed: 0,
  };

  // Test 1: Agent analyzes codebase and generates report
  const start = Date.now();
  try {
    const result = await runNovaCommand([
      '--no-input',
      '--json',
      '-p',
      'Analyze this codebase structure and list the main modules',
      '-d',
      projectRoot,
    ]);
    const duration = Date.now() - start;
    
    const jsonOutput = JSON.parse(result.stdout);
    if (jsonOutput.content && !result.stderr.includes('error')) {
      suite.tests.push({
        name: 'Agent analyzes codebase without interactive prompts',
        passed: true,
        duration,
      });
      suite.passed++;
    } else {
      suite.tests.push({
        name: 'Agent analyzes codebase without interactive prompts',
        passed: false,
        error: 'Analysis failed or produced errors',
        duration,
      });
      suite.failed++;
    }
  } catch (err) {
    const duration = Date.now() - start;
    suite.tests.push({
      name: 'Agent analyzes codebase without interactive prompts',
      passed: false,
      error: (err as Error).message,
      duration,
    });
    suite.failed++;
  }

  // Test 2: Agent runs test suite and parses results
  const start2 = Date.now();
  try {
    const result = await runNovaCommand([
      '--no-input',
      '--json',
      '-p',
      'Run npm test and show me the results',
      '-d',
      projectRoot,
    ]);
    const duration = Date.now() - start2;
    
    const jsonOutput = JSON.parse(result.stdout);
    if (jsonOutput.content || jsonOutput.metadata) {
      suite.tests.push({
        name: 'Agent runs tests and parses structured output',
        passed: true,
        duration,
      });
      suite.passed++;
    } else {
      suite.tests.push({
        name: 'Agent runs tests and parses structured output',
        passed: false,
        error: 'No structured output found',
        duration,
      });
      suite.failed++;
    }
  } catch (err) {
    const duration = Date.now() - start2;
    suite.tests.push({
      name: 'Agent runs tests and parses structured output',
      passed: false,
      error: (err as Error).message,
      duration,
    });
    suite.failed++;
  }

  return suite;
}

// Main test runner
export async function runAgentCLITests(): Promise<void> {
  console.log('🚀 Running Agent-friendly CLI Tests\n');
  
  const suites = await Promise.all([
    testNonInteractiveMode(),
    testStructuredOutput(),
    testActionableErrors(),
    testBoundedOutput(),
    testRealWorldScenarios(),
  ]);

  let totalPassed = 0;
  let totalFailed = 0;
  let totalDuration = 0;

  for (const suite of suites) {
    console.log(`\n📋 ${suite.name}`);
    console.log('=' .repeat(60));
    
    for (const test of suite.tests) {
      const status = test.passed ? '�? : '�?;
      console.log(`${status} ${test.name} (${test.duration}ms)`);
      if (test.error) {
        console.log(`   Error: ${test.error}`);
      }
    }
    
    totalPassed += suite.passed;
    totalFailed += suite.failed;
    totalDuration += suite.tests.reduce((sum, t) => sum + t.duration, 0);
    
    console.log(`\n   Summary: ${suite.passed} passed, ${suite.failed} failed`);
  }

  console.log('\n' + '='.repeat(60));
  console.log(`📊 Overall Summary: ${totalPassed} passed, ${totalFailed} failed`);
  console.log(`⏱️  Total Duration: ${totalDuration}ms`);
  
  if (totalFailed > 0) {
    console.log('\n⚠️  Some tests failed. Review the errors above.');
    process.exit(1);
  } else {
    console.log('\n🎉 All tests passed! CLI is fully Agent-friendly.');
    process.exit(0);
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAgentCLITests().catch((err) => {
    console.error('Test runner failed:', err);
    process.exit(1);
  });
}
