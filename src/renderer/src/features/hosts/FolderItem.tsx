import { useState } from 'react';
import type { HostFolder, Host } from '@shared/types/hosts';
import { HostCard } from './HostCard';
import { Button } from '@/components/ui/button';
import { ChevronRight, FolderOpen, Folder, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';

interface FolderItemProps {
  folder: HostFolder;
  hosts: Host[];
  allFolders: HostFolder[];
  onEditHost: (host: Host) => void;
  onDeleteHost: (host: Host) => void;
  onEditFolder: (folder: HostFolder) => void;
  onDeleteFolder: (folder: HostFolder) => void;
}

export function FolderItem({
  folder,
  hosts,
  allFolders,
  onEditHost,
  onDeleteHost,
  onEditFolder,
  onDeleteFolder,
}: FolderItemProps) {
  const [expanded, setExpanded] = useState(true);

  const childFolders = allFolders.filter((f) => f.parentId === folder.id);
  const folderHosts = hosts.filter((h) => h.folderId === folder.id);

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div>
          <button
            type="button"
            className="flex w-full items-center gap-1 px-2 py-1 rounded hover:bg-accent/40 text-left"
            onClick={() => setExpanded(!expanded)}
          >
            <ChevronRight className={cn('h-3 w-3 text-muted-foreground transition-transform', expanded && 'rotate-90')} />
            {expanded ? (
              <FolderOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            ) : (
              <Folder className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            )}
            <span className="text-sm text-muted-foreground">{folder.name}</span>
          </button>

          {expanded && (
            <div className="ml-4">
              {childFolders.map((sub) => (
                <FolderItem
                  key={sub.id}
                  folder={sub}
                  hosts={hosts}
                  allFolders={allFolders}
                  onEditHost={onEditHost}
                  onDeleteHost={onDeleteHost}
                  onEditFolder={onEditFolder}
                  onDeleteFolder={onDeleteFolder}
                />
              ))}
              {folderHosts.map((h) => (
                <HostCard key={h.id} host={h} onEdit={onEditHost} onDelete={onDeleteHost} />
              ))}
            </div>
          )}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => onEditFolder(folder)}>
          <Pencil className="h-4 w-4 mr-2" />
          Rename
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => onDeleteFolder(folder)}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete folder
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
