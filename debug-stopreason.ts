/**
 * Debug test to check deepseek stopReason for tool calls
 */
import { ConfigManager } from './packages/core/src/config/ConfigManager.js';
import { AuthManager } from './packages/core/src/auth/AuthManager.js';
import { ModelClient } from './packages/core/src/model/ModelClient.js';

async function test() {
  const configManager = new ConfigManager();
  const config = await configManager.load(process.cwd());
  const authManager = new AuthManager();
  await authManager.loadCredentials();
  
  // Get raw model config to create provider directly
  const rawModelId = config.core.defaultModel;
  const configModel = configManager.getModelConfig(rawModelId);
  
  if (!configModel) {
    console.error('Model not found in config:', rawModelId);
    process.exit(1);
  }
  
  console.log('Model config:', JSON.stringify(configModel, null, 2));
  console.log('Provider type:', configModel.provider);
  console.log('Provider type string:', String(configModel.provider));
  
  // Create ModelClient the same way NovaApp does
  const modelClient = new ModelClient({
    provider: String(configModel.provider) as any,
    apiKey: configModel.apiKey,
    baseUrl: configModel.baseUrl,
    model: rawModelId,
    maxTokens: config.core.maxTokens,
    temperature: config.core.temperature,
  });
  
  // Get the raw provider to test
  const provider = (modelClient as any).provider;
  console.log('Provider class:', provider.constructor.name);
  
  // Test a simple tool call
  const messages = [
    { role: 'user' as const, content: [{ type: 'text' as const, text: 'Use the list_directory tool to list files in the current directory' }] }
  ];
  
  const tools = [{
    type: 'function' as const,
    function: {
      name: 'list_directory',
      description: 'List files at a directory path',
      parameters: {
        type: 'object',
        properties: {
          dirPath: { type: 'string', description: 'Directory path to list' }
        },
        required: ['dirPath']
      }
    }
  }];
  
  const result = await provider.complete(messages, {
    model: rawModelId,
    tools,
    sessionId: 'test-session' as any,
  });
  
  console.log('\n=== RESULT ===');
  console.log('Stop reason:', result.stopReason);
  console.log('Content types:', result.content.map((c: any) => c.type));
  console.log('Has tool_use:', result.content.some((c: any) => c.type === 'tool_use'));
  
  const hasToolCalls = result.content.some((c: any) => c.type === 'tool_use');
  if (hasToolCalls && result.stopReason !== 'tool_use') {
    console.log('\n*** BUG CONFIRMED: Tool calls present but stopReason is:', result.stopReason);
  } else {
    console.log('\nOK: stopReason is correct');
  }
  
  process.exit(0);
}

test().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
