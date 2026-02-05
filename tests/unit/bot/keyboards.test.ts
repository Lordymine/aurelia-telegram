import { describe, it, expect } from 'vitest';
import { approvalKeyboard, agentSelectionKeyboard, retryKeyboard, confirmKeyboard, parseCallbackData } from '../../../src/bot/utils/keyboards.js';

describe('keyboards', () => {
  describe('approvalKeyboard', () => {
    it('should create keyboard with approve/reject buttons', () => {
      const kb = approvalKeyboard('job-123');
      const rows = kb.inline_keyboard;
      expect(rows).toHaveLength(1);
      expect(rows[0]).toHaveLength(2);
      expect(rows[0]![0]!.text).toBe('Approve');
      expect(rows[0]![0]!.callback_data).toBe('approve:job-123');
      expect(rows[0]![1]!.text).toBe('Reject');
      expect(rows[0]![1]!.callback_data).toBe('reject:job-123');
    });
  });

  describe('agentSelectionKeyboard', () => {
    it('should create keyboard with agent buttons', () => {
      const kb = agentSelectionKeyboard();
      const rows = kb.inline_keyboard;
      expect(rows).toHaveLength(3);
      expect(rows[0]![0]!.text).toBe('@dev');
      expect(rows[0]![0]!.callback_data).toBe('agent:dev');
    });
  });

  describe('retryKeyboard', () => {
    it('should create keyboard with retry/cancel buttons', () => {
      const kb = retryKeyboard('job-456');
      const rows = kb.inline_keyboard;
      expect(rows[0]![0]!.text).toBe('Retry');
      expect(rows[0]![0]!.callback_data).toBe('retry:job-456');
      expect(rows[0]![1]!.text).toBe('Cancel');
      expect(rows[0]![1]!.callback_data).toBe('cancel:job-456');
    });
  });

  describe('confirmKeyboard', () => {
    it('should create yes/no keyboard', () => {
      const kb = confirmKeyboard('action-1');
      const rows = kb.inline_keyboard;
      expect(rows[0]![0]!.text).toBe('Yes');
      expect(rows[0]![0]!.callback_data).toBe('confirm:action-1');
      expect(rows[0]![1]!.text).toBe('No');
      expect(rows[0]![1]!.callback_data).toBe('deny:action-1');
    });
  });

  describe('parseCallbackData', () => {
    it('should parse valid callback data', () => {
      expect(parseCallbackData('approve:job-123')).toEqual({ action: 'approve', value: 'job-123' });
    });

    it('should handle value with colons', () => {
      expect(parseCallbackData('agent:some:value')).toEqual({ action: 'agent', value: 'some:value' });
    });

    it('should return null for malformed data', () => {
      expect(parseCallbackData('nocolon')).toBeNull();
    });
  });
});
