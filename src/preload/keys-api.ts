import { contextBridge, ipcRenderer } from 'electron';
import type { SshKey, ImportKeyInput } from '../shared/types/keys';

const keysApi = {
  list: (workspaceId: string): Promise<SshKey[]> =>
    ipcRenderer.invoke('keys.list', workspaceId),
  import: (input: ImportKeyInput): Promise<SshKey> =>
    ipcRenderer.invoke('keys.import', input),
  delete: (id: string): Promise<void> =>
    ipcRenderer.invoke('keys.delete', id),
  exportPublic: (id: string): Promise<string | null> =>
    ipcRenderer.invoke('keys.exportPublic', id),
  syncEncrypted: (id: string): Promise<void> =>
    ipcRenderer.invoke('keys.syncEncrypted', id),
};

contextBridge.exposeInMainWorld('keysApi', keysApi);

export type KeysApi = typeof keysApi;
