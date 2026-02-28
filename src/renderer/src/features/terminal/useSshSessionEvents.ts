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
}: UseSshSessionEventsOptions): void {
  const { updateTabStatus, updateTabDisconnect } = useSessionStore();
  const connectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      // Only fire if still connecting
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

  useEffect(() => {
    const offData = window.sshApi.onData((id, data) => {
      if (id === sessionId && terminalRef.current) {
        terminalRef.current.write(data);
      }
    });

    const offClosed = window.sshApi.onClosed((id) => {
      if (id !== sessionId) return;
      // Write a subtle inline message — the overlay takes over from here
      terminalRef.current?.write('\r\n\x1b[2m— connection closed —\x1b[0m\r\n');
      updateTabDisconnect(tabId, '', reconnectConfig);
    });

    const offError = window.sshApi.onError((id, error) => {
      if (id !== sessionId) return;
      terminalRef.current?.write(`\r\n\x1b[31m✗ ${error}\x1b[0m\r\n`);
      updateTabDisconnect(tabId, error, reconnectConfig);
    });

    // Mark as connected on first data packet
    const offDataForStatus = window.sshApi.onData((id) => {
      if (id === sessionId && tabStatus === 'connecting') {
        updateTabStatus(tabId, 'connected');
      }
    });

    return () => {
      offData();
      offClosed();
      offError();
      offDataForStatus();
    };
  }, [sessionId, tabId, tabStatus, updateTabStatus, updateTabDisconnect, reconnectConfig, terminalRef]);
}
