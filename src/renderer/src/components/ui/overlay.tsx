import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter as BaseDialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';

interface OverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
}

export function Overlay({ open, onOpenChange, children, className }: OverlayProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          // Size constraints
          'max-w-[min(1200px,calc(100vw-2rem))] max-h-[80vh] p-0',
          // Glassmorphism styling
          'bg-[var(--surface-2)]/95 backdrop-blur-xl rounded-2xl',
          'border border-[var(--border)]/60',
          'shadow-[0_32px_128px_-16px_rgba(0,0,0,0.8),0_0_0_1px_rgba(16,185,129,0.08)]',
          className
        )}
      >
        <div
          className="animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-500"
          style={{
            animation: 'overlayEnter 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          }}
        >
          {/* Noise texture */}
          <div
            className="absolute inset-0 rounded-2xl pointer-events-none opacity-[0.02]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='4' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
            }}
          />

          {/* Subtle top glow */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

          <div className="relative">{children}</div>
        </div>

        <style>{`
          @keyframes overlayEnter {
            from {
              opacity: 0;
              transform: scale(0.95) translateY(16px);
              filter: blur(8px);
            }
            to {
              opacity: 1;
              transform: scale(1) translateY(0);
              filter: blur(0);
            }
          }
        `}</style>
      </DialogContent>
    </Dialog>
  );
}

interface OverlayHeaderProps {
  title: string;
  description?: string;
  onClose: () => void;
  className?: string;
}

export function OverlayHeader({
  title,
  description,
  onClose,
  className,
}: OverlayHeaderProps) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-4 p-6 border-b border-[var(--border-subtle)]',
        className
      )}
    >
      <div className="flex-1 space-y-1">
        <DialogTitle
          className="text-xl font-semibold tracking-tight text-foreground"
          style={{
            animation: 'titleEnter 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both',
          }}
        >
          {title}
        </DialogTitle>
        {description && (
          <DialogDescription
            className="text-sm text-text-secondary"
            style={{
              animation: 'titleEnter 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.15s both',
            }}
          >
            {description}
          </DialogDescription>
        )}
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={onClose}
        className={cn(
          'h-8 w-8 p-0 rounded-lg',
          'text-text-tertiary hover:text-foreground',
          'hover:bg-[var(--surface-3)]',
          'transition-all duration-200',
          'hover:scale-110 hover:rotate-90 active:scale-95'
        )}
        style={{
          animation: 'buttonEnter 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.2s both',
        }}
        aria-label="Close"
      >
        <X className="h-4 w-4" />
      </Button>

      <style>{`
        @keyframes titleEnter {
          from {
            opacity: 0;
            transform: translateX(-8px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes buttonEnter {
          from {
            opacity: 0;
            transform: scale(0.8) rotate(-90deg);
          }
          to {
            opacity: 1;
            transform: scale(1) rotate(0);
          }
        }
      `}</style>
    </div>
  );
}

interface OverlayContentProps {
  children: React.ReactNode;
  className?: string;
}

export function OverlayContent({ children, className }: OverlayContentProps) {
  return (
    <div
      className={cn(
        'overflow-y-auto p-6',
        className
      )}
    >
      {children}
    </div>
  );
}

interface OverlayFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function OverlayFooter({ children, className }: OverlayFooterProps) {
  return (
    <BaseDialogFooter
      className={cn(
        'flex items-center justify-end gap-3 p-6',
        'border-t border-[var(--border-subtle)]',
        'bg-[var(--surface-1)]/50',
        className
      )}
    >
      {children}
    </BaseDialogFooter>
  );
}
