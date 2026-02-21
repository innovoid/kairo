import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Code2 } from 'lucide-react';
import { useSnippetStore } from '@/stores/snippet-store';
import { useWorkspaceStore } from '@/stores/workspace-store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { Snippet, CreateSnippetInput, UpdateSnippetInput } from '@shared/types/snippets';

interface SnippetFormData {
  name: string;
  command: string;
  description: string;
  tags: string;
}

const emptyForm: SnippetFormData = {
  name: '',
  command: '',
  description: '',
  tags: '',
};

export function SnippetsPage() {
  const { snippets, isLoading, fetchSnippets, createSnippet, updateSnippet, deleteSnippet } =
    useSnippetStore();
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSnippet, setEditingSnippet] = useState<Snippet | null>(null);
  const [form, setForm] = useState<SnippetFormData>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (activeWorkspace?.id) {
      fetchSnippets(activeWorkspace.id);
    }
  }, [activeWorkspace?.id]);

  function openCreateDialog() {
    setEditingSnippet(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEditDialog(snippet: Snippet) {
    setEditingSnippet(snippet);
    setForm({
      name: snippet.name,
      command: snippet.command,
      description: snippet.description ?? '',
      tags: snippet.tags.join(', '),
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.command.trim()) return;
    if (!activeWorkspace?.id) return;

    setSaving(true);
    try {
      const tags = form.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      if (editingSnippet) {
        const input: UpdateSnippetInput = {
          id: editingSnippet.id,
          name: form.name.trim(),
          command: form.command.trim(),
          description: form.description.trim() || undefined,
          tags,
        };
        await updateSnippet(input);
      } else {
        const input: CreateSnippetInput = {
          workspaceId: activeWorkspace.id,
          name: form.name.trim(),
          command: form.command.trim(),
          description: form.description.trim() || undefined,
          tags,
        };
        await createSnippet(input);
      }
      setDialogOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await deleteSnippet(id);
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex-1 overflow-y-auto py-10 px-14">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-5xl font-semibold mb-3" style={{ fontFamily: 'Cormorant Garamond, serif' }}>Snippets</h1>
          <p className="text-sm text-muted-foreground">Save and execute frequently used commands</p>
        </div>

        {/* Search and Add */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2 h-9 px-3 border border-border rounded w-[200px]">
            <svg className="h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search snippets..."
              className="flex-1 bg-transparent text-sm outline-none text-muted-foreground placeholder:text-muted-foreground/50"
            />
          </div>
          <Button onClick={openCreateDialog} className="h-9 px-5 text-sm font-medium bg-[#C9A962] hover:bg-[#B89851] text-[#0A0A0A]">
            <Plus className="h-4 w-4 mr-2" />
            New Snippet
          </Button>
        </div>
        {isLoading ? (
          <div className="text-muted-foreground text-sm">Loading snippets...</div>
        ) : snippets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground">
            <Code2 className="h-10 w-10 opacity-30" />
            <p className="text-sm">No snippets yet. Create one to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {snippets.map((snippet) => (
              <div
                key={snippet.id}
                className="flex items-center justify-between px-6 py-6 border border-border bg-card"
              >
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-3">
                    <h3 className="text-base font-medium">{snippet.name}</h3>
                    {snippet.tags.map((tag) => (
                      <span key={tag} className="px-2 py-1 text-xs bg-[#C9A962]/20 text-[#C9A962] border border-[#C9A962]/30">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <code className="text-sm text-muted-foreground font-mono block">
                    {snippet.command}
                  </code>
                  {snippet.description && (
                    <p className="text-xs text-muted-foreground">{snippet.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <button className="px-3 py-1.5 border border-[#C9A962] text-[#C9A962] hover:bg-[#C9A962]/10 transition-colors text-xs font-medium flex items-center gap-1.5">
                    <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    Run
                  </button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => openEditDialog(snippet)}
                    title="Edit snippet"
                  >
                    <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSnippet ? 'Edit Snippet' : 'New Snippet'}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Name</label>
              <Input
                placeholder="e.g. Tail logs"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Command</label>
              <Input
                placeholder="e.g. tail -f /var/log/syslog"
                value={form.command}
                onChange={(e) => setForm((f) => ({ ...f, command: e.target.value }))}
                className="font-mono text-xs"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">
                Description (optional)
              </label>
              <Input
                placeholder="Briefly describe what this command does"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">
                Tags (comma-separated)
              </label>
              <Input
                placeholder="e.g. logs, monitoring"
                value={form.tags}
                onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter showCloseButton>
            <Button
              onClick={handleSave}
              disabled={saving || !form.name.trim() || !form.command.trim()}
            >
              {saving ? 'Saving...' : editingSnippet ? 'Save Changes' : 'Create Snippet'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
