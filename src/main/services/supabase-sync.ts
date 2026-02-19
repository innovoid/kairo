import type { SupabaseClient } from '@supabase/supabase-js';
import { hostQueries, folderQueries, keyQueries, getDb } from '../db';
import type { Host, HostFolder, CreateHostInput, UpdateHostInput, CreateFolderInput } from '../../shared/types/hosts';
import type { SshKey } from '../../shared/types/keys';

type HostRow = {
  id: string;
  workspace_id: string;
  folder_id: string | null;
  label: string;
  hostname: string;
  port: number;
  username: string;
  auth_type: 'password' | 'key';
  key_id: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
};

type FolderRow = {
  id: string;
  workspace_id: string;
  parent_id: string | null;
  name: string;
  position: number;
  created_at: string;
};

type KeyRow = {
  id: string;
  workspace_id: string;
  name: string;
  key_type: string;
  public_key: string;
  fingerprint: string;
  has_encrypted_sync: boolean;
  created_at: string;
};

function rowToHost(row: HostRow): Host {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    folderId: row.folder_id,
    label: row.label,
    hostname: row.hostname,
    port: row.port,
    username: row.username,
    authType: row.auth_type,
    keyId: row.key_id,
    tags: row.tags ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToFolder(row: FolderRow): HostFolder {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    parentId: row.parent_id,
    name: row.name,
    position: row.position,
    createdAt: row.created_at,
  };
}

function rowToKey(row: KeyRow): SshKey {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    keyType: row.key_type as SshKey['keyType'],
    publicKey: row.public_key,
    fingerprint: row.fingerprint,
    hasEncryptedSync: row.has_encrypted_sync,
    createdAt: row.created_at,
  };
}

