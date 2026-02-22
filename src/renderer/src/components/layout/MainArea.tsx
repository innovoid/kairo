import { useState } from 'react';
import { useHotkey } from '@tanstack/react-hotkeys';
import { getHotkey } from '@/lib/hotkeys-registry';
import { useSessionStore } from '@/stores/session-store';
import { useSettingsStore } from '@/stores/settings-store';
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
  const { settings } = useSettingsStore();
  const [focusedPaneSessionId, setFocusedPaneSessionId] = useState<string | null>(null);

  // Split Horizontal
  useHotkey(getHotkey('split-horizontal')!.key, (e) => {
    e.preventDefault();
    if (activeTab && activeTab.tabType === 'terminal') {
      const newSessionId = `local-${Date.now()}`;
      splitPane(activeTab.tabId, 'horizontal', newSessionId);
      window.sshApi.connect(newSessionId, { type: 'local', promptStyle: settings?.promptStyle });
      setFocusedPaneSessionId(newSessionId);
    }
  }, [activeTab, splitPane, settings?.promptStyle]);

  // Split Vertical
  useHotkey(getHotkey('split-vertical')!.key, (e) => {
    e.preventDefault();
    if (activeTab && activeTab.tabType === 'terminal') {
      const newSessionId = `local-${Date.now()}`;
      splitPane(activeTab.tabId, 'vertical', newSessionId);
      window.sshApi.connect(newSessionId, { type: 'local', promptStyle: settings?.promptStyle });
      setFocusedPaneSessionId(newSessionId);
    }
  }, [activeTab, splitPane, settings?.promptStyle]);

  if (!activeTab) return null;

  if (activeTab.tabType === 'snippets') {
    return (
      <div className="w-full h-full overflow-hidden">
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
    <div className="w-full h-full overflow-hidden relative">
      {terminalAndSftpTabs.map((tab) => {
        const isVisible = tab.tabId === activeTabId;
        return (
          <div
            key={tab.tabId}
            className={isVisible ? 'absolute inset-0' : 'hidden'}
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
                      window.sshApi.connect(newSessionId, { type: 'local', promptStyle: settings?.promptStyle });
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
                  <TerminalTab tab={tab} isVisible={isVisible} />
                )}
              </ErrorBoundary>
            ) : (
              <ErrorBoundary fallbackLabel="SFTP crashed">
                <SftpTab tab={tab} />
              </ErrorBoundary>
            )}
          </div>
        );
      })}
    </div>
  );
}
