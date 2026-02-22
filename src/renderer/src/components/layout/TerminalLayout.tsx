import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface TerminalLayoutProps {
  children: ReactNode;
  tabBar?: ReactNode;
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
  overlays,
  className
}: TerminalLayoutProps) {
  return (
    <div
      className={cn(
        "flex flex-col h-screen w-screen overflow-hidden bg-background",
        "selection:bg-primary/20 selection:text-primary-foreground",
        className
      )}
    >
      {/* Tab Bar - Natural height */}
      {tabBar && (
        <div
          className="relative z-10"
          style={{
            animation: 'slideDownFadeIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards'
          }}
        >
          {tabBar}
        </div>
      )}

      {/* Terminal Layer - Fills remaining space */}
      <div className="flex-1 relative z-0 overflow-hidden">
        {children}
      </div>

      {/* Z-1000: Overlay Layer */}
      {overlays && (
        <div className="absolute inset-0 z-[1000] pointer-events-none">
          <div className="pointer-events-auto">
            {overlays}
          </div>
        </div>
      )}

      <style>{`
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
