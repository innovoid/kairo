import { contextBridge, ipcRenderer } from 'electron';
import type { Snippet, CreateSnippetInput, UpdateSnippetInput } from '../shared/types/snippets';

const snippetsApi = {
  list: (workspaceId: string): Promise<Snippet[]> =>
    ipcRenderer.invoke('snippets.list', workspaceId),
  create: (input: CreateSnippetInput): Promise<Snippet> =>
    ipcRenderer.invoke('snippets.create', input),
  update: (input: UpdateSnippetInput): Promise<Snippet> =>
    ipcRenderer.invoke('snippets.update', input),
  delete: (id: string): Promise<void> =>
    ipcRenderer.invoke('snippets.delete', id),
};

contextBridge.exposeInMainWorld('snippetsApi', snippetsApi);

export type SnippetsApi = typeof snippetsApi;
