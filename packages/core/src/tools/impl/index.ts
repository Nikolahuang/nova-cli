// ============================================================================
// Tool Implementations Barrel Export
// ============================================================================

// File operations
export { readFileHandler } from './ReadFileTool.js';
export { writeFileHandler } from './WriteFileTool.js';
export { editFileHandler } from './EditFileTool.js';
export { listDirectoryHandler } from './ListDirectoryTool.js';
export { searchFileHandler } from './SearchFileTool.js';
export { searchContentHandler } from './SearchContentTool.js';

// Shell and web
export { shellHandler } from './ShellTool.js';
export { webSearchHandler } from './WebSearchTool.js';
export { webFetchHandler } from './WebFetchTool.js';

// Memory and task management
export { memoryReadHandler, memoryWriteHandler } from './MemoryTool.js';
export { todoHandler } from './TodoTool.js';
export { taskHandler } from './TaskTool.js';

// New capabilities - Image Processing (OCR)
export { 
  imageProcessorHandler,
  extractTextFromImage,
  processImage 
} from './ImageProcessorTool.js';