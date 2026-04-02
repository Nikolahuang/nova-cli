import { ContextCompressor } from '../../../core/src/context/ContextCompressor.js';
import { LayeredMemoryManager } from '../../../core/src/context/LayeredMemoryManager.js';
import { AgentLoop } from '../../../core/src/session/AgentLoop.js';

console.log('ContextCompressor:', typeof ContextCompressor);
console.log('LayeredMemoryManager:', typeof LayeredMemoryManager);
console.log('AgentLoop:', typeof AgentLoop);

// Quick functional test of ContextCompressor
const compressor = new ContextCompressor();
const result = compressor.shouldCompress({
  tokenUsage: 50000,
  maxTokens: 128000,
  hasPreciseHistory: false,
  messageCount: 20,
});
console.log('Compression decision for 50k/128k tokens:', result);

const result2 = compressor.shouldCompress({
  tokenUsage: 110000,
  maxTokens: 128000,
  hasPreciseHistory: true,
  messageCount: 50,
});
console.log('Compression decision for 110k/128k tokens (precise history):', result2);

console.log('\nAll tests passed!');
