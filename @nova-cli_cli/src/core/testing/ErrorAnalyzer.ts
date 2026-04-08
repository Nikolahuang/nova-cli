// ============================================================================
// ErrorAnalyzer - Analyze errors from tests/builds and generate fix suggestions
// Reference: Aider-style error classification and fix recommendations
// ============================================================================

import type { FailedTest } from './TestRunner.js';

export type ErrorType =
  | 'syntax'
  | 'type'
  | 'reference'
  | 'import'
  | 'runtime'
  | 'assertion'
  | 'timeout'
  | 'permission'
  | 'network'
  | 'dependency'
  | 'unknown';

export interface FixSuggestion {
  /** The type of error detected */
  errorType: ErrorType;
  /** Human-readable description of the error */
  description: string;
  /** The file where the error occurred */
  file: string;
  /** Line number (if available) */
  line?: number;
  /** Confidence score 0-1 */
  confidence: number;
  /** Suggested fix approach */
  fixApproach: string;
  /** Specific code patterns to look for */
  searchPatterns: string[];
  /** Suggested replacement patterns */
  replacePatterns?: Array<{ from: string; to: string }>;
  /** Whether this error is likely auto-fixable */
  autoFixable: boolean;
}

export interface ErrorAnalysisResult {
  /** All identified errors with suggestions */
  suggestions: FixSuggestion[];
  /** Critical errors that need immediate attention */
  criticalErrors: FixSuggestion[];
  /** Errors that can be auto-fixed */
  autoFixableErrors: FixSuggestion[];
  /** Summary of the error analysis */
  summary: string;
}

// --- Error pattern database ---

interface ErrorPattern {
  type: ErrorType;
  pattern: RegExp;
  description: string;
  fixApproach: string;
  autoFixable: boolean;
  confidence: number;
}

