import { create } from 'zustand';
import type { AiMessage } from '@shared/types/ai';
import { useSettingsStore } from './settings-store';

// Models available per provider
export const MODELS_BY_PROVIDER = {
  openai: [
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4o-mini', label: 'GPT-4o mini' },
    { value: 'gpt-4.1', label: 'GPT-4.1' },
    { value: 'gpt-4.1-mini', label: 'GPT-4.1 mini' },
  ],
  anthropic: [
    { value: 'claude-opus-4-5-20251101', label: 'Claude Opus 4.5' },
    { value: 'claude-sonnet-4-5-20251101', label: 'Claude Sonnet 4.5' },
    { value: 'claude-haiku-3-5-20241022', label: 'Claude Haiku 3.5' },
  ],
  gemini: [
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
    { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
  ],
} as const;

const CHAT_SYSTEM_PROMPT = `You are an expert Linux/Unix/macOS terminal and infrastructure assistant embedded in ArchTerm, an AI-powered SSH client.

You help users with:
- Shell commands, scripting (bash, zsh, fish, POSIX sh)
- SSH configuration, tunneling, multiplexing, agent forwarding
- System administration: processes, services, users, permissions, networking
- Package management (apt, dnf, yum, pacman, brew, apk)
- Docker, systemd, nginx, databases, log analysis
- Performance profiling, disk usage, memory, CPU analysis
- Security hardening, firewall rules, certificate management
- File operations, text processing (awk, sed, grep, jq)

RESPONSE STYLE:
- Be concise and direct. Prefer concrete commands over vague advice.
- Always put shell commands in fenced code blocks with \`\`\`bash or \`\`\`sh.
- For multi-step tasks, use numbered lists with one command per step.
- Explain WHY a command works, not just WHAT it does.
- Warn about destructive or irreversible operations (rm -rf, dd, mkfs, etc.).
- Suggest idempotent alternatives when possible.
- If a question is ambiguous (e.g., which OS/distro), ask first rather than guess.`;

/** Extract a clean, user-readable message from an AI SDK error object */
function extractErrorMessage(raw: string): string {
  // AI SDK error format: "AI_APICallError: <message>" or just the message
  const match = raw.match(/AI_\w+:\s*(.+)/);
  if (match) return match[1].trim();
  return raw.trim();
}

interface AiState {
  messages: AiMessage[];
  isStreaming: boolean;
  model: string;
  isOpen: boolean;
  listenersInitialized: boolean;
  setModel: (model: string) => void;
  setOpen: (open: boolean) => void;
  /** Call once at app startup — wires IPC listeners at the store level so they
   *  are always active regardless of whether AiPanel is mounted. */
  initListeners: () => void;
  sendMessage: (content: string) => Promise<void>;
  appendChunk: (requestId: string, chunk: string) => void;
  finishStreaming: (requestId: string) => void;
  failStreaming: (requestId: string, error: string) => void;
  clearHistory: () => void;
}

export const useAiStore = create<AiState>((set, get) => ({
  messages: [],
  isStreaming: false,
  model: 'gemini-2.0-flash',
  isOpen: false,
  listenersInitialized: false,

  setModel: (model) => set({ model }),
  setOpen: (isOpen) => set({ isOpen }),

  initListeners: () => {
    if (get().listenersInitialized) return;
    if (!window.aiApi) return;

    window.aiApi.onChunk((requestId, chunk) => {
      get().appendChunk(requestId, chunk);
    });

    window.aiApi.onDone((requestId) => {
      get().finishStreaming(requestId);
    });

    window.aiApi.onError((requestId, error) => {
      get().failStreaming(requestId, error);
    });

    set({ listenersInitialized: true });
  },

  sendMessage: async (content) => {
    const { model, messages } = get();

    const settings = useSettingsStore.getState().settings;
    const provider = settings?.aiProvider ?? 'gemini';

    let apiKey: string | null;
    try {
      apiKey = await window.apiKeysApi.get(provider);
    } catch {
      set((state) => ({
        messages: [...state.messages, {
          id: crypto.randomUUID(),
          role: 'assistant' as const,
          content: 'Failed to retrieve API key. Please check your settings.',
          createdAt: new Date().toISOString(),
        }],
        isStreaming: false,
      }));
      return;
    }

    if (!apiKey) {
      set((state) => ({
        messages: [...state.messages, {
          id: crypto.randomUUID(),
          role: 'assistant' as const,
          content: `No API key configured for ${provider}. Go to Settings → AI to add your key.`,
          createdAt: new Date().toISOString(),
        }],
      }));
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

    // fire-and-forget — response comes back via onChunk/onDone/onError IPC events
    void window.aiApi.complete({
      provider,
      apiKey,
      model,
      messages: [
        { id: 'system', role: 'system', content: CHAT_SYSTEM_PROMPT, createdAt: new Date().toISOString() },
        ...messages,
        userMessage,
      ],
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

  failStreaming: (requestId, error) => {
    const friendly = extractErrorMessage(error);
    set((state) => ({
      isStreaming: false,
      messages: state.messages.map((m) =>
        m.id === requestId
          ? { ...m, content: m.content || friendly, error: friendly }
          : m
      ),
    }));
  },

  clearHistory: () => set({ messages: [], isStreaming: false }),
}));
