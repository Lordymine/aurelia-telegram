import type { Context } from 'grammy';
import { logger } from '../../utils/logger.js';
import type { AureliaEngine } from '../../core/engine.js';
import type { AureliaConfig } from '../../config/schema.js';
import { ensureAuthenticated } from '../../kimi/auth.js';

export function createMessageHandler(config: AureliaConfig, engine?: AureliaEngine) {
  return async function handleMessage(ctx: Context): Promise<void> {
    const text = ctx.message?.text;
    if (!text) return;

    const userId = ctx.from?.id;
    logger.debug({ userId, messageLength: text.length }, 'Incoming message');

    // If no engine configured, fall back to echo
    if (!engine) {
      await ctx.reply(`Echo: ${text}`);
      return;
    }

    // Ensure Kimi auth (refreshes token automatically if expired)
    let accessToken: string;
    try {
      accessToken = await ensureAuthenticated();
      // Update in-memory config with refreshed token
      config.kimi.accessToken = accessToken;
    } catch {
      await ctx.reply('Kimi not authenticated. Use /auth to authenticate.');
      return;
    }

    // Send processing indicator
    const processingMsg = await ctx.reply('Processing...');

    try {
      const result = await engine.processMessage(
        userId ?? 0,
        accessToken,
        text,
        (event) => {
          // Update processing message with progress
          if (event.type === 'output' && event.content && processingMsg.chat?.id) {
            ctx.api.editMessageText(processingMsg.chat.id, processingMsg.message_id, `Processing...\n\n${event.content.slice(0, 200)}`).catch(() => {});
          }
        },
      );

      // Send result messages
      for (let i = 0; i < result.messages.length; i++) {
        const msg = result.messages[i]!;
        if (i === 0 && processingMsg.chat?.id) {
          // Edit the processing message with the first result
          await ctx.api.editMessageText(processingMsg.chat.id, processingMsg.message_id, msg).catch(() => {
            ctx.reply(msg).catch(() => {});
          });
        } else {
          await ctx.reply(msg);
        }
      }
    } catch (err) {
      logger.error({ err, userId }, 'Error processing message');
      await ctx.api.editMessageText(
        processingMsg.chat.id,
        processingMsg.message_id,
        'An error occurred while processing your request. Please try again.',
      ).catch(() => {});
    }
  };
}

// Backward-compatible export for tests and simple usage
export async function handleMessage(ctx: Context): Promise<void> {
  const text = ctx.message?.text;
  if (!text) return;

  logger.debug({ userId: ctx.from?.id, messageLength: text.length }, 'Incoming message');

  await ctx.reply(`Echo: ${text}`);
}
