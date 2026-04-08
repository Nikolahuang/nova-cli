import fs from 'node:fs/promises';
import path from 'node:path';
import type { ToolHandler, ToolHandlerInput, ToolHandlerOutput } from '../../types/tools.js';
import { ToolError } from '../../types/errors.js';

/**
 * Detect file type based on extension
 */
function getFileType(filePath: string): 'text' | 'pdf' | 'image' | 'binary' {
  const ext = path.extname(filePath).toLowerCase();
  
  const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
  if (imageExts.includes(ext)) return 'image';
  
  if (ext === '.pdf') return 'pdf';
  
  const binaryExts = ['.exe', '.dll', '.so', '.dylib', '.zip', '.tar', '.gz', '.rar', '.7z', '.mp3', '.mp4', '.avi', '.mov'];
  if (binaryExts.includes(ext)) return 'binary';
  
  return 'text';
}

/**
 * Extract text from PDF using pypdf (Python)
 */
async function extractPdfTextPython(filePath: string): Promise<string> {
  const { spawn } = await import('node:child_process');
  
  return new Promise((resolve, reject) => {
    const pythonCode = `
import sys
try:
    from pypdf import PdfReader
    reader = PdfReader(r'${filePath.replace(/\\/g, '\\\\')}')
    text_parts = []
    for i, page in enumerate(reader.pages, 1):
        text = page.extract_text()
        if text:
            text_parts.append(f'--- Page {i} ---\\n{text}')
    print('\\n'.join(text_parts))
except Exception as e:
    print(f'Error: {e}', file=sys.stderr)
    sys.exit(1)
`;
    
    const python = spawn('python', ['-c', pythonCode], {
      shell: true,
      windowsHide: true,
    });
    
    let stdout = '';
    let stderr = '';
    
    python.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    python.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    python.on('close', (code) => {
      if (code === 0 && stdout.trim()) {
        resolve(stdout.trim());
      } else {
        reject(new Error(`PDF extraction failed: ${stderr || 'Unknown error'}`));
      }
    });
    
    python.on('error', (err) => {
      reject(new Error(`Failed to run Python: ${err.message}`));
    });
  });
}

/**
 * Extract text from PDF using pdf-parse (Node.js native)
 */
async function extractPdfTextNode(filePath: string): Promise<string> {
  try {
    // Try to load pdf-parse dynamically
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pdfParse = require('pdf-parse');
    const dataBuffer = await fs.readFile(filePath);
    const data = await pdfParse(dataBuffer);
    
    // Format output with page markers
    const result: string[] = ['--- PDF Content ---'];
    
    // Add metadata
    result.push(`Pages: ${data.numpages}`);
    result.push(`Info: ${JSON.stringify(data.info || {})}`);
    result.push('');
    result.push('--- Text Content ---');
    result.push(data.text);
    
    return result.join('\n');
  } catch (importError) {
    throw new Error(`pdf-parse not available: ${(importError as Error).message}`);
  }
}

/**
 * Extract text from PDF - tries Node.js first, then Python fallback
 */
async function extractPdfText(filePath: string): Promise<string> {
  // Try Node.js native solution first
  try {
    return await extractPdfTextNode(filePath);
  } catch (nodeError) {
    // Fall back to Python if Node.js solution fails
    try {
      return await extractPdfTextPython(filePath);
    } catch (pythonError) {
      throw new Error(
        `PDF extraction failed. Tried:\n` +
        `  1. Node.js pdf-parse: ${(nodeError as Error).message}\n` +
        `  2. Python pypdf: ${(pythonError as Error).message}\n\n` +
        `Solutions:\n` +
        `  - Run: npm install pdf-parse\n` +
        `  - Or: pip install pypdf (requires Python)`
      );
    }
  }
}

