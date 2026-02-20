import { useState, useEffect } from 'react';
import {
  Command,
  CommandDialog,
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

  // Close on Escape
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (selectedSnippet) {
          setSelectedSnippet(null);
        } else {
          onClose();
        }
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedSnippet, onClose]);

  function handleSelectSnippet(snippet: Snippet) {
    const placeholders = extractPlaceholders(snippet.command);
    if (placeholders.length === 0) {
      onSelect(snippet.command);
    } else {
      setSelectedSnippet(snippet);
      const initial: Record<string, string> = {};
      for (const p of placeholders) initial[p] = '';
      setPlaceholderValues(initial);
    }
  }

  function handleInsertWithValues() {
    if (!selectedSnippet) return;
    const filled = fillPlaceholders(selectedSnippet.command, placeholderValues);
    onSelect(filled);
  }

  if (selectedSnippet && placeholders.length > 0) {
    return (
      <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="bg-background border rounded-xl shadow-lg p-5 w-96 flex flex-col gap-4">
          <div>
            <p className="text-sm font-medium mb-1">{selectedSnippet.name}</p>
            <code className="text-xs font-mono text-muted-foreground bg-muted/40 px-2 py-1 rounded block">
              {selectedSnippet.command}
            </code>
          </div>
          <div className="flex flex-col gap-2">
            {placeholders.map((placeholder) => (
              <div key={placeholder} className="flex flex-col gap-1">
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
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setSelectedSnippet(null)}>
              Back
            </Button>
            <Button size="sm" onClick={handleInsertWithValues}>
              Insert
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <CommandDialog open onOpenChange={(open) => { if (!open) onClose(); }} title="Snippets" description="Pick a snippet to insert into the terminal">
      <Command>
        <CommandInput placeholder="Search snippets..." />
        <CommandList>
          <CommandEmpty>No snippets found.</CommandEmpty>
          <CommandGroup heading="Snippets">
            {snippets.map((snippet) => (
              <CommandItem
                key={snippet.id}
                value={`${snippet.name} ${snippet.command} ${snippet.tags.join(' ')}`}
                onSelect={() => handleSelectSnippet(snippet)}
              >
                <div className="flex flex-col gap-0.5 w-full">
                  <span className="font-medium text-sm">{snippet.name}</span>
                  <code className="text-xs font-mono text-muted-foreground">{snippet.command}</code>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
