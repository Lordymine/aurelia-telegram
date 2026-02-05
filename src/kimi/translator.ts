import { chatCompletion } from './client.js';
import { loadProtocol } from './protocol-loader.js';
import { logger } from '../utils/logger.js';
import type { ChatMessage } from './client.js';

const MAX_TELEGRAM_LENGTH = 4096;
const SAFE_MESSAGE_LENGTH = 3900;

export interface ADECommand {
  action: 'execute' | 'query' | 'approve' | 'cancel' | 'clarify';
  agent: string;
  command: string;
  args: Record<string, unknown>;
  confidence: number;
  rawPrompt: string;
  clarification?: string;
}

export async function translateUserToADE(
  accessToken: string,
  userMessage: string,
  conversationHistory: ChatMessage[] = [],
): Promise<ADECommand> {
  const protocol = loadProtocol();

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content:
        protocol +
        '\n\n---\n\nRespond ONLY with a valid JSON object matching this schema:\n' +
        '{ "action": string, "agent": string, "command": string, "args": object, "confidence": number, "rawPrompt": string, "clarification": string|null }',
    },
    ...conversationHistory.slice(-10), // Last 10 messages for context
    { role: 'user', content: userMessage },
  ];

  logger.debug({ messageLength: userMessage.length }, 'Translating user message to ADE');

  const response = await chatCompletion(accessToken, messages);

  try {
    // Extract JSON from response (may be wrapped in markdown code blocks)
    const jsonStr = response.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(jsonStr) as ADECommand;

    // Validate required fields
    if (!parsed.action || typeof parsed.confidence !== 'number') {
      throw new Error('Missing required fields in ADE command');
    }

    return parsed;
  } catch (err) {
    logger.error({ err, response }, 'Failed to parse ADE command from Kimi response');
    return {
      action: 'clarify',
      agent: '',
      command: '',
      args: {},
      confidence: 0,
      rawPrompt: '',
      clarification: 'I could not understand your request. Could you rephrase it?',
    };
  }
}

export async function translateADEToUser(
  accessToken: string,
  adeOutput: string,
  context: string = '',
): Promise<string> {
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content:
        'You are translating ADE (development engine) output into a user-friendly Telegram message.\n' +
        'Rules:\n' +
        '- Keep it concise (under 3000 chars)\n' +
        '- Use Telegram-compatible markdown\n' +
        '- Summarize long outputs\n' +
        '- Highlight key results, errors, or next steps\n' +
        '- Never expose internal errors or API keys',
    },
    {
      role: 'user',
      content: `Context: ${context}\n\nADE Output:\n${adeOutput}\n\nTranslate this into a user-friendly Telegram message.`,
    },
  ];

  logger.debug({ outputLength: adeOutput.length }, 'Translating ADE output to user');

  const response = await chatCompletion(accessToken, messages);
  return response;
}

export function splitMessage(text: string): string[] {
  if (text.length <= MAX_TELEGRAM_LENGTH) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= SAFE_MESSAGE_LENGTH) {
      chunks.push(remaining);
      break;
    }

    // Try to split at paragraph boundary
    let splitIndex = remaining.lastIndexOf('\n\n', SAFE_MESSAGE_LENGTH);

    // Try single newline
    if (splitIndex <= 0) {
      splitIndex = remaining.lastIndexOf('\n', SAFE_MESSAGE_LENGTH);
    }

    // Try space
    if (splitIndex <= 0) {
      splitIndex = remaining.lastIndexOf(' ', SAFE_MESSAGE_LENGTH);
    }

    // Hard split as last resort
    if (splitIndex <= 0) {
      splitIndex = SAFE_MESSAGE_LENGTH;
    }

    chunks.push(remaining.slice(0, splitIndex));
    remaining = remaining.slice(splitIndex).trimStart();
  }

  return chunks;
}
