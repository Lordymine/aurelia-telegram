import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AureliaEngine } from '../../../src/core/engine.js';

vi.mock('../../../src/kimi/translator.js', () => ({
  translateUserToADE: vi.fn(),
  translateADEToUser: vi.fn(),
  splitMessage: vi.fn((text: string) => [text]),
}));

vi.mock('../../../src/bridge/job-manager.js', async () => {
  const { EventEmitter } = await import('node:events');

  class MockJobManager extends EventEmitter {
    private jobs = new Map();
    private nextId = 1;

    createJob(userId: number, command: string) {
      const job = {
        id: `job-${this.nextId++}`,
        userId,
        command,
        status: 'queued' as const,
        output: [],
        createdAt: Date.now(),
      };
      this.jobs.set(job.id, job);

      // Auto-complete the job after a tick
      setTimeout(() => {
        job.status = 'completed' as any;
        job.output.push('ADE output result');
        this.emit('progress', { jobId: job.id, type: 'completed', job });
      }, 10);

      return job;
    }

    getJob(jobId: string) {
      return this.jobs.get(jobId);
    }

    getActiveJobs() {
      return [];
    }

    getRecentJobs() {
      return [];
    }

    cancelJob() {
      return false;
    }

    getJobManager() {
      return this;
    }
  }

  return {
    JobManager: MockJobManager,
  };
});

import { translateUserToADE, translateADEToUser } from '../../../src/kimi/translator.js';

describe('AureliaEngine', () => {
  let engine: AureliaEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new AureliaEngine();
  });

  describe('processMessage', () => {
    it('should return clarification when confidence is low', async () => {
      vi.mocked(translateUserToADE).mockResolvedValue({
        action: 'clarify',
        agent: '',
        command: '',
        args: {},
        confidence: 0.3,
        rawPrompt: '',
        clarification: 'What do you mean?',
      });

      const result = await engine.processMessage(111, 'token', 'xyzzy');
      expect(result.messages).toEqual(['What do you mean?']);
      expect(result.command?.action).toBe('clarify');
      expect(result.jobId).toBeUndefined();
    });

    it('should execute command when confidence >= 0.7', async () => {
      vi.mocked(translateUserToADE).mockResolvedValue({
        action: 'execute',
        agent: '@dev',
        command: '*develop',
        args: {},
        confidence: 0.9,
        rawPrompt: '@dev *develop story 1.4',
      });
      vi.mocked(translateADEToUser).mockResolvedValue('Development completed successfully!');

      const result = await engine.processMessage(111, 'token', 'implement story 1.4');

      expect(result.messages).toEqual(['Development completed successfully!']);
      expect(result.command?.action).toBe('execute');
      expect(result.jobId).toBeDefined();
    });

    it('should use default clarification when none provided', async () => {
      vi.mocked(translateUserToADE).mockResolvedValue({
        action: 'clarify',
        agent: '',
        command: '',
        args: {},
        confidence: 0,
        rawPrompt: '',
      });

      const result = await engine.processMessage(111, 'token', 'hmm');
      expect(result.messages[0]).toContain('clarify');
    });

    it('should maintain conversation history per user', async () => {
      vi.mocked(translateUserToADE).mockResolvedValue({
        action: 'clarify',
        agent: '',
        command: '',
        args: {},
        confidence: 0.3,
        rawPrompt: '',
        clarification: 'Please clarify.',
      });

      await engine.processMessage(111, 'token', 'first message');
      await engine.processMessage(111, 'token', 'second message');

      const ctx = engine.getOrCreateContext(111, 'token');
      expect(ctx.conversationHistory.length).toBe(4); // 2 user + 2 assistant
    });

    it('should track active agent from commands', async () => {
      vi.mocked(translateUserToADE).mockResolvedValue({
        action: 'clarify',
        agent: '@architect',
        command: '',
        args: {},
        confidence: 0.3,
        rawPrompt: '',
        clarification: 'What architecture?',
      });

      await engine.processMessage(111, 'token', 'talk to architect');

      const ctx = engine.getOrCreateContext(111, 'token');
      expect(ctx.activeAgent).toBe('@architect');
    });

    it('should fallback to raw output when translation fails', async () => {
      vi.mocked(translateUserToADE).mockResolvedValue({
        action: 'execute',
        agent: '@dev',
        command: '*build',
        args: {},
        confidence: 0.9,
        rawPrompt: '@dev *build',
      });
      vi.mocked(translateADEToUser).mockRejectedValue(new Error('Kimi API error'));

      const result = await engine.processMessage(111, 'token', 'build it');

      // Should get raw output as fallback
      expect(result.messages[0]).toContain('ADE output result');
    });
  });

  describe('getOrCreateContext', () => {
    it('should create new context for unknown user', () => {
      const ctx = engine.getOrCreateContext(111, 'token');
      expect(ctx.userId).toBe(111);
      expect(ctx.accessToken).toBe('token');
      expect(ctx.conversationHistory).toEqual([]);
    });

    it('should return existing context for known user', () => {
      const ctx1 = engine.getOrCreateContext(111, 'token1');
      ctx1.conversationHistory.push({ role: 'user', content: 'hello' });

      const ctx2 = engine.getOrCreateContext(111, 'token2');
      expect(ctx2.conversationHistory.length).toBe(1);
      expect(ctx2.accessToken).toBe('token2'); // Updated
    });
  });

  describe('getJobManager', () => {
    it('should return the internal job manager', () => {
      const jm = engine.getJobManager();
      expect(jm).toBeDefined();
    });
  });
});
