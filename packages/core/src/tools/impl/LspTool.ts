// ============================================================================
// LspTool - Language Server Protocol integration
// Provides: goto_definition, find_references, hover, rename, diagnostics
// ============================================================================

import type { ToolHandler, ToolHandlerInput, ToolHandlerOutput } from '../../types/tools.js';
import { spawn, ChildProcess } from 'node:child_process';

export interface LspToolInput {
  operation: 'goto_definition' | 'find_references' | 'hover' | 'rename' | 'diagnostics' | 'completion';
  file: string;
  line: number;  // 0-based
  character: number;  // 0-based
  newName?: string;  // for rename operation
}

export interface LspResult {
  success: boolean;
  operation: string;
  result?: any;
  error?: string;
}

// LSP client cache
const lspClients = new Map<string, LspClient>();

class LspClient {
  private process: ChildProcess | null = null;
  private initialized = false;
  private pendingRequests: Map<number, { resolve: Function; reject: Function }> = new Map();
  private requestId = 0;
  private capabilities: any = {};

  constructor(private languageId: string, private command: string, private args: string[] = []) {}

  async initialize(rootPath: string): Promise<void> {
    if (this.initialized) return;

    // Start LSP server process
    this.process = spawn(this.command, this.args, {
      cwd: rootPath,
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    });

    if (!this.process.stdin || !this.process.stdout) {
      throw new Error('Failed to create LSP server process');
    }

    // Set up message handling
    this.process.on('message', (message: any) => {
      if (message.id !== undefined && this.pendingRequests.has(message.id)) {
        const { resolve, reject } = this.pendingRequests.get(message.id)!;
        this.pendingRequests.delete(message.id);
        if (message.error) {
          reject(new Error(message.error.message || 'LSP error'));
        } else {
          resolve(message.result);
        }
      }
    });

    // Initialize LSP
    const initResult = await this.sendRequest('initialize', {
      processId: process.pid,
      rootUri: `file://${rootPath}`,
      capabilities: {
        textDocument: {
          definition: { linkSupport: true },
          references: true,
          hover: { contentFormat: ['markdown', 'plaintext'] },
          rename: { prepareSupport: true },
          completion: { completionItem: { snippetSupport: true } },
        },
      },
    });

    this.capabilities = initResult?.capabilities || {};
    this.initialized = true;
  }

  async sendRequest(method: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = ++this.requestId;
      this.pendingRequests.set(id, { resolve, reject });

      const message = JSON.stringify({
        jsonrpc: '2.0',
        id,
        method,
        params,
      });

      this.process?.stdin?.write(`Content-Length: ${message.length}\r\n\r\n${message}`);
    });
  }

  async gotoDefinition(uri: string, line: number, character: number): Promise<any> {
    return this.sendRequest('textDocument/definition', {
      textDocument: { uri },
      position: { line, character },
    });
  }

  async findReferences(uri: string, line: number, character: number): Promise<any> {
    return this.sendRequest('textDocument/references', {
      textDocument: { uri },
      position: { line, character },
      context: { includeDeclaration: true },
    });
  }

  async hover(uri: string, line: number, character: number): Promise<any> {
    return this.sendRequest('textDocument/hover', {
      textDocument: { uri },
      position: { line, character },
    });
  }

  async rename(uri: string, line: number, character: number, newName: string): Promise<any> {
    return this.sendRequest('textDocument/rename', {
      textDocument: { uri },
      position: { line, character },
      newName,
    });
  }

  async diagnostics(uri: string): Promise<any> {
    // Most LSP servers send diagnostics via notifications
    // This requests a refresh
    return this.sendRequest('textDocument/diagnostic', {
      textDocument: { uri },
    });
  }

  async shutdown(): Promise<void> {
    if (this.process) {
      await this.sendRequest('shutdown', {});
      this.process.kill();
      this.process = null;
      this.initialized = false;
    }
  }
}

