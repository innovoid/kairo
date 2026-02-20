import { useEffect, useState } from 'react';

export interface UseCommandPaletteReturn {
  open: boolean;
  setOpen: (open: boolean) => void;
}

/**
 * Hook to manage command palette state and keyboard shortcuts
 * Listens for Cmd+K (Mac) or Ctrl+K (Windows/Linux) to toggle the palette
 */
export function useCommandPalette(): UseCommandPaletteReturn {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Check for Cmd+K (Mac) or Ctrl+K (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return { open, setOpen };
}
