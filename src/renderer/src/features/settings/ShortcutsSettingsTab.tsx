import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, ChevronDown, ChevronRight } from 'lucide-react';
import { HOTKEY_DEFINITIONS, type HotkeyDefinition } from '@/lib/hotkeys-registry';
import { formatShortcut } from '@/lib/shortcut-format';
import { cn } from '@/lib/utils';

export function ShortcutsSettingsTab() {
  const [search, setSearch] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['general', 'terminal', 'navigation', 'sftp', 'recording', 'broadcast'])
  );

  // Filter shortcuts by search
  const filtered = useMemo(() => {
    if (!search) return HOTKEY_DEFINITIONS;
    const lower = search.toLowerCase();
    return HOTKEY_DEFINITIONS.filter(
      (h) =>
        h.description.toLowerCase().includes(lower) ||
        h.key.toLowerCase().includes(lower) ||
        h.category.toLowerCase().includes(lower)
    );
  }, [search]);

  // Group by category
  const grouped = useMemo(() => {
    const map = new Map<string, HotkeyDefinition[]>();
    for (const hotkey of filtered) {
      if (!map.has(hotkey.category)) {
        map.set(hotkey.category, []);
      }
      map.get(hotkey.category)!.push(hotkey);
    }
    return map;
  }, [filtered]);

  function toggleCategory(category: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }

  const categories = [
    { key: 'general', label: 'General' },
    { key: 'terminal', label: 'Terminal' },
    { key: 'navigation', label: 'Navigation' },
    { key: 'sftp', label: 'SFTP' },
    { key: 'recording', label: 'Recording' },
    { key: 'broadcast', label: 'Broadcast' },
  ];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6 max-w-3xl">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-lg font-semibold mb-1">Keyboard Shortcuts</h1>
          <p className="text-sm text-muted-foreground">
            View and search all available keyboard shortcuts
          </p>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search shortcuts..."
            className="pl-9 h-9"
          />
        </div>

        {/* Shortcuts by Category */}
        <div className="space-y-2">
          {categories.map((cat) => {
            const shortcuts = grouped.get(cat.key);
            if (!shortcuts || shortcuts.length === 0) return null;

            const isExpanded = expandedCategories.has(cat.key);

            return (
              <div key={cat.key} className="border rounded-lg overflow-hidden">
                {/* Category Header */}
                <button
                  onClick={() => toggleCategory(cat.key)}
                  className={cn(
                    'w-full flex items-center justify-between px-4 py-3',
                    'hover:bg-accent/50 transition-colors'
                  )}
                >
                  <div className="flex items-center gap-2">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="font-medium text-sm">{cat.label}</span>
                    <Badge variant="secondary" className="text-xs">
                      {shortcuts.length}
                    </Badge>
                  </div>
                </button>

                {/* Shortcuts List */}
                {isExpanded && (
                  <div className="border-t">
                    {shortcuts.map((shortcut) => (
                      <div
                        key={shortcut.id}
                        className="flex items-center justify-between px-4 py-3 border-b last:border-0 hover:bg-accent/20"
                      >
                        <span className="text-sm">{shortcut.description}</span>
                        <kbd className="px-2 py-1 text-xs font-mono bg-muted rounded border">
                          {formatShortcut(shortcut.key)}
                        </kbd>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* No Results */}
        {filtered.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm text-muted-foreground">No shortcuts found</p>
          </div>
        )}
      </div>
    </div>
  );
}
