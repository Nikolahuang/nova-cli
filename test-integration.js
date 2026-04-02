// Test script for new Nova CLI features
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runTests() {
  console.log('=== Nova CLI Integration Test ===\n');

  // Test 1: PDF Reading
  console.log('1. Testing PDF Reading...');
  try {
    const pdfParse = await import('pdf-parse');
    const fs = await import('fs');
    const testPdf = join(__dirname, 'node_modules/pdf-parse/test/data/01-valid.pdf');
    
    if (fs.existsSync(testPdf)) {
      const dataBuffer = fs.readFileSync(testPdf);
      const data = await pdfParse.default(dataBuffer);
      console.log('   ✓ PDF read successfully');
      console.log('   ✓ Pages:', data.numpages);
      console.log('   ✓ Text length:', data.text.length);
    } else {
      console.log('   ✗ Test PDF not found at:', testPdf);
    }
  } catch (err) {
    console.error('   ✗ PDF reading error:', err.message);
  }

  // Test 2: LangChain (from packages/core)
  console.log('\n2. Testing LangChain...');
  try {
    const langchain = await import('./packages/core/node_modules/langchain/index.js');
    console.log('   ✓ LangChain loaded');
    console.log('   ✓ Available exports:', Object.keys(langchain).slice(0, 3));
  } catch (err) {
    console.error('   ✗ LangChain error:', err.message);
  }

  // Test 3: Image OCR (Tesseract.js)
  console.log('\n3. Testing Image OCR (Tesseract.js)...');
  try {
    const Tesseract = await import('./packages/core/node_modules/tesseract.js/index.js');
    console.log('   ✓ Tesseract.js loaded');
    console.log('   ✓ Note: Full OCR test requires Worker support');
  } catch (err) {
    console.error('   ✗ Tesseract.js error:', err.message);
  }

  // Test 4: Web Scraping (DuckDuckGo)
  console.log('\n4. Testing Web Scraping...');
  try {
    const duckScrape = await import('./packages/core/node_modules/duck-duck-scrape/index.js');
    console.log('   ✓ duck-duck-scrape loaded');
    console.log('   ✓ Available methods:', Object.keys(duckScrape).slice(0, 3));
  } catch (err) {
    console.error('   ✗ Web scraping error:', err.message);
  }

  // Test 5: MCP SDK
  console.log('\n5. Testing MCP SDK...');
  try {
    const mcp = await import('./packages/core/node_modules/@modelcontextprotocol/sdk/dist/cjs/index.js');
    console.log('   ✓ MCP SDK loaded');
    console.log('   ✓ Available exports:', Object.keys(mcp).slice(0, 3));
  } catch (err) {
    console.error('   ✗ MCP SDK error:', err.message);
  }

  console.log('\n=== Integration Test Complete ===');
}

runTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});