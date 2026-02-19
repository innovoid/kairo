import type { Host } from '@shared/types/hosts';
import { useSessionStore } from '@/stores/session-store';
import { cn } from '@/lib/utils';
import { Terminal, FolderOpen, Pencil, Trash2 } from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';

interface HostCardProps {
  host: Host;
  onEdit: (host: Host) => void;
  onDelete: (host: Host) => void;
}

export function HostCard({ host, onEdit, onDelete }: HostCardProps) {
  const { sessions, openSession, setActiveSession } = useSessionStore();

  const existingSession = [...sessions.values()].find(
    (s) => s.hostId === host.id && s.tabType === 'terminal'
  );

  function connect() {
    if (existingSession) {
      setActiveSession(existingSession.sessionId);
      return;
    }

    const sessionId = crypto.randomUUID();
    openSession({
      sessionId,
      hostId: host.id,
      hostLabel: host.label,
      hostname: host.hostname,
      tabType: 'terminal',
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
    const sessionId = existingSession?.sessionId ?? crypto.randomUUID();

    if (!existingSession) {
      openSession({
        sessionId,
        hostId: host.id,
        hostLabel: host.label,
        hostname: host.hostname,
        tabType: 'terminal',
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

    useSessionStore.getState().openSftpTab({
      sessionId: sessionId.replace('sftp-', ''),
      hostId: host.id,
      hostLabel: `SFTP: ${host.label}`,
      hostname: host.hostname,
    });
  }

  const isConnected = existingSession?.status === 'connected';

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded cursor-pointer group hover:bg-accent/50',
            existingSession ? 'text-foreground' : 'text-muted-foreground'
          )}
          onClick={connect}
        >
          <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', isConnected ? 'bg-green-500' : 'bg-muted-foreground/30')} />
          <Terminal className="h-3.5 w-3.5 shrink-0" />
          <span className="text-sm truncate flex-1">{host.label}</span>
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
        <ContextMenuItem onClick={() => onEdit(host)}>
          <Pencil className="h-4 w-4 mr-2" />
          Edit
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => onDelete(host)}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
