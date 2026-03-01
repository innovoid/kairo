import { Terminal } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KairoLogoProps {
  /** Controls overall scale. Default: 'md' */
  size?: 'sm' | 'md' | 'lg';
  /** Stack icon above text instead of side-by-side */
  stacked?: boolean;
  /** Render only the icon box, no text */
  iconOnly?: boolean;
  /** Render only the wordmark text, no icon box */
  textOnly?: boolean;
  className?: string;
}

const SIZE = {
  sm: {
    box: 'p-2 rounded-lg',
    icon: 'h-5 w-5',
    name: 'text-2xl',
    tag: 'text-xs',
    gap: 'gap-3',
  },
  md: {
    box: 'p-3 rounded-xl',
    icon: 'h-7 w-7',
    name: 'text-4xl',
    tag: 'text-sm',
    gap: 'gap-4',
  },
  lg: {
    box: 'p-4 rounded-2xl',
    icon: 'h-9 w-9',
    name: 'text-5xl',
    tag: 'text-base',
    gap: 'gap-5',
  },
};

export function KairoLogo({
  size = 'md',
  stacked = false,
  iconOnly = false,
  textOnly = false,
  className,
}: KairoLogoProps) {
  const s = SIZE[size];

  return (
    <div
      className={cn(
        'flex items-center',
        stacked ? 'flex-col text-center' : 'flex-row',
        !iconOnly && !textOnly && s.gap,
        className,
      )}
    >
      {/* Icon box */}
      {!textOnly && (
        <div
          className={cn(
            'shrink-0 border border-emerald-500/30 bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.15)]',
            s.box,
          )}
        >
          <Terminal className={cn('text-emerald-400', s.icon)} />
        </div>
      )}

      {/* Wordmark */}
      {!iconOnly && (
        <div className={stacked ? 'flex flex-col items-center gap-0.5' : ''}>
          <h1 className={cn('font-semibold tracking-tight text-white leading-none', s.name)}>
            Kairo
          </h1>
          <p className={cn('font-mono text-emerald-400/80', s.tag)}>
            AI-powered ssh client
          </p>
        </div>
      )}
    </div>
  );
}
