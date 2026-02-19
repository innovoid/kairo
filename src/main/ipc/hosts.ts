import type { IpcMainInvokeEvent } from 'electron';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseSync } from '../services/supabase-sync';
import type { CreateHostInput, UpdateHostInput, CreateFolderInput } from '../../shared/types/hosts';

function getClient(event: IpcMainInvokeEvent): SupabaseClient {
  const client = (event as unknown as { supabase: SupabaseClient }).supabase;
  if (!client) throw new Error('Not authenticated');
  return client;
}

export const hostsIpcHandlers = {
  async listHosts(event: IpcMainInvokeEvent, workspaceId: string) {
    const supabase = getClient(event);
    return supabaseSync.pullHosts(supabase, workspaceId);
  },

  async createHost(event: IpcMainInvokeEvent, input: CreateHostInput) {
    const supabase = getClient(event);
    return supabaseSync.createHost(supabase, input);
  },

  async updateHost(event: IpcMainInvokeEvent, id: string, input: UpdateHostInput) {
    const supabase = getClient(event);
    return supabaseSync.updateHost(supabase, id, input);
  },

  async deleteHost(event: IpcMainInvokeEvent, id: string) {
    const supabase = getClient(event);
    return supabaseSync.deleteHost(supabase, id);
  },

  async moveHostToFolder(event: IpcMainInvokeEvent, id: string, folderId: string | null) {
    const supabase = getClient(event);
    return supabaseSync.updateHost(supabase, id, { folderId });
  },

  async listFolders(event: IpcMainInvokeEvent, workspaceId: string) {
    const supabase = getClient(event);
    return supabaseSync.pullFolders(supabase, workspaceId);
  },

  async createFolder(event: IpcMainInvokeEvent, input: CreateFolderInput) {
    const supabase = getClient(event);
    return supabaseSync.createFolder(supabase, input);
  },

  async updateFolder(event: IpcMainInvokeEvent, id: string, name: string) {
    const supabase = getClient(event);
    return supabaseSync.updateFolder(supabase, id, name);
  },

  async deleteFolder(event: IpcMainInvokeEvent, id: string) {
    const supabase = getClient(event);
    return supabaseSync.deleteFolder(supabase, id);
  },
};
