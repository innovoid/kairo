import type { Tab } from '@/stores/session-store';
import type { PaneNode } from '@shared/types/pane';

export const SESSION_RECOVERY_STORAGE_KEY = 'archterm:session-recovery:v1';

export interface SessionRecoveryTabSnapshot {
  tabId: string;
  tabType: 'terminal' | 'sftp';
  label: string;
  hostId?: string;
  hostname?: string;
  sessionId?: string;
  paneTree?: PaneNode;
  reconnectConfig?: Tab['reconnectConfig'];
  reconnectAttempts?: number;
  disconnectReason?: string;
}

export interface SessionRecoverySnapshot {
  version: 1;
  workspaceId: string;
  activeTabId: string | null;
  tabs: SessionRecoveryTabSnapshot[];
  savedAt: number;
}

function isSessionTab(tab: Tab): tab is Tab & { tabType: 'terminal' | 'sftp' } {
  return tab.tabType === 'terminal' || tab.tabType === 'sftp';
}

function toSnapshotTab(tab: Tab): SessionRecoveryTabSnapshot | null {
  if (!isSessionTab(tab)) return null;
  return {
    tabId: tab.tabId,
    tabType: tab.tabType,
    label: tab.label,
    hostId: tab.hostId,
    hostname: tab.hostname,
    sessionId: tab.sessionId,
    paneTree: tab.paneTree,
    reconnectConfig: tab.reconnectConfig,
    reconnectAttempts: tab.reconnectAttempts,
    disconnectReason: tab.disconnectReason,
  };
}

export function createSessionRecoverySnapshot(
  tabs: Map<string, Tab>,
  activeTabId: string | null,
  workspaceId: string
): SessionRecoverySnapshot {
  const recoverableTabs = Array.from(tabs.values())
    .map(toSnapshotTab)
    .filter((tab): tab is SessionRecoveryTabSnapshot => tab !== null);

  return {
    version: 1,
    workspaceId,
    activeTabId,
    tabs: recoverableTabs,
    savedAt: Date.now(),
  };
}

export function saveSessionRecoverySnapshot(snapshot: SessionRecoverySnapshot): void {
  try {
    localStorage.setItem(SESSION_RECOVERY_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignore localStorage failures.
  }
}

export function clearSessionRecoverySnapshot(): void {
  try {
    localStorage.removeItem(SESSION_RECOVERY_STORAGE_KEY);
  } catch {
    // Ignore localStorage failures.
  }
}

function isValidSnapshot(raw: unknown): raw is SessionRecoverySnapshot {
  if (!raw || typeof raw !== 'object') return false;
  const candidate = raw as Partial<SessionRecoverySnapshot>;
  if (candidate.version !== 1) return false;
  if (typeof candidate.workspaceId !== 'string' || candidate.workspaceId.length === 0) return false;
  if (!Array.isArray(candidate.tabs)) return false;
  return true;
}

export function loadSessionRecoverySnapshot(): SessionRecoverySnapshot | null {
  try {
    const raw = localStorage.getItem(SESSION_RECOVERY_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isValidSnapshot(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function collectPaneSessionIds(node?: PaneNode): string[] {
  if (!node) return [];
  if (node.type === 'terminal') return [node.sessionId];
  return node.children.flatMap(collectPaneSessionIds);
}
