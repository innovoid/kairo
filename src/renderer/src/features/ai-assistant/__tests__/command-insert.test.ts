import { describe, it, expect } from 'vitest';
import { resolveActiveTerminalSessionId, sanitizeCommandForInsert } from '../command-insert';
import type { Tab } from '@/stores/session-store';

function buildTab(overrides: Partial<Tab>): Tab {
  return {
    tabId: overrides.tabId ?? 'tab-1',
    tabType: overrides.tabType ?? 'terminal',
    label: overrides.label ?? 'Test Tab',
    closable: overrides.closable ?? true,
    sessionId: overrides.sessionId,
  };
}

describe('command insert helpers', () => {
  it('resolves active terminal session id', () => {
    const tabs = new Map<string, Tab>([
      ['terminal-1', buildTab({ tabId: 'terminal-1', tabType: 'terminal', sessionId: 'session-1' })],
    ]);

    expect(resolveActiveTerminalSessionId(tabs, 'terminal-1')).toBe('session-1');
  });

  it('returns null for non-terminal active tab', () => {
    const tabs = new Map<string, Tab>([
      ['sftp-1', buildTab({ tabId: 'sftp-1', tabType: 'sftp', sessionId: 'session-1' })],
    ]);

    expect(resolveActiveTerminalSessionId(tabs, 'sftp-1')).toBeNull();
  });

  it('returns null when active tab is missing', () => {
    const tabs = new Map<string, Tab>();
    expect(resolveActiveTerminalSessionId(tabs, 'missing')).toBeNull();
    expect(resolveActiveTerminalSessionId(tabs, null)).toBeNull();
  });

  it('sanitizes shell prompt prefix from suggested command', () => {
    expect(sanitizeCommandForInsert('$ ls -la')).toBe('ls -la');
    expect(sanitizeCommandForInsert('   $ git status')).toBe('git status');
    expect(sanitizeCommandForInsert('echo "hello"')).toBe('echo "hello"');
  });
});
