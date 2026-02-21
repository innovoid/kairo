import { useEffect, useState, useRef } from 'react';
import type { Host, HostFolder } from '@shared/types/hosts';
import { useHostStore } from '@/stores/host-store';
import { useSessionStore } from '@/stores/session-store';
import { Button } from '@/components/ui/button';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Plus, FolderOpen, Terminal, Pencil, Trash2, Server, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Workspace } from '@shared/types/workspace';
import { FolderDialog } from './FolderDialog';
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core';
import { Skeleton } from '@/components/ui/skeleton';

interface HostsGridProps {
  workspaceId: string;
  onAddHost: () => void;
  onEditHost: (host: Host) => void;
  onWorkspaceChange: (ws: Workspace) => void;
}

export function HostsGrid({ workspaceId, onAddHost, onEditHost, onWorkspaceChange }: HostsGridProps) {
  const { hosts, folders, isLoading, fetchHosts, deleteHost, createFolder, updateFolder, deleteFolder, moveToFolder } = useHostStore();
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<HostFolder | null>(null);

  useEffect(() => {
    fetchHosts(workspaceId);
  }, [workspaceId]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement before drag starts
      },
    })
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over) return;

    const hostId = active.id as string;
    const folderId = over.id === 'root' ? null : (over.id as string);

    await moveToFolder(hostId, folderId);
  }

  async function handleDeleteHost(host: Host) {
    if (!window.confirm(`Delete "${host.label}"?`)) return;
    await deleteHost(host.id);
  }

  function handleCreateFolder() {
    setEditingFolder(null);
    setFolderDialogOpen(true);
  }

  async function handleSaveFolder(name: string, folderId?: string) {
    if (folderId) {
      await updateFolder(folderId, name);
    } else {
      await createFolder({ workspaceId, name });
    }
    setFolderDialogOpen(false);
  }

  function handleEditFolder(folder: HostFolder) {
    setEditingFolder(folder);
    setFolderDialogOpen(true);
  }

  async function handleDeleteFolder(folder: HostFolder) {
    if (!window.confirm(`Delete folder "${folder.name}"? Hosts inside will move to root.`)) return;
    await deleteFolder(folder.id);
  }

  const rootFolders = folders.filter((f) => !f.parentId);
  const rootHosts = hosts.filter((h) => !h.folderId);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="py-10 px-14">
        {/* Header */}
        <div className="mb-8">
          <div className="mb-3">
            <h1 className="text-5xl font-semibold mb-3" style={{ fontFamily: 'Cormorant Garamond, serif' }}>Hosts</h1>
            <p className="text-sm text-muted-foreground">Manage your SSH connections</p>
          </div>
        </div>

        {/* Search and Add */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2 h-9 px-3 border border-border rounded w-[200px]">
            <svg className="h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search hosts..."
              className="flex-1 bg-transparent text-sm outline-none text-muted-foreground placeholder:text-muted-foreground/50"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger className={cn(
              "h-9 px-5 text-sm font-medium",
              "inline-flex items-center justify-center gap-2",
              "bg-[#C9A962] text-[#0A0A0A]",
              "hover:bg-[#B89851] transition-all",
              "outline-none select-none"
            )}>
              <Plus className="h-4 w-4" />
              Add Host
              <ChevronDown className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onAddHost}>
                <Plus className="h-4 w-4 mr-2" />
                Add Host
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleCreateFolder}>
                <FolderOpen className="h-4 w-4 mr-2" />
                New Folder
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(360px,1fr))] gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-4 p-6 border border-border bg-card">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <Skeleton className="h-6 w-6 rounded-md" />
                    <div className="flex-1">
                      <Skeleton className="h-6 w-32 mb-2" />
                      <Skeleton className="h-4 w-48" />
                    </div>
                  </div>
                </div>
                <Skeleton className="h-4 w-24" />
                <div className="flex items-center justify-between">
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-5 w-24" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Content (only show when not loading) */}
        {!isLoading && (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          {/* Folder sections */}
          {rootFolders.map((folder) => (
            <DroppableFolderSection
              key={folder.id}
              folder={folder}
              hosts={hosts}
              allFolders={folders}
              onEditHost={onEditHost}
              onDeleteHost={handleDeleteHost}
              onEditFolder={handleEditFolder}
              onDeleteFolder={handleDeleteFolder}
            />
          ))}

          {/* Root hosts (no folder) */}
          {rootHosts.length > 0 && (
            <DroppableRootArea>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(360px,1fr))] gap-3">
                {rootHosts.map((host) => (
                  <DraggableHostCard
                    key={host.id}
                    host={host}
                    folders={folders}
                    onEdit={onEditHost}
                    onDelete={handleDeleteHost}
                  />
                ))}
              </div>
            </DroppableRootArea>
          )}
        </DndContext>
        )}

        {/* Empty state */}
        {!isLoading && hosts.length === 0 && folders.length === 0 && (
          <div className="text-center py-20">
            <Server className="h-12 w-12 mx-auto text-muted-foreground/20 mb-3" />
            <p className="text-sm font-medium">No hosts yet</p>
            <p className="text-xs text-muted-foreground mt-1 mb-4">
              Add a host to get started
            </p>
            <Button variant="outline" size="sm" onClick={onAddHost}>
              <Plus className="h-4 w-4 mr-1.5" />
              Add your first host
            </Button>
          </div>
        )}

        <FolderDialog
          open={folderDialogOpen}
          folder={editingFolder}
          workspaceId={workspaceId}
          onClose={() => setFolderDialogOpen(false)}
          onSave={handleSaveFolder}
        />
      </div>
    </div>
  );
}

