import * as React from 'react';
import { Search, Terminal, Folder, Sparkles, Key, Settings, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

interface Command {
  id: string;
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  category: string;
  keywords?: string[];
  shortcut?: string;
  onExecute: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commands: Command[];
  placeholder?: string;
  className?: string;
}

const categoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  hosts: Folder,
  terminal: Terminal,
  snippets: Sparkles,
  keys: Key,
  settings: Settings,
  actions: Zap,
};

const categoryColors: Record<string, string> = {
  hosts: 'text-primary',
  terminal: 'text-cyan-400',
  snippets: 'text-purple-400',
  keys: 'text-amber-400',
  settings: 'text-emerald-400',
  actions: 'text-rose-400',
};

export function CommandPalette({
  open,
  onOpenChange,
  commands,
  placeholder = 'Search commands, hosts, and actions...',
  className,
}: CommandPaletteProps) {
  const [search, setSearch] = React.useState('');
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Filter commands based on search
  const filteredCommands = React.useMemo(() => {
    if (!search) return commands;

    const searchLower = search.toLowerCase();
    return commands.filter(
      (cmd) =>
        cmd.title.toLowerCase().includes(searchLower) ||
        cmd.description?.toLowerCase().includes(searchLower) ||
        cmd.keywords?.some((kw) => kw.toLowerCase().includes(searchLower))
    );
  }, [commands, search]);

  // Group commands by category
  const groupedCommands = React.useMemo(() => {
    const groups: Record<string, Command[]> = {};
    filteredCommands.forEach((cmd) => {
      if (!groups[cmd.category]) {
        groups[cmd.category] = [];
      }
      groups[cmd.category].push(cmd);
    });
    return groups;
  }, [filteredCommands]);

  // Reset selection when search changes
  React.useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  // Focus input when opened
  React.useEffect(() => {
    if (open) {
      // Use setTimeout to ensure DOM is ready and input is rendered
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      setSearch('');
      setSelectedIndex(0);
    }
  }, [open]);

  // Keyboard navigation
  React.useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onOpenChange(false);
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < filteredCommands.length - 1 ? prev + 1 : prev
        );
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        const selectedCommand = filteredCommands[selectedIndex];
        if (selectedCommand) {
          selectedCommand.onExecute();
          onOpenChange(false);
        }
      }

      // Cmd+1-9 for quick access
      if ((e.metaKey || e.ctrlKey) && /^[1-9]$/.test(e.key)) {
        e.preventDefault();
        const index = parseInt(e.key) - 1;
        if (index < filteredCommands.length) {
          filteredCommands[index].onExecute();
          onOpenChange(false);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, filteredCommands, selectedIndex, onOpenChange]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={() => onOpenChange(false)}
      />

      {/* Command Palette */}
      <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] pointer-events-none">
        <div
          className={cn(
            'w-full max-w-[680px] mx-4',
            'bg-[var(--surface-4)]/98 backdrop-blur-2xl',
            'border border-[var(--border)]',
            'rounded-2xl',
            'shadow-[0_32px_128px_-16px_rgba(0,0,0,0.9),0_0_0_1px_rgba(59,130,246,0.15)]',
            'overflow-hidden',
            'pointer-events-auto',
            className
          )}
          style={{
            animation: 'paletteEnter 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          }}
        >
          {/* Noise texture */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.015]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='4' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
            }}
          />

          {/* Top gradient glow */}
          <div className="absolute top-0 left-0 right-0 h-px">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent blur-sm" />
          </div>

          <div className="relative">
            {/* Search Input */}
            <div className="px-6 py-6 border-b border-[var(--border-subtle)]">
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0 flex items-center justify-center h-11 w-11 rounded-xl bg-gradient-to-br from-primary/20 to-cyan-400/20 border border-primary/30">
                  <Search className="h-5 w-5 text-primary" />
                </div>
                <Input
                  ref={inputRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={placeholder}
                  className={cn(
                    'flex-1 !bg-transparent border-0 p-0 h-auto',
                    'text-lg font-normal tracking-tight text-foreground',
                    'placeholder:text-text-disabled placeholder:font-normal',
                    'focus-visible:ring-0 focus-visible:ring-offset-0',
                    'focus-visible:border-0',
                    'py-2'
                  )}
                />
                <kbd className="flex-shrink-0 px-2.5 py-1.5 text-[10px] font-mono font-semibold bg-[var(--surface-2)] rounded-lg border border-[var(--border)] text-text-secondary tracking-wide">
                  ESC
                </kbd>
              </div>
            </div>

            {/* Results */}
            <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
              {Object.keys(groupedCommands).length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-[var(--surface-2)] mb-4">
                    <Search className="h-7 w-7 text-text-disabled" />
                  </div>
                  <p className="text-sm text-text-secondary font-medium mb-1">No results found</p>
                  <p className="text-xs text-text-tertiary">Try searching for something else</p>
                </div>
              ) : (
                <div className="py-2">
                  {Object.entries(groupedCommands).map(([category, categoryCommands], groupIndex) => (
                    <div key={category} className="mb-2 last:mb-0">
                      <div
                        className="px-6 py-2 flex items-center gap-2"
                        style={{
                          animation: `categoryEnter 0.3s cubic-bezier(0.16, 1, 0.3, 1) ${0.1 + groupIndex * 0.05}s both`,
                        }}
                      >
                        <div className={cn(
                          'flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest',
                          categoryColors[category] || 'text-text-secondary'
                        )}>
                          {React.createElement(categoryIcons[category] || Terminal, {
                            className: 'h-3.5 w-3.5'
                          })}
                          <span>{category}</span>
                        </div>
                        <div className="flex-1 h-px bg-gradient-to-r from-[var(--border-subtle)] to-transparent" />
                      </div>
                      <div className="space-y-0.5 px-2">
                        {categoryCommands.map((command, cmdIndex) => {
                          const globalIndex = filteredCommands.indexOf(command);
                          const isSelected = globalIndex === selectedIndex;
                          const Icon = command.icon || categoryIcons[category] || Terminal;

                          return (
                            <CommandItem
                              key={command.id}
                              command={command}
                              icon={Icon}
                              isSelected={isSelected}
                              index={cmdIndex}
                              categoryColor={categoryColors[category] || 'text-text-secondary'}
                              onClick={() => {
                                command.onExecute();
                                onOpenChange(false);
                              }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer hint */}
            <div className="flex items-center justify-between px-6 py-3 border-t border-[var(--border-subtle)] bg-[var(--surface-1)]/30">
              <div className="flex items-center gap-4 text-[11px] text-text-tertiary">
                <div className="flex items-center gap-1.5">
                  <kbd className="px-1.5 py-0.5 font-mono font-semibold bg-[var(--surface-2)] rounded border border-[var(--border)] text-text-secondary">↑↓</kbd>
                  <span>Navigate</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <kbd className="px-1.5 py-0.5 font-mono font-semibold bg-[var(--surface-2)] rounded border border-[var(--border)] text-text-secondary">↵</kbd>
                  <span>Execute</span>
                </div>
              </div>
              <span className="text-[11px] text-text-tertiary">
                <kbd className="px-1.5 py-0.5 font-mono font-semibold bg-[var(--surface-2)] rounded border border-[var(--border)] text-text-secondary">⌘1-9</kbd>
                {' '}quick access
              </span>
            </div>
          </div>

          <style jsx>{`
            @keyframes paletteEnter {
              from {
                opacity: 0;
                transform: scale(0.97) translateY(-12px);
                filter: blur(6px);
              }
              to {
                opacity: 1;
                transform: scale(1) translateY(0);
                filter: blur(0);
              }
            }

            @keyframes categoryEnter {
              from {
                opacity: 0;
                transform: translateX(-8px);
              }
              to {
                opacity: 1;
                transform: translateX(0);
              }
            }
          `}</style>
        </div>
      </div>
    </>
  );
}

interface CommandItemProps {
  command: Command;
  icon: React.ComponentType<{ className?: string }>;
  isSelected: boolean;
  index: number;
  categoryColor: string;
  onClick: () => void;
}

function CommandItem({ command, icon: Icon, isSelected, index, categoryColor, onClick }: CommandItemProps) {
  const ref = React.useRef<HTMLDivElement>(null);

  // Scroll into view when selected
  React.useEffect(() => {
    if (isSelected && ref.current) {
      ref.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [isSelected]);

  return (
    <div
      ref={ref}
      onClick={onClick}
      className={cn(
        'group relative flex items-center gap-3 px-4 py-3 rounded-xl',
        'cursor-pointer select-none',
        'transition-all duration-200',
        isSelected ? [
          'bg-gradient-to-r from-primary/10 via-primary/5 to-transparent',
          'shadow-[inset_0_0_20px_rgba(59,130,246,0.08)]',
          'border-l-2 border-l-primary',
        ] : [
          'border-l-2 border-l-transparent',
          'hover:bg-[var(--surface-3)]',
        ]
      )}
      style={{
        animation: `itemEnter 0.3s cubic-bezier(0.16, 1, 0.3, 1) ${0.15 + index * 0.025}s both`,
      }}
    >
      {/* Icon */}
      <div
        className={cn(
          'flex-shrink-0 flex items-center justify-center',
          'h-9 w-9 rounded-lg',
          'transition-all duration-300',
          isSelected ? [
            'bg-primary/15',
            'border border-primary/30',
            'scale-110 shadow-[0_0_20px_rgba(59,130,246,0.2)]',
          ] : [
            'bg-[var(--surface-2)]',
            'border border-[var(--border)]',
            'group-hover:bg-[var(--surface-1)]',
            'group-hover:border-primary/20',
            'group-hover:scale-105',
          ]
        )}
      >
        <Icon
          className={cn(
            'h-4 w-4 transition-colors duration-300',
            isSelected ? 'text-primary' : 'text-text-secondary group-hover:text-primary'
          )}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span
            className={cn(
              'text-sm font-medium tracking-tight truncate',
              'transition-colors duration-200',
              isSelected ? 'text-foreground' : 'text-foreground'
            )}
          >
            {command.title}
          </span>
        </div>
        {command.description && (
          <p className="text-xs text-text-tertiary truncate leading-tight">
            {command.description}
          </p>
        )}
      </div>

      {/* Shortcut */}
      {command.shortcut && (
        <kbd
          className={cn(
            'flex-shrink-0 px-2 py-1 text-[10px] font-mono font-semibold',
            'rounded-md border',
            'transition-all duration-200',
            isSelected ? [
              'bg-primary/10',
              'border-primary/40',
              'text-primary',
              'shadow-[0_0_8px_rgba(59,130,246,0.2)]',
            ] : [
              'bg-[var(--surface-2)]',
              'border-[var(--border)]',
              'text-text-secondary',
              'group-hover:border-primary/20',
            ]
          )}
        >
          {command.shortcut}
        </kbd>
      )}

      {/* Selection indicator glow */}
      {isSelected && (
        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary/5 to-transparent pointer-events-none" />
      )}

      <style jsx>{`
        @keyframes itemEnter {
          from {
            opacity: 0;
            transform: translateX(-6px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
}
