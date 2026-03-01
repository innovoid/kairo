export interface HotkeyDefinition {
  id: string;
  key: string; // TanStack format: "mod+k", "mod+shift+f"
  description: string;
  category: 'general' | 'terminal' | 'navigation' | 'sftp' | 'recording' | 'broadcast';
}

export type HotkeyHandlers = Record<string, () => void>;

export const HOTKEY_DEFINITIONS: HotkeyDefinition[] = [
  // General
  { id: 'command-palette', key: 'mod+k', description: 'Open command palette', category: 'general' },
  { id: 'settings', key: 'mod+,', description: 'Open settings', category: 'general' },
  { id: 'ai-agent', key: 'mod+shift+a', description: 'Open AI agent sidebar', category: 'general' },

  // Terminal
  { id: 'new-tab', key: 'mod+t', description: 'New terminal connection', category: 'terminal' },
  { id: 'close-tab', key: 'mod+w', description: 'Close active tab', category: 'terminal' },
  { id: 'local-terminal', key: 'mod+l', description: 'Open local terminal', category: 'terminal' },
  { id: 'search', key: 'mod+f', description: 'Search in terminal', category: 'terminal' },
  { id: 'split-horizontal', key: 'mod+d', description: 'Split pane horizontally', category: 'terminal' },
  { id: 'split-vertical', key: 'mod+shift+d', description: 'Split pane vertically', category: 'terminal' },
  { id: 'snippet-picker', key: 'mod+shift+s', description: 'Open snippet picker', category: 'terminal' },

  // Navigation
  { id: 'browse-hosts', key: 'mod+h', description: 'Browse hosts', category: 'navigation' },
  { id: 'browse-files', key: 'mod+b', description: 'Open SFTP browser', category: 'navigation' },
  { id: 'snippets', key: 'mod+;', description: 'Open snippets', category: 'navigation' },

  // SFTP
  { id: 'open-sftp', key: 'mod+shift+f', description: 'Open SFTP for active tab', category: 'sftp' },

  // Recording
  { id: 'toggle-recording', key: 'mod+shift+r', description: 'Start/stop recording', category: 'recording' },

  // Broadcast
  { id: 'toggle-broadcast', key: 'mod+shift+b', description: 'Toggle broadcast mode', category: 'broadcast' },
];

export function getHotkey(id: string): HotkeyDefinition | undefined {
  return HOTKEY_DEFINITIONS.find((h) => h.id === id);
}

export function getHotkeysByCategory(category: HotkeyDefinition['category']): HotkeyDefinition[] {
  return HOTKEY_DEFINITIONS.filter((h) => h.category === category);
}
