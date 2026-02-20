import type { Tab } from '@/stores/session-store';
import { useSessionStore } from '@/stores/session-store';
import { Button } from '@/components/ui/button';
import { X, FolderOpen, SplitSquareHorizontal, SplitSquareVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TerminalToolbarProps {
  tab: Tab;
  onSplit?: (direction: 'horizontal' | 'vertical') => void;
  onClosePane?: () => void;
}

export function TerminalToolbar({ tab, onSplit, onClosePane }: TerminalToolbarProps) {
  const { closeTab, openTab } = useSessionStore();

  function disconnect() {
    if (tab.sessionId) {
      window.sshApi.disconnect(tab.sessionId).catch(() => {});
    }
    closeTab(tab.tabId);
  }

  function openSftp() {
    const sftpTabId = `sftp-${tab.sessionId}`;
    openTab({
      tabId: sftpTabId,
      tabType: 'sftp',
      label: `SFTP: ${tab.label}`,
      hostId: tab.hostId,
      hostname: tab.hostname,
      sessionId: tab.sessionId,
      status: 'connected',
    });
  }

  return (
    <div className="flex items-center gap-2 px-3 h-8 border-b bg-muted/20 shrink-0">
      <div className={cn('w-2 h-2 rounded-full shrink-0',
        tab.status === 'connected' ? 'bg-green-500' :
        tab.status === 'connecting' ? 'bg-yellow-500' :
        tab.status === 'error' ? 'bg-red-500' : 'bg-muted-foreground/30'
      )} />
      <span className="text-xs text-muted-foreground font-mono">
        {tab.hostname} — {tab.label}
      </span>
      <div className="ml-auto flex items-center gap-1">
        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={openSftp} title="Open SFTP">
          <FolderOpen className="h-3.5 w-3.5" />
        </Button>
        {onSplit && (
          <>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => onSplit('horizontal')} title="Split horizontal">
              <SplitSquareHorizontal className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => onSplit('vertical')} title="Split vertical">
              <SplitSquareVertical className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
        {onClosePane ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={onClosePane}
            title="Close pane"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-destructive hover:text-destructive"
            onClick={disconnect}
            title="Disconnect"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
