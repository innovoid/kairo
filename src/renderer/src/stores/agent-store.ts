import { create } from 'zustand';
import { toast } from 'sonner';
import type {
  AgentChatInput,
  AgentPlaybook,
  AgentRun,
  AgentStep,
  RunPlaybookInput,
  StartAgentRunInput,
} from '@shared/types/agent';
import type { AiProvider } from '@shared/types/settings';
import type { ApproveStepWithAiInput } from '@/../../preload/agent-api';
import { useSettingsStore } from './settings-store';

interface AgentState {
  runs: Record<string, AgentRun>;
  activeRunBySession: Record<string, string>;
  stepOutputByStepId: Record<string, string>;
  listenersInitialized: boolean;
  initListeners: () => void;
  startRun: (input: Omit<StartAgentRunInput, 'provider' | 'model' | 'apiKey'>) => Promise<AgentRun>;
  approveStep: (runId: string, step: AgentStep, options?: { elevate?: boolean; doubleConfirm?: boolean }) => Promise<AgentRun>;
  rejectStep: (runId: string, stepId: string, reason?: string) => Promise<AgentRun>;
  cancelRun: (runId: string) => Promise<AgentRun>;
  chat: (runId: string, content: string) => Promise<AgentRun>;
  savePlaybook: (runId: string, name: string, workspaceId?: string) => Promise<AgentPlaybook>;
  listPlaybooks: (workspaceId?: string) => Promise<AgentPlaybook[]>;
  runPlaybook: (input: RunPlaybookInput) => Promise<AgentRun>;
  getActiveRun: (sessionId: string) => AgentRun | null;
}

function defaultModelForProvider(provider: string): string {
  if (provider === 'anthropic') return 'claude-haiku-3-5-20241022';
  if (provider === 'gemini') return 'gemini-2.0-flash';
  return 'gpt-4o-mini';
}

async function getAiCredentials(): Promise<{ provider: AiProvider; model: string; apiKey: string }> {
  const settings = useSettingsStore.getState().settings;
  const provider = (settings?.aiProvider ?? 'gemini') as AiProvider;
  const apiKey = await window.apiKeysApi.get(provider);
  if (!apiKey) {
    throw new Error(`No API key configured for ${provider}. Go to Settings → AI to add your key.`);
  }
  return { provider, model: defaultModelForProvider(provider), apiKey };
}

export const useAgentStore = create<AgentState>((set, get) => ({
  runs: {},
  activeRunBySession: {},
  stepOutputByStepId: {},
  listenersInitialized: false,

  initListeners: () => {
    if (get().listenersInitialized) return;
    if (!window.agentApi) return;

    window.agentApi.onRunUpdated((run) => {
      set((state) => ({
        runs: { ...state.runs, [run.id]: run },
        activeRunBySession: { ...state.activeRunBySession, [run.sessionId]: run.id },
      }));
    });

    window.agentApi.onStepOutput((event) => {
      set((state) => ({
        stepOutputByStepId: {
          ...state.stepOutputByStepId,
          [event.stepId]: `${state.stepOutputByStepId[event.stepId] ?? ''}${event.chunk}`,
        },
      }));
    });

    // Stream assistant message chunks into the run's messages array
    window.agentApi.onMessageChunk((event) => {
      set((state) => {
        const run = state.runs[event.runId];
        if (!run) return state;
        const messages = run.messages.map((m) =>
          m.id === event.messageId ? { ...m, content: m.content + event.chunk } : m
        );
        return { runs: { ...state.runs, [run.id]: { ...run, messages } } };
      });
    });

    window.agentApi.onMessageDone((event) => {
      set((state) => {
        const run = state.runs[event.runId];
        if (!run) return state;
        const messages = run.messages.map((m) =>
          m.id === event.messageId ? { ...m, streaming: false } : m
        );
        return { runs: { ...state.runs, [run.id]: { ...run, messages } } };
      });
    });

    window.agentApi.onBlocked((_runId, reason) => {
      toast.warning(reason);
    });

    window.agentApi.onDone((runId) => {
      const run = get().runs[runId];
      toast.success(run?.summary || 'Agent run completed');
    });

    window.agentApi.onError((_runId, error) => {
      toast.error(error);
    });

    set({ listenersInitialized: true });
  },

  startRun: async (input) => {
    if (!window.agentApi) throw new Error('Agent API is not available in this environment.');
    const { provider, model, apiKey } = await getAiCredentials();
    const run = await window.agentApi.startRun({ ...input, provider, model, apiKey });
    set((state) => ({
      runs: { ...state.runs, [run.id]: run },
      activeRunBySession: { ...state.activeRunBySession, [run.sessionId]: run.id },
    }));
    return run;
  },

  approveStep: async (runId, step, options) => {
    if (!window.agentApi) throw new Error('Agent API is not available in this environment.');
    const { provider, model, apiKey } = await getAiCredentials();
    const input: ApproveStepWithAiInput = {
      runId,
      stepId: step.id,
      elevate: options?.elevate,
      doubleConfirm: options?.doubleConfirm,
      provider,
      model,
      apiKey,
    };
    const run = await window.agentApi.approveStep(input);
    set((state) => ({ runs: { ...state.runs, [run.id]: run } }));
    return run;
  },

  rejectStep: async (runId, stepId, reason) => {
    if (!window.agentApi) throw new Error('Agent API is not available in this environment.');
    const run = await window.agentApi.rejectStep({ runId, stepId, reason });
    set((state) => ({ runs: { ...state.runs, [run.id]: run } }));
    return run;
  },

  cancelRun: async (runId) => {
    if (!window.agentApi) throw new Error('Agent API is not available in this environment.');
    const run = await window.agentApi.cancelRun({ runId });
    set((state) => ({ runs: { ...state.runs, [run.id]: run } }));
    return run;
  },

  chat: async (runId, content) => {
    if (!window.agentApi) throw new Error('Agent API is not available in this environment.');
    const { provider, model, apiKey } = await getAiCredentials();
    const input: AgentChatInput = { runId, content, provider, model, apiKey };
    const run = await window.agentApi.chat(input);
    set((state) => ({ runs: { ...state.runs, [run.id]: run } }));
    return run;
  },

  savePlaybook: async (runId, name, workspaceId) => {
    if (!window.agentApi) throw new Error('Agent API is not available in this environment.');
    return window.agentApi.savePlaybook({ runId, name, workspaceId });
  },

  listPlaybooks: async (workspaceId) => {
    if (!window.agentApi) throw new Error('Agent API is not available in this environment.');
    return window.agentApi.listPlaybooks(workspaceId);
  },

  runPlaybook: async (input) => {
    if (!window.agentApi) throw new Error('Agent API is not available in this environment.');
    const run = await window.agentApi.runPlaybook(input);
    set((state) => ({
      runs: { ...state.runs, [run.id]: run },
      activeRunBySession: { ...state.activeRunBySession, [run.sessionId]: run.id },
    }));
    return run;
  },

  getActiveRun: (sessionId) => {
    const state = get();
    const runId = state.activeRunBySession[sessionId];
    if (!runId) return null;
    return state.runs[runId] ?? null;
  },
}));
