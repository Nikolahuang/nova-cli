// Test DuckDuckGo search functionality
import('duck-duck-scrape').then(async (ddg) => {
  console.log('=== Testing DuckDuckGo Search ===\n');
  
  // Test 1: Basic search
  console.log('1. Basic search for Nova CLI...');
  try {
    const results = await ddg.search('Nova CLI');
    console.log('✓ Search completed');
    console.log('Results count:', results.results.length);
    if (results.results.length > 0) {
      console.log('First result:', results.results[0].title);
      console.log('URL:', results.results[0].url);
      console.log('Description:', results.results[0].description.substring(0, 100) + '...');
    }
  } catch (err) {
    console.error('✗ Search error:', err.message);
  }
  
  // Test 2: Specific content search
  console.log('\n2. Searching for specific content (TypeScript)...');
  try {
    const results = await ddg.search('TypeScript tutorial');
    console.log('✓ Search completed');
    console.log('Results count:', results.results.length);
    if (results.results.length > 0) {
      console.log('First result:', results.results[0].title);
    }
  } catch (err) {
    console.error('✗ Search error:', err.message);
  }

  // Test 3: Image search
  console.log('\n3. Image search...');
  try {
    const results = await ddg.searchImages('code logo');
    console.log('✓ Image search completed');
    console.log('Results count:', results.results.length);
    if (results.results.length > 0) {
      console.log('First image:', results.results[0].title);
    }
  } catch (err) {
    console.error('✗ Image search error:', err.message);
  }

  // Test 4: Web scraping with cheerio
  console.log('\n4. Testing web scraping with cheerio...');
  try {
    import('cheerio').then(async (cheerio) => {
      const response = await fetch('https://example.com');
      const html = await response.text();
      const $ = cheerio.load(html);
      const title = $('title').text();
      console.log('✓ Web scraping completed');
      console.log('Page title:', title);
    }).catch(err => {
      console.error('✗ Scraping error:', err.message);
    });
  } catch (err) {
    console.error('✗ Cheerio error:', err.message);
  }
  
}).catch(err => console.error('Error:', err.message));