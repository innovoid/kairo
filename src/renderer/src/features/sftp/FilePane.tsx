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
import { FolderOpen, File, RefreshCw, FolderPlus, Upload, ChevronLeft } from 'lucide-react';
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
      </div>

      {/* File list */}
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
                    entry.type === 'directory' && 'hover:bg-accent/40'
                  )}
                  onDoubleClick={() => navigate(entry)}
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
