import { describe, expect, it } from 'vitest';
import { deriveKeepaliveState, formatAge, formatLatency, isKeepaliveDisconnect } from '../session-health';

describe('session-health', () => {
  it('detects keepalive disconnect reasons', () => {
    expect(isKeepaliveDisconnect('Keepalive timeout after idle period')).toBe(true);
    expect(isKeepaliveDisconnect('Disconnected by peer')).toBe(false);
  });

  it('derives keepalive state from status and recency', () => {
    const now = 1_700_000_000_000;

    expect(
      deriveKeepaliveState({
        status: 'connected',
        lastActivityAt: now - 5000,
        now,
      })
    ).toBe('healthy');

    expect(
      deriveKeepaliveState({
        status: 'connected',
        lastActivityAt: now - 60_000,
        now,
      })
    ).toBe('degraded');

    expect(
      deriveKeepaliveState({
        status: 'disconnected',
        disconnectReason: 'keepalive failed',
        now,
      })
    ).toBe('failed');
  });

  it('formats latency and activity age values', () => {
    const now = 1_700_000_000_000;

    expect(formatLatency(12)).toBe('12ms');
    expect(formatLatency(1100)).toBe('1.10s');
    expect(formatLatency(undefined)).toBe('n/a');

    expect(formatAge(now - 800, now)).toBe('just now');
    expect(formatAge(now - 12_000, now)).toBe('12s ago');
    expect(formatAge(now - 120_000, now)).toBe('2m ago');
  });
});
