// ============================================================================
// AutoFixer - Self-healing test-fix loop engine
// Reference: Aider-style automatic code repair cycle
// ============================================================================

import { createMessageId, createSessionId } from '../types/session.js';
import type { ModelClient } from '../model/ModelClient.js';
import type { TestRunner } from './TestRunner.js';
import type { ErrorAnalyzer, FixSuggestion } from './ErrorAnalyzer.js';
import type { Message } from '../types/session.js';

export interface FixIteration {
  /** Iteration number (1-based) */
  iteration: number;
  /** Errors being addressed */
  errors: string[];
  /** Fix prompt sent to the model */
  fixPrompt: string;
  /** Raw model response */
  modelResponse: string;
  /** Files modified in this iteration */
  filesModified: string[];
  /** Duration in ms */
  duration: number;
  /** Whether this iteration succeeded */
  success: boolean;
}

export interface FixResult {
  /** Whether all errors were fixed */
  success: boolean;
  /** Total iterations attempted */
  iterations: FixIteration[];
  /** Final test result (if available) */
  finalTestSuccess?: boolean;
  /** Total time spent fixing */
  totalDuration: number;
  /** Summary of what was fixed */
  summary: string;
}

export interface AutoFixerOptions {
  /** Model client for generating fixes */
  modelClient: ModelClient;
  /** Test runner for executing tests */
  testRunner: TestRunner;
  /** Error analyzer for classifying errors */
  errorAnalyzer: ErrorAnalyzer;
  /** Maximum fix iterations (default: 3) */
  maxIterations?: number;
  /** Test command to run */
  testCommand: string;
  /** Maximum time per fix iteration in ms (default: 120000) */
  iterationTimeout?: number;
  /** Working directory */
  cwd?: string;
  /** Additional context for the model */
  context?: string;
  /** Called when a fix iteration starts */
  onIterationStart?: (iteration: number, errors: string[]) => void;
  /** Called when a fix iteration completes */
  onIterationComplete?: (iteration: FixIteration) => void;
  /** Called when the fix process completes */
  onComplete?: (result: FixResult) => void;
}

export class AutoFixer {
  private options: Required<
    Pick<
      AutoFixerOptions,
      | 'modelClient'
      | 'testRunner'
      | 'errorAnalyzer'
      | 'maxIterations'
      | 'testCommand'
      | 'iterationTimeout'
      | 'cwd'
      | 'context'
    >
  > & Omit<AutoFixerOptions, keyof Pick<AutoFixerOptions, 'modelClient' | 'testRunner' | 'errorAnalyzer' | 'maxIterations' | 'testCommand' | 'iterationTimeout' | 'cwd' | 'context'>>;

  constructor(options: AutoFixerOptions) {
    this.options = {
      modelClient: options.modelClient,
      testRunner: options.testRunner,
      errorAnalyzer: options.errorAnalyzer,
      maxIterations: options.maxIterations || 3,
      testCommand: options.testCommand,
      iterationTimeout: options.iterationTimeout || 120000,
      cwd: options.cwd || process.cwd(),
      context: options.context || '',
      onIterationStart: options.onIterationStart,
      onIterationComplete: options.onIterationComplete,
      onComplete: options.onComplete,
    };
  }

