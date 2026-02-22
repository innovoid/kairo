import { X, Plus, ChevronDown, Circle, Folder, FileText, Sparkles, Key, Search, Settings, FolderOpen, SplitSquareHorizontal, SplitSquareVertical, Radio } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getHotkey } from '@/lib/hotkeys-registry';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from '@/components/ui/context-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface Tab {
  id: string;
  title: string;
  hostname?: string;
  status: 'connected' | 'connecting' | 'disconnected';
  isActive: boolean;
  sessionId?: string;
  isRecording?: boolean;
}

interface FloatingTabBarProps {
  tabs: Tab[];
  currentWorkspaceId?: string;
  workspaces?: Array<{ id: string; name: string }>;
  onTabClick?: (tabId: string) => void;
  onTabClose?: (tabId: string) => void;
  onNewTab?: () => void;
  onWorkspaceChange?: (workspace: string) => void;
  onBrowseHosts?: () => void;
  onBrowseFiles?: () => void;
  onSnippets?: () => void;
  onKeys?: () => void;
  onCommandPalette?: () => void;
  onSettings?: () => void;
  onOpenSftp?: (tabId: string) => void;
  onStartRecording?: (tabId: string) => void;
  onStopRecording?: (tabId: string) => void;
  onSplitHorizontal?: (tabId: string) => void;
  onSplitVertical?: (tabId: string) => void;
  onToggleBroadcast?: (tabId: string) => void;
  className?: string;
}

const statusColors = {
  connected: 'text-success',
  connecting: 'text-warning',
  disconnected: 'text-text-disabled',
};

