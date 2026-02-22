import { useEffect, useState } from 'react';
import type { SftpEntry } from '@shared/types/sftp';
import { useTransferStore } from '@/stores/transfer-store';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { FolderOpen, File, RefreshCw, Upload as UploadIcon, ChevronLeft, Home } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface LocalFilePaneProps {
  sessionId: string;
  remotePath: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function isWindowsRoot(path: string): boolean {
  return /^[A-Za-z]:\\$/.test(path);
}

function getParentPath(currentPath: string): string {
  if (currentPath === '/' || isWindowsRoot(currentPath)) return currentPath;

  const normalized = currentPath.replace(/[\\/]+$/, '');
  const separator = normalized.includes('\\') ? '\\' : '/';
  const lastSeparator = normalized.lastIndexOf(separator);

  if (lastSeparator <= 0) {
    if (/^[A-Za-z]:/.test(normalized)) return `${normalized.slice(0, 2)}\\`;
    return '/';
  }

  return normalized.slice(0, lastSeparator);
}

function joinPath(basePath: string, entryName: string): string {
  const separator = basePath.includes('\\') ? '\\' : '/';
  if (basePath.endsWith(separator)) return `${basePath}${entryName}`;
  return `${basePath}${separator}${entryName}`;
}

export function LocalFilePane({ sessionId, remotePath }: LocalFilePaneProps) {
  const [currentPath, setCurrentPath] = useState('');
  const [entries, setEntries] = useState<SftpEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const { addTransfer } = useTransferStore();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const localEntries = await window.sftpApi.listLocal(currentPath || undefined);
        if (!cancelled) setEntries(localEntries);
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [currentPath, refreshKey]);

  async function uploadLocalFile(localPath: string, filename: string, totalBytes: number) {
    const transferId = crypto.randomUUID();
    const remoteFilePath = joinPath(remotePath, filename).replace(/\\/g, '/');

    addTransfer({
      transferId,
      filename,
      sessionId,
      localPath,
      remotePath: remoteFilePath,
      bytesTransferred: 0,
      totalBytes,
      direction: 'upload',
      status: 'active',
      startedAt: new Date().toISOString(),
    });

    try {
      await window.sftpApi.upload(sessionId, localPath, remoteFilePath, transferId);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (message !== 'Transfer cancelled') {
        toast.error(`Upload failed: ${message}`);
      }
    }
  }

  async function handleUploadPicker() {
    const files = await window.sftpApi.pickUploadFiles();
    if (!files?.length) return;

    for (const localPath of files) {
      const parts = localPath.split(/[\\/]/);
      const filename = parts[parts.length - 1] ?? 'file';
      await uploadLocalFile(localPath, filename, 0);
    }
  }

  function goUp() {
    setCurrentPath((prev) => getParentPath(prev));
  }

  function goHome() {
    setCurrentPath('');
  }

  const pathParts = (currentPath || '/').split(/[\\/]/).filter(Boolean);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1 px-2 h-8 border-b bg-muted/10 shrink-0">
        <span className="text-xs font-medium text-muted-foreground mr-2" data-testid="local-file-pane-title">
          Local
        </span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={goUp}>
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={goHome}>
          <Home className="h-3.5 w-3.5" />
        </Button>
        <div className="flex items-center gap-0.5 flex-1 overflow-x-auto whitespace-nowrap text-xs text-muted-foreground">
          <span>/</span>
          {pathParts.map((part, index) => (
            <span key={`${part}-${index}`} className="flex items-center gap-0.5">
              <button
                type="button"
                className="hover:text-foreground"
                onClick={() => {
                  const separator = (currentPath || '/').includes('\\') ? '\\' : '/';
                  const nextPath = `${(currentPath || '/').startsWith('/') ? '/' : ''}${pathParts
                    .slice(0, index + 1)
                    .join(separator)}`;
                  setCurrentPath(nextPath || '/');
                }}
              >
                {part}
              </button>
              <span>/</span>
            </span>
          ))}
        </div>
        <span className="text-[10px] text-muted-foreground/80 mr-2">
          → {remotePath}
        </span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setRefreshKey((k) => k + 1)}>
          <RefreshCw className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => void handleUploadPicker()}
          title="Select files to upload"
        >
          <UploadIcon className="h-3 w-3" />
        </Button>
      </div>

      <div className="flex-1 overflow-auto">
        {error ? (
          <div className="p-4 text-sm text-destructive">{error}</div>
        ) : loading ? (
          <div className="p-4 text-sm text-muted-foreground">Loading...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Name</TableHead>
                <TableHead className="w-24 text-right">Size</TableHead>
                <TableHead className="w-32">Modified</TableHead>
                <TableHead className="w-16">Perms</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow
                  key={entry.path}
                  className={cn(
                    'cursor-pointer text-xs',
                    entry.type === 'directory' ? 'hover:bg-accent/40' : 'hover:bg-accent/20'
                  )}
                  onDoubleClick={() => {
                    if (entry.type === 'directory') {
                      setCurrentPath(entry.path);
                    } else {
                      void uploadLocalFile(entry.path, entry.name, entry.size);
                    }
                  }}
                >
                  <TableCell className="py-1">
                    {entry.type === 'directory' ? (
                      <FolderOpen className="h-3.5 w-3.5 text-blue-400" />
                    ) : (
                      <File className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </TableCell>
                  <TableCell className="py-1 font-mono">{entry.name}</TableCell>
                  <TableCell className="py-1 text-right text-muted-foreground">
                    {entry.type !== 'directory' ? formatSize(entry.size) : '—'}
                  </TableCell>
                  <TableCell className="py-1 text-muted-foreground">
                    {new Date(entry.modifiedAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="py-1 font-mono text-muted-foreground">{entry.permissions}</TableCell>
                </TableRow>
              ))}
              {entries.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground text-xs py-8">
                    Empty directory
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
