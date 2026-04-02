// ============================================================================
// MCPManager v2 - Enhanced Model Context Protocol server management
// Adds: namespace isolation, notification handling, reconnection, resource support
// ============================================================================

import { spawn, type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import type { ToolDefinition } from '../types/tools.js';
import { McpError } from '../types/errors.js';

export interface McpServerConfig {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  enabled?: boolean;
  timeout?: number;
  /** Transport type: stdio (default) or http/sse (future) */
  transport?: 'stdio' | 'http' | 'sse';
  /** HTTP URL for http/sse transport */
  url?: string;
  /** Headers for HTTP transport */
  headers?: Record<string, string>;
  /** Auto-reconnect on disconnect */
  autoReconnect?: boolean;
  /** Reconnect interval in ms (default: 5000) */
  reconnectInterval?: number;
  /** Maximum reconnect attempts (default: 3) */
  maxReconnectAttempts?: number;
}

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface McpResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface McpNotification {
  method: string;
  params?: Record<string, unknown>;
}

export interface McpServerStatus {
  name: string;
  toolCount: number;
  resourceCount: number;
  connected: boolean;
  reconnectAttempts: number;
  lastError?: string;
  lastActivity: number;
}

type JsonRpcMessage = {
  jsonrpc: '2.0';
  id?: number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
};

// --- MCP Client with namespace isolation ---

interface McpClientEntry {
  process: ChildProcess;
  tools: McpToolDefinition[];
  resources: McpResource[];
  connected: boolean;
  requestId: number;
  pendingRequests: Map<number, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }>;
  buffer: string;
  reconnectAttempts: number;
  lastActivity: number;
  lastError?: string;
}

// --- Enhanced McpManager ---

export class McpManager extends EventEmitter {
  private servers = new Map<string, McpClientEntry>();
  private configs = new Map<string, McpServerConfig>();
  private toolServerMap = new Map<string, string>(); // toolName -> serverName

  /** Connect to an MCP server */
  async connect(config: McpServerConfig): Promise<ToolDefinition[]> {
    if (this.servers.has(config.name)) {
      const existing = this.servers.get(config.name)!;
      if (existing.connected) {
        return this.getToolsForServer(config.name);
      }
      // Server exists but disconnected, try reconnect
      await this.disconnect(config.name);
    }

    // Validate config
    if (!config.command && config.transport !== 'http' && config.transport !== 'sse') {
      throw new McpError(`MCP server "${config.name}": command is required for stdio transport`, config.name);
    }

    this.configs.set(config.name, {
      transport: 'stdio',
      autoReconnect: true,
      reconnectInterval: 5000,
      maxReconnectAttempts: 3,
      ...config,
    });

    // Connect with spawn error handling
    let processRef: any = null;
    try {
      const entry = await this.createClient(config);
      processRef = entry.process;
      this.servers.set(config.name, entry);

      // Set up event handler for auto-reconnect on exit
      entry.process.on('exit', () => {
        this.handleDisconnect(config.name);
      });
      // Set up error handler for runtime process errors
      entry.process.on('error', (err: Error) => {
        this.handleProcessError(config.name, err);
      });

      const tools = this.getToolsForServer(config.name);
      this.emit('connected', { serverName: config.name, toolCount: tools.length });
      return tools;
    } catch (err) {
      // If process was spawned but init failed, clean up
      if (processRef) {
        try { processRef.kill(); } catch {}
      }
      throw new McpError(
        `Failed to connect to MCP server "${config.name}": ${(err as Error).message}`,
        config.name
      );
    }
  }

  /** Call a tool on a specific MCP server */
  async callTool(serverName: string, toolName: string, input: Record<string, unknown>): Promise<string> {
    const entry = this.servers.get(serverName);
    if (!entry) {
      throw new McpError(`MCP server "${serverName}" not found`, serverName);
    }
    if (!entry.connected) {
      throw new McpError(`MCP server "${serverName}" is not connected`, serverName);
    }

    try {
      const result = await this.sendJsonRpc(entry, 'tools/call', {
        name: toolName,
        arguments: input,
      });
      entry.lastActivity = Date.now();
      return JSON.stringify(result);
    } catch (err) {
      throw new McpError(
        `MCP tool call failed on "${serverName}": ${(err as Error).message}`,
        serverName
      );
    }
  }

