import { Key, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface EmptyKeysStateProps {
  onImportKey: () => void;
}

export function EmptyKeysState({ onImportKey }: EmptyKeysStateProps) {
  return (
    <Card className="border-dashed border-2 bg-card/50 flex flex-col items-center justify-center py-16 px-6 text-center">
      {/* Key Icon in rounded background */}
      <div className="mb-4 p-3 rounded-full bg-muted">
        <Key className="h-8 w-8 text-muted-foreground" />
      </div>

      {/* Heading */}
      <h2 className="text-xl font-semibold mb-2">No SSH keys</h2>

      {/* Helpful Message */}
      <p className="text-sm text-muted-foreground mb-6 max-w-sm">
        Import your private keys to authenticate with hosts
      </p>

      {/* Import Key Button */}
      <Button onClick={onImportKey} className="gap-2">
        <Upload className="h-4 w-4" />
        Import Key
      </Button>
    </Card>
  );
}
