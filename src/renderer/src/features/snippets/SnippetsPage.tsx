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
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
        <div className="flex items-center gap-2">
          <Code2 className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-base font-semibold">Snippets</h1>
        </div>
        <Button size="sm" onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-1" />
          New Snippet
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {isLoading ? (
          <div className="text-muted-foreground text-sm">Loading snippets...</div>
        ) : snippets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground">
            <Code2 className="h-10 w-10 opacity-30" />
            <p className="text-sm">No snippets yet. Create one to get started.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {snippets.map((snippet) => (
              <div
                key={snippet.id}
                className="flex items-start gap-3 p-3 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{snippet.name}</span>
                    {snippet.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <code className="text-xs text-muted-foreground font-mono bg-muted/50 px-2 py-0.5 rounded block truncate">
                    {snippet.command}
                  </code>
                  {snippet.description && (
                    <p className="text-xs text-muted-foreground mt-1">{snippet.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => openEditDialog(snippet)}
                    title="Edit snippet"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(snippet.id)}
                    title="Delete snippet"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
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
