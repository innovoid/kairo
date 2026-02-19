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
  async list(event: IpcMainInvokeEvent, workspaceId: string) {
    const localKeys = keyManager.list(workspaceId);

    // Sync any local keys to Supabase if not already there
    try {
      const supabase = getClient(event);
      for (const key of localKeys) {
        try {
          await supabaseSync.syncKeyMetadata(supabase, key.id);
        } catch (error) {
          console.error(`[keys.list] Failed to sync key ${key.id}:`, error);
        }
      }
    } catch (error) {
      console.error('[keys.list] Failed to sync keys to Supabase:', error);
    }

    return localKeys;
  },

  async import(event: IpcMainInvokeEvent, input: ImportKeyInput) {
    // Import key locally
    const key = await keyManager.import(input);

    // Automatically sync metadata to Supabase so it can be referenced by hosts
    try {
      const supabase = getClient(event);
      await supabaseSync.syncKeyMetadata(supabase, key.id);
      console.log('[keys.import] Key metadata synced to Supabase:', key.id);
    } catch (error) {
      console.error('[keys.import] Failed to sync key metadata to Supabase:', error);
      // Don't throw - key is still usable locally
    }

    return key;
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
