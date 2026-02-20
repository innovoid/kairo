export type WorkspaceRole = 'owner' | 'admin' | 'member';

export interface Workspace {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceMember {
  workspaceId: string;
  userId: string;
  email: string;
  name?: string;
  role: WorkspaceRole;
  createdAt: string;
}

export interface WorkspaceInvite {
  id: string;
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  invitedBy: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface ActiveWorkspaceContext {
  workspace: Workspace;
  role: WorkspaceRole;
  isDefaultPersonal: boolean;
}

export interface CreateWorkspaceInput {
  name: string;
}

export interface InviteWorkspaceMemberInput {
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  expiresInHours?: number;
}

export interface UpdateWorkspaceMemberRoleInput {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
}

export interface WorkspaceIpcApi {
  create: (input: CreateWorkspaceInput) => Promise<Workspace>;
  listMine: () => Promise<Workspace[]>;
  switchActive: (workspaceId: string) => Promise<void>;
  invite: (input: InviteWorkspaceMemberInput) => Promise<WorkspaceInvite>;
  acceptInvite: (input: { token: string }) => Promise<{ workspaceId: string; role: WorkspaceRole }>;
  revokeInvite: (workspaceInviteId: string) => Promise<void>;
  members: {
    list: (workspaceId: string) => Promise<WorkspaceMember[]>;
    updateRole: (input: UpdateWorkspaceMemberRoleInput) => Promise<void>;
    remove: (workspaceId: string, userId: string) => Promise<void>;
  };
}