// ─── Draggable Host Card ─────────────────────────────────────────────────────

function DraggableHostCard({
  host,
  folders,
  onEdit,
  onDelete,
}: {
  host: Host;
  folders: HostFolder[];
  onEdit: (host: Host) => void;
  onDelete: (host: Host) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: host.id,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.5 : 1,
      }
    : undefined;

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <HostGridCard host={host} folders={folders} onEdit={onEdit} onDelete={onDelete} />
    </div>
  );
}

// ─── Droppable Root Area ─────────────────────────────────────────────────────

function DroppableRootArea({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'root',
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'rounded-lg transition-colors',
        isOver && 'bg-primary/10 ring-2 ring-primary'
      )}
    >
      {children}
    </div>
  );
}

// ─── Droppable Folder Section ────────────────────────────────────────────────

function DroppableFolderSection(props: Parameters<typeof FolderSection>[0]) {
  const { setNodeRef, isOver } = useDroppable({
    id: props.folder.id,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'rounded-lg transition-colors',
        isOver && 'bg-primary/10 ring-2 ring-primary'
      )}
    >
      <FolderSection {...props} />
    </div>
  );
}

// ─── Folder Section ──────────────────────────────────────────────────────────

function FolderSection({
  folder,
  hosts,
  allFolders,
  onEditHost,
  onDeleteHost,
  onEditFolder,
  onDeleteFolder,
}: {
  folder: HostFolder;
  hosts: Host[];
  allFolders: HostFolder[];
  onEditHost: (host: Host) => void;
  onDeleteHost: (host: Host) => void;
  onEditFolder: (folder: HostFolder) => void;
  onDeleteFolder: (folder: HostFolder) => void;
}) {
  const folderHosts = hosts.filter((h) => h.folderId === folder.id);
  const childFolders = allFolders.filter((f) => f.parentId === folder.id);

  return (
    <div className="mb-6">
      <ContextMenu>
        <ContextMenuTrigger>
          <div className="flex items-center gap-2 mb-3 cursor-pointer">
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">{folder.name}</span>
            <span className="text-xs text-muted-foreground/60">({folderHosts.length})</span>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={() => onEditFolder(folder)}>
            <Pencil className="h-4 w-4 mr-2" />
            Rename
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => onDeleteFolder(folder)} className="text-destructive focus:text-destructive">
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      {folderHosts.length === 0 ? (
        <div className="text-xs text-muted-foreground/50 italic ml-6 mb-3">
          Empty folder - drag hosts here
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(360px,1fr))] gap-3 mb-3">
          {folderHosts.map((host) => (
            <DraggableHostCard
              key={host.id}
              host={host}
              folders={allFolders}
              onEdit={onEditHost}
              onDelete={onDeleteHost}
            />
          ))}
        </div>
      )}
      {childFolders.map((sub) => (
        <div key={sub.id} className="ml-4">
          <FolderSection
            folder={sub}
            hosts={hosts}
            allFolders={allFolders}
            onEditHost={onEditHost}
            onDeleteHost={onDeleteHost}
            onEditFolder={onEditFolder}
            onDeleteFolder={onDeleteFolder}
          />
        </div>
      ))}
    </div>
  );
}

// ─── Host Grid Card ──────────────────────────────────────────────────────────