export const supabaseSync = {
  async pullHosts(supabase: SupabaseClient, workspaceId: string): Promise<Host[]> {
    const { data, error } = await supabase
      .from('hosts')
      .select('*')
      .eq('workspace_id', workspaceId);
    if (error) throw error;

    const rows = (data ?? []) as HostRow[];
    for (const row of rows) {
      hostQueries.upsert({
        id: row.id,
        workspace_id: row.workspace_id,
        folder_id: row.folder_id,
        label: row.label,
        hostname: row.hostname,
        port: row.port,
        username: row.username,
        auth_type: row.auth_type,
        key_id: row.key_id,
        tags: JSON.stringify(row.tags ?? []),
        synced_at: Date.now(),
      });
    }
    return rows.map(rowToHost);
  },

  async pullFolders(supabase: SupabaseClient, workspaceId: string): Promise<HostFolder[]> {
    const { data, error } = await supabase
      .from('host_folders')
      .select('*')
      .eq('workspace_id', workspaceId);
    if (error) throw error;

    const rows = (data ?? []) as FolderRow[];
    for (const row of rows) {
      folderQueries.upsert({
        id: row.id,
        workspace_id: row.workspace_id,
        parent_id: row.parent_id,
        name: row.name,
        position: row.position,
        synced_at: Date.now(),
      });
    }
    return rows.map(rowToFolder);
  },

  async pullKeys(supabase: SupabaseClient, workspaceId: string): Promise<SshKey[]> {
    const { data, error } = await supabase
      .from('ssh_keys')
      .select('*')
      .eq('workspace_id', workspaceId);
    if (error) throw error;

    const rows = (data ?? []) as KeyRow[];
    for (const row of rows) {
      keyQueries.upsert({
        id: row.id,
        workspace_id: row.workspace_id,
        name: row.name,
        key_type: row.key_type,
        public_key: row.public_key,
        fingerprint: row.fingerprint,
        has_encrypted_sync: row.has_encrypted_sync ? 1 : 0,
        synced_at: Date.now(),
      });
    }
    return rows.map(rowToKey);
  },

  // Hosts CRUD with dual write (SQLite + Supabase)
  async createHost(supabase: SupabaseClient, input: CreateHostInput): Promise<Host> {
    const { data, error } = await supabase
      .from('hosts')
      .insert({
        workspace_id: input.workspaceId,
        folder_id: input.folderId ?? null,
        label: input.label,
        hostname: input.hostname,
        port: input.port ?? 22,
        username: input.username,
        auth_type: input.authType,
        key_id: input.keyId ?? null,
        tags: input.tags ?? [],
      })
      .select('*')
      .single();
    if (error) throw error;

    const row = data as HostRow;
    hostQueries.upsert({
      id: row.id,
      workspace_id: row.workspace_id,
      folder_id: row.folder_id,
      label: row.label,
      hostname: row.hostname,
      port: row.port,
      username: row.username,
      auth_type: row.auth_type,
      key_id: row.key_id,
      tags: JSON.stringify(row.tags ?? []),
      synced_at: Date.now(),
    });
    return rowToHost(row);
  },

  async updateHost(supabase: SupabaseClient, id: string, input: UpdateHostInput): Promise<Host> {
    const updates: Record<string, unknown> = {};
    if (input.folderId !== undefined) updates.folder_id = input.folderId;
    if (input.label !== undefined) updates.label = input.label;
    if (input.hostname !== undefined) updates.hostname = input.hostname;
    if (input.port !== undefined) updates.port = input.port;
    if (input.username !== undefined) updates.username = input.username;
    if (input.authType !== undefined) updates.auth_type = input.authType;
    if (input.keyId !== undefined) updates.key_id = input.keyId;
    if (input.tags !== undefined) updates.tags = input.tags;

    const { data, error } = await supabase
      .from('hosts')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;

    const row = data as HostRow;
    hostQueries.upsert({
      id: row.id,
      workspace_id: row.workspace_id,
      folder_id: row.folder_id,
      label: row.label,
      hostname: row.hostname,
      port: row.port,
      username: row.username,
      auth_type: row.auth_type,
      key_id: row.key_id,
      tags: JSON.stringify(row.tags ?? []),
      synced_at: Date.now(),
    });
    return rowToHost(row);
  },

  async deleteHost(supabase: SupabaseClient, id: string): Promise<void> {
    const { error } = await supabase.from('hosts').delete().eq('id', id);
    if (error) throw error;
    hostQueries.delete(id);
  },

  async createFolder(supabase: SupabaseClient, input: CreateFolderInput): Promise<HostFolder> {
    const { data, error } = await supabase
      .from('host_folders')
      .insert({
        workspace_id: input.workspaceId,
        parent_id: input.parentId ?? null,
        name: input.name,
        position: input.position ?? 0,
      })
      .select('*')
      .single();
    if (error) throw error;

    const row = data as FolderRow;
    folderQueries.upsert({
      id: row.id,
      workspace_id: row.workspace_id,
      parent_id: row.parent_id,
      name: row.name,
      position: row.position,
      synced_at: Date.now(),
    });
    return rowToFolder(row);
  },

  async updateFolder(supabase: SupabaseClient, id: string, name: string): Promise<HostFolder> {
    const { data, error } = await supabase
      .from('host_folders')
      .update({ name })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;

    const row = data as FolderRow;
    folderQueries.upsert({
      id: row.id,
      workspace_id: row.workspace_id,
      parent_id: row.parent_id,
      name: row.name,
      position: row.position,
      synced_at: Date.now(),
    });
    return rowToFolder(row);
  },

  async deleteFolder(supabase: SupabaseClient, id: string): Promise<void> {
    // Move all hosts in this folder to root (folder_id = null)
    const { error: updateError } = await supabase
      .from('hosts')
      .update({ folder_id: null })
      .eq('folder_id', id);
    if (updateError) throw new Error(`Failed to move hosts to root: ${updateError.message}`);

    // Update local SQLite (with error handling)
    try {
      const db = getDb();
      db.prepare('update hosts set folder_id = null where folder_id = ?').run(id);
    } catch (sqliteError) {
      console.error('SQLite update failed after Supabase update:', sqliteError);
      throw new Error('Failed to sync folder deletion to local cache');
    }

    // Delete the folder from Supabase
    const { error: deleteError } = await supabase.from('host_folders').delete().eq('id', id);
    if (deleteError) throw new Error(`Failed to delete folder: ${deleteError.message}`);

    // Delete the folder from SQLite
    folderQueries.delete(id);
  },

  // Sync keys to Supabase (metadata only, no private keys)
  async syncKeyMetadata(supabase: SupabaseClient, keyId: string): Promise<void> {
    const row = keyQueries.getById(keyId);
    if (!row) throw new Error('Key not found');

    await supabase.from('ssh_keys').upsert({
      id: row.id,
      workspace_id: row.workspace_id,
      name: row.name,
      key_type: row.key_type,
      public_key: row.public_key,
      fingerprint: row.fingerprint,
      has_encrypted_sync: row.has_encrypted_sync === 1,
    });
  },

  // Local-only list (from SQLite cache)
  listHostsLocal(workspaceId: string): Host[] {
    return hostQueries.listByWorkspace(workspaceId).map((row) => ({
      id: row.id,
      workspaceId: row.workspace_id,
      folderId: row.folder_id,
      label: row.label,
      hostname: row.hostname,
      port: row.port,
      username: row.username,
      authType: row.auth_type,
      keyId: row.key_id,
      tags: (() => { try { return JSON.parse(row.tags); } catch { return []; } })(),
      createdAt: new Date(row.synced_at ?? Date.now()).toISOString(),
      updatedAt: new Date(row.synced_at ?? Date.now()).toISOString(),
    }));
  },

  listFoldersLocal(workspaceId: string): HostFolder[] {
    return folderQueries.listByWorkspace(workspaceId).map((row) => ({
      id: row.id,
      workspaceId: row.workspace_id,
      parentId: row.parent_id,
      name: row.name,
      position: row.position,
      createdAt: new Date(row.synced_at ?? Date.now()).toISOString(),
    }));
  },
};
