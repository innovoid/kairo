import * as React from 'react';
import { Search, Plus, FolderOpen, Server, Circle, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Overlay,
  OverlayHeader,
  OverlayContent,
  OverlayFooter,
} from '@/components/ui/overlay';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface Host {
  id: string;
  hostname: string;
  address: string;
  username: string;
  description?: string;
  status: 'connected' | 'disconnected' | 'connecting';
  folder?: string;
  tags?: string[];
}

interface Folder {
  name: string;
  hosts: Host[];
  expanded: boolean;
}

interface HostBrowserOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hosts: Host[];
  onConnect: (hostId: string) => void;
  onNewHost?: () => void;
  className?: string;
}

export function HostBrowserOverlay({
  open,
  onOpenChange,
  hosts,
  onConnect,
  onNewHost,
  className,
}: HostBrowserOverlayProps) {
  const [search, setSearch] = React.useState('');
  const [expandedFolders, setExpandedFolders] = React.useState<Set<string>>(
    new Set(['All'])
  );

  // Group hosts by folder
  const folders = React.useMemo(() => {
    const folderMap = new Map<string, Host[]>();

    hosts.forEach((host) => {
      const folderName = host.folder || 'All';
      if (!folderMap.has(folderName)) {
        folderMap.set(folderName, []);
      }
      folderMap.get(folderName)!.push(host);
    });

    return Array.from(folderMap.entries()).map(([name, hosts]) => ({
      name,
      hosts,
      expanded: expandedFolders.has(name),
    }));
  }, [hosts, expandedFolders]);

  // Filter hosts
  const filteredHosts = React.useMemo(() => {
    if (!search) return hosts;

    const searchLower = search.toLowerCase();
    return hosts.filter(
      (host) =>
        host.hostname.toLowerCase().includes(searchLower) ||
        host.address.toLowerCase().includes(searchLower) ||
        host.username.toLowerCase().includes(searchLower) ||
        host.description?.toLowerCase().includes(searchLower) ||
        host.tags?.some((tag) => tag.toLowerCase().includes(searchLower))
    );
  }, [hosts, search]);

  const toggleFolder = (folderName: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderName)) {
        next.delete(folderName);
      } else {
        next.add(folderName);
      }
      return next;
    });
  };

  const handleConnect = (hostId: string) => {
    onConnect(hostId);
    onOpenChange(false);
  };

  return (
    <Overlay open={open} onOpenChange={onOpenChange} className={className}>
      <OverlayHeader
        title="Browse Hosts"
        description={`${hosts.length} host${hosts.length === 1 ? '' : 's'} configured`}
        onClose={() => onOpenChange(false)}
      />

      <OverlayContent className="pt-4">
        {/* Search Bar */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search hosts by name, address, or tags..."
              className={cn(
                'pl-10 h-11 !bg-[var(--surface-1)] border-[var(--border)]',
                'font-mono text-sm tracking-tight text-foreground',
                'placeholder:text-text-tertiary',
                'focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary',
                'transition-all duration-200'
              )}
            />
          </div>
        </div>

        {/* Host List */}
        <div className="space-y-4">
          {search ? (
            // Flat list when searching
            filteredHosts.length === 0 ? (
              <EmptyState search={search} />
            ) : (
              <div className="space-y-2">
                {filteredHosts.map((host, index) => (
                  <HostItem
                    key={host.id}
                    host={host}
                    index={index}
                    onClick={() => handleConnect(host.id)}
                  />
                ))}
              </div>
            )
          ) : (
            // Grouped by folder
            folders.map((folder, folderIndex) => (
              <FolderSection
                key={folder.name}
                folder={folder}
                index={folderIndex}
                onToggle={() => toggleFolder(folder.name)}
                onHostClick={handleConnect}
              />
            ))
          )}
        </div>
      </OverlayContent>

      <OverlayFooter>
        <Button
          variant="outline"
          onClick={() => onOpenChange(false)}
          className="hover:scale-105 active:scale-95 transition-transform"
        >
          Cancel
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
    </Overlay>
  );
}

interface FolderSectionProps {
  folder: Folder;
  index: number;
  onToggle: () => void;
  onHostClick: (hostId: string) => void;
}