function getLanguageServer(languageId: string): { command: string; args: string[] } | null {
  const servers: Record<string, { command: string; args: string[] }> = {
    typescript: { command: 'typescript-language-server', args: ['--stdio'] },
    javascript: { command: 'typescript-language-server', args: ['--stdio'] },
    typescriptreact: { command: 'typescript-language-server', args: ['--stdio'] },
    javascriptreact: { command: 'typescript-language-server', args: ['--stdio'] },
    python: { command: 'pylsp', args: [] },
    go: { command: 'gopls', args: [] },
    rust: { command: 'rust-analyzer', args: [] },
    java: { command: 'jdtls', args: [] },
    c: { command: 'clangd', args: [] },
    cpp: { command: 'clangd', args: [] },
    css: { command: 'css-languageserver', args: ['--stdio'] },
    html: { command: 'html-languageserver', args: ['--stdio'] },
    json: { command: 'vscode-json-languageserver', args: ['--stdio'] },
  };

  return servers[languageId] || null;
}

function detectLanguageId(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();
  const mappings: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescriptreact',
    js: 'javascript',
    jsx: 'javascriptreact',
    py: 'python',
    go: 'go',
    rs: 'rust',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    cc: 'cpp',
    h: 'c',
    hpp: 'cpp',
    css: 'css',
    html: 'html',
    json: 'json',
  };
  return mappings[ext || ''] || ext || 'text';
}

export const lspHandler: ToolHandler = async (input: ToolHandlerInput): Promise<ToolHandlerOutput> => {
  const params = input.params as unknown as LspToolInput;
  const { operation, file, line, character, newName } = params;

  try {
    const languageId = detectLanguageId(file);
    const serverConfig = getLanguageServer(languageId);

    if (!serverConfig) {
      return {
        content: JSON.stringify({
          success: false,
          error: `No LSP server configured for language: ${languageId}`,
        }),
      };
    }

    // Get or create LSP client
    const cacheKey = `${languageId}:${serverConfig.command}`;
    let client = lspClients.get(cacheKey);
    if (!client) {
      client = new LspClient(languageId, serverConfig.command, serverConfig.args);
      lspClients.set(cacheKey, client);
    }

    // Initialize if needed
    const rootPath = (input as any).workingDirectory || process.cwd();
    await client.initialize(rootPath);

    const uri = `file://${file}`;
    let result: any;

    switch (operation) {
      case 'goto_definition':
        result = await client.gotoDefinition(uri, line, character);
        break;
      case 'find_references':
        result = await client.findReferences(uri, line, character);
        break;
      case 'hover':
        result = await client.hover(uri, line, character);
        break;
      case 'rename':
        if (!newName) {
          return {
            content: JSON.stringify({
              success: false,
              error: 'newName is required for rename operation',
            }),
          };
        }
        result = await client.rename(uri, line, character, newName);
        break;
      case 'diagnostics':
        result = await client.diagnostics(uri);
        break;
      default:
        return {
          content: JSON.stringify({
            success: false,
            error: `Unknown operation: ${operation}`,
          }),
        };
    }

    return {
      content: JSON.stringify({
        success: true,
        operation,
        result: formatResult(result),
      }),
    };
  } catch (error) {
    return {
      content: JSON.stringify({
        success: false,
        operation,
        error: error instanceof Error ? error.message : String(error),
      }),
    };
  }
};

function formatResult(result: any): any {
  if (!result) return null;

  // Handle LocationLink[]
  if (Array.isArray(result)) {
    return result.map(loc => {
      if (loc.targetUri) {
        // LocationLink
        return {
          uri: loc.targetUri,
          range: loc.targetSelectionRange || loc.targetRange,
        };
      }
      // Location
      return {
        uri: loc.uri,
        range: loc.range,
      };
    });
  }

  // Handle Hover
  if (result.contents) {
    return {
      contents: typeof result.contents === 'string' 
        ? result.contents 
        : result.contents.value || result.contents,
      range: result.range,
    };
  }

  // Handle WorkspaceEdit (rename)
  if (result.changes) {
    return {
      changes: result.changes,
      documentChanges: result.documentChanges,
    };
  }

  return result;
}

export default lspHandler;
