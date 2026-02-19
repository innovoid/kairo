import { useEffect, useState } from 'react';
import { useKeyStore } from '@/stores/key-store';
import { ImportKeyDialog } from './ImportKeyDialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Key, Copy, X } from 'lucide-react';
import type { SshKey } from '@shared/types/keys';

interface KeyManagerProps {
  onClose: () => void;
  workspaceId: string;
}

export function KeyManager({ onClose, workspaceId }: KeyManagerProps) {
  const { keys, fetchKeys, deleteKey } = useKeyStore();
  const [showImport, setShowImport] = useState(false);

  useEffect(() => {
    fetchKeys(workspaceId);
  }, [workspaceId]);

  async function handleDelete(key: SshKey) {
    if (!window.confirm(`Delete key "${key.name}"? This cannot be undone.`)) return;
    await deleteKey(key.id);
  }

  async function copyPublicKey(key: SshKey) {
    const pub = await window.keysApi.exportPublic(key.id);
    if (pub) await navigator.clipboard.writeText(pub);
  }

  return (
    <>
      <div className="flex flex-col w-80 border-l bg-background shrink-0">
        <div className="flex items-center px-3 h-9 border-b shrink-0">
          <Key className="h-4 w-4 mr-2 text-muted-foreground" />
          <span className="text-sm font-medium flex-1">SSH Keys</span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {keys.map((key) => (
            <div key={key.id} className="flex items-start gap-3 p-3 rounded border bg-muted/20">
              <Key className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{key.name}</span>
                  <Badge variant="outline" className="text-xs">{key.keyType}</Badge>
                </div>
                <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate">
                  {key.fingerprint}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => copyPublicKey(key)}
                  title="Copy public key"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => handleDelete(key)}
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}

          {keys.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No keys imported yet
            </p>
          )}
        </div>

        <div className="p-3 border-t shrink-0">
          <Button className="w-full" variant="outline" onClick={() => setShowImport(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Import Key
          </Button>
        </div>
      </div>

      <ImportKeyDialog
        open={showImport}
        onClose={() => setShowImport(false)}
        workspaceId={workspaceId}
      />
    </>
  );
}
