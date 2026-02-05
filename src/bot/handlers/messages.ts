import type { Context } from 'grammy';
import { logger } from '../../utils/logger.js';

export async function handleMessage(ctx: Context): Promise<void> {
  const text = ctx.message?.text;
  if (!text) return;

  logger.debug({ userId: ctx.from?.id, messageLength: text.length }, 'Incoming message');

  await ctx.reply(`Echo: ${text}`);
}
