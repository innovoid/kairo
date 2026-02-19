export type AiProvider = 'openai' | 'anthropic' | 'gemini';

export interface UserSettings {
  id: string;
  userId: string;
  theme: 'dark' | 'light';
  terminalFont: string;
  terminalFontSize: number;
  aiProvider: AiProvider;
  openaiApiKeyEncrypted: string | null;
  anthropicApiKeyEncrypted: string | null;
  geminiApiKeyEncrypted: string | null;
  updatedAt: string;
}

export interface UpdateSettingsInput {
  theme?: 'dark' | 'light';
  terminalFont?: string;
  terminalFontSize?: number;
  aiProvider?: AiProvider;
  openaiApiKey?: string | null;
  anthropicApiKey?: string | null;
  geminiApiKey?: string | null;
}
