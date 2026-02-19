import { useEffect, useState } from 'react';
import { Sidebar } from './Sidebar';
import { TabBar } from './TabBar';
import { MainArea } from './MainArea';
import { StatusBar } from './StatusBar';
import { HostForm } from '@/features/hosts/HostForm';
import { HostsGrid } from '@/features/hosts/HostsGrid';
import { KeysPage } from '@/features/keys/KeysPage';
import { TeamPage } from '@/features/team/TeamPage';
import { SettingsPage, type SettingsTab } from '@/features/settings/SettingsPage';
import { CommandPalette } from '@/features/command-palette/CommandPalette';
import { useTransferStore } from '@/stores/transfer-store';
import { useSettingsStore } from '@/stores/settings-store';
import { useSessionStore } from '@/stores/session-store';
import type { Host } from '@shared/types/hosts';
import type { Workspace } from '@shared/types/workspace';
import { Toaster } from '@/components/ui/sonner';

type ActivePanel = 'host-form' | 'import-key' | null;

export function AppShell() {
  const [workspaceId, setWorkspaceId] = useState<string>('');
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
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

  // Close panels when switching tabs
  useEffect(() => {
    setActivePanel(null);
    setEditingHost(null);
  }, [activeTabId]);

  const activeTab = activeTabId ? tabs.get(activeTabId) : null;

  function handleGoHome() {
    openTab({ tabId: 'hosts', tabType: 'hosts', label: 'Hosts' });
  }

  function handleGoKeys() {
    openTab({ tabId: 'keys', tabType: 'keys', label: 'SSH Keys' });
  }

  function handleGoWorkspace() {
    openTab({ tabId: 'workspace', tabType: 'workspace', label: 'Workspace' });
  }

  function handleGoSettings() {
    openTab({ tabId: 'settings', tabType: 'settings', label: 'Settings', settingsTab: 'terminal' });
  }

  function handleAddHost() {
    setEditingHost(null);
    setActivePanel('host-form');
  }

  function handleEditHost(host: Host) {
    setEditingHost(host);
    setActivePanel('host-form');
  }

  function handleOpenImportKey() {
    setActivePanel('import-key');
  }

  function handleClosePanel() {
    setActivePanel(null);
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

  const sidebarView =
    activeTab?.tabType === 'settings' ? 'settings' :
    activeTab?.tabType === 'keys' ? 'keys' :
    activeTab?.tabType === 'workspace' ? 'workspace' :
    'hosts';

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      <div className="flex flex-1 overflow-hidden">
        {/* Left nav rail */}
        <Sidebar
          onOpenSettings={handleGoSettings}
          onGoHome={handleGoHome}
          onGoKeys={handleGoKeys}
          onGoWorkspace={handleGoWorkspace}
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
            {activeTab?.tabType === 'keys' && (
              <KeysPage
                workspaceId={workspaceId}
                showImportPanel={activePanel === 'import-key'}
                onOpenImport={handleOpenImportKey}
                onCloseImport={handleClosePanel}
              />
            )}
            {activeTab?.tabType === 'workspace' && <TeamPage workspaceId={workspaceId} />}
            {activeTab?.tabType === 'settings' && (
              <SettingsPage
                activeTab={activeTab.settingsTab ?? 'terminal'}
                onTabChange={(tab) => useSessionStore.getState().updateSettingsTab(tab as SettingsTab)}
                workspaceId={workspaceId}
              />
            )}
            {(activeTab?.tabType === 'terminal' || activeTab?.tabType === 'sftp') && <MainArea />}

            {/* Right panels - only one visible at a time */}
            {activePanel === 'host-form' && (
              <HostForm
                host={editingHost}
                workspaceId={workspaceId}
                onClose={handleClosePanel}
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
