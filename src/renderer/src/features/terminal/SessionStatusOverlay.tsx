import { useEffect, useState, useCallback } from 'react';
import {
  WifiOff,
  AlertTriangle,
  RotateCcw,
  X,
  Clock,
  Terminal,
  ShieldAlert,
  Zap,
  ServerCrash,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Tab } from '@/stores/session-store';

interface SessionStatusOverlayProps {
  tab: Tab;
  onReconnect: () => void;
  onClose: () => void;
}

// ── Categorise disconnect reasons into UX-friendly buckets ──────────────────

type DisconnectKind =
  | 'reboot'          // server rebooted (clean close after being connected)
  | 'timeout'         // connection timed out while connecting
  | 'auth'            // authentication failed
  | 'host-not-found'  // DNS / unreachable
  | 'refused'         // port closed / firewall
  | 'mitm'            // host key mismatch
  | 'keepalive'       // keepalive failed (idle drop)
  | 'clean'           // normal exit/logout
  | 'unknown';

function categorise(reason: string | undefined): DisconnectKind {
  if (!reason) return 'clean';
  const r = reason.toLowerCase();
  if (r.includes('keepalive') || r.includes('keep alive') || r.includes('keep-alive')) return 'keepalive';
  if (r.includes('mitm') || r.includes('host key') || r.includes('fingerprint')) return 'mitm';
  if (r.includes('authentication') || r.includes('auth') || r.includes('password') || r.includes('key')) return 'auth';
  if (r.includes('econnrefused') || r.includes('connection refused') || r.includes('refused')) return 'refused';
  if (r.includes('etimedout') || r.includes('timed out') || r.includes('timeout')) return 'timeout';
  if (r.includes('enotfound') || r.includes('getaddrinfo') || r.includes('not found') || r.includes('unreachable')) return 'host-not-found';
  return 'unknown';
}

const KIND_META: Record<DisconnectKind, {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  canReconnect: boolean;
  autoReconnect: boolean;  // suggest auto-reconnect timer
  color: string;           // tailwind text color
  bgColor: string;         // tailwind bg
  borderColor: string;
}> = {
  reboot: {
    icon: RefreshCw,
    title: 'Server rebooted',
    description: 'The remote server closed the connection — it may be rebooting.',
    canReconnect: true,
    autoReconnect: true,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20',
  },
  timeout: {
    icon: Clock,
    title: 'Connection timed out',
    description: 'The server did not respond in time. Check the hostname and your network.',
    canReconnect: true,
    autoReconnect: false,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/20',
  },
  auth: {
    icon: ShieldAlert,
    title: 'Authentication failed',
    description: 'Wrong password, key, or username. Check your credentials.',
    canReconnect: false,
    autoReconnect: false,
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/20',
  },
  'host-not-found': {
    icon: ServerCrash,
    title: 'Host not found',
    description: 'Could not resolve the hostname. Check the address or your DNS.',
    canReconnect: true,
    autoReconnect: false,
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/20',
  },
  refused: {
    icon: WifiOff,
    title: 'Connection refused',
    description: 'The server actively refused the connection — is SSH running on this port?',
    canReconnect: true,
    autoReconnect: false,
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/20',
  },
  mitm: {
    icon: AlertTriangle,
    title: 'Host key mismatch',
    description: 'The server fingerprint differs from the known_hosts record. Do NOT reconnect unless you know the server changed.',
    canReconnect: false,
    autoReconnect: false,
    color: 'text-red-500',
    bgColor: 'bg-red-500/15',
    borderColor: 'border-red-500/30',
  },
  keepalive: {
    icon: Zap,
    title: 'Connection dropped',
    description: 'The session went idle and keepalives stopped responding.',
    canReconnect: true,
    autoReconnect: true,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20',
  },
  clean: {
    icon: Terminal,
    title: 'Session ended',
    description: 'The remote shell exited normally.',
    canReconnect: true,
    autoReconnect: false,
    color: 'text-muted-foreground',
    bgColor: 'bg-[var(--surface-2)]',
    borderColor: 'border-[var(--border)]',
  },
  unknown: {
    icon: WifiOff,
    title: 'Disconnected',
    description: 'The connection was lost unexpectedly.',
    canReconnect: true,
    autoReconnect: true,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20',
  },
};

// ── Time elapsed helper ──────────────────────────────────────────────────────

