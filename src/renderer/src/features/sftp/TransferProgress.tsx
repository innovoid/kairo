import { useMemo } from 'react';
import { useTransferStore } from '@/stores/transfer-store';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Upload, Download, X, CheckCircle2, AlertCircle, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TransferProgressProps {
  variant?: 'pane' | 'floating';
}

function formatSpeed(bytesPerSecond: number): string {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) return '—';
  if (bytesPerSecond < 1024) return `${bytesPerSecond.toFixed(0)} B/s`;
  if (bytesPerSecond < 1024 * 1024) return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
  return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes.toFixed(0)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function TransferProgress({ variant = 'pane' }: TransferProgressProps) {
  const transfers = useTransferStore((s) => s.transfers);
  const removeTransfer = useTransferStore((s) => s.removeTransfer);
  const cancelTransfer = useTransferStore((s) => s.cancelTransfer);
  const retryTransfer = useTransferStore((s) => s.retryTransfer);

  const allTransfers = useMemo(
    () =>
      Array.from(transfers.values()).sort((a, b) => {
        const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return bTime - aTime;
      }),
    [transfers]
  );

  if (allTransfers.length === 0) return null;

  const activeCount = allTransfers.filter((t) => t.status === 'active').length;
  const wrapperClass =
    variant === 'floating'
      ? 'fixed right-4 bottom-4 z-50 w-[420px] max-h-[50vh] rounded-xl border bg-[var(--surface-2)]/95 backdrop-blur-md shadow-2xl'
      : 'border-t bg-muted/20';

  return (
    <div className={wrapperClass}>
      <div className="px-3 py-2 flex items-center justify-between border-b">
        <span className="text-xs font-medium">
          Transfers ({activeCount} active, {allTransfers.length} total)
        </span>
      </div>
      <div className={cn('overflow-y-auto', variant === 'floating' ? 'max-h-[42vh]' : 'max-h-36')}>
        {allTransfers.map((transfer) => {
          const progress =
            transfer.totalBytes > 0
              ? Math.min(100, (transfer.bytesTransferred / transfer.totalBytes) * 100)
              : 0;

          return (
            <div key={transfer.transferId} className="flex items-center gap-2 px-3 py-2 border-b last:border-0">
              {transfer.status === 'done' ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
              ) : transfer.status === 'cancelled' ? (
                <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              ) : transfer.status === 'error' ? (
                <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
              ) : transfer.direction === 'upload' ? (
                <Upload className="h-3.5 w-3.5 text-blue-500 shrink-0" />
              ) : (
                <Download className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-mono truncate">{transfer.filename}</p>
                  <span
                    className={cn(
                      'text-[10px] uppercase tracking-wide',
                      transfer.status === 'done' && 'text-green-500',
                      transfer.status === 'cancelled' && 'text-amber-500',
                      transfer.status === 'error' && 'text-red-500',
                      transfer.status === 'active' && 'text-muted-foreground'
                    )}
                  >
                    {transfer.status}
                  </span>
                </div>
                <Progress value={progress} className="h-1.5 mt-1" />
                <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>
                    {formatBytes(transfer.bytesTransferred)} / {formatBytes(transfer.totalBytes)}
                  </span>
                  <span>{formatSpeed(transfer.speedBytesPerSec ?? 0)}</span>
                </div>
                {transfer.error && (
                  <p className="mt-1 text-[10px] text-red-500 truncate">{transfer.error}</p>
                )}
              </div>

              <div className="flex items-center gap-1">
                {(transfer.status === 'error' || transfer.status === 'cancelled') && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 shrink-0"
                    onClick={() => void retryTransfer(transfer.transferId)}
                    aria-label="Retry transfer"
                  >
                    <RotateCcw className="h-3 w-3" />
                  </Button>
                )}

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 shrink-0"
                  onClick={() => {
                    if (transfer.status === 'active') {
                      void cancelTransfer(transfer.transferId);
                      return;
                    }
                    removeTransfer(transfer.transferId);
                  }}
                  aria-label={transfer.status === 'active' ? 'Cancel transfer' : 'Dismiss transfer'}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
