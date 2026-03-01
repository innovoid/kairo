/**
 * Terminal-Centric Layout Preview Page
 *
 * This page allows you to preview the new refined brutalist design
 * alongside the existing layout. Access via /preview route.
 *
 * Features:
 * - Full terminal-centric layout with floating UI
 * - Glass morphism effects
 * - Dramatic animations
 * - Command palette (Cmd+K)
 * - Mini toolbar
 * - Host browser overlay
 */

import { TerminalCentricAppShell } from '@/components/layout/TerminalCentricAppShell';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { formatShortcut } from '@/lib/shortcut-format';

export function TerminalCentricPreview() {
  const [showInfo, setShowInfo] = useState(true);
  const commandPaletteShortcut = formatShortcut('mod+k');
  const browseHostsShortcut = formatShortcut('mod+h');

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      {/* Info banner (dismissible) */}
      {showInfo && (
        <div
          className="absolute top-4 left-1/2 -translate-x-1/2 z-[2000] max-w-2xl"
          style={{
            animation: 'slideDownFadeIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          }}
        >
          <div className="bg-[var(--surface-4)]/95 backdrop-blur-xl rounded-xl border border-[var(--border)] shadow-2xl p-4">
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-foreground mb-1">
                  🎨 Terminal-Centric Layout Preview
                </h3>
                <p className="text-xs text-text-secondary mb-2">
                  Exploring the refined brutalist design with floating UI and dramatic animations.
                </p>
                <div className="flex flex-wrap gap-2 text-[10px] font-mono text-text-tertiary">
                  <kbd className="px-2 py-1 bg-[var(--surface-2)] rounded border border-[var(--border)]">
                    {commandPaletteShortcut}
                  </kbd>
                  <span>Command palette</span>
                  <kbd className="px-2 py-1 bg-[var(--surface-2)] rounded border border-[var(--border)]">
                    {browseHostsShortcut}
                  </kbd>
                  <span>Browse hosts</span>
                  <kbd className="px-2 py-1 bg-[var(--surface-2)] rounded border border-[var(--border)]">
                    ESC
                  </kbd>
                  <span>Close overlays</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Link to="/">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-2 hover:scale-105 transition-transform"
                  >
                    <ArrowLeft className="h-3 w-3" />
                    Back
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowInfo(false)}
                  className="h-8 hover:scale-105 transition-transform"
                >
                  Dismiss
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Terminal-centric layout */}
      <TerminalCentricAppShell />

      <style>{`
        @keyframes slideDownFadeIn {
          from {
            opacity: 0;
            transform: translate(-50%, -16px);
          }
          to {
            opacity: 1;
            transform: translate(-50%, 0);
          }
        }
      `}</style>
    </div>
  );
}
