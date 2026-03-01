import { useEffect, useRef } from 'react';
import type { Terminal } from 'ghostty-web';
import { useSessionStore } from '@/stores/session-store';
import type { SessionConnectConfig } from '@shared/types/session';

interface UseSshSessionEventsOptions {
  sessionId: string;
  tabId: string;
  tabStatus?: string;
  terminalRef: React.RefObject<Terminal | null>;
  /** Original connect config — stored so the tab can reconnect later */
  reconnectConfig?: SessionConnectConfig;
  /** Callback when CWD is detected from OSC 7 escape sequence */
  onCwdChange?: (cwd: string) => void;
}

/** How long to wait before declaring a connecting session timed out in the UI */
const CONNECT_TIMEOUT_MS = 22_000;

/**
 * Subscribes to SSH IPC events (data, closed, error) for a single session
 * and forwards them to the terminal instance.
 * On disconnect/error, stores the reason + config in the tab for reconnect.
 */
export function useSshSessionEvents({
  sessionId,
  tabId,
  tabStatus,
  terminalRef,
  reconnectConfig,
  onCwdChange,
}: UseSshSessionEventsOptions): void {
  const { updateTabStatus, touchTabActivity, updateTabDisconnect } = useSessionStore();
  const connectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasConnectedRef = useRef(false);
  const lastActivityEmitRef = useRef(0);

  // Reset hasConnectedRef when sessionId changes
  useEffect(() => {
    hasConnectedRef.current = false;
    lastActivityEmitRef.current = 0;
  }, [sessionId]);

  // Connecting-phase timeout watchdog
  useEffect(() => {
    if (tabStatus !== 'connecting') {
      if (connectTimerRef.current) {
        clearTimeout(connectTimerRef.current);
        connectTimerRef.current = null;
      }
      return;
    }

    connectTimerRef.current = setTimeout(() => {
      const currentStatus = useSessionStore.getState().tabs.get(tabId)?.status;
      if (currentStatus === 'connecting') {
        terminalRef.current?.write('\r\n\x1b[31m✗ Connection timed out.\x1b[0m\r\n');
        updateTabDisconnect(tabId, 'Connection timed out.', reconnectConfig);
      }
    }, CONNECT_TIMEOUT_MS);

    return () => {
      if (connectTimerRef.current) {
        clearTimeout(connectTimerRef.current);
        connectTimerRef.current = null;
      }
    };
  }, [tabStatus, tabId, reconnectConfig, terminalRef, updateTabDisconnect]);

  // Stable listeners - only re-register when sessionId changes
  useEffect(() => {
    const offData = window.sshApi.onData((id, data) => {
      if (id !== sessionId || !terminalRef.current) return;

      // Write data to terminal
      terminalRef.current.write(data);

      // Record activity at most once every 5s to avoid noisy store updates.
      const now = Date.now();
      if (now - lastActivityEmitRef.current >= 5000) {
        touchTabActivity(tabId, now);
        lastActivityEmitRef.current = now;
      }

      // Parse OSC 7 for CWD detection
      if (onCwdChange) {
        const osc7Match = data.match(/\x1b\]7;file:\/\/([^\x07\x1b\\]+)\x07/);
        if (osc7Match) {
          const path = osc7Match[1];
          const cleanPath = path.includes('/') ? '/' + path.split('/').slice(2).join('/') : path;
          onCwdChange(cleanPath || '/');
        }
      }

      // Mark as connected on first data packet (only once)
      if (tabStatus === 'connecting' && !hasConnectedRef.current) {
        hasConnectedRef.current = true;
        terminalRef.current.scrollToBottom();
        updateTabStatus(tabId, 'connected');
        touchTabActivity(tabId);
      }
    });

    const offClosed = window.sshApi.onClosed((id) => {
      if (id !== sessionId) return;
      terminalRef.current?.write('\r\n\x1b[2m— connection closed —\x1b[0m\r\n');
      updateTabDisconnect(tabId, '', reconnectConfig);
    });

    const offError = window.sshApi.onError((id, error) => {
      if (id !== sessionId) return;
      terminalRef.current?.write(`\r\n\x1b[31m✗ ${error}\x1b[0m\r\n`);
      updateTabDisconnect(tabId, error, reconnectConfig);
    });

    return () => {
      offData();
      offClosed();
      offError();
    };
  }, [sessionId, tabId, tabStatus, updateTabStatus, touchTabActivity, updateTabDisconnect, reconnectConfig, terminalRef]);
}
