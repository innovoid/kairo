import { useSessionStore } from '@/stores/session-store';
import { TerminalTab } from '@/features/terminal/TerminalTab';
import { SftpTab } from '@/features/sftp/SftpTab';
import { ErrorBoundary } from '../ErrorBoundary';

export function MainArea() {
  const tabs = useSessionStore((s) => s.tabs);
  const activeTabId = useSessionStore((s) => s.activeTabId);
  const activeTab = activeTabId ? tabs.get(activeTabId) : null;

  if (!activeTab || (activeTab.tabType !== 'terminal' && activeTab.tabType !== 'sftp')) {
    return null;
  }

  const terminalAndSftpTabs = [...tabs.values()].filter(
    (t) => t.tabType === 'terminal' || t.tabType === 'sftp'
  );

  return (
    <div className="flex-1 relative overflow-hidden">
      {terminalAndSftpTabs.map((tab) => (
        <div
          key={tab.tabId}
          className={tab.tabId === activeTabId ? 'absolute inset-0' : 'hidden'}
        >
          {tab.tabType === 'terminal' ? (
            <ErrorBoundary fallbackLabel="Terminal crashed">
              <TerminalTab tab={tab} />
            </ErrorBoundary>
          ) : (
            <ErrorBoundary fallbackLabel="SFTP crashed">
              <SftpTab tab={tab} />
            </ErrorBoundary>
          )}
        </div>
      ))}
    </div>
  );
}
