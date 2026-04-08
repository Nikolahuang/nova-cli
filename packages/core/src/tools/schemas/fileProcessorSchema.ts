// ============================================================================
// FileProcessor Tool Schema
// ============================================================================

import { z } from 'zod';

export const fileProcessorSchema = z.object({
    operation: z.enum([
        'read',
        'write',
        'info',
        'extract-pdf',
        'create-pdf',
        'extract-word',
        'create-word',
        'read-excel',
        'create-excel',
        'read-json',
        'create-json',
        'read-xml',
        'read-markdown',
        'process',
        'create'
    ]),
    
    filePath: z.string().describe('文件路径'),
    
    content: z.string().optional().describe('写入的内容'),
    
    encoding: z.string().optional().default('utf8').describe('文件编码'),
    
    outputPath: z.string().optional().describe('输出文件路径'),
    
    allowExternalAccess: z.boolean().optional().default(false).describe('Allow access to files outside working directory'),
    
    additionalAllowedPaths: z.array(z.string()).optional().describe('Additional allowed paths for external access'),
    
    options: z.object({
        // PDF选项
        pdf: z.object({
            startPage: z.number().optional().describe('起始页码'),
            endPage: z.number().optional().describe('结束页码'),
            includeMetadata: z.boolean().optional().describe('是否包含元数据')
        }).optional(),
        
        // Word选项
        word: z.object({
            includeStyles: z.boolean().optional().describe('是否包含样式'),
            includeImages: z.boolean().optional().describe('是否包含图片')
        }).optional(),
        
        // Excel选项
        excel: z.object({
            sheetName: z.string().optional().describe('工作表名称'),
            headerRow: z.number().optional().describe('标题行'),
            includeFormulas: z.boolean().optional().describe('是否包含公式')
        }).optional(),
        
        // JSON选项
        pretty: z.boolean().optional().describe('是否格式化JSON'),
        
        // Excel创建选项
        sheetName: z.string().optional().describe('Excel工作表名称'),
        
        // 通用选项
        data: z.any().optional().describe('要写入的数据')
    }).optional()
});

export type FileProcessorInput = z.infer<typeof fileProcessorSchema>;

export const fileProcessorToolDefinition = {
    name: 'file_processor',
    description: '统一文件处理工具，支持PDF、Word、Excel、JSON、XML、Markdown等格式',
    category: 'file',
    inputSchema: fileProcessorSchema,
    requiresApproval: false,
    riskLevel: 'low'
};