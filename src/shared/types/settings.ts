export type AiProvider = 'openai' | 'anthropic' | 'gemini';
export type CursorStyle = 'block' | 'underline' | 'bar';
export type BellStyle = 'none' | 'sound' | 'visual';

export interface UserSettings {
  id: string;
  userId: string;
  theme: 'dark' | 'light';
  terminalFont: string;
  terminalFontSize: number;
  scrollbackLines: number;
  cursorStyle: CursorStyle;
  bellStyle: BellStyle;
  lineHeight: number;
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
  scrollbackLines?: number;
  cursorStyle?: CursorStyle;
  bellStyle?: BellStyle;
  lineHeight?: number;
  aiProvider?: AiProvider;
  openaiApiKey?: string | null;
  anthropicApiKey?: string | null;
  geminiApiKey?: string | null;
}
