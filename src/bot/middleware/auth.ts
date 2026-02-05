import type { Middleware } from 'grammy';
import type { AureliaConfig } from '../../config/schema.js';
import { logger } from '../../utils/logger.js';

const UNAUTHORIZED_MESSAGE = 'Unauthorized.';

export function createAuthMiddleware(config: AureliaConfig): Middleware {
  return async (ctx, next) => {
    const userId = ctx.from?.id;

    if (!userId || !config.allowedUsers.includes(userId)) {
      logger.warn({ userId: userId ?? 'unknown' }, 'Unauthorized access attempt');
      await ctx.reply(UNAUTHORIZED_MESSAGE);
      return;
    }

    await next();
  };
}
