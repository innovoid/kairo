import { useEffect, useState, useRef } from 'react';
import { useKeyStore } from '@/stores/key-store';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, KeyRound, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Workspace } from '@shared/types/workspace';

interface KeysPageProps {
  workspaceId: string;
  showImportPanel?: boolean;
  onOpenImport?: () => void;
  onCloseImport?: () => void;
  onWorkspaceChange?: (ws: Workspace) => void;
}

export function KeysPage({
  workspaceId,
  showImportPanel = false,
  onOpenImport,
  onCloseImport,
}: KeysPageProps) {
  const { keys, fetchKeys, importKey, deleteKey } = useKeyStore();

  useEffect(() => {
    fetchKeys(workspaceId);
  }, [workspaceId]);

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this SSH key?')) return;
    await deleteKey(id);
  }

  return (
    <div className="flex flex-1 h-full overflow-hidden">
      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="py-6 px-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-display mb-2">SSH Keys</h1>
            <p className="text-body text-[var(--text-secondary)]">Manage your SSH private and public keys</p>
          </div>

          {/* Search and Add */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2 h-10 px-3 border border-[var(--border)] rounded-md bg-[var(--input)] w-[200px]">
              <svg className="h-4 w-4 text-[var(--text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search keys..."
                className="flex-1 bg-transparent text-sm outline-none text-foreground placeholder:text-[var(--text-tertiary)]"
              />
            </div>
            <Button onClick={onOpenImport} className="h-10 px-5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white">
              <Plus className="h-4 w-4 mr-2" />
              Import Key
            </Button>
          </div>

          {/* Keys List */}
          {keys.length === 0 ? (
            <div className="text-center py-20">
              <KeyRound className="h-12 w-12 mx-auto text-muted-foreground/20 mb-3" />
              <p className="text-sm font-medium">No SSH keys imported</p>
              <p className="text-xs text-muted-foreground mt-1 mb-4">
                Import your private keys to authenticate with hosts
              </p>
              <Button variant="outline" size="sm" onClick={onOpenImport}>
                <Plus className="h-4 w-4 mr-1.5" />
                Import your first key
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {keys.map((k) => (
                <div
                  key={k.id}
                  className={cn(
                    'flex items-center justify-between px-5 py-4 border border-[var(--border)] bg-[var(--card)] rounded-lg',
                    'transition-all duration-300 hover:bg-[var(--card-hover)] hover:-translate-y-0.5 hover:shadow-md'
                  )}
                >
                  <div className="flex items-center gap-4">
                    <KeyRound className={cn(
                      'h-5 w-5',
                      k.keyType === 'rsa' ? 'text-[var(--primary)]' : 'text-[var(--text-tertiary)]'
                    )} />
                    <div className="flex flex-col gap-1">
                      <h3 className="text-card-title">{k.name}</h3>
                      <div className="flex items-center gap-4 text-tiny text-[var(--text-tertiary)]">
                        <span className="font-mono uppercase">{k.keyType}</span>
                        <span className="font-mono">{k.fingerprint}</span>
                        <span>Added {new Date().toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(k.id)}
                    className="text-[var(--text-secondary)] hover:text-[var(--destructive)]"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Import Panel */}
      {showImportPanel && <ImportKeyPanel workspaceId={workspaceId} onClose={onCloseImport!} />}
    </div>
  );
}

// ─── Import Key Panel ────────────────────────────────────────────────────────

function ImportKeyPanel({ workspaceId, onClose }: { workspaceId: string; onClose: () => void }) {
  const { importKey } = useKeyStore();
  const [name, setName] = useState('');
  const [pem, setPem] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await importKey({ workspaceId, name, pemOrOpenSsh: pem, passphrase: passphrase || undefined });
      setName('');
      setPem('');
      setPassphrase('');
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setPem(text);
    if (!name) {
      setName(file.name);
    }
  }

  return (
    <div className="flex flex-col w-80 h-full border-l bg-background shrink-0">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 h-12 border-b shrink-0">
        <KeyRound className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold flex-1">Import SSH Key</span>
        <button
          onClick={onClose}
          className="inline-flex items-center justify-center h-6 w-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto px-4 py-5 min-h-0">
        <form id="import-key-form" onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="key-name" className="text-xs">
              Key Name
            </Label>
            <Input
              id="key-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Production Key"
              className="h-8 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="key-pem" className="text-xs">
              Private Key
            </Label>
            <Textarea
              id="key-pem"
              value={pem}
              onChange={(e) => setPem(e.target.value)}
              required
              placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
              className="text-xs font-mono min-h-32 resize-none"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept=".pem,.key,*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full h-8"
              onClick={() => fileInputRef.current?.click()}
            >
              Choose File
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="key-passphrase" className="text-xs">
              Passphrase (optional)
            </Label>
            <Input
              id="key-passphrase"
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="Leave blank if no passphrase"
              className="h-8 text-sm"
            />
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2">
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}
        </form>
      </div>

      {/* Footer */}
      <div className="flex gap-2 px-4 py-3 border-t shrink-0">
        <Button type="button" variant="ghost" size="sm" className="flex-1" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" form="import-key-form" size="sm" className="flex-1" disabled={loading}>
          {loading ? 'Importing...' : 'Import'}
        </Button>
      </div>
    </div>
  );
}
