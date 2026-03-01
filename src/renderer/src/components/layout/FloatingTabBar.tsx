import { useEffect, useState } from 'react';
import { X, Plus, ChevronDown, Circle, Folder, FileText, Sparkles, Key, Search, Settings, FolderOpen, SplitSquareHorizontal, SplitSquareVertical, Radio, Bot, Terminal, HeartPulse } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getHotkey } from '@/lib/hotkeys-registry';
import { formatShortcut } from '@/lib/shortcut-format';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { deriveKeepaliveState, formatAge, formatLatency } from '@/features/terminal/session-health';

interface Tab {
  id: string;
  title: string;
  hostname?: string;
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
  isActive: boolean;
  sessionId?: string;
  isRecording?: boolean;
  reconnectAttempts?: number;
  disconnectReason?: string;
  connectLatencyMs?: number;
  lastActivityAt?: number;
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
  connected: 'bg-success shadow-[0_0_6px_var(--primary-glow)]',
  connecting: 'bg-amber-400 animate-pulse',
  disconnected: 'bg-text-disabled',
  error: 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.7)]',
};

function getShortcutLabel(hotkeyId: string): string {
  return formatShortcut(getHotkey(hotkeyId)?.key);
}

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
  const activeTab = tabs.find((tab) => tab.isActive);

  return (
    <TooltipProvider delay={300}>
      <div
        className={cn(
          'relative flex items-center w-full h-11',
          'bg-background/95 border-b border-border-subtle/60',
          'shadow-[0_1px_0_0_rgba(255,255,255,0.04)]',
          className,
        )}
      >
        {/* Left: tabs + new tab */}
        <div className="flex items-center flex-1 min-w-0 h-full pl-1 pr-1 gap-0.5 overflow-x-auto no-scrollbar">
          {tabs.length === 0 ? (
            <div className="flex items-center gap-1.5 px-3 text-text-disabled text-xs font-mono select-none">
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
                    'text-text-tertiary hover:text-text-secondary hover:bg-surface-3/60',
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
              <kbd className="ml-2 text-[10px] text-text-secondary font-mono">{getShortcutLabel('new-tab')}</kbd>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Right: toolbar actions */}
        <div className="flex items-center shrink-0 h-full border-l border-border-subtle/60 px-1.5 gap-0.5">
          <ActionButton icon={Folder} label="Hosts" shortcut={getShortcutLabel('browse-hosts')} onClick={onBrowseHosts} />
          <ActionButton icon={FileText} label="SFTP" shortcut={getShortcutLabel('browse-files')} onClick={onBrowseFiles} />
          <ActionButton icon={Sparkles} label="Snippets" shortcut={getShortcutLabel('snippets')} onClick={onSnippets} />
          <ActionButton icon={Key} label="SSH Keys" onClick={onKeys} />
          <ConnectionHealthButton tab={activeTab} />

          <div className="h-5 w-px bg-border/80 mx-1" />

          <ActionButton icon={Search} label="Command Palette" shortcut={getShortcutLabel('command-palette')} onClick={onCommandPalette} />
          <ActionButton icon={Bot} label="AI Agent" shortcut={getShortcutLabel('ai-agent')} onClick={onAiAgent} />
          <ActionButton icon={Settings} label="Settings" shortcut={getShortcutLabel('settings')} onClick={onSettings} />

          {workspaces.length > 0 && (
            <>
              <div className="h-5 w-px bg-border/80 mx-1" />
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={(props) => (
                    <button
                      {...props}
                      className={cn(
                        'flex items-center gap-1 h-7 px-2.5 rounded-md',
                        'text-text-secondary hover:text-foreground hover:bg-surface-3/60',
                        'font-mono text-[11px] tracking-tight transition-all duration-150',
                        'active:scale-95',
                      )}
                    >
                      <span className="max-w-[90px] truncate">{currentWorkspaceLabel}</span>
                      <ChevronDown className="h-3 w-3 shrink-0 text-text-disabled" />
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
                        ws.id === currentWorkspaceId && 'text-primary bg-primary/5',
                      )}
                    >
                      {ws.id === currentWorkspaceId && (
                        <span className="mr-2 h-1.5 w-1.5 rounded-full bg-primary inline-block" />
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

const keepaliveStateTone: Record<ReturnType<typeof deriveKeepaliveState>, { text: string; dot: string }> = {
  healthy: { text: 'Healthy', dot: 'bg-success' },
  degraded: { text: 'Degraded', dot: 'bg-amber-400' },
  failed: { text: 'Failed', dot: 'bg-red-400' },
  unknown: { text: 'Unknown', dot: 'bg-text-tertiary' },
};

function ConnectionHealthButton({ tab }: { tab?: Tab }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!tab?.sessionId) return null;

  const keepalive = deriveKeepaliveState({
    status: tab.status,
    disconnectReason: tab.disconnectReason,
    lastActivityAt: tab.lastActivityAt,
    now,
  });
  const keepaliveTone = keepaliveStateTone[keepalive];
  const reconnectAttempts = tab.reconnectAttempts ?? 0;

  return (
    <Popover>
      <PopoverTrigger
        render={(popoverProps) => (
          <Button
            {...popoverProps}
            variant="ghost"
            size="sm"
            className={cn(
              'h-7 w-7 px-0',
              tab.status === 'connected' && keepalive === 'healthy' && 'text-text-tertiary hover:text-primary',
              tab.status !== 'connected' && 'text-text-tertiary hover:text-foreground',
            )}
            aria-label="Connection health"
            title="Connection health"
          >
            <HeartPulse className="h-3.5 w-3.5" />
          </Button>
        )}
      />
      <PopoverContent align="end" className="w-72 p-3 border-border bg-background text-foreground">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Session health</div>
            <div className="text-[10px] text-text-tertiary font-mono">{tab.sessionId.slice(0, 8)}</div>
          </div>

          <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-xs">
            <span className="text-text-tertiary">Status</span>
            <span className="capitalize">{tab.status}</span>

            <span className="text-text-tertiary">Connect latency</span>
            <span className="font-mono">{formatLatency(tab.connectLatencyMs)}</span>

            <span className="text-text-tertiary">Last activity</span>
            <span className="font-mono">{formatAge(tab.lastActivityAt, now)}</span>

            <span className="text-text-tertiary">Reconnects</span>
            <span className="font-mono">{reconnectAttempts}</span>

            <span className="text-text-tertiary">Keepalive</span>
            <span className="inline-flex items-center gap-1.5">
              <span className={cn('h-1.5 w-1.5 rounded-full', keepaliveTone.dot)} />
              <span>{keepaliveTone.text}</span>
            </span>
          </div>

          {tab.disconnectReason && (
            <div className="rounded-md border border-border bg-surface-1/70 px-2 py-1.5">
              <div className="text-[10px] uppercase tracking-wide text-text-tertiary mb-1">Last disconnect reason</div>
              <p className="text-[11px] text-text-secondary leading-snug break-words">{tab.disconnectReason}</p>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
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
                ? 'bg-surface-3 text-foreground pr-1.5'
                : 'text-text-tertiary hover:text-text-secondary hover:bg-surface-3/50 pr-1.5',
            )}
          >
            {/* Active left accent */}
            {tab.isActive && (
              <div className="absolute left-0 top-1 bottom-1 w-[2px] rounded-full bg-primary shadow-[0_0_8px_var(--primary-glow)]" />
            )}

            {/* Status dot */}
            <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', statusDot[tab.status])} />

            {/* Recording indicator */}
            {tab.isRecording && (
              <span className="flex items-center gap-1 shrink-0">
                <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-[9px] font-bold text-red-500 tracking-wider">REC</span>
              </span>
            )}

            {/* Label */}
            <span className={cn(
              'text-[11px] font-mono tracking-tight truncate max-w-[110px]',
              tab.isActive ? 'text-foreground' : 'text-text-secondary group-hover:text-text-secondary',
            )}>
              {tab.hostname || tab.title}
            </span>

            {/* Close */}
            <button
              onClick={handleClose}
              className={cn(
                'flex items-center justify-center h-4 w-4 rounded shrink-0',
                'text-text-disabled hover:text-text-secondary hover:bg-surface-3',
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
          <span className="ml-auto text-[10px] text-text-tertiary">{getShortcutLabel('open-sftp')}</span>
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
          <span className="ml-auto text-[10px] text-text-tertiary">{getShortcutLabel('split-horizontal')}</span>
        </ContextMenuItem>
        <ContextMenuItem onClick={onSplitVertical} className="gap-2 text-xs">
          <SplitSquareVertical className="h-3.5 w-3.5" />
          Split Vertical
          <span className="ml-auto text-[10px] text-text-tertiary">{getShortcutLabel('split-vertical')}</span>
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
          <span className="ml-auto text-[10px] text-text-tertiary">{getShortcutLabel('close-tab')}</span>
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
              'text-text-tertiary hover:text-text-secondary hover:bg-surface-3/60',
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
            <kbd className="text-[10px] text-text-secondary font-mono">{shortcut}</kbd>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
