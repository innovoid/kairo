import type { IpcMainInvokeEvent } from 'electron';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseSync } from '../services/supabase-sync';
import type { CreateHostInput, UpdateHostInput, CreateFolderInput } from '../../shared/types/hosts';
import type { PortForwardConfig } from '../../shared/types/port-forward';
import { logger } from '../lib/logger';

function getClient(event: IpcMainInvokeEvent): SupabaseClient {
  const client = (event as unknown as { supabase: SupabaseClient }).supabase;
  if (!client) throw new Error('Not authenticated');
  return client;
}

const MIN_PORT = 1;
const MAX_PORT = 65535;

function assertPort(value: number, field: string): void {
  if (!Number.isInteger(value) || value < MIN_PORT || value > MAX_PORT) {
    throw new Error(`${field} must be an integer between ${MIN_PORT} and ${MAX_PORT}`);
  }
}

function validatePortForwards(portForwards: PortForwardConfig[] | undefined): void {
  if (!portForwards) return;
  for (const pf of portForwards) {
    assertPort(pf.localPort, 'portForwards.localPort');
    assertPort(pf.remotePort, 'portForwards.remotePort');
    if (!pf.remoteHost?.trim()) {
      throw new Error('portForwards.remoteHost is required');
    }
  }
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

  async getPassword(event: IpcMainInvokeEvent, hostId: string) {
    try {
      const supabase = getClient(event);
      const { data, error } = await supabase.from('hosts').select('password').eq('id', hostId).single();
      if (error) throw error;
      return data?.password ?? null;
    } catch (error) {
      logger.error('Error in getPassword:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to get host password');
    }
  },

  async createHost(event: IpcMainInvokeEvent, input: CreateHostInput) {
    try {
      const supabase = getClient(event);
      const normalizedPort = input.port ?? 22;
      assertPort(normalizedPort, 'port');
      validatePortForwards(input.portForwards);

      const normalizedInput: CreateHostInput = {
        ...input,
        label: input.label.trim(),
        hostname: input.hostname.trim(),
        username: input.username.trim(),
        port: normalizedPort,
        portForwards: input.portForwards?.map((pf) => ({
          ...pf,
          remoteHost: pf.remoteHost.trim(),
        })),
      };

      if (!normalizedInput.label || !normalizedInput.hostname || !normalizedInput.username) {
        throw new Error('label, hostname, and username are required');
      }

      return await supabaseSync.createHost(supabase, normalizedInput);
    } catch (error) {
      logger.error('Error in createHost:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to create host');
    }
  },

  async updateHost(event: IpcMainInvokeEvent, id: string, input: UpdateHostInput) {
    try {
      if (input.port !== undefined) {
        assertPort(input.port, 'port');
      }
      validatePortForwards(input.portForwards);

      const normalizedInput: UpdateHostInput = {
        ...input,
        label: input.label?.trim(),
        hostname: input.hostname?.trim(),
        username: input.username?.trim(),
        portForwards: input.portForwards?.map((pf) => ({
          ...pf,
          remoteHost: pf.remoteHost.trim(),
        })),
      };

      if (normalizedInput.label !== undefined && !normalizedInput.label) {
        throw new Error('label cannot be empty');
      }
      if (normalizedInput.hostname !== undefined && !normalizedInput.hostname) {
        throw new Error('hostname cannot be empty');
      }
      if (normalizedInput.username !== undefined && !normalizedInput.username) {
        throw new Error('username cannot be empty');
      }

      logger.debug('[hosts.update] Received update request:', {
        id,
        inputKeys: Object.keys(normalizedInput),
        input: JSON.stringify(normalizedInput, null, 2)
      });
      const supabase = getClient(event);
      const result = await supabaseSync.updateHost(supabase, id, normalizedInput);
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
