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
  isVisible?: boolean;
}

// Module-level storage for terminal instances
const terminalCache = new Map<string, {
  terminal: Terminal;
  fitAddon: FitAddon;
  searchAddon: SearchAddon;
}>();

// Cleanup function to disconnect PTY session and dispose terminal
export function disposeTerminalSession(sessionId: string): void {
  const cached = terminalCache.get(sessionId);
  if (cached) {
    cached.terminal.dispose();
    terminalCache.delete(sessionId);
  }
  window.sshApi.disconnect(sessionId);
}

export function useTerminal({ containerRef, sessionId, settings, isVisible = true }: UseTerminalOptions) {
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let terminal: Terminal;
    let fitAddon: FitAddon;
    let searchAddon: SearchAddon;

    // Check if we already have a terminal instance for this session
    const cached = terminalCache.get(sessionId);

    if (cached) {
      // Reuse existing terminal
      terminal = cached.terminal;
      fitAddon = cached.fitAddon;
      searchAddon = cached.searchAddon;

      // Attach to new container
      if (terminal.element) {
        containerRef.current.appendChild(terminal.element);
        terminal.focus();

        // Refit
        requestAnimationFrame(() => {
          if (containerRef.current && containerRef.current.offsetWidth > 0) {
            fitAddon.fit();
            const { cols, rows } = terminal;
            if (cols > 0 && rows > 0) {
              window.sshApi.resize(sessionId, cols, rows);
            }
          }
        });
      }
    } else {
      // Create new terminal
      const themeName = settings?.terminalTheme ?? 'dracula';
      const selectedTheme = TERMINAL_THEMES[themeName]?.theme ?? TERMINAL_THEMES['dracula'].theme;

      terminal = new Terminal({
        fontFamily: settings?.terminalFont ?? 'JetBrains Mono, Menlo, monospace',
        fontSize: settings?.terminalFontSize ?? 14,
        theme: selectedTheme,
        cursorBlink: true,
        cursorStyle: settings?.cursorStyle ?? 'bar',
        scrollback: settings?.scrollbackLines ?? 10000,
        lineHeight: settings?.lineHeight ?? 1.2,
        allowTransparency: false,
        allowProposedApi: true,
        letterSpacing: 0,
        fontWeight: 'normal',
        fontWeightBold: 'bold',
        rendererType: 'canvas',
        drawBoldTextInBrightColors: true,
        macOptionIsMeta: false,
      });

      fitAddon = new FitAddon();
      const webLinksAddon = new WebLinksAddon();
      searchAddon = new SearchAddon();
      const unicode11Addon = new Unicode11Addon();
      const serializeAddon = new SerializeAddon();
      const imageAddon = new ImageAddon();

      terminal.loadAddon(fitAddon);
      terminal.loadAddon(webLinksAddon);
      terminal.loadAddon(searchAddon);
      terminal.loadAddon(unicode11Addon);
      terminal.loadAddon(serializeAddon);
      terminal.loadAddon(imageAddon);

      terminal.unicode.activeVersion = '11';

      terminal.open(containerRef.current);
      terminal.focus();

      requestAnimationFrame(() => {
        if (containerRef.current && containerRef.current.offsetWidth > 0) {
          fitAddon.fit();
          const { cols, rows } = terminal;
          if (cols > 0 && rows > 0) {
            window.sshApi.resize(sessionId, cols, rows);
          }
        }
      });

      // Handle keyboard input
      terminal.onData((data) => {
        window.sshApi.send(sessionId, data);

        const { enabled, targetSessionIds } = useBroadcastStore.getState();
        if (enabled) {
          for (const targetId of targetSessionIds) {
            if (targetId !== sessionId) {
              window.sshApi.send(targetId, data);
            }
          }
        }
      });

      // Store in cache
      terminalCache.set(sessionId, { terminal, fitAddon, searchAddon });
    }

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

    // Resize observer
    const resizeObserver = new ResizeObserver(() => {
      if (!isVisible || !containerRef.current || containerRef.current.offsetWidth === 0 || containerRef.current.offsetHeight === 0) {
        return;
      }

      fitAddon.fit();
      const { cols, rows } = terminal;

      if (cols > 0 && rows > 0) {
        window.sshApi.resize(sessionId, cols, rows);
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      disposeOnSelectionChange?.dispose();
      containerRef.current?.removeEventListener('paste', handlePaste);
      resizeObserver.disconnect();

      // Detach from DOM but keep terminal alive
      if (terminal.element && terminal.element.parentElement) {
        terminal.element.remove();
      }

      terminalRef.current = null;
      fitAddonRef.current = null;
      searchAddonRef.current = null;
    };
  }, [sessionId, settings?.copyOnSelect]);

  // Focus terminal when tab becomes visible
  useEffect(() => {
    if (isVisible && terminalRef.current && fitAddonRef.current && containerRef.current) {
      terminalRef.current.focus();

      requestAnimationFrame(() => {
        if (containerRef.current && containerRef.current.offsetWidth > 0) {
          fitAddonRef.current?.fit();
          const { cols, rows } = terminalRef.current!;
          if (cols > 0 && rows > 0) {
            window.sshApi.resize(sessionId, cols, rows);
          }
        }
      });
    }
  }, [isVisible, sessionId]);

  return { terminal: terminalRef, fitAddon: fitAddonRef, searchAddon: searchAddonRef };
}
