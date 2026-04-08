// ============================================================================
// QuestionTool - Proactively ask the user for clarification or decisions
// Enables interactive problem-solving workflow
// ============================================================================

import type { ToolHandler, ToolHandlerInput, ToolHandlerOutput } from '../../types/tools.js';

export interface QuestionInput {
  question: string;
  options?: Array<{
    label: string;
    description?: string;
    value: string;
  }>;
  allowOther?: boolean;
  default?: string;
  context?: string;
}

export interface QuestionResult {
  success: boolean;
  asked: boolean;
  answer?: string;
  selectedOption?: {
    label: string;
    value: string;
  };
  isOther?: boolean;
  cancelled?: boolean;
}

// Global question handler - set by the REPL
let globalQuestionHandler: ((question: QuestionInput) => Promise<string | null>) | null = null;

export function setQuestionHandler(handler: (question: QuestionInput) => Promise<string | null>): void {
  globalQuestionHandler = handler;
}

export function clearQuestionHandler(): void {
  globalQuestionHandler = null;
}

export const questionHandler: ToolHandler = async (input: ToolHandlerInput): Promise<ToolHandlerOutput> => {
  const params = input.params as unknown as QuestionInput;
  const { question, options, allowOther = true, default: defaultValue, context } = params;

  try {
    // If no handler is set, return a default response
    if (!globalQuestionHandler) {
      // Try to provide a sensible default
      if (defaultValue) {
        return {
          content: JSON.stringify({
            success: true,
            asked: false,
            answer: defaultValue,
            reason: 'No interactive handler; used default value',
          }),
        };
      }

      // If options are provided, choose the first one
      if (options && options.length > 0) {
        return {
          content: JSON.stringify({
            success: true,
            asked: false,
            answer: options[0].value,
            selectedOption: options[0],
            reason: 'No interactive handler; selected first option',
          }),
        };
      }

      return {
        content: JSON.stringify({
          success: false,
          asked: false,
          error: 'No interactive handler available and no default provided',
        }),
      };
    }

    // Ask the user
    const answer = await globalQuestionHandler(params);

    if (answer === null) {
      // User cancelled
      return {
        content: JSON.stringify({
          success: true,
          asked: true,
          cancelled: true,
        }),
      };
    }

    // Check if answer matches an option
    if (options) {
      const matchedOption = options.find(
        (opt) => (opt.value as string) === answer || opt.label === answer
      );

      if (matchedOption) {
        return {
          content: JSON.stringify({
            success: true,
            asked: true,
            answer: matchedOption.value,
            selectedOption: matchedOption,
            isOther: false,
          }),
        };
      }

      // Answer doesn't match any option
      if (allowOther) {
        return {
          content: JSON.stringify({
            success: true,
            asked: true,
            answer,
            isOther: true,
          }),
        };
      }

      // Not allowed to provide custom answer
      return {
        content: JSON.stringify({
          success: false,
          asked: true,
          error: `Invalid answer: "${answer}". Must be one of: ${options.map((o) => o.value).join(', ')}`,
        }),
      };
    }

    // No options, just a freeform answer
    return {
      content: JSON.stringify({
        success: true,
        asked: true,
        answer,
      }),
    };
  } catch (error) {
    return {
      content: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
    };
  }
};

export default questionHandler;
