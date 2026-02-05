import { logger } from '../utils/logger.js';

const KIMI_API_BASE = process.env.KIMI_CODE_BASE_URL ?? 'https://api.kimi.com/coding/v1';
const CHAT_ENDPOINT = `${KIMI_API_BASE}/chat/completions`;
const DEFAULT_MODEL = 'kimi-k2.5';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionResponse {
  id: string;
  choices: Array<{
    index: number;
    message: {
      role: 'assistant';
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export async function chatCompletion(
  accessToken: string,
  messages: ChatMessage[],
  options: { model?: string; temperature?: number; maxTokens?: number } = {},
): Promise<string> {
  const { model = DEFAULT_MODEL, temperature = 0.3, maxTokens = 4096 } = options;

  logger.debug({ messageCount: messages.length, model }, 'Kimi chat request');

  const response = await fetch(CHAT_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Kimi API error: ${response.status} ${text}`);
  }

  const data = (await response.json()) as ChatCompletionResponse;
  const content = data.choices[0]?.message.content;

  if (!content) {
    throw new Error('Kimi returned empty response');
  }

  logger.debug({ tokens: data.usage?.total_tokens }, 'Kimi chat response');
  return content;
}
