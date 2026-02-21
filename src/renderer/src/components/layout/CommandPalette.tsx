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

export function CommandPalette({
  open,
  onOpenChange,
  commands,
  placeholder = 'Search hosts, snippets, commands...',
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
      inputRef.current?.focus();
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
        className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-200"
        onClick={() => onOpenChange(false)}
      />

      {/* Command Palette */}
      <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] pointer-events-none">
        <div
          className={cn(
            'w-full max-w-[600px] mx-4',
            'bg-[var(--surface-4)]/95 backdrop-blur-2xl',
            'border border-[var(--border)]',
            'rounded-xl',
            'shadow-[0_32px_128px_-16px_rgba(0,0,0,0.8),0_0_0_1px_rgba(59,130,246,0.1)]',
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
            className="absolute inset-0 pointer-events-none opacity-[0.03]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='4' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
            }}
          />

          {/* Top glow */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

          <div className="relative">
            {/* Search Input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-subtle)]">
              <Search className="h-5 w-5 text-text-tertiary flex-shrink-0" />
              <Input
                ref={inputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={placeholder}
                className={cn(
                  'flex-1 !bg-transparent border-0 p-0 h-auto',
                  'text-base font-mono tracking-tight text-foreground',
                  'placeholder:text-text-disabled',
                  'focus-visible:ring-0 focus-visible:ring-offset-0',
                  'focus-visible:border-0'
                )}
              />
              <kbd className="px-2 py-1 text-[10px] font-mono bg-[var(--surface-2)] rounded border border-[var(--border)] text-text-secondary">
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div className="max-h-[60vh] overflow-y-auto">
              {Object.keys(groupedCommands).length === 0 ? (
                <div className="p-8 text-center text-text-secondary">
                  <Search className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No results found for "{search}"</p>
                </div>
              ) : (
                Object.entries(groupedCommands).map(([category, categoryCommands], groupIndex) => (
                  <div key={category}>
                    <div
                      className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-text-secondary bg-[var(--surface-1)]/50"
                      style={{
                        animation: `categoryEnter 0.3s cubic-bezier(0.16, 1, 0.3, 1) ${0.1 + groupIndex * 0.05}s both`,
                      }}
                    >
                      {category}
                    </div>
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
                          onClick={() => {
                            command.onExecute();
                            onOpenChange(false);
                          }}
                        />
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            {/* Footer hint */}
            <div className="flex items-center justify-between px-4 py-2 border-t border-[var(--border-subtle)] bg-[var(--surface-1)]/50 text-[10px] text-text-tertiary">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 font-mono bg-[var(--surface-2)] rounded border border-[var(--border)]">↑↓</kbd>
                  Navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 font-mono bg-[var(--surface-2)] rounded border border-[var(--border)]">↵</kbd>
                  Execute
                </span>
              </div>
              <span>Cmd+1-9 for quick access</span>
            </div>
          </div>

          <style jsx>{`
            @keyframes paletteEnter {
              from {
                opacity: 0;
                transform: scale(0.96) translateY(-8px);
                filter: blur(4px);
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
                transform: translateX(-4px);
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
  onClick: () => void;
}

function CommandItem({ command, icon: Icon, isSelected, index, onClick }: CommandItemProps) {
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
        'flex items-center gap-3 px-4 py-3',
        'cursor-pointer select-none',
        'transition-all duration-200',
        'border-l-2',
        isSelected ? [
          'bg-[var(--surface-3)]',
          'border-l-primary',
          'shadow-[inset_0_0_16px_rgba(59,130,246,0.1)]',
        ] : [
          'border-l-transparent',
          'hover:bg-[var(--surface-2)]',
        ]
      )}
      style={{
        animation: `itemEnter 0.3s cubic-bezier(0.16, 1, 0.3, 1) ${0.15 + index * 0.03}s both`,
      }}
    >
      <div
        className={cn(
          'flex-shrink-0 flex items-center justify-center',
          'h-8 w-8 rounded-lg',
          'transition-all duration-300',
          isSelected ? [
            'bg-primary/20',
            'text-primary',
            'scale-110',
          ] : [
            'bg-[var(--surface-2)]',
            'text-text-secondary',
          ]
        )}
      >
        <Icon className="h-4 w-4" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'text-sm font-mono tracking-tight truncate',
              'transition-colors duration-200',
              isSelected ? 'text-foreground font-medium' : 'text-text-secondary'
            )}
          >
            {command.title}
          </span>
        </div>
        {command.description && (
          <p className="text-xs text-text-tertiary truncate mt-0.5">
            {command.description}
          </p>
        )}
      </div>

      {command.shortcut && (
        <kbd
          className={cn(
            'flex-shrink-0 px-2 py-1 text-[10px] font-mono',
            'rounded border',
            'transition-all duration-200',
            isSelected ? [
              'bg-primary/10',
              'border-primary/30',
              'text-primary',
            ] : [
              'bg-[var(--surface-2)]',
              'border-[var(--border)]',
              'text-text-secondary',
            ]
          )}
        >
          {command.shortcut}
        </kbd>
      )}

      <style jsx>{`
        @keyframes itemEnter {
          from {
            opacity: 0;
            transform: translateX(-4px);
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