  /**
   * Run the full self-healing fix loop.
   * 1. Run tests
   * 2. If failures, analyze errors
   * 3. Generate fixes
   * 4. Apply fixes
   * 5. Re-run tests
   * 6. Repeat until fixed or max iterations
   */
  async fix(testOutput?: string): Promise<FixResult> {
    const startTime = Date.now();
    const iterations: FixIteration[] = [];

    // Step 1: Run tests (if no output provided)
    const testResult = testOutput
      ? null
      : await this.runTests();

    const combinedOutput = testOutput || (testResult ? `${testResult.output}\n${testResult.errors}` : '');

    // Step 2: Analyze errors
    const analysis = this.options.errorAnalyzer.analyze(combinedOutput);

    if (analysis.suggestions.length === 0) {
      const result: FixResult = {
        success: true,
        iterations: [],
        finalTestSuccess: true,
        totalDuration: Date.now() - startTime,
        summary: 'No errors detected. Tests appear to be passing.',
      };
      this.options.onComplete?.(result);
      return result;
    }

    // Step 3-6: Fix loop
    let currentOutput = combinedOutput;
    let currentErrors = analysis.suggestions;
    let fixSuccess = false;

    for (let i = 1; i <= this.options.maxIterations; i++) {
      this.options.onIterationStart?.(i, currentErrors.map((e) => e.description));

      const iteration = await this.runFixIteration(i, currentErrors, currentOutput);
      iterations.push(iteration);

      this.options.onIterationComplete?.(iteration);

      if (iteration.success) {
        // Re-run tests to verify
        const verifyResult = await this.runTests();
        if (verifyResult.success) {
          fixSuccess = true;
          break;
        }

        // Tests still failing - analyze remaining errors
        currentOutput = `${verifyResult.output}\n${verifyResult.errors}`;
        const newAnalysis = this.options.errorAnalyzer.analyze(currentOutput);

        // Check if we made progress (fewer errors)
        if (newAnalysis.suggestions.length >= currentErrors.length) {
          // No progress - stop to avoid infinite loop
          break;
        }

        currentErrors = newAnalysis.suggestions;
      }
    }

    const totalTime = Date.now() - startTime;
    const result: FixResult = {
      success: fixSuccess,
      iterations,
      totalDuration: totalTime,
      summary: this.generateSummary(fixSuccess, iterations),
    };

    this.options.onComplete?.(result);
    return result;
  }

  /**
   * Run a single fix iteration.
   */
  private async runFixIteration(
    iteration: number,
    errors: FixSuggestion[],
    testOutput: string
  ): Promise<FixIteration> {
    const startTime = Date.now();

    // Build the fix prompt for the model
    const fixPrompt = this.buildFixPrompt(errors, testOutput);

    // Call the model to generate fixes
    let modelResponse: string;
    try {
      const messages: Message[] = [
        {
          id: createMessageId(`fix-system-${iteration}`),
          role: 'user',
          content: [
            {
              type: 'text',
              text: fixPrompt,
            },
          ],
          timestamp: Date.now(),
          createdAt: new Date(),
        },
      ];

      const response = await this.options.modelClient.complete(
        messages,
        [],
        createSessionId(`session-${Date.now()}`),
        { systemPrompt: this.getSystemPrompt() }
      );

      // Extract text from response
      modelResponse =
        response.content
          ?.filter((b) => b.type === 'text')
          .map((b) => b.text)
          .join('\n') || '';
    } catch (err: any) {
      return {
        iteration,
        errors: errors.map((e) => e.description),
        fixPrompt,
        modelResponse: `Model error: ${err.message}`,
        filesModified: [],
        duration: Date.now() - startTime,
        success: false,
      };
    }

    // Extract modified files from model response
    const filesModified = this.extractFilesFromResponse(modelResponse);

    return {
      iteration,
      errors: errors.map((e) => e.description),
      fixPrompt,
      modelResponse,
      filesModified,
      duration: Date.now() - startTime,
      success: filesModified.length > 0 && modelResponse.length > 100,
    };
  }

