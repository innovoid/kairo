import type { IpcMainInvokeEvent } from 'electron';
import type { SupabaseClient } from '@supabase/supabase-js';
import { settingsQueries } from '../db';
import type { UserSettings, UpdateSettingsInput } from '../../shared/types/settings';

function getClient(event: IpcMainInvokeEvent): SupabaseClient {
  const client = (event as unknown as { supabase: SupabaseClient }).supabase;
  if (!client) throw new Error('Not authenticated');
  return client;
}

const DEFAULT_SETTINGS: Omit<UserSettings, 'id' | 'userId' | 'updatedAt'> = {
  theme: 'dark',
  terminalFont: 'JetBrains Mono',
  terminalFontSize: 14,
  scrollbackLines: 1000,
  cursorStyle: 'block',
  bellStyle: 'none',
  lineHeight: 1.2,
  aiProvider: 'openai',
  openaiApiKeyEncrypted: null,
  anthropicApiKeyEncrypted: null,
  geminiApiKeyEncrypted: null,
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
        terminalFontSize: data.terminal_font_size ?? 14,
        scrollbackLines: data.scrollback_lines ?? 1000,
        cursorStyle: data.cursor_style ?? 'block',
        bellStyle: data.bell_style ?? 'none',
        lineHeight: data.line_height ?? 1.2,
        aiProvider: data.ai_provider ?? 'openai',
        openaiApiKeyEncrypted: data.openai_api_key_encrypted ?? null,
        anthropicApiKeyEncrypted: data.anthropic_api_key_encrypted ?? null,
        geminiApiKeyEncrypted: data.gemini_api_key_encrypted ?? null,
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

    const updates: Record<string, unknown> = {};
    if (input.theme !== undefined) updates.theme = input.theme;
    if (input.terminalFont !== undefined) updates.terminal_font = input.terminalFont;
    if (input.terminalFontSize !== undefined) updates.terminal_font_size = input.terminalFontSize;
    if (input.scrollbackLines !== undefined) updates.scrollback_lines = input.scrollbackLines;
    if (input.cursorStyle !== undefined) updates.cursor_style = input.cursorStyle;
    if (input.bellStyle !== undefined) updates.bell_style = input.bellStyle;
    if (input.lineHeight !== undefined) updates.line_height = input.lineHeight;
    if (input.aiProvider !== undefined) updates.ai_provider = input.aiProvider;
    if (input.openaiApiKey !== undefined) updates.openai_api_key_encrypted = input.openaiApiKey;
    if (input.anthropicApiKey !== undefined) updates.anthropic_api_key_encrypted = input.anthropicApiKey;
    if (input.geminiApiKey !== undefined) updates.gemini_api_key_encrypted = input.geminiApiKey;

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
      terminalFontSize: data.terminal_font_size ?? 14,
      scrollbackLines: data.scrollback_lines ?? 1000,
      cursorStyle: data.cursor_style ?? 'block',
      bellStyle: data.bell_style ?? 'none',
      lineHeight: data.line_height ?? 1.2,
      aiProvider: data.ai_provider ?? 'openai',
      openaiApiKeyEncrypted: data.openai_api_key_encrypted ?? null,
      anthropicApiKeyEncrypted: data.anthropic_api_key_encrypted ?? null,
      geminiApiKeyEncrypted: data.gemini_api_key_encrypted ?? null,
      updatedAt: data.updated_at,
    };

    settingsQueries.upsert(user.id, JSON.stringify(settings));
    return settings;
  },
};
