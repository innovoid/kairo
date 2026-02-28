import { X, Plus, ChevronDown, Circle, Folder, FileText, Sparkles, Key, Search, Settings, FolderOpen, SplitSquareHorizontal, SplitSquareVertical, Radio, Bot, Terminal } from 'lucide-react';
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
  onAiAgent?: () => void;
  onSettings?: () => void;
  onOpenSftp?: (tabId: string) => void;
  onStartRecording?: (tabId: string) => void;
  onStopRecording?: (tabId: string) => void;
  onSplitHorizontal?: (tabId: string) => void;
  onSplitVertical?: (tabId: string) => void;
  onToggleBroadcast?: (tabId: string) => void;
  className?: string;
}

const statusDot = {
  connected: 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]',
  connecting: 'bg-amber-400 animate-pulse',
  disconnected: 'bg-zinc-600',
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
  onAiAgent,
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
    workspaces.find((w) => w.id === currentWorkspaceId)?.name ?? 'Workspace';

  return (
    <TooltipProvider delay={300}>
      <div
        className={cn(
          'relative flex items-center w-full h-11',
          'bg-zinc-950/95 border-b border-zinc-800/60',
          'shadow-[0_1px_0_0_rgba(255,255,255,0.04)]',
          className,
        )}
      >
        {/* Left: tabs + new tab */}
        <div className="flex items-center flex-1 min-w-0 h-full pl-1 pr-1 gap-0.5 overflow-x-auto no-scrollbar">
          {tabs.length === 0 ? (
            <div className="flex items-center gap-1.5 px-3 text-zinc-600 text-xs font-mono select-none">
              <Terminal className="h-3.5 w-3.5" />
              <span>No sessions</span>
            </div>
          ) : (
            tabs.map((tab, index) => (
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
            ))
          )}

          {/* New tab */}
          <Tooltip>
            <TooltipTrigger
              render={(props) => (
                <button
                  {...props}
                  onClick={onNewTab}
                  className={cn(
                    'flex items-center justify-center h-7 w-7 rounded-md ml-0.5 shrink-0',
                    'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60',
                    'transition-all duration-150 active:scale-90',
                  )}
                  aria-label="New connection"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              )}
            />
            <TooltipContent side="bottom" sideOffset={6}>
              <span className="text-xs">New connection</span>
              <kbd className="ml-2 text-[10px] text-zinc-400 font-mono">⌘T</kbd>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Right: toolbar actions */}
        <div className="flex items-center shrink-0 h-full border-l border-zinc-800/60 px-1.5 gap-0.5">
          <ActionButton icon={Folder} label="Hosts" shortcut="⌘H" onClick={onBrowseHosts} />
          <ActionButton icon={FileText} label="SFTP" shortcut="⌘B" onClick={onBrowseFiles} />
          <ActionButton icon={Sparkles} label="Snippets" shortcut="⌘;" onClick={onSnippets} />
          <ActionButton icon={Key} label="SSH Keys" onClick={onKeys} />

          <div className="h-5 w-px bg-zinc-800/80 mx-1" />

          <ActionButton icon={Search} label="Command Palette" shortcut="⌘K" onClick={onCommandPalette} />
          <ActionButton icon={Bot} label="AI Agent" shortcut="⌘⇧A" onClick={onAiAgent} />
          <ActionButton icon={Settings} label="Settings" shortcut="⌘," onClick={onSettings} />

          {workspaces.length > 0 && (
            <>
              <div className="h-5 w-px bg-zinc-800/80 mx-1" />
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={(props) => (
                    <button
                      {...props}
                      className={cn(
                        'flex items-center gap-1 h-7 px-2.5 rounded-md',
                        'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60',
                        'font-mono text-[11px] tracking-tight transition-all duration-150',
                        'active:scale-95',
                      )}
                    >
                      <span className="max-w-[90px] truncate">{currentWorkspaceLabel}</span>
                      <ChevronDown className="h-3 w-3 shrink-0 text-zinc-600" />
                    </button>
                  )}
                />
                <DropdownMenuContent align="end" className="w-48">
                  {workspaces.map((ws) => (
                    <DropdownMenuItem
                      key={ws.id}
                      onClick={() => onWorkspaceChange?.(ws.id)}
                      className={cn(
                        'font-mono text-xs',
                        ws.id === currentWorkspaceId && 'text-emerald-400 bg-emerald-500/5',
                      )}
                    >
                      {ws.id === currentWorkspaceId && (
                        <span className="mr-2 h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block" />
                      )}
                      {ws.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>

        <style>{`
          .no-scrollbar::-webkit-scrollbar { display: none; }
          .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
          @keyframes tabIn {
            from { opacity: 0; transform: translateX(-6px) scale(0.96); }
            to   { opacity: 1; transform: translateX(0)   scale(1); }
          }
        `}</style>
      </div>
    </TooltipProvider>
  );
}

// ── Individual Tab ─────────────────────────────────────────────────────────────

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
            onClick={(e) => { props.onClick?.(e); onClick(); }}
            style={{ animation: `tabIn 0.25s cubic-bezier(0.16,1,0.3,1) ${index * 0.04}s both` }}
            className={cn(
              'group relative flex items-center gap-1.5 h-7 pl-2.5 rounded-md cursor-pointer select-none shrink-0',
              'transition-all duration-150',
              tab.isActive
                ? 'bg-zinc-800 text-zinc-100 pr-1.5'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 pr-1.5',
            )}
          >
            {/* Active left accent */}
            {tab.isActive && (
              <div className="absolute left-0 top-1 bottom-1 w-[2px] rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]" />
            )}

            {/* Status dot */}
            <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', statusDot[tab.status])} />

            {/* Recording indicator */}
            {tab.isRecording && (
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
            )}

            {/* Label */}
            <span className={cn(
              'text-[11px] font-mono tracking-tight truncate max-w-[110px]',
              tab.isActive ? 'text-zinc-100' : 'text-zinc-400 group-hover:text-zinc-300',
            )}>
              {tab.hostname || tab.title}
            </span>

            {/* Close */}
            <button
              onClick={handleClose}
              className={cn(
                'flex items-center justify-center h-4 w-4 rounded shrink-0',
                'text-zinc-600 hover:text-zinc-300 hover:bg-zinc-700',
                'transition-all duration-100',
                'opacity-0 group-hover:opacity-100',
                tab.isActive && 'opacity-60',
                'hover:!opacity-100',
              )}
              aria-label={`Close ${tab.title}`}
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </div>
        )}
      />

      <ContextMenuContent className="w-52">
        <ContextMenuItem onClick={onOpenSftp} className="gap-2 text-xs">
          <FolderOpen className="h-3.5 w-3.5" />
          Open SFTP
          <span className="ml-auto text-[10px] text-zinc-500">{getHotkey('open-sftp')?.key.replace('mod', '⌘')}</span>
        </ContextMenuItem>

        <ContextMenuSeparator />

        {tab.isRecording ? (
          <ContextMenuItem onClick={onStopRecording} className="gap-2 text-xs">
            <Circle className="h-3.5 w-3.5 fill-red-500 text-red-500" />
            Stop Recording
          </ContextMenuItem>
        ) : (
          <ContextMenuItem onClick={onStartRecording} className="gap-2 text-xs">
            <Circle className="h-3.5 w-3.5" />
            Start Recording
          </ContextMenuItem>
        )}

        <ContextMenuSeparator />

        <ContextMenuItem onClick={onSplitHorizontal} className="gap-2 text-xs">
          <SplitSquareHorizontal className="h-3.5 w-3.5" />
          Split Horizontal
          <span className="ml-auto text-[10px] text-zinc-500">{getHotkey('split-horizontal')?.key.replace('mod', '⌘')}</span>
        </ContextMenuItem>
        <ContextMenuItem onClick={onSplitVertical} className="gap-2 text-xs">
          <SplitSquareVertical className="h-3.5 w-3.5" />
          Split Vertical
          <span className="ml-auto text-[10px] text-zinc-500">{getHotkey('split-vertical')?.key.replace('mod', '⌘')}</span>
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem onClick={onToggleBroadcast} className="gap-2 text-xs">
          <Radio className="h-3.5 w-3.5" />
          Toggle Broadcast
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem onClick={onClose} className="gap-2 text-xs text-red-400 focus:text-red-400">
          <X className="h-3.5 w-3.5" />
          Close Tab
          <span className="ml-auto text-[10px] text-zinc-500">{getHotkey('close-tab')?.key.replace('mod', '⌘')}</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

// ── Action Button ──────────────────────────────────────────────────────────────

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
          <button
            {...props}
            onClick={onClick}
            className={cn(
              'flex items-center justify-center h-7 w-7 rounded-md',
              'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60',
              'transition-all duration-150 active:scale-90',
            )}
            aria-label={label}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        )}
      />
      <TooltipContent side="bottom" sideOffset={6}>
        <div className="flex items-center gap-2">
          <span className="text-xs">{label}</span>
          {shortcut && (
            <kbd className="text-[10px] text-zinc-400 font-mono">{shortcut}</kbd>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
