import { contextBridge, ipcRenderer } from 'electron';
import type {
  AgentChatInput,
  AgentMessage,
  AgentMessageChunkEvent,
  AgentMessageDoneEvent,
  AgentPlaybook,
  AgentRun,
  AgentStepOutputEvent,
  CancelAgentRunInput,
  RejectAgentStepInput,
  RunPlaybookInput,
  SavePlaybookInput,
  StartAgentRunInput,
} from '../shared/types/agent';

// approveStep carries AI credentials so the orchestrator can stream analysis
export interface ApproveStepWithAiInput {
  runId: string;
  stepId: string;
  elevate?: boolean;
  doubleConfirm?: boolean;
  provider: string;
  model: string;
  apiKey: string;
}

const agentApi = {
  startRun: (input: StartAgentRunInput): Promise<AgentRun> =>
    ipcRenderer.invoke('agent.startRun', input),
  approveStep: (input: ApproveStepWithAiInput): Promise<AgentRun> =>
    ipcRenderer.invoke('agent.approveStep', input),
  rejectStep: (input: RejectAgentStepInput): Promise<AgentRun> =>
    ipcRenderer.invoke('agent.rejectStep', input),
  cancelRun: (input: CancelAgentRunInput): Promise<AgentRun> =>
    ipcRenderer.invoke('agent.cancelRun', input),
  chat: (input: AgentChatInput): Promise<AgentRun> =>
    ipcRenderer.invoke('agent.chat', input),
  getRun: (runId: string): Promise<AgentRun> =>
    ipcRenderer.invoke('agent.getRun', runId),
  listRuns: (sessionId?: string): Promise<AgentRun[]> =>
    ipcRenderer.invoke('agent.listRuns', sessionId),
  runPlaybook: (input: RunPlaybookInput): Promise<AgentRun> =>
    ipcRenderer.invoke('agent.runPlaybook', input),
  savePlaybook: (input: SavePlaybookInput): Promise<AgentPlaybook> =>
    ipcRenderer.invoke('agent.savePlaybook', input),
  listPlaybooks: (workspaceId?: string): Promise<AgentPlaybook[]> =>
    ipcRenderer.invoke('agent.listPlaybooks', workspaceId),

  onRunUpdated: (callback: (run: AgentRun) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, run: AgentRun) => callback(run);
    ipcRenderer.on('agent:run-updated', listener);
    return () => void ipcRenderer.removeListener('agent:run-updated', listener);
  },

  onStepOutput: (callback: (event: AgentStepOutputEvent) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, event: AgentStepOutputEvent) => callback(event);
    ipcRenderer.on('agent:step-output', listener);
    return () => void ipcRenderer.removeListener('agent:step-output', listener);
  },

  /** Fired for each streamed chunk of an assistant message */
  onMessageChunk: (callback: (event: AgentMessageChunkEvent) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, event: AgentMessageChunkEvent) => callback(event);
    ipcRenderer.on('agent:message-chunk', listener);
    return () => void ipcRenderer.removeListener('agent:message-chunk', listener);
  },

  /** Fired when an assistant message finishes streaming */
  onMessageDone: (callback: (event: AgentMessageDoneEvent) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, event: AgentMessageDoneEvent) => callback(event);
    ipcRenderer.on('agent:message-done', listener);
    return () => void ipcRenderer.removeListener('agent:message-done', listener);
  },

  onBlocked: (callback: (runId: string, reason: string) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, runId: string, reason: string) => callback(runId, reason);
    ipcRenderer.on('agent:blocked', listener);
    return () => void ipcRenderer.removeListener('agent:blocked', listener);
  },

  onDone: (callback: (runId: string) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, runId: string) => callback(runId);
    ipcRenderer.on('agent:done', listener);
    return () => void ipcRenderer.removeListener('agent:done', listener);
  },

  onError: (callback: (runId: string, error: string) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, runId: string, error: string) => callback(runId, error);
    ipcRenderer.on('agent:error', listener);
    return () => void ipcRenderer.removeListener('agent:error', listener);
  },
};

contextBridge.exposeInMainWorld('agentApi', agentApi);

export type AgentApi = typeof agentApi;
