import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { splitMessage, translateUserToADE, translateADEToUser } from '../../../src/kimi/translator.js';

vi.mock('../../../src/kimi/client.js', () => ({
  chatCompletion: vi.fn(),
}));

vi.mock('../../../src/kimi/protocol-loader.js', () => ({
  loadProtocol: vi.fn().mockReturnValue('Mock protocol content'),
}));

import { chatCompletion } from '../../../src/kimi/client.js';

describe('Kimi Translator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('translateUserToADE', () => {
    it('should parse valid ADE command from Kimi response', async () => {
      const adeCommand = {
        action: 'execute',
        agent: '@dev',
        command: '*develop',
        args: { story: '1.4' },
        confidence: 0.9,
        rawPrompt: '@dev *develop 1.4',
        clarification: null,
      };

      vi.mocked(chatCompletion).mockResolvedValue(JSON.stringify(adeCommand));

      const result = await translateUserToADE('token', 'implementa a story 1.4');
      expect(result.action).toBe('execute');
      expect(result.agent).toBe('@dev');
      expect(result.confidence).toBe(0.9);
    });

    it('should handle JSON wrapped in code blocks', async () => {
      const json = '{"action":"query","agent":"","command":"status","args":{},"confidence":0.8,"rawPrompt":"status","clarification":null}';
      vi.mocked(chatCompletion).mockResolvedValue('```json\n' + json + '\n```');

      const result = await translateUserToADE('token', 'qual o status?');
      expect(result.action).toBe('query');
      expect(result.confidence).toBe(0.8);
    });

    it('should return clarify action on parse error', async () => {
      vi.mocked(chatCompletion).mockResolvedValue('I do not understand this request');

      const result = await translateUserToADE('token', 'xyzzy');
      expect(result.action).toBe('clarify');
      expect(result.confidence).toBe(0);
      expect(result.clarification).toContain('rephrase');
    });

    it('should include conversation history (last 10)', async () => {
      vi.mocked(chatCompletion).mockResolvedValue('{"action":"execute","agent":"@dev","command":"*build","args":{},"confidence":0.9,"rawPrompt":"@dev *build","clarification":null}');

      const history = Array.from({ length: 15 }, (_, i) => ({
        role: 'user' as const,
        content: `message ${i}`,
      }));

      await translateUserToADE('token', 'build it', history);

      const messages = vi.mocked(chatCompletion).mock.calls[0]![1]!;
      // system + 10 history + 1 current = 12
      expect(messages.length).toBe(12);
    });
  });

  describe('translateADEToUser', () => {
    it('should return translated response', async () => {
      vi.mocked(chatCompletion).mockResolvedValue('Build completed successfully! All 97 tests passed.');

      const result = await translateADEToUser('token', 'Build output: 97 tests passed');
      expect(result).toContain('tests passed');
    });
  });

  describe('splitMessage', () => {
    it('should return single chunk for short messages', () => {
      const result = splitMessage('Hello world');
      expect(result).toEqual(['Hello world']);
    });

    it('should not split messages at or under 4096 chars', () => {
      const text = 'A'.repeat(4096);
      const result = splitMessage(text);
      expect(result).toHaveLength(1);
    });

    it('should split long messages at paragraph boundaries', () => {
      const part1 = 'A'.repeat(3800);
      const part2 = 'B'.repeat(500);
      const text = `${part1}\n\n${part2}`;
      const result = splitMessage(text);
      expect(result.length).toBeGreaterThanOrEqual(2);
    });

    it('should handle messages with no good split points', () => {
      const text = 'A'.repeat(8000);
      const result = splitMessage(text);
      expect(result.length).toBeGreaterThanOrEqual(2);
      expect(result.join('')).toBe(text);
    });

    it('should preserve content across all chunks', () => {
      const text = Array.from({ length: 100 }, (_, i) => `Line ${i}: ${'X'.repeat(50)}`).join('\n');
      const chunks = splitMessage(text);
      const reassembled = chunks.join('\n');
      // All content should be present (may have minor whitespace differences from trimStart)
      for (let i = 0; i < 100; i++) {
        expect(reassembled).toContain(`Line ${i}`);
      }
    });
  });
});
