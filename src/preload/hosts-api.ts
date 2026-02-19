import { contextBridge, ipcRenderer } from 'electron';
import type { Host, HostFolder, CreateHostInput, UpdateHostInput, CreateFolderInput } from '../shared/types/hosts';

const hostsApi = {
  list: (workspaceId: string): Promise<Host[]> =>
    ipcRenderer.invoke('hosts.list', workspaceId),
  create: (input: CreateHostInput): Promise<Host> =>
    ipcRenderer.invoke('hosts.create', input),
  update: (id: string, input: UpdateHostInput): Promise<Host> =>
    ipcRenderer.invoke('hosts.update', id, input),
  delete: (id: string): Promise<void> =>
    ipcRenderer.invoke('hosts.delete', id),
  moveToFolder: (id: string, folderId: string | null): Promise<Host> =>
    ipcRenderer.invoke('hosts.moveToFolder', id, folderId),
};

const foldersApi = {
  list: (workspaceId: string): Promise<HostFolder[]> =>
    ipcRenderer.invoke('folders.list', workspaceId),
  create: (input: CreateFolderInput): Promise<HostFolder> =>
    ipcRenderer.invoke('folders.create', input),
  update: (id: string, name: string): Promise<HostFolder> =>
    ipcRenderer.invoke('folders.update', id, name),
  delete: (id: string): Promise<void> =>
    ipcRenderer.invoke('folders.delete', id),
};

contextBridge.exposeInMainWorld('hostsApi', hostsApi);
contextBridge.exposeInMainWorld('foldersApi', foldersApi);

export type HostsApi = typeof hostsApi;
export type FoldersApi = typeof foldersApi;
