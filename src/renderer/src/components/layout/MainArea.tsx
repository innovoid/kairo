import { useEffect, useState } from 'react';
import { useSessionStore } from '@/stores/session-store';
import { TerminalTab } from '@/features/terminal/TerminalTab';
import { SplitPaneLayout } from '@/features/terminal/SplitPaneLayout';
import { SftpTab } from '@/features/sftp/SftpTab';
import { SnippetsPage } from '@/features/snippets/SnippetsPage';
import { ErrorBoundary } from '../ErrorBoundary';

export function MainArea() {
  const tabs = useSessionStore((s) => s.tabs);
  const activeTabId = useSessionStore((s) => s.activeTabId);
  const activeTab = activeTabId ? tabs.get(activeTabId) : null;
  const { splitPane, closePane } = useSessionStore();
  const [focusedPaneSessionId, setFocusedPaneSessionId] = useState<string | null>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!activeTab || activeTab.tabType !== 'terminal') return;
      const isMeta = e.metaKey || e.ctrlKey;

      // Cmd+D → horizontal split
      if (isMeta && !e.shiftKey && e.key === 'd') {
        e.preventDefault();
        const newSessionId = `local-${Date.now()}`;
        splitPane(activeTab.tabId, 'horizontal', newSessionId);
        window.sshApi.connect(newSessionId, { type: 'local' });
        setFocusedPaneSessionId(newSessionId);
        return;
      }

      // Cmd+Shift+D → vertical split
      if (isMeta && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        const newSessionId = `local-${Date.now()}`;
        splitPane(activeTab.tabId, 'vertical', newSessionId);
        window.sshApi.connect(newSessionId, { type: 'local' });
        setFocusedPaneSessionId(newSessionId);
        return;
      }

      // Cmd+W → close focused pane when split pane is active
      if (isMeta && e.key === 'w' && activeTab.paneTree && focusedPaneSessionId) {
        e.preventDefault();
        closePane(activeTab.tabId, focusedPaneSessionId);
        setFocusedPaneSessionId(null);
        return;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, focusedPaneSessionId, splitPane, closePane]);

  if (!activeTab) return null;

  if (activeTab.tabType === 'snippets') {
    return (
      <div className="flex-1 relative overflow-hidden">
        <SnippetsPage />
      </div>
    );
  }

  if (activeTab.tabType !== 'terminal' && activeTab.tabType !== 'sftp') {
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
              {tab.paneTree ? (
                <SplitPaneLayout
                  pane={tab.paneTree}
                  parentTab={tab}
                  onSplit={(sessionId, direction) => {
                    const newSessionId = `local-${Date.now()}`;
                    splitPane(tab.tabId, direction, newSessionId);
                    window.sshApi.connect(newSessionId, { type: 'local' });
                    setFocusedPaneSessionId(newSessionId);
                  }}
                  onClosePane={(sessionId) => {
                    closePane(tab.tabId, sessionId);
                    if (focusedPaneSessionId === sessionId) setFocusedPaneSessionId(null);
                  }}
                  focusedSessionId={focusedPaneSessionId ?? undefined}
                  onFocus={setFocusedPaneSessionId}
                />
              ) : (
                <TerminalTab tab={tab} />
              )}
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
