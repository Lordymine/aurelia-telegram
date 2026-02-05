import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAuthMiddleware } from '../../../../src/bot/middleware/auth.js';
import type { AureliaConfig } from '../../../../src/config/schema.js';

const mockConfig: AureliaConfig = {
  version: '1.0.0',
  botToken: 'test-token',
  allowedUsers: [111, 222, 333],
  projectPath: '/test/project',
  deployMode: 'local',
  kimi: {},
  encryption: { salt: 'test-salt', iv: 'test-iv' },
};

function createMockContext(userId?: number) {
  return {
    from: userId !== undefined ? { id: userId } : undefined,
    reply: vi.fn().mockResolvedValue(undefined),
  };
}

describe('Auth Middleware', () => {
  let middleware: ReturnType<typeof createAuthMiddleware>;

  beforeEach(() => {
    middleware = createAuthMiddleware(mockConfig);
  });

  it('should call next() for authorized users', async () => {
    const ctx = createMockContext(111);
    const next = vi.fn().mockResolvedValue(undefined);

    await middleware(ctx as never, next);

    expect(next).toHaveBeenCalledOnce();
    expect(ctx.reply).not.toHaveBeenCalled();
  });

  it('should reject unauthorized users', async () => {
    const ctx = createMockContext(999);
    const next = vi.fn().mockResolvedValue(undefined);

    await middleware(ctx as never, next);

    expect(next).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith('Unauthorized.');
  });

  it('should reject when from is undefined', async () => {
    const ctx = createMockContext();
    const next = vi.fn().mockResolvedValue(undefined);

    await middleware(ctx as never, next);

    expect(next).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith('Unauthorized.');
  });

  it('should allow all authorized users in whitelist', async () => {
    const next = vi.fn().mockResolvedValue(undefined);

    for (const userId of [111, 222, 333]) {
      const ctx = createMockContext(userId);
      await middleware(ctx as never, next);
      expect(ctx.reply).not.toHaveBeenCalled();
    }

    expect(next).toHaveBeenCalledTimes(3);
  });

  it('should work with empty allowedUsers list', async () => {
    const emptyConfig = { ...mockConfig, allowedUsers: [] };
    const emptyMiddleware = createAuthMiddleware(emptyConfig);
    const ctx = createMockContext(111);
    const next = vi.fn().mockResolvedValue(undefined);

    await emptyMiddleware(ctx as never, next);

    expect(next).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith('Unauthorized.');
  });
});
