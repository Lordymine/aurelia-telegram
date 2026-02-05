import { Bot } from 'grammy';
import type { AureliaConfig } from '../config/schema.js';
import { createAuthMiddleware } from './middleware/auth.js';
import { createCommandHandlers } from './handlers/commands.js';
import { handleMessage, createMessageHandler } from './handlers/messages.js';
import { logger } from '../utils/logger.js';
import type { JobManager } from '../bridge/job-manager.js';
import type { AureliaEngine } from '../core/engine.js';

export function createBot(config: AureliaConfig, options?: { jobManager?: JobManager; engine?: AureliaEngine }): Bot {
  const bot = new Bot(config.botToken);
  const jobManager = options?.jobManager ?? options?.engine?.getJobManager();
  const engine = options?.engine;

  // Error handler
  bot.catch((err) => {
    logger.error({ err: err.error, userId: err.ctx.from?.id }, 'Bot error');
    err.ctx.reply('An error occurred. Please try again.').catch(() => {});
  });

  // Middleware: auth check on every message
  bot.use(createAuthMiddleware(config));

  // Command handlers
  const { handleStart, handleHelp, handleStatus, handleAuth, handleAuthStatus, handleJobs, handleCancel } = createCommandHandlers(config, jobManager);
  bot.command('start', handleStart);
  bot.command('help', handleHelp);
  bot.command('status', handleStatus);
  bot.command('auth', handleAuth);
  bot.command('auth_status', handleAuthStatus);
  bot.command('jobs', handleJobs);
  bot.command('cancel', handleCancel);

  // Message handler: use engine if available, otherwise echo
  if (engine) {
    bot.on('message:text', createMessageHandler(config, engine));
  } else {
    bot.on('message:text', handleMessage);
  }

  return bot;
}
