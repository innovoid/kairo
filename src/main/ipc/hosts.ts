import type { IpcMainInvokeEvent } from 'electron';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseSync } from '../services/supabase-sync';
import type { CreateHostInput, UpdateHostInput, CreateFolderInput } from '../../shared/types/hosts';
import { logger } from '../lib/logger';

function getClient(event: IpcMainInvokeEvent): SupabaseClient {
  const client = (event as unknown as { supabase: SupabaseClient }).supabase;
  if (!client) throw new Error('Not authenticated');
  return client;
}

export const hostsIpcHandlers = {
  async listHosts(event: IpcMainInvokeEvent, workspaceId: string) {
    try {
      const supabase = getClient(event);
      return await supabaseSync.pullHosts(supabase, workspaceId);
    } catch (error) {
      logger.error('Error in listHosts:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to list hosts');
    }
  },

  async createHost(event: IpcMainInvokeEvent, input: CreateHostInput) {
    try {
      const supabase = getClient(event);
      return await supabaseSync.createHost(supabase, input);
    } catch (error) {
      logger.error('Error in createHost:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to create host');
    }
  },

  async updateHost(event: IpcMainInvokeEvent, id: string, input: UpdateHostInput) {
    try {
      logger.debug('[hosts.update] Received update request:', {
        id,
        inputKeys: Object.keys(input),
        input: JSON.stringify(input, null, 2)
      });
      const supabase = getClient(event);
      const result = await supabaseSync.updateHost(supabase, id, input);
      logger.debug('[hosts.update] Update successful:', result.id);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : 'No stack trace';
      logger.error('[hosts.update] ERROR:', {
        message: errorMessage,
        stack: errorStack,
        id,
        inputKeys: Object.keys(input),
      });
      // Make sure we throw a clean Error object
      const cleanError = new Error(errorMessage);
      cleanError.stack = errorStack;
      throw cleanError;
    }
  },

  async deleteHost(event: IpcMainInvokeEvent, id: string) {
    try {
      const supabase = getClient(event);
      return await supabaseSync.deleteHost(supabase, id);
    } catch (error) {
      logger.error('Error in deleteHost:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to delete host');
    }
  },

  async moveHostToFolder(event: IpcMainInvokeEvent, id: string, folderId: string | null) {
    try {
      const supabase = getClient(event);
      return await supabaseSync.updateHost(supabase, id, { folderId });
    } catch (error) {
      logger.error('Error in moveHostToFolder:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to move host to folder');
    }
  },

  async listFolders(event: IpcMainInvokeEvent, workspaceId: string) {
    try {
      const supabase = getClient(event);
      return await supabaseSync.pullFolders(supabase, workspaceId);
    } catch (error) {
      logger.error('Error in listFolders:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to list folders');
    }
  },

  async createFolder(event: IpcMainInvokeEvent, input: CreateFolderInput) {
    try {
      const supabase = getClient(event);
      return await supabaseSync.createFolder(supabase, input);
    } catch (error) {
      logger.error('Error in createFolder:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to create folder');
    }
  },

  async updateFolder(event: IpcMainInvokeEvent, id: string, name: string) {
    try {
      const supabase = getClient(event);
      return await supabaseSync.updateFolder(supabase, id, name);
    } catch (error) {
      logger.error('Error in updateFolder:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to update folder');
    }
  },

  async deleteFolder(event: IpcMainInvokeEvent, id: string) {
    try {
      const supabase = getClient(event);
      return await supabaseSync.deleteFolder(supabase, id);
    } catch (error) {
      logger.error('Error in deleteFolder:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to delete folder');
    }
  },
};
