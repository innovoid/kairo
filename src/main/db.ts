import Database from 'better-sqlite3';
import { app } from 'electron';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';

let _db: Database.Database | null = null;

function getDbPath(): string {
  const userDataPath = app.getPath('userData');
  const dbDir = join(userDataPath, 'archterm');
  mkdirSync(dbDir, { recursive: true });
  return join(dbDir, 'local.db');
}

export function getDb(): Database.Database {
  if (_db) return _db;
  _db = new Database(getDbPath());
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  runMigrations(_db);

  // Migrate legacy private keys to safeStorage-backed encryption.
  // Lazy require to avoid circular dependency (key-manager imports from db).
  try {
    const legacyCount = _db
      .prepare('select count(*) as cnt from private_keys where salt is null')
      .get() as { cnt: number } | undefined;

    if (legacyCount && legacyCount.cnt > 0) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { migratePrivateKeys } = require('./services/key-manager') as typeof import('./services/key-manager');
      migratePrivateKeys(_db);
    }
  } catch {
    // Migration is best-effort; legacy keys still decrypt via fallback
  }

  return _db;
}

function runMigrations(db: Database.Database): void {
  db.exec(`
    create table if not exists hosts (
      id text primary key,
      workspace_id text not null,
      folder_id text,
      label text not null,
      hostname text not null,
      port integer not null default 22,
      username text not null,
      auth_type text not null,
      key_id text,
      tags text default '[]',
      synced_at integer
    );

    create table if not exists host_folders (
      id text primary key,
      workspace_id text not null,
      parent_id text,
      name text not null,
      position integer default 0,
      synced_at integer
    );

    create table if not exists ssh_keys (
      id text primary key,
      workspace_id text not null,
      name text not null,
      key_type text not null,
      public_key text not null,
      fingerprint text not null,
      has_encrypted_sync integer default 0,
      synced_at integer
    );

    create table if not exists private_keys (
      key_id text primary key,
      encrypted_blob text not null,
      iv text not null,
      auth_tag text not null,
      salt text
    );

    create table if not exists settings_cache (
      user_id text primary key,
      data text not null,
      synced_at integer
    );

    create table if not exists app_secrets (
      key text primary key,
      value text not null
    );
  `);

  // Add salt column to private_keys if it doesn't exist (migration for existing databases)
  const cols = db
    .prepare("pragma table_info('private_keys')")
    .all() as { name: string }[];
  if (!cols.some((c) => c.name === 'salt')) {
    db.exec('alter table private_keys add column salt text');
  }
}

// Typed query helpers

export interface DbHost {
  id: string;
  workspace_id: string;
  folder_id: string | null;
  label: string;
  hostname: string;
  port: number;
  username: string;
  auth_type: 'password' | 'key';
  key_id: string | null;
  tags: string; // JSON array string
  synced_at: number | null;
}

export interface DbHostFolder {
  id: string;
  workspace_id: string;
  parent_id: string | null;
  name: string;
  position: number;
  synced_at: number | null;
}

export interface DbSshKey {
  id: string;
  workspace_id: string;
  name: string;
  key_type: string;
  public_key: string;
  fingerprint: string;
  has_encrypted_sync: number;
  synced_at: number | null;
}

export interface DbPrivateKey {
  key_id: string;
  encrypted_blob: string;
  iv: string;
  auth_tag: string;
  salt: string | null;
}

export const hostQueries = {
  listByWorkspace: (workspaceId: string): DbHost[] => {
    const db = getDb();
    return db.prepare('select * from hosts where workspace_id = ?').all(workspaceId) as DbHost[];
  },
  getById: (id: string): DbHost | undefined => {
    const db = getDb();
    return db.prepare('select * from hosts where id = ?').get(id) as DbHost | undefined;
  },
  upsert: (host: DbHost): void => {
    const db = getDb();
    db.prepare(`
      insert or replace into hosts
        (id, workspace_id, folder_id, label, hostname, port, username, auth_type, key_id, tags, synced_at)
      values
        (@id, @workspace_id, @folder_id, @label, @hostname, @port, @username, @auth_type, @key_id, @tags, @synced_at)
    `).run(host);
  },
  delete: (id: string): void => {
    const db = getDb();
    db.prepare('delete from hosts where id = ?').run(id);
  },
};

export const folderQueries = {
  listByWorkspace: (workspaceId: string): DbHostFolder[] => {
    const db = getDb();
    return db.prepare('select * from host_folders where workspace_id = ?').all(workspaceId) as DbHostFolder[];
  },
  getById: (id: string): DbHostFolder | undefined => {
    const db = getDb();
    return db.prepare('select * from host_folders where id = ?').get(id) as DbHostFolder | undefined;
  },
  upsert: (folder: DbHostFolder): void => {
    const db = getDb();
    db.prepare(`
      insert or replace into host_folders
        (id, workspace_id, parent_id, name, position, synced_at)
      values
        (@id, @workspace_id, @parent_id, @name, @position, @synced_at)
    `).run(folder);
  },
  delete: (id: string): void => {
    const db = getDb();
    db.prepare('delete from host_folders where id = ?').run(id);
  },
};

export const keyQueries = {
  listByWorkspace: (workspaceId: string): DbSshKey[] => {
    const db = getDb();
    return db.prepare('select * from ssh_keys where workspace_id = ?').all(workspaceId) as DbSshKey[];
  },
  getById: (id: string): DbSshKey | undefined => {
    const db = getDb();
    return db.prepare('select * from ssh_keys where id = ?').get(id) as DbSshKey | undefined;
  },
  upsert: (key: DbSshKey): void => {
    const db = getDb();
    db.prepare(`
      insert or replace into ssh_keys
        (id, workspace_id, name, key_type, public_key, fingerprint, has_encrypted_sync, synced_at)
      values
        (@id, @workspace_id, @name, @key_type, @public_key, @fingerprint, @has_encrypted_sync, @synced_at)
    `).run(key);
  },
  delete: (id: string): void => {
    const db = getDb();
    db.prepare('delete from ssh_keys where id = ?').run(id);
    db.prepare('delete from private_keys where key_id = ?').run(id);
  },
};

export const privateKeyQueries = {
  get: (keyId: string): DbPrivateKey | undefined => {
    const db = getDb();
    return db.prepare('select * from private_keys where key_id = ?').get(keyId) as DbPrivateKey | undefined;
  },
  upsert: (pk: DbPrivateKey): void => {
    const db = getDb();
    db.prepare(`
      insert or replace into private_keys (key_id, encrypted_blob, iv, auth_tag, salt)
      values (@key_id, @encrypted_blob, @iv, @auth_tag, @salt)
    `).run(pk);
  },
  delete: (keyId: string): void => {
    const db = getDb();
    db.prepare('delete from private_keys where key_id = ?').run(keyId);
  },
};

export const settingsQueries = {
  get: (userId: string): { data: string } | undefined => {
    const db = getDb();
    return db.prepare('select data from settings_cache where user_id = ?').get(userId) as { data: string } | undefined;
  },
  upsert: (userId: string, data: string): void => {
    const db = getDb();
    db.prepare(`
      insert or replace into settings_cache (user_id, data, synced_at)
      values (?, ?, ?)
    `).run(userId, data, Date.now());
  },
};
