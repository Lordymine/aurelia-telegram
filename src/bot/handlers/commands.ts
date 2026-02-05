import type { CommandContext, Context } from 'grammy';
import type { AureliaConfig } from '../../config/schema.js';
import { logger } from '../../utils/logger.js';

export function createCommandHandlers(config: AureliaConfig) {
  async function handleStart(ctx: CommandContext<Context>): Promise<void> {
    logger.info({ userId: ctx.from?.id }, '/start command');
    const name = ctx.from?.first_name ?? 'there';
    await ctx.reply(
      `Welcome, ${name}! I'm Aurelia, your Telegram gateway to the AIOS ADE.\n\n` +
        `Project: ${config.projectPath}\n` +
        `Mode: ${config.deployMode}\n\n` +
        `Use /help to see available commands.\n` +
        `Kimi translation will be available after authentication (coming soon).`,
    );
  }

  async function handleHelp(ctx: CommandContext<Context>): Promise<void> {
    logger.info({ userId: ctx.from?.id }, '/help command');
    await ctx.reply(
      `Available commands:\n\n` +
        `/start — Welcome message and bot info\n` +
        `/help — Show this help message\n` +
        `/status — Show bot status and connections\n\n` +
        `You can also send any text message and I will echo it back.\n` +
        `In the future, messages will be translated by Kimi and executed via ADE.`,
    );
  }

  async function handleStatus(ctx: CommandContext<Context>): Promise<void> {
    logger.info({ userId: ctx.from?.id }, '/status command');
    const uptimeSeconds = Math.floor(process.uptime());
    const hours = Math.floor(uptimeSeconds / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = uptimeSeconds % 60;
    const uptimeStr = `${hours}h ${minutes}m ${seconds}s`;

    await ctx.reply(
      `Bot Status:\n\n` +
        `Uptime: ${uptimeStr}\n` +
        `Deploy mode: ${config.deployMode}\n` +
        `Project: ${config.projectPath}\n` +
        `Allowed users: ${config.allowedUsers.length}\n` +
        `Kimi: not configured`,
    );
  }

  return { handleStart, handleHelp, handleStatus };
}
