import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import type { HostFolder } from '@shared/types/hosts';

interface FolderDialogProps {
  open: boolean;
  folder?: HostFolder | null;
  workspaceId: string;
  onClose: () => void;
  onSave: (name: string, folderId?: string) => Promise<void>;
}

export function FolderDialog({ open, folder, workspaceId, onClose, onSave }: FolderDialogProps) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (folder) {
      setName(folder.name);
    } else {
      setName('');
    }
    setError(null);
  }, [folder, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    if (!workspaceId) {
      setError('Workspace is not ready yet.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await onSave(name.trim(), folder?.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save folder');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{folder ? 'Rename Folder' : 'New Folder'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="folder-name">Folder Name</Label>
              <Input
                id="folder-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Production, Staging, AWS, etc."
                required
                autoFocus
              />
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading ? 'Saving...' : folder ? 'Rename' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
