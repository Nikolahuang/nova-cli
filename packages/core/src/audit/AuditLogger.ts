// ============================================================================
// AuditLogger - Comprehensive audit logging system
// ============================================================================

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createLogger } from '../utils/Logger.js';
import { generateId } from '../utils/helpers.js';

const logger = createLogger('AuditLogger');

// ============================================================================
// Types
// ============================================================================

/**
 * Audit action types
 */
export type AuditAction = 
  | 'tool_use'
  | 'file_read'
  | 'file_write'
  | 'file_delete'
  | 'command_exec'
  | 'model_call'
  | 'session_start'
  | 'session_end'
  | 'approval_granted'
  | 'approval_denied'
  | 'config_change'
  | 'auth_change';

/**
 * Audit log entry
 */
export interface AuditEntry {
  id: string;
  timestamp: Date;
  action: AuditAction;
  actor: 'user' | 'agent' | 'system';
  resource: string;
  result: 'success' | 'denied' | 'error' | 'timeout';
  sessionId?: string;
  metadata: {
    model?: string;
    provider?: string;
    tokens?: { input: number; output: number };
    duration?: number;
    reason?: string;
    error?: string;
    input?: Record<string, unknown>;
    output?: string;
    diff?: string;
    ip?: string;
    userAgent?: string;
  };
}

/**
 * Audit query filter
 */
export interface AuditFilter {
  startTime?: Date;
  endTime?: Date;
  actions?: AuditAction[];
  actors?: ('user' | 'agent' | 'system')[];
  results?: AuditEntry['result'][];
  sessionId?: string;
  resourcePattern?: string;
}

/**
 * Audit configuration
 */
export interface AuditConfig {
  /** Log file path */
  logFile: string;
  /** Maximum log file size in bytes (default 10MB) */
  maxFileSize?: number;
  /** Maximum number of log files to keep (default 10) */
  maxFiles?: number;
  /** Whether to log to console (default false) */
  console?: boolean;
  /** Minimum log level */
  minLevel?: 'debug' | 'info' | 'warn' | 'error';
}

// ============================================================================
// AuditLogger
// ============================================================================

/**
 * Comprehensive audit logging system
 */
export class AuditLogger {
  private config: Required<AuditConfig>;
  private writeQueue: AuditEntry[] = [];
  private isWriting = false;
  private flushInterval: NodeJS.Timeout | null = null;
  
