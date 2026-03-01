/**
 * Returns true when a terminal textarea currently has keyboard focus.
 *
 * ghostty-web renders an invisible <textarea> as its input target.
 * We tag it with `data-no-focus-ring` in useTerminal.ts, so we can
 * detect it here without coupling to internal ghostty implementation details.
 */
export function isTerminalFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;

  const tag = el.tagName.toLowerCase();

  // The xterm / ghostty hidden textarea
  if (tag === 'textarea' && (el as HTMLElement).dataset['noFocusRing'] === 'true') {
    return true;
  }

  // Fallback: any element inside a node that carries the marker
  if ((el as HTMLElement).closest?.('[data-no-focus-ring="true"]')) {
    return true;
  }

  return false;
}
