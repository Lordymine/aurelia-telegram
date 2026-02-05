import { Bot } from 'grammy';
import type { AureliaConfig } from '../config/schema.js';
import { createAuthMiddleware } from './middleware/auth.js';
import { createCommandHandlers } from './handlers/commands.js';
import { handleMessage, createMessageHandler } from './handlers/messages.js';
import { logger } from '../utils/logger.js';
import type { JobManager } from '../bridge/job-manager.js';
import type { AureliaEngine } from '../core/engine.js';
import type { SessionManager } from '../session/manager.js';

export interface CreateBotOptions {
  jobManager?: JobManager;
  engine?: AureliaEngine;
  sessionManager?: SessionManager;
}

export function createBot(config: AureliaConfig, options?: CreateBotOptions): Bot {
  const bot = new Bot(config.botToken);
  const jobManager = options?.jobManager ?? options?.engine?.getJobManager();
  const engine = options?.engine;
  const sessionManager = options?.sessionManager;

  // Error handler
  bot.catch((err) => {
    logger.error({ err: err.error, userId: err.ctx.from?.id }, 'Bot error');
    err.ctx.reply('An error occurred. Please try again.').catch(() => {});
  });

  // Middleware: auth check on every message
  bot.use(createAuthMiddleware(config));

  // Command handlers
  const handlers = createCommandHandlers(config, jobManager, sessionManager);
  bot.command('start', handlers.handleStart);
  bot.command('help', handlers.handleHelp);
  bot.command('status', handlers.handleStatus);
  bot.command('auth', handlers.handleAuth);
  bot.command('auth_status', handlers.handleAuthStatus);
  bot.command('jobs', handlers.handleJobs);
  bot.command('cancel', handlers.handleCancel);
  bot.command('switch_project', handlers.handleSwitchProject);
  bot.command('whoami', handlers.handleWhoami);

  // Message handler: use engine if available, otherwise echo
  if (engine) {
    bot.on('message:text', createMessageHandler(config, engine));
  } else {
    bot.on('message:text', handleMessage);
  }

  return bot;
}
