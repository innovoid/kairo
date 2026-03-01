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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Input } from '@/components/ui/input';
import { FolderOpen, File, RefreshCw, FolderPlus, Upload as UploadIcon, ChevronLeft, Download, Trash2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface FilePaneProps {
  sessionId: string;
  title: string;
  onPathChange?: (path: string) => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function getFilenameFromPath(filePath: string): string {
  const parts = filePath.split(/[\\/]/);
  return parts[parts.length - 1] || 'file';
}

type DialogState = {
  type: 'mkdir' | 'rename' | 'delete' | null;
  entry?: SftpEntry;
  value: string;
};

export function FilePane({ sessionId, title, onPathChange }: FilePaneProps) {
  const [currentPath, setCurrentPath] = useState('/');
  const [entries, setEntries] = useState<SftpEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [contextEntry, setContextEntry] = useState<SftpEntry | null>(null);
  const [dialogState, setDialogState] = useState<DialogState>({ type: null, value: '' });
  const { addTransfer } = useTransferStore();

  useEffect(() => {
    loadDirectory(currentPath);
  }, [sessionId, currentPath]);

  useEffect(() => {
    onPathChange?.(currentPath);
  }, [currentPath, onPathChange]);

  async function loadDirectory(path: string) {
    setLoading(true);
    setError(null);
    setContextEntry(null);
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

  function openMkdirDialog() {
    setDialogState({ type: 'mkdir', value: '' });
  }

  function openRenameDialog(entry: SftpEntry) {
    setDialogState({ type: 'rename', value: entry.name, entry });
  }

  function openDeleteDialog(entry: SftpEntry) {
    setDialogState({ type: 'delete', value: '', entry });
  }

  async function handleDialogConfirm() {
    if (dialogState.type === 'mkdir') {
      const name = dialogState.value.trim();
      if (!name) return;
      try {
        await window.sftpApi.mkdir(sessionId, `${currentPath}/${name}`.replace('//', '/'));
        await loadDirectory(currentPath);
        setDialogState({ type: null, value: '' });
      } catch (e) {
        toast.error((e as Error).message);
      }
    } else if (dialogState.type === 'rename') {
      const newName = dialogState.value.trim();
      if (!newName || !dialogState.entry) return;
      const parentPath = dialogState.entry.path.substring(0, dialogState.entry.path.lastIndexOf('/'));
      const newPath = parentPath ? `${parentPath}/${newName}` : `/${newName}`;
      try {
        await window.sftpApi.rename(sessionId, dialogState.entry.path, newPath);
        await loadDirectory(currentPath);
        setDialogState({ type: null, value: '' });
      } catch (e) {
        toast.error((e as Error).message);
      }
    } else if (dialogState.type === 'delete') {
      if (!dialogState.entry) return;
      try {
        await window.sftpApi.delete(sessionId, dialogState.entry.path, dialogState.entry.type === 'directory');
        await loadDirectory(currentPath);
        setDialogState({ type: null, value: '' });
      } catch (e) {
        toast.error((e as Error).message);
      }
    }
  }

  async function handleUpload() {
    const files = await window.sftpApi.pickUploadFiles();
    if (!files || files.length === 0) return;

    for (const localPath of files) {
      const filename = getFilenameFromPath(localPath);
      const remotePath = `${currentPath}/${filename}`.replace('//', '/');

      const transferId = crypto.randomUUID();
      addTransfer({
        transferId,
        filename,
        sessionId,
        localPath,
        remotePath,
        bytesTransferred: 0,
        totalBytes: 0,
        direction: 'upload',
        status: 'active',
        startedAt: new Date().toISOString(),
      });

      try {
        await window.sftpApi.upload(sessionId, localPath, remotePath, transferId);
        await loadDirectory(currentPath);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        if (message !== 'Transfer cancelled') {
          toast.error(`Upload failed: ${message}`);
        }
      }
    }
  }

  async function handleDownload(entry: SftpEntry) {
    if (entry.type === 'directory') return;

    const localPath = await window.sftpApi.getSaveFilePath(entry.name);
    if (!localPath) return;

    const transferId = crypto.randomUUID();
    addTransfer({
      transferId,
      filename: entry.name,
      sessionId,
      remotePath: entry.path,
      localPath,
      bytesTransferred: 0,
      totalBytes: entry.size,
      direction: 'download',
      status: 'active',
      startedAt: new Date().toISOString(),
    });

    try {
      await window.sftpApi.download(sessionId, entry.path, localPath, transferId);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (message !== 'Transfer cancelled') {
        toast.error(`Download failed: ${message}`);
      }
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
      const localPath = (file as File & { path?: string }).path;
      if (!localPath) continue;

      addTransfer({
        transferId,
        filename: file.name,
        sessionId,
        localPath,
        remotePath,
        bytesTransferred: 0,
        totalBytes: file.size,
        direction: 'upload',
        status: 'active',
        startedAt: new Date().toISOString(),
      });

      try {
        await window.sftpApi.upload(sessionId, localPath, remotePath, transferId);
        await loadDirectory(currentPath);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        if (message !== 'Transfer cancelled') {
          toast.error(`Upload failed: ${message}`);
        }
      }
    }
  }

  const pathParts = currentPath.split('/').filter(Boolean);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 h-8 border-b bg-muted/10 shrink-0">
        <span className="text-xs font-medium text-muted-foreground mr-2" data-testid={`${title.toLowerCase()}-file-pane-title`}>
          {title}
        </span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={goUp} disabled={currentPath === '/'} aria-label="Go up">
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
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => loadDirectory(currentPath)} title="Refresh" aria-label="Refresh">
          <RefreshCw className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={openMkdirDialog} title="New folder" aria-label="New folder">
          <FolderPlus className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={handleUpload}
          title="Upload files"
          aria-label="Upload files"
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
          <ContextMenu>
            <ContextMenuTrigger
              render={
                <div>
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
                          onContextMenu={() => setContextEntry(entry)}
                          onDoubleClick={() => {
                            if (entry.type === 'directory') {
                              navigate(entry);
                            } else {
                              void handleDownload(entry);
                            }
                          }}
                        >
                          <TableCell className="py-1">
                            {entry.type === 'directory' ? (
                              <FolderOpen className="h-3.5 w-3.5 text-primary" />
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
                          <TableCell colSpan={5} className="text-center py-12">
                            <div className="flex flex-col items-center gap-2">
                              <FolderOpen className="h-8 w-8 text-border" />
                              <p className="text-xs text-text-tertiary">This directory is empty</p>
                              <p className="text-[10px] text-text-disabled">Drop files here or click Upload to add files</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              }
            />
            <ContextMenuContent>
              {contextEntry?.type !== 'directory' && (
                <ContextMenuItem onClick={() => contextEntry && void handleDownload(contextEntry)}>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </ContextMenuItem>
              )}
              <ContextMenuItem
                disabled={!contextEntry}
                onClick={() => contextEntry && openRenameDialog(contextEntry)}
              >
                <Pencil className="h-4 w-4 mr-2" />
                Rename
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem
                disabled={!contextEntry}
                onClick={() => contextEntry && openDeleteDialog(contextEntry)}
                className="text-red-500 focus:text-red-500"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        )}
      </div>

      {/* Dialog for mkdir/rename/delete */}
      <Dialog open={dialogState.type !== null} onOpenChange={(open) => !open && setDialogState({ type: null, value: '' })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogState.type === 'mkdir' && 'New Folder'}
              {dialogState.type === 'rename' && 'Rename'}
              {dialogState.type === 'delete' && 'Delete'}
            </DialogTitle>
          </DialogHeader>
          {dialogState.type === 'delete' ? (
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete "{dialogState.entry?.name}"?
              {dialogState.entry?.type === 'directory' && ' This will delete the entire folder.'}
            </p>
          ) : (
            <Input
              value={dialogState.value}
              onChange={(e) => setDialogState({ ...dialogState, value: e.target.value })}
              placeholder={dialogState.type === 'mkdir' ? 'Folder name' : 'New name'}
              onKeyDown={(e) => e.key === 'Enter' && handleDialogConfirm()}
              autoFocus
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogState({ type: null, value: '' })}>
              Cancel
            </Button>
            <Button
              variant={dialogState.type === 'delete' ? 'destructive' : 'default'}
              onClick={handleDialogConfirm}
            >
              {dialogState.type === 'mkdir' && 'Create'}
              {dialogState.type === 'rename' && 'Rename'}
              {dialogState.type === 'delete' && 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
