import { contextBridge, ipcRenderer } from 'electron';

const apiKeysApi = {
  get: (provider: string): Promise<string | null> =>
    ipcRenderer.invoke('apiKeys.get', provider),
  set: (provider: string, key: string): Promise<void> =>
    ipcRenderer.invoke('apiKeys.set', provider, key),
  delete: (provider: string): Promise<void> =>
    ipcRenderer.invoke('apiKeys.delete', provider),
};

contextBridge.exposeInMainWorld('apiKeysApi', apiKeysApi);

export type ApiKeysApi = typeof apiKeysApi;
