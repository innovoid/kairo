import { contextBridge, ipcRenderer } from 'electron';
import type { SessionConnectConfig } from '../shared/types/session';

export type { SessionConnectConfig };

const sshApi = {
  connect: (sessionId: string, config: SessionConnectConfig): Promise<void> =>
    ipcRenderer.invoke('ssh.connect', sessionId, config),
  disconnect: (sessionId: string): Promise<void> =>
    ipcRenderer.invoke('ssh.disconnect', sessionId),
  send: (sessionId: string, data: string): Promise<void> =>
    ipcRenderer.invoke('ssh.send', sessionId, data),
  resize: (sessionId: string, cols: number, rows: number): Promise<void> =>
    ipcRenderer.invoke('ssh.resize', sessionId, cols, rows),

  onData: (callback: (sessionId: string, data: string) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, sessionId: string, data: string) =>
      callback(sessionId, data);
    ipcRenderer.on('ssh:data', listener);
    return () => void ipcRenderer.removeListener('ssh:data', listener);
  },

  onClosed: (callback: (sessionId: string) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, sessionId: string) =>
      callback(sessionId);
    ipcRenderer.on('ssh:closed', listener);
    return () => void ipcRenderer.removeListener('ssh:closed', listener);
  },

  onError: (callback: (sessionId: string, error: string) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, sessionId: string, error: string) =>
      callback(sessionId, error);
    ipcRenderer.on('ssh:error', listener);
    return () => void ipcRenderer.removeListener('ssh:error', listener);
  },
};

contextBridge.exposeInMainWorld('sshApi', sshApi);

export type SshApi = typeof sshApi;
