import { InlineKeyboard } from 'grammy';

/**
 * Create an approval keyboard with Approve / Reject buttons.
 */
export function approvalKeyboard(jobId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text('Approve', `approve:${jobId}`)
    .text('Reject', `reject:${jobId}`);
}

/**
 * Create an agent selection keyboard.
 */
export function agentSelectionKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('@dev', 'agent:dev')
    .text('@qa', 'agent:qa')
    .row()
    .text('@architect', 'agent:architect')
    .text('@pm', 'agent:pm')
    .row()
    .text('@analyst', 'agent:analyst');
}

/**
 * Create a retry/cancel keyboard for failed operations.
 */
export function retryKeyboard(jobId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text('Retry', `retry:${jobId}`)
    .text('Cancel', `cancel:${jobId}`);
}

/**
 * Create a confirmation keyboard (Yes / No).
 */
export function confirmKeyboard(actionId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text('Yes', `confirm:${actionId}`)
    .text('No', `deny:${actionId}`);
}

/**
 * Parse callback data from inline keyboard button press.
 * Returns { action, value } or null if malformed.
 */
export function parseCallbackData(data: string): { action: string; value: string } | null {
  const colonIndex = data.indexOf(':');
  if (colonIndex === -1) return null;
  return {
    action: data.slice(0, colonIndex),
    value: data.slice(colonIndex + 1),
  };
}
