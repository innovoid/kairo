import type { Tab } from '@/stores/session-store';

export function resolveActiveTerminalSessionId(
  tabs: Map<string, Tab>,
  activeTabId: string | null
): string | null {
  if (!activeTabId) return null;
  const tab = tabs.get(activeTabId);
  if (!tab || tab.tabType !== 'terminal' || !tab.sessionId) return null;
  return tab.sessionId;
}

export function sanitizeCommandForInsert(command: string): string {
  return command.replace(/^\s*\$?\s*/, '').trimStart();
}
