/**
 * AppLoader — full-screen app loading state.
 *
 * Design mirrors ConnectingOverlay: dark background, emerald pulse rings
 * around a logo icon, cycling boot messages, and a segmented progress bar.
 */

import { useEffect, useState } from 'react';
import { ArchTermLogo } from './ArchTermLogo';

const BOOT_STEPS = [
  'Initializing secure context…',
  'Loading workspace…',
  'Authenticating session…',
  'Syncing host registry…',
  'Almost there…',
];

export function AppLoader({ message }: { message?: string }) {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setStepIndex((i) => Math.min(i + 1, BOOT_STEPS.length - 1));
    }, 1200);
    return () => clearInterval(id);
  }, []);

  const statusText = message ?? BOOT_STEPS[stepIndex];
  const steps = message ? [message] : BOOT_STEPS;
  const activeStep = message ? 0 : stepIndex;

  return (
    <div
      className="relative min-h-screen overflow-hidden bg-[#09090b] flex items-center justify-center"
      aria-label="Loading"
    >
      {/* Subtle dot grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(16,185,129,0.12) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          animation: 'gridDrift 14s linear infinite',
        }}
      />

      {/* Radial ambient glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 55% 50% at 50% 50%, rgba(16,185,129,0.06) 0%, transparent 70%)',
        }}
      />

      {/* Center card */}
      <div
        className="relative z-10 flex flex-col items-center gap-5"
        style={{ animation: 'slideUp 0.4s cubic-bezier(0.16,1,0.3,1) both' }}
      >
        {/* Icon — no pulse rings */}
        <div className="relative flex items-center justify-center">
          <div
            className="relative flex items-center justify-center h-16 w-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 shadow-[0_0_40px_rgba(16,185,129,0.2)]"
          >
            <ArchTermLogo size="sm" iconOnly />
          </div>
        </div>

        {/* Wordmark */}
        <ArchTermLogo size="md" textOnly stacked />

        {/* Current status */}
        <p
          className="text-xs text-zinc-500 font-mono min-h-[1rem] transition-all duration-300"
          key={statusText}
          style={{ animation: 'fadeSlide 0.35s ease both' }}
        >
          {statusText}
        </p>

        {/* Segmented progress bar */}
        <div className="flex items-center gap-1">
          {steps.map((_, i) => (
            <div
              key={i}
              className={[
                'h-1 rounded-full transition-all duration-500',
                i <= activeStep
                  ? 'bg-emerald-500 w-6 shadow-[0_0_6px_rgba(16,185,129,0.6)]'
                  : 'bg-zinc-800 w-4',
              ].join(' ')}
            />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes gridDrift {
          from { background-position: 0 0; }
          to   { background-position: 0 -56px; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeSlide {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
