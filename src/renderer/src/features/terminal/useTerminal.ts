import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SearchAddon } from '@xterm/addon-search';
import type { UserSettings } from '@shared/types/settings';
import { TERMINAL_THEMES } from '@shared/themes/terminal-themes';
import { useBroadcastStore } from '@/stores/broadcast-store';

interface UseTerminalOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
  sessionId: string;
  settings?: UserSettings | null;
}

export function useTerminal({ containerRef, sessionId, settings }: UseTerminalOptions) {
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Get the selected theme or fallback to dracula
    const themeName = settings?.terminalTheme ?? 'dracula';
    const selectedTheme = TERMINAL_THEMES[themeName]?.theme ?? TERMINAL_THEMES['dracula'].theme;

    const terminal = new Terminal({
      fontFamily: settings?.terminalFont ?? 'JetBrains Mono, Menlo, monospace',
      fontSize: settings?.terminalFontSize ?? 14,
      theme: selectedTheme,
      cursorBlink: true,
      cursorStyle: settings?.cursorStyle ?? 'bar',
      scrollback: settings?.scrollbackLines ?? 10000,
      lineHeight: settings?.lineHeight ?? 1.2,
      allowTransparency: false,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    const searchAddon = new SearchAddon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);
    terminal.loadAddon(searchAddon);
    terminal.open(containerRef.current);
    fitAddon.fit();

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;
    searchAddonRef.current = searchAddon;

    // Handle keyboard input
    const disposeOnData = terminal.onData((data) => {
      window.sshApi.send(sessionId, data);

      // Broadcast to other terminals if enabled
      const { enabled, targetSessionIds } = useBroadcastStore.getState();
      if (enabled) {
        for (const targetId of targetSessionIds) {
          if (targetId !== sessionId) {
            window.sshApi.send(targetId, data);
          }
        }
      }
    });

    // Resize observer
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      const { cols, rows } = terminal;
      window.sshApi.resize(sessionId, cols, rows);
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      disposeOnData.dispose();
      resizeObserver.disconnect();
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
      searchAddonRef.current = null;
    };
  }, [sessionId]);

  return { terminal: terminalRef, fitAddon: fitAddonRef, searchAddon: searchAddonRef };
}
