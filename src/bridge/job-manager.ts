import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { ClaudeCodeBridge, type ExecuteOptions, type OutputChunk } from './claude-code.js';
import { logger } from '../utils/logger.js';

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface Job {
  id: string;
  userId: number;
  command: string;
  status: JobStatus;
  telegramMessageId?: number;
  telegramChatId?: number;
  output: string[];
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  error?: string;
}

export interface JobProgressEvent {
  jobId: string;
  type: 'started' | 'output' | 'completed' | 'failed' | 'cancelled';
  content?: string;
  job: Job;
}

export class JobManager extends EventEmitter {
  private jobs = new Map<string, Job>();
  private bridge = new ClaudeCodeBridge();
  private queue: string[] = [];
  private processing = false;

  getJob(jobId: string): Job | undefined {
    return this.jobs.get(jobId);
  }

  getActiveJobs(userId?: number): Job[] {
    const active: Job[] = [];
    for (const job of this.jobs.values()) {
      if (job.status === 'queued' || job.status === 'running') {
        if (userId === undefined || job.userId === userId) {
          active.push(job);
        }
      }
    }
    return active;
  }

  getRecentJobs(userId?: number, limit = 10): Job[] {
    const jobs: Job[] = [];
    for (const job of this.jobs.values()) {
      if (userId === undefined || job.userId === userId) {
        jobs.push(job);
      }
    }
    return jobs
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  }

  createJob(userId: number, command: string, telegramChatId?: number, telegramMessageId?: number): Job {
    const job: Job = {
      id: randomUUID(),
      userId,
      command,
      status: 'queued',
      telegramMessageId,
      telegramChatId,
      output: [],
      createdAt: Date.now(),
    };

    this.jobs.set(job.id, job);
    this.queue.push(job.id);

    logger.info({ jobId: job.id, userId, commandLength: command.length }, 'Job created');

    this.processQueue();
    return job;
  }

  cancelJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    if (job.status === 'queued') {
      job.status = 'cancelled';
      job.completedAt = Date.now();
      this.queue = this.queue.filter((id) => id !== jobId);
      this.emitProgress(job, 'cancelled');
      logger.info({ jobId }, 'Queued job cancelled');
      return true;
    }

    if (job.status === 'running') {
      this.bridge.kill();
      job.status = 'cancelled';
      job.completedAt = Date.now();
      this.emitProgress(job, 'cancelled');
      logger.info({ jobId }, 'Running job cancelled');
      return true;
    }

    return false;
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;

    while (this.queue.length > 0) {
      const jobId = this.queue.shift()!;
      const job = this.jobs.get(jobId);

      if (!job || job.status !== 'queued') continue;

      await this.executeJob(job);
    }

    this.processing = false;
  }

  private async executeJob(job: Job): Promise<void> {
    job.status = 'running';
    job.startedAt = Date.now();
    this.emitProgress(job, 'started');

    const outputHandler = (chunk: OutputChunk) => {
      if (chunk.type === 'text') {
        job.output.push(chunk.content);
        this.emitProgress(job, 'output', chunk.content);
      }
    };

    this.bridge.on('output', outputHandler);

    const options: ExecuteOptions = {
      timeout: 10 * 60 * 1000,
    };

    try {
      const result = await this.bridge.execute(job.command, options);
      job.status = 'completed';
      job.completedAt = Date.now();
      if (job.output.length === 0) {
        job.output.push(result);
      }
      this.emitProgress(job, 'completed', result);
      logger.info({ jobId: job.id, duration: job.completedAt - (job.startedAt ?? 0) }, 'Job completed');
    } catch (err) {
      if ((job.status as JobStatus) !== 'cancelled') {
        job.status = 'failed';
        job.completedAt = Date.now();
        job.error = err instanceof Error ? err.message : String(err);
        this.emitProgress(job, 'failed', job.error);
        logger.error({ jobId: job.id, error: job.error }, 'Job failed');
      }
    } finally {
      this.bridge.removeListener('output', outputHandler);
    }
  }

  private emitProgress(job: Job, type: JobProgressEvent['type'], content?: string): void {
    const event: JobProgressEvent = { jobId: job.id, type, content, job };
    this.emit('progress', event);
  }
}
