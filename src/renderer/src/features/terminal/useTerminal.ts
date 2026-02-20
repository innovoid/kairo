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

// Module-level map to store terminal instances across component unmounts
// This allows sessions to persist when tabs are switched but not closed
const terminalInstances = new Map<string, {
  terminal: Terminal;
  fitAddon: FitAddon;
  searchAddon: SearchAddon;
}>();

// Cleanup function to dispose terminal instance and disconnect PTY session
// Call this when a tab is explicitly closed
export function disposeTerminalSession(sessionId: string): void {
  const instance = terminalInstances.get(sessionId);
  if (instance) {
    instance.terminal.dispose();
    terminalInstances.delete(sessionId);
  }
  // Disconnect PTY session
  window.sshApi.disconnect(sessionId);
}

export function useTerminal({ containerRef, sessionId, settings, isVisible = true }: UseTerminalOptions) {
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const disposeOnDataRef = useRef<{ dispose: () => void } | null>(null);
  const disposeOnSelectionChangeRef = useRef<{ dispose: () => void } | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const pasteHandlerRef = useRef<((e: ClipboardEvent) => void) | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Check if terminal instance already exists (from previous mount)
    const existingInstance = terminalInstances.get(sessionId);
    if (existingInstance && containerRef.current) {
      // Reuse existing terminal instance
      const { terminal, fitAddon, searchAddon } = existingInstance;

      // Re-attach to DOM
      terminal.open(containerRef.current);

      terminalRef.current = terminal;
      fitAddonRef.current = fitAddon;
      searchAddonRef.current = searchAddon;

      // Refit after reattaching
      requestAnimationFrame(() => {
        if (containerRef.current && containerRef.current.offsetWidth > 0) {
          fitAddon.fit();
          const { cols, rows } = terminal;
          if (cols > 0 && rows > 0) {
            window.sshApi.resize(sessionId, cols, rows);
          }
        }
      });
    } else {
      // Create new terminal instance

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
        allowProposedApi: true,
        letterSpacing: 0,
        fontWeight: 'normal',
        fontWeightBold: 'bold',
        rendererType: 'canvas', // Use canvas renderer instead of webgl for better compatibility
        drawBoldTextInBrightColors: true,
        macOptionIsMeta: false, // Allows Option+key for international keyboards
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

      // Use requestAnimationFrame to ensure the terminal is rendered before fitting
      // This helps with character width calculations and font rendering
      requestAnimationFrame(() => {
        if (containerRef.current && containerRef.current.offsetWidth > 0) {
          fitAddon.fit();
          const { cols, rows } = terminal;
          if (cols > 0 && rows > 0) {
            window.sshApi.resize(sessionId, cols, rows);
          }
        }
      });

      terminalRef.current = terminal;
      fitAddonRef.current = fitAddon;
      searchAddonRef.current = searchAddon;

      // Store instance for reuse
      terminalInstances.set(sessionId, { terminal, fitAddon, searchAddon });
    }

    // Setup event listeners (only if not already setup or if settings changed)
    const terminal = terminalRef.current!;

    // Copy-on-select functionality
    if (disposeOnSelectionChangeRef.current) {
      disposeOnSelectionChangeRef.current.dispose();
      disposeOnSelectionChangeRef.current = null;
    }
    if (settings?.copyOnSelect) {
      disposeOnSelectionChangeRef.current = terminal.onSelectionChange(() => {
        const selection = terminal.getSelection();
        if (selection) {
          navigator.clipboard.writeText(selection);
        }
      });
    }

    // Multi-line paste warning
    if (pasteHandlerRef.current && containerRef.current) {
      containerRef.current.removeEventListener('paste', pasteHandlerRef.current);
    }
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
    pasteHandlerRef.current = handlePaste;
    if (containerRef.current) {
      containerRef.current.addEventListener('paste', handlePaste);
    }

    // Handle keyboard input (setup once per terminal instance)
    if (!disposeOnDataRef.current) {
      disposeOnDataRef.current = terminal.onData((data) => {
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
    }

    // Resize observer (recreate on mount to observe current container)
    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect();
    }
    resizeObserverRef.current = new ResizeObserver(() => {
      // Skip resize if not visible or container has no dimensions
      if (!isVisible || !containerRef.current || containerRef.current.offsetWidth === 0 || containerRef.current.offsetHeight === 0) {
        return;
      }

      const fitAddon = fitAddonRef.current;
      const terminal = terminalRef.current;
      if (!fitAddon || !terminal) return;

      fitAddon.fit();
      const { cols, rows } = terminal;

      // Only resize PTY if we have valid dimensions
      if (cols > 0 && rows > 0) {
        window.sshApi.resize(sessionId, cols, rows);
      }
    });
    if (containerRef.current) {
      resizeObserverRef.current.observe(containerRef.current);
    }

    return () => {
      // Cleanup event listeners
      if (disposeOnSelectionChangeRef.current) {
        disposeOnSelectionChangeRef.current.dispose();
        disposeOnSelectionChangeRef.current = null;
      }
      if (pasteHandlerRef.current && containerRef.current) {
        containerRef.current.removeEventListener('paste', pasteHandlerRef.current);
      }
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }

      // IMPORTANT: Only detach from DOM, don't dispose the terminal instance
      // The terminal instance is kept alive in terminalInstances map for reuse
      // The PTY session continues running in the background
      const terminal = terminalRef.current;
      if (terminal && terminal.element) {
        // Remove from DOM but keep terminal instance alive
        terminal.element.remove();
      }

      // Clear refs but don't dispose
      terminalRef.current = null;
      fitAddonRef.current = null;
      searchAddonRef.current = null;
    };
  }, [sessionId]);

  // Handle visibility changes - refit terminal when tab becomes visible
  useEffect(() => {
    if (isVisible && terminalRef.current && fitAddonRef.current && containerRef.current) {
      // Use requestAnimationFrame to ensure DOM has updated
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
