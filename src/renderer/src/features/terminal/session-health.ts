import type { SshSessionStatus } from '@shared/types/ssh';

export type KeepaliveState = 'healthy' | 'degraded' | 'failed' | 'unknown';

export interface SessionHealthInput {
  status?: SshSessionStatus;
  disconnectReason?: string;
  lastActivityAt?: number;
  now?: number;
  staleAfterMs?: number;
}

const DEFAULT_STALE_AFTER_MS = 45_000;

export function isKeepaliveDisconnect(reason?: string): boolean {
  if (!reason) return false;
  const normalized = reason.toLowerCase();
  return (
    normalized.includes('keepalive')
    || normalized.includes('keep alive')
    || normalized.includes('keep-alive')
  );
}

export function deriveKeepaliveState({
  status,
  disconnectReason,
  lastActivityAt,
  now = Date.now(),
  staleAfterMs = DEFAULT_STALE_AFTER_MS,
}: SessionHealthInput): KeepaliveState {
  if (status === 'disconnected' || status === 'error') {
    return isKeepaliveDisconnect(disconnectReason) ? 'failed' : 'unknown';
  }

  if (status !== 'connected') {
    return 'unknown';
  }

  if (!lastActivityAt) {
    return 'unknown';
  }

  return now - lastActivityAt > staleAfterMs ? 'degraded' : 'healthy';
}

export function formatAge(timestamp?: number, now = Date.now()): string {
  if (!timestamp) return 'n/a';
  const diff = Math.max(0, now - timestamp);
  const seconds = Math.floor(diff / 1000);
  if (seconds < 1) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function formatLatency(ms?: number): string {
  if (!Number.isFinite(ms) || ms === undefined || ms < 0) return 'n/a';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}
