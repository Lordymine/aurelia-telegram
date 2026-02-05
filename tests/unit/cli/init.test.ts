import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies before importing the module under test
vi.mock('node:readline/promises', () => ({
  createInterface: vi.fn(),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn().mockReturnValue(false),
}));

vi.mock('../../../src/config/manager.js', () => ({
  saveConfig: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('node:crypto', async (importOriginal) => {
  const orig = await importOriginal<typeof import('node:crypto')>();
  return {
    ...orig,
    randomBytes: vi.fn().mockReturnValue(Buffer.from('0123456789abcdef')),
  };
});

import { createInterface } from 'node:readline/promises';
import { saveConfig } from '../../../src/config/manager.js';
import { runInitWizard } from '../../../src/cli/wizard.js';

describe('Init Wizard Flow', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let mockRl: { question: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockRl = {
      question: vi.fn(),
      close: vi.fn(),
    };
    vi.mocked(createInterface).mockReturnValue(mockRl as unknown as ReturnType<typeof createInterface>);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should complete wizard with valid inputs', async () => {
    // Mock fetch for bot token validation
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: () =>
          Promise.resolve({
            ok: true,
            result: { id: 1, is_bot: true, username: 'test_bot' },
          }),
      }),
    );

    // Wizard prompts: botToken, telegramIds, projectPath
    mockRl.question
      .mockResolvedValueOnce('valid-bot-token') // bot token
      .mockResolvedValueOnce('123456789') // telegram IDs
      .mockResolvedValueOnce(''); // project path (use default)

    await runInitWizard();

    expect(saveConfig).toHaveBeenCalledOnce();
    const savedConfig = vi.mocked(saveConfig).mock.calls[0]![0];
    expect(savedConfig.botToken).toBe('valid-bot-token');
    expect(savedConfig.allowedUsers).toEqual([123456789]);
    expect(savedConfig.encryption).toBeDefined();

    // Should show success message
    const logCalls = consoleSpy.mock.calls.map((c) => c[0]);
    expect(logCalls.some((msg) => typeof msg === 'string' && msg.includes('saved successfully'))).toBe(true);
    expect(logCalls.some((msg) => typeof msg === 'string' && msg.includes('aurelia-telegram start'))).toBe(true);

    vi.unstubAllGlobals();
  });

  it('should retry on invalid bot token', async () => {
    let callCount = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            json: () => Promise.resolve({ ok: false, description: 'Unauthorized' }),
          });
        }
        return Promise.resolve({
          json: () =>
            Promise.resolve({
              ok: true,
              result: { id: 1, is_bot: true, username: 'good_bot' },
            }),
        });
      }),
    );

    mockRl.question
      .mockResolvedValueOnce('bad-token') // first attempt - invalid
      .mockResolvedValueOnce('good-token') // second attempt - valid
      .mockResolvedValueOnce('111') // telegram IDs
      .mockResolvedValueOnce(''); // project path

    await runInitWizard();

    expect(saveConfig).toHaveBeenCalledOnce();
    expect(vi.mocked(saveConfig).mock.calls[0]![0].botToken).toBe('good-token');

    vi.unstubAllGlobals();
  });

  it('should retry on invalid telegram IDs', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: () =>
          Promise.resolve({
            ok: true,
            result: { id: 1, is_bot: true, username: 'test_bot' },
          }),
      }),
    );

    mockRl.question
      .mockResolvedValueOnce('token-123') // bot token
      .mockResolvedValueOnce('abc') // invalid IDs
      .mockResolvedValueOnce('456') // valid IDs
      .mockResolvedValueOnce(''); // project path

    await runInitWizard();

    expect(vi.mocked(saveConfig).mock.calls[0]![0].allowedUsers).toEqual([456]);

    vi.unstubAllGlobals();
  });

  it('should accept multiple telegram IDs', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: () =>
          Promise.resolve({
            ok: true,
            result: { id: 1, is_bot: true, username: 'test_bot' },
          }),
      }),
    );

    mockRl.question
      .mockResolvedValueOnce('token-123')
      .mockResolvedValueOnce('111,222,333')
      .mockResolvedValueOnce('');

    await runInitWizard();

    expect(vi.mocked(saveConfig).mock.calls[0]![0].allowedUsers).toEqual([111, 222, 333]);

    vi.unstubAllGlobals();
  });

  it('should close readline on completion', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: () =>
          Promise.resolve({
            ok: true,
            result: { id: 1, is_bot: true, username: 'test_bot' },
          }),
      }),
    );

    mockRl.question
      .mockResolvedValueOnce('token')
      .mockResolvedValueOnce('111')
      .mockResolvedValueOnce('');

    await runInitWizard();

    expect(mockRl.close).toHaveBeenCalledOnce();

    vi.unstubAllGlobals();
  });
});
