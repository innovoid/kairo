import { useRef, useState } from 'react';
import { useKeyStore } from '@/stores/key-store';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { FolderOpen } from 'lucide-react';

interface ImportKeyDialogProps {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
}

export function ImportKeyDialog({ open, onClose, workspaceId }: ImportKeyDialogProps) {
  const { importKey } = useKeyStore();
  const [name, setName] = useState('');
  const [pem, setPem] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handlePickFile() {
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      setPem(content);
      // Auto-fill name from filename if not already set
      if (!name) {
        setName(file.name.replace(/\.(pem|key|ppk)$/i, ''));
      }
    };
    reader.readAsText(file);
    // Reset so the same file can be picked again if needed
    e.target.value = '';
  }

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
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import SSH Key</DialogTitle>
          <DialogDescription>Paste your PEM or OpenSSH private key below</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="keyname">Key Name</Label>
            <Input
              id="keyname"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My key"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pem">Private Key (PEM or OpenSSH format)</Label>
            <Textarea
              id="pem"
              value={pem}
              onChange={(e) => setPem(e.target.value)}
              placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;..."
              className="font-mono text-xs min-h-32"
              required
            />
            <input
              ref={fileInputRef}
              type="file"
              accept=".pem,.key,.ppk,id_rsa,id_ed25519,id_ecdsa"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handlePickFile}
            >
              <FolderOpen className="h-4 w-4 mr-2" />
              Pick key file
            </Button>
          </div>
          <div className="space-y-2">
            <Label htmlFor="passphrase">Passphrase (optional)</Label>
            <Input
              id="passphrase"
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="Leave blank if not encrypted"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? 'Importing...' : 'Import Key'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
