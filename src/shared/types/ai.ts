import type { AiProvider } from './settings';

export interface AiMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
}

export interface AiStreamEvent {
  type: 'chunk' | 'done' | 'error';
  requestId: string;
  content?: string;
  error?: string;
}

export interface AiCompleteInput {
  provider: AiProvider;
  apiKey: string;
  model: string;
  messages: AiMessage[];
  requestId: string;
}

export interface AiTranslateInput {
  provider: AiProvider;
  apiKey: string;
  model: string;
  naturalLanguage: string;
  requestId: string;
}
