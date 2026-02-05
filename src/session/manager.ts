import { logger } from '../utils/logger.js';
import type { ChatMessage } from '../kimi/client.js';

const DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24 hours
const DEFAULT_MAX_HISTORY = 50;

export interface UserSession {
  userId: number;
  authenticated: boolean;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: number;
  activeProject: string;
  conversationHistory: ChatMessage[];
  activeJobId: string | null;
  createdAt: number;
  lastActiveAt: number;
}

export interface SessionManagerOptions {
  ttl?: number;
  maxHistory?: number;
  defaultProject?: string;
}

export class SessionManager {
  private sessions = new Map<number, UserSession>();
  private ttl: number;
  private maxHistory: number;
  private defaultProject: string;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(options: SessionManagerOptions = {}) {
    this.ttl = options.ttl ?? DEFAULT_TTL;
    this.maxHistory = options.maxHistory ?? DEFAULT_MAX_HISTORY;
    this.defaultProject = options.defaultProject ?? process.cwd();

    // Run cleanup every hour
    this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 60 * 1000);
    // Allow the process to exit without waiting for this interval
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  getSession(userId: number): UserSession | undefined {
    const session = this.sessions.get(userId);
    if (session) {
      session.lastActiveAt = Date.now();
    }
    return session;
  }

  getOrCreateSession(userId: number): UserSession {
    let session = this.sessions.get(userId);
    if (!session) {
      session = {
        userId,
        authenticated: false,
        activeProject: this.defaultProject,
        conversationHistory: [],
        activeJobId: null,
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
      };
      this.sessions.set(userId, session);
      logger.info({ userId }, 'Session created');
    } else {
      session.lastActiveAt = Date.now();
    }
    return session;
  }

  addMessage(userId: number, role: ChatMessage['role'], content: string): void {
    const session = this.getOrCreateSession(userId);
    session.conversationHistory.push({ role, content });
    if (session.conversationHistory.length > this.maxHistory) {
      session.conversationHistory = session.conversationHistory.slice(-this.maxHistory);
    }
  }

  setAuthenticated(userId: number, accessToken: string, refreshToken?: string, expiresAt?: number): void {
    const session = this.getOrCreateSession(userId);
    session.authenticated = true;
    session.accessToken = accessToken;
    session.refreshToken = refreshToken;
    session.tokenExpiresAt = expiresAt;
  }

  switchProject(userId: number, projectPath: string): void {
    const session = this.getOrCreateSession(userId);
    session.activeProject = projectPath;
    session.conversationHistory = [];
    logger.info({ userId, projectPath }, 'Switched project');
  }

  setActiveJob(userId: number, jobId: string | null): void {
    const session = this.getOrCreateSession(userId);
    session.activeJobId = jobId;
  }

  deleteSession(userId: number): boolean {
    const existed = this.sessions.has(userId);
    this.sessions.delete(userId);
    if (existed) {
      logger.info({ userId }, 'Session deleted');
    }
    return existed;
  }

  getActiveSessions(): UserSession[] {
    return Array.from(this.sessions.values());
  }

  getSessionCount(): number {
    return this.sessions.size;
  }

  cleanup(): number {
    const now = Date.now();
    let removed = 0;

    for (const [userId, session] of this.sessions) {
      if (now - session.lastActiveAt > this.ttl) {
        this.sessions.delete(userId);
        removed++;
        logger.info({ userId, inactiveMs: now - session.lastActiveAt }, 'Session expired');
      }
    }

    if (removed > 0) {
      logger.info({ removed, remaining: this.sessions.size }, 'Session cleanup completed');
    }

    return removed;
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.sessions.clear();
  }
}
