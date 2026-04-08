// ============================================================================
// FileProcessor Tool - 文件处理工具实现
// ============================================================================

import { FileProcessorInput, fileProcessorToolDefinition } from '../schemas/fileProcessorSchema.js';
import { FileFilter } from '../../security/FileFilter.js';

// Lazy import to avoid localStorage warning from docx package at startup
let _fileProcessor: typeof import('./FileProcessor.js').fileProcessor | null = null;
async function getFileProcessor() {
    if (!_fileProcessor) {
        const module = await import('./FileProcessor.js');
        _fileProcessor = module.fileProcessor;
    }
    return _fileProcessor;
}

export class FileProcessorTool {
    
    static definition = fileProcessorToolDefinition;
    
    /**
     * 执行文件处理操作
     */
    async execute(input: FileProcessorInput): Promise<any> {
        const fileProcessor = await getFileProcessor();
        const { operation, filePath, content, encoding, outputPath, options, allowExternalAccess = false, additionalAllowedPaths = [] } = input;
        
        // Convert encoding to BufferEncoding type
        const bufferEncoding = (encoding || 'utf8') as BufferEncoding;
        
        // Create a temporary FileFilter to validate file access if external access is not allowed
        let fileFilter: FileFilter | undefined;
        if (!allowExternalAccess) {
            fileFilter = new FileFilter({
                ignorePatterns: ['node_modules/**', '.git/**', 'dist/**', 'build/**', '*.log', '.env', '.env.local'],
                workingDirectory: process.cwd(),
                maxFileSize: 10 * 1024 * 1024,
                maxBatchSize: 100,
                allowExternalAccess: allowExternalAccess,
                additionalAllowedPaths: additionalAllowedPaths,
            });
            
            // Check input file access
            if (filePath) {
                const accessCheck = fileFilter.isAllowed(filePath);
                if (!accessCheck.allowed) {
                    throw new Error(`File access denied: ${accessCheck.reason}`);
                }
            }
            
            // Check output file access
            if (outputPath) {
                const accessCheck = fileFilter.isAllowed(outputPath);
                if (!accessCheck.allowed) {
                    throw new Error(`Output file access denied: ${accessCheck.reason}`);
                }
            }
        }

        try {
            switch (operation) {
                // 基础文件操作
                case 'read':
                    return await fileProcessor.readFile(filePath, bufferEncoding);
                    
                case 'write':
                    if (content === undefined) {
                        throw new Error('写入操作需要提供content参数');
                    }
                    return await fileProcessor.writeFile(filePath, content, bufferEncoding);
                    
                case 'info':
                    return await fileProcessor.getFileInfo(filePath);
                    
                // PDF处理
                case 'extract-pdf':
                    return await fileProcessor.extractPdfText(filePath, options?.pdf);
                    
                case 'create-pdf':
                    if (content === undefined) {
                        throw new Error('创建PDF需要提供content参数');
                    }
                    if (!outputPath) {
                        throw new Error('创建PDF需要提供outputPath参数');
                    }
                    return await fileProcessor.createPdf(content, outputPath);
                    
                // Word处理
                case 'extract-word':
                    return await fileProcessor.extractWordText(filePath, options?.word);
                    
                case 'create-word':
                    if (content === undefined) {
                        throw new Error('创建Word文档需要提供content参数');
                    }
                    if (!outputPath) {
                        throw new Error('创建Word文档需要提供outputPath参数');
                    }
                    return await fileProcessor.createWord(content, outputPath);
                    
                // Excel处理
                case 'read-excel':
                    return await fileProcessor.readExcel(filePath, options?.excel);
                    
                case 'create-excel':
                    if (!outputPath) {
                        throw new Error('创建Excel文件需要提供outputPath参数');
                    }
                    const data = options?.data || (content ? JSON.parse(content) : []);
                    return await fileProcessor.createExcel(
                        Array.isArray(data) ? data : [data],
                        outputPath,
                        options?.sheetName
                    );
                    
                // JSON处理
                case 'read-json':
                    return await fileProcessor.readJson(filePath);
                    
                case 'create-json':
                    if (!outputPath) {
                        throw new Error('创建JSON文件需要提供outputPath参数');
                    }
                    const jsonData = options?.data || (content ? JSON.parse(content) : {});
                    return await fileProcessor.createJson(jsonData, outputPath, options?.pretty);
                    
                // XML处理
                case 'read-xml':
                    return await fileProcessor.readXml(filePath);
                    
                // Markdown处理
                case 'read-markdown':
                    return await fileProcessor.readMarkdown(filePath);
                    
                // 通用处理
                case 'process':
                    return await fileProcessor.processFile(filePath, options);
                    
                case 'create':
                    if (!outputPath) {
                        throw new Error('创建文件需要提供outputPath参数');
                    }
                    return await fileProcessor.createFile(
                        options?.data || content,
                        outputPath,
                        options
                    );
                    
                default:
                    throw new Error(`不支持的操作: ${operation}`);
            }
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                operation: operation,
                timestamp: new Date().toISOString()
            };
        }
    }
}

// ============================================================================
// 导出工具实例和定义
// ============================================================================

export const fileProcessorTool = new FileProcessorTool();

export default fileProcessorTool;