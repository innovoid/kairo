import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { KairoLogo } from '@/components/ui/KairoLogo';

interface ConnectingOverlayProps {
  visible: boolean;
  label?: string;
  isLocal?: boolean;
}

const SSH_STEPS = [
  'Resolving host…',
  'Opening TCP connection…',
  'Exchanging keys…',
  'Authenticating…',
  'Starting shell…',
];

const LOCAL_STEPS = [
  'Detecting shell…',
  'Preparing environment…',
  'Spawning process…',
];

export function ConnectingOverlay({ visible, label, isLocal }: ConnectingOverlayProps) {
  const steps = isLocal ? LOCAL_STEPS : SSH_STEPS;
  const [stepIndex, setStepIndex] = useState(0);

  // Cycle through steps while visible
  useEffect(() => {
    if (!visible) {
      setStepIndex(0);
      return;
    }
    const id = setInterval(() => {
      setStepIndex((i) => Math.min(i + 1, steps.length - 1));
    }, isLocal ? 300 : 800);
    return () => clearInterval(id);
  }, [visible, isLocal, steps.length]);

  if (!visible) return null;

  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      style={{ animation: 'fadeIn 0.15s ease both' }}
    >
      <div
        className="flex flex-col items-center gap-5"
        style={{ animation: 'slideUp 0.3s cubic-bezier(0.16,1,0.3,1) both' }}
      >
        {/* Logo — no pulse rings */}
        <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 shadow-[0_0_32px_rgba(16,185,129,0.2)]">
          <KairoLogo size="sm" iconOnly />
        </div>

        {/* Label */}
        <div className="text-center space-y-1">
          <p className="text-sm font-medium text-zinc-100 font-mono tracking-tight">
            {label ?? (isLocal ? 'Local Terminal' : 'Connecting')}
          </p>
          <p className="text-xs text-zinc-500 font-mono min-h-[1rem] transition-all duration-300">
            {steps[stepIndex]}
          </p>
        </div>

        {/* Segmented progress bar */}
        <div className="flex items-center gap-1">
          {steps.map((_, i) => (
            <div
              key={i}
              className={cn(
                'h-1 rounded-full transition-all duration-500',
                i <= stepIndex
                  ? 'bg-emerald-500 w-6 shadow-[0_0_6px_rgba(16,185,129,0.6)]'
                  : 'bg-zinc-700 w-4',
              )}
            />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