export const readFileHandler: ToolHandler = async (input: ToolHandlerInput): Promise<ToolHandlerOutput> => {
  const { filePath, offset, limit, encoding = 'utf-8' } = input.params as {
    filePath: string;
    offset?: number;
    limit?: number;
    encoding?: BufferEncoding;
  };

  try {
    const resolvedPath = path.resolve(filePath);
    const fileType = getFileType(resolvedPath);
    
    // Handle PDF files
    if (fileType === 'pdf') {
      try {
        const pdfText = await extractPdfText(resolvedPath);
        const lines = pdfText.split('\n');
        
        let selectedLines = lines;
        let lineInfo = '';
        
        if (offset !== undefined || limit !== undefined) {
          const start = offset !== undefined ? Math.max(0, offset - 1) : 0;
          const end = limit !== undefined ? start + limit : lines.length;
          selectedLines = lines.slice(start, end);
          lineInfo = ` (lines ${start + 1}-${Math.min(end, lines.length)} of ${lines.length})`;
        }
        
        const output = selectedLines.map((line, i) => {
          const lineNum = offset !== undefined ? offset + i : i + 1;
          const numStr = String(lineNum).padStart(6, ' ');
          return `${numStr}: ${line}`;
        }).join('\n');
        
        return {
          content: output,
          metadata: {
            path: resolvedPath,
            fileType: 'pdf',
            totalLines: lines.length,
            lineRange: lineInfo || 'full file',
          },
        };
      } catch (pdfError) {
        // Fallback: return error message
        return {
          content: `Cannot display content of PDF file: ${filePath}\n\nError: ${(pdfError as Error).message}\n\nTip: Ensure Python and pypdf are installed (pip install pypdf)`,
          metadata: {
            path: resolvedPath,
            fileType: 'pdf',
            error: (pdfError as Error).message,
          },
        };
      }
    }
    
    // Handle image files
    if (fileType === 'image') {
      const stats = await fs.stat(resolvedPath);
      return {
        content: `[Image file: ${path.basename(filePath)}]\nSize: ${(stats.size / 1024).toFixed(2)} KB\nPath: ${resolvedPath}\n\nTip: Image preview is not supported in text mode. Use the file path to open in an image viewer.`,
        metadata: {
          path: resolvedPath,
          fileType: 'image',
          size: stats.size,
        },
      };
    }
    
    // Handle binary files
    if (fileType === 'binary') {
      const stats = await fs.stat(resolvedPath);
      return {
        content: `[Binary file: ${path.basename(filePath)}]\nSize: ${(stats.size / 1024).toFixed(2)} KB\nPath: ${resolvedPath}\n\nBinary files cannot be displayed as text.`,
        metadata: {
          path: resolvedPath,
          fileType: 'binary',
          size: stats.size,
        },
      };
    }
    
    // Handle text files (original behavior)
    const content = await fs.readFile(resolvedPath, { encoding });
    const lines = content.split('\n');

    let selectedLines = lines;
    let lineInfo = '';

    if (offset !== undefined || limit !== undefined) {
      const start = offset !== undefined ? Math.max(0, offset - 1) : 0; // 1-based to 0-based
      const end = limit !== undefined ? start + limit : lines.length;
      selectedLines = lines.slice(start, end);
      lineInfo = ` (lines ${start + 1}-${Math.min(end, lines.length)} of ${lines.length})`;
    }

    const output = selectedLines.map((line, i) => {
      const lineNum = offset !== undefined ? offset + i : i + 1;
      const numStr = String(lineNum).padStart(6, ' ');
      return `${numStr}: ${line}`;
    }).join('\n');

    return {
      content: output,
      metadata: {
        path: resolvedPath,
        fileType: 'text',
        totalLines: lines.length,
        encoding,
        size: Buffer.byteLength(content, encoding),
        lineRange: lineInfo || 'full file',
      },
    };
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      throw new ToolError(`File not found: ${filePath}`, 'read_file', undefined, { code });
    }
    if (code === 'EACCES') {
      throw new ToolError(`Permission denied: ${filePath}`, 'read_file', undefined, { code });
    }
    if (code === 'EISDIR') {
      throw new ToolError(`Path is a directory, not a file: ${filePath}`, 'read_file', undefined, { code });
    }
    throw new ToolError(`Failed to read file: ${(err as Error).message}`, 'read_file');
  }
};
