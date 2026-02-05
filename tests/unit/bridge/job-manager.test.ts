import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JobManager, type JobProgressEvent } from '../../../src/bridge/job-manager.js';

// Mock the ClaudeCodeBridge
vi.mock('../../../src/bridge/claude-code.js', async () => {
  const { EventEmitter } = await import('node:events');

  class MockBridge extends EventEmitter {
    _isRunning = false;
    _executeResolve: ((value: string) => void) | null = null;
    _executeReject: ((reason: Error) => void) | null = null;

    get isRunning() {
      return this._isRunning;
    }

    async execute(_prompt: string) {
      this._isRunning = true;
      return new Promise<string>((resolve, reject) => {
        this._executeResolve = (value: string) => {
          this._isRunning = false;
          resolve(value);
        };
        this._executeReject = (reason: Error) => {
          this._isRunning = false;
          reject(reason);
        };
      });
    }

    kill() {
      this._isRunning = false;
      if (this._executeReject) {
        this._executeReject(new Error('Process killed'));
      }
    }
  }

  return {
    ClaudeCodeBridge: MockBridge,
  };
});

describe('JobManager', () => {
  let manager: JobManager;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new JobManager();
  });

  describe('createJob', () => {
    it('should create a job and start processing', () => {
      const job = manager.createJob(111, 'test command');
      // Job may immediately transition to 'running' since processQueue runs synchronously
      expect(['queued', 'running']).toContain(job.status);
      expect(job.userId).toBe(111);
      expect(job.command).toBe('test command');
      expect(job.id).toMatch(/^[a-f0-9-]+$/);
      expect(job.output).toEqual([]);
    });

    it('should store telegramChatId and telegramMessageId', () => {
      const job = manager.createJob(111, 'test', 222, 333);
      expect(job.telegramChatId).toBe(222);
      expect(job.telegramMessageId).toBe(333);
    });
  });

  describe('getJob', () => {
    it('should retrieve a created job', () => {
      const job = manager.createJob(111, 'test');
      const found = manager.getJob(job.id);
      expect(found).toBe(job);
    });

    it('should return undefined for unknown job', () => {
      expect(manager.getJob('nonexistent')).toBeUndefined();
    });
  });

  describe('getActiveJobs', () => {
    it('should return queued and running jobs', () => {
      manager.createJob(111, 'job1');
      manager.createJob(111, 'job2');

      const active = manager.getActiveJobs(111);
      // First job starts running, second stays queued
      expect(active.length).toBeGreaterThanOrEqual(1);
    });

    it('should filter by userId', () => {
      manager.createJob(111, 'user1 job');
      manager.createJob(222, 'user2 job');

      const user1Jobs = manager.getActiveJobs(111);
      for (const job of user1Jobs) {
        expect(job.userId).toBe(111);
      }
    });

    it('should return all active jobs when no userId specified', () => {
      manager.createJob(111, 'job1');
      manager.createJob(222, 'job2');

      const all = manager.getActiveJobs();
      expect(all.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getRecentJobs', () => {
    it('should return jobs sorted by creation time (newest first)', () => {
      manager.createJob(111, 'first');
      manager.createJob(111, 'second');

      const recent = manager.getRecentJobs(111);
      expect(recent.length).toBe(2);
      expect(recent[0]!.createdAt).toBeGreaterThanOrEqual(recent[1]!.createdAt);
    });

    it('should respect limit parameter', () => {
      manager.createJob(111, 'job1');
      manager.createJob(111, 'job2');
      manager.createJob(111, 'job3');

      const recent = manager.getRecentJobs(111, 2);
      expect(recent.length).toBe(2);
    });
  });

  describe('cancelJob', () => {
    it('should cancel a queued job', async () => {
      // Create two jobs — first will be running, second will be queued
      manager.createJob(111, 'job1');
      const job2 = manager.createJob(111, 'job2');

      // job2 should be queued since job1 is running
      // Wait a tick for async processing
      await new Promise((r) => setTimeout(r, 10));

      const result = manager.cancelJob(job2.id);
      expect(result).toBe(true);
      expect(job2.status).toBe('cancelled');
      expect(job2.completedAt).toBeDefined();
    });

    it('should return false for unknown job', () => {
      expect(manager.cancelJob('nonexistent')).toBe(false);
    });

    it('should return false for already completed job', async () => {
      const job = manager.createJob(111, 'test');

      // Wait for the job to start processing
      await new Promise((r) => setTimeout(r, 10));

      // Manually mark as completed to test
      job.status = 'completed';
      expect(manager.cancelJob(job.id)).toBe(false);
    });
  });

  describe('progress events', () => {
    it('should emit started event when job begins', async () => {
      const events: JobProgressEvent[] = [];
      manager.on('progress', (e: JobProgressEvent) => events.push(e));

      manager.createJob(111, 'test');

      // Wait for async processing
      await new Promise((r) => setTimeout(r, 50));

      const startedEvent = events.find((e) => e.type === 'started');
      expect(startedEvent).toBeDefined();
      expect(startedEvent!.job.status).toBe('running');
    });

    it('should emit progress events with job data', async () => {
      const events: JobProgressEvent[] = [];
      manager.on('progress', (e: JobProgressEvent) => events.push(e));

      const job = manager.createJob(111, 'test');

      await new Promise((r) => setTimeout(r, 50));

      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(events[0]!.jobId).toBe(job.id);
    });
  });
});