  /**
   * Call a tool by its namespaced name (e.g., "filesystem:read_file").
   * Automatically resolves the server.
   */
  async callToolByNamespacedName(namespacedName: string, input: Record<string, unknown>): Promise<string> {
    const colonIdx = namespacedName.indexOf(':');
    if (colonIdx < 0) {
      throw new McpError(`Invalid namespaced tool name "${namespacedName}", expected format "server:tool"`, 'unknown');
    }

    const serverName = namespacedName.slice(0, colonIdx);
    const toolName = namespacedName.slice(colonIdx + 1);

    // Check tool-server map first
    const mappedServer = this.toolServerMap.get(namespacedName);
    if (mappedServer) {
      return this.callTool(mappedServer, toolName, input);
    }

    // Fallback: try the server name extracted from the namespace
    return this.callTool(serverName, toolName, input);
  }

  /** Read a resource from an MCP server */
  async readResource(serverName: string, uri: string): Promise<{ contents: Array<{ uri: string; mimeType?: string; text?: string; blob?: string }> }> {
    const entry = this.servers.get(serverName);
    if (!entry || !entry.connected) {
      throw new McpError(`MCP server "${serverName}" not connected`, serverName);
    }

    const result = await this.sendJsonRpc(entry, 'resources/read', { uri });
    entry.lastActivity = Date.now();
    return result as any;
  }

  /** List available resources from an MCP server */
  async listResources(serverName: string): Promise<McpResource[]> {
    const entry = this.servers.get(serverName);
    if (!entry || !entry.connected) {
      return [];
    }

    try {
      const result = await this.sendJsonRpc(entry, 'resources/list', {});
      entry.resources = (result as any)?.resources || [];
      return entry.resources;
    } catch {
      return [];
    }
  }

  /** Subscribe to resource changes */
  async subscribeResource(serverName: string, uri: string): Promise<void> {
    const entry = this.servers.get(serverName);
    if (!entry || !entry.connected) {
      throw new McpError(`MCP server "${serverName}" not connected`, serverName);
    }

    await this.sendJsonRpc(entry, 'resources/subscribe', { uri });
    entry.lastActivity = Date.now();
  }

  /** Disconnect from an MCP server */
  async disconnect(serverName: string): Promise<void> {
    const entry = this.servers.get(serverName);
    if (entry) {
      try {
        // Try graceful shutdown via notification
        if (entry.process.stdin && !entry.process.stdin.destroyed) {
          entry.process.stdin.write(JSON.stringify({
            jsonrpc: '2.0',
            method: 'notifications/cancelled',
            params: {},
          }) + '\n');
        }
      } catch {
        // Ignore write errors during shutdown
      }

      // Clean up pending requests
      for (const [, pending] of entry.pendingRequests) {
        clearTimeout(pending.timer);
        pending.reject(new Error('Server disconnected'));
      }

      try {
        entry.process.kill();
      } catch {
        // Process may have already exited
      }
      this.servers.delete(serverName);
    }
  }

  /** Disconnect from all servers */
  async disconnectAll(): Promise<void> {
    const names = Array.from(this.servers.keys());
    await Promise.all(names.map((name) => this.disconnect(name)));
  }

  /** List connected servers with status */
  listServers(): McpServerStatus[] {
    return Array.from(this.servers.entries()).map(([name, entry]) => ({
      name,
      toolCount: entry.tools.length,
      resourceCount: entry.resources.length,
      connected: entry.connected,
      reconnectAttempts: entry.reconnectAttempts,
      lastError: entry.lastError,
      lastActivity: entry.lastActivity,
    }));
  }

  /**
   * Get all tools from all connected servers, with namespace isolation.
   * Tool names are prefixed with "server:" to avoid conflicts.
   */
  getAllTools(): ToolDefinition[] {
    const allTools: ToolDefinition[] = [];

    for (const [serverName, entry] of this.servers) {
      if (!entry.connected) continue;

      for (const mcpTool of entry.tools) {
        const namespacedName = `${serverName}:${mcpTool.name}`;
        const tool: ToolDefinition = {
          name: namespacedName,
          description: `[${serverName}] ${mcpTool.description}`,
          category: 'mcp',
          inputSchema: mcpTool.inputSchema,
          requiresApproval: true,
          riskLevel: 'medium',
          tags: ['mcp', serverName],
        };
        allTools.push(tool);
        this.toolServerMap.set(namespacedName, serverName);
      }
    }

    return allTools;
  }

