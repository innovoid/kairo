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
    if (tab?.sessionId) {
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
    <div className="flex items-center h-9 border-b bg-muted/30 overflow-x-auto shrink-0">
      {tabList.map((tab) => (
        <div
          key={tab.tabId}
          onClick={() => setActiveTab(tab.tabId)}
          className={cn(
            'flex items-center gap-1.5 px-3 h-full border-r cursor-pointer shrink-0 max-w-40 group',
            activeTabId === tab.tabId
              ? 'bg-background text-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          )}
        >
          {getTabIcon(tab.tabType)}
          <span className="text-xs truncate">{tab.label}</span>
          {tab.status === 'connecting' && (
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 shrink-0" />
          )}
          {tab.status === 'connected' && (
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
          )}
          {tab.status === 'error' && (
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
          )}
          {tab.closable && (
            <Button
              variant="ghost"
              size="icon"
              className="h-4 w-4 ml-auto opacity-0 group-hover:opacity-100 shrink-0"
              onClick={(e) => handleClose(e, tab.tabId)}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