function FolderSection({ folder, index, onToggle, onHostClick }: FolderSectionProps) {
  return (
    <div
      style={{
        animation: `folderEnter 0.4s cubic-bezier(0.16, 1, 0.3, 1) ${0.05 * index}s both`,
      }}
    >
      {/* Folder Header */}
      <button
        onClick={onToggle}
        className={cn(
          'flex items-center gap-2 w-full px-3 py-2 rounded-lg',
          'bg-[var(--surface-1)] hover:bg-[var(--surface-2)]',
          'transition-all duration-200',
          'hover:scale-[1.01] active:scale-[0.99]',
          'group'
        )}
      >
        <ChevronRight
          className={cn(
            'h-4 w-4 text-text-tertiary transition-transform duration-300',
            folder.expanded && 'rotate-90'
          )}
        />
        <FolderOpen className="h-4 w-4 text-primary" />
        <span className="flex-1 text-left text-sm font-mono font-medium text-foreground">
          {folder.name}
        </span>
        <span className="text-xs font-mono text-text-secondary">
          {folder.hosts.length}
        </span>
      </button>

      {/* Hosts in Folder */}
      {folder.expanded && (
        <div className="mt-2 ml-6 space-y-2">
          {folder.hosts.map((host, hostIndex) => (
            <HostItem
              key={host.id}
              host={host}
              index={hostIndex}
              onClick={() => onHostClick(host.id)}
            />
          ))}
        </div>
      )}

      <style jsx>{`
        @keyframes folderEnter {
          from {
            opacity: 0;
            transform: translateX(-8px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
}

interface HostItemProps {
  host: Host;
  index: number;
  onClick: () => void;
}

function HostItem({ host, index, onClick }: HostItemProps) {
  const statusConfig = {
    connected: { color: 'text-success', label: 'Connected' },
    connecting: { color: 'text-warning', label: 'Connecting...' },
    disconnected: { color: 'text-text-disabled', label: 'Disconnected' },
  };

  const status = statusConfig[host.status];

  return (
    <div
      onClick={onClick}
      className={cn(
        'group relative flex items-center gap-4 p-4 rounded-lg',
        'bg-[var(--surface-1)] hover:bg-[var(--surface-3)]',
        'border border-transparent hover:border-[var(--border)]',
        'cursor-pointer select-none',
        'transition-all duration-300 ease-out',
        'hover:scale-[1.02] hover:shadow-[0_8px_24px_-4px_rgba(59,130,246,0.2)]',
        'hover:-translate-y-0.5',
        'active:scale-[0.98]'
      )}
      style={{
        animation: `hostEnter 0.4s cubic-bezier(0.16, 1, 0.3, 1) ${0.05 * index}s both`,
      }}
    >
      {/* Left accent bar */}
      <div
        className={cn(
          'absolute left-0 top-2 bottom-2 w-1 rounded-r-full',
          'bg-gradient-to-b from-primary to-cyan-400',
          'opacity-0 group-hover:opacity-100',
          'transition-opacity duration-300'
        )}
      />

      {/* Icon */}
      <div
        className={cn(
          'flex-shrink-0 flex items-center justify-center',
          'h-12 w-12 rounded-lg',
          'bg-[var(--surface-2)] group-hover:bg-primary/10',
          'border border-[var(--border)] group-hover:border-primary/30',
          'transition-all duration-300',
          'group-hover:scale-110'
        )}
      >
        <Server className="h-5 w-5 text-text-secondary group-hover:text-primary transition-colors duration-300" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-sm font-mono font-semibold text-foreground truncate">
            {host.hostname}
          </h3>
          <Circle
            className={cn('h-2 w-2 flex-shrink-0', status.color)}
            fill="currentColor"
          />
        </div>
        <p className="text-xs font-mono text-text-secondary truncate">
          {host.username}@{host.address}
        </p>
        {host.description && (
          <p className="text-xs text-text-secondary truncate mt-1">
            {host.description}
          </p>
        )}
        {host.tags && host.tags.length > 0 && (
          <div className="flex items-center gap-1 mt-2">
            {host.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 text-[10px] font-mono bg-[var(--surface-2)] border border-[var(--border)] rounded-md text-text-secondary"
              >
                {tag}
              </span>
            ))}
            {host.tags.length > 3 && (
              <span className="text-[10px] text-text-tertiary">
                +{host.tags.length - 3}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Status */}
      <div className="flex-shrink-0 text-right">
        <span className={cn('text-xs font-mono', status.color)}>
          {status.label}
        </span>
      </div>

      <style jsx>{`
        @keyframes hostEnter {
          from {
            opacity: 0;
            transform: translateX(-8px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
        }
      `}</style>
    </div>
  );
}

function EmptyState({ search }: { search: string }) {
  return (
    <div className="py-16 text-center">
      <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-[var(--surface-2)] mb-4">
        <Search className="h-8 w-8 text-text-disabled" />
      </div>
      <h3 className="text-sm font-medium text-foreground mb-1">No hosts found</h3>
      <p className="text-sm text-text-secondary">
        No results for "{search}"
      </p>
    </div>
  );
}
