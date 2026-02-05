import { describe, it, expect, vi } from 'vitest';
import { createCommandHandlers } from '../../../../src/bot/handlers/commands.js';
import type { AureliaConfig } from '../../../../src/config/schema.js';

const mockConfig: AureliaConfig = {
  version: '1.0.0',
  botToken: 'test-token',
  allowedUsers: [111, 222],
  projectPath: '/test/project',
  deployMode: 'local',
  kimi: {},
  encryption: { salt: 'test-salt', iv: 'test-iv' },
};

function createMockCommandContext(overrides = {}) {
  return {
    from: { id: 111, first_name: 'TestUser' },
    message: { text: '/start' },
    reply: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('Command Handlers', () => {
  const { handleStart, handleHelp, handleStatus } = createCommandHandlers(mockConfig);

  describe('/start', () => {
    it('should send welcome message with user name', async () => {
      const ctx = createMockCommandContext();

      await handleStart(ctx as never);

      expect(ctx.reply).toHaveBeenCalledOnce();
      const msg = ctx.reply.mock.calls[0]![0] as string;
      expect(msg).toContain('Welcome, TestUser');
      expect(msg).toContain('/help');
    });

    it('should include project path and deploy mode', async () => {
      const ctx = createMockCommandContext();

      await handleStart(ctx as never);

      const msg = ctx.reply.mock.calls[0]![0] as string;
      expect(msg).toContain('/test/project');
      expect(msg).toContain('local');
    });

    it('should fallback to "there" when first_name is missing', async () => {
      const ctx = createMockCommandContext({ from: { id: 111 } });

      await handleStart(ctx as never);

      const msg = ctx.reply.mock.calls[0]![0] as string;
      expect(msg).toContain('Welcome, there');
    });
  });

  describe('/help', () => {
    it('should list available commands', async () => {
      const ctx = createMockCommandContext();

      await handleHelp(ctx as never);

      expect(ctx.reply).toHaveBeenCalledOnce();
      const msg = ctx.reply.mock.calls[0]![0] as string;
      expect(msg).toContain('/start');
      expect(msg).toContain('/help');
      expect(msg).toContain('/status');
    });

    it('should mention future capabilities', async () => {
      const ctx = createMockCommandContext();

      await handleHelp(ctx as never);

      const msg = ctx.reply.mock.calls[0]![0] as string;
      expect(msg).toContain('Kimi');
      expect(msg).toContain('ADE');
    });
  });

  describe('/status', () => {
    it('should show deploy mode and project path', async () => {
      const ctx = createMockCommandContext();

      await handleStatus(ctx as never);

      expect(ctx.reply).toHaveBeenCalledOnce();
      const msg = ctx.reply.mock.calls[0]![0] as string;
      expect(msg).toContain('local');
      expect(msg).toContain('/test/project');
    });

    it('should show number of allowed users', async () => {
      const ctx = createMockCommandContext();

      await handleStatus(ctx as never);

      const msg = ctx.reply.mock.calls[0]![0] as string;
      expect(msg).toContain('2');
    });

    it('should show Kimi as not configured', async () => {
      const ctx = createMockCommandContext();

      await handleStatus(ctx as never);

      const msg = ctx.reply.mock.calls[0]![0] as string;
      expect(msg).toContain('not configured');
    });

    it('should include uptime', async () => {
      const ctx = createMockCommandContext();

      await handleStatus(ctx as never);

      const msg = ctx.reply.mock.calls[0]![0] as string;
      expect(msg).toContain('Uptime:');
    });
  });
});
