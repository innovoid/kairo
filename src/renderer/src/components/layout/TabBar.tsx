import { useSessionStore } from '@/stores/session-store';
import { Button } from '@/components/ui/button';
import { X, Terminal, FolderOpen, Server, KeyRound, Settings, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

export function TabBar() {
  const tabs = useSessionStore((s) => s.tabs);
  const activeTabId = useSessionStore((s) => s.activeTabId);
  const setActiveTab = useSessionStore((s) => s.setActiveTab);
  const closeTab = useSessionStore((s) => s.closeTab);
  const tabList = [...tabs.values()];

  function handleClose(e: React.MouseEvent, tabId: string) {
    e.stopPropagation();
    const tab = tabs.get(tabId);
    // SFTP tabs share the sessionId with their parent terminal tab — do NOT
    // disconnect the SSH session when closing an SFTP tab, only for terminal tabs.
    if (tab?.sessionId && tab.tabType !== 'sftp') {
      window.sshApi.disconnect(tab.sessionId).catch(() => {});
    }
    closeTab(tabId);
  }

  function getTabIcon(tabType: string) {
    switch (tabType) {
      case 'hosts': return <Server className="h-3.5 w-3.5 shrink-0" />;
      case 'keys': return <KeyRound className="h-3.5 w-3.5 shrink-0" />;
      case 'team': return <Users className="h-3.5 w-3.5 shrink-0" />;
      case 'settings': return <Settings className="h-3.5 w-3.5 shrink-0" />;
      case 'sftp': return <FolderOpen className="h-3.5 w-3.5 shrink-0" />;
      case 'terminal': return <Terminal className="h-3.5 w-3.5 shrink-0" />;
      default: return null;
    }
  }

  return (
    <div className="flex items-center h-10 border-b bg-muted/20 backdrop-blur-sm overflow-x-auto shrink-0 px-1">
      {tabList.map((tab) => (
        <div
          key={tab.tabId}
          onClick={() => setActiveTab(tab.tabId)}
          className={cn(
            'relative flex items-center gap-2 px-3 h-8 my-1 rounded-md cursor-pointer shrink-0 max-w-48 group transition-all duration-150',
            activeTabId === tab.tabId
              ? 'bg-background text-foreground shadow-sm ring-1 ring-border'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          )}
        >
          <div className={cn('transition-colors',
            activeTabId === tab.tabId ? 'text-primary' : 'text-muted-foreground'
          )}>
            {getTabIcon(tab.tabType)}
          </div>
          <span className="text-xs font-medium truncate">{tab.label}</span>
          {tab.status === 'connecting' && (
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 shrink-0 animate-pulse" />
          )}
          {tab.status === 'connected' && (
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0 shadow-[0_0_6px_rgba(34,197,94,0.5)]" />
          )}
          {tab.status === 'error' && (
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0 shadow-[0_0_6px_rgba(239,68,68,0.5)]" />
          )}
          {tab.closable && (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 ml-auto opacity-0 group-hover:opacity-100 shrink-0 hover:bg-destructive/10 hover:text-destructive transition-all"
              onClick={(e) => handleClose(e, tab.tabId)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
