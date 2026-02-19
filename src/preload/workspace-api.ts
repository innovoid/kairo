import { contextBridge, ipcRenderer } from 'electron';
import type { WorkspaceIpcApi } from '../shared/types/workspace';

const workspaceApi: WorkspaceIpcApi & {
  getActiveContext: () => Promise<unknown>;
  ensurePersonalWorkspace: (name?: string) => Promise<unknown>;
  update: (workspaceId: string, updates: { name: string }) => Promise<unknown>;
  delete: (workspaceId: string) => Promise<void>;
  leave: (workspaceId: string) => Promise<void>;
} = {
  create: (input) => ipcRenderer.invoke('workspace.create', input),
  listMine: () => ipcRenderer.invoke('workspace.listMine'),
  switchActive: (workspaceId) => ipcRenderer.invoke('workspace.switchActive', workspaceId),
  invite: (input) => ipcRenderer.invoke('workspace.invite', input),
  acceptInvite: (input) => ipcRenderer.invoke('workspace.acceptInvite', input.token),
  revokeInvite: (workspaceInviteId) => ipcRenderer.invoke('workspace.revokeInvite', workspaceInviteId),
  members: {
    list: (workspaceId) => ipcRenderer.invoke('workspace.members.list', workspaceId),
    updateRole: (input) => ipcRenderer.invoke('workspace.members.updateRole', input),
    remove: (workspaceId, userId) => ipcRenderer.invoke('workspace.members.remove', workspaceId, userId),
  },
  getActiveContext: () => ipcRenderer.invoke('workspace.getActiveContext'),
  ensurePersonalWorkspace: (name) => ipcRenderer.invoke('workspace.ensurePersonalWorkspace', name),
  update: (workspaceId, updates) => ipcRenderer.invoke('workspace.updateWorkspace', workspaceId, updates),
  delete: (workspaceId) => ipcRenderer.invoke('workspace.deleteWorkspace', workspaceId),
  leave: (workspaceId) => ipcRenderer.invoke('workspace.leaveWorkspace', workspaceId),
};

contextBridge.exposeInMainWorld('workspaceApi', workspaceApi);

export type WorkspaceApi = typeof workspaceApi;
