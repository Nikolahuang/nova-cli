// ============================================================================
// ImageProcessor - Image OCR and text extraction using Tesseract.js
// ============================================================================

import Tesseract from 'tesseract.js';
import type { ToolHandler, ToolHandlerInput, ToolHandlerOutput } from '../../types/tools.js';
import { ToolError } from '../../types/errors.js';

export interface ImageProcessorOptions {
  /** Language for OCR (default: 'eng') */
  lang?: string;
  /** Enable detailed output with bounding boxes */
  detailed?: boolean;
}

/**
 * Extract text from an image using Tesseract.js OCR
 */
export async function extractTextFromImage(
  imagePath: string,
  options: ImageProcessorOptions = {}
): Promise<{
  text: string;
  confidence: number;
  words?: Array<{ text: string; confidence: number; bbox: { x0: number; y0: number; x1: number; y1: number } }>;
}> {
  const { lang = 'eng', detailed = false } = options;

  const result = await Tesseract.recognize(imagePath, lang, {
    logger: () => {},
  });

  const data = result.data as any;

  const output: any = {
    text: data.text,
    confidence: data.confidence,
  };

  if (detailed && data.words) {
    output.words = data.words.map((word: any) => ({
      text: word.text,
      confidence: word.confidence,
      bbox: word.bbox,
    }));
  }

  return output;
}

/**
 * Process an image and extract structured information
 */
export async function processImage(
  imagePath: string,
  extractStructure: boolean = false
): Promise<{
  text: string;
  confidence: number;
  metadata: Record<string, unknown>;
}> {
  const result = await Tesseract.recognize(imagePath, 'eng', {
    logger: () => {},
  });

  const data = result.data as any;

  const metadata: Record<string, unknown> = {
    confidence: data.confidence,
    lines: data.lines?.length || 0,
    words: data.words?.length || 0,
    symbols: data.symbols?.length || 0,
  };

  if (extractStructure && data.lines) {
    metadata.structure = data.lines.map((line: any) => ({
      text: line.text.trim(),
      confidence: line.confidence,
      wordCount: line.words?.length || 0,
    }));
  }

  return {
    text: data.text,
    confidence: data.confidence,
    metadata,
  };
}

/**
 * Tool handler for image processing
 */
export const imageProcessorHandler: ToolHandler = async (
  input: ToolHandlerInput
): Promise<ToolHandlerOutput> => {
  const params = input.params as {
    imagePath?: string;
    operation?: 'ocr' | 'structure' | 'metadata';
    options?: ImageProcessorOptions;
  };

  const { imagePath, operation = 'ocr', options = {} } = params;

  if (!imagePath) {
    throw new ToolError('imagePath is required', 'imageProcessor');
  }

  try {
    switch (operation) {
      case 'structure': {
        const result = await processImage(imagePath, true);
        return {
          content: JSON.stringify(result, null, 2),
          metadata: { operation: 'structure', imagePath },
        };
      }
      case 'metadata': {
        const result = await processImage(imagePath, false);
        return {
          content: JSON.stringify(result.metadata, null, 2),
          metadata: { operation: 'metadata', imagePath },
        };
      }
      case 'ocr':
      default: {
        const result = await extractTextFromImage(imagePath, options);
        return {
          content: result.text,
          metadata: {
            operation: 'ocr',
            imagePath,
            confidence: result.confidence,
            wordCount: result.words?.length,
          },
        };
      }
    }
  } catch (error) {
    throw new ToolError(
      `Image processing failed: ${(error as Error).message}`,
      'imageProcessor',
      undefined,
      { imagePath, operation }
    );
  }
};

export default {
  extractTextFromImage,
  processImage,
  imageProcessorHandler,
};