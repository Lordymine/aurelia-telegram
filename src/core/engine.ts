import { translateUserToADE, translateADEToUser, splitMessage, type ADECommand } from '../kimi/translator.js';
import { JobManager, type JobProgressEvent } from '../bridge/job-manager.js';
import { logger } from '../utils/logger.js';
import type { ChatMessage } from '../kimi/client.js';

const CONFIDENCE_THRESHOLD = 0.7;
const MAX_HISTORY = 20;

export interface EngineContext {
  userId: number;
  accessToken: string;
  conversationHistory: ChatMessage[];
  activeAgent?: string;
}

export interface EngineResult {
  messages: string[];
  command?: ADECommand;
  jobId?: string;
}

export class AureliaEngine {
  private jobManager = new JobManager();
  private userContexts = new Map<number, EngineContext>();

  getJobManager(): JobManager {
    return this.jobManager;
  }

  getOrCreateContext(userId: number, accessToken: string): EngineContext {
    let ctx = this.userContexts.get(userId);
    if (!ctx) {
      ctx = {
        userId,
        accessToken,
        conversationHistory: [],
      };
      this.userContexts.set(userId, ctx);
    }
    ctx.accessToken = accessToken;
    return ctx;
  }

  async processMessage(
    userId: number,
    accessToken: string,
    message: string,
    onProgress?: (event: JobProgressEvent) => void,
  ): Promise<EngineResult> {
    const ctx = this.getOrCreateContext(userId, accessToken);

    // Add user message to history
    ctx.conversationHistory.push({ role: 'user', content: message });
    if (ctx.conversationHistory.length > MAX_HISTORY) {
      ctx.conversationHistory = ctx.conversationHistory.slice(-MAX_HISTORY);
    }

    logger.info({ userId, messageLength: message.length }, 'Processing message');

    // Step 1: Translate user message to ADE command via Kimi
    const command = await translateUserToADE(accessToken, message, ctx.conversationHistory);

    logger.info(
      { userId, action: command.action, agent: command.agent, confidence: command.confidence },
      'Kimi translation result',
    );

    // Update active agent context
    if (command.agent) {
      ctx.activeAgent = command.agent;
    }

    // Step 2: Check confidence threshold
    if (command.action === 'clarify' || command.confidence < CONFIDENCE_THRESHOLD) {
      const clarification = command.clarification ?? 'Could you clarify what you want me to do?';

      ctx.conversationHistory.push({ role: 'assistant', content: clarification });

      return {
        messages: splitMessage(clarification),
        command,
      };
    }

    // Step 3: Execute via ADE Bridge
    const prompt = command.rawPrompt || message;
    const job = this.jobManager.createJob(userId, prompt);

    if (onProgress) {
      const progressHandler = (event: JobProgressEvent) => {
        if (event.jobId === job.id) {
          onProgress(event);
        }
      };
      this.jobManager.on('progress', progressHandler);

      // Clean up listener when job completes
      const cleanup = (event: JobProgressEvent) => {
        if (event.jobId === job.id && (event.type === 'completed' || event.type === 'failed' || event.type === 'cancelled')) {
          this.jobManager.removeListener('progress', progressHandler);
          this.jobManager.removeListener('progress', cleanup);
        }
      };
      this.jobManager.on('progress', cleanup);
    }

    // Wait for job to complete (poll)
    const result = await this.waitForJob(job.id);

    if (!result) {
      return {
        messages: ['Job failed or was cancelled.'],
        command,
        jobId: job.id,
      };
    }

    // Step 4: Translate ADE output back to user-friendly message via Kimi
    const adeOutput = result;
    let userResponse: string;

    try {
      userResponse = await translateADEToUser(accessToken, adeOutput, `Agent: ${command.agent}, Command: ${command.command}`);
    } catch {
      // Fallback: return raw output if translation fails
      userResponse = adeOutput.length > 3000 ? adeOutput.slice(0, 3000) + '\n\n[Output truncated]' : adeOutput;
    }

    ctx.conversationHistory.push({ role: 'assistant', content: userResponse });

    return {
      messages: splitMessage(userResponse),
      command,
      jobId: job.id,
    };
  }

  private waitForJob(jobId: string): Promise<string | null> {
    return new Promise((resolve) => {
      const check = (event: JobProgressEvent) => {
        if (event.jobId !== jobId) return;

        if (event.type === 'completed') {
          this.jobManager.removeListener('progress', check);
          const job = this.jobManager.getJob(jobId);
          resolve(job?.output.join('') ?? null);
        } else if (event.type === 'failed' || event.type === 'cancelled') {
          this.jobManager.removeListener('progress', check);
          resolve(null);
        }
      };

      // Check if already completed
      const job = this.jobManager.getJob(jobId);
      if (job?.status === 'completed') {
        resolve(job.output.join(''));
        return;
      }
      if (job?.status === 'failed' || job?.status === 'cancelled') {
        resolve(null);
        return;
      }

      this.jobManager.on('progress', check);
    });
  }
}
