// ============================================================================
// FileProcessor - 统一文件处理模块
// 支持PDF、Word、Excel、TXT、JSON、XML、Markdown等格式
// ============================================================================

import fs from 'fs/promises';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';

// Storage interface for localStorage mock
interface Storage {
    length: number;
    clear(): void;
    getItem(key: string): string | null;
    key(index: number): string | null;
    removeItem(key: string): void;
    setItem(key: string, value: string): void;
}

// Lazy import docx to avoid localStorage warning in Node.js
// The docx package tries to access localStorage which doesn't exist in Node.js
let _docx: typeof import('docx') | null = null;
async function getDocx() {
    if (!_docx) {
        // Mock localStorage for Node.js environment
        if (typeof globalThis.localStorage === 'undefined') {
            const storage: Record<string, string> = {};
            globalThis.localStorage = {
                getItem: (key: string) => storage[key] ?? null,
                setItem: (key: string, value: string) => { storage[key] = value; },
                removeItem: (key: string) => { delete storage[key]; },
                clear: () => { for (const k in storage) delete storage[k]; },
                get length() { return Object.keys(storage).length; },
                key: (i: number) => Object.keys(storage)[i] ?? null,
            } as Storage;
        }
        _docx = await import('docx');
    }
    return _docx;
}

export interface FileProcessResult {
    success: boolean;
    data?: any;
    error?: string;
    metadata?: Record<string, any>;
}

export interface PdfExtractOptions {
    startPage?: number;
    endPage?: number;
    includeMetadata?: boolean;
}

export interface WordExtractOptions {
    includeStyles?: boolean;
    includeImages?: boolean;
}

export interface ExcelExtractOptions {
    sheetName?: string;
    headerRow?: number;
    includeFormulas?: boolean;
}

export class FileProcessor {
    
    // ============================================================================
    // 基础文件操作
    // ============================================================================
    
