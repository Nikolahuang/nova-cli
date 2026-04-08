// ============================================================================
// SessionManager - Manages session lifecycle and conversation state
// ============================================================================

import { v4 as uuidv4 } from 'uuid';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type {
  SessionId,
  MessageId,
  Message,
  Conversation,
  SessionConfig,
  SessionState,
  SessionEvent,
  ApprovalMode,
} from '../types/session.js';
import { createSessionId, createMessageId } from '../types/session.js';
import { SessionError, ContextOverflowError } from '../types/errors.js';

export type SessionListener<T = unknown> = (event: SessionEvent<T>) => void;

/** Serializable snapshot of a session for disk persistence */
export interface SessionSnapshot {
  id: string;
  config: SessionConfig;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  turnCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  title?: string;  // first user message (for listing)
  workingDirectory: string;
}

export class SessionManager {
  private sessions = new Map<SessionId, Session>();
  private listeners = new Map<string, Set<SessionListener>>();
  private persistDir: string;

  constructor(persistDir?: string) {
    this.persistDir = persistDir || path.join(os.homedir(), '.nova', 'sessions');
  }

  /** Create a new session */
  create(config: Partial<SessionConfig> & { workingDirectory: string }): Session {
    const id = createSessionId(uuidv4());
    const session: Session = {
      id,
      config: {
        id,
        model: config.model || 'claude-3-sonnet-20240229',
        maxTokens: config.maxTokens || 4096,
        temperature: config.temperature ?? 0.7,
        workingDirectory: config.workingDirectory,
        approvalMode: config.approvalMode || 'default',
        streaming: config.streaming ?? true,
        maxTurns: config.maxTurns || 100,
        systemPrompt: config.systemPrompt,
        name: config.name,
        tools: config.tools,
        mcpServers: config.mcpServers,
        hooks: config.hooks,
        metadata: config.metadata,
      },
      state: 'idle',
      conversation: {
        messages: [],
        context: {
          workingDirectory: config.workingDirectory,
          environment: {},
          sessionId: id,
          toolResults: new Map(),
        },
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      turnCount: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
    };

    this.sessions.set(id, session);
    this.emit(id, 'state_change', { from: undefined, to: 'idle' });
    return session;
  }

  /** Get a session by ID */
  get(id: SessionId): Session | undefined {
    return this.sessions.get(id);
  }

  /** Get all sessions */
  getAll(): Session[] {
    return Array.from(this.sessions.values());
  }

  /** Update session state */
  setState(id: SessionId, newState: SessionState): void {
    const session = this.sessions.get(id);
    if (!session) throw new SessionError(`Session not found: ${id}`, id);

    const oldState = session.state;
    session.state = newState;
    session.updatedAt = Date.now();

    this.emit(id, 'state_change', { from: oldState, to: newState });
  }

  /** Add a message to the conversation */
  addMessage(id: SessionId, role: Message['role'], content: Message['content']): Message {
    const session = this.sessions.get(id);
    if (!session) throw new SessionError(`Session not found: ${id}`, id);

    const message: Message = {
      id: createMessageId(uuidv4()),
      role,
      content,
      timestamp: Date.now(),
      createdAt: new Date(),
    };

    session.conversation.messages.push(message);
    session.updatedAt = Date.now();

    this.emit(id, 'message_added', { message });
    return message;
  }

  /** Get conversation messages */
  getMessages(id: SessionId): Message[] {
    const session = this.sessions.get(id);
    if (!session) throw new SessionError(`Session not found: ${id}`, id);
    return session.conversation.messages;
  }

  /** Get the conversation */
  getConversation(id: SessionId): Conversation {
    const session = this.sessions.get(id);
    if (!session) throw new SessionError(`Session not found: ${id}`, id);
    return session.conversation;
  }

  /** Increment turn counter */
  incrementTurn(id: SessionId): number {
    const session = this.sessions.get(id);
    if (!session) throw new SessionError(`Session not found: ${id}`, id);

    session.turnCount++;
    session.updatedAt = Date.now();

    // Check max turns
    if (session.config.maxTurns && session.turnCount >= session.config.maxTurns) {
      this.setState(id, 'completed');
    }

    return session.turnCount;
  }

  /** Update token usage */
  updateTokenUsage(id: SessionId, inputTokens: number, outputTokens: number): void {
    const session = this.sessions.get(id);
    if (!session) return;

    session.totalInputTokens += inputTokens;
    session.totalOutputTokens += outputTokens;
    session.updatedAt = Date.now();
  }

  /** Get session config */
  getConfig(id: SessionId): SessionConfig {
    const session = this.sessions.get(id);
    if (!session) throw new SessionError(`Session not found: ${id}`, id);
    return session.config;
  }

  /** Get session state */
  getState(id: SessionId): SessionState {
    const session = this.sessions.get(id);
    if (!session) throw new SessionError(`Session not found: ${id}`, id);
    return session.state;
  }

  /** Store a tool result in session context */
  storeToolResult(id: SessionId, key: string, value: unknown): void {
    const session = this.sessions.get(id);
    if (!session) return;
    session.conversation.context?.toolResults.set(key, value);
  }

  /** Get a stored tool result */
  getToolResult(id: SessionId, key: string): unknown {
    const session = this.sessions.get(id);
    return session?.conversation.context?.toolResults.get(key);
  }

  /** Truncate conversation to manage context window */
  truncateConversation(id: SessionId, maxMessages: number, keepSystemMessages: boolean = true): Message[] {
    const session = this.sessions.get(id);
    if (!session) throw new SessionError(`Session not found: ${id}`, id);

    const messages = session.conversation.messages;
    if (messages.length <= maxMessages) return [];

    // Keep system messages if requested
    const systemMessages = keepSystemMessages
      ? messages.filter((m) => m.role === 'system')
      : [];
    const nonSystemMessages = messages.filter((m) => m.role !== 'system');

    const removed = nonSystemMessages.slice(0, nonSystemMessages.length - maxMessages);
    const kept = nonSystemMessages.slice(nonSystemMessages.length - maxMessages);

    session.conversation.messages = [...systemMessages, ...kept];
    session.updatedAt = Date.now();

    this.emit(id, 'context_update', { removedCount: removed.length, keptCount: kept.length });
    return removed;
  }

  /** Update session environment variables */
  setEnvironment(id: SessionId, env: Record<string, string>): void {
    const session = this.sessions.get(id);
    if (!session) return;
    Object.assign(session.conversation.context?.environment || {}, env);
    session.updatedAt = Date.now();
  }

  /** Register an event listener */
  on<T = unknown>(id: SessionId, eventType: string, listener: SessionListener<T>): () => void {
    const key = `${id}:${eventType}`;
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(listener as SessionListener);

    return () => {
      this.listeners.get(key)?.delete(listener as SessionListener);
    };
  }

  /** Emit an event */
  private emit<T = unknown>(id: SessionId, eventType: string, data: T): void {
    const event: SessionEvent<T> = {
      type: eventType as Session['id'] extends string ? 'state_change' : never,
      sessionId: id,
      timestamp: Date.now(),
      data,
    };

    const key = `${id}:${eventType}`;
    const listeners = this.listeners.get(key);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(event);
        } catch {
          // Swallow listener errors
        }
      }
    }

    // Also emit to wildcard listeners
    const wildcardKey = `${id}:*`;
    const wildcardListeners = this.listeners.get(wildcardKey);
    if (wildcardListeners) {
      for (const listener of wildcardListeners) {
        try {
          listener(event);
        } catch {
          // Swallow listener errors
        }
      }
    }
  }

  /** Delete a session */
  delete(id: SessionId): boolean {
    return this.sessions.delete(id);
  }

  /** Get session statistics */
  getStats(id: SessionId) {
    const session = this.sessions.get(id);
    if (!session) return null;
    return {
      id: session.id,
      state: session.state,
      turnCount: session.turnCount,
      messageCount: session.conversation.messages.length,
      totalInputTokens: session.totalInputTokens,
      totalOutputTokens: session.totalOutputTokens,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }

  // ========================================================================
  // Persistence: save/load/list sessions to disk (~/.nova/sessions/)
  // ========================================================================

  private ensurePersistDir(): void {
    if (!fs.existsSync(this.persistDir)) {
      fs.mkdirSync(this.persistDir, { recursive: true });
    }
  }

  private sessionFilePath(id: string): string {
    return path.join(this.persistDir, `${id}.json`);
  }

  /** Save a session to disk. Called after every agent turn. */
  persist(id: SessionId): void {
    try {
      this.ensurePersistDir();
      const session = this.sessions.get(id);
      if (!session) return;

      // Determine title from first user message
      const firstUser = session.conversation.messages.find((m) => m.role === 'user');
      let title = 'New session';
      if (firstUser) {
        const c = firstUser.content;
        const text = typeof c === 'string' ? c : Array.isArray(c) ? c.map((b: any) => (b.type === 'text' ? b.text : '')).join('') : '';
        title = text.slice(0, 80).replace(/\n/g, ' ').trim() || 'New session';
      }

      const snapshot: SessionSnapshot = {
        id: session.id,
        config: session.config,
        messages: session.conversation.messages,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        turnCount: session.turnCount,
        totalInputTokens: session.totalInputTokens,
        totalOutputTokens: session.totalOutputTokens,
        title,
        workingDirectory: session.config.workingDirectory,
      };

      fs.writeFileSync(this.sessionFilePath(session.id), JSON.stringify(snapshot, null, 2), 'utf-8');
    } catch {
      // Persist is best-effort
    }
  }

  /** Load a session from disk by its ID. Returns session or null. */
  loadFromDisk(rawId: string): Session | null {
    try {
      const filePath = this.sessionFilePath(rawId);
      if (!fs.existsSync(filePath)) return null;

      const raw = fs.readFileSync(filePath, 'utf-8');
      const snap: SessionSnapshot = JSON.parse(raw);

      const id = createSessionId(snap.id);
      const session: Session = {
        id,
        config: { ...snap.config, id },
        state: 'idle',
        conversation: {
          messages: snap.messages,
          context: {
            workingDirectory: snap.workingDirectory,
            environment: {},
            sessionId: id,
            toolResults: new Map(),
          },
        },
        createdAt: snap.createdAt,
        updatedAt: snap.updatedAt,
        turnCount: snap.turnCount,
        totalInputTokens: snap.totalInputTokens,
        totalOutputTokens: snap.totalOutputTokens,
      };

      this.sessions.set(id, session);
      return session;
    } catch {
      return null;
    }
  }

  /** Load the most recent session from disk (for -c / --continue). */
  loadLatestSession(): Session | null {
    try {
      this.ensurePersistDir();
      const files = fs.readdirSync(this.persistDir)
        .filter((f) => f.endsWith('.json'))
        .map((f) => ({
          name: f,
          mtime: fs.statSync(path.join(this.persistDir, f)).mtime.getTime(),
        }))
        .sort((a, b) => b.mtime - a.mtime);

      if (files.length === 0) return null;
      const id = files[0].name.replace('.json', '');
      return this.loadFromDisk(id);
    } catch {
      return null;
    }
  }

  /** List all persisted sessions (most recent first). */
  listPersistedSessions(limit = 20): SessionSnapshot[] {
    try {
      this.ensurePersistDir();
      const files = fs.readdirSync(this.persistDir)
        .filter((f) => f.endsWith('.json'))
        .map((f) => {
          const p = path.join(this.persistDir, f);
          return { name: f, mtime: fs.statSync(p).mtime.getTime() };
        })
        .sort((a, b) => b.mtime - a.mtime)
        .slice(0, limit);

      const snapshots: SessionSnapshot[] = [];
      for (const f of files) {
        try {
          const raw = fs.readFileSync(path.join(this.persistDir, f.name), 'utf-8');
          snapshots.push(JSON.parse(raw));
        } catch {
          // skip corrupt files
        }
      }
      return snapshots;
    } catch {
      return [];
    }
  }

  /** Delete a persisted session file from disk */
  deletePersisted(rawId: string): boolean {
    try {
      const filePath = this.sessionFilePath(rawId);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
}

/** Internal session data structure */
interface Session {
  id: SessionId;
  config: SessionConfig;
  state: SessionState;
  conversation: Conversation;
  createdAt: number;
  updatedAt: number;
  turnCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
}