const ERROR_PATTERNS: ErrorPattern[] = [
  // TypeScript/JavaScript syntax errors
  {
    type: 'syntax',
    pattern: /SyntaxError[:\s]+(?:unexpected token|Unexpected token)/i,
    description: 'Syntax error - unexpected token in code',
    fixApproach: 'Check for missing brackets, parentheses, commas, or invalid syntax near the reported line',
    autoFixable: false,
    confidence: 0.9,
  },
  {
    type: 'syntax',
    pattern: /Parsing error[:\s]+(?:Unexpected token|unexpected)/i,
    description: 'Parsing error - invalid JavaScript/TypeScript syntax',
    fixApproach: 'Review the syntax near the error line for missing semicolons, brackets, or operator issues',
    autoFixable: false,
    confidence: 0.85,
  },
  // TypeScript type errors
  {
    type: 'type',
    pattern: /error TS(\d+):[\s\S]*?Property '(\w+)' does not exist on type/,
    description: 'TypeScript type error - property does not exist on type',
    fixApproach: 'Check the type definition and ensure the property exists or use a type assertion',
    autoFixable: true,
    confidence: 0.95,
  },
  {
    type: 'type',
    pattern: /error TS(\d+):[\s\S]*?Type '(\w+)' is not assignable to type/,
    description: 'TypeScript type error - incompatible type assignment',
    fixApproach: 'Add a type cast or ensure the value matches the expected type',
    autoFixable: true,
    confidence: 0.9,
  },
  {
    type: 'type',
    pattern: /error TS(\d+):[\s\S]*?Argument of type '(\w+)' is not assignable/,
    description: 'TypeScript type error - argument type mismatch',
    fixApproach: 'Check the function signature and ensure the argument type matches the parameter type',
    autoFixable: true,
    confidence: 0.9,
  },
  {
    type: 'type',
    pattern: /error TS(\d+):[\s\S]*?Cannot find name '(\w+)'/,
    description: 'TypeScript error - undefined identifier',
    fixApproach: 'Import the missing identifier or check for typos',
    autoFixable: true,
    confidence: 0.85,
  },
  // Import errors
  {
    type: 'import',
    pattern: /Cannot find module '([^']+)'/,
    description: 'Module not found error',
    fixApproach: 'Install the missing module with npm/yarn or check the import path',
    autoFixable: true,
    confidence: 0.95,
  },
  {
    type: 'import',
    pattern: /Module not found[:\s]+Error[:\s]+Can't resolve '([^']+)'/,
    description: 'Module resolution error',
    fixApproach: 'Check the import path and ensure the module is installed',
    autoFixable: true,
    confidence: 0.9,
  },
  {
    type: 'import',
    pattern: /ERR_MODULE_NOT_FOUND/,
    description: 'ESM module not found',
    fixApproach: 'Check the import path, ensure .js extension is included for ESM imports',
    autoFixable: true,
    confidence: 0.9,
  },
  // Reference errors
  {
    type: 'reference',
    pattern: /(?:ReferenceError|TypeError)[:\s]+(\w+) is not (?:defined|a function|a constructor)/,
    description: 'Reference error - accessing undefined variable or function',
    fixApproach: 'Ensure the variable or function is declared and in scope before use',
    autoFixable: false,
    confidence: 0.85,
  },
  {
    type: 'reference',
    pattern: /TypeError[:\s]+Cannot read (?:properties of )?(?:undefined|null) \(reading '(\w+)'\)/,
    description: 'TypeError - accessing property on null/undefined',
    fixApproach: 'Add a null check before accessing the property, or ensure the object is properly initialized',
    autoFixable: true,
    confidence: 0.9,
  },
  {
    type: 'reference',
    pattern: /TypeError[:\s]+(?:\w+)\.(?:\w+) is not a function/,
    description: 'TypeError - calling a non-function value',
    fixApproach: 'Ensure the value is a function before calling it, check for typos in method names',
    autoFixable: false,
    confidence: 0.8,
  },
  // Runtime errors
  {
    type: 'runtime',
    pattern: /RangeError[:\s]+Maximum call stack size exceeded/,
    description: 'Stack overflow - infinite recursion detected',
    fixApproach: 'Check for infinite recursion, missing base case in recursive functions, or circular dependencies',
    autoFixable: false,
    confidence: 0.9,
  },
  {
    type: 'runtime',
    pattern: /RangeError[:\s]+Invalid array length/,
    description: 'Invalid array length - likely negative or too large',
    fixApproach: 'Add bounds checking before creating arrays or check for negative values',
    autoFixable: true,
    confidence: 0.85,
  },
  {
    type: 'runtime',
    pattern: /Error[:\s]+ENOSPC|no space left/,
    description: 'Disk space exhausted',
    fixApproach: 'Free up disk space or check for large temporary files',
    autoFixable: false,
    confidence: 0.95,
  },
  // Assertion errors
  {
    type: 'assertion',
    pattern: /AssertionError[:\s]+expected\s+.+?\s+to\s+(?:equal|be|contain|have)/i,
    description: 'Test assertion failed - value mismatch',
    fixApproach: 'Review the test expectation and the actual value, update either the code or the test',
    autoFixable: false,
    confidence: 0.8,
  },
  {
    type: 'assertion',
    pattern: /expect\((.+?)\)\.(?:to[Be|Equal|Have|Contain]+)\((.+?)\)/,
    description: 'Jest/Vitest assertion failure',
    fixApproach: 'Compare expected vs actual values and fix the implementation or update the test expectation',
    autoFixable: false,
    confidence: 0.85,
  },
  // Timeout errors
  {
    type: 'timeout',
    pattern: /Timeout\s*-\s*(?:Async callback|test|operation)/i,
    description: 'Test or operation timed out',
    fixApproach: 'Increase the timeout value or optimize the operation',
    autoFixable: true,
    confidence: 0.7,
  },
  {
    type: 'timeout',
    pattern: /ETIMEOUT|ETIMEDOUT|socket hang up/,
    description: 'Network or I/O operation timed out',
    fixApproach: 'Check network connectivity, increase timeout, or add retry logic',
    autoFixable: true,
    confidence: 0.8,
  },
  // Permission errors
  {
    type: 'permission',
    pattern: /EACCES[:\s]+permission denied/i,
    description: 'File system permission denied',
    fixApproach: 'Check file/directory permissions or run with appropriate privileges',
    autoFixable: false,
    confidence: 0.95,
  },
  // Dependency errors
  {
    type: 'dependency',
    pattern: /npm ERR!|yarn error|pnpm ERR!/,
    description: 'Package manager error',
    fixApproach: 'Check the error details for missing dependencies, version conflicts, or registry issues',
    autoFixable: true,
    confidence: 0.8,
  },
  {
    type: 'dependency',
    pattern: /peer dep[^\n]*?MISSING|UNMET PEER DEPENDENCY/i,
    description: 'Missing peer dependency',
    fixApproach: 'Install the missing peer dependency',
    autoFixable: true,
    confidence: 0.9,
  },
  // Python runtime errors
  {
    type: 'runtime',
    pattern: /NameError[:\s]+name '(\S+)' is not defined/i,
    description: 'Python NameError - undefined variable',
    fixApproach: 'Check for typos in the variable name, ensure the variable is defined before use, or import the required module',
    autoFixable: true,
    confidence: 0.9,
  },
  {
    type: 'runtime',
    pattern: /TypeError[:\s]+(.+)/i,
    description: 'Type error in operation',
    fixApproach: 'Check the types of operands and ensure they support the operation being performed',
    autoFixable: false,
    confidence: 0.85,
  },
  {
    type: 'runtime',
    pattern: /IndentationError[:\s]+(.+)/i,
    description: 'Python indentation error',
    fixApproach: 'Fix the indentation to use consistent spaces or tabs',
    autoFixable: true,
    confidence: 0.9,
  },
];

// --- ErrorAnalyzer ---

export class ErrorAnalyzer {
  /**
   * Analyze raw error output and generate fix suggestions.
   */
  analyze(errorOutput: string): ErrorAnalysisResult {
    const suggestions: FixSuggestion[] = [];

    // Try each error pattern against the output
    for (const pattern of ERROR_PATTERNS) {
      const flags = pattern.pattern.flags.includes('g') ? pattern.pattern.flags : pattern.pattern.flags + 'g';
      const regex = new RegExp(pattern.pattern.source, flags);
      const matches = errorOutput.matchAll(regex);

      for (const match of matches) {
        const file = this.extractFile(errorOutput, match.index || 0);
        const line = this.extractLine(errorOutput, match.index || 0);

        suggestions.push({
          errorType: pattern.type,
          description: pattern.description.replace(/\(.*?\)/, `('${match[1] || 'unknown'}')`),
          file,
          line,
          confidence: pattern.confidence,
          fixApproach: pattern.fixApproach,
          searchPatterns: this.generateSearchPatterns(pattern.type, match),
          autoFixable: pattern.autoFixable,
        });
      }
    }

    // Deduplicate suggestions
    const deduped = this.deduplicateSuggestions(suggestions);

    return {
      suggestions: deduped,
      criticalErrors: deduped.filter(
        (s) => s.confidence >= 0.85 && s.errorType !== 'assertion'
      ),
      autoFixableErrors: deduped.filter((s) => s.autoFixable),
      summary: this.generateSummary(deduped),
    };
  }

  /**
   * Analyze test failures specifically.
   */
  analyzeTestFailures(
    testResult: { failedTests: FailedTest[]; output: string; errors: string }
  ): ErrorAnalysisResult {
    const combinedOutput = `${testResult.output}\n${testResult.errors}`;
    const analysis = this.analyze(combinedOutput);

    // If no specific errors found, create generic suggestions from failed test names
    if (analysis.suggestions.length === 0 && testResult.failedTests.length > 0) {
      for (const failed of testResult.failedTests) {
        analysis.suggestions.push({
          errorType: 'assertion',
          description: `Test failure in ${failed.file}`,
          file: failed.file,
          line: failed.line,
          confidence: 0.6,
          fixApproach: 'Review the test assertion and the code under test',
          searchPatterns: [failed.file],
          autoFixable: false,
        });
      }
    }

    return {
      ...analysis,
      summary: this.generateSummary(analysis.suggestions, testResult.failedTests.length),
    };
  }

  /**
   * Categorize and prioritize errors for the auto-fixer.
   */
  prioritizeErrors(suggestions: FixSuggestion[]): FixSuggestion[] {
    const priorityOrder: Record<ErrorType, number> = {
      syntax: 0,
      import: 1,
      type: 2,
      reference: 3,
      dependency: 4,
      permission: 5,
      runtime: 6,
      timeout: 7,
      network: 8,
      assertion: 9,
      unknown: 10,
    };

    return [...suggestions].sort((a, b) => {
      // First by priority
      const priorityDiff = priorityOrder[a.errorType] - priorityOrder[b.errorType];
      if (priorityDiff !== 0) return priorityDiff;
      // Then by confidence (higher first)
      return b.confidence - a.confidence;
    });
  }

  /**
   * Extract the file path from error context.
   */
  private extractFile(output: string, matchIndex: number): string {
    // Look backwards from the match for a file path
    const before = output.substring(Math.max(0, matchIndex - 200), matchIndex);
    const filePatterns = [
      /(?:at |in |file )([^\s:()]+\.(?:ts|tsx|js|jsx|py|go|rs|java|rb))/g,
      /([A-Za-z]:\\[^\s:()]+\.(?:ts|tsx|js|jsx|py|go|rs|java|rb))/g,
      /(?:\/[^\s:()]+\/)([^\s:()]+\.(?:ts|tsx|js|jsx|py|go|rs|java|rb))/g,
    ];

    for (const pattern of filePatterns) {
      let lastMatch: string | null = null;
      let match: RegExpExecArray | null;
      const regex = new RegExp(pattern.source, pattern.flags);
      while ((match = regex.exec(before)) !== null) {
        lastMatch = match[1] || match[0];
      }
      if (lastMatch) return lastMatch;
    }

    return 'unknown';
  }

  /**
   * Extract the line number from error context.
   */
  private extractLine(output: string, matchIndex: number): number | undefined {
    const after = output.substring(matchIndex, matchIndex + 200);
    const linePatterns = [
      /(?:line |:)(\d+)(?:[:\s]|\))/,
      /:(\d+):\d+/, // file:line:column format
    ];

    for (const pattern of linePatterns) {
      const match = after.match(pattern);
      if (match) return parseInt(match[1], 10);
    }

    return undefined;
  }

  /**
   * Generate search patterns for finding the error in code.
   */
  private generateSearchPatterns(
    type: ErrorType,
    match: RegExpMatchArray
  ): string[] {
    const patterns: string[] = [];

    if (match[1]) {
      patterns.push(match[1]);
    }

    switch (type) {
      case 'import':
        if (match[1]) patterns.push(`import.*${match[1]}`);
        break;
      case 'type':
        if (match[1]) patterns.push(match[1]);
        if (match[2]) patterns.push(match[2]);
        break;
      case 'reference':
        if (match[1]) patterns.push(match[1]);
        break;
    }

    return patterns.filter(Boolean);
  }

  /**
   * Remove duplicate suggestions.
   */
  private deduplicateSuggestions(suggestions: FixSuggestion[]): FixSuggestion[] {
    const seen = new Set<string>();
    return suggestions.filter((s) => {
      const key = `${s.file}:${s.line}:${s.errorType}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Generate a human-readable summary.
   */
  private generateSummary(
    suggestions: FixSuggestion[],
    failedTestCount?: number
  ): string {
    if (suggestions.length === 0) {
      return 'No specific error patterns detected. Manual analysis required.';
    }

    const typeCounts: Record<string, number> = {};
    for (const s of suggestions) {
      typeCounts[s.errorType] = (typeCounts[s.errorType] || 0) + 1;
    }

    const parts: string[] = [];

    if (failedTestCount !== undefined) {
      parts.push(`${failedTestCount} test(s) failed.`);
    }

    const typeEntries = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
    parts.push(
      `Detected ${typeEntries.map(([t, c]) => `${c} ${t}(s)`).join(', ')}.`
    );

    const autoFixable = suggestions.filter((s) => s.autoFixable).length;
    if (autoFixable > 0) {
      parts.push(`${autoFixable} error(s) may be auto-fixable.`);
    }

    return parts.join(' ');
  }
}
