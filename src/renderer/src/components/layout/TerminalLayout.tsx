import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface TerminalLayoutProps {
  children: ReactNode;
  tabBar?: ReactNode;
  toolbar?: ReactNode;
  overlays?: ReactNode;
  className?: string;
}

/**
 * Terminal-centric layout wrapper
 * Terminals fill 100% viewport, floating UI elements layered on top
 */
export function TerminalLayout({
  children,
  tabBar,
  toolbar,
  overlays,
  className
}: TerminalLayoutProps) {
  return (
    <div
      className={cn(
        "relative h-screen w-screen overflow-hidden bg-background",
        "selection:bg-primary/20 selection:text-primary-foreground",
        className
      )}
    >
      {/* Z-0: Terminal Layer - Full viewport */}
      <div className="absolute inset-0 z-0">
        {children}
      </div>

      {/* Z-10: Floating UI Layer */}
      {tabBar && (
        <div
          className="absolute top-0 left-0 right-0 z-10"
          style={{
            animation: 'slideDownFadeIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards'
          }}
        >
          {tabBar}
        </div>
      )}

      {toolbar && (
        <div
          className="absolute top-4 right-4 z-10"
          style={{
            animation: 'scaleIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both'
          }}
        >
          {toolbar}
        </div>
      )}

      {/* Z-1000: Overlay Layer */}
      {overlays && (
        <div className="absolute inset-0 z-[1000] pointer-events-none">
          <div className="pointer-events-auto">
            {overlays}
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slideDownFadeIn {
          from {
            opacity: 0;
            transform: translateY(-16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}
