import { useMemo } from 'react';
import { Download, Sparkles, X, RotateCcw, Clock, Zap, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { UpdateState, UpdateActions } from './useAutoUpdater';
import { sanitizeReleaseNotesHtml } from './release-notes';

// ─── Download Progress Banner ──────────────────────────────────────────────────

interface UpdateBannerProps {
  state: UpdateState;
  actions: UpdateActions;
}

/**
 * Slim animated banner that appears at the bottom of the screen while an
 * update is downloading. Disappears once download finishes (modal takes over).
 */
export function UpdateBanner({ state, actions }: UpdateBannerProps) {
  const visible =
    state.phase === 'available' || state.phase === 'downloading';

  if (!visible) return null;

  const speed = state.bytesPerSecond
    ? state.bytesPerSecond > 1_000_000
      ? `${(state.bytesPerSecond / 1_000_000).toFixed(1)} MB/s`
      : `${(state.bytesPerSecond / 1_000).toFixed(0)} KB/s`
    : null;

  return (
    <div
      className={cn(
        'fixed bottom-0 inset-x-0 z-50 pointer-events-none',
        'flex justify-center pb-4 px-4',
      )}
      style={{ animation: 'slideUpBanner 0.4s cubic-bezier(0.16, 1, 0.3, 1) both' }}
    >
      <div
        className={cn(
          'pointer-events-auto',
          'flex items-center gap-3 rounded-xl px-4 py-2.5',
          'bg-[var(--surface-2)]/90 backdrop-blur-xl',
          'border border-[var(--border)]',
          'shadow-[0_8px_32px_-4px_rgba(0,0,0,0.5)]',
          'text-sm font-mono',
        )}
      >
        {/* Spinning download icon */}
        <div className="relative shrink-0">
          <Download className="h-4 w-4 text-primary animate-bounce" />
        </div>

        <span className="text-foreground font-medium">
          {state.phase === 'available'
            ? `Update v${state.version} available — starting download…`
            : `Downloading v${state.version}…`}
        </span>

        {/* Progress track */}
        {state.phase === 'downloading' && (
          <div className="flex items-center gap-2">
            <div className="w-32 h-1.5 bg-[var(--surface-3)] rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${state.percent}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground tabular-nums w-8">
              {state.percent}%
            </span>
            {speed && (
              <span className="text-xs text-muted-foreground/60">{speed}</span>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideUpBanner {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ─── Update Ready Modal ─────────────────────────────────────────────────────────

interface UpdateReadyModalProps {
  state: UpdateState;
  actions: UpdateActions;
}

/**
 * Full-screen backdrop modal that appears when an update has been downloaded
 * and is ready to install. Slides up from the bottom with a glassmorphism card.
 */
export function UpdateReadyModal({ state, actions }: UpdateReadyModalProps) {
  const visible = state.phase === 'ready' && !state.dismissed;
  const safeReleaseNotes = useMemo(
    () => sanitizeReleaseNotesHtml(state.releaseNotes),
    [state.releaseNotes]
  );

  return (
    <Dialog open={visible} onOpenChange={(open) => { if (!open) actions.dismiss(); }}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          'z-50 p-0 top-auto bottom-8 -translate-y-0',
          'w-[calc(100%-2rem)] max-w-md',
          'rounded-2xl overflow-hidden',
          'bg-[var(--surface-1)]/95 backdrop-blur-2xl',
          'border border-[var(--border)]',
          'shadow-[0_-4px_60px_-8px_rgba(0,0,0,0.7),0_0_0_1px_rgba(255,255,255,0.04)]',
        )}
      >
        <DialogTitle className="sr-only">Update ready to install</DialogTitle>
        <div
          className="relative"
          style={{ animation: 'slideUpModal 0.5s cubic-bezier(0.16, 1, 0.3, 1) both' }}
        >
          {/* Top accent bar */}
          <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-primary to-transparent opacity-80" />

          {/* Dismiss button */}
          <button
            onClick={actions.dismiss}
            className={cn(
              'absolute top-4 right-4',
              'p-1.5 rounded-lg',
              'text-muted-foreground hover:text-foreground',
              'hover:bg-[var(--surface-3)]',
              'transition-colors',
            )}
            aria-label="Dismiss update notification"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="p-6 pt-5">
            {/* Header */}
            <div className="flex items-start gap-4 mb-5">
              {/* Icon */}
              <div
                className={cn(
                  'shrink-0 w-12 h-12 rounded-xl',
                  'bg-primary/10 border border-primary/20',
                  'flex items-center justify-center',
                )}
              >
                <Sparkles className="h-6 w-6 text-primary" />
              </div>

              <div className="min-w-0 flex-1 pt-0.5">
                <h2 className="text-base font-semibold text-foreground tracking-tight">
                  ArchTerm {state.version} is ready
                </h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  The update has been downloaded and is ready to install.
                </p>
              </div>
            </div>

            {/* What's new section (if release notes available) */}
            {safeReleaseNotes && (
              <div
                className={cn(
                  'mb-5 p-3 rounded-xl',
                  'bg-[var(--surface-2)] border border-[var(--border-subtle)]',
                  'text-xs text-muted-foreground font-mono',
                  'max-h-28 overflow-y-auto',
                )}
              >
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-1.5 font-sans">
                  Release notes
                </p>
                <div
                  className="prose prose-sm prose-invert max-w-none text-xs leading-relaxed"
                  // Content is sanitized with a strict allow-list before rendering.
                  dangerouslySetInnerHTML={{ __html: safeReleaseNotes }}
                />
              </div>
            )}

            {/* Stats row */}
            <div className="flex items-center gap-3 mb-5">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Zap className="h-3 w-3 text-primary" />
                <span>Downloaded &amp; ready</span>
              </div>
              <div className="w-px h-3 bg-[var(--border)]" />
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>~5 second restart</span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={actions.dismiss}
                className="flex-1 gap-1.5 font-mono text-xs"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Later
              </Button>

              <Button
                size="sm"
                onClick={actions.installAndRestart}
                className={cn(
                  'flex-[2] gap-1.5 font-mono text-xs',
                  'shadow-[0_0_20px_var(--primary-glow,rgba(16,185,129,0.3))]',
                  'hover:shadow-[0_0_28px_var(--primary-glow,rgba(16,185,129,0.45))]',
                  'transition-shadow',
                )}
              >
                <ArrowRight className="h-3.5 w-3.5" />
                Restart &amp; update
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>

      <style>{`
        @keyframes slideUpModal {
          from { opacity: 0; transform: translateY(40px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
      `}</style>
    </Dialog>
  );
}
