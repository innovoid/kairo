import { useTransferStore } from '@/stores/transfer-store';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { X, Upload, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

function formatSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond < 1024) return `${bytesPerSecond.toFixed(0)} B/s`;
  if (bytesPerSecond < 1024 * 1024) return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
  return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
}

export function TransferProgress() {
  const transfers = useTransferStore((s) => s.transfers);
  const removeTransfer = useTransferStore((s) => s.removeTransfer);

  const activeTransfers = Array.from(transfers.values());

  if (activeTransfers.length === 0) return null;

  return (
    <div className="border-t bg-muted/20">
      <div className="px-3 py-2 flex items-center justify-between border-b">
        <span className="text-xs font-medium">
          Transfers ({activeTransfers.length} active)
        </span>
      </div>
      <div className="max-h-32 overflow-y-auto">
        {activeTransfers.map((transfer) => {
          const progress = transfer.totalBytes > 0
            ? (transfer.bytesTransferred / transfer.totalBytes) * 100
            : 0;

          // Calculate approximate speed (placeholder - would need time tracking for accuracy)
          const speed = 0; // Speed tracking would be implemented in the transfer logic

          return (
            <div key={transfer.transferId} className="flex items-center gap-2 px-3 py-2 border-b last:border-0">
              {transfer.direction === 'upload' ? (
                <Upload className="h-3.5 w-3.5 text-blue-500 shrink-0" />
              ) : (
                <Download className="h-3.5 w-3.5 text-green-500 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-mono truncate">{transfer.filename}</p>
                <Progress value={progress} className="h-1.5 mt-1" />
              </div>
              <span className="text-xs text-muted-foreground shrink-0">
                {progress.toFixed(0)}%
              </span>
              <span className="text-xs text-muted-foreground shrink-0 w-20 text-right">
                {formatSpeed(speed)}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 shrink-0"
                onClick={() => removeTransfer(transfer.transferId)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
