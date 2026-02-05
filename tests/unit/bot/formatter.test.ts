import { describe, it, expect } from 'vitest';
import { splitMessage, codeBlock, escapeMarkdownV2, formatADEOutput } from '../../../src/bot/utils/formatter.js';

describe('formatter', () => {
  describe('splitMessage', () => {
    it('should return single chunk for short messages', () => {
      const result = splitMessage('Hello world');
      expect(result).toEqual(['Hello world']);
    });

    it('should split at paragraph boundary', () => {
      const text = 'A'.repeat(3000) + '\n\n' + 'B'.repeat(2000);
      const result = splitMessage(text, 4096);
      expect(result).toHaveLength(2);
      expect(result[0]).toBe('A'.repeat(3000));
      expect(result[1]).toBe('B'.repeat(2000));
    });

    it('should split at newline when no paragraph boundary', () => {
      const text = 'A'.repeat(3000) + '\n' + 'B'.repeat(2000);
      const result = splitMessage(text, 4096);
      expect(result).toHaveLength(2);
      expect(result[0]).toBe('A'.repeat(3000));
      expect(result[1]).toBe('B'.repeat(2000));
    });

    it('should split at sentence boundary as fallback', () => {
      const text = 'A'.repeat(3000) + '. ' + 'B'.repeat(2000);
      const result = splitMessage(text, 4096);
      expect(result).toHaveLength(2);
      expect(result[0]).toBe('A'.repeat(3000) + '.');
    });

    it('should handle very long messages with multiple splits', () => {
      const text = 'A'.repeat(10000);
      const result = splitMessage(text, 4096);
      expect(result.length).toBeGreaterThan(2);
      for (const chunk of result) {
        expect(chunk.length).toBeLessThanOrEqual(4096);
      }
    });

    it('should return empty array for empty string', () => {
      const result = splitMessage('');
      expect(result).toEqual(['']);
    });

    it('should use custom max length', () => {
      const text = 'Hello world, this is a test message.';
      const result = splitMessage(text, 10);
      expect(result.length).toBeGreaterThan(1);
    });
  });

  describe('codeBlock', () => {
    it('should wrap code in fences', () => {
      expect(codeBlock('const x = 1')).toBe('```\nconst x = 1\n```');
    });

    it('should include language hint', () => {
      expect(codeBlock('const x = 1', 'typescript')).toBe('```typescript\nconst x = 1\n```');
    });
  });

  describe('escapeMarkdownV2', () => {
    it('should escape special characters', () => {
      expect(escapeMarkdownV2('Hello_world')).toBe('Hello\\_world');
      expect(escapeMarkdownV2('a*b*c')).toBe('a\\*b\\*c');
      expect(escapeMarkdownV2('test.end')).toBe('test\\.end');
    });

    it('should handle text without special chars', () => {
      expect(escapeMarkdownV2('Hello world')).toBe('Hello world');
    });
  });

  describe('formatADEOutput', () => {
    it('should leave text with code fences as-is', () => {
      const text = '```\ncode here\n```';
      expect(formatADEOutput(text)).toBe(text);
    });

    it('should wrap heavily indented text in code block', () => {
      const lines = Array.from({ length: 5 }, (_, i) => `  line${i}`).join('\n');
      const result = formatADEOutput(lines);
      expect(result).toContain('```');
    });

    it('should leave normal text as-is', () => {
      const text = 'This is a normal response without code.';
      expect(formatADEOutput(text)).toBe(text);
    });
  });
});
