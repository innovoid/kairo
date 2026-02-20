export type AiProvider = 'openai' | 'anthropic' | 'gemini';
export type CursorStyle = 'block' | 'underline' | 'bar';
export type BellStyle = 'none' | 'sound' | 'visual';
export type TerminalTheme = 'dracula' | 'tokyo-night' | 'catppuccin-mocha' | 'nord' | 'gruvbox-dark' | 'one-dark' | 'monokai' | 'material' | 'synthwave' | 'ayu-dark' | 'horizon' | 'github-dark';

export interface UserSettings {
  id: string;
  userId: string;
  theme: 'dark' | 'light';
  terminalFont: string;
  terminalFontSize: number;
  terminalTheme: TerminalTheme;
  scrollbackLines: number;
  cursorStyle: CursorStyle;
  bellStyle: BellStyle;
  lineHeight: number;
  aiProvider: AiProvider;
  updatedAt: string;
}

export interface UpdateSettingsInput {
  theme?: 'dark' | 'light';
  terminalFont?: string;
  terminalFontSize?: number;
  terminalTheme?: TerminalTheme;
  scrollbackLines?: number;
  cursorStyle?: CursorStyle;
  bellStyle?: BellStyle;
  lineHeight?: number;
  aiProvider?: AiProvider;
}
