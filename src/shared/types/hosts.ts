export interface HostFolder {
  id: string;
  workspaceId: string;
  parentId: string | null;
  name: string;
  position: number;
  createdAt: string;
}

export interface Host {
  id: string;
  workspaceId: string;
  folderId: string | null;
  label: string;
  hostname: string;
  port: number;
  username: string;
  authType: 'password' | 'key';
  password: string | null;
  keyId: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateHostInput {
  workspaceId: string;
  folderId?: string | null;
  label: string;
  hostname: string;
  port?: number;
  username: string;
  authType: 'password' | 'key';
  password?: string | null;
  keyId?: string | null;
  tags?: string[];
}

export interface UpdateHostInput {
  folderId?: string | null;
  label?: string;
  hostname?: string;
  port?: number;
  username?: string;
  authType?: 'password' | 'key';
  password?: string | null;
  keyId?: string | null;
  tags?: string[];
}

export interface CreateFolderInput {
  workspaceId: string;
  parentId?: string | null;
  name: string;
  position?: number;
}
