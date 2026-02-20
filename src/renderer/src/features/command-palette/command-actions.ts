import type { Host } from '@shared/types/hosts';
import { Terminal, Settings, Key, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface CommandAction {
  id: string;
  label: string;
  description?: string;
  icon: LucideIcon;
  onSelect: () => void;
  keywords?: string[];
}

export interface GetHostActionsParams {
  hosts: Host[];
  onConnectHost: (hostId: string) => void;
}

export interface GetNavigationActionsParams {
  onOpenSettings: () => void;
  onOpenKeys: () => void;
  hasActiveSessions: boolean;
  onDisconnectAll?: () => void;
}

/**
 * Get command actions for connecting to hosts
 */
export function getHostActions({ hosts, onConnectHost }: GetHostActionsParams): CommandAction[] {
  return hosts.map((host) => ({
    id: `connect-${host.id}`,
    label: `Connect to ${host.label}`,
    description: host.hostname,
    icon: Terminal,
    onSelect: () => onConnectHost(host.id),
    keywords: [host.label, host.hostname, host.username, 'connect', 'ssh'],
  }));
}

/**
 * Get navigation and utility command actions
 */
export function getNavigationActions({
  onOpenSettings,
  onOpenKeys,
  hasActiveSessions,
  onDisconnectAll,
}: GetNavigationActionsParams): CommandAction[] {
  const actions: CommandAction[] = [
    {
      id: 'open-settings',
      label: 'Open Settings',
      icon: Settings,
      onSelect: onOpenSettings,
      keywords: ['settings', 'preferences', 'config'],
    },
    {
      id: 'manage-keys',
      label: 'Manage SSH Keys',
      icon: Key,
      onSelect: onOpenKeys,
      keywords: ['ssh', 'keys', 'manage', 'key'],
    },
  ];

  // Add disconnect all action only if there are active sessions
  if (hasActiveSessions && onDisconnectAll) {
    actions.push({
      id: 'disconnect-all',
      label: 'Disconnect All',
      icon: X,
      onSelect: onDisconnectAll,
      keywords: ['disconnect', 'close', 'all', 'sessions'],
    });
  }

  return actions;
}
