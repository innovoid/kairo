import 'dotenv/config';
import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { workspaceIpcHandlers } from './workspace';
import { hostsIpcHandlers } from './hosts';
import { sshIpcHandlers } from './ssh';
import { sftpIpcHandlers } from './sftp';
import { keysIpcHandlers } from './keys';
import { aiIpcHandlers } from './ai';
import { settingsIpcHandlers } from './settings';

type IpcHandler<TArgs extends unknown[] = unknown[], TResult = unknown> = (
  event: IpcMainInvokeEvent,
  ...args: TArgs
) => Promise<TResult>;

const supabaseByAccessToken = new Map<string, SupabaseClient>();
const accessTokenBySenderId = new Map<number, string>();
const trackedSenderIds = new Set<number>();

function createSupabaseClient(accessToken?: string): SupabaseClient {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing SUPABASE_URL/SUPABASE_ANON_KEY (or VITE_* fallback) in environment.');
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    ...(accessToken
      ? {
          global: {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          },
        }
      : {}),
  });
}

function getSupabaseClientForSender(senderId: number): SupabaseClient {
  const accessToken = accessTokenBySenderId.get(senderId);
  if (!accessToken) {
    throw new Error('Not authenticated. Please sign in first.');
  }

  const cachedClient = supabaseByAccessToken.get(accessToken);
  if (cachedClient) {
    return cachedClient;
  }

  const client = createSupabaseClient(accessToken);
  supabaseByAccessToken.set(accessToken, client);
  return client;
}

function withSupabase<TArgs extends unknown[], TResult>(handler: IpcHandler<TArgs, TResult>) {
  return async (event: IpcMainInvokeEvent, ...args: TArgs): Promise<TResult> => {
    try {
      console.log('[withSupabase] Middleware called, sender:', event.sender.id, 'args:', args);
      const scopedEvent = event as IpcMainInvokeEvent & { supabase: SupabaseClient };
      scopedEvent.supabase = getSupabaseClientForSender(event.sender.id);
      console.log('[withSupabase] Supabase client obtained, calling handler...');
      const result = await handler(scopedEvent, ...args);
      console.log('[withSupabase] Handler returned successfully');
      return result;
    } catch (error) {
      console.error('[withSupabase] ERROR in middleware:', {
        error,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        senderId: event.sender.id,
        argsCount: args.length,
      });
      throw error;
    }
  };
}

function register(channel: string, handler: (...args: any[]) => Promise<any>) {
  console.log('[register] Registering IPC handler for channel:', channel);
  ipcMain.removeHandler(channel);
  ipcMain.handle(channel, async (event, ...args) => {
    console.log(`[IPC:${channel}] Handler invoked with args:`, args);
    try {
      const result = await handler(event, ...args);
      console.log(`[IPC:${channel}] Handler completed successfully`);
      return result;
    } catch (error) {
      console.error(`[IPC:${channel}] Handler error:`, {
        error,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  });
}

export function registerWorkspaceIpcHandlers(): void {
  // Auth
  register('auth.setAccessToken', async (event: IpcMainInvokeEvent, accessToken: string | null) => {
    if (!trackedSenderIds.has(event.sender.id)) {
      trackedSenderIds.add(event.sender.id);
      event.sender.once('destroyed', () => {
        trackedSenderIds.delete(event.sender.id);
        accessTokenBySenderId.delete(event.sender.id);
      });
    }

    if (accessToken && accessToken.length > 0) {
      accessTokenBySenderId.set(event.sender.id, accessToken);
    } else {
      accessTokenBySenderId.delete(event.sender.id);
    }
    return true;
  });

  // Workspace
  register('workspace.create', withSupabase(workspaceIpcHandlers.create));
  register('workspace.listMine', withSupabase(workspaceIpcHandlers.listMine));
  register('workspace.switchActive', withSupabase(workspaceIpcHandlers.switchActive));
  register('workspace.getActiveContext', withSupabase(workspaceIpcHandlers.getActiveContext));
  register('workspace.ensurePersonalWorkspace', withSupabase(workspaceIpcHandlers.ensurePersonalWorkspace));
  register('workspace.invite', withSupabase(workspaceIpcHandlers.invite));
  register('workspace.acceptInvite', withSupabase(workspaceIpcHandlers.acceptInvite));
  register('workspace.revokeInvite', withSupabase(workspaceIpcHandlers.revokeInvite));
  register('workspace.members.list', withSupabase(workspaceIpcHandlers.members.list));
  register('workspace.members.updateRole', withSupabase(workspaceIpcHandlers.members.updateRole));
  register('workspace.members.remove', withSupabase(workspaceIpcHandlers.members.remove));

  // Hosts & Folders
  register('hosts.list', withSupabase(hostsIpcHandlers.listHosts));
  register('hosts.create', withSupabase(hostsIpcHandlers.createHost));
  register('hosts.update', withSupabase(hostsIpcHandlers.updateHost));
  register('hosts.delete', withSupabase(hostsIpcHandlers.deleteHost));
  register('hosts.moveToFolder', withSupabase(hostsIpcHandlers.moveHostToFolder));
  register('folders.list', withSupabase(hostsIpcHandlers.listFolders));
  register('folders.create', withSupabase(hostsIpcHandlers.createFolder));
  register('folders.update', withSupabase(hostsIpcHandlers.updateFolder));
  register('folders.delete', withSupabase(hostsIpcHandlers.deleteFolder));

  // SSH (no Supabase needed for connect/send/resize — uses raw IPC events)
  register('ssh.connect', sshIpcHandlers.connect);
  register('ssh.disconnect', sshIpcHandlers.disconnect);
  register('ssh.send', sshIpcHandlers.send);
  register('ssh.resize', sshIpcHandlers.resize);

  // SFTP
  register('sftp.list', sftpIpcHandlers.list);
  register('sftp.download', sftpIpcHandlers.download);
  register('sftp.upload', sftpIpcHandlers.upload);
  register('sftp.mkdir', sftpIpcHandlers.mkdir);
  register('sftp.rename', sftpIpcHandlers.rename);
  register('sftp.delete', sftpIpcHandlers.delete);
  register('sftp.chmod', sftpIpcHandlers.chmod);
  register('sftp.pickUploadFiles', sftpIpcHandlers.pickUploadFiles);

  // SSH Keys
  register('keys.list', keysIpcHandlers.list);
  register('keys.import', keysIpcHandlers.import);
  register('keys.delete', keysIpcHandlers.delete);
  register('keys.exportPublic', keysIpcHandlers.exportPublic);
  register('keys.syncEncrypted', withSupabase(keysIpcHandlers.syncEncrypted));

  // AI
  register('ai.complete', aiIpcHandlers.complete);
  register('ai.translateCommand', aiIpcHandlers.translateCommand);

  // Settings
  register('settings.get', withSupabase(settingsIpcHandlers.get));
  register('settings.update', withSupabase(settingsIpcHandlers.update));
}
