import { useState } from 'react';
import { useHotkey } from '@tanstack/react-hotkeys';
import type { RegisterableHotkey } from '@tanstack/hotkeys';
import { getHotkey } from '@/lib/hotkeys-registry';
import { useSessionStore } from '@/stores/session-store';
import { useSettingsStore } from '@/stores/settings-store';
import { TerminalTab } from '@/features/terminal/TerminalTab';
import { SplitPaneLayout } from '@/features/terminal/SplitPaneLayout';
import { SftpTab } from '@/features/sftp/SftpTab';
import { AgentPanel } from '@/features/agent/AgentPanel';
import { ErrorBoundary } from '../ErrorBoundary';

interface MainAreaProps {
  agentOpen?: boolean;
  onAgentClose?: () => void;
  workspaceId?: string;
}

export function MainArea({ agentOpen, onAgentClose, workspaceId }: MainAreaProps) {
  const tabs = useSessionStore((s) => s.tabs);
  const activeTabId = useSessionStore((s) => s.activeTabId);
  const activeTab = activeTabId ? tabs.get(activeTabId) : null;
  const { splitPane, closePane } = useSessionStore();
  const { settings } = useSettingsStore();
  const [focusedPaneSessionId, setFocusedPaneSessionId] = useState<string | null>(null);
  const resolveHotkey = (id: string): RegisterableHotkey => {
    const definition = getHotkey(id);
    if (!definition) throw new Error(`Missing hotkey definition: ${id}`);
    return definition.key as RegisterableHotkey;
  };

  // Split Horizontal
  useHotkey(resolveHotkey('split-horizontal'), (e) => {
    e.preventDefault();
    if (activeTab && activeTab.tabType === 'terminal') {
      const newSessionId = `local-${Date.now()}`;
      splitPane(activeTab.tabId, 'horizontal', newSessionId);
      window.sshApi.connect(newSessionId, { type: 'local', promptStyle: settings?.promptStyle });
      setFocusedPaneSessionId(newSessionId);
    }
  });

  // Split Vertical
  useHotkey(resolveHotkey('split-vertical'), (e) => {
    e.preventDefault();
    if (activeTab && activeTab.tabType === 'terminal') {
      const newSessionId = `local-${Date.now()}`;
      splitPane(activeTab.tabId, 'vertical', newSessionId);
      window.sshApi.connect(newSessionId, { type: 'local', promptStyle: settings?.promptStyle });
      setFocusedPaneSessionId(newSessionId);
    }
  });

  if (!activeTab) return null;

  if (activeTab.tabType !== 'terminal' && activeTab.tabType !== 'sftp') {
    return null;
  }

  const terminalAndSftpTabs = [...tabs.values()].filter(
    (t) => t.tabType === 'terminal' || t.tabType === 'sftp'
  );

  return (
    <div className="w-full h-full overflow-hidden flex">
      {/* Terminal / SFTP area */}
      <div className="flex-1 relative overflow-hidden">
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

      {/* Agent panel — inline right column, no overlay */}
      {agentOpen && (
        <div
          className="w-[340px] shrink-0 h-full overflow-hidden"
          style={{ animation: 'slideInRight 0.2s cubic-bezier(0.16,1,0.3,1) both' }}
        >
          <AgentPanel onClose={onAgentClose ?? (() => {})} workspaceId={workspaceId} />
        </div>
      )}

      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(20px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
