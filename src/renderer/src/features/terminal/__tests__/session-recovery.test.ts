import { beforeEach, describe, expect, it } from 'vitest';
import type { Tab } from '@/stores/session-store';
import {
  SESSION_RECOVERY_STORAGE_KEY,
  clearSessionRecoverySnapshot,
  collectPaneSessionIds,
  createSessionRecoverySnapshot,
  loadSessionRecoverySnapshot,
  saveSessionRecoverySnapshot,
} from '../session-recovery';

describe('session-recovery', () => {
  beforeEach(() => {
    localStorage.removeItem(SESSION_RECOVERY_STORAGE_KEY);
  });

  it('creates snapshot with terminal/sftp tabs only', () => {
    const tabs = new Map<string, Tab>([
      ['hosts', { tabId: 'hosts', tabType: 'hosts', label: 'Hosts', closable: false }],
      ['t1', { tabId: 't1', tabType: 'terminal', label: 'Prod', closable: true, sessionId: 'sid-1' }],
      ['s1', { tabId: 's1', tabType: 'sftp', label: 'SFTP: Prod', closable: true, sessionId: 'sid-1' }],
    ]);

    const snapshot = createSessionRecoverySnapshot(tabs, 't1', 'ws-1');

    expect(snapshot.workspaceId).toBe('ws-1');
    expect(snapshot.tabs).toHaveLength(2);
    expect(snapshot.tabs.map((tab) => tab.tabId)).toEqual(['t1', 's1']);
  });

  it('saves and loads a valid snapshot', () => {
    const snapshot = {
      version: 1 as const,
      workspaceId: 'ws-1',
      activeTabId: 't1',
      tabs: [{ tabId: 't1', tabType: 'terminal' as const, label: 'Prod', sessionId: 'sid-1' }],
      savedAt: Date.now(),
    };

    saveSessionRecoverySnapshot(snapshot);
    expect(loadSessionRecoverySnapshot()).toEqual(snapshot);
  });

  it('returns null for invalid snapshot payloads', () => {
    localStorage.setItem(SESSION_RECOVERY_STORAGE_KEY, JSON.stringify({ version: 2 }));
    expect(loadSessionRecoverySnapshot()).toBeNull();
  });

  it('collects pane session ids recursively', () => {
    const sessionIds = collectPaneSessionIds({
      type: 'split',
      direction: 'horizontal',
      sizes: [50, 50],
      children: [
        { type: 'terminal', sessionId: 'a' },
        {
          type: 'split',
          direction: 'vertical',
          sizes: [50, 50],
          children: [
            { type: 'terminal', sessionId: 'b' },
            { type: 'terminal', sessionId: 'c' },
          ],
        },
      ],
    });
    expect(sessionIds).toEqual(['a', 'b', 'c']);
  });

  it('clears stored snapshot', () => {
    localStorage.setItem(SESSION_RECOVERY_STORAGE_KEY, JSON.stringify({ version: 1, workspaceId: 'ws-1', tabs: [] }));
    clearSessionRecoverySnapshot();
    expect(localStorage.getItem(SESSION_RECOVERY_STORAGE_KEY)).toBeNull();
  });
});
