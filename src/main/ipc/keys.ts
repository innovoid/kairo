import type { IpcMainInvokeEvent } from 'electron';
import type { SupabaseClient } from '@supabase/supabase-js';
import { keyManager } from '../services/key-manager';
import { supabaseSync } from '../services/supabase-sync';
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
};
