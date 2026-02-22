import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Code2, Copy } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import type { Snippet, CreateSnippetInput, UpdateSnippetInput } from '@shared/types/snippets';
import { toast } from 'sonner';

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

  async function handleCopyCommand(command: string) {
    try {
      await navigator.clipboard.writeText(command);
      toast.success('Snippet command copied');
    } catch {
      toast.error('Failed to copy command');
    }
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex-1 overflow-y-auto py-6 px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-display mb-2">Snippets</h1>
          <p className="text-body text-[var(--text-secondary)]">Save and execute frequently used commands</p>
        </div>

        {/* Search and Add */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2 h-10 px-3 border border-[var(--border)] rounded-md bg-[var(--input)] w-[200px]">
            <svg className="h-4 w-4 text-[var(--text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search snippets..."
              className="flex-1 bg-transparent text-sm outline-none text-foreground placeholder:text-[var(--text-tertiary)]"
            />
          </div>
          <Button onClick={openCreateDialog} className="h-10 px-5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white">
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
                className={cn(
                  'flex items-center justify-between px-5 py-5 border border-[var(--border)] bg-[var(--card)] rounded-lg',
                  'transition-all duration-300 hover:bg-[var(--card-hover)] hover:-translate-y-0.5 hover:shadow-md'
                )}
              >
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-3">
                    <h3 className="text-card-title">{snippet.name}</h3>
                    {snippet.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 text-tiny bg-[var(--primary)]/15 text-[var(--primary)] border border-[var(--primary)]/30 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <code className="text-small text-[var(--text-secondary)] font-mono block">
                    {snippet.command}
                  </code>
                  {snippet.description && (
                    <p className="text-tiny text-[var(--text-tertiary)]">{snippet.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => void handleCopyCommand(snippet.command)}
                    title="Copy command"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEditDialog(snippet)}
                  >
                    <Pencil className="h-4 w-4" />
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
