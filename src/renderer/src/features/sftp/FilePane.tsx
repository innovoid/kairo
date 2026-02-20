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
import { FolderOpen, File, RefreshCw, FolderPlus, Upload as UploadIcon, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FilePaneProps {
  sessionId: string;
  title: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function FilePane({ sessionId, title }: FilePaneProps) {
  const [currentPath, setCurrentPath] = useState('/');
  const [entries, setEntries] = useState<SftpEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { addTransfer, updateProgress } = useTransferStore();

  useEffect(() => {
    loadDirectory(currentPath);
  }, [sessionId, currentPath]);

  useEffect(() => {
    return window.sftpApi.onProgress(updateProgress);
  }, []);

  async function loadDirectory(path: string) {
    setLoading(true);
    setError(null);
    try {
      const list = await window.sftpApi.list(sessionId, path);
      setEntries(list);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function navigate(entry: SftpEntry) {
    if (entry.type === 'directory') {
      setCurrentPath(entry.path);
    }
  }

  function goUp() {
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    setCurrentPath('/' + parts.join('/') || '/');
  }

  async function handleMkdir() {
    const name = window.prompt('New folder name:');
    if (!name?.trim()) return;
    await window.sftpApi.mkdir(sessionId, `${currentPath}/${name}`.replace('//', '/'));
    await loadDirectory(currentPath);
  }

  async function handleDelete(entry: SftpEntry) {
    if (!window.confirm(`Delete "${entry.name}"?`)) return;
    await window.sftpApi.delete(sessionId, entry.path, entry.type === 'directory');
    await loadDirectory(currentPath);
  }

  async function handleUpload() {
    const files = await window.sftpApi.pickUploadFiles();
    if (!files || files.length === 0) return;

    for (const localPath of files) {
      const filename = localPath.split('/').pop()!;
      const remotePath = `${currentPath}/${filename}`.replace('//', '/');

      const transferId = crypto.randomUUID();
      addTransfer({
        transferId,
        filename,
        bytesTransferred: 0,
        totalBytes: 0,
        speed: 0,
        direction: 'upload',
      });

      try {
        await window.sftpApi.upload(sessionId, localPath, remotePath);
        await loadDirectory(currentPath);
      } catch (e) {
        console.error('Upload failed:', e);
      }
    }
  }

  async function handleDownload(entry: SftpEntry) {
    if (entry.type === 'directory') return;

    const transferId = crypto.randomUUID();
    addTransfer({
      transferId,
      filename: entry.name,
      bytesTransferred: 0,
      totalBytes: entry.size,
      speed: 0,
      direction: 'download',
    });

    try {
      await window.sftpApi.download(sessionId, entry.path);
    } catch (e) {
      console.error('Download failed:', e);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    for (const file of files) {
      const remotePath = `${currentPath}/${file.name}`.replace('//', '/');
      const transferId = crypto.randomUUID();

      addTransfer({
        transferId,
        filename: file.name,
        bytesTransferred: 0,
        totalBytes: file.size,
        speed: 0,
        direction: 'upload',
      });

      try {
        await window.sftpApi.upload(sessionId, file.path, remotePath);
        await loadDirectory(currentPath);
      } catch (e) {
        console.error('Upload failed:', e);
      }
    }
  }

  const pathParts = currentPath.split('/').filter(Boolean);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 h-8 border-b bg-muted/10 shrink-0">
        <span className="text-xs font-medium text-muted-foreground mr-2">{title}</span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={goUp} disabled={currentPath === '/'}>
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        {/* Breadcrumb */}
        <div className="flex items-center gap-0.5 flex-1 overflow-x-auto">
          <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setCurrentPath('/')}>/</button>
          {pathParts.map((part, i) => (
            <span key={i} className="flex items-center gap-0.5">
              <span className="text-muted-foreground text-xs">/</span>
              <button
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setCurrentPath('/' + pathParts.slice(0, i + 1).join('/'))}
              >
                {part}
              </button>
            </span>
          ))}
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => loadDirectory(currentPath)} title="Refresh">
          <RefreshCw className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleMkdir} title="New folder">
          <FolderPlus className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={handleUpload}
          title="Upload files"
        >
          <UploadIcon className="h-3 w-3" />
        </Button>
      </div>

      {/* File list */}
      <div
        className="flex-1 overflow-auto relative"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isDragging && (
          <div className="absolute inset-0 bg-primary/10 border-2 border-primary border-dashed flex items-center justify-center z-10">
            <div className="text-center">
              <UploadIcon className="h-8 w-8 mx-auto mb-2 text-primary" />
              <p className="text-sm font-medium">Drop files to upload</p>
            </div>
          </div>
        )}

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
                    entry.type === 'directory' && 'hover:bg-accent/40'
                  )}
                  onDoubleClick={() => {
                    if (entry.type === 'directory') {
                      navigate(entry);
                    } else {
                      handleDownload(entry);
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    handleDelete(entry);
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
