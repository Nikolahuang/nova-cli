// ============================================================================
// testing - Test runner, error analyzer, and auto-fixer for self-healing
// Reference: Aider-style test-fix cycle
// ============================================================================

export { TestRunner } from './TestRunner.js';
export type { TestResult, FailedTest, TestRunnerOptions } from './TestRunner.js';
export { ErrorAnalyzer } from './ErrorAnalyzer.js';
export type { FixSuggestion, ErrorType } from './ErrorAnalyzer.js';
export { AutoFixer } from './AutoFixer.js';
export type { FixResult, FixIteration, AutoFixerOptions } from './AutoFixer.js';
