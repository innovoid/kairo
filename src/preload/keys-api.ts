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

  // Workspace encryption
  isWorkspaceEncryptionInitialized: (workspaceId: string): Promise<boolean> =>
    ipcRenderer.invoke('keys.isWorkspaceEncryptionInitialized', workspaceId),
  initializeWorkspaceEncryption: (workspaceId: string, passphrase: string): Promise<void> =>
    ipcRenderer.invoke('keys.initializeWorkspaceEncryption', workspaceId, passphrase),
  verifyWorkspacePassphrase: (workspaceId: string, passphrase: string): Promise<boolean> =>
    ipcRenderer.invoke('keys.verifyWorkspacePassphrase', workspaceId, passphrase),
  syncKeyToCloud: (workspaceId: string, keyId: string, passphrase: string): Promise<void> =>
    ipcRenderer.invoke('keys.syncKeyToCloud', workspaceId, keyId, passphrase),
  downloadKeyFromCloud: (workspaceId: string, keyId: string, passphrase: string): Promise<string> =>
    ipcRenderer.invoke('keys.downloadKeyFromCloud', workspaceId, keyId, passphrase),
  deleteKeyFromCloud: (workspaceId: string, keyId: string): Promise<void> =>
    ipcRenderer.invoke('keys.deleteKeyFromCloud', workspaceId, keyId),
  changeWorkspacePassphrase: (workspaceId: string, oldPassphrase: string, newPassphrase: string): Promise<void> =>
    ipcRenderer.invoke('keys.changeWorkspacePassphrase', workspaceId, oldPassphrase, newPassphrase),
};

contextBridge.exposeInMainWorld('keysApi', keysApi);

export type KeysApi = typeof keysApi;
