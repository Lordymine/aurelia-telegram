import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { chatCompletion } from '../../../src/kimi/client.js';

describe('Kimi Client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should return assistant content on success', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          id: 'chat-123',
          choices: [{ index: 0, message: { role: 'assistant', content: 'Hello!' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
    } as Response);

    const result = await chatCompletion('token-123', [{ role: 'user', content: 'Hi' }]);
    expect(result).toBe('Hello!');
  });

  it('should throw on API error', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Unauthorized'),
    } as Response);

    await expect(chatCompletion('bad-token', [{ role: 'user', content: 'Hi' }])).rejects.toThrow('Kimi API error: 401');
  });

  it('should throw on empty response', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          id: 'chat-123',
          choices: [],
          usage: { prompt_tokens: 10, completion_tokens: 0, total_tokens: 10 },
        }),
    } as Response);

    await expect(chatCompletion('token', [{ role: 'user', content: 'Hi' }])).rejects.toThrow('empty response');
  });

  it('should send correct request format', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          id: 'chat-123',
          choices: [{ index: 0, message: { role: 'assistant', content: 'OK' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
    } as Response);

    await chatCompletion('my-token', [{ role: 'user', content: 'test' }], { temperature: 0.5 });

    const call = vi.mocked(fetch).mock.calls[0]!;
    expect(call[0]).toContain('chat/completions');
    const body = JSON.parse((call[1] as RequestInit).body as string);
    expect(body.temperature).toBe(0.5);
    expect((call[1] as RequestInit).headers).toHaveProperty('Authorization', 'Bearer my-token');
  });
});
