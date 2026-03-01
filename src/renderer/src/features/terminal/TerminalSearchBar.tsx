import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ChevronUp, ChevronDown, X, CaseSensitive, Regex } from 'lucide-react';
import type { TerminalSearchApi } from './terminal-search';

interface TerminalSearchBarProps {
  searchAddon: TerminalSearchApi | null;
  onClose: () => void;
}

export function TerminalSearchBar({ searchAddon, onClose }: TerminalSearchBarProps) {
  const [query, setQuery] = useState('');
  const [useRegex, setUseRegex] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function findNext() {
    if (query) searchAddon?.findNext(query, { regex: useRegex, caseSensitive });
  }
  function findPrev() {
    if (query) searchAddon?.findPrevious(query, { regex: useRegex, caseSensitive });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.shiftKey ? findPrev() : findNext(); }
    if (e.key === 'Escape') onClose();
  }

  return (
    <div className="absolute top-2 right-2 z-10 flex items-center gap-1 bg-background border rounded-md shadow-lg px-2 py-1">
      <Input
        ref={inputRef}
        className="h-7 w-48 text-sm"
        placeholder="Find in terminal..."
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          if (e.target.value) searchAddon?.findNext(e.target.value, { regex: useRegex, caseSensitive });
        }}
        onKeyDown={handleKeyDown}
      />
      <Button size="icon" variant={caseSensitive ? 'secondary' : 'ghost'} className="h-7 w-7" onClick={() => setCaseSensitive(!caseSensitive)} title="Case sensitive">
        <CaseSensitive className="h-3.5 w-3.5" />
      </Button>
      <Button size="icon" variant={useRegex ? 'secondary' : 'ghost'} className="h-7 w-7" onClick={() => setUseRegex(!useRegex)} title="Use regex">
        <Regex className="h-3.5 w-3.5" />
      </Button>
      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={findPrev} title="Previous match">
        <ChevronUp className="h-3.5 w-3.5" />
      </Button>
      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={findNext} title="Next match">
        <ChevronDown className="h-3.5 w-3.5" />
      </Button>
      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onClose} title="Close">
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