  /**
   * Build a detailed fix prompt for the model.
   */
  private buildFixPrompt(errors: FixSuggestion[], testOutput: string): string {
    const prioritized = this.options.errorAnalyzer.prioritizeErrors(errors);
    const autoFixable = prioritized.filter((e) => e.autoFixable);

    let prompt = `## Fix Request - Iteration Context\n\n`;
    prompt += `The following errors need to be fixed:\n\n`;

    for (let i = 0; i < prioritized.length; i++) {
      const error = prioritized[i];
      prompt += `### Error ${i + 1}: ${error.errorType} (confidence: ${Math.round(error.confidence * 100)}%)\n`;
      prompt += `- **File**: ${error.file}${error.line ? `:${error.line}` : ''}\n`;
      prompt += `- **Description**: ${error.description}\n`;
      prompt += `- **Suggested approach**: ${error.fixApproach}\n`;
      if (error.searchPatterns.length > 0) {
        prompt += `- **Search patterns**: ${error.searchPatterns.join(', ')}\n`;
      }
      if (error.autoFixable) {
        prompt += `- **Auto-fixable**: Yes\n`;
      }
      prompt += '\n';
    }

    if (autoFixable.length > 0) {
      prompt += `\n**Priority**: Fix these auto-fixable errors first:\n`;
      for (const e of autoFixable) {
        prompt += `- ${e.file}: ${e.description}\n`;
      }
      prompt += '\n';
    }

    prompt += `\n## Relevant Test Output\n\n\`\`\`\n${this.truncateOutput(testOutput, 3000)}\n\`\`\`\n\n`;

    if (this.options.context) {
      prompt += `\n## Project Context\n\n${this.options.context}\n\n`;
    }

    prompt += `## Instructions\n\n`;
    prompt += `1. For each error, show the exact file that needs to be modified\n`;
    prompt += `2. Show the complete fixed code block with file path\n`;
    prompt += `3. Explain what changed and why\n`;
    prompt += `4. Format: use \`\`\`filepath\n// code here\n\`\`\` for each file change\n\n`;
    prompt += `Focus ONLY on fixing the listed errors. Do not refactor or change unrelated code.`;

    return prompt;
  }

  /**
   * Get the system prompt for the fix model.
   */
  private getSystemPrompt(): string {
    return `You are an expert code repair assistant. Your job is to fix specific errors identified by automated testing.

Rules:
- Only modify code that directly relates to the reported errors
- Preserve existing code style, formatting, and conventions
- Show complete file contents for modified files (not just diffs)
- Explain each fix briefly
- If an error is unclear, make the minimal change most likely to fix it
- Never introduce new imports or dependencies unless the error requires it
- Never delete tests or test assertions
- Use the same language as the existing code for comments and strings`;
  }

  /**
   * Extract file paths mentioned in the model response.
   */
  private extractFilesFromResponse(response: string): string[] {
    const files: string[] = [];
    const filePattern = /```(?:typescript|javascript|python|go|rust|java|ruby)?\s*\n\/\/\s*(?:file:\s*)?([^\n]+\.(?:ts|tsx|js|jsx|py|go|rs|java|rb))/gi;

    let match: RegExpExecArray | null;
    while ((match = filePattern.exec(response)) !== null) {
      const file = match[1].trim();
      if (file && !files.includes(file)) {
        files.push(file);
      }
    }

    // Also try simple code block patterns
    const simplePattern = /```(?:\w+)?\s*\n([\s\S]*?)```/g;
    while ((match = simplePattern.exec(response)) !== null) {
      const content = match[1];
      const filePathMatch = content.match(/^(?:\/\/|#)\s*(?:file:\s*)?([^\n]+\.(?:ts|tsx|js|jsx|py|go|rs|java|rb))/m);
      if (filePathMatch) {
        const file = filePathMatch[1].trim();
        if (file && !files.includes(file)) {
          files.push(file);
        }
      }
    }

    return files;
  }

  /**
   * Run the test command.
   */
  private async runTests() {
    return this.options.testRunner.run(this.options.testCommand);
  }

  /**
   * Truncate output to prevent prompt overflow.
   */
  private truncateOutput(output: string, maxChars: number): string {
    if (output.length <= maxChars) return output;

    // Keep the beginning (context) and end (most recent errors)
    const headSize = Math.floor(maxChars * 0.3);
    const tailSize = maxChars - headSize;

    const head = output.substring(0, headSize);
    const tail = output.substring(output.length - tailSize);

    return `${head}\n\n... [truncated ${output.length - maxChars} characters] ...\n\n${tail}`;
  }

  /**
   * Generate a summary of the fix process.
   */
  private generateSummary(success: boolean, iterations: FixIteration[]): string {
    if (success) {
      return `All errors fixed in ${iterations.length} iteration(s). ${iterations.reduce((sum, i) => sum + i.filesModified.length, 0)} file(s) modified.`;
    }

    if (iterations.length === 0) {
      return 'No fix iterations were attempted.';
    }

    const lastIteration = iterations[iterations.length - 1];
    return `Fix attempt concluded after ${iterations.length} iteration(s) without resolving all errors. ${lastIteration.filesModified.length} file(s) were modified in the last iteration.`;
  }
}
