// ============================================================================
// Web Tool Schemas - JSON schemas for web operations
// ============================================================================

export const webSearchSchema = {
  type: 'object' as const,
  properties: {
    query: {
      type: 'string',
      description: 'Search query string',
    },
    maxResults: {
      type: 'number',
      description: 'Maximum number of results to return (default: 10)',
      default: 10,
    },
    language: {
      type: 'string',
      description: 'Language code for search results (e.g., "en", "zh")',
    },
    region: {
      type: 'string',
      description: 'Region for search results (e.g., "us", "cn")',
    },
    safeSearch: {
      type: 'boolean',
      description: 'Enable safe search',
      default: true,
    },
    freshness: {
      type: 'string',
      description: 'Time filter (e.g., "day", "week", "month", "year")',
      enum: ['day', 'week', 'month', 'year'],
    },
  },
  required: ['query'],
  additionalProperties: false,
};

export const webFetchSchema = {
  type: 'object' as const,
  properties: {
    url: {
      type: 'string',
      description: 'URL to fetch content from',
    },
    method: {
      type: 'string',
      description: 'HTTP method (default: "GET")',
      enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      default: 'GET',
    },
    headers: {
      type: 'object',
      description: 'HTTP headers',
      additionalProperties: { type: 'string' },
    },
    body: {
      type: 'string',
      description: 'Request body (for POST/PUT/PATCH)',
    },
    timeout: {
      type: 'number',
      description: 'Timeout in milliseconds (default: 10000)',
      default: 10000,
    },
    followRedirects: {
      type: 'boolean',
      description: 'Follow HTTP redirects (default: true)',
      default: true,
    },
    format: {
      type: 'string',
      description: 'Output format (default: "markdown")',
      enum: ['markdown', 'html', 'text', 'json'],
      default: 'markdown',
    },
    maxLength: {
      type: 'number',
      description: 'Maximum response length in characters (default: 50000)',
      default: 50000,
    },
  },
  required: ['url'],
  additionalProperties: false,
};