function useElapsed(since: number | undefined): string {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!since) return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [since]);

  if (!since) return '';
  const secs = Math.floor((Date.now() - since) / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

// ── Auto-reconnect countdown ─────────────────────────────────────────────────

const AUTO_RECONNECT_DELAY = 8; // seconds

function useAutoReconnectCountdown(
  enabled: boolean,
  onFire: () => void,
  attempts: number,
): { countdown: number; cancel: () => void } {
  const [countdown, setCountdown] = useState(AUTO_RECONNECT_DELAY);
  const [cancelled, setCancelled] = useState(false);

  useEffect(() => {
    // Only auto-reconnect for the first 3 attempts
    if (!enabled || cancelled || attempts >= 3) return;

    setCountdown(AUTO_RECONNECT_DELAY);
    const interval = setInterval(() => {
      setCountdown((n) => {
        if (n <= 1) {
          clearInterval(interval);
          onFire();
          return 0;
        }
        return n - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, attempts]);

  const cancel = useCallback(() => {
    setCancelled(true);
    setCountdown(0);
  }, []);

  return { countdown: cancelled ? 0 : countdown, cancel };
}

// ── Main component ───────────────────────────────────────────────────────────

export function SessionStatusOverlay({ tab, onReconnect, onClose }: SessionStatusOverlayProps) {
  const isVisible = tab.status === 'disconnected' || tab.status === 'error';

  const kind = categorise(tab.disconnectReason);
  const meta = KIND_META[kind];
  const Icon = meta.icon;
  const elapsed = useElapsed(tab.disconnectedAt);
  const attempts = tab.reconnectAttempts ?? 0;

  const { countdown, cancel: cancelAuto } = useAutoReconnectCountdown(
    isVisible && meta.autoReconnect,
    onReconnect,
    attempts,
  );

  if (!isVisible) return null;

  const showAutoReconnectBadge = meta.autoReconnect && countdown > 0 && attempts < 3;

  return (
    <div
      className={cn(
        'absolute inset-0 z-20 flex items-center justify-center',
        'bg-black/70 backdrop-blur-sm',
      )}
      style={{ animation: 'fadeInOverlay 0.25s ease both' }}
    >
      {/* Card */}
      <div
        className={cn(
          'relative w-full max-w-sm mx-4',
          'rounded-2xl overflow-hidden',
          'bg-[var(--surface-1)]/95 backdrop-blur-2xl',
          'border shadow-[0_20px_60px_-12px_rgba(0,0,0,0.8)]',
          meta.borderColor,
        )}
        style={{ animation: 'slideUpCard 0.35s cubic-bezier(0.16,1,0.3,1) both' }}
      >
        {/* Top color accent */}
        <div className={cn('h-0.5 w-full', meta.bgColor.replace('bg-', 'bg-gradient-to-r from-transparent via-'))} />

        {/* Close button */}
        <button
          onClick={onClose}
          className={cn(
            'absolute top-3 right-3 p-1.5 rounded-lg',
            'text-muted-foreground hover:text-foreground',
            'hover:bg-[var(--surface-3)] transition-colors',
          )}
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        <div className="p-5">
          {/* Icon + title */}
          <div className="flex items-start gap-3.5 mb-4">
            <div className={cn('shrink-0 w-10 h-10 rounded-xl flex items-center justify-center border', meta.bgColor, meta.borderColor)}>
              <Icon className={cn('h-5 w-5', meta.color)} />
            </div>
            <div className="pt-0.5 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-semibold text-foreground">{meta.title}</h3>
                {elapsed && (
                  <span className="text-[11px] text-muted-foreground/60 font-mono">{elapsed}</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                {meta.description}
              </p>
            </div>
          </div>

          {/* Error detail (if any) */}
          {tab.disconnectReason && kind !== 'clean' && (
            <div className={cn('mb-4 px-3 py-2 rounded-lg text-xs font-mono', meta.bgColor, meta.borderColor, 'border')}>
              <p className="text-muted-foreground/70 truncate">{tab.disconnectReason}</p>
            </div>
          )}

          {/* Auto-reconnect countdown */}
          {showAutoReconnectBadge && (
            <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)]">
              <div className="relative w-4 h-4 shrink-0">
                <svg className="w-4 h-4 -rotate-90" viewBox="0 0 16 16">
                  <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--border)]" />
                  <circle
                    cx="8" cy="8" r="6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeDasharray={`${2 * Math.PI * 6}`}
                    strokeDashoffset={`${2 * Math.PI * 6 * (1 - countdown / AUTO_RECONNECT_DELAY)}`}
                    className={meta.color}
                    style={{ transition: 'stroke-dashoffset 1s linear' }}
                  />
                </svg>
              </div>
              <span className="text-xs text-muted-foreground flex-1">
                Reconnecting in <span className={cn('font-mono font-semibold', meta.color)}>{countdown}s</span>
                {attempts > 0 && <span className="text-muted-foreground/50"> · attempt {attempts + 1}</span>}
              </span>
              <button
                onClick={cancelAuto}
                className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors underline"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Reconnect exhausted notice */}
          {meta.autoReconnect && attempts >= 3 && (
            <div className="mb-4 px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)]">
              <p className="text-xs text-muted-foreground">
                Auto-reconnect stopped after {attempts} attempts.
              </p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="flex-1 font-mono text-xs gap-1.5"
            >
              <X className="h-3.5 w-3.5" />
              Close tab
            </Button>

            {meta.canReconnect && (
              <Button
                size="sm"
                onClick={() => { cancelAuto(); onReconnect(); }}
                className={cn(
                  'flex-[2] font-mono text-xs gap-1.5',
                  'shadow-[0_0_16px_var(--primary-glow,rgba(16,185,129,0.25))]',
                )}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {showAutoReconnectBadge ? 'Reconnect now' : 'Reconnect'}
              </Button>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeInOverlay {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes slideUpCard {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
      `}</style>
    </div>
  );
}
