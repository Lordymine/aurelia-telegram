import { Bot } from 'grammy';
import type { AureliaConfig } from '../config/schema.js';
import { createAuthMiddleware } from './middleware/auth.js';
import { createCommandHandlers } from './handlers/commands.js';
import { handleMessage } from './handlers/messages.js';
import { logger } from '../utils/logger.js';

export function createBot(config: AureliaConfig): Bot {
  const bot = new Bot(config.botToken);

  // Error handler
  bot.catch((err) => {
    logger.error({ err: err.error, userId: err.ctx.from?.id }, 'Bot error');
    err.ctx.reply('An error occurred. Please try again.').catch(() => {});
  });

  // Middleware: auth check on every message
  bot.use(createAuthMiddleware(config));

  // Command handlers
  const { handleStart, handleHelp, handleStatus, handleAuth, handleAuthStatus } = createCommandHandlers(config);
  bot.command('start', handleStart);
  bot.command('help', handleHelp);
  bot.command('status', handleStatus);
  bot.command('auth', handleAuth);
  bot.command('auth_status', handleAuthStatus);

  // Echo handler for text messages (placeholder for Kimi translation)
  bot.on('message:text', handleMessage);

  return bot;
}
