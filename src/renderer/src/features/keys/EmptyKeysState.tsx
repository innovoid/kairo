import { Key, Upload, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyKeysStateProps {
  onImportKey: () => void;
}

export function EmptyKeysState({ onImportKey }: EmptyKeysStateProps) {
  return (
    <div className="flex items-center justify-center min-h-[300px] p-4">
      <div className="flex flex-col items-center text-center gap-6 max-w-xs">

        {/* Animated illustration */}
        <div className="relative w-24 h-24">
          <span className="absolute inset-0 rounded-full bg-primary/10 animate-ping [animation-duration:3s]" />
          <div className="relative w-24 h-24 rounded-full bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center">
            <Key className="w-10 h-10 text-primary" strokeWidth={1.5} />
            {/* Shield badge */}
            <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[var(--surface-1)] border border-[var(--border)] flex items-center justify-center">
              <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-semibold tracking-tight">No SSH keys</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Import your private keys to authenticate with hosts without a password.
          </p>
        </div>

        <Button onClick={onImportKey} className="gap-2" size="sm">
          <Upload className="h-4 w-4" />
          Import Key
        </Button>

        <p className="text-xs text-muted-foreground/60">
          Supports RSA, Ed25519, ECDSA, and more
        </p>
      </div>
    </div>
  );
}
