import { useEffect, useRef } from 'react';
import { FitAddon, Terminal } from 'ghostty-web';
import type { UserSettings } from '@shared/types/settings';
import { TERMINAL_THEMES } from '@shared/themes/terminal-themes';
import { useBroadcastStore } from '@/stores/broadcast-store';
import { ensureGhosttyInitialized } from './ghostty-runtime';
import { TerminalSearchController } from './terminal-search';

// Map font names to proper CSS font families with fallbacks
function getFontFamily(fontName: string | undefined): string {
  const fontMap: Record<string, string> = {
    'JetBrains Mono': '"JetBrains Mono", monospace',
    'Fira Code': '"Fira Code", monospace',
    'Cascadia Code': '"Cascadia Code", monospace',
    'Source Code Pro': '"Source Code Pro", monospace',
    Menlo: 'Menlo, monospace',
    Monaco: 'Monaco, monospace',
    'SF Mono': '"SF Mono", monospace',
    Consolas: 'Consolas, monospace',
    'Courier New': '"Courier New", monospace',
  };

  return fontMap[fontName || ''] || '"JetBrains Mono", monospace';
}

interface UseTerminalOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
  sessionId: string;
  settings?: UserSettings | null;
  isVisible?: boolean;
}

interface TerminalCacheEntry {
  terminal: Terminal;
  fitAddon: FitAddon;
  searchAddon: TerminalSearchController;
}

// Module-level storage for terminal instances
const terminalCache = new Map<string, TerminalCacheEntry>();

function suppressNativeInputCaret(terminal: Terminal): void {
  const textarea = terminal.textarea;
  if (!textarea) return;
  textarea.setAttribute('data-no-focus-ring', 'true');
  textarea.style.caretColor = 'transparent';
  textarea.style.outline = 'none';
  textarea.style.boxShadow = 'none';
  textarea.style.border = 'none';
  textarea.style.background = 'transparent';
}

function suppressTerminalFocusChrome(terminal: Terminal): void {
  const host = terminal.element;
  if (!host) return;
  host.setAttribute('data-no-focus-ring', 'true');
  host.style.outline = 'none';
  host.style.boxShadow = 'none';
  host.style.border = 'none';
}

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
  const searchAddonRef = useRef<TerminalSearchController | null>(null);

  useEffect(() => {
    let disposed = false;
    let selectionDisposable: { dispose: () => void } | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let pasteTarget: HTMLDivElement | null = null;
    let pasteHandler: ((event: ClipboardEvent) => void) | null = null;

    const applyCopyOnSelect = (terminal: Terminal) => {
      if (!settings?.copyOnSelect) return;
      selectionDisposable = terminal.onSelectionChange(() => {
        const selection = terminal.getSelection();
        if (selection) {
          void navigator.clipboard.writeText(selection).catch(() => {});
        }
      });
    };

    const applyPasteGuard = (terminal: Terminal) => {
      if (!containerRef.current) return;
      pasteTarget = containerRef.current;
      pasteHandler = (event: ClipboardEvent) => {
        const text = event.clipboardData?.getData('text');
        if (text && text.includes('\n')) {
          event.preventDefault();
          const lines = text.split('\n').length;
          if (confirm(`You're about to paste ${lines} lines. This will execute commands immediately. Continue?`)) {
            terminal.paste(text);
          }
        }
      };
      pasteTarget.addEventListener('paste', pasteHandler);
    };

    const applyResizeObserver = (terminal: Terminal, fitAddon: FitAddon) => {
      if (!containerRef.current) return;
      resizeObserver = new ResizeObserver(() => {
        if (
          !isVisible ||
          !containerRef.current ||
          containerRef.current.offsetWidth === 0 ||
          containerRef.current.offsetHeight === 0
        ) {
          return;
        }

        fitAddon.fit();
        const { cols, rows } = terminal;
        if (cols > 0 && rows > 0) {
          window.sshApi.resize(sessionId, cols, rows);
        }
      });
      resizeObserver.observe(containerRef.current);
    };

    const attachSessionTerminal = (entry: TerminalCacheEntry) => {
      if (!containerRef.current || disposed) return;

      const { terminal, fitAddon, searchAddon } = entry;
      // ghostty-web stores the parent container itself as terminal.element.
      // Avoid appending when we're already attached to this exact node.
      if (
        terminal.element &&
        terminal.element !== containerRef.current &&
        !terminal.element.contains(containerRef.current) &&
        !containerRef.current.contains(terminal.element)
      ) {
        containerRef.current.appendChild(terminal.element);
      }
      suppressNativeInputCaret(terminal);
      suppressTerminalFocusChrome(terminal);
      terminal.focus();

      requestAnimationFrame(() => {
        if (!containerRef.current || disposed || containerRef.current.offsetWidth === 0) return;
        fitAddon.fit();
        const { cols, rows } = terminal;
        if (cols > 0 && rows > 0) {
          window.sshApi.resize(sessionId, cols, rows);
        }
      });

      terminalRef.current = terminal;
      fitAddonRef.current = fitAddon;
      searchAddonRef.current = searchAddon;

      applyCopyOnSelect(terminal);
      applyPasteGuard(terminal);
      applyResizeObserver(terminal, fitAddon);
    };

    const setup = async () => {
      if (!containerRef.current || disposed) return;

      const cached = terminalCache.get(sessionId);
      if (cached) {
        attachSessionTerminal(cached);
        return;
      }

      const themeName = settings?.terminalTheme ?? 'dracula';
      const selectedTheme = TERMINAL_THEMES[themeName]?.theme ?? TERMINAL_THEMES.dracula.theme;

      await ensureGhosttyInitialized();
      if (!containerRef.current || disposed) return;

      const terminal = new Terminal({
        fontFamily: getFontFamily(settings?.terminalFont),
        fontSize: settings?.terminalFontSize ?? 13,
        theme: selectedTheme,
        cursorBlink: true,
        cursorStyle: settings?.cursorStyle ?? 'block',
        scrollback: settings?.scrollbackLines ?? 10000,
        allowTransparency: true,
        smoothScrollDuration: 0,
      });

      const fitAddon = new FitAddon();
      const searchAddon = new TerminalSearchController(terminal);
      terminal.loadAddon(fitAddon);

      terminal.open(containerRef.current);
      suppressNativeInputCaret(terminal);
      suppressTerminalFocusChrome(terminal);
      terminal.focus();

      requestAnimationFrame(() => {
        if (!containerRef.current || disposed) return;
        const { offsetWidth, offsetHeight } = containerRef.current;
        if (offsetWidth === 0 || offsetHeight === 0) return;

        fitAddon.fit();
        const { cols, rows } = terminal;
        if (cols > 0 && rows > 0) {
          window.sshApi.resize(sessionId, cols, rows);
        }
      });

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

      const entry = { terminal, fitAddon, searchAddon };
      terminalCache.set(sessionId, entry);
      attachSessionTerminal(entry);
    };

    void setup();

    return () => {
      disposed = true;
      selectionDisposable?.dispose();

      if (pasteTarget && pasteHandler) {
        pasteTarget.removeEventListener('paste', pasteHandler);
      }
      resizeObserver?.disconnect();

      const terminal = terminalRef.current;
      // ghostty-web terminal.element is the parent container; never remove
      // the React-owned container node during cleanup.
      if (terminal?.element && terminal.element !== containerRef.current && terminal.element.parentElement) {
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
