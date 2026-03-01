import { useHostStore } from '@/stores/host-store';
import { useSessionStore } from '@/stores/session-store';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { useCommandPalette } from './useCommandPalette';
import { getHostActions, getNavigationActions } from './command-actions';

interface CommandPaletteProps {
  onOpenSettings: () => void;
  onOpenKeys: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CommandPalette({ onOpenSettings, onOpenKeys, open: externalOpen, onOpenChange }: CommandPaletteProps) {
  const internal = useCommandPalette();
  const open = externalOpen !== undefined ? externalOpen : internal.open;
  const setOpen = onOpenChange !== undefined ? onOpenChange : internal.setOpen;
  const { hosts } = useHostStore();
  const tabs = useSessionStore((s) => s.tabs);
  const openTab = useSessionStore((s) => s.openTab);
  const closeTab = useSessionStore((s) => s.closeTab);
  const setActiveTab = useSessionStore((s) => s.setActiveTab);

  async function connectHost(hostId: string) {
    const host = hosts.find((h) => h.id === hostId);
    if (!host) return;

    const existingTab = [...tabs.values()].find(
      (t) => t.hostId === hostId && t.tabType === 'terminal'
    );

    if (existingTab) {
      setActiveTab(existingTab.tabId);
    } else {
      const sessionId = crypto.randomUUID();
      openTab({
        tabId: sessionId,
        tabType: 'terminal',
        label: host.label,
        hostId: host.id,
        hostname: host.hostname,
        sessionId,
        status: 'connecting',
      });

      let password: string | undefined;
      if (host.authType === 'password') {
        try {
          password = await window.hostsApi.getPassword(host.id) ?? undefined;
        } catch {}
      }

      window.sshApi.connect(sessionId, {
        host: host.hostname,
        port: host.port,
        username: host.username,
        authType: host.authType,
        password,
        privateKeyId: host.keyId ?? undefined,
        hostId: host.id,
      });
    }
    setOpen(false);
  }

  function disconnectAll() {
    for (const tab of tabs.values()) {
      if (tab.sessionId && (tab.tabType === 'terminal' || tab.tabType === 'sftp')) {
        window.sshApi.disconnect(tab.sessionId).catch(() => {});
        closeTab(tab.tabId);
      }
    }
    setOpen(false);
  }

  const terminalTabs = [...tabs.values()].filter(t => t.tabType === 'terminal' || t.tabType === 'sftp');
  const hasActiveSessions = terminalTabs.length > 0;

  // Get actions using the helper functions
  const hostActions = getHostActions({ hosts, onConnectHost: connectHost });
  const navigationActions = getNavigationActions({
    onOpenSettings: () => {
      onOpenSettings();
      setOpen(false);
    },
    onOpenKeys: () => {
      onOpenKeys();
      setOpen(false);
    },
    hasActiveSessions,
    onDisconnectAll: disconnectAll,
  });

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search hosts..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {hostActions.length > 0 && (
          <CommandGroup heading="Hosts">
            {hostActions.map((action) => {
              const Icon = action.icon;
              return (
                <CommandItem
                  key={action.id}
                  onSelect={action.onSelect}
                  keywords={action.keywords}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  <span>{action.label}</span>
                  {action.description && (
                    <span className="ml-2 text-xs text-muted-foreground">{action.description}</span>
                  )}
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        <CommandSeparator />

        <CommandGroup heading="Actions">
          {navigationActions.map((action) => {
            const Icon = action.icon;
            const isDestructive = action.id === 'disconnect-all';
            return (
              <CommandItem
                key={action.id}
                onSelect={action.onSelect}
                keywords={action.keywords}
                className={isDestructive ? 'text-destructive' : undefined}
              >
                <Icon className="h-4 w-4 mr-2" />
                {action.label}
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
