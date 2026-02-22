import { useEffect, useRef } from 'react';
import type { Terminal } from '@xterm/xterm';
import type { Snippet } from '@shared/types/snippets';
import type { SftpEntry } from '@shared/types/sftp';
import { useSnippetStore } from '@/stores/snippet-store';
import { useWorkspaceStore } from '@/stores/workspace-store';

interface CommandHintOverlayProps {
  terminal: Terminal | null;
  sessionId: string;
  currentRemotePath?: string;
  hostId?: string;
  hostLabel?: string;
}

type HintGroup = 'Snippets' | 'History' | 'Context';

interface HintSuggestion {
  group: HintGroup;
  text: string;
}

interface HintLine {
  text: string;
  tone?: 'muted' | 'header';
}

const PATH_COMMANDS = new Set([
  'cd',
  'ls',
  'cat',
  'less',
  'more',
  'tail',
  'head',
  'nano',
  'vim',
  'vi',
  'rm',
  'cp',
  'mv',
  'mkdir',
  'rmdir',
  'touch',
  'chmod',
  'chown',
  'du',
  'find',
]);

const MAX_PER_GROUP = 4;
const HISTORY_LIMIT = 200;
const CONTEXT_CACHE_TTL_MS = 5000;

function normalizePath(pathValue: string): string {
  if (!pathValue) return '/';
  const collapsed = pathValue.replace(/\/+/, '/').replace(/\/+/g, '/');
  return collapsed || '/';
}

function getHistoryKey(sessionId: string, hostId?: string): string {
  return `archterm:terminal-history:${hostId ?? sessionId}`;
}

function loadHistory(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string');
  } catch {
    return [];
  }
}

function persistHistory(key: string, history: string[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(history.slice(0, HISTORY_LIMIT)));
  } catch {
    // Ignore localStorage write failures
  }
}

function splitPathQuery(
  token: string,
  currentRemotePath: string,
  commandAllowsPlainPath: boolean
): { listDir: string; prefix: string } | null {
  if (!token) {
    return commandAllowsPlainPath
      ? { listDir: currentRemotePath, prefix: '' }
      : null;
  }

  if (token.startsWith('/')) {
    if (token.endsWith('/')) {
      return { listDir: normalizePath(token), prefix: '' };
    }
    const idx = token.lastIndexOf('/');
    const listDir = idx <= 0 ? '/' : token.slice(0, idx);
    const prefix = token.slice(idx + 1);
    return { listDir: normalizePath(listDir), prefix };
  }

  if (token.startsWith('./')) {
    const relative = token.slice(2);
    if (!relative) return { listDir: currentRemotePath, prefix: '' };
    if (relative.endsWith('/')) {
      return { listDir: normalizePath(`${currentRemotePath}/${relative}`), prefix: '' };
    }
    const idx = relative.lastIndexOf('/');
    if (idx < 0) {
      return { listDir: currentRemotePath, prefix: relative };
    }
    return {
      listDir: normalizePath(`${currentRemotePath}/${relative.slice(0, idx)}`),
      prefix: relative.slice(idx + 1),
    };
  }

  if (token.startsWith('~/')) {
    const homeBase = currentRemotePath;
    const relative = token.slice(2);
    if (!relative) return { listDir: homeBase, prefix: '' };
    if (relative.endsWith('/')) {
      return { listDir: normalizePath(`${homeBase}/${relative}`), prefix: '' };
    }
    const idx = relative.lastIndexOf('/');
    if (idx < 0) {
      return { listDir: homeBase, prefix: relative };
    }
    return {
      listDir: normalizePath(`${homeBase}/${relative.slice(0, idx)}`),
      prefix: relative.slice(idx + 1),
    };
  }

  if (token.includes('/')) {
    if (token.endsWith('/')) {
      return { listDir: normalizePath(`${currentRemotePath}/${token}`), prefix: '' };
    }
    const idx = token.lastIndexOf('/');
    return {
      listDir: normalizePath(`${currentRemotePath}/${token.slice(0, idx)}`),
      prefix: token.slice(idx + 1),
    };
  }

  if (commandAllowsPlainPath) {
    return { listDir: currentRemotePath, prefix: token };
  }

  return null;
}

