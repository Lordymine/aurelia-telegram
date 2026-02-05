import { describe, it, expect, vi } from 'vitest';
import { createRateLimitMiddleware } from '../../../src/bot/middleware/rate-limit.js';

function createMockContext(userId: number) {
  return {
    from: { id: userId },
    reply: vi.fn().mockResolvedValue(undefined),
  };
}

describe('createRateLimitMiddleware', () => {
  it('should allow messages under the limit', async () => {
    const middleware = createRateLimitMiddleware({ maxMessages: 5, windowMs: 60000 });
    const ctx = createMockContext(111);
    const next = vi.fn().mockResolvedValue(undefined);

    await (middleware as any)(ctx, next);
    expect(next).toHaveBeenCalledOnce();
    expect(ctx.reply).not.toHaveBeenCalled();
  });

  it('should block messages over the limit', async () => {
    const middleware = createRateLimitMiddleware({ maxMessages: 2, windowMs: 60000 });
    const next = vi.fn().mockResolvedValue(undefined);

    const ctx = createMockContext(222);

    // Messages 1 and 2 should pass
    await (middleware as any)(ctx, next);
    await (middleware as any)(ctx, next);
    expect(next).toHaveBeenCalledTimes(2);

    // Message 3 should be blocked
    await (middleware as any)(ctx, next);
    expect(next).toHaveBeenCalledTimes(2); // Still 2
    expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('too quickly'));
  });

  it('should track users independently', async () => {
    const middleware = createRateLimitMiddleware({ maxMessages: 1, windowMs: 60000 });
    const next = vi.fn().mockResolvedValue(undefined);

    const ctx1 = createMockContext(111);
    const ctx2 = createMockContext(222);

    await (middleware as any)(ctx1, next);
    await (middleware as any)(ctx2, next);
    expect(next).toHaveBeenCalledTimes(2); // Both pass
  });

  it('should pass through if no userId', async () => {
    const middleware = createRateLimitMiddleware({ maxMessages: 1, windowMs: 60000 });
    const ctx = { from: undefined, reply: vi.fn() };
    const next = vi.fn().mockResolvedValue(undefined);

    await (middleware as any)(ctx, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('should use custom limit message', async () => {
    const middleware = createRateLimitMiddleware({ maxMessages: 1, windowMs: 60000, limitMessage: 'Slow down!' });
    const next = vi.fn().mockResolvedValue(undefined);
    const ctx = createMockContext(333);

    await (middleware as any)(ctx, next);
    await (middleware as any)(ctx, next);
    expect(ctx.reply).toHaveBeenCalledWith('Slow down!');
  });

  it('should use default options', async () => {
    const middleware = createRateLimitMiddleware();
    const ctx = createMockContext(444);
    const next = vi.fn().mockResolvedValue(undefined);

    await (middleware as any)(ctx, next);
    expect(next).toHaveBeenCalledOnce();
  });
});
