import { useEffect, useRef } from 'react';
import type { Terminal } from 'ghostty-web';
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
  replacementLine: string;
}

interface HintLine {
  text: string;
  tone?: 'muted' | 'header' | 'active';
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
  const suggestionsRef = useRef<HintSuggestion[]>([]);
  const activeSuggestionIndexRef = useRef(0);
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
        } else if (line.tone === 'active') {
          terminal.write(`\x1b[96m${line.text}\x1b[0m`);
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

  const clearSuggestions = () => {
    suggestionsRef.current = [];
    activeSuggestionIndexRef.current = 0;
    clearHintLines();
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
        text: `${snippet.command} · ${snippet.name}`,
        replacementLine: snippet.command,
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
        replacementLine: cmd,
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
          const replacementLine = line.slice(0, line.length - parsed.token.length) + fullPath;
          return {
            group: 'Context' as const,
            text: fullPath,
            replacementLine,
          };
        });
    } catch {
      return [];
    }
  };

  const renderGroupedSuggestions = (suggestions: HintSuggestion[], activeIndex: number) => {
    if (suggestions.length === 0) {
      clearSuggestions();
      return;
    }

    const groups: HintGroup[] = ['Snippets', 'History', 'Context'];
    const lines: HintLine[] = [{ text: 'Hints  ↑↓ navigate  Tab apply  Esc dismiss', tone: 'header' }];
    let index = 0;

    for (const group of groups) {
      const groupItems = suggestions.filter((item) => item.group === group);
      if (groupItems.length === 0) continue;

      lines.push({ text: `${group}:`, tone: 'header' });
      for (const item of groupItems) {
        const isActive = index === activeIndex;
        lines.push({ text: `${isActive ? '›' : ' '} ${item.text}`, tone: isActive ? 'active' : 'muted' });
        index += 1;
      }
    }

    renderHintLines(lines);
  };

  const setSuggestions = (suggestions: HintSuggestion[]) => {
    suggestionsRef.current = suggestions;
    if (suggestions.length === 0) {
      clearSuggestions();
      return;
    }

    if (activeSuggestionIndexRef.current >= suggestions.length) {
      activeSuggestionIndexRef.current = 0;
    }
    renderGroupedSuggestions(suggestions, activeSuggestionIndexRef.current);
  };

  const moveActiveSuggestion = (delta: number) => {
    const suggestions = suggestionsRef.current;
    if (suggestions.length === 0) return;
    const next =
      (activeSuggestionIndexRef.current + delta + suggestions.length) %
      suggestions.length;
    activeSuggestionIndexRef.current = next;
    renderGroupedSuggestions(suggestions, activeSuggestionIndexRef.current);
  };

  const applyActiveSuggestion = () => {
    if (!terminal) return false;
    const suggestions = suggestionsRef.current;
    if (suggestions.length === 0) return false;

    const selected = suggestions[activeSuggestionIndexRef.current];
    if (!selected) return false;

    const currentLine = inputBufferRef.current;
    const targetLine = selected.replacementLine;
    if (currentLine === targetLine) return false;

    let commonPrefixLength = 0;
    while (
      commonPrefixLength < currentLine.length &&
      commonPrefixLength < targetLine.length &&
      currentLine[commonPrefixLength] === targetLine[commonPrefixLength]
    ) {
      commonPrefixLength += 1;
    }

    const charsToDelete = currentLine.length - commonPrefixLength;
    if (charsToDelete > 0) {
      terminal.input('\x7f'.repeat(charsToDelete), true);
    }

    const charsToAdd = targetLine.slice(commonPrefixLength);
    if (charsToAdd) {
      terminal.input(charsToAdd, true);
    }

    inputBufferRef.current = targetLine;
    terminal.focus();
    activeSuggestionIndexRef.current = 0;
    return true;
  };

  const refreshHints = async () => {
    const token = ++refreshTokenRef.current;
    const line = inputBufferRef.current;

    if (!line.trim()) {
      clearSuggestions();
      return;
    }

    const snippetSuggestions = buildSnippetSuggestions(line);
    const historySuggestions = buildHistorySuggestions(line);
    const contextSuggestions = await buildContextSuggestions(line);

    if (token !== refreshTokenRef.current) return;

    setSuggestions([
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
        clearSuggestions();
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
        clearSuggestions();
        return false;
      }

      if (event.type !== 'keydown') {
        return false;
      }

      if (event.ctrlKey || event.metaKey || event.altKey) {
        return false;
      }

      if (event.key === 'Enter') {
        pushHistory(inputBufferRef.current);
        inputBufferRef.current = '';
        clearSuggestions();
        return false;
      }

      if (event.key === 'Backspace') {
        inputBufferRef.current = inputBufferRef.current.slice(0, -1);
        scheduleRefresh();
        return false;
      }

      if (event.key === 'Escape') {
        if (suggestionsRef.current.length > 0) {
          clearSuggestions();
          return true;
        }
        inputBufferRef.current = '';
        clearSuggestions();
        return false;
      }

      if (event.key === 'Tab') {
        if (applyActiveSuggestion()) {
          scheduleRefresh();
          return true;
        }
        return false;
      }

      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        if (suggestionsRef.current.length > 0) {
          moveActiveSuggestion(event.key === 'ArrowDown' ? 1 : -1);
          return true;
        }
        inputBufferRef.current = '';
        clearSuggestions();
        return false;
      }

      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        inputBufferRef.current = '';
        clearSuggestions();
        return false;
      }

      if (event.key.length === 1) {
        inputBufferRef.current += event.key;
        scheduleRefresh();
        return false;
      }

      return false;
    });

    return () => {
      document.removeEventListener('focusin', focusHandler);
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      clearSuggestions();
      terminal.attachCustomKeyEventHandler(() => false);
    };
  }, [terminal, sessionId, currentRemotePath]);

  return null;
}