function parseContextToken(line: string): { token: string; commandAllowsPlainPath: boolean } | null {
  const rightTrimmed = line.replace(/\s+$/, '');
  if (!rightTrimmed) return null;

  const endsWithSpace = /\s$/.test(line);
  const parts = rightTrimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;

  const command = parts[0];
  const commandAllowsPlainPath = PATH_COMMANDS.has(command);
  const token = endsWithSpace ? '' : (parts[parts.length - 1] ?? '');

  const patternContext =
    token.startsWith('/') || token.startsWith('./') || token.startsWith('~/') || token.includes('/');

  if (!commandAllowsPlainPath && !patternContext) {
    return null;
  }

  return { token, commandAllowsPlainPath };
}

export function CommandHintOverlay({
  terminal,
  sessionId,
  currentRemotePath = '/home',
  hostId,
}: CommandHintOverlayProps) {
  const hintLineCountRef = useRef(0);
  const inputBufferRef = useRef('');
  const refreshTimerRef = useRef<number | null>(null);
  const refreshTokenRef = useRef(0);
  const historyRef = useRef<string[]>([]);
  const historyKeyRef = useRef('');
  const snippetsRef = useRef<Snippet[]>([]);
  const cacheRef = useRef<Record<string, { at: number; entries: SftpEntry[] }>>({});

  const workspaceId = useWorkspaceStore((s) => s.activeWorkspace?.id);
  const snippets = useSnippetStore((s) => s.snippets);
  const fetchSnippets = useSnippetStore((s) => s.fetchSnippets);

  useEffect(() => {
    snippetsRef.current = snippets;
  }, [snippets]);

  useEffect(() => {
    if (workspaceId) {
      void fetchSnippets(workspaceId);
    }
  }, [workspaceId, fetchSnippets]);

  useEffect(() => {
    const key = getHistoryKey(sessionId, hostId);
    historyKeyRef.current = key;
    historyRef.current = loadHistory(key);
  }, [sessionId, hostId]);

  const renderHintLines = (lines: HintLine[]) => {
    if (!terminal) return;

    const normalized = lines.filter((line) => line.text.trim().length > 0);
    const maxLines = Math.max(hintLineCountRef.current, normalized.length);

    terminal.write('\x1b7');

    for (let i = 0; i < maxLines; i += 1) {
      terminal.write('\x1b[B\r\x1b[2K');
      if (i < normalized.length) {
        const line = normalized[i];
        if (line.tone === 'header') {
          terminal.write(`\x1b[37m${line.text}\x1b[0m`);
        } else {
          terminal.write(`\x1b[90m${line.text}\x1b[0m`);
        }
      }
    }

    hintLineCountRef.current = normalized.length;
    terminal.write('\x1b8');
  };

  const clearHintLines = () => {
    if (hintLineCountRef.current === 0) return;
    renderHintLines([]);
  };

  const pushHistory = (line: string) => {
    const command = line.trim();
    if (!command) return;

    const existing = historyRef.current.filter((item) => item !== command);
    historyRef.current = [command, ...existing].slice(0, HISTORY_LIMIT);
    persistHistory(historyKeyRef.current, historyRef.current);
  };

  const buildSnippetSuggestions = (line: string): HintSuggestion[] => {
    const query = line.trim().toLowerCase();
    if (!query) return [];

    return snippetsRef.current
      .filter((snippet) => {
        const nameMatch = snippet.name.toLowerCase().includes(query);
        const commandMatch = snippet.command.toLowerCase().includes(query);
        return nameMatch || commandMatch;
      })
      .slice(0, MAX_PER_GROUP)
      .map((snippet) => ({
        group: 'Snippets' as const,
        text: `${snippet.command}  (${snippet.name})`,
      }));
  };

  const buildHistorySuggestions = (line: string): HintSuggestion[] => {
    const query = line.trim().toLowerCase();
    if (!query) return [];

    return historyRef.current
      .filter((cmd) => cmd.toLowerCase().includes(query) && cmd !== line.trim())
      .slice(0, MAX_PER_GROUP)
      .map((cmd) => ({
        group: 'History' as const,
        text: cmd,
      }));
  };

  const listContextEntries = async (listDir: string): Promise<SftpEntry[]> => {
    const cached = cacheRef.current[listDir];
    if (cached && Date.now() - cached.at < CONTEXT_CACHE_TTL_MS) {
      return cached.entries;
    }

    const entries = await window.sftpApi.list(sessionId, listDir);
    cacheRef.current[listDir] = { at: Date.now(), entries };
    return entries;
  };

  const buildContextSuggestions = async (line: string): Promise<HintSuggestion[]> => {
    const parsed = parseContextToken(line);
    if (!parsed) return [];

    const split = splitPathQuery(parsed.token, currentRemotePath, parsed.commandAllowsPlainPath);
    if (!split) return [];

    try {
      const entries = await listContextEntries(split.listDir);
      const prefixLower = split.prefix.toLowerCase();

      return entries
        .filter((entry) => entry.name.toLowerCase().startsWith(prefixLower))
        .slice(0, MAX_PER_GROUP)
        .map((entry) => {
          const suffix = entry.type === 'directory' ? '/' : '';
          const fullPath = split.listDir === '/'
            ? `/${entry.name}${suffix}`
            : `${split.listDir}/${entry.name}${suffix}`;
          return {
            group: 'Context' as const,
            text: fullPath,
          };
        });
    } catch {
      return [];
    }
  };

  const renderGroupedSuggestions = (suggestions: HintSuggestion[]) => {
    if (suggestions.length === 0) {
      clearHintLines();
      return;
    }

    const groups: HintGroup[] = ['Snippets', 'History', 'Context'];
    const lines: HintLine[] = [{ text: 'Hints', tone: 'header' }];

    for (const group of groups) {
      const groupItems = suggestions.filter((item) => item.group === group);
      if (groupItems.length === 0) continue;

      lines.push({ text: `${group}:`, tone: 'header' });
      for (const item of groupItems) {
        lines.push({ text: `  ${item.text}`, tone: 'muted' });
      }
    }

    renderHintLines(lines);
  };

  const refreshHints = async () => {
    const token = ++refreshTokenRef.current;
    const line = inputBufferRef.current;

    if (!line.trim()) {
      clearHintLines();
      return;
    }

    const snippetSuggestions = buildSnippetSuggestions(line);
    const historySuggestions = buildHistorySuggestions(line);
    const contextSuggestions = await buildContextSuggestions(line);

    if (token !== refreshTokenRef.current) return;

    renderGroupedSuggestions([
      ...snippetSuggestions,
      ...historySuggestions,
      ...contextSuggestions,
    ]);
  };

  const scheduleRefresh = () => {
    if (refreshTimerRef.current) {
      window.clearTimeout(refreshTimerRef.current);
    }
    refreshTimerRef.current = window.setTimeout(() => {
      void refreshHints();
    }, 120);
  };

  useEffect(() => {
    if (!terminal) return;

    const focusHandler = () => {
      const activeElement = document.activeElement as HTMLElement | null;
      const terminalElement = terminal.element as HTMLElement | undefined;
      const terminalHasFocus = Boolean(
        terminalElement &&
          activeElement &&
          (terminalElement === activeElement || terminalElement.contains(activeElement))
      );

      if (!terminalHasFocus) {
        clearHintLines();
      }
    };

    document.addEventListener('focusin', focusHandler);

    terminal.attachCustomKeyEventHandler((event: KeyboardEvent) => {
      const activeElement = document.activeElement as HTMLElement | null;
      const terminalElement = terminal.element as HTMLElement | undefined;
      const terminalHasFocus = Boolean(
        terminalElement &&
          activeElement &&
          (terminalElement === activeElement || terminalElement.contains(activeElement))
      );

      if (!terminalHasFocus) {
        clearHintLines();
        return true;
      }

      if (event.type !== 'keydown') {
        return true;
      }

      if (event.ctrlKey || event.metaKey || event.altKey) {
        return true;
      }

      if (event.key === 'Enter') {
        pushHistory(inputBufferRef.current);
        inputBufferRef.current = '';
        clearHintLines();
        return true;
      }

      if (event.key === 'Backspace') {
        inputBufferRef.current = inputBufferRef.current.slice(0, -1);
        scheduleRefresh();
        return true;
      }

      if (event.key === 'Escape') {
        inputBufferRef.current = '';
        clearHintLines();
        return true;
      }

      if (
        event.key === 'ArrowUp' ||
        event.key === 'ArrowDown' ||
        event.key === 'ArrowLeft' ||
        event.key === 'ArrowRight'
      ) {
        inputBufferRef.current = '';
        clearHintLines();
        return true;
      }

      if (event.key.length === 1) {
        inputBufferRef.current += event.key;
        scheduleRefresh();
        return true;
      }

      return true;
    });

    return () => {
      document.removeEventListener('focusin', focusHandler);
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      clearHintLines();
      terminal.attachCustomKeyEventHandler(() => true);
    };
  }, [terminal, sessionId, currentRemotePath]);

  return null;
}
