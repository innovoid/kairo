import { useEffect, useRef, useState } from 'react';
import { useHotkey } from '@tanstack/react-hotkeys';
import type { RegisterableHotkey } from '@tanstack/hotkeys';
import { getHotkey } from '@/lib/hotkeys-registry';
import { toast } from 'sonner';
import type { Tab } from '@/stores/session-store';
import { useSessionStore } from '@/stores/session-store';
import { useSettingsStore } from '@/stores/settings-store';
import { useBroadcastStore } from '@/stores/broadcast-store';
import { TERMINAL_THEMES } from '@shared/themes/terminal-themes';
import { useTerminal } from './useTerminal';
import { TerminalSearchBar } from './TerminalSearchBar';
import { SnippetPickerOverlay } from '@/features/snippets/SnippetPickerOverlay';
import { CommandHintOverlay } from './CommandHintOverlay';
import { cn } from '@/lib/utils';

interface TerminalTabProps {
  tab: Tab;
  onSplit?: (direction: 'horizontal' | 'vertical') => void;
  onClosePane?: () => void;
  isPane?: boolean;
  isVisible?: boolean;
}

export function TerminalTab({ tab, onSplit, onClosePane, isPane, isVisible = true }: TerminalTabProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { updateTabStatus } = useSessionStore();
  const { settings } = useSettingsStore();
  const { targetSessionIds } = useBroadcastStore();
  const [showSearch, setShowSearch] = useState(false);
  const [showSnippetPicker, setShowSnippetPicker] = useState(false);
  const resolveHotkey = (id: string): RegisterableHotkey => {
    const definition = getHotkey(id);
    if (!definition) throw new Error(`Missing hotkey definition: ${id}`);
    return definition.key as RegisterableHotkey;
  };

  const isBroadcastTarget = tab.sessionId && targetSessionIds.includes(tab.sessionId);

  const { terminal, searchAddon } = useTerminal({
    containerRef,
    sessionId: tab.sessionId!,
    settings,
    isVisible,
  });

  // Get terminal theme background color
  const themeName = settings?.terminalTheme ?? 'dracula';
  const terminalBg = TERMINAL_THEMES[themeName]?.theme?.background ?? TERMINAL_THEMES['dracula'].theme.background;

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

  // Search
  useHotkey(resolveHotkey('search'), (e) => {
    e.preventDefault();
    setShowSearch(true);
  });

  // Snippet Picker
  useHotkey(resolveHotkey('snippet-picker'), (e) => {
    e.preventDefault();
    setShowSnippetPicker(true);
  });

  return (
    <div className={cn('h-full', isBroadcastTarget && 'border-l-2 border-blue-500')}>
      <div
        className="relative w-full h-full overflow-hidden p-3"
        style={{ backgroundColor: terminalBg }}
      >
        <div ref={containerRef} className="w-full h-full" />

        {/* Command Hint Overlay */}
        <CommandHintOverlay
          terminal={terminal.current}
          sessionId={tab.sessionId!}
          currentRemotePath="/home"
          hostId={tab.hostId}
          hostLabel={tab.label}
        />

        {showSearch && (
          <TerminalSearchBar
            searchAddon={searchAddon.current}
            onClose={() => setShowSearch(false)}
          />
        )}
        {showSnippetPicker && (
          <SnippetPickerOverlay
            onSelect={(cmd) => {
              window.sshApi.send(tab.sessionId!, cmd);
              setShowSnippetPicker(false);
            }}
            onClose={() => setShowSnippetPicker(false)}
          />
        )}
      </div>
    </div>
  );
}
