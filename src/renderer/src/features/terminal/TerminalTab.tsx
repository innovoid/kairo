import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { Tab } from '@/stores/session-store';
import { useSessionStore } from '@/stores/session-store';
import { useSettingsStore } from '@/stores/settings-store';
import { useTerminal } from './useTerminal';
import { TerminalToolbar } from './TerminalToolbar';
import { TerminalSearchBar } from './TerminalSearchBar';
import '@xterm/xterm/css/xterm.css';

interface TerminalTabProps {
  tab: Tab;
}

export function TerminalTab({ tab }: TerminalTabProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { updateTabStatus } = useSessionStore();
  const { settings } = useSettingsStore();
  const [showSearch, setShowSearch] = useState(false);

  const { terminal, searchAddon } = useTerminal({
    containerRef,
    sessionId: tab.sessionId!,
    settings,
  });

  useEffect(() => {
    // Listen for SSH events for this session
    const offData = window.sshApi.onData((sessionId, data) => {
      if (sessionId === tab.sessionId && terminal.current) {
        terminal.current.write(data);
      }
    });

    const offClosed = window.sshApi.onClosed((sessionId) => {
      if (sessionId === tab.sessionId) {
        updateTabStatus(tab.tabId, 'disconnected');
        terminal.current?.write('\r\n\x1b[31mConnection closed.\x1b[0m\r\n');
      }
    });

    const offError = window.sshApi.onError((sessionId, error) => {
      if (sessionId === tab.sessionId) {
        updateTabStatus(tab.tabId, 'error');
        terminal.current?.write(`\r\n\x1b[31mError: ${error}\x1b[0m\r\n`);
        toast.error(error);
      }
    });

    // Mark as connected when we first get data
    const offDataForStatus = window.sshApi.onData((sessionId) => {
      if (sessionId === tab.sessionId && tab.status === 'connecting') {
        updateTabStatus(tab.tabId, 'connected');
      }
    });

    return () => {
      offData();
      offClosed();
      offError();
      offDataForStatus();
    };
  }, [tab.sessionId, tab.status]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        setShowSearch(true);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="flex flex-col h-full">
      <TerminalToolbar tab={tab} />
      <div className="relative flex-1 overflow-hidden">
        <div ref={containerRef} className="absolute inset-0 bg-[#09090b] p-1" />
        {showSearch && (
          <TerminalSearchBar
            searchAddon={searchAddon.current}
            onClose={() => setShowSearch(false)}
          />
        )}
      </div>
    </div>
  );
}
