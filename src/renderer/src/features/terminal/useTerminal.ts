import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SearchAddon } from '@xterm/addon-search';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { SerializeAddon } from '@xterm/addon-serialize';
import { ImageAddon } from '@xterm/addon-image';
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
    const unicode11Addon = new Unicode11Addon();
    const serializeAddon = new SerializeAddon();
    const imageAddon = new ImageAddon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);
    terminal.loadAddon(searchAddon);
    terminal.loadAddon(unicode11Addon);
    terminal.loadAddon(serializeAddon);
    terminal.loadAddon(imageAddon);

    // Enable Unicode 11 support
    terminal.unicode.activeVersion = '11';

    terminal.open(containerRef.current);
    fitAddon.fit();

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;
    searchAddonRef.current = searchAddon;

    // Copy-on-select functionality
    let disposeOnSelectionChange: { dispose: () => void } | null = null;
    if (settings?.copyOnSelect) {
      disposeOnSelectionChange = terminal.onSelectionChange(() => {
        const selection = terminal.getSelection();
        if (selection) {
          navigator.clipboard.writeText(selection);
        }
      });
    }

    // Multi-line paste warning
    const handlePaste = (event: ClipboardEvent) => {
      const text = event.clipboardData?.getData('text');
      if (text && text.includes('\n')) {
        event.preventDefault();
        const lines = text.split('\n').length;
        if (confirm(`You're about to paste ${lines} lines. This will execute commands immediately. Continue?`)) {
          terminal.paste(text);
        }
      }
    };
    containerRef.current.addEventListener('paste', handlePaste);

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
      disposeOnSelectionChange?.dispose();
      containerRef.current?.removeEventListener('paste', handlePaste);
      resizeObserver.disconnect();
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
      searchAddonRef.current = null;
    };
  }, [sessionId]);

  return { terminal: terminalRef, fitAddon: fitAddonRef, searchAddon: searchAddonRef };
}
