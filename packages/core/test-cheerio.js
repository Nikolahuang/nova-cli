// Test Cheerio HTML parsing
import('cheerio').then((cheerio) => {
  console.log('=== Testing Cheerio HTML Parsing ===\n');
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Test Page</title>
      <meta name="description" content="A test page">
    </head>
    <body>
      <h1>Welcome to Nova CLI</h1>
      <p>This is a test page for web scraping functionality.</p>
      <a href="https://example.com">Example Link</a>
      <a href="https://github.com">GitHub</a>
      <div class="content">
        <h2>Features</h2>
        <ul>
          <li>AI-powered terminal assistant</li>
          <li>Multi-model support</li>
          <li>Extensible tool system</li>
        </ul>
      </div>
    </body>
    </html>
  `;
  
  const $ = cheerio.load(html);
  
  console.log('Title:', $('title').text());
  console.log('Description:', $('meta[name="description"]').attr('content'));
  console.log('H1:', $('h1').text());
  console.log('First paragraph:', $('p').first().text());
  
  console.log('\nLinks:');
  $('a[href]').each((i, el) => {
    const text = $(el).text().trim();
    const href = $(el).attr('href');
    console.log(`  ${i + 1}. ${text}: ${href}`);
  });
  
  console.log('\nFeatures:');
  $('ul li').each((i, el) => {
    console.log(`  - ${$(el).text().trim()}`);
  });
  
  console.log('\n✓ Cheerio HTML parsing works correctly!');
}).catch(err => console.error('Error:', err.message));