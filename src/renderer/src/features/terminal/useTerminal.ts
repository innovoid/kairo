import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SearchAddon } from '@xterm/addon-search';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { SerializeAddon } from '@xterm/addon-serialize';
import { ImageAddon } from '@xterm/addon-image';
import { WebglAddon } from '@xterm/addon-webgl';
import type { UserSettings } from '@shared/types/settings';
import { TERMINAL_THEMES } from '@shared/themes/terminal-themes';
import { useBroadcastStore } from '@/stores/broadcast-store';

// Map font names to proper CSS font families with fallbacks
function getFontFamily(fontName: string | undefined): string {
  const fontMap: Record<string, string> = {
    'JetBrains Mono': '"JetBrains Mono", monospace',
    'Fira Code': '"Fira Code", monospace',
    'Cascadia Code': '"Cascadia Code", monospace',
    'Source Code Pro': '"Source Code Pro", monospace',
    'Menlo': 'Menlo, monospace',
    'Monaco': 'Monaco, monospace',
    'SF Mono': '"SF Mono", monospace',
    'Consolas': 'Consolas, monospace',
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
    if (!containerRef.current) {
      console.error('[useTerminal] containerRef.current is null for session:', sessionId);
      return;
    }

    console.log('[useTerminal] Initializing terminal for session:', sessionId);

    let terminal: Terminal;
    let fitAddon: FitAddon;
    let searchAddon: SearchAddon;

    // Check if we already have a terminal instance for this session
    const cached = terminalCache.get(sessionId);

    if (cached) {
      // Reuse existing terminal
      console.log('[useTerminal] Reusing cached terminal for session:', sessionId);
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
      console.log('[useTerminal] Creating new terminal for session:', sessionId);
      const themeName = settings?.terminalTheme ?? 'dracula';
      const selectedTheme = TERMINAL_THEMES[themeName]?.theme ?? TERMINAL_THEMES['dracula'].theme;

      terminal = new Terminal({
        fontFamily: getFontFamily(settings?.terminalFont),
        fontSize: settings?.terminalFontSize ?? 13,
        theme: selectedTheme,
        cursorBlink: true,
        cursorStyle: settings?.cursorStyle ?? 'block',
        cursorInactiveStyle: 'outline',
        scrollback: settings?.scrollbackLines ?? 10000,
        allowTransparency: true,
        allowProposedApi: true,
        macOptionIsMeta: false,
        drawBoldTextInBrightColors: true,
        smoothScrollDuration: 0,
        fastScrollModifier: 'shift',
        fastScrollSensitivity: 5,
        scrollSensitivity: 3,
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
      console.log('[useTerminal] Terminal opened for session:', sessionId);
      terminal.focus();

      // Load WebGL renderer with fallback to DOM (like Superset)
      // Defer to requestAnimationFrame after xterm.open() to avoid race conditions
      requestAnimationFrame(() => {
        try {
          const webglAddon = new WebglAddon();
          webglAddon.onContextLoss(() => {
            console.warn('WebGL context lost, falling back to DOM renderer');
            webglAddon.dispose();
            terminal.refresh(0, terminal.rows - 1);
          });
          terminal.loadAddon(webglAddon);
        } catch (e) {
          console.warn('WebGL could not be loaded, using DOM renderer', e);
        }

        // Fit terminal after renderer is loaded
        const attemptFit = (attempt = 0) => {
          if (!containerRef.current) return;

          const containerWidth = containerRef.current.offsetWidth;
          const containerHeight = containerRef.current.offsetHeight;

          console.log('[useTerminal] Fit attempt', attempt, 'Container dimensions:', {
            width: containerWidth,
            height: containerHeight,
            sessionId
          });

          if (containerWidth > 0 && containerHeight > 0) {
            fitAddon.fit();
            const { cols, rows } = terminal;
            console.log('[useTerminal] Terminal fitted. Cols:', cols, 'Rows:', rows, 'Session:', sessionId);

            if (cols > 0 && rows > 5) { // Ensure we have at least 5 rows
              window.sshApi.resize(sessionId, cols, rows);
              console.log('[useTerminal] Resized SSH session:', sessionId);
            } else if (attempt < 5) {
              // Retry if dimensions are still invalid
              console.warn('[useTerminal] Invalid dimensions, retrying...', { cols, rows, attempt, sessionId });
              setTimeout(() => attemptFit(attempt + 1), 100);
            } else {
              console.error('[useTerminal] Failed to get valid dimensions after', attempt, 'attempts');
            }
          } else if (attempt < 5) {
            // Container not ready, retry
            console.warn('[useTerminal] Container not ready, retrying...', { attempt, sessionId });
            setTimeout(() => attemptFit(attempt + 1), 100);
          } else {
            console.error('[useTerminal] Container never became ready');
          }
        };

        attemptFit(0);
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
