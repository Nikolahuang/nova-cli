// Test web scraping with cheerio
import('cheerio').then(async (cheerio) => {
  console.log('=== Testing Web Scraping ===\n');
  
  // Test 1: Basic web scraping
  console.log('1. Scraping example.com...');
  try {
    const response = await fetch('https://example.com');
    const html = await response.text();
    const $ = cheerio.load(html);
    
    const title = $('title').text();
    const h1 = $('h1').text();
    const p = $('p').first().text();
    
    console.log('✓ Scraping completed');
    console.log('Title:', title);
    console.log('H1:', h1);
    console.log('First paragraph:', p.substring(0, 100) + '...');
    
    // Extract all links
    const links = [];
    $('a[href]').each((i, el) => {
      const text = $(el).text().trim();
      const href = $(el).attr('href');
      if (text && href) {
        links.push({ text, url: href });
      }
    });
    console.log('Links found:', links.length);
    
  } catch (err) {
    console.error('✗ Scraping error:', err.message);
  }
  
  // Test 2: Scrape a tech blog
  console.log('\n2. Scraping MDN documentation...');
  try {
    const response = await fetch('https://developer.mozilla.org/en-US/');
    const html = await response.text();
    const $ = cheerio.load(html);
    
    const title = $('title').text();
    const metaDescription = $('meta[name="description"]').attr('content');
    
    console.log('✓ Scraping completed');
    console.log('Title:', title);
    console.log('Description:', metaDescription?.substring(0, 100) + '...');
    
  } catch (err) {
    console.error('✗ MDN scraping error:', err.message);
  }
  
  // Test 3: Content extraction
  console.log('\n3. Testing content extraction...');
  try {
    const response = await fetch('https://httpbin.org/html');
    const html = await response.text();
    const $ = cheerio.load(html);
    
    const text = $('body').text().replace(/\s+/g, ' ').trim();
    console.log('✓ Content extraction completed');
    console.log('Content length:', text.length);
    console.log('Content preview:', text.substring(0, 150) + '...');
    
  } catch (err) {
    console.error('✗ Content extraction error:', err.message);
  }
  
}).catch(err => console.error('Error:', err.message));