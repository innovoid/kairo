import type { IpcMainInvokeEvent } from 'electron';
import type { SupabaseClient } from '@supabase/supabase-js';
import { keyManager } from '../services/key-manager';
import { supabaseSync } from '../services/supabase-sync';
import { workspaceEncryption } from '../services/workspace-encryption';
import type { ImportKeyInput } from '../../shared/types/keys';

function getClient(event: IpcMainInvokeEvent): SupabaseClient {
  const client = (event as unknown as { supabase: SupabaseClient }).supabase;
  if (!client) throw new Error('Not authenticated');
  return client;
}

export const keysIpcHandlers = {
  list(_event: IpcMainInvokeEvent, workspaceId: string) {
    return keyManager.list(workspaceId);
  },

  async import(_event: IpcMainInvokeEvent, input: ImportKeyInput) {
    return keyManager.import(input);
  },

  delete(_event: IpcMainInvokeEvent, id: string) {
    keyManager.delete(id);
  },

  exportPublic(_event: IpcMainInvokeEvent, id: string) {
    return keyManager.exportPublic(id);
  },

  async syncEncrypted(event: IpcMainInvokeEvent, id: string) {
    const supabase = getClient(event);
    await supabaseSync.syncKeyMetadata(supabase, id);
  },

  // Workspace encryption methods
  async isWorkspaceEncryptionInitialized(event: IpcMainInvokeEvent, workspaceId: string) {
    const supabase = getClient(event);
    return workspaceEncryption.isInitialized(supabase, workspaceId);
  },

  async initializeWorkspaceEncryption(event: IpcMainInvokeEvent, workspaceId: string, passphrase: string) {
    const supabase = getClient(event);
    return workspaceEncryption.initializeWorkspace(supabase, workspaceId, passphrase);
  },

  async verifyWorkspacePassphrase(event: IpcMainInvokeEvent, workspaceId: string, passphrase: string) {
    const supabase = getClient(event);
    return workspaceEncryption.verifyPassphrase(supabase, workspaceId, passphrase);
  },

  async syncKeyToCloud(event: IpcMainInvokeEvent, workspaceId: string, keyId: string, passphrase: string) {
    const supabase = getClient(event);
    return workspaceEncryption.syncKeyToCloud(supabase, workspaceId, keyId, passphrase);
  },

  async downloadKeyFromCloud(event: IpcMainInvokeEvent, workspaceId: string, keyId: string, passphrase: string) {
    const supabase = getClient(event);
    return workspaceEncryption.downloadKeyFromCloud(supabase, workspaceId, keyId, passphrase);
  },

  async deleteKeyFromCloud(event: IpcMainInvokeEvent, workspaceId: string, keyId: string) {
    const supabase = getClient(event);
    return workspaceEncryption.deleteKeyFromCloud(supabase, workspaceId, keyId);
  },

  async changeWorkspacePassphrase(event: IpcMainInvokeEvent, workspaceId: string, oldPassphrase: string, newPassphrase: string) {
    const supabase = getClient(event);
    return workspaceEncryption.changePassphrase(supabase, workspaceId, oldPassphrase, newPassphrase);
  },
};
