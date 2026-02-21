import { useRef, useState, useEffect } from 'react';
import {
  Folder,
  FileText,
  Key,
  Sparkles,
  Search,
  Settings,
  GripVertical,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { ToolbarOrientation, ToolbarPosition } from '@/hooks/useToolbarState';

interface ToolbarAction {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  shortcut?: string;
  onClick: () => void;
  disabled?: boolean;
}

interface MiniToolbarProps {
  position: ToolbarPosition;
  orientation: ToolbarOrientation;
  onPositionChange: (position: ToolbarPosition) => void;
  onBrowseHosts?: () => void;
  onBrowseFiles?: () => void;
  onSnippets?: () => void;
  onKeys?: () => void;
  onCommandPalette?: () => void;
  onSettings?: () => void;
  className?: string;
}

export function MiniToolbar({
  position,
  orientation,
  onPositionChange,
  onBrowseHosts,
  onBrowseFiles,
  onSnippets,
  onKeys,
  onCommandPalette,
  onSettings,
  className,
}: MiniToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const actions: ToolbarAction[] = [
    {
      icon: Folder,
      label: 'Browse Hosts',
      shortcut: 'Cmd+H',
      onClick: () => onBrowseHosts?.(),
    },
    {
      icon: FileText,
      label: 'SFTP Browser',
      shortcut: 'Cmd+B',
      onClick: () => onBrowseFiles?.(),
    },
    {
      icon: Sparkles,
      label: 'Snippets',
      shortcut: 'Cmd+;',
      onClick: () => onSnippets?.(),
    },
    {
      icon: Key,
      label: 'SSH Keys',
      onClick: () => onKeys?.(),
    },
  ];

  const secondaryActions: ToolbarAction[] = [
    {
      icon: Search,
      label: 'Command Palette',
      shortcut: 'Cmd+K',
      onClick: () => onCommandPalette?.(),
    },
    {
      icon: Settings,
      label: 'Settings',
      shortcut: 'Cmd+,',
      onClick: () => onSettings?.(),
    },
  ];

  const handleDragStart = (e: React.MouseEvent) => {
    if (!toolbarRef.current) return;

    setIsDragging(true);
    const rect = toolbarRef.current.getBoundingClientRect();
    dragOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleDrag = (e: MouseEvent) => {
    if (!isDragging) return;

    const newX = e.clientX - dragOffset.current.x;
    const newY = e.clientY - dragOffset.current.y;

    // Keep toolbar within viewport bounds
    const maxX = window.innerWidth - (toolbarRef.current?.offsetWidth || 0);
    const maxY = window.innerHeight - (toolbarRef.current?.offsetHeight || 0);

    onPositionChange({
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY)),
    });
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  // Add/remove drag listeners
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleDrag);
      document.addEventListener('mouseup', handleDragEnd);
      return () => {
        document.removeEventListener('mousemove', handleDrag);
        document.removeEventListener('mouseup', handleDragEnd);
      };
    }
  }, [isDragging]);

  const isHorizontal = orientation === 'horizontal';

  return (
    <TooltipProvider delayDuration={200}>
      <div
        ref={toolbarRef}
        className={cn(
          'fixed',
          // Layout based on orientation
          isHorizontal ? 'flex-row h-12 rounded-full' : 'flex-col w-14 rounded-2xl',
          'relative flex gap-0.5 p-1.5',
          // Glass morphism with dramatic blur
          'bg-[var(--surface-1)]/90 backdrop-blur-2xl',
          // Borders with subtle glow
          'border border-[var(--border)]',
          'shadow-[0_8px_32px_-8px_rgba(0,0,0,0.6),0_0_0_1px_rgba(59,130,246,0.05)]',
          // Drag cursor
          isDragging ? 'cursor-grabbing' : 'cursor-default',
          // Transition for smooth movement
          !isDragging && 'transition-all duration-200',
          className
        )}
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
        }}
      >
        {/* Noise texture overlay */}
        <div
          className={cn(
            'absolute inset-0 pointer-events-none opacity-[0.03]',
            isHorizontal ? 'rounded-full' : 'rounded-2xl'
          )}
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='4' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          }}
        />

        {/* Drag Handle */}
        <div
          onMouseDown={handleDragStart}
          className={cn(
            'flex-shrink-0 flex items-center justify-center cursor-grab hover:bg-[var(--surface-3)] rounded-lg transition-colors',
            isHorizontal ? 'h-9 w-5' : 'w-10 h-5'
          )}
        >
          <GripVertical className={cn('h-4 w-4 text-text-tertiary', !isHorizontal && 'rotate-90')} />
        </div>

        {/* Primary actions */}
        <div className={cn('flex gap-0.5', isHorizontal ? 'flex-row items-center' : 'flex-col')}>
          {actions.map((action, index) => (
            <ToolbarButton
              key={action.label}
              action={action}
              index={index}
              orientation={orientation}
            />
          ))}
        </div>

        {/* Divider */}
        <div
          className={cn(
            'bg-[var(--border)]',
            isHorizontal ? 'h-6 w-px mx-1' : 'h-px w-full my-1'
          )}
        />

        {/* Secondary actions */}
        <div className={cn('flex gap-0.5', isHorizontal ? 'flex-row items-center' : 'flex-col')}>
          {secondaryActions.map((action, index) => (
            <ToolbarButton
              key={action.label}
              action={action}
              index={index + actions.length}
              orientation={orientation}
            />
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
}

interface ToolbarButtonProps {
  action: ToolbarAction;
  index: number;
  orientation: ToolbarOrientation;
}

function ToolbarButton({ action, index, orientation }: ToolbarButtonProps) {
  const Icon = action.icon;
  const isHorizontal = orientation === 'horizontal';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          onClick={action.onClick}
          disabled={action.disabled}
          className={cn(
            // Size and shape based on orientation
            'p-0',
            isHorizontal ? 'h-9 w-9 rounded-full' : 'h-10 w-10 rounded-xl',
            // Colors
            'text-text-secondary hover:text-foreground',
            'hover:bg-[var(--surface-3)]',
            // Dramatic hover effects
            'transition-all duration-300 ease-out',
            'hover:scale-110 hover:shadow-[0_0_16px_rgba(59,130,246,0.3)]',
            'active:scale-95',
            // Disabled state
            'disabled:opacity-40 disabled:cursor-not-allowed',
            'disabled:hover:scale-100 disabled:hover:shadow-none',
            // Focus ring
            'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'
          )}
          style={{
            animation: `buttonEnter 0.4s cubic-bezier(0.16, 1, 0.3, 1) ${0.4 + index * 0.05}s both`,
          }}
        >
          <Icon className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side={isHorizontal ? 'top' : 'left'} sideOffset={8}>
        <div className={cn('flex gap-2', isHorizontal ? 'flex-row items-center' : 'flex-col')}>
          <span className="text-xs font-medium text-foreground">{action.label}</span>
          {action.shortcut && (
            <kbd className={cn(
              'px-1.5 py-0.5 text-[10px] font-mono bg-[var(--surface-2)] rounded border border-[var(--border)] text-text-secondary',
              !isHorizontal && 'self-start'
            )}>
              {action.shortcut}
            </kbd>
          )}
        </div>
      </TooltipContent>

      <style jsx>{`
        @keyframes buttonEnter {
          from {
            opacity: 0;
            transform: scale(0.8) rotate(-5deg);
          }
          to {
            opacity: 1;
            transform: scale(1) rotate(0deg);
          }
        }
      `}</style>
    </Tooltip>
  );
}
