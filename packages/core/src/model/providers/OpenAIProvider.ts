// ============================================================================
// OpenAI Provider - GPT API integration
// ============================================================================
// Refactored: now extends OpenAICompatibleProvider base class.
// Only provider-specific logic remains (constructor, error hints).
// ============================================================================

import type { OpenAICompatibleConfig } from './OpenAICompatibleProvider.js';
import { OpenAICompatibleProvider } from './OpenAICompatibleProvider.js';

export interface OpenAIProviderConfig {
  apiKey: string;
  baseUrl?: string;
  organizationId?: string;
  model: string;
}

export class OpenAIProvider extends OpenAICompatibleProvider {
  readonly name = 'OpenAI';

  constructor(config: OpenAIProviderConfig) {
    super({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      model: config.model,
      organizationId: config.organizationId,
    });
  }
}
