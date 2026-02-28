import { useRef, useState, useCallback, useEffect } from 'react';
import { useHotkey } from '@tanstack/react-hotkeys';
import type { RegisterableHotkey } from '@tanstack/hotkeys';
import { getHotkey } from '@/lib/hotkeys-registry';
import { isTerminalFocused } from '@/lib/terminal-focus';
import type { Tab } from '@/stores/session-store';
import { useSessionStore } from '@/stores/session-store';
import { useSettingsStore } from '@/stores/settings-store';
import { useBroadcastStore } from '@/stores/broadcast-store';
import { useHostStore } from '@/stores/host-store';
import { TERMINAL_THEMES } from '@shared/themes/terminal-themes';
import { useTerminal } from './useTerminal';
import { useSshSessionEvents } from './useSshSessionEvents';
import { SessionStatusOverlay } from './SessionStatusOverlay';
import { ConnectingOverlay } from './ConnectingOverlay';
import { TerminalSearchBar } from './TerminalSearchBar';
import { SnippetPickerOverlay } from '@/features/snippets/SnippetPickerOverlay';
import { CommandHintOverlay } from './CommandHintOverlay';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
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
  const { settings } = useSettingsStore();
  const { targetSessionIds } = useBroadcastStore();
  const { closeTab } = useSessionStore();
  const { hosts } = useHostStore();
  const [showSearch, setShowSearch] = useState(false);
  const [showSnippetPicker, setShowSnippetPicker] = useState(false);
  const [currentRemotePath, setCurrentRemotePath] = useState('/');

  const resolveHotkey = (id: string): RegisterableHotkey => {
    const definition = getHotkey(id);
    if (!definition) throw new Error(`Missing hotkey definition: ${id}`);
    return definition.key as RegisterableHotkey;
  };

  const isBroadcastTarget = tab.sessionId && targetSessionIds.includes(tab.sessionId);

  const { terminal, searchAddon, pendingPaste, confirmPaste, cancelPaste } = useTerminal({
    containerRef,
    sessionId: tab.sessionId!,
    settings,
    isVisible,
  });

  // Track CWD via OSC 7 escape sequence
  const handleCwdChange = useCallback((cwd: string) => {
    setCurrentRemotePath(cwd);
  }, []);

  // Wire up SSH IPC events → terminal + disconnect tracking
  useSshSessionEvents({
    sessionId: tab.sessionId!,
    tabId: tab.tabId,
    tabStatus: tab.status ?? undefined,
    terminalRef: terminal,
    reconnectConfig: tab.reconnectConfig,
    onCwdChange: handleCwdChange,
  });

  // Get terminal theme background color
  const themeName = settings?.terminalTheme ?? 'dracula';
  const terminalBg = TERMINAL_THEMES[themeName]?.theme?.background ?? TERMINAL_THEMES['dracula'].theme.background;

  // ── Reconnect: keep same tabId, assign new sessionId, bump attempt count ──
  const handleReconnect = useCallback(async () => {
    if (!tab.reconnectConfig) return;

    const newSessionId = crypto.randomUUID();

    useSessionStore.setState((state) => {
      const existing = state.tabs.get(tab.tabId);
      if (!existing) return state;
      const newTabs = new Map(state.tabs);
      newTabs.set(tab.tabId, {
        ...existing,
        sessionId: newSessionId,
        status: 'connecting',
        disconnectReason: undefined,
        disconnectedAt: undefined,
        reconnectAttempts: (existing.reconnectAttempts ?? 0) + 1,
      });
      return { tabs: newTabs };
    });

    terminal.current?.write('\r\n\x1b[2m— reconnecting… —\x1b[0m\r\n');

    // Fetch password on-demand from Supabase — never stored in renderer memory
    let password: string | undefined;
    if (tab.reconnectConfig?.authType === 'password' && tab.reconnectConfig.hostId) {
      try {
        password = await window.hostsApi.getPassword(tab.reconnectConfig.hostId) ?? undefined;
      } catch {
        // Password fetch failed - continue without it, SSH will fail with auth error
      }
    }

    const connectPayload = {
      ...tab.reconnectConfig,
      ...(password ? { password } : {}),
    };

    void window.sshApi.connect(newSessionId, connectPayload);
  }, [tab.tabId, tab.reconnectConfig, terminal, hosts]);

  // Search — only when this terminal is active/focused
  useHotkey(resolveHotkey('search'), (e) => {
    if (!isTerminalFocused()) return;
    e.preventDefault();
    setShowSearch(true);
  });

  // Snippet Picker — only when this terminal is active/focused
  useHotkey(resolveHotkey('snippet-picker'), (e) => {
    if (!isTerminalFocused()) return;
    e.preventDefault();
    setShowSnippetPicker(true);
  });

  return (
    <div className={cn('h-full', isBroadcastTarget && 'border-l-2 border-primary')}>
      <div
        className="relative w-full h-full overflow-hidden p-3"
        style={{ backgroundColor: terminalBg }}
      >
        <div ref={containerRef} className="relative w-full h-full overflow-hidden" />

        {/* Command Hint Overlay */}
        <CommandHintOverlay
          terminal={terminal.current}
          sessionId={tab.sessionId!}
          currentRemotePath={currentRemotePath}
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

        {/* Connecting overlay — covers terminal until session is live */}
        <ConnectingOverlay
          visible={tab.status === 'connecting'}
          label={tab.label}
          isLocal={tab.reconnectConfig?.type === 'local'}
        />

        {/* Disconnect / error overlay — renders above the terminal */}
        <SessionStatusOverlay
          tab={tab}
          onReconnect={handleReconnect}
          onClose={() => closeTab(tab.tabId)}
        />
      </div>

      {/* Multi-line paste confirmation dialog */}
      <AlertDialog open={!!pendingPaste} onOpenChange={(open: boolean) => { if (!open) cancelPaste(); }}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Paste {pendingPaste?.lines} lines?</AlertDialogTitle>
            <AlertDialogDescription>
              Bracketed paste mode is off. Pasting multiple lines will execute commands immediately — one per line.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelPaste}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPaste}>Paste anyway</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

