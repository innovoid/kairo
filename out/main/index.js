import { app, dialog, ipcMain, BrowserWindow } from "electron";
import { join } from "node:path";
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import Database from "better-sqlite3";
import { mkdirSync, createReadStream, createWriteStream } from "node:fs";
import ssh2 from "ssh2";
import { createDecipheriv, createHash, randomBytes, createCipheriv, pbkdf2Sync } from "node:crypto";
import { stat } from "node:fs/promises";
import __cjs_mod__ from "node:module";
const __filename = import.meta.filename;
const __dirname = import.meta.dirname;
const require2 = __cjs_mod__.createRequire(import.meta.url);
const toWorkspace = (row) => ({
  id: row.id,
  name: row.name,
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});
function isMissingRpcError(error, functionName) {
  if (!error) return false;
  if (error.code !== "PGRST202") return false;
  const text = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  return text.includes(functionName.toLowerCase());
}
async function getAuthedClient(event) {
  const client = event.supabase;
  if (!client) {
    throw new Error("Supabase client missing from IPC event context");
  }
  return client;
}
async function ensurePersonalWorkspaceDirect(supabase, name) {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error("Not authenticated");
  const { data: existingMember } = await supabase.from("workspace_members").select("workspace_id").eq("user_id", user.id).eq("role", "owner").limit(1).maybeSingle();
  if (existingMember) {
    const { data: existing, error: wsErr } = await supabase.from("workspaces").select("id,name,created_by,created_at,updated_at").eq("id", existingMember.workspace_id).single();
    if (wsErr) throw wsErr;
    await supabase.from("user_workspace_settings").upsert({ user_id: user.id, workspace_id: existing.id, is_active: true }, { onConflict: "user_id,workspace_id" });
    return existing;
  }
  const { data: ws, error: wsError } = await supabase.from("workspaces").insert({ name, created_by: user.id }).select("id,name,created_by,created_at,updated_at").single();
  if (wsError) throw wsError;
  await supabase.from("workspace_members").insert({ workspace_id: ws.id, user_id: user.id, role: "owner" });
  await supabase.from("user_workspace_settings").upsert({ user_id: user.id, workspace_id: ws.id, is_active: true }, { onConflict: "user_id,workspace_id" });
  return ws;
}
const workspaceIpcHandlers = {
  async create(event, input) {
    const supabase = await getAuthedClient(event);
    const { data, error } = await supabase.rpc("create_workspace_with_owner", { workspace_name: input.name });
    if (!error) {
      const row2 = Array.isArray(data) ? data[0] : data;
      return toWorkspace(row2);
    }
    if (!isMissingRpcError(error, "create_workspace_with_owner")) throw error;
    const row = await ensurePersonalWorkspaceDirect(supabase, input.name);
    return toWorkspace(row);
  },
  async listMine(event) {
    const supabase = await getAuthedClient(event);
    const { data, error } = await supabase.from("workspaces").select("id,name,created_by,created_at,updated_at").order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((row) => toWorkspace(row));
  },
  async switchActive(event, workspaceId) {
    const supabase = await getAuthedClient(event);
    const { error } = await supabase.rpc("set_active_workspace", { target_workspace_id: workspaceId });
    if (error) throw error;
  },
  async getActiveContext(event) {
    const supabase = await getAuthedClient(event);
    const { data: setting, error: settingError } = await supabase.from("user_workspace_settings").select("workspace_id").eq("is_active", true).limit(1).maybeSingle();
    if (settingError) throw settingError;
    if (!setting) return null;
    const workspaceId = setting.workspace_id;
    const [{ data: ws, error: wsError }, { data: member, error: memberError }] = await Promise.all([
      supabase.from("workspaces").select("id,name,created_by,created_at,updated_at").eq("id", workspaceId).single(),
      supabase.from("workspace_members").select("role").eq("workspace_id", workspaceId).eq("user_id", (await supabase.auth.getUser()).data.user?.id ?? "").single()
    ]);
    if (wsError) throw wsError;
    if (memberError) throw memberError;
    if (!ws || !member) return null;
    const workspace = ws;
    return {
      workspace: toWorkspace(workspace),
      role: member.role,
      isDefaultPersonal: workspace.name.toLowerCase() === "personal workspace"
    };
  },
  async ensurePersonalWorkspace(event, defaultName = "Personal Workspace") {
    const supabase = await getAuthedClient(event);
    let row = null;
    const namedArgCall = await supabase.rpc("ensure_personal_workspace", { default_name: defaultName });
    if (!namedArgCall.error) {
      row = Array.isArray(namedArgCall.data) ? namedArgCall.data[0] : namedArgCall.data;
    } else if (isMissingRpcError(namedArgCall.error, "ensure_personal_workspace")) {
      const noArgCall = await supabase.rpc("ensure_personal_workspace");
      if (!noArgCall.error) {
        row = Array.isArray(noArgCall.data) ? noArgCall.data[0] : noArgCall.data;
      } else if (isMissingRpcError(noArgCall.error, "ensure_personal_workspace")) {
        const createCall = await supabase.rpc("create_workspace_with_owner", { workspace_name: defaultName });
        if (!createCall.error) {
          row = Array.isArray(createCall.data) ? createCall.data[0] : createCall.data;
        } else if (isMissingRpcError(createCall.error, "create_workspace_with_owner")) {
          row = await ensurePersonalWorkspaceDirect(supabase, defaultName);
        } else {
          throw createCall.error;
        }
      } else {
        throw noArgCall.error;
      }
    } else {
      throw namedArgCall.error;
    }
    if (!row) {
      throw new Error("Failed to resolve or create personal workspace.");
    }
    const activateCall = await supabase.rpc("set_active_workspace", { target_workspace_id: row.id });
    if (activateCall.error && !isMissingRpcError(activateCall.error, "set_active_workspace")) {
      console.warn("set_active_workspace failed (non-fatal):", activateCall.error.message);
    }
    return toWorkspace(row);
  },
  async invite(event, input) {
    const supabase = await getAuthedClient(event);
    const token = crypto.randomUUID();
    const encoder = new TextEncoder();
    const digestBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(token));
    const tokenHash = Array.from(new Uint8Array(digestBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
    const expiresAt = new Date(Date.now() + (input.expiresInHours ?? 72) * 60 * 60 * 1e3).toISOString();
    const { data: { user: inviter } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from("workspace_invites").insert({
      workspace_id: input.workspaceId,
      email: input.email.toLowerCase(),
      role: input.role,
      token_hash: tokenHash,
      expires_at: expiresAt,
      invited_by: inviter?.id ?? null
    }).select("id,workspace_id,email,role,invited_by,expires_at,accepted_at,revoked_at,created_at").single();
    if (error) throw error;
    return {
      id: data.id,
      workspaceId: data.workspace_id,
      email: data.email,
      role: data.role,
      invitedBy: data.invited_by,
      expiresAt: data.expires_at,
      acceptedAt: data.accepted_at,
      revokedAt: data.revoked_at,
      createdAt: data.created_at
    };
  },
  async acceptInvite(event, token) {
    const supabase = await getAuthedClient(event);
    const { data, error } = await supabase.rpc("accept_workspace_invite", { raw_token: token });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return { workspaceId: row.workspace_id, role: row.role };
  },
  async revokeInvite(event, workspaceInviteId) {
    const supabase = await getAuthedClient(event);
    const { error } = await supabase.from("workspace_invites").update({ revoked_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", workspaceInviteId).is("accepted_at", null);
    if (error) throw error;
  },
  async updateWorkspace(event, workspaceId, updates) {
    const supabase = await getAuthedClient(event);
    const { data, error } = await supabase.from("workspaces").update(updates).eq("id", workspaceId).select("id,name,created_by,created_at,updated_at").single();
    if (error) throw error;
    return toWorkspace(data);
  },
  async deleteWorkspace(event, workspaceId) {
    const supabase = await getAuthedClient(event);
    const { data: workspace } = await supabase.from("workspaces").select("created_by").eq("id", workspaceId).single();
    const { data: { user } } = await supabase.auth.getUser();
    if (workspace?.created_by !== user.id) {
      throw new Error("Only workspace owner can delete workspace");
    }
    const { error } = await supabase.from("workspaces").delete().eq("id", workspaceId);
    if (error) throw error;
  },
  async leaveWorkspace(event, workspaceId) {
    const supabase = await getAuthedClient(event);
    const { data: { user } } = await supabase.auth.getUser();
    const { data: owners } = await supabase.from("workspace_members").select("user_id").eq("workspace_id", workspaceId).eq("role", "owner");
    if (owners && owners.length === 1 && owners[0].user_id === user.id) {
      throw new Error("Cannot leave workspace as the last owner. Delete the workspace instead.");
    }
    const { error } = await supabase.from("workspace_members").delete().eq("workspace_id", workspaceId).eq("user_id", user.id);
    if (error) throw error;
  },
  members: {
    async list(event, workspaceId) {
      const supabase = await getAuthedClient(event);
      const { data: members, error: membersError } = await supabase.from("workspace_members").select(`
          workspace_id,
          user_id,
          role,
          created_at,
          users!workspace_members_user_id_fkey (
            email,
            name
          )
        `).eq("workspace_id", workspaceId).order("created_at", { ascending: true });
      if (membersError) throw membersError;
      if (!members || members.length === 0) return [];
      return members.map((row) => ({
        workspaceId: row.workspace_id,
        userId: row.user_id,
        email: row.users?.email || row.user_id,
        name: row.users?.name || row.users?.email || "Unknown User",
        role: row.role,
        createdAt: row.created_at
      }));
    },
    async updateRole(event, input) {
      const supabase = await getAuthedClient(event);
      const { error } = await supabase.from("workspace_members").update({ role: input.role }).eq("workspace_id", input.workspaceId).eq("user_id", input.userId);
      if (error) throw error;
    },
    async remove(event, workspaceId, userId) {
      const supabase = await getAuthedClient(event);
      const { error } = await supabase.from("workspace_members").delete().eq("workspace_id", workspaceId).eq("user_id", userId);
      if (error) throw error;
    }
  }
};
let _db = null;
function getDbPath() {
  const userDataPath = app.getPath("userData");
  const dbDir = join(userDataPath, "archterm");
  mkdirSync(dbDir, { recursive: true });
  return join(dbDir, "local.db");
}
function getDb() {
  if (_db) return _db;
  _db = new Database(getDbPath());
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
  runMigrations(_db);
  return _db;
}
function runMigrations(db) {
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
      auth_tag text not null
    );

    create table if not exists settings_cache (
      user_id text primary key,
      data text not null,
      synced_at integer
    );
  `);
}
const hostQueries = {
  listByWorkspace: (workspaceId) => {
    const db = getDb();
    return db.prepare("select * from hosts where workspace_id = ?").all(workspaceId);
  },
  getById: (id) => {
    const db = getDb();
    return db.prepare("select * from hosts where id = ?").get(id);
  },
  upsert: (host) => {
    const db = getDb();
    db.prepare(`
      insert or replace into hosts
        (id, workspace_id, folder_id, label, hostname, port, username, auth_type, key_id, tags, synced_at)
      values
        (@id, @workspace_id, @folder_id, @label, @hostname, @port, @username, @auth_type, @key_id, @tags, @synced_at)
    `).run(host);
  },
  delete: (id) => {
    const db = getDb();
    db.prepare("delete from hosts where id = ?").run(id);
  }
};
const folderQueries = {
  listByWorkspace: (workspaceId) => {
    const db = getDb();
    return db.prepare("select * from host_folders where workspace_id = ?").all(workspaceId);
  },
  getById: (id) => {
    const db = getDb();
    return db.prepare("select * from host_folders where id = ?").get(id);
  },
  upsert: (folder) => {
    const db = getDb();
    db.prepare(`
      insert or replace into host_folders
        (id, workspace_id, parent_id, name, position, synced_at)
      values
        (@id, @workspace_id, @parent_id, @name, @position, @synced_at)
    `).run(folder);
  },
  delete: (id) => {
    const db = getDb();
    db.prepare("delete from host_folders where id = ?").run(id);
  }
};
const keyQueries = {
  listByWorkspace: (workspaceId) => {
    const db = getDb();
    return db.prepare("select * from ssh_keys where workspace_id = ?").all(workspaceId);
  },
  getById: (id) => {
    const db = getDb();
    return db.prepare("select * from ssh_keys where id = ?").get(id);
  },
  upsert: (key) => {
    const db = getDb();
    db.prepare(`
      insert or replace into ssh_keys
        (id, workspace_id, name, key_type, public_key, fingerprint, has_encrypted_sync, synced_at)
      values
        (@id, @workspace_id, @name, @key_type, @public_key, @fingerprint, @has_encrypted_sync, @synced_at)
    `).run(key);
  },
  delete: (id) => {
    const db = getDb();
    db.prepare("delete from ssh_keys where id = ?").run(id);
    db.prepare("delete from private_keys where key_id = ?").run(id);
  }
};
const privateKeyQueries = {
  get: (keyId) => {
    const db = getDb();
    return db.prepare("select * from private_keys where key_id = ?").get(keyId);
  },
  upsert: (pk) => {
    const db = getDb();
    db.prepare(`
      insert or replace into private_keys (key_id, encrypted_blob, iv, auth_tag)
      values (@key_id, @encrypted_blob, @iv, @auth_tag)
    `).run(pk);
  },
  delete: (keyId) => {
    const db = getDb();
    db.prepare("delete from private_keys where key_id = ?").run(keyId);
  }
};
const settingsQueries = {
  get: (userId) => {
    const db = getDb();
    return db.prepare("select data from settings_cache where user_id = ?").get(userId);
  },
  upsert: (userId, data) => {
    const db = getDb();
    db.prepare(`
      insert or replace into settings_cache (user_id, data, synced_at)
      values (?, ?, ?)
    `).run(userId, data, Date.now());
  }
};
function rowToHost(row) {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    folderId: row.folder_id,
    label: row.label,
    hostname: row.hostname,
    port: row.port,
    username: row.username,
    authType: row.auth_type,
    password: null,
    // Passwords are not stored for security
    keyId: row.key_id,
    tags: row.tags ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
function rowToFolder(row) {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    parentId: row.parent_id,
    name: row.name,
    position: row.position,
    createdAt: row.created_at
  };
}
function rowToKey(row) {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    keyType: row.key_type,
    publicKey: row.public_key,
    fingerprint: row.fingerprint,
    hasEncryptedSync: row.has_encrypted_sync,
    createdAt: row.created_at
  };
}
const supabaseSync = {
  async pullHosts(supabase, workspaceId) {
    const { data, error } = await supabase.from("hosts").select("*").eq("workspace_id", workspaceId);
    if (error) throw error;
    const rows = data ?? [];
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
        synced_at: Date.now()
      });
    }
    return rows.map(rowToHost);
  },
  async pullFolders(supabase, workspaceId) {
    const { data, error } = await supabase.from("host_folders").select("*").eq("workspace_id", workspaceId);
    if (error) throw error;
    const rows = data ?? [];
    for (const row of rows) {
      folderQueries.upsert({
        id: row.id,
        workspace_id: row.workspace_id,
        parent_id: row.parent_id,
        name: row.name,
        position: row.position,
        synced_at: Date.now()
      });
    }
    return rows.map(rowToFolder);
  },
  async pullKeys(supabase, workspaceId) {
    const { data, error } = await supabase.from("ssh_keys").select("*").eq("workspace_id", workspaceId);
    if (error) throw error;
    const rows = data ?? [];
    for (const row of rows) {
      keyQueries.upsert({
        id: row.id,
        workspace_id: row.workspace_id,
        name: row.name,
        key_type: row.key_type,
        public_key: row.public_key,
        fingerprint: row.fingerprint,
        has_encrypted_sync: row.has_encrypted_sync ? 1 : 0,
        synced_at: Date.now()
      });
    }
    return rows.map(rowToKey);
  },
  // Hosts CRUD with local-first architecture (SQLite immediate, Supabase background)
  async createHost(supabase, input) {
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
      synced_at: now
    };
    hostQueries.upsert(newHost);
    supabase.from("hosts").insert({
      id,
      workspace_id: input.workspaceId,
      folder_id: input.folderId ?? null,
      label: input.label,
      hostname: input.hostname,
      port: input.port ?? 22,
      username: input.username,
      auth_type: input.authType,
      key_id: input.keyId ?? null,
      tags: input.tags ?? []
    }).then(({ error }) => {
      if (error) console.error("Background sync failed for host create:", error);
    });
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
      updatedAt: new Date(newHost.synced_at).toISOString()
    };
  },
  async updateHost(supabase, id, input) {
    try {
      console.log("[supabaseSync.updateHost] Starting update:", { id, input });
      const existingHost = hostQueries.getById(id);
      console.log("[supabaseSync.updateHost] Existing host:", {
        found: !!existingHost,
        id: existingHost?.id,
        hasAllFields: existingHost ? {
          id: !!existingHost.id,
          workspace_id: !!existingHost.workspace_id,
          auth_type: !!existingHost.auth_type,
          tags: typeof existingHost.tags
        } : null
      });
      if (!existingHost) {
        throw new Error(`Host with id ${id} not found in local cache`);
      }
      if (!existingHost.id || !existingHost.workspace_id || !existingHost.auth_type) {
        throw new Error(`Host data is corrupted: missing required fields`);
      }
      let existingTags = [];
      try {
        existingTags = JSON.parse(existingHost.tags);
      } catch (e) {
        console.error("Failed to parse existing tags:", e);
        existingTags = [];
      }
      const updatedHost = {
        id: existingHost.id,
        workspace_id: existingHost.workspace_id,
        folder_id: input.folderId !== void 0 ? input.folderId : existingHost.folder_id,
        label: input.label !== void 0 ? input.label : existingHost.label,
        hostname: input.hostname !== void 0 ? input.hostname : existingHost.hostname,
        port: input.port !== void 0 ? input.port : existingHost.port,
        username: input.username !== void 0 ? input.username : existingHost.username,
        auth_type: input.authType !== void 0 ? input.authType : existingHost.auth_type,
        key_id: input.keyId !== void 0 ? input.keyId : existingHost.key_id,
        tags: JSON.stringify(input.tags !== void 0 ? input.tags : existingTags),
        synced_at: Date.now()
      };
      hostQueries.upsert(updatedHost);
      if (input.keyId !== void 0 && input.keyId !== null) {
        const keyRow = keyQueries.getById(input.keyId);
        if (keyRow) {
          await supabase.from("ssh_keys").upsert({
            id: keyRow.id,
            workspace_id: keyRow.workspace_id,
            name: keyRow.name,
            key_type: keyRow.key_type,
            public_key: keyRow.public_key,
            fingerprint: keyRow.fingerprint,
            has_encrypted_sync: keyRow.has_encrypted_sync === 1
          }).then(({ error }) => {
            if (error) console.error("[supabaseSync.updateHost] Failed to sync key metadata:", error);
          });
        }
      }
      const updates = {};
      if (input.folderId !== void 0) updates.folder_id = input.folderId;
      if (input.label !== void 0) updates.label = input.label;
      if (input.hostname !== void 0) updates.hostname = input.hostname;
      if (input.port !== void 0) updates.port = input.port;
      if (input.username !== void 0) updates.username = input.username;
      if (input.authType !== void 0) updates.auth_type = input.authType;
      if (input.keyId !== void 0) updates.key_id = input.keyId;
      if (input.tags !== void 0) updates.tags = input.tags;
      supabase.from("hosts").update(updates).eq("id", id).then(({ error }) => {
        if (error) console.error("Background sync failed for host update:", error);
      });
      let parsedTags = [];
      try {
        parsedTags = JSON.parse(updatedHost.tags);
      } catch (e) {
        console.error("Failed to parse tags for return:", updatedHost.tags, e);
        parsedTags = [];
      }
      console.log("[supabaseSync.updateHost] Returning updated host:", updatedHost.id);
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
        tags: parsedTags,
        createdAt: new Date(updatedHost.synced_at).toISOString(),
        updatedAt: new Date(updatedHost.synced_at).toISOString()
      };
    } catch (error) {
      console.error("[supabaseSync.updateHost] Error updating host:", error);
      throw new Error(`Failed to update host locally: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  },
  async deleteHost(supabase, id) {
    hostQueries.delete(id);
    supabase.from("hosts").delete().eq("id", id).then(({ error }) => {
      if (error) console.error("Background sync failed for host delete:", error);
    });
  },
  async createFolder(supabase, input) {
    const id = crypto.randomUUID();
    const now = Date.now();
    const newFolder = {
      id,
      workspace_id: input.workspaceId,
      parent_id: input.parentId ?? null,
      name: input.name,
      position: input.position ?? 0,
      synced_at: now
    };
    folderQueries.upsert(newFolder);
    supabase.from("host_folders").insert({
      id,
      workspace_id: input.workspaceId,
      parent_id: input.parentId ?? null,
      name: input.name,
      position: input.position ?? 0
    }).then(({ error }) => {
      if (error) console.error("Background sync failed for folder create:", error);
    });
    return {
      id: newFolder.id,
      workspaceId: newFolder.workspace_id,
      parentId: newFolder.parent_id,
      name: newFolder.name,
      position: newFolder.position,
      createdAt: new Date(newFolder.synced_at).toISOString()
    };
  },
  async updateFolder(supabase, id, name) {
    const existing = folderQueries.getById(id);
    if (!existing) throw new Error("Folder not found in local cache");
    const updatedFolder = {
      ...existing,
      name,
      synced_at: Date.now()
    };
    folderQueries.upsert(updatedFolder);
    supabase.from("host_folders").update({ name }).eq("id", id).then(({ error }) => {
      if (error) console.error("Background sync failed for folder update:", error);
    });
    return {
      id: updatedFolder.id,
      workspaceId: updatedFolder.workspace_id,
      parentId: updatedFolder.parent_id,
      name: updatedFolder.name,
      position: updatedFolder.position,
      createdAt: new Date(updatedFolder.synced_at).toISOString()
    };
  },
  async deleteFolder(supabase, id) {
    const db = getDb();
    db.prepare("update hosts set folder_id = null where folder_id = ?").run(id);
    folderQueries.delete(id);
    Promise.all([
      supabase.from("hosts").update({ folder_id: null }).eq("folder_id", id),
      supabase.from("host_folders").delete().eq("id", id)
    ]).then(([updateResult, deleteResult]) => {
      if (updateResult.error) console.error("Background sync failed for moving hosts:", updateResult.error);
      if (deleteResult.error) console.error("Background sync failed for folder delete:", deleteResult.error);
    });
  },
  // Sync keys to Supabase (metadata only, no private keys)
  async syncKeyMetadata(supabase, keyId) {
    const row = keyQueries.getById(keyId);
    if (!row) throw new Error("Key not found");
    await supabase.from("ssh_keys").upsert({
      id: row.id,
      workspace_id: row.workspace_id,
      name: row.name,
      key_type: row.key_type,
      public_key: row.public_key,
      fingerprint: row.fingerprint,
      has_encrypted_sync: row.has_encrypted_sync === 1
    });
  },
  // Local-only list (from SQLite cache)
  listHostsLocal(workspaceId) {
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
      tags: (() => {
        try {
          return JSON.parse(row.tags);
        } catch {
          return [];
        }
      })(),
      createdAt: new Date(row.synced_at ?? Date.now()).toISOString(),
      updatedAt: new Date(row.synced_at ?? Date.now()).toISOString()
    }));
  },
  listFoldersLocal(workspaceId) {
    return folderQueries.listByWorkspace(workspaceId).map((row) => ({
      id: row.id,
      workspaceId: row.workspace_id,
      parentId: row.parent_id,
      name: row.name,
      position: row.position,
      createdAt: new Date(row.synced_at ?? Date.now()).toISOString()
    }));
  }
};
function getClient$2(event) {
  const client = event.supabase;
  if (!client) throw new Error("Not authenticated");
  return client;
}
const hostsIpcHandlers = {
  async listHosts(event, workspaceId) {
    try {
      const supabase = getClient$2(event);
      return await supabaseSync.pullHosts(supabase, workspaceId);
    } catch (error) {
      console.error("Error in listHosts:", error);
      throw new Error(error instanceof Error ? error.message : "Failed to list hosts");
    }
  },
  async createHost(event, input) {
    try {
      const supabase = getClient$2(event);
      return await supabaseSync.createHost(supabase, input);
    } catch (error) {
      console.error("Error in createHost:", error);
      throw new Error(error instanceof Error ? error.message : "Failed to create host");
    }
  },
  async updateHost(event, id, input) {
    try {
      console.log("[hosts.update] Received update request:", {
        id,
        inputKeys: Object.keys(input),
        input: JSON.stringify(input, null, 2)
      });
      const supabase = getClient$2(event);
      const result = await supabaseSync.updateHost(supabase, id, input);
      console.log("[hosts.update] Update successful:", result.id);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : "No stack trace";
      console.error("[hosts.update] ERROR:", {
        message: errorMessage,
        stack: errorStack,
        id,
        inputKeys: Object.keys(input)
      });
      const cleanError = new Error(errorMessage);
      cleanError.stack = errorStack;
      throw cleanError;
    }
  },
  async deleteHost(event, id) {
    try {
      const supabase = getClient$2(event);
      return await supabaseSync.deleteHost(supabase, id);
    } catch (error) {
      console.error("Error in deleteHost:", error);
      throw new Error(error instanceof Error ? error.message : "Failed to delete host");
    }
  },
  async moveHostToFolder(event, id, folderId) {
    try {
      const supabase = getClient$2(event);
      return await supabaseSync.updateHost(supabase, id, { folderId });
    } catch (error) {
      console.error("Error in moveHostToFolder:", error);
      throw new Error(error instanceof Error ? error.message : "Failed to move host to folder");
    }
  },
  async listFolders(event, workspaceId) {
    try {
      const supabase = getClient$2(event);
      return await supabaseSync.pullFolders(supabase, workspaceId);
    } catch (error) {
      console.error("Error in listFolders:", error);
      throw new Error(error instanceof Error ? error.message : "Failed to list folders");
    }
  },
  async createFolder(event, input) {
    try {
      const supabase = getClient$2(event);
      return await supabaseSync.createFolder(supabase, input);
    } catch (error) {
      console.error("Error in createFolder:", error);
      throw new Error(error instanceof Error ? error.message : "Failed to create folder");
    }
  },
  async updateFolder(event, id, name) {
    try {
      const supabase = getClient$2(event);
      return await supabaseSync.updateFolder(supabase, id, name);
    } catch (error) {
      console.error("Error in updateFolder:", error);
      throw new Error(error instanceof Error ? error.message : "Failed to update folder");
    }
  },
  async deleteFolder(event, id) {
    try {
      const supabase = getClient$2(event);
      return await supabaseSync.deleteFolder(supabase, id);
    } catch (error) {
      console.error("Error in deleteFolder:", error);
      throw new Error(error instanceof Error ? error.message : "Failed to delete folder");
    }
  }
};
const { utils: sshUtils } = ssh2;
function toSshKey(row) {
  if (!row) return null;
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    keyType: row.key_type,
    publicKey: row.public_key,
    fingerprint: row.fingerprint,
    hasEncryptedSync: row.has_encrypted_sync === 1,
    createdAt: new Date(row.synced_at ?? Date.now()).toISOString()
  };
}
function detectKeyType(keyData) {
  if (!keyData) return "other";
  const lower = keyData.toLowerCase();
  if (lower.includes("ssh-ed25519") || lower.includes("ed25519")) return "ed25519";
  if (lower.includes("ecdsa")) return "ecdsa";
  if (lower.includes("rsa")) return "rsa";
  return "other";
}
function encryptPrivateKey(keyData) {
  const keyBuf = Buffer.alloc(32);
  Buffer.from("archterm-v1-secret-key-padding!!").copy(keyBuf);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyBuf, iv);
  const encrypted = Buffer.concat([cipher.update(keyData, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    encrypted_blob: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    auth_tag: authTag.toString("base64")
  };
}
function decryptPrivateKey(encrypted_blob, iv, auth_tag) {
  const keyBuf = Buffer.alloc(32);
  Buffer.from("archterm-v1-secret-key-padding!!").copy(keyBuf);
  const ivBuf = Buffer.from(iv, "base64");
  const decipher = createDecipheriv("aes-256-gcm", keyBuf, ivBuf);
  decipher.setAuthTag(Buffer.from(auth_tag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encrypted_blob, "base64")),
    decipher.final()
  ]);
  return decrypted.toString("utf8");
}
function computeFingerprint(keyData) {
  try {
    if (!keyData) return "unknown";
    const hash = createHash("sha256").update(keyData).digest("base64");
    return `SHA256:${hash.replace(/=+$/, "")}`;
  } catch {
    return "unknown";
  }
}
const keyManager = {
  list(workspaceId) {
    return keyQueries.listByWorkspace(workspaceId).map((row) => toSshKey(row)).filter((k) => k !== null);
  },
  async import(input) {
    const { workspaceId, name, pemOrOpenSsh, passphrase } = input;
    if (!pemOrOpenSsh || !pemOrOpenSsh.trim()) {
      throw new Error("Private key content is required");
    }
    let parsedKey = null;
    try {
      parsedKey = sshUtils.parseKey(pemOrOpenSsh, passphrase);
      if (!parsedKey) {
        throw new Error("Failed to parse private key. Check passphrase if encrypted.");
      }
    } catch (e) {
      throw new Error(`Invalid key format: ${e.message}`);
    }
    const keyType = detectKeyType(pemOrOpenSsh);
    const sshKeyType = parsedKey.type || "unknown";
    const publicKeyStr = `${sshKeyType} (${keyType.toUpperCase()} key)`;
    const fingerprint = computeFingerprint(pemOrOpenSsh);
    const id = crypto.randomUUID();
    keyQueries.upsert({
      id,
      workspace_id: workspaceId,
      name,
      key_type: keyType,
      public_key: publicKeyStr,
      fingerprint,
      has_encrypted_sync: 0,
      synced_at: Date.now()
    });
    const { encrypted_blob, iv, auth_tag } = encryptPrivateKey(pemOrOpenSsh);
    privateKeyQueries.upsert({ key_id: id, encrypted_blob, iv, auth_tag });
    return {
      id,
      workspaceId,
      name,
      keyType,
      publicKey: publicKeyStr,
      fingerprint,
      hasEncryptedSync: false,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
  },
  delete(id) {
    keyQueries.delete(id);
  },
  exportPublic(id) {
    const row = keyQueries.getById(id);
    return row?.public_key ?? null;
  },
  async getDecryptedKey(keyId) {
    const pk = privateKeyQueries.get(keyId);
    if (!pk) return null;
    return decryptPrivateKey(pk.encrypted_blob, pk.iv, pk.auth_tag);
  }
};
const { Client } = ssh2;
const sessions = /* @__PURE__ */ new Map();
const sshManager = {
  async connect(sessionId, config, sender) {
    sshManager.disconnect(sessionId);
    const client = new Client();
    sessions.set(sessionId, { client, shell: null, hostId: config.hostId });
    const connectConfig = {
      host: config.host,
      port: config.port,
      username: config.username,
      keepaliveInterval: 1e4,
      readyTimeout: 2e4
    };
    if (config.authType === "password" && config.password) {
      connectConfig.password = config.password;
    } else if (config.authType === "key" && config.privateKeyId) {
      const decrypted = await keyManager.getDecryptedKey(config.privateKeyId);
      if (!decrypted) {
        sender.send("ssh:error", sessionId, "Private key not found for this host");
        sessions.delete(sessionId);
        return;
      }
      connectConfig.privateKey = decrypted;
    }
    client.on("ready", () => {
      client.shell({ term: "xterm-256color" }, (err, stream) => {
        if (err) {
          sender.send("ssh:error", sessionId, err.message);
          sessions.delete(sessionId);
          return;
        }
        const session = sessions.get(sessionId);
        if (session) session.shell = stream;
        stream.on("data", (data) => {
          if (!sender.isDestroyed()) {
            sender.send("ssh:data", sessionId, data.toString("utf8"));
          }
        });
        stream.stderr.on("data", (data) => {
          if (!sender.isDestroyed()) {
            sender.send("ssh:data", sessionId, data.toString("utf8"));
          }
        });
        stream.on("close", () => {
          sessions.delete(sessionId);
          if (!sender.isDestroyed()) {
            sender.send("ssh:closed", sessionId);
          }
        });
        sender.send("ssh:data", sessionId, "\r\nConnected.\r\n");
      });
    });
    client.on("error", (err) => {
      sessions.delete(sessionId);
      if (!sender.isDestroyed()) {
        sender.send("ssh:error", sessionId, err.message);
      }
    });
    client.on("close", () => {
      sessions.delete(sessionId);
      if (!sender.isDestroyed()) {
        sender.send("ssh:closed", sessionId);
      }
    });
    client.connect(connectConfig);
  },
  disconnect(sessionId) {
    const session = sessions.get(sessionId);
    if (session) {
      try {
        session.shell?.close();
        session.client.end();
      } catch {
      }
      sessions.delete(sessionId);
    }
  },
  send(sessionId, data) {
    const session = sessions.get(sessionId);
    session?.shell?.write(data);
  },
  resize(sessionId, cols, rows) {
    const session = sessions.get(sessionId);
    session?.shell?.setWindow(rows, cols, 0, 0);
  },
  getSftpClient(sessionId) {
    return sessions.get(sessionId)?.client;
  },
  disconnectAll() {
    for (const [id] of sessions) {
      sshManager.disconnect(id);
    }
  }
};
const sshIpcHandlers = {
  async connect(event, sessionId, config) {
    await sshManager.connect(sessionId, config, event.sender);
  },
  disconnect(_event, sessionId) {
    sshManager.disconnect(sessionId);
  },
  send(_event, sessionId, data) {
    sshManager.send(sessionId, data);
  },
  resize(_event, sessionId, cols, rows) {
    sshManager.resize(sessionId, cols, rows);
  }
};
function statsToEntry(name, remotePath, s) {
  let type = "other";
  if (s.isDirectory()) type = "directory";
  else if (s.isFile()) type = "file";
  else if (s.isSymbolicLink()) type = "symlink";
  const perms = s.mode ? (s.mode & 511).toString(8).padStart(3, "0") : "---";
  return {
    name,
    path: remotePath,
    type,
    size: s.size ?? 0,
    permissions: perms,
    modifiedAt: s.mtime ? new Date(s.mtime * 1e3).toISOString() : (/* @__PURE__ */ new Date()).toISOString(),
    owner: String(s.uid ?? 0)
  };
}
function getSftp(sessionId) {
  return new Promise((resolve, reject) => {
    const client = sshManager.getSftpClient(sessionId);
    if (!client) {
      reject(new Error(`No SSH session found: ${sessionId}`));
      return;
    }
    client.sftp((err, sftp) => {
      if (err) reject(err);
      else resolve(sftp);
    });
  });
}
const sftpManager = {
  async list(sessionId, remotePath) {
    const sftp = await getSftp(sessionId);
    return new Promise((resolve, reject) => {
      sftp.readdir(remotePath, (err, list) => {
        if (err) {
          reject(err);
          return;
        }
        const entries = list.map(
          (item) => statsToEntry(item.filename, `${remotePath}/${item.filename}`.replace("//", "/"), item.attrs)
        );
        entries.sort((a, b) => {
          if (a.type === "directory" && b.type !== "directory") return -1;
          if (a.type !== "directory" && b.type === "directory") return 1;
          return a.name.localeCompare(b.name);
        });
        resolve(entries);
      });
    });
  },
  async download(sessionId, remotePath, localPath, transferId, sender) {
    const sftp = await getSftp(sessionId);
    const filename = remotePath.split("/").pop() ?? "file";
    return new Promise((resolve, reject) => {
      sftp.stat(remotePath, (statErr, stats) => {
        const totalBytes = statErr ? 0 : stats.size ?? 0;
        let bytesTransferred = 0;
        let lastUpdate = Date.now();
        const readStream = sftp.createReadStream(remotePath);
        const writeStream = createWriteStream(localPath);
        readStream.on("data", (chunk) => {
          bytesTransferred += chunk.length;
          const now = Date.now();
          if (now - lastUpdate > 100) {
            const progress = {
              transferId,
              filename,
              direction: "download",
              bytesTransferred,
              totalBytes,
              status: "active"
            };
            if (!sender.isDestroyed()) sender.send("sftp:progress", progress);
            lastUpdate = now;
          }
        });
        readStream.on("error", (err) => {
          const progress = {
            transferId,
            filename,
            direction: "download",
            bytesTransferred,
            totalBytes,
            status: "error",
            error: err.message
          };
          if (!sender.isDestroyed()) sender.send("sftp:progress", progress);
          reject(err);
        });
        writeStream.on("close", () => {
          const progress = {
            transferId,
            filename,
            direction: "download",
            bytesTransferred: totalBytes,
            totalBytes,
            status: "done"
          };
          if (!sender.isDestroyed()) sender.send("sftp:progress", progress);
          resolve();
        });
        readStream.pipe(writeStream);
      });
    });
  },
  async upload(sessionId, localPath, remotePath, transferId, sender) {
    const sftp = await getSftp(sessionId);
    const filename = localPath.split("/").pop() ?? "file";
    const fileStat = await stat(localPath);
    const totalBytes = fileStat.size;
    let bytesTransferred = 0;
    let lastUpdate = Date.now();
    return new Promise((resolve, reject) => {
      const readStream = createReadStream(localPath);
      const writeStream = sftp.createWriteStream(remotePath);
      readStream.on("data", (chunk) => {
        bytesTransferred += chunk.length;
        const now = Date.now();
        if (now - lastUpdate > 100) {
          const progress = {
            transferId,
            filename,
            direction: "upload",
            bytesTransferred,
            totalBytes,
            status: "active"
          };
          if (!sender.isDestroyed()) sender.send("sftp:progress", progress);
          lastUpdate = now;
        }
      });
      readStream.on("error", (err) => {
        const progress = {
          transferId,
          filename,
          direction: "upload",
          bytesTransferred,
          totalBytes,
          status: "error",
          error: err.message
        };
        if (!sender.isDestroyed()) sender.send("sftp:progress", progress);
        reject(err);
      });
      writeStream.on("close", () => {
        const progress = {
          transferId,
          filename,
          direction: "upload",
          bytesTransferred: totalBytes,
          totalBytes,
          status: "done"
        };
        if (!sender.isDestroyed()) sender.send("sftp:progress", progress);
        resolve();
      });
      readStream.pipe(writeStream);
    });
  },
  async mkdir(sessionId, remotePath) {
    const sftp = await getSftp(sessionId);
    return new Promise((resolve, reject) => {
      sftp.mkdir(remotePath, (err) => err ? reject(err) : resolve());
    });
  },
  async rename(sessionId, oldPath, newPath) {
    const sftp = await getSftp(sessionId);
    return new Promise((resolve, reject) => {
      sftp.rename(oldPath, newPath, (err) => err ? reject(err) : resolve());
    });
  },
  async delete(sessionId, remotePath, isDir) {
    const sftp = await getSftp(sessionId);
    return new Promise((resolve, reject) => {
      if (isDir) {
        sftp.rmdir(remotePath, (err) => err ? reject(err) : resolve());
      } else {
        sftp.unlink(remotePath, (err) => err ? reject(err) : resolve());
      }
    });
  },
  async chmod(sessionId, remotePath, mode) {
    const sftp = await getSftp(sessionId);
    return new Promise((resolve, reject) => {
      sftp.chmod(remotePath, mode, (err) => err ? reject(err) : resolve());
    });
  }
};
const sftpIpcHandlers = {
  async list(event, sessionId, remotePath) {
    return sftpManager.list(sessionId, remotePath);
  },
  async download(event, sessionId, remotePath, localPath, transferId) {
    await sftpManager.download(sessionId, remotePath, localPath, transferId, event.sender);
  },
  async upload(event, sessionId, localPath, remotePath, transferId) {
    await sftpManager.upload(sessionId, localPath, remotePath, transferId, event.sender);
  },
  async mkdir(event, sessionId, remotePath) {
    await sftpManager.mkdir(sessionId, remotePath);
  },
  async rename(event, sessionId, oldPath, newPath) {
    await sftpManager.rename(sessionId, oldPath, newPath);
  },
  async delete(event, sessionId, remotePath, isDir) {
    await sftpManager.delete(sessionId, remotePath, isDir);
  },
  async chmod(event, sessionId, remotePath, mode) {
    await sftpManager.chmod(sessionId, remotePath, mode);
  },
  async pickUploadFiles(event) {
    const result = await dialog.showOpenDialog({
      properties: ["openFile", "multiSelections"],
      title: "Select files to upload"
    });
    return result.canceled ? null : result.filePaths;
  }
};
const PBKDF2_ITERATIONS = 1e5;
const KEY_LENGTH = 32;
const SALT_LENGTH = 32;
function deriveKey(passphrase, salt) {
  return pbkdf2Sync(passphrase, salt, PBKDF2_ITERATIONS, KEY_LENGTH, "sha256");
}
function createVerificationHash(passphrase, salt) {
  const key = deriveKey(passphrase, salt);
  return createHash("sha256").update(key).digest("hex");
}
function encrypt(data, key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(data, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    encrypted: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64")
  };
}
function decrypt(encrypted, iv, authTag, key) {
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(authTag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64")),
    decipher.final()
  ]);
  return decrypted.toString("utf8");
}
const workspaceEncryption = {
  /**
   * Initialize encryption for a workspace (first time setup)
   * Returns the salt to be stored in the database
   */
  async initializeWorkspace(supabase, workspaceId, passphrase) {
    const salt = randomBytes(SALT_LENGTH);
    const saltBase64 = salt.toString("base64");
    const verificationHash = createVerificationHash(passphrase, salt);
    const { error } = await supabase.rpc("init_workspace_encryption", {
      p_workspace_id: workspaceId,
      p_salt: saltBase64,
      p_verification_hash: verificationHash
    });
    if (error) throw new Error(`Failed to initialize workspace encryption: ${error.message}`);
  },
  /**
   * Verify a passphrase against the stored verification hash
   */
  async verifyPassphrase(supabase, workspaceId, passphrase) {
    const { data, error } = await supabase.from("workspace_encryption").select("salt, verification_hash").eq("workspace_id", workspaceId).single();
    if (error || !data) return false;
    const salt = Buffer.from(data.salt, "base64");
    const computedHash = createVerificationHash(passphrase, salt);
    return computedHash === data.verification_hash;
  },
  /**
   * Check if workspace has encryption initialized
   */
  async isInitialized(supabase, workspaceId) {
    const { data, error } = await supabase.from("workspace_encryption").select("workspace_id").eq("workspace_id", workspaceId).single();
    return !error && !!data;
  },
  /**
   * Encrypt and upload a private key to Supabase Storage
   */
  async syncKeyToCloud(supabase, workspaceId, keyId, passphrase) {
    const initialized = await this.isInitialized(supabase, workspaceId);
    if (!initialized) {
      await this.initializeWorkspace(supabase, workspaceId, passphrase);
    } else {
      const valid = await this.verifyPassphrase(supabase, workspaceId, passphrase);
      if (!valid) throw new Error("Invalid workspace passphrase");
    }
    const pk = privateKeyQueries.get(keyId);
    if (!pk) throw new Error("Private key not found in local storage");
    const keyBuf = Buffer.alloc(32);
    Buffer.from("archterm-v1-secret-key-padding!!").copy(keyBuf);
    const localDecipher = createDecipheriv("aes-256-gcm", keyBuf, Buffer.from(pk.iv, "base64"));
    localDecipher.setAuthTag(Buffer.from(pk.auth_tag, "base64"));
    const privateKeyData = Buffer.concat([
      localDecipher.update(Buffer.from(pk.encrypted_blob, "base64")),
      localDecipher.final()
    ]).toString("utf8");
    const { data: encData, error: encError } = await supabase.from("workspace_encryption").select("salt").eq("workspace_id", workspaceId).single();
    if (encError || !encData) throw new Error("Workspace encryption not initialized");
    const salt = Buffer.from(encData.salt, "base64");
    const encryptionKey = deriveKey(passphrase, salt);
    const { encrypted, iv, authTag } = encrypt(privateKeyData, encryptionKey);
    const payload = JSON.stringify({ encrypted, iv, authTag });
    const storagePath = `${workspaceId}/${keyId}.enc`;
    const { error: uploadError } = await supabase.storage.from("encrypted-keys").upload(storagePath, payload, {
      contentType: "application/octet-stream",
      upsert: true
    });
    if (uploadError) throw new Error(`Failed to upload encrypted key: ${uploadError.message}`);
    keyQueries.upsert({
      ...keyQueries.getById(keyId),
      has_encrypted_sync: 1,
      synced_at: Date.now()
    });
    const keyMetadata = keyQueries.getById(keyId);
    if (keyMetadata) {
      await supabase.from("ssh_keys").upsert({
        id: keyMetadata.id,
        workspace_id: keyMetadata.workspace_id,
        name: keyMetadata.name,
        key_type: keyMetadata.key_type,
        public_key: keyMetadata.public_key,
        fingerprint: keyMetadata.fingerprint,
        has_encrypted_sync: true
      });
    }
  },
  /**
   * Download and decrypt a key from Supabase Storage
   */
  async downloadKeyFromCloud(supabase, workspaceId, keyId, passphrase) {
    const valid = await this.verifyPassphrase(supabase, workspaceId, passphrase);
    if (!valid) throw new Error("Invalid workspace passphrase");
    const storagePath = `${workspaceId}/${keyId}.enc`;
    const { data: blob, error: downloadError } = await supabase.storage.from("encrypted-keys").download(storagePath);
    if (downloadError) throw new Error(`Failed to download encrypted key: ${downloadError.message}`);
    const payloadText = await blob.text();
    const { encrypted, iv, authTag } = JSON.parse(payloadText);
    const { data: encData, error: encError } = await supabase.from("workspace_encryption").select("salt").eq("workspace_id", workspaceId).single();
    if (encError || !encData) throw new Error("Workspace encryption not initialized");
    const salt = Buffer.from(encData.salt, "base64");
    const decryptionKey = deriveKey(passphrase, salt);
    return decrypt(encrypted, iv, authTag, decryptionKey);
  },
  /**
   * Delete encrypted key from cloud
   */
  async deleteKeyFromCloud(supabase, workspaceId, keyId) {
    const storagePath = `${workspaceId}/${keyId}.enc`;
    const { error } = await supabase.storage.from("encrypted-keys").remove([storagePath]);
    if (error) console.error("Failed to delete encrypted key from cloud:", error);
  },
  /**
   * Change workspace passphrase (re-encrypt all keys)
   */
  async changePassphrase(supabase, workspaceId, oldPassphrase, newPassphrase) {
    const valid = await this.verifyPassphrase(supabase, workspaceId, oldPassphrase);
    if (!valid) throw new Error("Invalid current passphrase");
    const keys = keyQueries.listByWorkspace(workspaceId).filter((k) => k.has_encrypted_sync === 1);
    if (keys.length === 0) {
      const salt = randomBytes(SALT_LENGTH);
      const saltBase64 = salt.toString("base64");
      const verificationHash = createVerificationHash(newPassphrase, salt);
      await supabase.from("workspace_encryption").update({
        salt: saltBase64,
        verification_hash: verificationHash,
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      }).eq("workspace_id", workspaceId);
      return;
    }
    for (const key of keys) {
      try {
        const privateKeyData = await this.downloadKeyFromCloud(
          supabase,
          workspaceId,
          key.id,
          oldPassphrase
        );
        keyQueries.upsert({ ...key, has_encrypted_sync: 0 });
        const newSalt = randomBytes(SALT_LENGTH);
        const newSaltBase64 = newSalt.toString("base64");
        const newVerificationHash = createVerificationHash(newPassphrase, newSalt);
        await supabase.from("workspace_encryption").update({
          salt: newSaltBase64,
          verification_hash: newVerificationHash,
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        }).eq("workspace_id", workspaceId);
        await this.syncKeyToCloud(supabase, workspaceId, key.id, newPassphrase);
      } catch (error) {
        console.error(`Failed to re-encrypt key ${key.id}:`, error);
        throw error;
      }
    }
  }
};
function getClient$1(event) {
  const client = event.supabase;
  if (!client) throw new Error("Not authenticated");
  return client;
}
const keysIpcHandlers = {
  async list(event, workspaceId) {
    const localKeys = keyManager.list(workspaceId);
    try {
      const supabase = getClient$1(event);
      for (const key of localKeys) {
        try {
          await supabaseSync.syncKeyMetadata(supabase, key.id);
        } catch (error) {
          console.error(`[keys.list] Failed to sync key ${key.id}:`, error);
        }
      }
    } catch (error) {
      console.error("[keys.list] Failed to sync keys to Supabase:", error);
    }
    return localKeys;
  },
  async import(event, input) {
    const key = await keyManager.import(input);
    try {
      const supabase = getClient$1(event);
      await supabaseSync.syncKeyMetadata(supabase, key.id);
      console.log("[keys.import] Key metadata synced to Supabase:", key.id);
    } catch (error) {
      console.error("[keys.import] Failed to sync key metadata to Supabase:", error);
    }
    return key;
  },
  async delete(event, id) {
    keyManager.delete(id);
    try {
      const supabase = getClient$1(event);
      await supabase.from("ssh_keys").delete().eq("id", id);
      console.log("[keys.delete] Key deleted from Supabase:", id);
    } catch (error) {
      console.error("[keys.delete] Failed to delete key from Supabase:", error);
    }
  },
  exportPublic(_event, id) {
    return keyManager.exportPublic(id);
  },
  async syncEncrypted(event, id) {
    const supabase = getClient$1(event);
    await supabaseSync.syncKeyMetadata(supabase, id);
  },
  // Workspace encryption methods
  async isWorkspaceEncryptionInitialized(event, workspaceId) {
    const supabase = getClient$1(event);
    return workspaceEncryption.isInitialized(supabase, workspaceId);
  },
  async initializeWorkspaceEncryption(event, workspaceId, passphrase) {
    const supabase = getClient$1(event);
    return workspaceEncryption.initializeWorkspace(supabase, workspaceId, passphrase);
  },
  async verifyWorkspacePassphrase(event, workspaceId, passphrase) {
    const supabase = getClient$1(event);
    return workspaceEncryption.verifyPassphrase(supabase, workspaceId, passphrase);
  },
  async syncKeyToCloud(event, workspaceId, keyId, passphrase) {
    const supabase = getClient$1(event);
    return workspaceEncryption.syncKeyToCloud(supabase, workspaceId, keyId, passphrase);
  },
  async downloadKeyFromCloud(event, workspaceId, keyId, passphrase) {
    const supabase = getClient$1(event);
    return workspaceEncryption.downloadKeyFromCloud(supabase, workspaceId, keyId, passphrase);
  },
  async deleteKeyFromCloud(event, workspaceId, keyId) {
    const supabase = getClient$1(event);
    return workspaceEncryption.deleteKeyFromCloud(supabase, workspaceId, keyId);
  },
  async changeWorkspacePassphrase(event, workspaceId, oldPassphrase, newPassphrase) {
    const supabase = getClient$1(event);
    return workspaceEncryption.changePassphrase(supabase, workspaceId, oldPassphrase, newPassphrase);
  }
};
async function streamText(provider, apiKey, modelId, messages, requestId, sender) {
  const { streamText: streamText2 } = await import("ai");
  let model;
  if (provider === "openai") {
    const { createOpenAI } = await import("@ai-sdk/openai");
    model = createOpenAI({ apiKey })(modelId);
  } else if (provider === "anthropic") {
    const { createAnthropic } = await import("@ai-sdk/anthropic");
    model = createAnthropic({ apiKey })(modelId);
  } else if (provider === "gemini") {
    const { createGoogleGenerativeAI } = await import("@ai-sdk/google");
    model = createGoogleGenerativeAI({ apiKey })(modelId);
  } else {
    sender.send("ai:error", requestId, `Unknown provider: ${provider}`);
    return;
  }
  try {
    const result = streamText2({
      model,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content
      }))
    });
    for await (const chunk of result.textStream) {
      if (!sender.isDestroyed()) {
        sender.send("ai:chunk", requestId, chunk);
      }
    }
    if (!sender.isDestroyed()) {
      sender.send("ai:done", requestId);
    }
  } catch (err) {
    if (!sender.isDestroyed()) {
      sender.send("ai:error", requestId, err.message);
    }
  }
}
const aiProxy = {
  async complete(input, sender) {
    await streamText(
      input.provider,
      input.apiKey,
      input.model,
      input.messages.map((m) => ({ role: m.role, content: m.content })),
      input.requestId,
      sender
    );
  },
  async translateCommand(input, sender) {
    const systemMessage = {
      role: "system",
      content: `You are an expert Linux/Unix command-line assistant.
The user will describe what they want to do in natural language.
Respond ONLY with the exact shell command(s) they need, no explanation.
If multiple commands are needed, separate them with && or use semicolons.
Do not include markdown code blocks, just the raw command.`
    };
    await streamText(
      input.provider,
      input.apiKey,
      input.model,
      [systemMessage, { role: "user", content: input.naturalLanguage }],
      input.requestId,
      sender
    );
  }
};
const aiIpcHandlers = {
  async complete(event, input) {
    await aiProxy.complete(input, event.sender);
  },
  async translateCommand(event, input) {
    await aiProxy.translateCommand(input, event.sender);
  }
};
function getClient(event) {
  const client = event.supabase;
  if (!client) throw new Error("Not authenticated");
  return client;
}
const DEFAULT_SETTINGS = {
  theme: "dark",
  terminalFont: "JetBrains Mono",
  terminalFontSize: 14,
  terminalTheme: "dracula",
  scrollbackLines: 1e3,
  cursorStyle: "bar",
  bellStyle: "none",
  lineHeight: 1.2,
  aiProvider: "openai",
  openaiApiKeyEncrypted: null,
  anthropicApiKeyEncrypted: null,
  geminiApiKeyEncrypted: null
};
const settingsIpcHandlers = {
  async get(event) {
    const supabase = getClient(event);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");
    const cached = settingsQueries.get(user.id);
    if (cached) {
      return JSON.parse(cached.data);
    }
    const { data } = await supabase.from("settings").select("*").eq("user_id", user.id).maybeSingle();
    if (data) {
      const settings = {
        id: data.id,
        userId: data.user_id,
        theme: data.theme ?? "dark",
        terminalFont: data.terminal_font ?? "JetBrains Mono",
        terminalFontSize: data.terminal_font_size ?? 14,
        terminalTheme: data.terminal_theme ?? "dracula",
        scrollbackLines: data.scrollback_lines ?? 1e3,
        cursorStyle: data.cursor_style ?? "bar",
        bellStyle: data.bell_style ?? "none",
        lineHeight: data.line_height ?? 1.2,
        aiProvider: data.ai_provider ?? "openai",
        openaiApiKeyEncrypted: data.openai_api_key_encrypted ?? null,
        anthropicApiKeyEncrypted: data.anthropic_api_key_encrypted ?? null,
        geminiApiKeyEncrypted: data.gemini_api_key_encrypted ?? null,
        updatedAt: data.updated_at
      };
      settingsQueries.upsert(user.id, JSON.stringify(settings));
      return settings;
    }
    const defaults = {
      id: "",
      userId: user.id,
      ...DEFAULT_SETTINGS,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    return defaults;
  },
  async update(event, input) {
    const supabase = getClient(event);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");
    const updates = {};
    if (input.theme !== void 0) updates.theme = input.theme;
    if (input.terminalFont !== void 0) updates.terminal_font = input.terminalFont;
    if (input.terminalFontSize !== void 0) updates.terminal_font_size = input.terminalFontSize;
    if (input.terminalTheme !== void 0) updates.terminal_theme = input.terminalTheme;
    if (input.scrollbackLines !== void 0) updates.scrollback_lines = input.scrollbackLines;
    if (input.cursorStyle !== void 0) updates.cursor_style = input.cursorStyle;
    if (input.bellStyle !== void 0) updates.bell_style = input.bellStyle;
    if (input.lineHeight !== void 0) updates.line_height = input.lineHeight;
    if (input.aiProvider !== void 0) updates.ai_provider = input.aiProvider;
    if (input.openaiApiKey !== void 0) updates.openai_api_key_encrypted = input.openaiApiKey;
    if (input.anthropicApiKey !== void 0) updates.anthropic_api_key_encrypted = input.anthropicApiKey;
    if (input.geminiApiKey !== void 0) updates.gemini_api_key_encrypted = input.geminiApiKey;
    const { data, error } = await supabase.from("settings").upsert({ user_id: user.id, ...updates }, { onConflict: "user_id" }).select("*").single();
    if (error) throw error;
    const settings = {
      id: data.id,
      userId: data.user_id,
      theme: data.theme ?? "dark",
      terminalFont: data.terminal_font ?? "JetBrains Mono",
      terminalFontSize: data.terminal_font_size ?? 14,
      terminalTheme: data.terminal_theme ?? "dracula",
      scrollbackLines: data.scrollback_lines ?? 1e3,
      cursorStyle: data.cursor_style ?? "bar",
      bellStyle: data.bell_style ?? "none",
      lineHeight: data.line_height ?? 1.2,
      aiProvider: data.ai_provider ?? "openai",
      openaiApiKeyEncrypted: data.openai_api_key_encrypted ?? null,
      anthropicApiKeyEncrypted: data.anthropic_api_key_encrypted ?? null,
      geminiApiKeyEncrypted: data.gemini_api_key_encrypted ?? null,
      updatedAt: data.updated_at
    };
    settingsQueries.upsert(user.id, JSON.stringify(settings));
    return settings;
  }
};
const supabaseByAccessToken = /* @__PURE__ */ new Map();
const accessTokenBySenderId = /* @__PURE__ */ new Map();
const trackedSenderIds = /* @__PURE__ */ new Set();
function createSupabaseClient(accessToken) {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing SUPABASE_URL/SUPABASE_ANON_KEY (or VITE_* fallback) in environment.");
  }
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    },
    ...accessToken ? {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    } : {}
  });
}
function getSupabaseClientForSender(senderId) {
  const accessToken = accessTokenBySenderId.get(senderId);
  if (!accessToken) {
    throw new Error("Not authenticated. Please sign in first.");
  }
  const cachedClient = supabaseByAccessToken.get(accessToken);
  if (cachedClient) {
    return cachedClient;
  }
  const client = createSupabaseClient(accessToken);
  supabaseByAccessToken.set(accessToken, client);
  return client;
}
function withSupabase(handler) {
  return async (event, ...args) => {
    try {
      console.log("[withSupabase] Middleware called, sender:", event.sender.id, "args:", args);
      const scopedEvent = event;
      scopedEvent.supabase = getSupabaseClientForSender(event.sender.id);
      console.log("[withSupabase] Supabase client obtained, calling handler...");
      const result = await handler(scopedEvent, ...args);
      console.log("[withSupabase] Handler returned successfully");
      return result;
    } catch (error) {
      console.error("[withSupabase] ERROR in middleware:", {
        error,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : void 0,
        senderId: event.sender.id,
        argsCount: args.length
      });
      throw error;
    }
  };
}
function register(channel, handler) {
  console.log("[register] Registering IPC handler for channel:", channel);
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
        stack: error instanceof Error ? error.stack : void 0
      });
      throw error;
    }
  });
}
function registerWorkspaceIpcHandlers() {
  register("auth.setAccessToken", async (event, accessToken) => {
    if (!trackedSenderIds.has(event.sender.id)) {
      trackedSenderIds.add(event.sender.id);
      event.sender.once("destroyed", () => {
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
  register("workspace.create", withSupabase(workspaceIpcHandlers.create));
  register("workspace.listMine", withSupabase(workspaceIpcHandlers.listMine));
  register("workspace.switchActive", withSupabase(workspaceIpcHandlers.switchActive));
  register("workspace.getActiveContext", withSupabase(workspaceIpcHandlers.getActiveContext));
  register("workspace.ensurePersonalWorkspace", withSupabase(workspaceIpcHandlers.ensurePersonalWorkspace));
  register("workspace.invite", withSupabase(workspaceIpcHandlers.invite));
  register("workspace.acceptInvite", withSupabase(workspaceIpcHandlers.acceptInvite));
  register("workspace.revokeInvite", withSupabase(workspaceIpcHandlers.revokeInvite));
  register("workspace.updateWorkspace", withSupabase(workspaceIpcHandlers.updateWorkspace));
  register("workspace.deleteWorkspace", withSupabase(workspaceIpcHandlers.deleteWorkspace));
  register("workspace.leaveWorkspace", withSupabase(workspaceIpcHandlers.leaveWorkspace));
  register("workspace.members.list", withSupabase(workspaceIpcHandlers.members.list));
  register("workspace.members.updateRole", withSupabase(workspaceIpcHandlers.members.updateRole));
  register("workspace.members.remove", withSupabase(workspaceIpcHandlers.members.remove));
  register("hosts.list", withSupabase(hostsIpcHandlers.listHosts));
  register("hosts.create", withSupabase(hostsIpcHandlers.createHost));
  register("hosts.update", withSupabase(hostsIpcHandlers.updateHost));
  register("hosts.delete", withSupabase(hostsIpcHandlers.deleteHost));
  register("hosts.moveToFolder", withSupabase(hostsIpcHandlers.moveHostToFolder));
  register("folders.list", withSupabase(hostsIpcHandlers.listFolders));
  register("folders.create", withSupabase(hostsIpcHandlers.createFolder));
  register("folders.update", withSupabase(hostsIpcHandlers.updateFolder));
  register("folders.delete", withSupabase(hostsIpcHandlers.deleteFolder));
  register("ssh.connect", sshIpcHandlers.connect);
  register("ssh.disconnect", sshIpcHandlers.disconnect);
  register("ssh.send", sshIpcHandlers.send);
  register("ssh.resize", sshIpcHandlers.resize);
  register("sftp.list", sftpIpcHandlers.list);
  register("sftp.download", sftpIpcHandlers.download);
  register("sftp.upload", sftpIpcHandlers.upload);
  register("sftp.mkdir", sftpIpcHandlers.mkdir);
  register("sftp.rename", sftpIpcHandlers.rename);
  register("sftp.delete", sftpIpcHandlers.delete);
  register("sftp.chmod", sftpIpcHandlers.chmod);
  register("sftp.pickUploadFiles", sftpIpcHandlers.pickUploadFiles);
  register("keys.list", withSupabase(keysIpcHandlers.list));
  register("keys.import", withSupabase(keysIpcHandlers.import));
  register("keys.delete", withSupabase(keysIpcHandlers.delete));
  register("keys.exportPublic", keysIpcHandlers.exportPublic);
  register("keys.syncEncrypted", withSupabase(keysIpcHandlers.syncEncrypted));
  register("ai.complete", aiIpcHandlers.complete);
  register("ai.translateCommand", aiIpcHandlers.translateCommand);
  register("settings.get", withSupabase(settingsIpcHandlers.get));
  register("settings.update", withSupabase(settingsIpcHandlers.update));
}
function createMainWindow() {
  const window = new BrowserWindow({
    width: 1380,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: "#09090b",
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, "../preload/index.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      devTools: true
    }
  });
  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void window.loadFile(join(__dirname, "../renderer/index.html"));
  }
  return window;
}
app.whenReady().then(() => {
  registerWorkspaceIpcHandlers();
  createMainWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