  /** Get tools for a specific server (without namespace prefix) */
  getToolsForServer(serverName: string): ToolDefinition[] {
    const entry = this.servers.get(serverName);
    if (!entry) return [];

    return entry.tools.map((mcpTool) => ({
      name: mcpTool.name,
      description: mcpTool.description,
      category: 'mcp' as const,
      inputSchema: mcpTool.inputSchema,
      requiresApproval: true,
      riskLevel: 'medium' as const,
      tags: ['mcp', serverName],
    }));
  }

  // ========================================================================
  // Private: Client Lifecycle
  // ========================================================================

  private async createClient(config: McpServerConfig): Promise<McpClientEntry> {
    let proc: any;
    try {
      proc = spawn(config.command, config.args || [], {
        env: { ...process.env, ...config.env },
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      });
    } catch (err) {
      throw new McpError(
        `Failed to spawn MCP server "${config.name}": ${(err as Error).message}`,
        config.name
      );
    }

    const entry: McpClientEntry = {
      process: proc,
      tools: [],
      resources: [],
      connected: false,
      requestId: 0,
      pendingRequests: new Map(),
      buffer: '',
      reconnectAttempts: 0,
      lastActivity: Date.now(),
    };

    // Set up stdout handler
    proc.stdout?.on('data', (data: Buffer) => {
      this.handleStdoutData(entry, data);
    });

    proc.stderr?.on('data', (data: Buffer) => {
      // MCP servers may log to stderr
      const text = data.toString().trim();
      if (text) {
        this.emit('stderr', { serverName: config.name, data: text });
      }
    });

    // Initialize the connection - use Promise.race to handle async spawn errors (e.g., ENOENT)
    const timeout = config.timeout || 15000;
    const initPromise = this.initializeConnection(entry, timeout);
    const spawnErrorPromise = new Promise<never>((_, reject) => {
      proc.on('error', (err: Error) => {
        reject(new McpError(
          `Failed to spawn MCP server "${config.name}": ${err.message}`,
          config.name
        ));
      });
    });

    await Promise.race([initPromise, spawnErrorPromise]);

    entry.connected = true;
    return entry;
  }