export function FloatingTabBar({
  tabs,
  currentWorkspaceId,
  workspaces = [],
  onTabClick,
  onTabClose,
  onNewTab,
  onWorkspaceChange,
  onBrowseHosts,
  onBrowseFiles,
  onSnippets,
  onKeys,
  onCommandPalette,
  onSettings,
  onOpenSftp,
  onStartRecording,
  onStopRecording,
  onSplitHorizontal,
  onSplitVertical,
  onToggleBroadcast,
  className,
}: FloatingTabBarProps) {
  const currentWorkspaceLabel =
    workspaces.find((workspace) => workspace.id === currentWorkspaceId)?.name ?? 'Workspace';

  return (
    <TooltipProvider delay={200}>
      <div
        className={cn(
          // Base styles
          'relative w-full h-12',
        // Glass morphism with dramatic blur
        'bg-[var(--surface-1)]/80 backdrop-blur-xl',
        // Borders
        'border-b border-[var(--border-subtle)]',
        // Shadow for depth
        'shadow-[0_4px_24px_-4px_rgba(0,0,0,0.4)]',
        className
      )}
    >
      {/* Subtle noise texture overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='4' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      <div className="relative flex items-center h-full px-3 gap-1">
        {/* Tabs Container */}
        <div className="flex-1 flex items-center gap-1 overflow-x-auto no-scrollbar">
          {tabs.map((tab, index) => (
            <Tab
              key={tab.id}
              tab={tab}
              index={index}
              onClick={() => onTabClick?.(tab.id)}
              onClose={() => onTabClose?.(tab.id)}
              onOpenSftp={() => onOpenSftp?.(tab.id)}
              onStartRecording={() => onStartRecording?.(tab.id)}
              onStopRecording={() => onStopRecording?.(tab.id)}
              onSplitHorizontal={() => onSplitHorizontal?.(tab.id)}
              onSplitVertical={() => onSplitVertical?.(tab.id)}
              onToggleBroadcast={() => onToggleBroadcast?.(tab.id)}
            />
          ))}
        </div>

        {/* New Tab Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onNewTab}
          className={cn(
            'h-9 w-9 p-0 rounded-lg',
            'text-text-secondary hover:text-foreground',
            'hover:bg-[var(--surface-3)]',
            'transition-all duration-200',
            'hover:scale-105 active:scale-95',
            'group'
          )}
          aria-label="New Connection (Cmd+T)"
        >
          <Plus
            className="h-4 w-4 transition-transform group-hover:rotate-90 duration-300"
          />
        </Button>

        {/* Divider */}
        <div className="h-6 w-px bg-[var(--border)] mx-1" />

        {/* Action Buttons */}
        <ActionButton icon={Folder} label="Browse Hosts" shortcut="Cmd+H" onClick={onBrowseHosts} />
        <ActionButton icon={FileText} label="SFTP Browser" shortcut="Cmd+B" onClick={onBrowseFiles} />
        <ActionButton icon={Sparkles} label="Snippets" shortcut="Cmd+;" onClick={onSnippets} />
        <ActionButton icon={Key} label="SSH Keys" onClick={onKeys} />

        {/* Divider */}
        <div className="h-6 w-px bg-[var(--border)] mx-1" />

        <ActionButton icon={Search} label="Command Palette" shortcut="Cmd+K" onClick={onCommandPalette} />
        <ActionButton icon={Settings} label="Settings" shortcut="Cmd+," onClick={onSettings} />

        {/* Divider */}
        <div className="h-6 w-px bg-[var(--border)] mx-1" />

        {/* Workspace Selector */}
        {workspaces.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={(props) => (
                <Button
                  {...props}
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'h-9 px-3 rounded-lg gap-1.5',
                    'text-text-secondary hover:text-foreground',
                    'hover:bg-[var(--surface-3)]',
                    'transition-all duration-200',
                    'hover:scale-[1.02] active:scale-95',
                    'font-mono text-xs tracking-tight'
                  )}
                >
                  {currentWorkspaceLabel}
                  <ChevronDown className="h-3 w-3" />
                </Button>
              )}
            />
            <DropdownMenuContent align="end" className="w-48">
              {workspaces.map((workspace) => (
                <DropdownMenuItem
                  key={workspace.id}
                  onClick={() => onWorkspaceChange?.(workspace.id)}
                  className={cn(
                    'font-mono text-xs',
                    workspace.id === currentWorkspaceId && 'bg-[var(--surface-3)]'
                  )}
                >
                  {workspace.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Bottom glow effect on active tab */}
      <style>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
    </TooltipProvider>
  );
}

interface TabProps {
  tab: Tab;
  index: number;
  onClick: () => void;
  onClose: () => void;
  onOpenSftp?: () => void;
  onStartRecording?: () => void;
  onStopRecording?: () => void;
  onSplitHorizontal?: () => void;
  onSplitVertical?: () => void;
  onToggleBroadcast?: () => void;
}

function Tab({ tab, index, onClick, onClose, onOpenSftp, onStartRecording, onStopRecording, onSplitHorizontal, onSplitVertical, onToggleBroadcast }: TabProps) {
  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose();
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger
        render={(props) => (
          <div
            {...props}
            onClick={(event) => {
              props.onClick?.(event);
              onClick();
            }}
            className={cn(
              'relative group flex items-center gap-2 h-9 px-3 rounded-lg',
              'cursor-pointer select-none',
              'transition-all duration-200 ease-out',
              'hover:scale-[1.02] active:scale-[0.98]',
              tab.isActive && [
                'bg-[var(--surface-2)]',
                'shadow-[0_2px_12px_-2px_rgba(59,130,246,0.3)]',
              ],
              !tab.isActive && ['hover:bg-[var(--surface-2)]']
            )}
            style={{
              animation: `tabEnter 0.3s cubic-bezier(0.16, 1, 0.3, 1) ${index * 0.05}s both`,
            }}
          >
            {tab.isActive && (
              <div
                className="absolute -bottom-[1px] left-2 right-2 h-[3px] bg-primary rounded-full"
                style={{
                  boxShadow: '0 0 12px 2px rgba(59, 130, 246, 0.4)',
                  animation: 'glowPulse 2s ease-in-out infinite',
                }}
              />
            )}

            <Circle
              className={cn(
                'h-2 w-2 flex-shrink-0 transition-all duration-300',
                statusColors[tab.status],
                tab.status === 'connecting' && 'animate-pulse'
              )}
              fill="currentColor"
            />

            <span
              className={cn(
                'text-xs font-mono tracking-tight truncate max-w-[120px]',
                'transition-colors duration-200',
                tab.isActive ? 'text-primary font-medium' : 'text-foreground'
              )}
            >
              {tab.hostname || tab.title}
            </span>

            <button
              onClick={handleClose}
              className={cn(
                'flex-shrink-0 rounded-md p-0.5',
                'text-text-tertiary hover:text-foreground',
                'hover:bg-[var(--surface-3)]',
                'transition-all duration-200',
                'opacity-0 group-hover:opacity-100',
                tab.isActive && 'opacity-100',
                'hover:scale-110 active:scale-90'
              )}
              aria-label={`Close ${tab.title}`}
            >
              <X className="h-3 w-3" />
            </button>

            <style>{`
              @keyframes tabEnter {
                from {
                  opacity: 0;
                  transform: translateX(-8px) scale(0.95);
                }
                to {
                  opacity: 1;
                  transform: translateX(0) scale(1);
                }
              }

              @keyframes glowPulse {
                0%, 100% {
                  opacity: 1;
                  box-shadow: 0 0 12px 2px rgba(59, 130, 246, 0.4);
                }
                50% {
                  opacity: 0.8;
                  box-shadow: 0 0 20px 4px rgba(59, 130, 246, 0.6);
                }
              }
            `}</style>
          </div>
        )}
      />

      <ContextMenuContent className="w-56">
        <ContextMenuItem onClick={onOpenSftp} className="gap-2">
          <FolderOpen className="h-4 w-4" />
          <span>Open SFTP</span>
          <span className="ml-auto text-xs text-muted-foreground">
            {getHotkey('open-sftp')!.key.replace('mod', '⌘')}
          </span>
        </ContextMenuItem>

        <ContextMenuSeparator />

        {tab.isRecording ? (
          <ContextMenuItem onClick={onStopRecording} className="gap-2">
            <Circle className="h-4 w-4 fill-red-500 text-red-500" />
            <span>Stop Recording</span>
            <span className="ml-auto text-xs text-muted-foreground">
              {getHotkey('toggle-recording')!.key.replace('mod', '⌘')}
            </span>
          </ContextMenuItem>
        ) : (
          <ContextMenuItem onClick={onStartRecording} className="gap-2">
            <Circle className="h-4 w-4" />
            <span>Start Recording</span>
            <span className="ml-auto text-xs text-muted-foreground">
              {getHotkey('toggle-recording')!.key.replace('mod', '⌘')}
            </span>
          </ContextMenuItem>
        )}

        <ContextMenuSeparator />

        <ContextMenuItem onClick={onSplitHorizontal} className="gap-2">
          <SplitSquareHorizontal className="h-4 w-4" />
          <span>Split Horizontal</span>
          <span className="ml-auto text-xs text-muted-foreground">
            {getHotkey('split-horizontal')!.key.replace('mod', '⌘')}
          </span>
        </ContextMenuItem>

        <ContextMenuItem onClick={onSplitVertical} className="gap-2">
          <SplitSquareVertical className="h-4 w-4" />
          <span>Split Vertical</span>
          <span className="ml-auto text-xs text-muted-foreground">
            {getHotkey('split-vertical')!.key.replace('mod', '⌘')}
          </span>
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem onClick={onToggleBroadcast} className="gap-2">
          <Radio className="h-4 w-4" />
          <span>Toggle Broadcast</span>
          <span className="ml-auto text-xs text-muted-foreground">
            {getHotkey('toggle-broadcast')!.key.replace('mod', '⌘')}
          </span>
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem onClick={onClose} className="gap-2 text-destructive focus:text-destructive">
          <X className="h-4 w-4" />
          <span>Close Tab</span>
          <span className="ml-auto text-xs text-muted-foreground">
            {getHotkey('close-tab')!.key.replace('mod', '⌘')}
          </span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

interface ActionButtonProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  shortcut?: string;
  onClick?: () => void;
}

function ActionButton({ icon: Icon, label, shortcut, onClick }: ActionButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={(props) => (
          <Button
            {...props}
            variant="ghost"
            size="sm"
            onClick={onClick}
            className={cn(
              'h-9 w-9 p-0 rounded-lg',
              'text-text-secondary hover:text-foreground',
              'hover:bg-[var(--surface-3)]',
              'transition-all duration-200',
              'hover:scale-105 active:scale-95'
            )}
            aria-label={label}
          >
            <Icon className="h-4 w-4" />
          </Button>
        )}
      />
      <TooltipContent side="bottom" sideOffset={8}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-foreground">{label}</span>
          {shortcut && (
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-[var(--surface-2)] rounded border border-[var(--border)] text-text-secondary">
              {shortcut}
            </kbd>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
