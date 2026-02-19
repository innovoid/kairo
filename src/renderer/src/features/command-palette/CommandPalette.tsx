import { useEffect, useState } from 'react';
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
import { Terminal, Settings, Key, X } from 'lucide-react';

interface CommandPaletteProps {
  onOpenSettings: () => void;
  onOpenKeys: () => void;
}

export function CommandPalette({ onOpenSettings, onOpenKeys }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const { hosts } = useHostStore();
  const tabs = useSessionStore((s) => s.tabs);
  const openTab = useSessionStore((s) => s.openTab);
  const closeTab = useSessionStore((s) => s.closeTab);
  const setActiveTab = useSessionStore((s) => s.setActiveTab);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  function connectHost(hostId: string) {
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

      window.sshApi.connect(sessionId, {
        host: host.hostname,
        port: host.port,
        username: host.username,
        authType: host.authType,
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

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search hosts..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {hosts.length > 0 && (
          <CommandGroup heading="Hosts">
            {hosts.map((host) => (
              <CommandItem
                key={host.id}
                onSelect={() => connectHost(host.id)}
              >
                <Terminal className="h-4 w-4 mr-2" />
                <span>Connect to {host.label}</span>
                <span className="ml-2 text-xs text-muted-foreground">{host.hostname}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandSeparator />

        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => { onOpenSettings(); setOpen(false); }}>
            <Settings className="h-4 w-4 mr-2" />
            Open Settings
          </CommandItem>
          <CommandItem onSelect={() => { onOpenKeys(); setOpen(false); }}>
            <Key className="h-4 w-4 mr-2" />
            Manage SSH Keys
          </CommandItem>
          {terminalTabs.length > 0 && (
            <CommandItem onSelect={disconnectAll} className="text-destructive">
              <X className="h-4 w-4 mr-2" />
              Disconnect All
            </CommandItem>
          )}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
