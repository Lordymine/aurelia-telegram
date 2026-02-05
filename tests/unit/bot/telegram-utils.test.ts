import { describe, it, expect, vi } from 'vitest';
import { startTypingIndicator, sendFileAsDocument, sendLongMessage } from '../../../src/bot/utils/telegram.js';

describe('telegram utils', () => {
  describe('startTypingIndicator', () => {
    it('should send typing action and return stop function', () => {
      const ctx = {
        replyWithChatAction: vi.fn().mockResolvedValue(undefined),
      };

      const stop = startTypingIndicator(ctx as any);
      expect(ctx.replyWithChatAction).toHaveBeenCalledWith('typing');
      expect(typeof stop).toBe('function');

      // Stop should not throw
      stop();
    });
  });

  describe('sendFileAsDocument', () => {
    it('should send content as a document', async () => {
      const ctx = {
        replyWithDocument: vi.fn().mockResolvedValue(undefined),
        reply: vi.fn().mockResolvedValue(undefined),
      };

      await sendFileAsDocument(ctx as any, 'file content', 'test.txt', 'A caption');
      expect(ctx.replyWithDocument).toHaveBeenCalledWith(
        expect.any(Object),
        { caption: 'A caption' },
      );
    });

    it('should send without caption if not provided', async () => {
      const ctx = {
        replyWithDocument: vi.fn().mockResolvedValue(undefined),
        reply: vi.fn().mockResolvedValue(undefined),
      };

      await sendFileAsDocument(ctx as any, 'content', 'file.md');
      expect(ctx.replyWithDocument).toHaveBeenCalledWith(
        expect.any(Object),
        undefined,
      );
    });

    it('should fallback to text on error', async () => {
      const ctx = {
        replyWithDocument: vi.fn().mockRejectedValue(new Error('fail')),
        reply: vi.fn().mockResolvedValue(undefined),
      };

      await sendFileAsDocument(ctx as any, 'fallback content', 'fail.txt');
      expect(ctx.reply).toHaveBeenCalledWith(expect.stringContaining('fallback content'));
    });
  });

  describe('sendLongMessage', () => {
    it('should send a short message as-is', async () => {
      const ctx = {
        reply: vi.fn().mockResolvedValue(undefined),
      };

      await sendLongMessage(ctx as any, 'Hello');
      expect(ctx.reply).toHaveBeenCalledTimes(1);
      expect(ctx.reply).toHaveBeenCalledWith('Hello', undefined);
    });

    it('should split and send long messages', async () => {
      const ctx = {
        reply: vi.fn().mockResolvedValue(undefined),
      };

      // Create a message longer than 4096
      const text = 'A'.repeat(5000) + '\n\n' + 'B'.repeat(1000);
      await sendLongMessage(ctx as any, text);
      expect(ctx.reply).toHaveBeenCalledTimes(2);
    });

    it('should pass parse_mode option', async () => {
      const ctx = {
        reply: vi.fn().mockResolvedValue(undefined),
      };

      await sendLongMessage(ctx as any, 'Hello', 'HTML');
      expect(ctx.reply).toHaveBeenCalledWith('Hello', { parse_mode: 'HTML' });
    });
  });
});
