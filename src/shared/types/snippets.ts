export interface Snippet {
  id: string;
  workspaceId: string;
  name: string;
  command: string;
  description?: string;
  tags: string[];
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateSnippetInput {
  workspaceId: string;
  name: string;
  command: string;
  description?: string;
  tags?: string[];
}

export interface UpdateSnippetInput {
  id: string;
  name?: string;
  command?: string;
  description?: string;
  tags?: string[];
}
