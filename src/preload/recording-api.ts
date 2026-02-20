import { contextBridge, ipcRenderer } from 'electron';

const recordingApi = {
  start: (sessionId: string, cols: number, rows: number) => ipcRenderer.invoke('recording.start', sessionId, cols, rows),
  stop: (sessionId: string) => ipcRenderer.invoke('recording.stop', sessionId) as Promise<string | null>,
  list: () => ipcRenderer.invoke('recording.list') as Promise<Array<{ filename: string; path: string; timestamp: number }>>,
  read: (path: string) => ipcRenderer.invoke('recording.read', path) as Promise<string>,
  isRecording: (sessionId: string) => ipcRenderer.invoke('recording.isRecording', sessionId) as Promise<boolean>,
};

contextBridge.exposeInMainWorld('recordingApi', recordingApi);

export type RecordingApi = typeof recordingApi;
