import { useEffect, useState } from 'react';
import type { Host, HostFolder } from '@shared/types/hosts';
import { useHostStore } from '@/stores/host-store';
import { HostCard } from './HostCard';
import { FolderItem } from './FolderItem';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, FolderPlus, Search } from 'lucide-react';

interface HostTreeProps {
  workspaceId: string;
  onAddHost: () => void;
  onEditHost: (host: Host) => void;
}

export function HostTree({ workspaceId, onAddHost, onEditHost }: HostTreeProps) {
  const { hosts, folders, fetchHosts, deleteHost, deleteFolder, updateFolder } = useHostStore();
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchHosts(workspaceId);
  }, [workspaceId]);

  async function handleDeleteHost(host: Host) {
    if (!window.confirm(`Delete "${host.label}"?`)) return;
    await deleteHost(host.id);
  }

  async function handleEditFolder(folder: HostFolder) {
    const name = window.prompt('Rename folder:', folder.name);
    if (name?.trim() && name.trim() !== folder.name) {
      await updateFolder(folder.id, name.trim());
    }
  }

  async function handleDeleteFolder(folder: HostFolder) {
    if (!window.confirm(`Delete folder "${folder.name}"? Hosts inside will become unorganized.`)) return;
    await deleteFolder(folder.id);
  }

  async function handleAddFolder() {
    const name = window.prompt('New folder name:');
    if (!name?.trim()) return;
    await useHostStore.getState().createFolder({ workspaceId, name: name.trim() });
  }

  const filtered = search
    ? hosts.filter(
        (h) =>
          h.label.toLowerCase().includes(search.toLowerCase()) ||
          h.hostname.toLowerCase().includes(search.toLowerCase())
      )
    : hosts;

  // Root-level folders (no parent)
  const rootFolders = folders.filter((f) => !f.parentId);
  // Hosts with no folder assignment
  const rootHosts = filtered.filter((h) => !h.folderId);

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="px-2 py-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search hosts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-7 h-7 text-xs"
          />
        </div>
      </div>

      {/* Host list */}
      <div className="flex-1 overflow-y-auto px-1">
        {rootFolders.map((folder) => (
          <FolderItem
            key={folder.id}
            folder={folder}
            hosts={filtered}
            allFolders={folders}
            onEditHost={onEditHost}
            onDeleteHost={handleDeleteHost}
            onEditFolder={handleEditFolder}
            onDeleteFolder={handleDeleteFolder}
          />
        ))}
        {rootHosts.map((h) => (
          <HostCard key={h.id} host={h} onEdit={onEditHost} onDelete={handleDeleteHost} />
        ))}
        {filtered.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">
            {search ? 'No matching hosts' : 'No hosts yet'}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-1 px-2 py-2 border-t">
        <Button variant="ghost" size="sm" className="flex-1 h-7 text-xs" onClick={onAddHost}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add Host
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleAddFolder} title="New folder">
          <FolderPlus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
