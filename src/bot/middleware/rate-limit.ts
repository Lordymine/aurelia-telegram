import type { Middleware } from 'grammy';
import { logger } from '../../utils/logger.js';

export interface RateLimitOptions {
  /** Maximum messages per window. Default: 30 */
  maxMessages?: number;
  /** Time window in milliseconds. Default: 60000 (1 minute) */
  windowMs?: number;
  /** Message sent when rate limited */
  limitMessage?: string;
}

interface UserBucket {
  count: number;
  resetAt: number;
}

export function createRateLimitMiddleware(options: RateLimitOptions = {}): Middleware {
  const maxMessages = options.maxMessages ?? 30;
  const windowMs = options.windowMs ?? 60_000;
  const limitMessage = options.limitMessage ?? 'You are sending messages too quickly. Please wait a moment.';

  const buckets = new Map<number, UserBucket>();

  // Cleanup old buckets periodically
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [userId, bucket] of buckets) {
      if (now > bucket.resetAt) {
        buckets.delete(userId);
      }
    }
  }, windowMs * 2);

  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }

  return async (ctx, next) => {
    const userId = ctx.from?.id;
    if (!userId) {
      await next();
      return;
    }

    const now = Date.now();
    let bucket = buckets.get(userId);

    if (!bucket || now > bucket.resetAt) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(userId, bucket);
    }

    bucket.count++;

    if (bucket.count > maxMessages) {
      logger.warn({ userId, count: bucket.count, maxMessages }, 'Rate limit exceeded');
      await ctx.reply(limitMessage);
      return;
    }

    await next();
  };
}
