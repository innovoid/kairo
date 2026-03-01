import type { IpcMainInvokeEvent } from 'electron';
import type { SupabaseClient } from '@supabase/supabase-js';
import { settingsQueries } from '../db';
import type { UserSettings, UpdateSettingsInput } from '../../shared/types/settings';

function getClient(event: IpcMainInvokeEvent): SupabaseClient {
  const client = (event as unknown as { supabase: SupabaseClient }).supabase;
  if (!client) throw new Error('Not authenticated');
  return client;
}

const TERMINAL_FONT_SIZE_RANGE = { min: 8, max: 32 };
const SCROLLBACK_RANGE = { min: 100, max: 1_000_000 };
const LINE_HEIGHT_RANGE = { min: 1, max: 2 };

function assertIntegerInRange(label: string, value: number, min: number, max: number): void {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${label} must be an integer between ${min} and ${max}`);
  }
}

function assertNumberInRange(label: string, value: number, min: number, max: number): void {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${label} must be between ${min} and ${max}`);
  }
}

const DEFAULT_SETTINGS: Omit<UserSettings, 'id' | 'userId' | 'updatedAt'> = {
  theme: 'dark',
  terminalFont: 'JetBrains Mono',
  terminalFontSize: 13,
  terminalTheme: 'dracula',
  promptStyle: 'default',
  scrollbackLines: 10000,
  cursorStyle: 'block',
  bellStyle: 'none',
  lineHeight: 1.0,
  copyOnSelect: false,
  aiProvider: 'gemini',
};

export const settingsIpcHandlers = {
  async get(event: IpcMainInvokeEvent): Promise<UserSettings> {
    const supabase = getClient(event);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Try local cache first
    const cached = settingsQueries.get(user.id);
    if (cached) {
      return JSON.parse(cached.data) as UserSettings;
    }

    // Fetch from Supabase
    const { data } = await supabase
      .from('settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (data) {
      const settings: UserSettings = {
        id: data.id,
        userId: data.user_id,
        theme: data.theme ?? 'dark',
        terminalFont: data.terminal_font ?? 'JetBrains Mono',
        terminalFontSize: data.terminal_font_size ?? 13,
        terminalTheme: data.terminal_theme ?? 'dracula',
        promptStyle: data.prompt_style ?? 'default',
        scrollbackLines: data.scrollback_lines ?? 10000,
        cursorStyle: data.cursor_style ?? 'block',
        bellStyle: data.bell_style ?? 'none',
        lineHeight: data.line_height ?? 1.0,
        copyOnSelect: data.copy_on_select ?? false,
        aiProvider: data.ai_provider ?? 'gemini',
        updatedAt: data.updated_at,
      };
      settingsQueries.upsert(user.id, JSON.stringify(settings));
      return settings;
    }

    // Return defaults for new user
    const defaults: UserSettings = {
      id: '',
      userId: user.id,
      ...DEFAULT_SETTINGS,
      updatedAt: new Date().toISOString(),
    };
    return defaults;
  },

  async update(event: IpcMainInvokeEvent, input: UpdateSettingsInput): Promise<UserSettings> {
    const supabase = getClient(event);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    if (input.terminalFontSize !== undefined) {
      assertIntegerInRange('terminalFontSize', input.terminalFontSize, TERMINAL_FONT_SIZE_RANGE.min, TERMINAL_FONT_SIZE_RANGE.max);
    }
    if (input.scrollbackLines !== undefined) {
      assertIntegerInRange('scrollbackLines', input.scrollbackLines, SCROLLBACK_RANGE.min, SCROLLBACK_RANGE.max);
    }
    if (input.lineHeight !== undefined) {
      assertNumberInRange('lineHeight', input.lineHeight, LINE_HEIGHT_RANGE.min, LINE_HEIGHT_RANGE.max);
    }

    const updates: Record<string, unknown> = {};
    if (input.theme !== undefined) updates.theme = input.theme;
    if (input.terminalFont !== undefined) updates.terminal_font = input.terminalFont;
    if (input.terminalFontSize !== undefined) updates.terminal_font_size = input.terminalFontSize;
    if (input.terminalTheme !== undefined) updates.terminal_theme = input.terminalTheme;
    if (input.promptStyle !== undefined) updates.prompt_style = input.promptStyle;
    if (input.scrollbackLines !== undefined) updates.scrollback_lines = input.scrollbackLines;
    if (input.cursorStyle !== undefined) updates.cursor_style = input.cursorStyle;
    if (input.bellStyle !== undefined) updates.bell_style = input.bellStyle;
    if (input.lineHeight !== undefined) updates.line_height = input.lineHeight;
    if (input.copyOnSelect !== undefined) updates.copy_on_select = input.copyOnSelect;
    if (input.aiProvider !== undefined) updates.ai_provider = input.aiProvider;

    const { data, error } = await supabase
      .from('settings')
      .upsert({ user_id: user.id, ...updates }, { onConflict: 'user_id' })
      .select('*')
      .single();

    if (error) throw error;

    const settings: UserSettings = {
      id: data.id,
      userId: data.user_id,
      theme: data.theme ?? 'dark',
      terminalFont: data.terminal_font ?? 'JetBrains Mono',
      terminalFontSize: data.terminal_font_size ?? 13,
      terminalTheme: data.terminal_theme ?? 'dracula',
      promptStyle: data.prompt_style ?? 'default',
      scrollbackLines: data.scrollback_lines ?? 10000,
      cursorStyle: data.cursor_style ?? 'block',
      bellStyle: data.bell_style ?? 'none',
      lineHeight: data.line_height ?? 1.0,
      copyOnSelect: data.copy_on_select ?? false,
      aiProvider: data.ai_provider ?? 'gemini',
      updatedAt: data.updated_at,
    };

    settingsQueries.upsert(user.id, JSON.stringify(settings));
    return settings;
  },
};
