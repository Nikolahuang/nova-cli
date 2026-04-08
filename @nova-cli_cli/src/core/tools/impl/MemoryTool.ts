import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import type { ToolHandler, ToolHandlerInput, ToolHandlerOutput } from '../../types/tools.js';

interface MemoryStore {
  _data: Record<string, { value: string; expires?: number; tags?: string[]; createdAt: number }>;
}

function getMemoryPath(scope: string): string {
  const homeDir = os.homedir();
  switch (scope) {
    case 'global':
      return path.join(homeDir, '.nova', 'memory.json');
    case 'project':
      return path.join(process.cwd(), '.nova', 'memory.json');
    case 'session':
    default:
      return path.join(os.tmpdir(), 'nova-memory', `session-${process.pid}.json`);
  }
}

async function loadStore(scope: string): Promise<MemoryStore> {
  const filePath = getMemoryPath(scope);
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data) as MemoryStore;
  } catch {
    return { _data: {} };
  }
}

async function saveStore(scope: string, store: MemoryStore): Promise<void> {
  const filePath = getMemoryPath(scope);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(store, null, 2), 'utf-8');
}

export const memoryReadHandler: ToolHandler = async (input: ToolHandlerInput): Promise<ToolHandlerOutput> => {
  const { key, scope = 'session' } = input.params as { key: string; scope?: string };

  const store = await loadStore(scope);
  const entry = store._data[key];

  if (!entry) {
    return {
      content: `No memory entry found for key: "${key}" (scope: ${scope})`,
      metadata: { key, scope, found: false },
    };
  }

  // Check TTL
  if (entry.expires && Date.now() > entry.expires) {
    delete store._data[key];
    await saveStore(scope, store);
    return {
      content: `Memory entry "${key}" has expired`,
      metadata: { key, scope, found: false, expired: true },
    };
  }

  return {
    content: entry.value,
    metadata: {
      key,
      scope,
      found: true,
      tags: entry.tags,
      createdAt: entry.createdAt,
      expires: entry.expires,
    },
  };
};

export const memoryWriteHandler: ToolHandler = async (input: ToolHandlerInput): Promise<ToolHandlerOutput> => {
  const { key, value, scope = 'session', ttl, tags } = input.params as {
    key: string;
    value: string;
    scope?: string;
    ttl?: number;
    tags?: string[];
  };

  const store = await loadStore(scope);
  const exists = !!store._data[key];

  store._data[key] = {
    value,
    expires: ttl ? Date.now() + ttl : undefined,
    tags,
    createdAt: exists ? (store._data[key]?.createdAt ?? Date.now()) : Date.now(),
  };

  await saveStore(scope, store);

  return {
    content: exists
      ? `Updated memory entry "${key}" (scope: ${scope})`
      : `Created memory entry "${key}" (scope: ${scope})`,
    metadata: { key, scope, updated: exists, ttl, tags },
  };
};
