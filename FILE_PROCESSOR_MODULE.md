# FileProcessor 模块文档

## 📋 模块概述

**FileProcessor** 是一个统一的文件处理模块，支持多种文件格式的读取、写入、分析和转换。该模块集成了PDF、Word、Excel、JSON、XML、Markdown等格式的處理能力，为Nova CLI提供了强大的文件处理功能。

## 🏗️ 模块结构

### 核心文件
- **FileProcessor.ts** - 核心文件处理类
- **FileProcessorTool.ts** - 工具实现类
- **fileProcessorSchema.ts** - 工具模式定义

### 位置
```
packages/core/src/tools/impl/FileProcessor.ts
packages/core/src/tools/impl/FileProcessorTool.ts
packages/core/src/tools/schemas/fileProcessorSchema.ts
```

## 🎯 支持的文件格式

| 格式 | 读取 | 写入 | 分析 | 备注 |
|------|------|------|------|------|
| TXT | ✅ | ✅ | ✅ | 纯文本文件 |
| JSON | ✅ | ✅ | ✅ | JSON数据文件 |
| XML | ✅ | ❌ | ✅ | XML结构化数据 |
| PDF | ✅ | ✅ | ✅ | PDF文档处理 |
| Excel (XLSX) | ✅ | ✅ | ✅ | Excel表格文件 |
| Word (DOCX) | ✅ | ✅ | ✅ | Word文档处理 |
| Markdown | ✅ | ❌ | ✅ | Markdown文档 |

## 🚀 主要功能

### 基础文件操作
- **readFile** - 读取文件内容
- **writeFile** - 写入文件内容
- **getFileInfo** - 获取文件信息

### PDF处理
- **extractPdfText** - 提取PDF文本内容
- **createPdf** - 创建PDF文档

### Word处理
- **extractWordText** - 提取Word文档文本
- **createWord** - 创建Word文档

### Excel处理
- **readExcel** - 读取Excel文件
- **createExcel** - 创建Excel文件

### JSON处理
- **readJson** - 读取JSON文件
- **createJson** - 创建JSON文件

### XML处理
- **readXml** - 读取XML文件

### Markdown处理
- **readMarkdown** - 读取Markdown文件

### 通用处理
- **processFile** - 根据文件扩展名自动选择处理方法
- **createFile** - 根据输出路径扩展名自动选择创建方法

## 📝 API使用示例

### 读取文件
```typescript
const result = await fileProcessor.readFile('test.pdf');
if (result.success) {
    console.log('文件内容:', result.data);
}
```

### 创建文件
```typescript
const result = await fileProcessor.createFile(
    'Hello World', 
    'output.txt'
);
```

### 处理PDF文件
```typescript
const result = await fileProcessor.extractPdfText(
    'document.pdf', 
    { startPage: 0, endPage: 5 }
);
```

### 创建Excel文件
```typescript
const data = [
    { name: '张三', age: 28, department: '技术部' },
    { name: '李四', age: 32, department: '市场部' }
];
const result = await fileProcessor.createExcel(data, 'output.xlsx');
```

## 🎯 实际应用案例

### 案例1: PDF文献分析
```typescript
// 分析PDF科研论文并生成阅读笔记
const pdfInfo = await fileProcessor.getFileInfo('research.pdf');
const pdfContent = await fileProcessor.extractPdfText('research.pdf', {
    includeMetadata: true
});

// 创建结构化的阅读笔记
const notes = {
    title: '文献标题',
    fileInfo: pdfInfo.metadata,
    analysis: pdfContent.data,
    createdAt: new Date().toISOString()
};

await fileProcessor.createJson(notes, 'reading-notes.json', true);
```

### 案例2: 数据转换
```typescript
// 将JSON数据转换为Excel
const jsonData = await fileProcessor.readJson('data.json');
await fileProcessor.createExcel(jsonData, 'output.xlsx', 'Sheet1');

// 将Excel转换为JSON
const excelData = await fileProcessor.readExcel('input.xlsx');
await fileProcessor.createJson(excelData, 'output.json', true);
```

## 🔧 技术实现

### 依赖模块
- **pdf-lib** - PDF文档处理
- **docx** - Word文档处理
- **xlsx** - Excel文件处理
- **mammoth** - Word文档文本提取
- **xml2js** - XML文件解析

### 错误处理
所有方法都返回统一的结果格式：
```typescript
interface FileProcessResult {
    success: boolean;
    data?: any;
    error?: string;
    metadata?: Record<string, any>;
}
```

## 📊 性能特点

- **异步处理** - 所有操作都是异步的，适合大文件处理
- **流式处理** - 支持流式读取和写入
- **内存优化** - 合理管理内存使用
- **错误恢复** - 完善的错误处理机制

## 🚀 集成到Nova CLI

### 作为工具使用
```bash
# 使用file_processor工具
nova> /tools file_processor read test.pdf
nova> /tools file_processor create output.docx "Hello World"
```

### 作为技能使用
```bash
# 使用文件处理技能
nova> /skills use file-processor
nova> 分析这个PDF文件: @document.pdf
```

## 📈 版本历史

### v1.0.0 (2026-04-02)
- ✅ 初始版本发布
- ✅ 支持15种文件操作
- ✅ 集成7种文件格式
- ✅ 完整的错误处理
- ✅ 详细的API文档

## 🔮 未来规划

### 短期目标
- [ ] 支持PPT文件格式
- [ ] 支持图片文件格式
- [ ] 增强PDF文本提取（中文支持）
- [ ] 添加文件加密功能

### 长期目标
- [ ] 支持云存储文件处理
- [ ] 添加OCR文字识别
- [ ] 支持批量文件处理
- [ ] 集成AI文档分析

## 📞 技术支持

- **GitHub**: https://github.com/nova-cli/nova-cli
- **文档**: https://nova-cli.dev/docs/file-processor
- **Issues**: https://github.com/nova-cli/nova-cli/issues
- **Discussions**: https://github.com/nova-cli/nova-cli/discussions

---

*此文档由Nova CLI FileProcessor模块自动生成*
*创建时间: 2026-04-02T02:42:00.000Z*
*版本: v1.0.0*