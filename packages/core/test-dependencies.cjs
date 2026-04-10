/**
 * 测试核心依赖包功能
 * Test core package dependencies functionality
 */

const fs = require('fs');
const path = require('path');

const TEST_DIR = path.join(__dirname, '../../test');

// 测试 pdf-parse
async function testPdfParse() {
  try {
    // 使用项目中实际使用的 pdf-parse 方式
    const pdfParse = require('pdf-parse');
    const pdfPath = path.join(TEST_DIR, '2009.3 TGF-β3 and TNFα perturb blood-testis barrier (BTB) dynamics by accekerating the clathrin-mediated endocytosis of integral membrane proteins--a new concent of BTB regulatiion during spermatogenesis.pdf');
    
    const dataBuffer = fs.readFileSync(pdfPath);
    const data = await pdfParse(dataBuffer);
    
    return {
      status: 'pass',
      textLength: data.text.length,
      pages: data.numpages,
      info: data.info
    };
  } catch (error) {
    return {
      status: 'fail',
      error: error.message
    };
  }
}

// 测试 pdf-lib
async function testPdfLib() {
  try {
    const { PDFDocument } = require('pdf-lib');
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([600, 400]);
    
    const pdfBytes = await pdfDoc.save();
    
    return {
      status: 'pass',
      pdfSize: pdfBytes.length,
      pageCount: pdfDoc.getPageCount()
    };
  } catch (error) {
    return {
      status: 'fail',
      error: error.message
    };
  }
}

// 测试 xlsx
async function testXlsx() {
  try {
    const XLSX = require('xlsx');
    const excelPath = path.join(TEST_DIR, '20260128 引物.xlsx');
    
    const buffer = fs.readFileSync(excelPath);
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);
    
    return {
      status: 'pass',
      sheetCount: workbook.SheetNames.length,
      rowCount: jsonData.length,
      sheetName: sheetName
    };
  } catch (error) {
    return {
      status: 'fail',
      error: error.message
    };
  }
}

// 测试 mammoth
async function testMammoth() {
  try {
    const mammoth = require('mammoth');
    const wordPath = path.join(TEST_DIR, '质粒电转.docx');
    
    const buffer = fs.readFileSync(wordPath);
    const result = await mammoth.extractRawText({ buffer });
    
    return {
      status: 'pass',
      textLength: result.value.length,
      messages: result.messages
    };
  } catch (error) {
    return {
      status: 'fail',
      error: error.message
    };
  }
}

// 测试 docx
async function testDocx() {
  try {
    const { Document, Packer, Paragraph, TextRun } = require('docx');
    
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: 'Hello World - 测试文档创建功能',
                bold: true,
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun('这是一个测试文档'),
            ],
          }),
        ],
      }],
    });
    
    const buffer = await Packer.toBuffer(doc);
    
    return {
      status: 'pass',
      fileSize: buffer.length,
      hasContent: buffer.length > 0
    };
  } catch (error) {
    return {
      status: 'fail',
      error: error.message
    };
  }
}

// 测试 tesseract.js
async function testTesseract() {
  try {
    const Tesseract = require('tesseract.js');
    const imagePath = path.join(TEST_DIR, 'animal_tissue_distribution.jpg');
    
    const result = await Tesseract.recognize(imagePath, 'eng', {
      logger: () => {}
    });
    
    return {
      status: 'pass',
      textLength: result.data.text.length,
      confidence: result.data.confidence
    };
  } catch (error) {
    return {
      status: 'fail',
      error: error.message
    };
  }
}

async function runAllTests() {
  console.log('========================================');
  console.log('🧪 核心依赖包功能测试');
  console.log('========================================\n');
  
  const tests = [
    { name: 'pdf-parse (PDF 文本提取)', fn: testPdfParse },
    { name: 'pdf-lib (PDF 创建)', fn: testPdfLib },
    { name: 'xlsx (Excel 处理)', fn: testXlsx },
    { name: 'mammoth (Word 文档提取)', fn: testMammoth },
    { name: 'docx (Word 文档创建)', fn: testDocx },
    { name: 'tesseract.js (图像 OCR)', fn: testTesseract }
  ];
  
  const results = [];
  
  for (const test of tests) {
    const startTime = Date.now();
    try {
      const result = await test.fn();
      const duration = Date.now() - startTime;
      results.push({ ...result, name: test.name, duration });
      
      const status = result.status === 'pass' ? '✅' : '❌';
      const durationStr = `(${duration}ms)`;
      console.log(`${status} ${test.name} ${durationStr}`);
      
      if (result.status === 'pass') {
        const details = Object.entries(result)
          .filter(([key]) => key !== 'status' && key !== 'name' && key !== 'duration')
          .map(([key, value]) => `${key}: ${typeof value === 'number' ? value : JSON.stringify(value).substring(0, 50)}`)
          .join(', ');
        console.log(`   ${details}`);
      } else {
        console.log(`   Error: ${result.error}`);
      }
      console.log('');
    } catch (error) {
      const duration = Date.now() - startTime;
      results.push({ status: 'fail', name: test.name, error: error.message, duration });
      console.log(`❌ ${test.name} (${duration}ms)`);
      console.log(`   Error: ${error.message}\n`);
    }
  }
  
  // 生成测试报告
  console.log('========================================');
  console.log('📊 测试报告');
  console.log('========================================\n');
  
  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
  
  console.log(`总测试数: ${results.length}`);
  console.log(`通过: ${passed} ✅`);
  console.log(`失败: ${failed} ❌`);
  console.log(`总耗时: ${totalDuration}ms\n`);
  
  if (failed > 0) {
    console.log('失败的测试:');
    results.filter(r => r.status === 'fail').forEach(r => {
      console.log(`  - ${r.name}: ${r.error}`);
    });
    console.log('');
  }
  
  console.log('========================================');
  console.log(`测试完成: ${passed}/${results.length} 通过`);
  console.log('========================================');
  
  return failed === 0;
}

runAllTests().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('测试运行失败:', error);
  process.exit(1);
});