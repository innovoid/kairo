import { useState, useEffect } from 'react';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useSnippetStore } from '@/stores/snippet-store';
import type { Snippet } from '@shared/types/snippets';
import { Overlay, OverlayContent, OverlayFooter, OverlayHeader } from '@/components/ui/overlay';
import { cn } from '@/lib/utils';

interface SnippetPickerOverlayProps {
  onSelect: (command: string) => void;
  onClose: () => void;
}

// Extract {{variable}} placeholders from a command string
function extractPlaceholders(command: string): string[] {
  const matches = command.matchAll(/\{\{(\w+)\}\}/g);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const m of matches) {
    if (!seen.has(m[1])) {
      seen.add(m[1]);
      result.push(m[1]);
    }
  }
  return result;
}

function fillPlaceholders(command: string, values: Record<string, string>): string {
  return command.replace(/\{\{(\w+)\}\}/g, (_, name) => values[name] ?? `{{${name}}}`);
}

export function SnippetPickerOverlay({ onSelect, onClose }: SnippetPickerOverlayProps) {
  const { snippets } = useSnippetStore();
  const [selectedSnippet, setSelectedSnippet] = useState<Snippet | null>(null);
  const [placeholderValues, setPlaceholderValues] = useState<Record<string, string>>({});
  const placeholders = selectedSnippet ? extractPlaceholders(selectedSnippet.command) : [];

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && selectedSnippet) {
        // Keep the user in snippets modal; only step back from parameter fill.
        e.preventDefault();
        e.stopPropagation();
        setSelectedSnippet(null);
      }
    }
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [selectedSnippet]);

  function handleSelectSnippet(snippet: Snippet) {
    const dynamicPlaceholders = extractPlaceholders(snippet.command);
    if (dynamicPlaceholders.length === 0) {
      onSelect(snippet.command);
      onClose();
    } else {
      setSelectedSnippet(snippet);
      const initial: Record<string, string> = {};
      for (const p of dynamicPlaceholders) initial[p] = '';
      setPlaceholderValues(initial);
    }
  }

  function handleInsertWithValues() {
    if (!selectedSnippet) return;
    const filled = fillPlaceholders(selectedSnippet.command, placeholderValues);
    onSelect(filled);
    onClose();
  }

  return (
    <Overlay open onOpenChange={(open) => !open && onClose()} className="max-w-[880px] max-h-[84vh]">
      <OverlayHeader
        title="Snippets"
        description={
          selectedSnippet
            ? `Provide values for ${selectedSnippet.name}`
            : 'Pick a snippet to insert into the active terminal'
        }
        onClose={onClose}
      />
      <OverlayContent className="pt-4">
        {selectedSnippet && placeholders.length > 0 ? (
          <div className="mx-auto max-w-2xl space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">{selectedSnippet.name}</p>
              <code className="block rounded-md border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2 text-xs font-mono text-muted-foreground">
                {selectedSnippet.command}
              </code>
            </div>
            <div className="space-y-3">
              {placeholders.map((placeholder) => (
                <div key={placeholder} className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">{placeholder}</label>
                  <Input
                    placeholder={`Enter value for {{${placeholder}}}`}
                    value={placeholderValues[placeholder] ?? ''}
                    onChange={(e) =>
                      setPlaceholderValues((v) => ({ ...v, [placeholder]: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleInsertWithValues();
                    }}
                    autoFocus={placeholder === placeholders[0]}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-1)] p-2">
            <Command className={cn('h-[520px] bg-transparent', 'border-0 shadow-none')}>
              <CommandInput placeholder="Search snippets by name, command, or tag..." />
              <CommandList className="max-h-[460px]">
                <CommandEmpty>No snippets found.</CommandEmpty>
                <CommandGroup heading="Snippets">
                  {snippets.map((snippet) => (
                    <CommandItem
                      key={snippet.id}
                      value={`${snippet.name} ${snippet.command} ${snippet.tags.join(' ')}`}
                      onSelect={() => handleSelectSnippet(snippet)}
                    >
                      <div className="flex w-full flex-col gap-0.5">
                        <span className="font-medium text-sm">{snippet.name}</span>
                        <code className="text-xs font-mono text-muted-foreground">{snippet.command}</code>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </div>
        )}
      </OverlayContent>
      <OverlayFooter>
        {selectedSnippet ? (
          <>
            <Button type="button" variant="outline" onClick={() => setSelectedSnippet(null)}>
              Back
            </Button>
            <Button type="button" onClick={handleInsertWithValues}>
              Insert
            </Button>
          </>
        ) : (
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
        )}
      </OverlayFooter>
    </Overlay>
  );
}
