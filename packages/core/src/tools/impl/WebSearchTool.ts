import type { ToolHandler, ToolHandlerInput, ToolHandlerOutput } from '../../types/tools.js';
import { ToolError } from '../../types/errors.js';

export const webSearchHandler: ToolHandler = async (input: ToolHandlerInput): Promise<ToolHandlerOutput> => {
  const { query, maxResults = 10, language, region, safeSearch = true, freshness } = input.params as {
    query: string;
    maxResults?: number;
    language?: string;
    region?: string;
    safeSearch?: boolean;
    freshness?: string;
  };

  // This is a placeholder implementation. In production, integrate with a search API
  // such as Google Custom Search, Bing Web Search, or Serper API.

  const apiKey = process.env.NOVA_SEARCH_API_KEY || process.env.SERPER_API_KEY;

  if (!apiKey) {
    // Fallback: provide a helpful message about configuration
    return {
      content: `[Web Search Not Configured]\n\nQuery: ${query}\n\nTo enable web search, you need a Serper.dev API key:\n\n  1. Register at https://serper.dev (free tier: 2500 queries/month)\n  2. Get your API key from the dashboard\n  3. Configure by ONE of:\n     - Environment variable: set NOVA_SEARCH_API_KEY=<your-key>\n     - Config file: add to ~/.nova/config.yaml under search.apiKey`,
      metadata: { query, configured: false },
    };
  }

  try {
    // Serper.dev API integration
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: query,
        num: maxResults,
        gl: region,
        hl: language,
        safe: safeSearch ? 'active' : 'off',
        tbs: freshness ? `qdr:${freshness}` : undefined,
      }),
    });

    if (!response.ok) {
      throw new Error(`Search API returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json() as Record<string, unknown>;
    const organic = (data.organic || []) as Array<{
      title: string;
      link: string;
      snippet: string;
      position: number;
    }>;

    if (organic.length === 0) {
      return {
        content: `No results found for: "${query}"`,
        metadata: { query, count: 0 },
      };
    }

    const results = organic
      .map((r, i) => `${i + 1}. ${r.title}\n   ${r.link}\n   ${r.snippet}`)
      .join('\n\n');

    const knowledgeGraph = data.knowledgeGraph as { title?: string; description?: string } | undefined;
    let output = '';
    if (knowledgeGraph?.title) {
      output += `Knowledge Graph: ${knowledgeGraph.title}\n`;
      if (knowledgeGraph.description) output += `${knowledgeGraph.description}\n`;
      output += '\n';
    }

    output += results;

    return {
      content: output,
      metadata: {
        query,
        count: organic.length,
        hasKnowledgeGraph: !!knowledgeGraph,
      },
    };
  } catch (err) {
    throw new ToolError(`Web search failed: ${(err as Error).message}`, 'web_search');
  }
};
