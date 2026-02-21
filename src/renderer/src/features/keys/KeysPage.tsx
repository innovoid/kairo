import { useEffect, useState, useRef } from 'react';
import { useKeyStore } from '@/stores/key-store';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, KeyRound, X } from 'lucide-react';
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
        <div className="py-10 px-14">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-5xl font-semibold mb-3" style={{ fontFamily: 'Cormorant Garamond, serif' }}>SSH Keys</h1>
            <p className="text-sm text-muted-foreground">Manage your SSH private and public keys</p>
          </div>

          {/* Search and Add */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2 h-9 px-3 border border-border rounded w-[200px]">
              <svg className="h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search keys..."
                className="flex-1 bg-transparent text-sm outline-none text-muted-foreground placeholder:text-muted-foreground/50"
              />
            </div>
            <Button onClick={onOpenImport} className="h-9 px-5 text-sm font-medium bg-[#C9A962] hover:bg-[#B89851] text-[#0A0A0A]">
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
                <div key={k.id} className="flex items-center justify-between px-6 py-5 border border-border bg-card">
                  <div className="flex items-center gap-5">
                    <KeyRound className={k.keyType === 'rsa' ? 'h-6 w-6 text-[#C9A962]' : 'h-6 w-6 text-muted-foreground'} />
                    <div className="flex flex-col gap-1.5">
                      <h3 className="text-base font-medium">{k.name}</h3>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="font-mono uppercase">{k.keyType}</span>
                        <span className="font-mono">{k.fingerprint}</span>
                        <span>Added {new Date().toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(k.id)}
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                  >
                    <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
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
