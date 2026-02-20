import { create } from 'zustand';
import type { Snippet, CreateSnippetInput, UpdateSnippetInput } from '@shared/types/snippets';

interface SnippetState {
  snippets: Snippet[];
  isLoading: boolean;
  error: string | null;
  fetchSnippets: (workspaceId: string) => Promise<void>;
  createSnippet: (input: CreateSnippetInput) => Promise<Snippet>;
  updateSnippet: (input: UpdateSnippetInput) => Promise<void>;
  deleteSnippet: (id: string) => Promise<void>;
}

export const useSnippetStore = create<SnippetState>((set) => ({
  snippets: [],
  isLoading: false,
  error: null,

  fetchSnippets: async (workspaceId) => {
    set({ isLoading: true, error: null });
    try {
      const snippets = await window.snippetsApi.list(workspaceId);
      set({ snippets, isLoading: false });
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false });
    }
  },

  createSnippet: async (input) => {
    const snippet = await window.snippetsApi.create(input);
    set((state) => ({ snippets: [snippet, ...state.snippets] }));
    return snippet;
  },

  updateSnippet: async (input) => {
    const updated = await window.snippetsApi.update(input);
    set((state) => ({
      snippets: state.snippets.map((s) => (s.id === input.id ? updated : s)),
    }));
  },

  deleteSnippet: async (id) => {
    await window.snippetsApi.delete(id);
    set((state) => ({ snippets: state.snippets.filter((s) => s.id !== id) }));
  },
}));
