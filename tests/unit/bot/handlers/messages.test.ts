import { describe, it, expect, vi } from 'vitest';
import { handleMessage } from '../../../../src/bot/handlers/messages.js';

function createMockContext(text?: string) {
  return {
    from: { id: 111 },
    message: text !== undefined ? { text } : undefined,
    reply: vi.fn().mockResolvedValue(undefined),
  };
}

describe('Message Handler', () => {
  it('should echo back the user message', async () => {
    const ctx = createMockContext('Hello world');

    await handleMessage(ctx as never);

    expect(ctx.reply).toHaveBeenCalledWith('Echo: Hello world');
  });

  it('should handle empty string message', async () => {
    const ctx = createMockContext('');

    await handleMessage(ctx as never);

    // Empty string is falsy, so handler returns early
    expect(ctx.reply).not.toHaveBeenCalled();
  });

  it('should not reply when message has no text', async () => {
    const ctx = createMockContext();

    await handleMessage(ctx as never);

    expect(ctx.reply).not.toHaveBeenCalled();
  });

  it('should preserve message content exactly', async () => {
    const ctx = createMockContext('special chars: <>&"\'');

    await handleMessage(ctx as never);

    expect(ctx.reply).toHaveBeenCalledWith('Echo: special chars: <>&"\'');
  });

  it('should handle long messages', async () => {
    const longText = 'A'.repeat(4000);
    const ctx = createMockContext(longText);

    await handleMessage(ctx as never);

    expect(ctx.reply).toHaveBeenCalledWith(`Echo: ${longText}`);
  });
});
