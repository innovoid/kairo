import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, Terminal } from 'lucide-react';
import { toast } from 'sonner';

interface CommandSuggestionProps {
  command: string;
  onInsert?: (command: string) => void;
}

export function CommandSuggestion({ command, onInsert }: CommandSuggestionProps) {
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(command);
      toast.success('Command copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy command');
    }
  }

  function handleInsert() {
    if (onInsert) {
      onInsert(command);
    }
  }

  return (
    <Card className="mt-2 border-primary bg-card">
      <div className="p-3 space-y-2">
        <code className="block text-xs font-mono bg-background px-2 py-1 rounded break-all">
          {command}
        </code>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 h-7 text-xs"
            onClick={handleCopy}
          >
            <Copy className="h-3 w-3 mr-1" />
            Copy
          </Button>
          {onInsert && (
            <Button
              size="sm"
              className="flex-1 h-7 text-xs"
              onClick={handleInsert}
            >
              <Terminal className="h-3 w-3 mr-1" />
              Insert
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