function HostGridCard({
  host,
  folders,
  onEdit,
  onDelete,
}: {
  host: Host;
  folders: HostFolder[];
  onEdit: (host: Host) => void;
  onDelete: (host: Host) => void;
}) {
  const { tabs, openTab, setActiveTab } = useSessionStore();
  const { moveToFolder } = useHostStore();
  const clickTimeout = useRef<NodeJS.Timeout | null>(null);

  const existingTerminalTab = [...tabs.values()].find(
    (t) => t.hostId === host.id && t.tabType === 'terminal',
  );
  const isConnected = existingTerminalTab?.status === 'connected';

  useEffect(() => {
    return () => {
      if (clickTimeout.current) {
        clearTimeout(clickTimeout.current);
      }
    };
  }, []);

  function handleSingleClick() {
    if (clickTimeout.current) {
      clearTimeout(clickTimeout.current);
    }
    clickTimeout.current = setTimeout(() => {
      onEdit(host);
    }, 250); // Delay to detect double-click
  }

  function handleDoubleClick(e: React.MouseEvent) {
    e.preventDefault();
    if (clickTimeout.current) {
      clearTimeout(clickTimeout.current);
      clickTimeout.current = null;
    }
    connect();
  }

  function connect() {
    if (existingTerminalTab) {
      setActiveTab(existingTerminalTab.tabId);
      return;
    }

    const sessionId = crypto.randomUUID();
    openTab({
      tabId: sessionId,
      tabType: 'terminal',
      label: host.label,
      hostId: host.id,
      hostname: host.hostname,
      sessionId,
      status: 'connecting',
    });

    window.sshApi.connect(sessionId, {
      host: host.hostname,
      port: host.port,
      username: host.username,
      authType: host.authType,
      privateKeyId: host.keyId ?? undefined,
      hostId: host.id,
    });
  }

  function openSftp() {
    const terminalSessionId = existingTerminalTab?.sessionId ?? crypto.randomUUID();

    if (!existingTerminalTab) {
      openTab({
        tabId: terminalSessionId,
        tabType: 'terminal',
        label: host.label,
        hostId: host.id,
        hostname: host.hostname,
        sessionId: terminalSessionId,
        status: 'connecting',
      });

      window.sshApi.connect(terminalSessionId, {
        host: host.hostname,
        port: host.port,
        username: host.username,
        authType: host.authType,
        privateKeyId: host.keyId ?? undefined,
        hostId: host.id,
      });
    }

    const sftpTabId = `sftp-${terminalSessionId}`;
    openTab({
      tabId: sftpTabId,
      tabType: 'sftp',
      label: `SFTP: ${host.label}`,
      hostId: host.id,
      hostname: host.hostname,
      sessionId: terminalSessionId,
      status: 'connected',
    });
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div
          className="flex flex-col gap-4 p-6 border border-border bg-card hover:border-[#C9A962]/50 cursor-pointer transition-all"
          onClick={handleSingleClick}
          onDoubleClick={handleDoubleClick}
        >
          {/* Icon and Title */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Server className={cn(
                'h-6 w-6',
                isConnected ? 'text-[#C9A962]' : 'text-muted-foreground'
              )} />
              <div>
                <h3 className="text-xl font-medium mb-1" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
                  {host.label}
                </h3>
                <p className="text-xs font-mono text-muted-foreground">
                  {host.username}@{host.hostname}:{host.port}
                </p>
              </div>
            </div>
          </div>

          {/* Auth Type */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>SSH • {host.authType === 'key' ? 'Private Key' : 'Password'}</span>
          </div>

          {/* Tags/Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isConnected && (
                <span className="px-2 py-1 text-xs bg-[#C9A962]/20 text-[#C9A962] border border-[#C9A962]/30">
                  Connected
                </span>
              )}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                connect();
              }}
              className="text-sm text-[#C9A962] hover:text-[#B89851] transition-colors"
            >
              Connect →
            </button>
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={connect}>
          <Terminal className="h-4 w-4 mr-2" />
          Connect (Terminal)
        </ContextMenuItem>
        <ContextMenuItem onClick={openSftp}>
          <FolderOpen className="h-4 w-4 mr-2" />
          Open SFTP
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <FolderOpen className="h-4 w-4 mr-2" />
            Move to Folder
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuItem
              onClick={() => moveToFolder(host.id, null)}
              disabled={host.folderId === null}
            >
              <Server className="h-4 w-4 mr-2" />
              Root (No Folder)
            </ContextMenuItem>
            {folders.length > 0 && <ContextMenuSeparator />}
            {folders.map((folder) => (
              <ContextMenuItem
                key={folder.id}
                onClick={() => moveToFolder(host.id, folder.id)}
                disabled={host.folderId === folder.id}
              >
                <FolderOpen className="h-4 w-4 mr-2" />
                {folder.name}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuItem onClick={() => onEdit(host)}>
          <Pencil className="h-4 w-4 mr-2" />
          Edit
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onDelete(host)} className="text-destructive focus:text-destructive">
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
