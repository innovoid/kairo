import { useEffect, useState } from 'react';
import { Sidebar } from './Sidebar';
import { TabBar } from './TabBar';
import { MainArea } from './MainArea';
import { StatusBar } from './StatusBar';
import { HostForm } from '@/features/hosts/HostForm';
import { HostsGrid } from '@/features/hosts/HostsGrid';
import { KeysPage } from '@/features/keys/KeysPage';
import { SettingsPage, type SettingsTab } from '@/features/settings/SettingsPage';
import { CommandPalette } from '@/features/command-palette/CommandPalette';
import { useTransferStore } from '@/stores/transfer-store';
import { useSettingsStore } from '@/stores/settings-store';
import { useSessionStore } from '@/stores/session-store';
import type { Host } from '@shared/types/hosts';
import type { Workspace } from '@shared/types/workspace';
import { Toaster } from '@/components/ui/sonner';

export function AppShell() {
  const [workspaceId, setWorkspaceId] = useState<string>('');
  const [showHostForm, setShowHostForm] = useState(false);
  const [editingHost, setEditingHost] = useState<Host | null>(null);
  const { updateProgress } = useTransferStore();
  const { settings, fetchSettings } = useSettingsStore();

  const tabs = useSessionStore((s) => s.tabs);
  const activeTabId = useSessionStore((s) => s.activeTabId);
  const openTab = useSessionStore((s) => s.openTab);
  const setActiveTab = useSessionStore((s) => s.setActiveTab);

  useEffect(() => {
    window.workspaceApi.getActiveContext().then((ctx) => {
      if (ctx) setWorkspaceId((ctx as { workspace: Workspace }).workspace.id);
    });
    const offProgress = window.sftpApi.onProgress(updateProgress);
    fetchSettings();
    return offProgress;
  }, []);

  // Sync theme to <html> class and localStorage whenever settings change
  useEffect(() => {
    const theme = settings?.theme ?? 'dark';
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('archterm-theme', theme);
  }, [settings?.theme]);

  const activeTab = activeTabId ? tabs.get(activeTabId) : null;

  function handleGoHome() {
    openTab({ tabId: 'hosts', tabType: 'hosts', label: 'Hosts' });
  }

  function handleGoKeys() {
    openTab({ tabId: 'keys', tabType: 'keys', label: 'SSH Keys' });
  }

  function handleGoSettings() {
    openTab({ tabId: 'settings', tabType: 'settings', label: 'Settings', settingsTab: 'terminal' });
  }

  function handleAddHost() {
    setEditingHost(null);
    setShowHostForm(true);
  }

  function handleEditHost(host: Host) {
    setEditingHost(host);
    setShowHostForm(true);
  }

  function handleCloseHostForm() {
    setShowHostForm(false);
    setEditingHost(null);
  }

  function handleWorkspaceChange(ws: Workspace) {
    setWorkspaceId(ws.id);
  }

  if (!workspaceId) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground text-sm">Loading workspace...</div>
      </div>
    );
  }

  const sidebarView = activeTab?.tabType === 'settings' ? 'settings' : activeTab?.tabType === 'keys' ? 'keys' : 'hosts';

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      <div className="flex flex-1 overflow-hidden">
        {/* Left nav rail */}
        <Sidebar
          onOpenSettings={handleGoSettings}
          onGoHome={handleGoHome}
          onGoKeys={handleGoKeys}
          activeView={sidebarView}
        />

        {/* Main content area */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <TabBar />
          <div className="flex flex-1 overflow-hidden">
            {activeTab?.tabType === 'hosts' && (
              <HostsGrid
                workspaceId={workspaceId}
                onAddHost={handleAddHost}
                onEditHost={handleEditHost}
                onWorkspaceChange={handleWorkspaceChange}
              />
            )}
            {activeTab?.tabType === 'keys' && <KeysPage workspaceId={workspaceId} />}
            {activeTab?.tabType === 'settings' && (
              <SettingsPage
                activeTab={activeTab.settingsTab ?? 'terminal'}
                onTabChange={(tab) => useSessionStore.getState().updateSettingsTab(tab as SettingsTab)}
                workspaceId={workspaceId}
              />
            )}
            {(activeTab?.tabType === 'terminal' || activeTab?.tabType === 'sftp') && <MainArea />}

            {/* Host form right panel */}
            {showHostForm && (
              <HostForm
                host={editingHost}
                workspaceId={workspaceId}
                onClose={handleCloseHostForm}
              />
            )}
          </div>
        </div>
      </div>

      <StatusBar />

      <CommandPalette
        onOpenSettings={handleGoSettings}
        onOpenKeys={handleGoKeys}
      />

      <Toaster />
    </div>
  );
}
