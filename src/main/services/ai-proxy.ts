import type { WebContents } from 'electron';
import type { AiCompleteInput, AiTranslateInput } from '../../shared/types/ai';

type ChatMessage = Array<{ role: string; content: string }>;

async function resolveModel(provider: string, apiKey: string, modelId: string) {
  if (provider === 'openai') {
    const { createOpenAI } = await import('@ai-sdk/openai');
    return createOpenAI({ apiKey })(modelId);
  }
  if (provider === 'anthropic') {
    const { createAnthropic } = await import('@ai-sdk/anthropic');
    return createAnthropic({ apiKey })(modelId);
  }
  if (provider === 'gemini') {
    const { createGoogleGenerativeAI } = await import('@ai-sdk/google');
    return createGoogleGenerativeAI({ apiKey })(modelId);
  }
  throw new Error(`Unknown provider: ${provider}`);
}

async function streamText(
  provider: string,
  apiKey: string,
  modelId: string,
  messages: ChatMessage,
  requestId: string,
  sender: WebContents
): Promise<void> {
  // Dynamic import to avoid top-level failures if AI SDK not installed
  const { streamText } = await import('ai');

  try {
    const model = await resolveModel(provider, apiKey, modelId);
    const result = streamText({
      model,
      messages: messages.map((m) => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
      })),
    });

    for await (const chunk of result.textStream) {
      if (!sender.isDestroyed()) {
        sender.send('ai:chunk', requestId, chunk);
      }
    }

    if (!sender.isDestroyed()) {
      sender.send('ai:done', requestId);
    }
  } catch (err) {
    if (!sender.isDestroyed()) {
      sender.send('ai:error', requestId, (err as Error).message);
    }
  }
}

export const aiProxy = {
  resolveModel,

  async completeText(
    provider: string,
    apiKey: string,
    model: string,
    messages: ChatMessage
  ): Promise<string> {
    const { streamText } = await import('ai');
    const resolvedModel = await resolveModel(provider, apiKey, model);
    const result = streamText({
      model: resolvedModel,
      messages: messages.map((m) => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
      })),
    });

    let output = '';
    for await (const chunk of result.textStream) {
      output += chunk;
    }
    return output;
  },

  async complete(input: AiCompleteInput, sender: WebContents): Promise<void> {
    await streamText(
      input.provider,
      input.apiKey,
      input.model,
      input.messages.map((m) => ({ role: m.role, content: m.content })),
      input.requestId,
      sender
    );
  },

  async translateCommand(input: AiTranslateInput, sender: WebContents): Promise<void> {
    const systemMessage = {
      role: 'system',
      content: `You are an expert Linux/Unix command-line assistant.
The user will describe what they want to do in natural language.
Respond ONLY with the exact shell command(s) they need, no explanation.
If multiple commands are needed, separate them with && or use semicolons.
Do not include markdown code blocks, just the raw command.`,
    };

    await streamText(
      input.provider,
      input.apiKey,
      input.model,
      [systemMessage, { role: 'user', content: input.naturalLanguage }],
      input.requestId,
      sender
    );
  },
};
