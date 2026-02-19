import { contextBridge, ipcRenderer } from 'electron';
import type { AiCompleteInput, AiTranslateInput } from '../shared/types/ai';

const aiApi = {
  complete: (input: AiCompleteInput): Promise<void> =>
    ipcRenderer.invoke('ai.complete', input),
  translateCommand: (input: AiTranslateInput): Promise<void> =>
    ipcRenderer.invoke('ai.translateCommand', input),

  onChunk: (callback: (requestId: string, chunk: string) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, requestId: string, chunk: string) =>
      callback(requestId, chunk);
    ipcRenderer.on('ai:chunk', listener);
    return () => void ipcRenderer.removeListener('ai:chunk', listener);
  },

  onDone: (callback: (requestId: string) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, requestId: string) =>
      callback(requestId);
    ipcRenderer.on('ai:done', listener);
    return () => void ipcRenderer.removeListener('ai:done', listener);
  },

  onError: (callback: (requestId: string, error: string) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, requestId: string, error: string) =>
      callback(requestId, error);
    ipcRenderer.on('ai:error', listener);
    return () => void ipcRenderer.removeListener('ai:error', listener);
  },
};

contextBridge.exposeInMainWorld('aiApi', aiApi);

export type AiApi = typeof aiApi;
