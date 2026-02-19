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
    password: null, // Passwords are not stored for security
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

  // Hosts CRUD with local-first architecture (SQLite immediate, Supabase background)
  async createHost(supabase: SupabaseClient, input: CreateHostInput): Promise<Host> {
    // LOCAL-FIRST: Create in SQLite immediately, sync to Supabase in background

    // Generate ID and create local entry immediately
    const id = crypto.randomUUID();
    const now = Date.now();
    const newHost = {
      id,
      workspace_id: input.workspaceId,
      folder_id: input.folderId ?? null,
      label: input.label,
      hostname: input.hostname,
      port: input.port ?? 22,
      username: input.username,
      auth_type: input.authType,
      key_id: input.keyId ?? null,
      tags: JSON.stringify(input.tags ?? []),
      synced_at: now,
    };

    // Write to SQLite immediately (synchronous)
    hostQueries.upsert(newHost);

    // Sync to Supabase in background
    supabase
      .from('hosts')
      .insert({
        id,
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
      .then(({ error }) => {
        if (error) console.error('Background sync failed for host create:', error);
      });

    // Return immediately with local data
    return {
      id: newHost.id,
      workspaceId: newHost.workspace_id,
      folderId: newHost.folder_id,
      label: newHost.label,
      hostname: newHost.hostname,
      port: newHost.port,
      username: newHost.username,
      authType: newHost.auth_type,
      password: null,
      keyId: newHost.key_id,
      tags: JSON.parse(newHost.tags),
      createdAt: new Date(newHost.synced_at).toISOString(),
      updatedAt: new Date(newHost.synced_at).toISOString(),
    };
  },

  async updateHost(supabase: SupabaseClient, id: string, input: UpdateHostInput): Promise<Host> {
    // LOCAL-FIRST: Update SQLite immediately, sync to Supabase in background

    // Get current host from SQLite
    const existingHost = hostQueries.getById(id);
    if (!existingHost) throw new Error('Host not found in local cache');

    // Apply updates to local copy
    const updatedHost = {
      id: existingHost.id,
      workspace_id: existingHost.workspace_id,
      folder_id: input.folderId !== undefined ? input.folderId : existingHost.folder_id,
      label: input.label !== undefined ? input.label : existingHost.label,
      hostname: input.hostname !== undefined ? input.hostname : existingHost.hostname,
      port: input.port !== undefined ? input.port : existingHost.port,
      username: input.username !== undefined ? input.username : existingHost.username,
      auth_type: (input.authType !== undefined ? input.authType : existingHost.auth_type) as 'password' | 'key',
      key_id: input.keyId !== undefined ? input.keyId : existingHost.key_id,
      tags: JSON.stringify(input.tags !== undefined ? input.tags : JSON.parse(existingHost.tags)),
      synced_at: Date.now(),
    };

    // Update SQLite immediately (synchronous)
    hostQueries.upsert(updatedHost);

    // Update Supabase in background (don't await)
    const updates: Record<string, unknown> = {};
    if (input.folderId !== undefined) updates.folder_id = input.folderId;
    if (input.label !== undefined) updates.label = input.label;
    if (input.hostname !== undefined) updates.hostname = input.hostname;
    if (input.port !== undefined) updates.port = input.port;
    if (input.username !== undefined) updates.username = input.username;
    if (input.authType !== undefined) updates.auth_type = input.authType;
    if (input.keyId !== undefined) updates.key_id = input.keyId;
    if (input.tags !== undefined) updates.tags = input.tags;

    // Sync to Supabase asynchronously
    supabase
      .from('hosts')
      .update(updates)
      .eq('id', id)
      .then(({ error }) => {
        if (error) console.error('Background sync failed for host update:', error);
      });

    // Return immediately with local data
    return {
      id: updatedHost.id,
      workspaceId: updatedHost.workspace_id,
      folderId: updatedHost.folder_id,
      label: updatedHost.label,
      hostname: updatedHost.hostname,
      port: updatedHost.port,
      username: updatedHost.username,
      authType: updatedHost.auth_type,
      password: null,
      keyId: updatedHost.key_id,
      tags: JSON.parse(updatedHost.tags),
      createdAt: new Date(updatedHost.synced_at).toISOString(),
      updatedAt: new Date(updatedHost.synced_at).toISOString(),
    };
  },

  async deleteHost(supabase: SupabaseClient, id: string): Promise<void> {
    // LOCAL-FIRST: Delete from SQLite immediately, sync to Supabase in background

    // Delete from SQLite immediately (synchronous)
    hostQueries.delete(id);

    // Sync deletion to Supabase in background
    supabase
      .from('hosts')
      .delete()
      .eq('id', id)
      .then(({ error }) => {
        if (error) console.error('Background sync failed for host delete:', error);
      });
  },

  async createFolder(supabase: SupabaseClient, input: CreateFolderInput): Promise<HostFolder> {
    // LOCAL-FIRST: Create in SQLite immediately, sync to Supabase in background

    const id = crypto.randomUUID();
    const now = Date.now();
    const newFolder = {
      id,
      workspace_id: input.workspaceId,
      parent_id: input.parentId ?? null,
      name: input.name,
      position: input.position ?? 0,
      synced_at: now,
    };

    // Write to SQLite immediately
    folderQueries.upsert(newFolder);

    // Sync to Supabase in background
    supabase
      .from('host_folders')
      .insert({
        id,
        workspace_id: input.workspaceId,
        parent_id: input.parentId ?? null,
        name: input.name,
        position: input.position ?? 0,
      })
      .then(({ error }) => {
        if (error) console.error('Background sync failed for folder create:', error);
      });

    return {
      id: newFolder.id,
      workspaceId: newFolder.workspace_id,
      parentId: newFolder.parent_id,
      name: newFolder.name,
      position: newFolder.position,
      createdAt: new Date(newFolder.synced_at).toISOString(),
    };
  },

  async updateFolder(supabase: SupabaseClient, id: string, name: string): Promise<HostFolder> {
    // LOCAL-FIRST: Update SQLite immediately, sync to Supabase in background

    const existing = folderQueries.getById(id);
    if (!existing) throw new Error('Folder not found in local cache');

    const updatedFolder = {
      ...existing,
      name,
      synced_at: Date.now(),
    };

    // Update SQLite immediately
    folderQueries.upsert(updatedFolder);

    // Sync to Supabase in background
    supabase
      .from('host_folders')
      .update({ name })
      .eq('id', id)
      .then(({ error }) => {
        if (error) console.error('Background sync failed for folder update:', error);
      });

    return {
      id: updatedFolder.id,
      workspaceId: updatedFolder.workspace_id,
      parentId: updatedFolder.parent_id,
      name: updatedFolder.name,
      position: updatedFolder.position,
      createdAt: new Date(updatedFolder.synced_at).toISOString(),
    };
  },

  async deleteFolder(supabase: SupabaseClient, id: string): Promise<void> {
    // LOCAL-FIRST: Update SQLite immediately, sync to Supabase in background

    // Move all hosts in this folder to root in SQLite
    const db = getDb();
    db.prepare('update hosts set folder_id = null where folder_id = ?').run(id);

    // Delete folder from SQLite
    folderQueries.delete(id);

    // Sync to Supabase in background
    Promise.all([
      supabase.from('hosts').update({ folder_id: null }).eq('folder_id', id),
      supabase.from('host_folders').delete().eq('id', id),
    ]).then(([updateResult, deleteResult]) => {
      if (updateResult.error) console.error('Background sync failed for moving hosts:', updateResult.error);
      if (deleteResult.error) console.error('Background sync failed for folder delete:', deleteResult.error);
    });
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
