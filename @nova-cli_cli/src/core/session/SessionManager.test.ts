// ============================================================================
// SessionManager Tests
// ============================================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SessionManager } from './SessionManager.js';
import type { Message } from '../types/session.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

describe('SessionManager', () => {
  let sessionManager: SessionManager;
  const testSessionDir = path.join(os.tmpdir(), 'nova-test-sessions-' + Date.now());

  beforeEach(() => {
    if (!fs.existsSync(testSessionDir)) {
      fs.mkdirSync(testSessionDir, { recursive: true });
    }
    sessionManager = new SessionManager(testSessionDir);
  });

  afterEach(() => {
    if (fs.existsSync(testSessionDir)) {
      fs.rmSync(testSessionDir, { recursive: true, force: true });
    }
  });

  describe('create()', () => {
    it('should create a new session with unique ID', () => {
      const session1 = sessionManager.create({ workingDirectory: process.cwd() });
      const session2 = sessionManager.create({ workingDirectory: process.cwd() });

      expect(session1.id).toBeDefined();
      expect(session2.id).toBeDefined();
      expect(session1.id).not.toBe(session2.id);
    });

    it('should create session with messages array', () => {
      const session = sessionManager.create({ workingDirectory: process.cwd() });
      const messages = session.conversation.messages;

      expect(messages).toBeDefined();
      expect(Array.isArray(messages)).toBe(true);
    });
  });

  describe('get()', () => {
    it('should return undefined for non-existent session', () => {
      const session = sessionManager.get('non-existent-id' as any);
      expect(session).toBeUndefined();
    });

    it('should return session for valid ID', () => {
      const session = sessionManager.create({ workingDirectory: process.cwd() });
      const retrieved = sessionManager.get(session.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(session.id);
    });
  });

  describe('addMessage()', () => {
    it('should add message to session', () => {
      const session = sessionManager.create({ workingDirectory: process.cwd() });

      sessionManager.addMessage(session.id, 'user', 'Hello, world!');
      const messages = session.conversation.messages;

      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe('Hello, world!');
    });

    it('should maintain message order', () => {
      const session = sessionManager.create({ workingDirectory: process.cwd() });

      sessionManager.addMessage(session.id, 'user', 'First');
      sessionManager.addMessage(session.id, 'assistant', 'Second');
      sessionManager.addMessage(session.id, 'user', 'Third');

      const messages = session.conversation.messages;
      expect(messages).toHaveLength(3);
      expect(messages[0].content).toBe('First');
      expect(messages[1].content).toBe('Second');
      expect(messages[2].content).toBe('Third');
    });

    it('should throw for non-existent session', () => {
      expect(() => {
        sessionManager.addMessage('non-existent' as any, 'user', 'test');
      }).toThrow();
    });
  });

  describe('getMessages()', () => {
    it('should return empty array for new session', () => {
      const session = sessionManager.create({ workingDirectory: process.cwd() });
      const messages = session.conversation.messages;

      expect(messages).toHaveLength(0);
    });

    it('should return messages array', () => {
      const session = sessionManager.create({ workingDirectory: process.cwd() });
      sessionManager.addMessage(session.id, 'user', 'test');

      const messages = session.conversation.messages;
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe('test');
    });
  });

  describe('persist() and loadLatestSession()', () => {
    it('should persist and load session', async () => {
      const session = sessionManager.create({ workingDirectory: process.cwd() });
      sessionManager.addMessage(session.id, 'user', 'Test message');

      await sessionManager.persist(session.id);

      // Create new SessionManager instance
      const sessionManager2 = new SessionManager(testSessionDir);
      const loadedSession = await sessionManager2.loadLatestSession();

      expect(loadedSession).toBeDefined();
      const messages = loadedSession!.conversation.messages;
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe('Test message');
    });

    it('should return null when no persisted sessions', async () => {
      const loadedSession = await sessionManager.loadLatestSession();
      expect(loadedSession).toBeNull();
    });

    it('should load most recent session', async () => {
      const session1 = sessionManager.create({ workingDirectory: process.cwd() });
      sessionManager.addMessage(session1.id, 'user', 'Session 1');
      await sessionManager.persist(session1.id);

      // Wait a bit to ensure different mtime
      await new Promise(resolve => setTimeout(resolve, 100));

      const session2 = sessionManager.create({ workingDirectory: process.cwd() });
      sessionManager.addMessage(session2.id, 'user', 'Session 2');
      await sessionManager.persist(session2.id);

      const loadedSession = await sessionManager.loadLatestSession();
      const messages = loadedSession!.conversation.messages;

      expect(messages[0].content).toBe('Session 2');
    });
  });

  describe('listPersistedSessions()', () => {
    it('should return empty array when no sessions', async () => {
      const sessions = await sessionManager.listPersistedSessions();
      expect(sessions).toHaveLength(0);
    });

    it('should list persisted sessions', async () => {
      const session1 = sessionManager.create({ workingDirectory: process.cwd() });
      sessionManager.addMessage(session1.id, 'user', 'Test 1');
      await sessionManager.persist(session1.id);

      const session2 = sessionManager.create({ workingDirectory: process.cwd() });
      sessionManager.addMessage(session2.id, 'user', 'Test 2');
      await sessionManager.persist(session2.id);

      const sessions = await sessionManager.listPersistedSessions();
      expect(sessions.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('delete()', () => {
    it('should delete session from memory', () => {
      const session = sessionManager.create({ workingDirectory: process.cwd() });
      expect(sessionManager.get(session.id)).toBeDefined();

      sessionManager.delete(session.id);
      expect(sessionManager.get(session.id)).toBeUndefined();
    });
  });
});
