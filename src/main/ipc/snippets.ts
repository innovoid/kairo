import type { IpcMainInvokeEvent } from 'electron';
import type { SupabaseClient } from '@supabase/supabase-js';
import { snippetQueries } from '../db';
import type { Snippet, CreateSnippetInput, UpdateSnippetInput } from '../../shared/types/snippets';
import { logger } from '../lib/logger';

function getClient(event: IpcMainInvokeEvent): SupabaseClient {
  const client = (event as unknown as { supabase: SupabaseClient }).supabase;
  if (!client) throw new Error('Not authenticated');
  return client;
}

function rowToSnippet(row: {
  id: string;
  workspace_id: string;
  name: string;
  command: string;
  description: string | null;
  tags: string | string[];
  created_by: string | null;
  created_at?: string;
  updated_at?: string;
  synced_at?: number | null;
}): Snippet {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    command: row.command,
    description: row.description ?? undefined,
    tags: Array.isArray(row.tags) ? row.tags : (JSON.parse(row.tags || '[]') as string[]),
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const snippetsIpcHandlers = {
  async list(event: IpcMainInvokeEvent, workspaceId: string): Promise<Snippet[]> {
    try {
      const supabase = getClient(event);
      const { data, error } = await supabase
        .from('snippets')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const snippets = (data ?? []).map(rowToSnippet);

      // Upsert to SQLite cache
      for (const snippet of snippets) {
        snippetQueries.upsert({
          id: snippet.id,
          workspace_id: snippet.workspaceId,
          name: snippet.name,
          command: snippet.command,
          description: snippet.description ?? null,
          tags: JSON.stringify(snippet.tags),
          created_by: snippet.createdBy ?? null,
          synced_at: Date.now(),
        });
      }

      return snippets;
    } catch (error) {
      logger.error('Error in snippets.list:', error);
      // Fall back to SQLite cache
      const rows = snippetQueries.listByWorkspace(workspaceId);
      return rows.map(rowToSnippet);
    }
  },

  async create(event: IpcMainInvokeEvent, input: CreateSnippetInput): Promise<Snippet> {
    try {
      const supabase = getClient(event);
      const { data, error } = await supabase
        .from('snippets')
        .insert({
          workspace_id: input.workspaceId,
          name: input.name,
          command: input.command,
          description: input.description ?? null,
          tags: input.tags ?? [],
        })
        .select()
        .single();

      if (error) throw error;

      const snippet = rowToSnippet(data);

      // Upsert to SQLite
      snippetQueries.upsert({
        id: snippet.id,
        workspace_id: snippet.workspaceId,
        name: snippet.name,
        command: snippet.command,
        description: snippet.description ?? null,
        tags: JSON.stringify(snippet.tags),
        created_by: snippet.createdBy ?? null,
        synced_at: Date.now(),
      });

      return snippet;
    } catch (error) {
      logger.error('Error in snippets.create:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to create snippet');
    }
  },

  async update(event: IpcMainInvokeEvent, input: UpdateSnippetInput): Promise<Snippet> {
    try {
      const supabase = getClient(event);
      const updateData: Record<string, unknown> = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.command !== undefined) updateData.command = input.command;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.tags !== undefined) updateData.tags = input.tags;

      const { data, error } = await supabase
        .from('snippets')
        .update(updateData)
        .eq('id', input.id)
        .select()
        .single();

      if (error) throw error;

      const snippet = rowToSnippet(data);

      // Upsert to SQLite
      snippetQueries.upsert({
        id: snippet.id,
        workspace_id: snippet.workspaceId,
        name: snippet.name,
        command: snippet.command,
        description: snippet.description ?? null,
        tags: JSON.stringify(snippet.tags),
        created_by: snippet.createdBy ?? null,
        synced_at: Date.now(),
      });

      return snippet;
    } catch (error) {
      logger.error('Error in snippets.update:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to update snippet');
    }
  },

  async delete(event: IpcMainInvokeEvent, id: string): Promise<void> {
    try {
      const supabase = getClient(event);
      const { error } = await supabase.from('snippets').delete().eq('id', id);
      if (error) throw error;
      snippetQueries.delete(id);
    } catch (error) {
      logger.error('Error in snippets.delete:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to delete snippet');
    }
  },
};