    /**
     * 读取文件内容
     */
    async readFile(filePath: string, encoding: BufferEncoding = 'utf8'): Promise<FileProcessResult> {
        try {
            const content = await fs.readFile(filePath, encoding);
            return {
                success: true,
                data: content,
                metadata: {
                    size: content.length,
                    encoding: encoding,
                    path: filePath
                }
            };
        } catch (error) {
            return {
                success: false,
                error: `读取文件失败: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }
    
    /**
     * 写入文件内容
     */
    async writeFile(filePath: string, content: string | Buffer, encoding: BufferEncoding = 'utf8'): Promise<FileProcessResult> {
        try {
            await fs.mkdir(path.dirname(filePath), { recursive: true });
            
            if (Buffer.isBuffer(content)) {
                await fs.writeFile(filePath, content);
            } else {
                await fs.writeFile(filePath, content, encoding);
            }
            
            const stats = await fs.stat(filePath);
            return {
                success: true,
                metadata: {
                    size: stats.size,
                    path: filePath,
                    created: stats.birthtime,
                    modified: stats.mtime
                }
            };
        } catch (error) {
            return {
                success: false,
                error: `写入文件失败: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }
    
    /**
     * 获取文件信息
     */
    async getFileInfo(filePath: string): Promise<FileProcessResult> {
        try {
            const stats = await fs.stat(filePath);
            return {
                success: true,
                metadata: {
                    size: stats.size,
                    path: filePath,
                    extension: path.extname(filePath),
                    name: path.basename(filePath),
                    directory: path.dirname(filePath),
                    created: stats.birthtime,
                    modified: stats.mtime,
                    isFile: stats.isFile(),
                    isDirectory: stats.isDirectory()
                }
            };
        } catch (error) {
            return {
                success: false,
                error: `获取文件信息失败: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }
    
    // ============================================================================
    // PDF文件处理
    // ============================================================================
    
    /**
     * 提取PDF文本内容
     */
    async extractPdfText(filePath: string, options: PdfExtractOptions = {}): Promise<FileProcessResult> {
        try {
            const buffer = await fs.readFile(filePath);
            const pdfDoc = await PDFDocument.load(buffer);
            const pages = pdfDoc.getPages();
            
            const startPage = options.startPage || 0;
            const endPage = options.endPage || pages.length - 1;
            
            // 注意：pdf-lib的标准字体不支持中文文本提取
            // 这里主要提供结构信息，文本提取需要额外的OCR或专用库
            
            const result: any = {
                pageCount: pages.length,
                extractedPages: endPage - startPage + 1,
                pages: []
            };
            
            for (let i = startPage; i <= endPage && i < pages.length; i++) {
                const page = pages[i];
                const { width, height } = page.getSize();
                result.pages.push({
                    pageNumber: i + 1,
                    dimensions: { width, height },
                    content: `[PDF Page ${i + 1} - Text extraction requires OCR for Chinese content]`
                });
            }
            
            if (options.includeMetadata) {
                result.fileInfo = await this.getFileInfo(filePath);
            }
            
            return {
                success: true,
                data: result,
                metadata: {
                    format: 'PDF',
                    pageCount: pages.length,
                    processedAt: new Date().toISOString()
                }
            };
        } catch (error) {
            return {
                success: false,
                error: `PDF处理失败: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }
    
    /**
     * 创建PDF文档
     */
    async createPdf(content: string, outputPath: string): Promise<FileProcessResult> {
        try {
            const pdfDoc = await PDFDocument.create();
            const page = pdfDoc.addPage([600, 400]);
            
            // 注意：标准字体不支持中文，这里使用英文
            const font = await pdfDoc.embedFont('Helvetica');
            
            // 将内容分割成多行
            const lines = content.split('\n').slice(0, 20); // 限制行数
            lines.forEach((line, index) => {
                const safeLine = line.replace(/[^\x00-\x7F]/g, '?'); // 替换非ASCII字符
                page.drawText(safeLine.substring(0, 80), { // 限制每行长度
                    x: 50,
                    y: 350 - (index * 20),
                    size: 12,
                    font: font
                });
            });
            
            const pdfBytes = await pdfDoc.save();
            await this.writeFile(outputPath, Buffer.from(pdfBytes));
            
            return {
                success: true,
                metadata: {
                    format: 'PDF',
                    pageCount: 1,
                    createdAt: new Date().toISOString()
                }
            };
        } catch (error) {
            return {
                success: false,
                error: `创建PDF失败: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }
    
    // ============================================================================
    // Word文件处理
    // ============================================================================
    
    /**
     * 提取Word文档文本
     */
    async extractWordText(filePath: string, options: WordExtractOptions = {}): Promise<FileProcessResult> {
        try {
            if (filePath.endsWith('.docx')) {
                // 使用mammoth处理.docx文件
                const buffer = await fs.readFile(filePath);
                const result = await mammoth.extractRawText({ buffer });
                
                return {
                    success: true,
                    data: {
                        text: result.value,
                        messages: result.messages
                    },
                    metadata: {
                        format: 'Word (DOCX)',
                        processedAt: new Date().toISOString()
                    }
                };
            } else if (filePath.endsWith('.doc')) {
                // .doc文件需要其他处理方式
                return {
                    success: false,
                    error: '目前仅支持.docx格式的Word文档'
                };
            } else {
                return {
                    success: false,
                    error: '不支持的Word文件格式'
                };
            }
        } catch (error) {
            return {
                success: false,
                error: `Word处理失败: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }
    
    /**
     * 创建Word文档
     */
    async createWord(content: string, outputPath: string): Promise<FileProcessResult> {
        try {
            const docx = await getDocx();
            const doc = new docx.Document({
                sections: [{
                    properties: {},
                    children: [
                        new docx.Paragraph({
                            children: [
                                new docx.TextRun({
                                    text: content,
                                    font: "Arial"
                                })
                            ]
                        })
                    ]
                }]
            });
            
            const buffer = await docx.Packer.toBuffer(doc);
            await this.writeFile(outputPath, buffer);
            
            return {
                success: true,
                metadata: {
                    format: 'Word (DOCX)',
                    createdAt: new Date().toISOString()
                }
            };
        } catch (error) {
            return {
                success: false,
                error: `创建Word文档失败: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }
    
    // ============================================================================
    // Excel文件处理
    // ============================================================================
    
    /**
     * 读取Excel文件
     */
    async readExcel(filePath: string, options: ExcelExtractOptions = {}): Promise<FileProcessResult> {
        try {
            const buffer = await fs.readFile(filePath);
            const workbook = XLSX.read(buffer, { type: 'buffer' });
            
            const sheetName = options.sheetName || workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            
            const jsonData = XLSX.utils.sheet_to_json(worksheet, {
                header: options.headerRow || 1,
                defval: ''
            });
            
            return {
                success: true,
                data: {
                    sheetName: sheetName,
                    sheetNames: workbook.SheetNames,
                    data: jsonData,
                    rowCount: jsonData.length
                },
                metadata: {
                    format: 'Excel',
                    sheetCount: workbook.SheetNames.length,
                    processedAt: new Date().toISOString()
                }
            };
        } catch (error) {
            return {
                success: false,
                error: `Excel处理失败: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }
    
    /**
     * 创建Excel文件
     */
    async createExcel(data: any[], outputPath: string, sheetName: string = 'Sheet1'): Promise<FileProcessResult> {
        try {
            const worksheet = XLSX.utils.json_to_sheet(data);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
            
            const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
            await this.writeFile(outputPath, buffer);
            
            return {
                success: true,
                metadata: {
                    format: 'Excel (XLSX)',
                    rowCount: data.length,
                    createdAt: new Date().toISOString()
                }
            };
        } catch (error) {
            return {
                success: false,
                error: `创建Excel文件失败: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }
    
    // ============================================================================
    // JSON文件处理
    // ============================================================================
    
    /**
     * 读取JSON文件
     */
    async readJson(filePath: string): Promise<FileProcessResult> {
        try {
            const content = await fs.readFile(filePath, 'utf8');
            const data = JSON.parse(content);
            
            return {
                success: true,
                data: data,
                metadata: {
                    format: 'JSON',
                    size: content.length,
                    parsedAt: new Date().toISOString()
                }
            };
        } catch (error) {
            return {
                success: false,
                error: `JSON解析失败: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }
    
    /**
     * 创建JSON文件
     */
    async createJson(data: any, outputPath: string, pretty: boolean = true): Promise<FileProcessResult> {
        try {
            const content = JSON.stringify(data, null, pretty ? 2 : 0);
            return await this.writeFile(outputPath, content);
        } catch (error) {
            return {
                success: false,
                error: `创建JSON文件失败: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }
    
    // ============================================================================
    // XML文件处理
    // ============================================================================
    
    /**
     * 读取XML文件
     */
    async readXml(filePath: string): Promise<FileProcessResult> {
        try {
            const content = await fs.readFile(filePath, 'utf8');
            
            // Simple XML parsing - extract root element and basic structure
            const rootMatch = content.match(/<([^\s>]+)([^>]*)>([\s\S]*)<\/\1>/);
            if (!rootMatch) {
                return {
                    success: false,
                    error: 'Invalid XML format: no root element found'
                };
            }
            
            const rootTag = rootMatch[1];
            const rootAttributes = rootMatch[2];
            const rootContent = rootMatch[3];
            
            // Extract attributes
            const attributes: Record<string, string> = {};
            const attrMatches = rootAttributes.matchAll(/(\w+)="([^"]*)"/g);
            for (const match of attrMatches) {
                attributes[match[1]] = match[2];
            }
            
            // Simple result structure
            const result = {
                [rootTag]: {
                    _attributes: attributes,
                    _content: rootContent.trim()
                }
            };
            
            return {
                success: true,
                data: result,
                metadata: {
                    format: 'XML',
                    size: content.length,
                    parsedAt: new Date().toISOString(),
                    note: 'Simple XML parsing - basic structure only'
                }
            };
        } catch (error) {
            return {
                success: false,
                error: `XML解析失败: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }
    
    // ============================================================================
    // Markdown文件处理
    // ============================================================================
    
    /**
     * 读取Markdown文件
     */
    async readMarkdown(filePath: string): Promise<FileProcessResult> {
        try {
            const content = await fs.readFile(filePath, 'utf8');
            
            // 简单的Markdown分析
            const lines = content.split('\n');
            const headings = lines.filter(line => line.startsWith('#'));
            const codeBlocks = (content.match(/```/g) || []).length / 2;
            
            return {
                success: true,
                data: {
                    content: content,
                    lineCount: lines.length,
                    headingCount: headings.length,
                    codeBlockCount: codeBlocks,
                    headings: headings.slice(0, 10) // 前10个标题
                },
                metadata: {
                    format: 'Markdown',
                    size: content.length,
                    processedAt: new Date().toISOString()
                }
            };
        } catch (error) {
            return {
                success: false,
                error: `Markdown处理失败: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }
    
    // ============================================================================
    // 通用文件处理方法
    // ============================================================================
    
    /**
     * 根据文件扩展名自动选择处理方法
     */
    async processFile(filePath: string, options: any = {}): Promise<FileProcessResult> {
        const ext = path.extname(filePath).toLowerCase();
        
        switch (ext) {
            case '.pdf':
                return this.extractPdfText(filePath, options.pdf);
                
            case '.docx':
            case '.doc':
                return this.extractWordText(filePath, options.word);
                
            case '.xlsx':
            case '.xls':
                return this.readExcel(filePath, options.excel);
                
            case '.json':
                return this.readJson(filePath);
                
            case '.xml':
                return this.readXml(filePath);
                
            case '.md':
            case '.markdown':
                return this.readMarkdown(filePath);
                
            case '.txt':
            default:
                return this.readFile(filePath, options.encoding);
        }
    }
    
    /**
     * 创建文件（根据扩展名自动选择格式）
     */
    async createFile(content: any, outputPath: string, options: any = {}): Promise<FileProcessResult> {
        const ext = path.extname(outputPath).toLowerCase();
        
        switch (ext) {
            case '.pdf':
                return this.createPdf(String(content), outputPath);
                
            case '.docx':
                return this.createWord(String(content), outputPath);
                
            case '.xlsx':
                return this.createExcel(Array.isArray(content) ? content : [content], outputPath, options.sheetName);
                
            case '.json':
                return this.createJson(content, outputPath, options.pretty);
                
            case '.txt':
            default:
                return this.writeFile(outputPath, String(content), options.encoding);
        }
    }
}

// ============================================================================
// 导出实例
// ============================================================================

export const fileProcessor = new FileProcessor();

export default fileProcessor;