// Test script for new Nova CLI features
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runTests() {
  console.log('=== Nova CLI Integration Test ===\n');

  let passed = 0;
  let failed = 0;

  // Test 1: PDF Reading
  console.log('1. Testing PDF Reading...');
  try {
    const pdfParse = await import('pdf-parse');
    const fs = await import('fs');
    const testPdf = join(__dirname, '../node_modules/pdf-parse/test/data/01-valid.pdf');
    
    if (fs.existsSync(testPdf)) {
      const dataBuffer = fs.readFileSync(testPdf);
      const data = await pdfParse.default(dataBuffer);
      console.log('   ✓ PDF read successfully');
      console.log('   ✓ Pages:', data.numpages);
      console.log('   ✓ Text length:', data.text.length);
      passed++;
    } else {
      console.log('   ✗ Test PDF not found');
      failed++;
    }
  } catch (err) {
    console.error('   ✗ PDF reading error:', err.message);
    failed++;
  }

  // Test 2: LangChain
  console.log('\n2. Testing LangChain...');
  try {
    const langchain = await import('langchain');
    console.log('   ✓ LangChain loaded');
    console.log('   ✓ Available exports:', Object.keys(langchain).slice(0, 3));
    passed++;
  } catch (err) {
    console.error('   ✗ LangChain error:', err.message);
    failed++;
  }

  // Test 3: Image OCR (Tesseract.js)
  console.log('\n3. Testing Image OCR (Tesseract.js)...');
  try {
    const Tesseract = await import('tesseract.js');
    console.log('   ✓ Tesseract.js loaded');
    console.log('   ✓ Note: Full OCR test requires Worker support');
    passed++;
  } catch (err) {
    console.error('   ✗ Tesseract.js error:', err.message);
    failed++;
  }

  // Test 4: Web Scraping (DuckDuckGo)
  console.log('\n4. Testing Web Scraping...');
  try {
    const duckScrape = await import('duck-duck-scrape');
    console.log('   ✓ duck-duck-scrape loaded');
    console.log('   ✓ Available methods:', Object.keys(duckScrape).slice(0, 3));
    passed++;
  } catch (err) {
    console.error('   ✗ Web scraping error:', err.message);
    failed++;
  }

  // Test 5: MCP SDK (simplified)
  console.log('\n5. Testing MCP SDK...');
  try {
    const { existsSync } = await import('fs');
    const mcpPath = join(__dirname, 'node_modules/@modelcontextprotocol/sdk/dist/cjs/index.js');
    if (existsSync(mcpPath)) {
      console.log('   ✓ MCP SDK files found at:', mcpPath);
      passed++;
    } else {
      console.log('   ✗ MCP SDK files not found');
      failed++;
    }
  } catch (err) {
    console.error('   ✗ MCP SDK error:', err.message);
    failed++;
  }

  // Test 6: Code Review (ESLint SonarJS)
  console.log('\n6. Testing Code Review (ESLint SonarJS)...');
  try {
    const eslint = await import('eslint-plugin-sonarjs');
    console.log('   ✓ eslint-plugin-sonarjs loaded');
    console.log('   ✓ Available rules:', Object.keys(eslint).slice(0, 3));
    passed++;
  } catch (err) {
    console.error('   ✗ Code review error:', err.message);
    failed++;
  }

  console.log('\n=== Test Summary ===');
  console.log(`✓ Passed: ${passed}`);
  console.log(`✗ Failed: ${failed}`);
  console.log(`Total: ${passed + failed}`);
}

runTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});