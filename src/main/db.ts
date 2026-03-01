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
      port_forwards text default '[]',
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

    create table if not exists snippets (
      id text primary key,
      workspace_id text not null,
      name text not null,
      command text not null,
      description text,
      tags text default '[]',
      created_by text,
      synced_at integer
    );

    create table if not exists agent_runs (
      id text primary key,
      session_id text not null,
      workspace_id text,
      host_id text,
      host_label text,
      task text not null,
      status text not null,
      facts text,
      summary text,
      last_error text,
      created_at integer not null,
      updated_at integer not null
    );

    create table if not exists agent_steps (
      id text primary key,
      run_id text not null,
      step_index integer not null,
      title text not null,
      command text not null,
      verify_command text,
      status text not null,
      risk text not null,
      requires_double_confirm integer default 0,
      output_summary text,
      exit_code integer,
      error text,
      started_at integer,
      ended_at integer,
      foreign key (run_id) references agent_runs(id) on delete cascade
    );

    create table if not exists agent_events (
      id text primary key,
      run_id text not null,
      step_id text,
      type text not null,
      message text not null,
      payload text,
      created_at integer not null,
      foreign key (run_id) references agent_runs(id) on delete cascade
    );

    create table if not exists agent_host_facts (
      host_id text primary key,
      facts text not null,
      updated_at integer not null
    );

    create table if not exists agent_playbooks (
      id text primary key,
      workspace_id text,
      name text not null,
      task text not null,
      source_run_id text,
      steps text not null,
      created_at integer not null
    );
  `);

  // Add port_forwards column to hosts if it doesn't exist
  const hostCols = db
    .prepare("pragma table_info('hosts')")
    .all() as { name: string }[];
  if (!hostCols.some((c) => c.name === 'port_forwards')) {
    db.exec("alter table hosts add column port_forwards text default '[]'");
  }
  // Add salt column to private_keys if it doesn't exist (migration for existing databases)
  const cols = db
    .prepare("pragma table_info('private_keys')")
    .all() as { name: string }[];
  if (!cols.some((c) => c.name === 'salt')) {
    db.exec('alter table private_keys add column salt text');
  }
  // Add explain column to agent_steps if it doesn't exist
  const stepCols = db
    .prepare("pragma table_info('agent_steps')")
    .all() as { name: string }[];
  if (!stepCols.some((c) => c.name === 'explain')) {
    db.exec('alter table agent_steps add column explain text');
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
  port_forwards: string; // JSON array string
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
        (id, workspace_id, folder_id, label, hostname, port, username, auth_type, key_id, tags, port_forwards, synced_at)
      values
        (@id, @workspace_id, @folder_id, @label, @hostname, @port, @username, @auth_type, @key_id, @tags, @port_forwards, @synced_at)
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

export interface DbSnippet {
  id: string;
  workspace_id: string;
  name: string;
  command: string;
  description: string | null;
  tags: string; // JSON array string
  created_by: string | null;
  synced_at: number | null;
}

export const snippetQueries = {
  listByWorkspace: (workspaceId: string): DbSnippet[] => {
    const db = getDb();
    return db.prepare('select * from snippets where workspace_id = ?').all(workspaceId) as DbSnippet[];
  },
  getById: (id: string): DbSnippet | undefined => {
    const db = getDb();
    return db.prepare('select * from snippets where id = ?').get(id) as DbSnippet | undefined;
  },
  upsert: (snippet: DbSnippet): void => {
    const db = getDb();
    db.prepare(`
      insert or replace into snippets
        (id, workspace_id, name, command, description, tags, created_by, synced_at)
      values
        (@id, @workspace_id, @name, @command, @description, @tags, @created_by, @synced_at)
    `).run(snippet);
  },
  delete: (id: string): void => {
    const db = getDb();
    db.prepare('delete from snippets where id = ?').run(id);
  },
};

export interface DbAgentRun {
  id: string;
  session_id: string;
  workspace_id: string | null;
  host_id: string | null;
  host_label: string | null;
  task: string;
  status: string;
  facts: string | null;
  summary: string | null;
  last_error: string | null;
  created_at: number;
  updated_at: number;
}

export interface DbAgentStep {
  id: string;
  run_id: string;
  step_index: number;
  title: string;
  explain: string | null;
  command: string;
  verify_command: string | null;
  status: string;
  risk: string;
  requires_double_confirm: number;
  output_summary: string | null;
  exit_code: number | null;
  error: string | null;
  started_at: number | null;
  ended_at: number | null;
}

export interface DbAgentEvent {
  id: string;
  run_id: string;
  step_id: string | null;
  type: string;
  message: string;
  payload: string | null;
  created_at: number;
}

export interface DbHostFacts {
  host_id: string;
  facts: string;
  updated_at: number;
}

export interface DbAgentPlaybook {
  id: string;
  workspace_id: string | null;
  name: string;
  task: string;
  source_run_id: string | null;
  steps: string;
  created_at: number;
}

export const agentRunQueries = {
  upsert: (run: DbAgentRun): void => {
    const db = getDb();
    db.prepare(`
      insert or replace into agent_runs
        (id, session_id, workspace_id, host_id, host_label, task, status, facts, summary, last_error, created_at, updated_at)
      values
        (@id, @session_id, @workspace_id, @host_id, @host_label, @task, @status, @facts, @summary, @last_error, @created_at, @updated_at)
    `).run(run);
  },
  getById: (id: string): DbAgentRun | undefined => {
    const db = getDb();
    return db.prepare('select * from agent_runs where id = ?').get(id) as DbAgentRun | undefined;
  },
  listBySession: (sessionId: string): DbAgentRun[] => {
    const db = getDb();
    return db
      .prepare('select * from agent_runs where session_id = ? order by created_at desc')
      .all(sessionId) as DbAgentRun[];
  },
  listRecent: (limit: number): DbAgentRun[] => {
    const db = getDb();
    return db
      .prepare('select * from agent_runs order by created_at desc limit ?')
      .all(limit) as DbAgentRun[];
  },
};

export const agentStepQueries = {
  replaceForRun: (runId: string, steps: DbAgentStep[]): void => {
    const db = getDb();
    const clearStmt = db.prepare('delete from agent_steps where run_id = ?');
    const insertStmt = db.prepare(`
      insert into agent_steps
        (id, run_id, step_index, title, explain, command, verify_command, status, risk, requires_double_confirm, output_summary, exit_code, error, started_at, ended_at)
      values
        (@id, @run_id, @step_index, @title, @explain, @command, @verify_command, @status, @risk, @requires_double_confirm, @output_summary, @exit_code, @error, @started_at, @ended_at)
    `);
    const tx = db.transaction(() => {
      clearStmt.run(runId);
      for (const step of steps) {
        insertStmt.run(step);
      }
    });
    tx();
  },
  listByRun: (runId: string): DbAgentStep[] => {
    const db = getDb();
    return db
      .prepare('select * from agent_steps where run_id = ? order by step_index asc')
      .all(runId) as DbAgentStep[];
  },
};

export const agentEventQueries = {
  insert: (event: DbAgentEvent): void => {
    const db = getDb();
    db.prepare(`
      insert into agent_events
        (id, run_id, step_id, type, message, payload, created_at)
      values
        (@id, @run_id, @step_id, @type, @message, @payload, @created_at)
    `).run(event);
  },
  listByRun: (runId: string): DbAgentEvent[] => {
    const db = getDb();
    return db
      .prepare('select * from agent_events where run_id = ? order by created_at asc')
      .all(runId) as DbAgentEvent[];
  },
};

export const hostFactsQueries = {
  get: (hostId: string): DbHostFacts | undefined => {
    const db = getDb();
    return db
      .prepare('select * from agent_host_facts where host_id = ?')
      .get(hostId) as DbHostFacts | undefined;
  },
  upsert: (facts: DbHostFacts): void => {
    const db = getDb();
    db.prepare(`
      insert or replace into agent_host_facts
        (host_id, facts, updated_at)
      values
        (@host_id, @facts, @updated_at)
    `).run(facts);
  },
};

export const agentPlaybookQueries = {
  upsert: (playbook: DbAgentPlaybook): void => {
    const db = getDb();
    db.prepare(`
      insert or replace into agent_playbooks
        (id, workspace_id, name, task, source_run_id, steps, created_at)
      values
        (@id, @workspace_id, @name, @task, @source_run_id, @steps, @created_at)
    `).run(playbook);
  },
  listByWorkspace: (workspaceId: string): DbAgentPlaybook[] => {
    const db = getDb();
    return db
      .prepare('select * from agent_playbooks where workspace_id = ? order by created_at desc')
      .all(workspaceId) as DbAgentPlaybook[];
  },
  getById: (id: string): DbAgentPlaybook | undefined => {
    const db = getDb();
    return db
      .prepare('select * from agent_playbooks where id = ?')
      .get(id) as DbAgentPlaybook | undefined;
  },
  getByName: (name: string, workspaceId?: string): DbAgentPlaybook | undefined => {
    const db = getDb();
    if (workspaceId) {
      return db
        .prepare('select * from agent_playbooks where workspace_id = ? and lower(name) = lower(?) order by created_at desc limit 1')
        .get(workspaceId, name) as DbAgentPlaybook | undefined;
    }
    return db
      .prepare('select * from agent_playbooks where lower(name) = lower(?) order by created_at desc limit 1')
      .get(name) as DbAgentPlaybook | undefined;
  },
  listRecent: (limit: number): DbAgentPlaybook[] => {
    const db = getDb();
    return db
      .prepare('select * from agent_playbooks order by created_at desc limit ?')
      .all(limit) as DbAgentPlaybook[];
  },
};
