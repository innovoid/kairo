import * as React from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Search, Plus, FolderOpen, Folder, ChevronRight, Server, Circle, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Overlay,
  OverlayHeader,
  OverlayContent,
  OverlayFooter,
} from '@/components/ui/overlay';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useHostStore } from '@/stores/host-store';
import type { Host, HostFolder } from '@shared/types/hosts';
import { FolderDialog } from './FolderDialog';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';

const ROOT_DROP_ID = 'folder:root';

interface HostBrowserOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  onConnect: (hostId: string) => void;
  onNewHost?: () => void;
  className?: string;
}

function hostDragId(hostId: string) {
  return `host:${hostId}`;
}

function folderDropId(folderId: string | null) {
  return folderId ? `folder:${folderId}` : ROOT_DROP_ID;
}

function parseHostId(id: string) {
  return id.startsWith('host:') ? id.slice(5) : null;
}

function parseFolderId(id: string): string | null | undefined {
  if (id === ROOT_DROP_ID) return null;
  if (id.startsWith('folder:')) return id.slice(7);
  return undefined;
}

export function HostBrowserOverlay({
  open,
  onOpenChange,
  workspaceId,
  onConnect,
  onNewHost,
  className,
}: HostBrowserOverlayProps) {
  const { hosts, folders, fetchHosts, createFolder, updateFolder, deleteFolder, moveToFolder } = useHostStore();
  const [search, setSearch] = React.useState('');
  const [expandedFolders, setExpandedFolders] = React.useState<Set<string>>(new Set());
  const [dragHostId, setDragHostId] = React.useState<string | null>(null);
  const [folderDialogOpen, setFolderDialogOpen] = React.useState(false);
  const [editingFolder, setEditingFolder] = React.useState<HostFolder | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  React.useEffect(() => {
    if (!open || !workspaceId) return;
    void fetchHosts(workspaceId);
  }, [open, workspaceId, fetchHosts]);

  React.useEffect(() => {
    if (!open) {
      setSearch('');
      setDragHostId(null);
      setFolderDialogOpen(false);
      setEditingFolder(null);
    }
  }, [open]);

  React.useEffect(() => {
    if (!folders.length) return;
    setExpandedFolders((prev) => {
      if (prev.size > 0) return prev;
      return new Set(folders.map((f) => f.id));
    });
  }, [folders]);

  const filteredHosts = React.useMemo(() => {
    if (!search) return hosts;
    const q = search.toLowerCase();
    return hosts.filter((host) =>
      [host.label, host.hostname, host.username, ...(host.tags ?? [])].some((value) =>
        value.toLowerCase().includes(q)
      )
    );
  }, [hosts, search]);

  const hostById = React.useMemo(
    () =>
      new Map(hosts.map((host) => [host.id, host])),
    [hosts]
  );

  const foldersByParent = React.useMemo(() => {
    const map = new Map<string | null, HostFolder[]>();
    for (const folder of folders) {
      const parentId = folder.parentId ?? null;
      const current = map.get(parentId) ?? [];
      current.push(folder);
      map.set(parentId, current);
    }
    for (const [parentId, items] of map.entries()) {
      map.set(
        parentId,
        items.sort((a, b) => a.position - b.position || a.name.localeCompare(b.name))
      );
    }
    return map;
  }, [folders]);

  const hostsByFolder = React.useMemo(() => {
    const map = new Map<string | null, Host[]>();
    for (const host of filteredHosts) {
      const folderId = host.folderId ?? null;
      const current = map.get(folderId) ?? [];
      current.push(host);
      map.set(folderId, current);
    }
    return map;
  }, [filteredHosts]);

  const dragHost = dragHostId ? hostById.get(dragHostId) ?? null : null;

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  const openCreateFolderDialog = () => {
    setEditingFolder(null);
    setFolderDialogOpen(true);
  };

  const openRenameFolderDialog = (folder: HostFolder) => {
    setEditingFolder(folder);
    setFolderDialogOpen(true);
  };

  const handleDeleteFolder = async (folder: HostFolder) => {
    if (!window.confirm(`Delete folder "${folder.name}"? Hosts in this folder will move to root.`)) return;
    await deleteFolder(folder.id);
  };

  const handleSaveFolder = async (name: string, folderId?: string) => {
    if (folderId) {
      await updateFolder(folderId, name);
    } else {
      await createFolder({ workspaceId, name });
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const id = parseHostId(String(event.active.id));
    setDragHostId(id);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setDragHostId(null);
    if (!event.over) return;

    const hostId = parseHostId(String(event.active.id));
    const folderId = parseFolderId(String(event.over.id));
    if (!hostId || folderId === undefined) return;

    const host = hostById.get(hostId);
    if (!host || host.folderId === folderId) return;

    await moveToFolder(hostId, folderId);
  };

  const renderFolderTree = (parentId: string | null, depth = 0): React.ReactNode => {
    const nodes = foldersByParent.get(parentId) ?? [];
    if (!nodes.length) return null;

    return nodes.map((folder) => {
      const isExpanded = expandedFolders.has(folder.id);
      const nestedFolders = foldersByParent.get(folder.id) ?? [];
      const folderHosts = hostsByFolder.get(folder.id) ?? [];
      const totalItems = nestedFolders.length + folderHosts.length;

      return (
        <div key={folder.id} className="space-y-1">
          <FolderRow
            folder={folder}
            depth={depth}
            isExpanded={isExpanded}
            totalItems={totalItems}
            onToggle={() => toggleFolder(folder.id)}
            onRename={() => openRenameFolderDialog(folder)}
            onDelete={() => {
              void handleDeleteFolder(folder);
            }}
          />

          {isExpanded && (
            <div className="space-y-1">
              {folderHosts.map((host) => (
                <HostRow
                  key={host.id}
                  host={host}
                  depth={depth + 1}
                  onConnect={() => {
                    onConnect(host.id);
                    onOpenChange(false);
                  }}
                />
              ))}
              {renderFolderTree(folder.id, depth + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  const rootHosts = hostsByFolder.get(null) ?? [];

  return (
    <Overlay open={open} onOpenChange={onOpenChange} className={className}>
      <OverlayHeader
        title="Browse Hosts"
        description={`${hosts.length} host${hosts.length === 1 ? '' : 's'} configured`}
        onClose={() => onOpenChange(false)}
      />

      <OverlayContent className="pt-2">
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search hosts by name, address, username, or tags..."
              className={cn(
                'pl-10 h-11 !bg-[var(--surface-1)] border-[var(--border)]',
                'font-mono text-sm tracking-tight text-foreground',
                'placeholder:text-text-tertiary',
                'focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary'
              )}
            />
          </div>
        </div>

        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={(event) => void handleDragEnd(event)}>
          {search ? (
            filteredHosts.length === 0 ? (
              <EmptyState search={search} />
            ) : (
              <div className="space-y-1">
                {filteredHosts.map((host) => (
                  <HostRow
                    key={host.id}
                    host={host}
                    depth={0}
                    onConnect={() => {
                      onConnect(host.id);
                      onOpenChange(false);
                    }}
                  />
                ))}
              </div>
            )
          ) : (
            <div className="space-y-2">
              <RootDropZone hostCount={rootHosts.length}>
                {rootHosts.map((host) => (
                  <HostRow
                    key={host.id}
                    host={host}
                    depth={0}
                    onConnect={() => {
                      onConnect(host.id);
                      onOpenChange(false);
                    }}
                  />
                ))}
              </RootDropZone>
              {renderFolderTree(null)}
            </div>
          )}

          <DragOverlay>
            {dragHost ? (
              <div className="px-3 py-2 rounded-lg border bg-[var(--surface-2)] shadow-lg text-sm font-mono">
                {dragHost.label}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </OverlayContent>

      <OverlayFooter>
        <Button variant="outline" onClick={openCreateFolderDialog} className="gap-2">
          <Folder className="h-4 w-4" />
          New Folder
        </Button>
        {onNewHost && (
          <Button
            onClick={() => {
              onNewHost();
              onOpenChange(false);
            }}
            className={cn(
              'gap-2',
              'hover:scale-105 active:scale-95 transition-transform',
              'shadow-[0_0_20px_rgba(59,130,246,0.3)]'
            )}
          >
            <Plus className="h-4 w-4" />
            New Host
          </Button>
        )}
      </OverlayFooter>

      <FolderDialog
        open={folderDialogOpen}
        folder={editingFolder}
        workspaceId={workspaceId}
        onClose={() => {
          setFolderDialogOpen(false);
          setEditingFolder(null);
        }}
        onSave={handleSaveFolder}
      />
    </Overlay>
  );
}

interface RootDropZoneProps {
  hostCount: number;
  children: React.ReactNode;
}

function RootDropZone({ hostCount, children }: RootDropZoneProps) {
  const { setNodeRef, isOver } = useDroppable({ id: ROOT_DROP_ID });

  return (
    <div ref={setNodeRef} className={cn('rounded-lg border p-2', isOver ? 'border-primary bg-primary/10' : 'border-[var(--border)]')}>
      <div className="flex items-center gap-2 px-1 pb-1 text-xs font-medium text-muted-foreground">
        <FolderOpen className="h-3.5 w-3.5" />
        <span>Unorganized ({hostCount})</span>
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

interface FolderRowProps {
  folder: HostFolder;
  depth: number;
  isExpanded: boolean;
  totalItems: number;
  onToggle: () => void;
  onRename: () => void;
  onDelete: () => void;
}

function FolderRow({ folder, depth, isExpanded, totalItems, onToggle, onRename, onDelete }: FolderRowProps) {
  const { setNodeRef, isOver } = useDroppable({ id: folderDropId(folder.id) });

  return (
    <ContextMenu>
      <div ref={setNodeRef} style={{ marginLeft: depth * 14 }}>
        <ContextMenuTrigger
          render={(props) => (
            <button
              {...props}
              type="button"
              onClick={(event) => {
                props.onClick?.(event);
                onToggle();
              }}
              className={cn(
                'w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors',
                isOver ? 'bg-primary/10 border border-primary/50' : 'hover:bg-[var(--surface-2)]'
              )}
            >
              <ChevronRight className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', isExpanded && 'rotate-90')} />
              {isExpanded ? (
                <FolderOpen className="h-4 w-4 text-primary" />
              ) : (
                <Folder className="h-4 w-4 text-primary" />
              )}
              <span className="text-sm font-mono">{folder.name}</span>
              <span className="ml-auto text-[11px] text-muted-foreground">{totalItems}</span>
            </button>
          )}
        />
      </div>
      <ContextMenuContent>
        <ContextMenuItem onClick={onRename}>
          <Pencil className="h-4 w-4 mr-2" />
          Rename
        </ContextMenuItem>
        <ContextMenuItem
          onClick={onDelete}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete folder
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

interface HostRowProps {
  host: Host;
  depth: number;
  onConnect: () => void;
}

function HostRow({ host, depth, onConnect }: HostRowProps) {
  const { setNodeRef, listeners, attributes, transform, isDragging } = useDraggable({
    id: hostDragId(host.id),
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.45 : 1,
    marginLeft: depth * 14,
  };

  return (
    <button
      ref={setNodeRef}
      style={style}
      className={cn(
        'w-full flex items-center gap-3 rounded-md px-2 py-2 text-left',
        'hover:bg-[var(--surface-2)] transition-colors',
        isDragging && 'cursor-grabbing'
      )}
      onClick={onConnect}
      {...listeners}
      {...attributes}
      type="button"
    >
      <Server className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-mono truncate">{host.label}</p>
        <p className="text-xs text-muted-foreground truncate">
          {host.username}@{host.hostname}
        </p>
      </div>
      <Circle className="h-2.5 w-2.5 text-muted-foreground/40" fill="currentColor" />
    </button>
  );
}

interface EmptyStateProps {
  search: string;
}

function EmptyState({ search }: EmptyStateProps) {
  return (
    <div className="py-16 text-center text-muted-foreground">
      <p className="text-sm font-medium">No hosts found</p>
      <p className="text-xs mt-1">No hosts match "{search}"</p>
    </div>
  );
}
