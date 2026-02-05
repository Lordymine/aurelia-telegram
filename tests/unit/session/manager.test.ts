import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionManager } from '../../../src/session/manager.js';

describe('SessionManager', () => {
  let manager: SessionManager;

  beforeEach(() => {
    manager = new SessionManager({ ttl: 1000, defaultProject: '/test/project' });
  });

  afterEach(() => {
    manager.destroy();
  });

  describe('getOrCreateSession', () => {
    it('should create a new session for unknown user', () => {
      const session = manager.getOrCreateSession(111);
      expect(session.userId).toBe(111);
      expect(session.authenticated).toBe(false);
      expect(session.activeProject).toBe('/test/project');
      expect(session.conversationHistory).toEqual([]);
      expect(session.activeJobId).toBeNull();
    });

    it('should return existing session for known user', () => {
      const session1 = manager.getOrCreateSession(111);
      session1.authenticated = true;

      const session2 = manager.getOrCreateSession(111);
      expect(session2.authenticated).toBe(true);
      expect(session2).toBe(session1);
    });

    it('should update lastActiveAt on access', async () => {
      const session = manager.getOrCreateSession(111);
      const firstActive = session.lastActiveAt;

      // Small delay to ensure Date.now() advances
      await new Promise((r) => setTimeout(r, 5));
      manager.getOrCreateSession(111);
      expect(session.lastActiveAt).toBeGreaterThanOrEqual(firstActive);
    });
  });

  describe('getSession', () => {
    it('should return undefined for unknown user', () => {
      expect(manager.getSession(999)).toBeUndefined();
    });

    it('should return existing session', () => {
      manager.getOrCreateSession(111);
      const session = manager.getSession(111);
      expect(session).toBeDefined();
      expect(session!.userId).toBe(111);
    });
  });

  describe('addMessage', () => {
    it('should add message to conversation history', () => {
      manager.addMessage(111, 'user', 'hello');
      const session = manager.getSession(111)!;
      expect(session.conversationHistory).toHaveLength(1);
      expect(session.conversationHistory[0]).toEqual({ role: 'user', content: 'hello' });
    });

    it('should trim history when exceeding maxHistory', () => {
      const smallManager = new SessionManager({ maxHistory: 3 });
      smallManager.addMessage(111, 'user', 'msg1');
      smallManager.addMessage(111, 'assistant', 'reply1');
      smallManager.addMessage(111, 'user', 'msg2');
      smallManager.addMessage(111, 'assistant', 'reply2');

      const session = smallManager.getSession(111)!;
      expect(session.conversationHistory).toHaveLength(3);
      expect(session.conversationHistory[0]!.content).toBe('reply1');
      smallManager.destroy();
    });
  });

  describe('setAuthenticated', () => {
    it('should set auth tokens on session', () => {
      manager.setAuthenticated(111, 'access-token', 'refresh-token', 12345);
      const session = manager.getSession(111)!;
      expect(session.authenticated).toBe(true);
      expect(session.accessToken).toBe('access-token');
      expect(session.refreshToken).toBe('refresh-token');
      expect(session.tokenExpiresAt).toBe(12345);
    });
  });

  describe('switchProject', () => {
    it('should update project and clear history', () => {
      manager.addMessage(111, 'user', 'old message');
      manager.switchProject(111, '/new/project');

      const session = manager.getSession(111)!;
      expect(session.activeProject).toBe('/new/project');
      expect(session.conversationHistory).toEqual([]);
    });
  });

  describe('setActiveJob', () => {
    it('should set active job id', () => {
      manager.setActiveJob(111, 'job-123');
      const session = manager.getSession(111)!;
      expect(session.activeJobId).toBe('job-123');
    });

    it('should clear active job', () => {
      manager.setActiveJob(111, 'job-123');
      manager.setActiveJob(111, null);
      const session = manager.getSession(111)!;
      expect(session.activeJobId).toBeNull();
    });
  });

  describe('deleteSession', () => {
    it('should remove session', () => {
      manager.getOrCreateSession(111);
      expect(manager.deleteSession(111)).toBe(true);
      expect(manager.getSession(111)).toBeUndefined();
    });

    it('should return false for nonexistent session', () => {
      expect(manager.deleteSession(999)).toBe(false);
    });
  });

  describe('getActiveSessions', () => {
    it('should return all sessions', () => {
      manager.getOrCreateSession(111);
      manager.getOrCreateSession(222);
      expect(manager.getActiveSessions()).toHaveLength(2);
    });
  });

  describe('getSessionCount', () => {
    it('should return count of sessions', () => {
      manager.getOrCreateSession(111);
      manager.getOrCreateSession(222);
      expect(manager.getSessionCount()).toBe(2);
    });
  });

  describe('cleanup', () => {
    it('should remove expired sessions', () => {
      const session = manager.getOrCreateSession(111);
      // Make session appear old
      session.lastActiveAt = Date.now() - 2000; // Older than 1000ms TTL

      const removed = manager.cleanup();
      expect(removed).toBe(1);
      expect(manager.getSession(111)).toBeUndefined();
    });

    it('should keep active sessions', () => {
      manager.getOrCreateSession(111); // Fresh session

      const removed = manager.cleanup();
      expect(removed).toBe(0);
      expect(manager.getSession(111)).toBeDefined();
    });
  });

  describe('destroy', () => {
    it('should clear all sessions', () => {
      manager.getOrCreateSession(111);
      manager.getOrCreateSession(222);
      manager.destroy();
      expect(manager.getSessionCount()).toBe(0);
    });
  });
});
