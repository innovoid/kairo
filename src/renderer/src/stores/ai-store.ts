import { create } from 'zustand';
import type { AiMessage } from '@shared/types/ai';
import { useSettingsStore } from './settings-store';

// Models available per provider
export const MODELS_BY_PROVIDER = {
  openai: [
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4o-mini', label: 'GPT-4o mini' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
  ],
  anthropic: [
    { value: 'claude-opus-4-5', label: 'Claude Opus 4.5' },
    { value: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
    { value: 'claude-haiku-3-5', label: 'Claude Haiku 3.5' },
  ],
  gemini: [
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
    { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
  ],
} as const;

interface AiState {
  messages: AiMessage[];
  isStreaming: boolean;
  model: string;
  isOpen: boolean;
  setModel: (model: string) => void;
  setOpen: (open: boolean) => void;
  sendMessage: (content: string) => Promise<void>;
  appendChunk: (requestId: string, chunk: string) => void;
  finishStreaming: (requestId: string) => void;
  clearHistory: () => void;
}

export const useAiStore = create<AiState>((set, get) => ({
  messages: [],
  isStreaming: false,
  model: 'gpt-4o-mini',
  isOpen: false,

  setModel: (model) => set({ model }),
  setOpen: (isOpen) => set({ isOpen }),

  sendMessage: async (content) => {
    const { model, messages } = get();

    // Read provider from settings store, API key from local encrypted storage
    const settings = useSettingsStore.getState().settings;
    const provider = settings?.aiProvider ?? 'openai';

    let apiKey: string | null;
    try {
      apiKey = await window.apiKeysApi.get(provider);
    } catch {
      const errMessage: AiMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Failed to retrieve API key. Please check your settings.',
        createdAt: new Date().toISOString(),
      };
      set((state) => ({ messages: [...state.messages, errMessage], isStreaming: false }));
      return;
    }

    if (!apiKey) {
      const errMessage: AiMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `No API key configured for ${provider}. Go to Settings → AI to add your key.`,
        createdAt: new Date().toISOString(),
      };
      set((state) => ({ messages: [...state.messages, errMessage] }));
      return;
    }

    const userMessage: AiMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    };

    const requestId = crypto.randomUUID();
    const assistantMessage: AiMessage = {
      id: requestId,
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
    };

    set((state) => ({
      messages: [...state.messages, userMessage, assistantMessage],
      isStreaming: true,
    }));

    await window.aiApi.complete({
      provider,
      apiKey,
      model,
      messages: [...messages, userMessage],
      requestId,
    });
  },

  appendChunk: (requestId, chunk) => {
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === requestId ? { ...m, content: m.content + chunk } : m
      ),
    }));
  },

  finishStreaming: (_requestId) => {
    set({ isStreaming: false });
  },

  clearHistory: () => set({ messages: [], isStreaming: false }),
}));
