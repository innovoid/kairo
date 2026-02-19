import type { IpcMainInvokeEvent } from 'electron';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ActiveWorkspaceContext,
  CreateWorkspaceInput,
  InviteWorkspaceMemberInput,
  UpdateWorkspaceMemberRoleInput,
  Workspace,
  WorkspaceInvite,
  WorkspaceMember,
  WorkspaceRole,
} from '../../shared/types/workspace';

type WorkspaceRow = {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
  updated_at: string;
};

type SupabaseRpcError = {
  code?: string;
  message?: string;
  details?: string | null;
};

const toWorkspace = (row: WorkspaceRow): Workspace => ({
  id: row.id,
  name: row.name,
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

function isMissingRpcError(error: SupabaseRpcError | null | undefined, functionName: string): boolean {
  if (!error) return false;
  if (error.code !== 'PGRST202') return false;

  const text = `${error.message ?? ''} ${error.details ?? ''}`.toLowerCase();
  return text.includes(functionName.toLowerCase());
}

async function getAuthedClient(event: IpcMainInvokeEvent): Promise<SupabaseClient> {
  const client = (event as unknown as { supabase: SupabaseClient }).supabase;
  if (!client) {
    throw new Error('Supabase client missing from IPC event context');
  }
  return client;
}

// Direct table-based fallback when no RPCs are available
async function ensurePersonalWorkspaceDirect(supabase: SupabaseClient, name: string): Promise<WorkspaceRow> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error('Not authenticated');

  // Check if user already has a workspace (via membership)
  const { data: existingMember } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .eq('role', 'owner')
    .limit(1)
    .maybeSingle();

  if (existingMember) {
    const { data: existing, error: wsErr } = await supabase
      .from('workspaces')
      .select('id,name,created_by,created_at,updated_at')
      .eq('id', existingMember.workspace_id)
      .single();
    if (wsErr) throw wsErr;

    // Ensure it's activated
    await supabase
      .from('user_workspace_settings')
      .upsert({ user_id: user.id, workspace_id: existing.id, is_active: true }, { onConflict: 'user_id,workspace_id' });

    return existing as WorkspaceRow;
  }

  // Create workspace
  const { data: ws, error: wsError } = await supabase
    .from('workspaces')
    .insert({ name, created_by: user.id })
    .select('id,name,created_by,created_at,updated_at')
    .single();
  if (wsError) throw wsError;

  // Add owner membership
  await supabase
    .from('workspace_members')
    .insert({ workspace_id: ws.id, user_id: user.id, role: 'owner' });

  // Activate the new workspace
  await supabase
    .from('user_workspace_settings')
    .upsert({ user_id: user.id, workspace_id: ws.id, is_active: true }, { onConflict: 'user_id,workspace_id' });

  return ws as WorkspaceRow;
}

export const workspaceIpcHandlers = {
  async create(event: IpcMainInvokeEvent, input: CreateWorkspaceInput): Promise<Workspace> {
    const supabase = await getAuthedClient(event);
    const { data, error } = await supabase.rpc('create_workspace_with_owner', { workspace_name: input.name });
    if (!error) {
      const row = Array.isArray(data) ? data[0] : data;
      return toWorkspace(row as WorkspaceRow);
    }
    if (!isMissingRpcError(error, 'create_workspace_with_owner')) throw error;

    // Direct table insert fallback
    const row = await ensurePersonalWorkspaceDirect(supabase, input.name);
    return toWorkspace(row);
  },

  async listMine(event: IpcMainInvokeEvent): Promise<Workspace[]> {
    const supabase = await getAuthedClient(event);
    const { data, error } = await supabase
      .from('workspaces')
      .select('id,name,created_by,created_at,updated_at')
      .order('created_at', { ascending: true });
    if (error) throw error;

    return (data ?? []).map((row) => toWorkspace(row as WorkspaceRow));
  },

  async switchActive(event: IpcMainInvokeEvent, workspaceId: string): Promise<void> {
    const supabase = await getAuthedClient(event);
    const { error } = await supabase.rpc('set_active_workspace', { target_workspace_id: workspaceId });
    if (error) throw error;
  },

  async getActiveContext(event: IpcMainInvokeEvent): Promise<ActiveWorkspaceContext | null> {
    const supabase = await getAuthedClient(event);

    // Step 1: get the active workspace_id for this user
    const { data: setting, error: settingError } = await supabase
      .from('user_workspace_settings')
      .select('workspace_id')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (settingError) throw settingError;
    if (!setting) return null;

    const workspaceId = setting.workspace_id as string;

    // Step 2: fetch workspace details + membership role in parallel
    const [{ data: ws, error: wsError }, { data: member, error: memberError }] = await Promise.all([
      supabase
        .from('workspaces')
        .select('id,name,created_by,created_at,updated_at')
        .eq('id', workspaceId)
        .single(),
      supabase
        .from('workspace_members')
        .select('role')
        .eq('workspace_id', workspaceId)
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id ?? '')
        .single(),
    ]);

    if (wsError) throw wsError;
    if (memberError) throw memberError;
    if (!ws || !member) return null;

    const workspace = ws as WorkspaceRow;
    return {
      workspace: toWorkspace(workspace),
      role: (member as { role: WorkspaceRole }).role,
      isDefaultPersonal: workspace.name.toLowerCase() === 'personal workspace',
    };
  },

  async ensurePersonalWorkspace(event: IpcMainInvokeEvent, defaultName = 'Personal Workspace'): Promise<Workspace> {
    const supabase = await getAuthedClient(event);
    let row: WorkspaceRow | null = null;

    const namedArgCall = await supabase.rpc('ensure_personal_workspace', { default_name: defaultName });
    if (!namedArgCall.error) {
      row = (Array.isArray(namedArgCall.data) ? namedArgCall.data[0] : namedArgCall.data) as WorkspaceRow;
    } else if (isMissingRpcError(namedArgCall.error, 'ensure_personal_workspace')) {
      const noArgCall = await supabase.rpc('ensure_personal_workspace');
      if (!noArgCall.error) {
        row = (Array.isArray(noArgCall.data) ? noArgCall.data[0] : noArgCall.data) as WorkspaceRow;
      } else if (isMissingRpcError(noArgCall.error, 'ensure_personal_workspace')) {
        // Try create_workspace_with_owner RPC
        const createCall = await supabase.rpc('create_workspace_with_owner', { workspace_name: defaultName });
        if (!createCall.error) {
          row = (Array.isArray(createCall.data) ? createCall.data[0] : createCall.data) as WorkspaceRow;
        } else if (isMissingRpcError(createCall.error, 'create_workspace_with_owner')) {
          // Final fallback: direct table insert
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
      throw new Error('Failed to resolve or create personal workspace.');
    }

    // Best-effort activation for UI consistency.
    const activateCall = await supabase.rpc('set_active_workspace', { target_workspace_id: row.id });
    if (activateCall.error && !isMissingRpcError(activateCall.error, 'set_active_workspace')) {
      // Ignore activation errors — it may not be set up yet
      console.warn('set_active_workspace failed (non-fatal):', activateCall.error.message);
    }

    return toWorkspace(row);
  },

  async invite(event: IpcMainInvokeEvent, input: InviteWorkspaceMemberInput): Promise<WorkspaceInvite> {
    const supabase = await getAuthedClient(event);
    const token = crypto.randomUUID();
    const encoder = new TextEncoder();
    const digestBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(token));
    const tokenHash = Array.from(new Uint8Array(digestBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    const expiresAt = new Date(Date.now() + (input.expiresInHours ?? 72) * 60 * 60 * 1000).toISOString();

    const { data: { user: inviter } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('workspace_invites')
      .insert({
        workspace_id: input.workspaceId,
        email: input.email.toLowerCase(),
        role: input.role,
        token_hash: tokenHash,
        expires_at: expiresAt,
        invited_by: inviter?.id ?? null,
      })
      .select('id,workspace_id,email,role,invited_by,expires_at,accepted_at,revoked_at,created_at')
      .single();

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
      createdAt: data.created_at,
    };
  },

  async acceptInvite(event: IpcMainInvokeEvent, token: string): Promise<{ workspaceId: string; role: WorkspaceRole }> {
    const supabase = await getAuthedClient(event);
    const { data, error } = await supabase.rpc('accept_workspace_invite', { raw_token: token });
    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;
    return { workspaceId: row.workspace_id, role: row.role };
  },

  async revokeInvite(event: IpcMainInvokeEvent, workspaceInviteId: string): Promise<void> {
    const supabase = await getAuthedClient(event);
    const { error } = await supabase
      .from('workspace_invites')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', workspaceInviteId)
      .is('accepted_at', null);

    if (error) throw error;
  },

  members: {
    async list(event: IpcMainInvokeEvent, workspaceId: string): Promise<WorkspaceMember[]> {
      const supabase = await getAuthedClient(event);

      // Fetch workspace members
      const { data: members, error: membersError } = await supabase
        .from('workspace_members')
        .select('workspace_id,user_id,role,created_at')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: true });

      if (membersError) throw membersError;
      if (!members || members.length === 0) return [];

      // Fetch user emails from auth (using the admin client would be better, but for now we'll try direct RPC)
      // Note: This requires a Supabase RPC function or accessing auth.users with service role
      const userIds = members.map(m => m.user_id);

      // Try to get emails via Supabase admin API
      const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();

      if (usersError) {
        // If we can't fetch emails, return with userId as email fallback
        console.warn('Could not fetch user emails:', usersError);
        return members.map((row) => ({
          workspaceId: row.workspace_id,
          userId: row.user_id,
          email: row.user_id, // Fallback to showing userId
          role: row.role,
          createdAt: row.created_at,
        }));
      }

      // Map user IDs to emails
      const userEmailMap = new Map(users.map(u => [u.id, u.email || u.id]));

      return members.map((row) => ({
        workspaceId: row.workspace_id,
        userId: row.user_id,
        email: userEmailMap.get(row.user_id) || row.user_id,
        role: row.role,
        createdAt: row.created_at,
      }));
    },

    async updateRole(event: IpcMainInvokeEvent, input: UpdateWorkspaceMemberRoleInput): Promise<void> {
      const supabase = await getAuthedClient(event);
      const { error } = await supabase
        .from('workspace_members')
        .update({ role: input.role })
        .eq('workspace_id', input.workspaceId)
        .eq('user_id', input.userId);

      if (error) throw error;
    },

    async remove(event: IpcMainInvokeEvent, workspaceId: string, userId: string): Promise<void> {
      const supabase = await getAuthedClient(event);
      const { error } = await supabase
        .from('workspace_members')
        .delete()
        .eq('workspace_id', workspaceId)
        .eq('user_id', userId);

      if (error) throw error;
    },
  },
};
