import type { ToolHandler, ToolHandlerInput, ToolHandlerOutput } from '../../types/tools.js';
import { ToolError, TimeoutError } from '../../types/errors.js';

export const webFetchHandler: ToolHandler = async (input: ToolHandlerInput): Promise<ToolHandlerOutput> => {
  const {
    url,
    method = 'GET',
    headers: extraHeaders,
    body,
    timeout = 15000,
    followRedirects = true,
    maxLength = 50000,
  } = input.params as {
    url: string;
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    timeout?: number;
    followRedirects?: boolean;
    maxLength?: number;
  };

  try {
    // Basic URL validation
    const parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error(`Unsupported protocol: ${parsedUrl.protocol}`);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      method,
      headers: {
        'User-Agent': 'NovaCLI/0.1.0 (Research Agent)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,text/markdown;q=0.9,*/*;q=0.8',
        ...extraHeaders,
      },
      body: method !== 'GET' ? body : undefined,
      signal: controller.signal,
      redirect: followRedirects ? 'follow' : 'manual',
    });

    clearTimeout(timer);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || '';
    let content = await response.text();

    // Truncate if too long
    if (content.length > maxLength) {
      content = content.slice(0, maxLength) + `\n\n[Content truncated: showing ${maxLength} of ${content.length} characters]`;
    }

    // Basic HTML to text conversion
    if (contentType.includes('text/html')) {
      content = htmlToText(content);
    }

    return {
      content,
      metadata: {
        url,
        status: response.status,
        contentType,
        contentLength: content.length,
        finalUrl: response.url,
      },
    };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new TimeoutError(`Fetch timed out after ${timeout}ms`, timeout);
    }
    if (err instanceof TypeError && (err as Error).message.includes('URL')) {
      throw new ToolError(`Invalid URL: ${url}`, 'web_fetch');
    }
    throw new ToolError(`Failed to fetch URL: ${(err as Error).message}`, 'web_fetch');
  }
};

/** Basic HTML to text converter */
function htmlToText(html: string): string {
  return html
    // Remove scripts and styles
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    // Remove HTML tags
    .replace(/<[^>]+>/g, ' ')
    // Decode HTML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim();
}
