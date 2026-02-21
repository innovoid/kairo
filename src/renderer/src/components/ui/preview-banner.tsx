/**
 * Preview Banner Component
 *
 * Shows a dismissible banner promoting the new terminal-centric layout.
 * Can be placed in the existing AppShell to inform users about the preview.
 */

import { X, Sparkles } from 'lucide-react';
import { Button } from './button';
import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';

export function PreviewBanner() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if user has dismissed the banner
    const isDismissed = localStorage.getItem('archterm-preview-banner-dismissed');
    if (!isDismissed) {
      // Show banner after a short delay
      setTimeout(() => setVisible(true), 2000);
    } else {
      setDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    setDismissed(true);
    localStorage.setItem('archterm-preview-banner-dismissed', 'true');
  };

  if (dismissed || !visible) return null;

  return (
    <div
      className="fixed bottom-6 right-6 z-[100] max-w-sm"
      style={{
        animation: 'slideUpFadeIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      }}
    >
      <div className="relative bg-gradient-to-br from-[var(--surface-4)] to-[var(--surface-3)] backdrop-blur-xl rounded-xl border border-[var(--border)] shadow-[0_16px_48px_-8px_rgba(0,0,0,0.6),0_0_0_1px_rgba(59,130,246,0.1)] p-4 overflow-hidden">
        {/* Animated gradient background */}
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            background: 'linear-gradient(135deg, var(--primary), #06B6D4)',
            animation: 'borderFlow 4s ease-in-out infinite',
            backgroundSize: '200% 200%',
          }}
        />

        {/* Noise texture */}
        <div
          className="absolute inset-0 rounded-xl pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='4' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          }}
        />

        <div className="relative flex items-start gap-3">
          <div
            className="flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-lg bg-gradient-to-br from-primary to-cyan-400"
            style={{
              animation: 'pulseGlow 2s ease-in-out infinite',
            }}
          >
            <Sparkles className="h-5 w-5 text-white" />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
              New Terminal-Centric Design
              <span className="px-1.5 py-0.5 text-[10px] font-mono bg-primary/20 text-primary rounded-md border border-primary/30">
                Preview
              </span>
            </h3>
            <p className="text-xs text-text-secondary mb-3 leading-relaxed">
              Experience the refined brutalist layout with floating UI, dramatic animations, and
              premium glass morphism effects.
            </p>
            <div className="flex gap-2">
              <Link to="/preview">
                <Button
                  size="sm"
                  className="h-7 text-xs gap-1.5 hover:scale-105 active:scale-95 transition-transform shadow-[0_0_20px_rgba(59,130,246,0.3)]"
                >
                  <Sparkles className="h-3 w-3" />
                  Try Preview
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDismiss}
                className="h-7 text-xs hover:scale-105 active:scale-95 transition-transform"
              >
                Maybe Later
              </Button>
            </div>
          </div>

          <button
            onClick={handleDismiss}
            className="flex-shrink-0 p-1 rounded-md text-text-tertiary hover:text-foreground hover:bg-[var(--surface-2)] transition-all hover:scale-110 active:scale-90"
            aria-label="Dismiss banner"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <style jsx>{`
          @keyframes slideUpFadeIn {
            from {
              opacity: 0;
              transform: translateY(16px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes borderFlow {
            0% {
              background-position: 0% 50%;
            }
            50% {
              background-position: 100% 50%;
            }
            100% {
              background-position: 0% 50%;
            }
          }

          @keyframes pulseGlow {
            0%,
            100% {
              box-shadow: 0 0 16px rgba(59, 130, 246, 0.4);
            }
            50% {
              box-shadow: 0 0 24px rgba(59, 130, 246, 0.6);
            }
          }
        `}</style>
      </div>
    </div>
  );
}
