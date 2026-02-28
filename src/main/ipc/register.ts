import 'dotenv/config';
import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../lib/logger';
import { workspaceIpcHandlers } from './workspace';
import { hostsIpcHandlers } from './hosts';
import { sshIpcHandlers } from './ssh';
import { sftpIpcHandlers } from './sftp';
import { keysIpcHandlers } from './keys';
import { aiIpcHandlers } from './ai';
import { agentIpcHandlers } from './agent';
import { settingsIpcHandlers } from './settings';
import { apiKeysIpcHandlers } from './api-keys';
import { snippetsIpcHandlers } from './snippets';
import { recordingIpcHandlers } from './recording';

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

// ── Sensitive field sanitizer ─────────────────────────────────────────────────
// Strip known-sensitive keys from any plain-object in the args list before
// they reach the debug logger.  We never strip from the actual handler args —
// only from the copy used for logging.
const SENSITIVE_KEYS = new Set(['password', 'passphrase', 'key', 'apiKey', 'accessToken', 'privateKey', 'secret']);

function sanitizeForLog(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(sanitizeForLog);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = SENSITIVE_KEYS.has(k) ? '[REDACTED]' : sanitizeForLog(v);
  }
  return out;
}

function sanitizeArgs(args: unknown[]): unknown[] {
  return args.map(sanitizeForLog);
}

// ── withSupabase middleware ───────────────────────────────────────────────────
function withSupabase<TArgs extends unknown[], TResult>(handler: IpcHandler<TArgs, TResult>) {
  return async (event: IpcMainInvokeEvent, ...args: TArgs): Promise<TResult> => {
    try {
      const scopedEvent = event as IpcMainInvokeEvent & { supabase: SupabaseClient };
      scopedEvent.supabase = getSupabaseClientForSender(event.sender.id);
      return await handler(scopedEvent, ...args);
    } catch (error) {
      logger.error('[withSupabase] ERROR in middleware:', {
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

const HOT_CHANNELS = new Set(['ssh.send', 'ssh.resize', 'sftp.list']);

function register(channel: string, handler: (...args: any[]) => Promise<any> | any) {
  if (!HOT_CHANNELS.has(channel)) {
    logger.debug('[register] Registering IPC handler for channel:', channel);
  }
  ipcMain.removeHandler(channel);
  ipcMain.handle(channel, async (event, ...args) => {
    if (!HOT_CHANNELS.has(channel)) {
      logger.debug(`[IPC:${channel}] Handler invoked with args:`, sanitizeArgs(args));
    }
    try {
      const result = await handler(event, ...args);
      if (!HOT_CHANNELS.has(channel)) {
        logger.debug(`[IPC:${channel}] Handler completed successfully`);
      }
      return result;
    } catch (error) {
      logger.error(`[IPC:${channel}] Handler error:`, {
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
  register('workspace.updateWorkspace', withSupabase(workspaceIpcHandlers.updateWorkspace));
  register('workspace.deleteWorkspace', withSupabase(workspaceIpcHandlers.deleteWorkspace));
  register('workspace.leaveWorkspace', withSupabase(workspaceIpcHandlers.leaveWorkspace));
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
  register('sftp.listLocal', sftpIpcHandlers.listLocal);
  register('sftp.download', sftpIpcHandlers.download);
  register('sftp.upload', sftpIpcHandlers.upload);
  register('sftp.cancel', sftpIpcHandlers.cancel);
  register('sftp.mkdir', sftpIpcHandlers.mkdir);
  register('sftp.rename', sftpIpcHandlers.rename);
  register('sftp.delete', sftpIpcHandlers.delete);
  register('sftp.chmod', sftpIpcHandlers.chmod);
  register('sftp.pickUploadFiles', sftpIpcHandlers.pickUploadFiles);
  register('sftp.getSaveFilePath', sftpIpcHandlers.getSaveFilePath);

  // SSH Keys
  register('keys.list', withSupabase(keysIpcHandlers.list));
  register('keys.import', withSupabase(keysIpcHandlers.import));
  register('keys.delete', withSupabase(keysIpcHandlers.delete));
  register('keys.exportPublic', keysIpcHandlers.exportPublic);
  register('keys.syncEncrypted', withSupabase(keysIpcHandlers.syncEncrypted));

  // Workspace encryption (all require Supabase — passphrase logged as REDACTED)
  register('keys.isWorkspaceEncryptionInitialized', withSupabase(keysIpcHandlers.isWorkspaceEncryptionInitialized));
  register('keys.initializeWorkspaceEncryption',    withSupabase(keysIpcHandlers.initializeWorkspaceEncryption));
  register('keys.verifyWorkspacePassphrase',         withSupabase(keysIpcHandlers.verifyWorkspacePassphrase));
  register('keys.syncKeyToCloud',                    withSupabase(keysIpcHandlers.syncKeyToCloud));
  register('keys.downloadKeyFromCloud',              withSupabase(keysIpcHandlers.downloadKeyFromCloud));
  register('keys.deleteKeyFromCloud',                withSupabase(keysIpcHandlers.deleteKeyFromCloud));
  register('keys.changeWorkspacePassphrase',         withSupabase(keysIpcHandlers.changeWorkspacePassphrase));

  // AI
  register('ai.complete', aiIpcHandlers.complete);
  register('ai.translateCommand', aiIpcHandlers.translateCommand);
  register('agent.startRun', agentIpcHandlers.startRun);
  register('agent.approveStep', agentIpcHandlers.approveStep);
  register('agent.rejectStep', agentIpcHandlers.rejectStep);
  register('agent.cancelRun', agentIpcHandlers.cancelRun);
  register('agent.chat', agentIpcHandlers.chat);
  register('agent.getRun', agentIpcHandlers.getRun);
  register('agent.listRuns', agentIpcHandlers.listRuns);
  register('agent.runPlaybook', agentIpcHandlers.runPlaybook);
  register('agent.savePlaybook', agentIpcHandlers.savePlaybook);
  register('agent.listPlaybooks', agentIpcHandlers.listPlaybooks);

  // Settings
  register('settings.get', withSupabase(settingsIpcHandlers.get));
  register('settings.update', withSupabase(settingsIpcHandlers.update));

  // API Keys (local-only, no Supabase)
  register('apiKeys.get', apiKeysIpcHandlers.get);
  register('apiKeys.set', apiKeysIpcHandlers.set);
  register('apiKeys.delete', apiKeysIpcHandlers.delete);

  // Snippets
  register('snippets.list', withSupabase(snippetsIpcHandlers.list));
  register('snippets.create', withSupabase(snippetsIpcHandlers.create));
  register('snippets.update', withSupabase(snippetsIpcHandlers.update));
  register('snippets.delete', withSupabase(snippetsIpcHandlers.delete));

  // Recording
  register('recording.start', recordingIpcHandlers.start);
  register('recording.stop', recordingIpcHandlers.stop);
  register('recording.list', recordingIpcHandlers.list);
  register('recording.read', recordingIpcHandlers.read);
  register('recording.isRecording', recordingIpcHandlers.isRecording);
}