  private async initializeConnection(entry: McpClientEntry, timeout: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        entry.process.kill();
        reject(new McpError('MCP server initialization timed out'));
      }, timeout);

      let initReceived = false;
      let toolsReceived = false;

      const completionHandler = () => {
        if (initReceived && toolsReceived) {
          clearTimeout(timer);
          resolve();
        }
      };

      // Override stdout handler during initialization
      const originalHandler = entry.process.stdout?.listeners('data');
      // Remove existing listeners
      for (const listener of (originalHandler || [])) {
        entry.process.stdout?.removeListener('data', listener as (...args: any[]) => void);
      }

      entry.process.stdout?.on('data', (data: Buffer) => {
        entry.buffer += data.toString();
        const lines = entry.buffer.split('\n');
        entry.buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const response: JsonRpcMessage = JSON.parse(line);

            if (!initReceived && response.id === 1 && response.result) {
              initReceived = true;

              // Send tools/list request
              const toolsRequest: JsonRpcMessage = {
                jsonrpc: '2.0',
                id: 2,
                method: 'tools/list',
                params: {},
              };
              entry.process.stdin?.write(JSON.stringify(toolsRequest) + '\n');
              completionHandler();
            } else if (!toolsReceived && response.id === 2 && response.result) {
              toolsReceived = true;
              entry.tools = (response.result as any)?.tools || [];
              completionHandler();

              // Also request resources/list
              const resourcesRequest: JsonRpcMessage = {
                jsonrpc: '2.0',
                id: 3,
                method: 'resources/list',
                params: {},
              };
              entry.process.stdin?.write(JSON.stringify(resourcesRequest) + '\n');
            } else if (response.id === 3 && response.result) {
              entry.resources = (response.result as any)?.resources || [];

              // Restore normal data handler
              for (const listener of (originalHandler || [])) {
                entry.process.stdout?.on('data', listener as (...args: any[]) => void);
              }
              // Remove our temp listener
              entry.process.stdout?.removeAllListeners('data');
              for (const listener of (originalHandler || [])) {
                entry.process.stdout?.on('data', listener as (...args: any[]) => void);
              }
            } else if (response.id && entry.pendingRequests.has(response.id)) {
              // Route to pending request handler
              const pending = entry.pendingRequests.get(response.id)!;
              clearTimeout(pending.timer);
              entry.pendingRequests.delete(response.id);

              if (response.error) {
                pending.reject(new Error(response.error.message));
              } else {
                pending.resolve(response.result);
              }
            } else if (!response.id && response.method) {
              // This is a notification from the server
              this.handleNotification(entry, response);
            }
          } catch {
            // Ignore unparseable lines
          }
        }
      });

      // Send initialize request
      const initRequest: JsonRpcMessage = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {},
            resources: { subscribe: true },
            prompts: {},
          },
          clientInfo: { name: 'nova-cli', version: '0.2.0' },
        },
      };
      entry.process.stdin?.write(JSON.stringify(initRequest) + '\n');
    });
  }

  private handleStdoutData(entry: McpClientEntry, data: Buffer): void {
    entry.buffer += data.toString();
    const lines = entry.buffer.split('\n');
    entry.buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const response: JsonRpcMessage = JSON.parse(line);

        if (response.id && entry.pendingRequests.has(response.id)) {
          const pending = entry.pendingRequests.get(response.id)!;
          clearTimeout(pending.timer);
          entry.pendingRequests.delete(response.id);

          if (response.error) {
            pending.reject(new Error(response.error.message));
          } else {
            pending.resolve(response.result);
          }
        } else if (!response.id) {
          // Notification from server
          this.handleNotification(entry, response);
        }
      } catch {
        // Ignore unparseable lines
      }
    }
  }

  private handleNotification(entry: McpClientEntry, notification: JsonRpcMessage): void {
    const method = notification.method || '';
    entry.lastActivity = Date.now();

    // Handle resource update notifications
    if (method === 'notifications/resources/updated') {
      const uri = (notification.params as any)?.uri;
      this.emit('resource-updated', { serverName: '', uri }); // Would need serverName from entry
      // Refresh resources list
      this.listResources('').catch(() => {}); // Best effort
    }

    // Emit generic notification event
    this.emit('notification', {
      method,
      params: notification.params,
    });
  }

  private handleDisconnect(serverName: string): void {
    const entry = this.servers.get(serverName);
    if (!entry) return;

    entry.connected = false;
    this.emit('disconnected', { serverName });

    // Try auto-reconnect
    const config = this.configs.get(serverName);
    if (config?.autoReconnect && entry.reconnectAttempts < (config.maxReconnectAttempts || 3)) {
      entry.reconnectAttempts++;
      entry.lastError = `Process exited unexpectedly (attempt ${entry.reconnectAttempts})`;

      const interval = config.reconnectInterval || 5000;
      this.emit('reconnecting', {
        serverName,
        attempt: entry.reconnectAttempts,
        maxAttempts: config.maxReconnectAttempts || 3,
      });

      setTimeout(async () => {
        try {
          await this.disconnect(serverName);
          const newEntry = await this.createClient(config);
          newEntry.reconnectAttempts = entry.reconnectAttempts;
          this.servers.set(serverName, newEntry);

          newEntry.process.on('exit', () => this.handleDisconnect(serverName));
          newEntry.process.on('error', (err) => this.handleProcessError(serverName, err));

          this.emit('reconnected', { serverName, toolCount: newEntry.tools.length });
        } catch (err) {
          this.emit('reconnect-failed', {
            serverName,
            error: (err as Error).message,
            attempt: entry.reconnectAttempts,
          });
        }
      }, interval);
    }
  }

  private handleProcessError(serverName: string, err: Error): void {
    const entry = this.servers.get(serverName);
    if (entry) {
      entry.lastError = err.message;
    }
    // Use 'serverError' instead of 'error' to avoid EventEmitter unhandled error crash
    this.emit('serverError', { serverName, error: err.message });
  }

  // ========================================================================
  // Private: JSON-RPC
  // ========================================================================

  private sendJsonRpc(entry: McpClientEntry, method: string, params: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = ++entry.requestId;
      const request: JsonRpcMessage = { jsonrpc: '2.0', id, method, params };

      const timer = setTimeout(() => {
        entry.pendingRequests.delete(id);
        reject(new Error(`MCP request "${method}" timed out after 30s`));
      }, 30000);

      entry.pendingRequests.set(id, { resolve, reject, timer });

      if (!entry.process.stdin || entry.process.stdin.destroyed) {
        clearTimeout(timer);
        entry.pendingRequests.delete(id);
        reject(new Error('MCP server process stdin is closed'));
        return;
      }

      entry.process.stdin.write(JSON.stringify(request) + '\n');
    });
  }
}
