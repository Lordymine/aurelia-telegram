import { InputFile } from 'grammy';
import type { Context } from 'grammy';
import { logger } from '../../utils/logger.js';

/**
 * Send typing indicator (chat action) while an operation is in progress.
 * Returns a stop function to cancel the typing indicator.
 */
export function startTypingIndicator(ctx: Context): () => void {
  let running = true;

  const sendTyping = () => {
    if (!running) return;
    ctx.replyWithChatAction('typing').catch(() => {});
  };

  // Send immediately, then every 4 seconds (Telegram typing expires after ~5s)
  sendTyping();
  const interval = setInterval(sendTyping, 4000);

  return () => {
    running = false;
    clearInterval(interval);
  };
}

/**
 * Send a file as a Telegram document.
 */
export async function sendFileAsDocument(
  ctx: Context,
  content: string,
  filename: string,
  caption?: string,
): Promise<void> {
  try {
    const buffer = Buffer.from(content, 'utf-8');
    await ctx.replyWithDocument(
      new InputFile(buffer, filename),
      caption ? { caption } : undefined,
    );
  } catch (err) {
    logger.error({ err, filename }, 'Failed to send document');
    // Fallback: send as text
    await ctx.reply(`File: ${filename}\n\n${content.slice(0, 4000)}`);
  }
}

/**
 * Send a long message, splitting if needed.
 */
export async function sendLongMessage(
  ctx: Context,
  text: string,
  parseMode?: 'HTML' | 'MarkdownV2' | 'Markdown',
): Promise<void> {
  const { splitMessage } = await import('./formatter.js');
  const chunks = splitMessage(text);

  for (const chunk of chunks) {
    await ctx.reply(chunk, parseMode ? { parse_mode: parseMode } : undefined);
  }
}