  constructor(config: AuditConfig) {
    this.config = {
      maxFileSize: config.maxFileSize ?? 10 * 1024 * 1024,  // 10MB
      maxFiles: config.maxFiles ?? 10,
      console: config.console ?? false,
      minLevel: config.minLevel ?? 'info',
      ...config,
    };
    
    // Ensure log directory exists
    const logDir = path.dirname(this.config.logFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    // Start periodic flush
    this.flushInterval = setInterval(() => this.flush(), 5000);
    
    // Flush on exit
    process.on('beforeExit', () => this.flush());
  }
  
  // -----------------------------------------------------------------------
  // Core Logging
  // -----------------------------------------------------------------------
  
  /**
   * Log an audit entry
   */
  async log(entry: Omit<AuditEntry, 'id' | 'timestamp'>): Promise<AuditEntry> {
    const fullEntry: AuditEntry = {
      ...entry,
      id: generateId(),
      timestamp: new Date(),
    };
    
    // Add to write queue
    this.writeQueue.push(fullEntry);
    
    // Console output
    if (this.config.console) {
      this.logToConsole(fullEntry);
    }
    
    // Flush if queue is getting large
    if (this.writeQueue.length >= 100) {
      await this.flush();
    }
    
    return fullEntry;
  }
  
  /**
   * Log a tool use event
   */
  async logToolUse(
    toolName: string,
    input: Record<string, unknown>,
    result: AuditEntry['result'],
    metadata: Partial<AuditEntry['metadata']> = {}
  ): Promise<AuditEntry> {
    return this.log({
      action: 'tool_use',
      actor: 'agent',
      resource: toolName,
      result,
      metadata: {
        input,
        ...metadata,
      },
    });
  }
  
  /**
   * Log a file operation
   */
  async logFileOperation(
    operation: 'file_read' | 'file_write' | 'file_delete',
    filePath: string,
    result: AuditEntry['result'],
    metadata: Partial<AuditEntry['metadata']> = {}
  ): Promise<AuditEntry> {
    return this.log({
      action: operation,
      actor: 'agent',
      resource: filePath,
      result,
      metadata,
    });
  }
  
  /**
   * Log a command execution
   */
  async logCommand(
    command: string,
    result: AuditEntry['result'],
    metadata: Partial<AuditEntry['metadata']> = {}
  ): Promise<AuditEntry> {
    return this.log({
      action: 'command_exec',
      actor: 'agent',
      resource: command,
      result,
      metadata,
    });
  }
  
  /**
   * Log a model API call
   */
  async logModelCall(
    model: string,
    provider: string,
    result: AuditEntry['result'],
    metadata: Partial<AuditEntry['metadata']> = {}
  ): Promise<AuditEntry> {
    return this.log({
      action: 'model_call',
      actor: 'agent',
      resource: `${provider}/${model}`,
      result,
      metadata: {
        model,
        provider,
        ...metadata,
      },
    });
  }
  
  /**
   * Log an approval decision
   */
  async logApproval(
    resource: string,
    granted: boolean,
    reason?: string
  ): Promise<AuditEntry> {
    return this.log({
      action: granted ? 'approval_granted' : 'approval_denied',
      actor: 'user',
      resource,
      result: granted ? 'success' : 'denied',
      metadata: { reason },
    });
  }
  
  /**
   * Log a session event
   */
  async logSessionEvent(
    event: 'session_start' | 'session_end',
    sessionId: string,
    metadata: Partial<AuditEntry['metadata']> = {}
  ): Promise<AuditEntry> {
    return this.log({
      action: event,
      actor: 'system',
      resource: sessionId,
      result: 'success',
      sessionId,
      metadata,
    });
  }
  
  // -----------------------------------------------------------------------
  // Querying
  // -----------------------------------------------------------------------
  
  /**
   * Query audit logs
   */
  async query(filter: AuditFilter = {}): Promise<AuditEntry[]> {
    await this.flush();  // Ensure all entries are written
    
    const entries: AuditEntry[] = [];
    
    try {
      // Read all log files
      const logDir = path.dirname(this.config.logFile);
      const baseName = path.basename(this.config.logFile, '.jsonl');
      const files = fs.readdirSync(logDir)
        .filter(f => f.startsWith(baseName))
        .sort()
        .reverse();  // Most recent first
      
      for (const file of files) {
        const filePath = path.join(logDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n').filter(l => l.trim());
        
        for (const line of lines) {
          try {
            const entry = JSON.parse(line) as AuditEntry;
            entry.timestamp = new Date(entry.timestamp);
            
            if (this.matchesFilter(entry, filter)) {
              entries.push(entry);
            }
          } catch {
            // Skip malformed lines
          }
        }
      }
    } catch (error) {
      logger.error('Failed to query audit logs', { error });
    }
    
    return entries;
  }
  
  /**
   * Check if entry matches filter
   */
  private matchesFilter(entry: AuditEntry, filter: AuditFilter): boolean {
    if (filter.startTime && entry.timestamp < filter.startTime) return false;
    if (filter.endTime && entry.timestamp > filter.endTime) return false;
    if (filter.actions && !filter.actions.includes(entry.action)) return false;
    if (filter.actors && !filter.actors.includes(entry.actor)) return false;
    if (filter.results && !filter.results.includes(entry.result)) return false;
    if (filter.sessionId && entry.sessionId !== filter.sessionId) return false;
    if (filter.resourcePattern && !entry.resource.match(new RegExp(filter.resourcePattern, 'i'))) return false;
    
    return true;
  }
  
  // -----------------------------------------------------------------------
  // Export
  // -----------------------------------------------------------------------
  
  /**
   * Export logs in various formats
   */
  async export(format: 'json' | 'csv' | 'txt', filter: AuditFilter = {}): Promise<string> {
    const entries = await this.query(filter);
    
    if (format === 'json') {
      return JSON.stringify(entries, null, 2);
    }
    
    if (format === 'csv') {
      const headers = ['id', 'timestamp', 'action', 'actor', 'resource', 'result', 'sessionId'];
      const rows = entries.map(e => [
        e.id,
        e.timestamp.toISOString(),
        e.action,
        e.actor,
        `"${e.resource.replace(/"/g, '""')}"`,
        e.result,
        e.sessionId ?? '',
      ].join(','));
      return [headers.join(','), ...rows].join('\n');
    }
    
    // format === 'txt'
    return entries.map(e => {
      const time = e.timestamp.toISOString();
      return `[${time}] ${e.action.toUpperCase()} ${e.actor} ${e.resource} (${e.result})`;
    }).join('\n');
  }
  
  // -----------------------------------------------------------------------
  // Maintenance
  // -----------------------------------------------------------------------
  
  /**
   * Flush write queue to disk
   */
  async flush(): Promise<void> {
    if (this.isWriting || this.writeQueue.length === 0) return;
    
    this.isWriting = true;
    const entries = [...this.writeQueue];
    this.writeQueue = [];
    
    try {
      // Check if log rotation is needed
      await this.rotateIfNeeded();
      
      // Append entries
      const lines = entries.map(e => JSON.stringify(e)).join('\n') + '\n';
      fs.appendFileSync(this.config.logFile, lines, 'utf-8');
      
      logger.debug(`Flushed ${entries.length} audit entries`);
    } catch (error) {
      logger.error('Failed to flush audit entries', { error });
      // Put entries back in queue
      this.writeQueue.unshift(...entries);
    } finally {
      this.isWriting = false;
    }
  }
  
  /**
   * Rotate log file if needed
   */
  private async rotateIfNeeded(): Promise<void> {
    try {
      if (!fs.existsSync(this.config.logFile)) return;
      
      const stats = fs.statSync(this.config.logFile);
      
      if (stats.size >= this.config.maxFileSize) {
        const logDir = path.dirname(this.config.logFile);
        const baseName = path.basename(this.config.logFile, '.jsonl');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const newName = `${baseName}.${timestamp}.jsonl`;
        
        fs.renameSync(this.config.logFile, path.join(logDir, newName));
        
        // Clean up old files
        const files = fs.readdirSync(logDir)
          .filter(f => f.startsWith(baseName) && f.endsWith('.jsonl'))
          .sort();
        
        while (files.length > this.config.maxFiles) {
          const oldFile = files.shift()!;
          fs.unlinkSync(path.join(logDir, oldFile));
          logger.debug(`Deleted old audit log: ${oldFile}`);
        }
        
        logger.info(`Rotated audit log to ${newName}`);
      }
    } catch (error) {
      logger.error('Failed to rotate audit log', { error });
    }
  }
  
  /**
   * Get statistics about the audit log
   */
  async getStats(): Promise<{
    totalEntries: number;
    oldestEntry: Date | null;
    newestEntry: Date | null;
    byAction: Record<string, number>;
    byResult: Record<string, number>;
  }> {
    const entries = await this.query();
    
    const byAction: Record<string, number> = {};
    const byResult: Record<string, number> = {};
    let oldest: Date | null = null;
    let newest: Date | null = null;
    
    for (const entry of entries) {
      byAction[entry.action] = (byAction[entry.action] ?? 0) + 1;
      byResult[entry.result] = (byResult[entry.result] ?? 0) + 1;
      
      if (!oldest || entry.timestamp < oldest) oldest = entry.timestamp;
      if (!newest || entry.timestamp > newest) newest = entry.timestamp;
    }
    
    return {
      totalEntries: entries.length,
      oldestEntry: oldest,
      newestEntry: newest,
      byAction,
      byResult,
    };
  }
  
  /**
   * Log to console
   */
  private logToConsole(entry: AuditEntry): void {
    const time = entry.timestamp.toISOString();
    const level = entry.result === 'error' ? 'error' : entry.result === 'denied' ? 'warn' : 'info';
    const message = `[AUDIT] ${time} ${entry.action} ${entry.actor} ${entry.resource} (${entry.result})`;
    
    switch (level) {
      case 'error':
        console.error(message);
        break;
      case 'warn':
        console.warn(message);
        break;
      default:
        console.log(message);
    }
  }
  
  /**
   * Shutdown the logger
   */
  shutdown(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    this.flush();
  }
}

// ============================================================================
// Factory function
// ============================================================================

/**
 * Create an audit logger with default configuration
 */
export function createAuditLogger(
  storageDir?: string
): AuditLogger {
  const defaultDir = storageDir ?? path.join(process.env.HOME ?? '~', '.nova', 'logs');
  return new AuditLogger({
    logFile: path.join(defaultDir, 'audit.jsonl'),
  });
}
