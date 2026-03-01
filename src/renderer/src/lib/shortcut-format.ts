const MAC_PLATFORM_PATTERN = /Mac|iPhone|iPod|iPad/i;

function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  return MAC_PLATFORM_PATTERN.test(navigator.platform);
}

function normalizePart(part: string): string {
  const normalized = part.trim().toLowerCase();
  if (normalized === 'cmd' || normalized === 'command' || normalized === 'meta' || normalized === '⌘') {
    return 'mod';
  }
  if (normalized === 'option' || normalized === 'opt') {
    return 'alt';
  }
  return normalized;
}

function formatPart(part: string, isMac: boolean): string {
  switch (part) {
    case 'mod':
      return isMac ? '⌘' : 'Ctrl';
    case 'shift':
      return isMac ? '⇧' : 'Shift';
    case 'alt':
      return isMac ? '⌥' : 'Alt';
    case 'ctrl':
      return 'Ctrl';
    case 'enter':
      return isMac ? '↵' : 'Enter';
    case 'space':
      return 'Space';
    default:
      return part.length === 1 ? part.toUpperCase() : part[0].toUpperCase() + part.slice(1);
  }
}

export function formatShortcut(shortcut?: string | null): string {
  if (!shortcut) return '';
  const isMac = isMacPlatform();
  const parts = shortcut
    .split('+')
    .map(normalizePart)
    .filter(Boolean)
    .map((part) => formatPart(part, isMac));

  return parts.join(isMac ? '' : '+');
}

