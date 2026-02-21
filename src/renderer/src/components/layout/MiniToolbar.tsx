import {
  Folder,
  FileText,
  Key,
  Sparkles,
  Search,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ToolbarAction {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  shortcut?: string;
  onClick: () => void;
  disabled?: boolean;
}

interface MiniToolbarProps {
  onBrowseHosts?: () => void;
  onBrowseFiles?: () => void;
  onSnippets?: () => void;
  onKeys?: () => void;
  onCommandPalette?: () => void;
  onSettings?: () => void;
  className?: string;
}

export function MiniToolbar({
  onBrowseHosts,
  onBrowseFiles,
  onSnippets,
  onKeys,
  onCommandPalette,
  onSettings,
  className,
}: MiniToolbarProps) {
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

  return (
    <TooltipProvider delayDuration={200}>
      <div
        className={cn(
          // Vertical stack layout for bottom-right
          'relative flex flex-col gap-0.5 p-1.5 w-14 rounded-2xl',
          // Glass morphism with dramatic blur
          'bg-[var(--surface-1)]/90 backdrop-blur-2xl',
          // Borders with subtle glow
          'border border-[var(--border)]',
          'shadow-[0_8px_32px_-8px_rgba(0,0,0,0.6),0_0_0_1px_rgba(59,130,246,0.05)]',
          // Entrance animation from bottom-right
          'animate-in fade-in slide-in-from-bottom-4 duration-500',
          className
        )}
        style={{
          animation: 'floatInFromBottom 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.3s both',
        }}
      >
        {/* Noise texture overlay */}
        <div
          className="absolute inset-0 rounded-2xl pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='4' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          }}
        />

        {/* Primary actions */}
        <div className="flex flex-col gap-0.5">
          {actions.map((action, index) => (
            <ToolbarButton
              key={action.label}
              action={action}
              index={index}
            />
          ))}
        </div>

        {/* Divider */}
        <div className="h-px w-full bg-[var(--border)] my-1" />

        {/* Secondary actions */}
        <div className="flex flex-col gap-0.5">
          {secondaryActions.map((action, index) => (
            <ToolbarButton
              key={action.label}
              action={action}
              index={index + actions.length}
            />
          ))}
        </div>

        <style jsx>{`
          @keyframes floatInFromBottom {
            from {
              opacity: 0;
              transform: translateY(24px) translateX(12px) scale(0.92);
              filter: blur(4px);
            }
            to {
              opacity: 1;
              transform: translateY(0) translateX(0) scale(1);
              filter: blur(0);
            }
          }
        `}</style>
      </div>
    </TooltipProvider>
  );
}

interface ToolbarButtonProps {
  action: ToolbarAction;
  index: number;
}

function ToolbarButton({ action, index }: ToolbarButtonProps) {
  const Icon = action.icon;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          onClick={action.onClick}
          disabled={action.disabled}
          className={cn(
            // Size and shape - more square for vertical layout
            'h-10 w-10 p-0 rounded-xl',
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
            animation: `buttonEnter 0.4s cubic-bezier(0.16, 1, 0.3, 1) ${0.4 + index * 0.06}s both`,
          }}
        >
          <Icon className="h-4.5 w-4.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="left" sideOffset={8}>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-foreground">{action.label}</span>
          {action.shortcut && (
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-[var(--surface-2)] rounded border border-[var(--border)] text-text-secondary self-start">
              {action.shortcut}
            </kbd>
          )}
        </div>
      </TooltipContent>

      <style jsx>{`
        @keyframes buttonEnter {
          from {
            opacity: 0;
            transform: translateY(12px) scale(0.85);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </Tooltip>
  );
}
