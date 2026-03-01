import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TerminalCentricAppShell } from '../TerminalCentricAppShell';

vi.mock('@/lib/e2e', () => ({
  isE2EMode: () => true,
}));

vi.mock('@tanstack/react-hotkeys', () => ({
  useHotkey: vi.fn(),
}));

vi.mock('../TerminalLayout', () => ({
  TerminalLayout: ({ tabBar, overlays, children }: any) => (
    <div>
      <div data-testid="tab-bar">{tabBar}</div>
      <div data-testid="overlays">{overlays}</div>
      <div data-testid="main">{children}</div>
    </div>
  ),
}));

vi.mock('../FloatingTabBar', () => ({
  FloatingTabBar: () => <div data-testid="floating-tab-bar" />,
}));

vi.mock('../CommandPalette', () => ({
  CommandPalette: ({ commands }: any) => {
    const teamCommand = commands.find((cmd: any) => cmd.id === 'team');
    return (
      <button
        type="button"
        data-testid="execute-team-command"
        onClick={() => teamCommand?.onExecute()}
      >
        Execute Team Command
      </button>
    );
  },
}));

vi.mock('@/features/team/TeamOverlay', () => ({
  TeamOverlay: ({ open, workspaceId }: any) => (
    <div data-testid="team-overlay-state">{open ? `open:${workspaceId}` : 'closed'}</div>
  ),
}));

vi.mock('@/features/hosts/HostBrowserOverlay', () => ({
  HostBrowserOverlay: () => <div />,
}));
vi.mock('@/features/hosts/HostForm', () => ({
  HostForm: () => <div />,
}));
vi.mock('@/features/keys/KeysPage', () => ({
  KeysPage: () => <div />,
}));
vi.mock('@/features/settings/SettingsOverlay', () => ({
  SettingsOverlay: () => <div />,
}));
vi.mock('@/features/agent/AgentSidebar', () => ({
  AgentSidebar: () => <div />,
}));
vi.mock('@/features/sftp/TransferProgress', () => ({
  TransferProgress: () => <div />,
}));
vi.mock('../MainArea', () => ({
  MainArea: () => <div data-testid="main-area" />,
}));
vi.mock('@/components/ui/sonner', () => ({
  Toaster: () => null,
}));
vi.mock('@/components/ui/logo', () => ({
  KairoLogoIcon: () => <span data-testid="logo" />,
}));

const sessionState = {
  tabs: new Map(),
  activeTabId: null as string | null,
  openTab: vi.fn(),
  setActiveTab: vi.fn(),
  closeTab: vi.fn(),
  splitPane: vi.fn(),
};

vi.mock('@/stores/session-store', () => ({
  useSessionStore: (selector: any) => selector(sessionState),
}));

vi.mock('@/stores/host-store', () => ({
  useHostStore: () => ({
    hosts: [],
    fetchHosts: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('@/stores/settings-store', () => ({
  useSettingsStore: () => ({
    settings: { theme: 'dark', promptStyle: 'default' },
    fetchSettings: vi.fn(),
  }),
}));

vi.mock('@/stores/transfer-store', () => ({
  useTransferStore: () => ({
    updateProgress: vi.fn(),
  }),
}));

vi.mock('@/stores/broadcast-store', () => ({
  useBroadcastStore: () => ({
    enabled: false,
    toggle: vi.fn(),
    addTarget: vi.fn(),
  }),
}));

vi.mock('@/stores/workspace-store', () => ({
  useWorkspaceStore: () => ({
    workspaces: [],
    activeWorkspace: null,
    fetchWorkspaces: vi.fn(),
  }),
}));

describe('TerminalCentricAppShell', () => {
  it('opens team overlay when Team command executes from command palette wiring', async () => {
    const user = userEvent.setup();
    (window as any).sftpApi = {
      onProgress: vi.fn(() => vi.fn()),
    };

    render(<TerminalCentricAppShell />);

    await waitFor(() => {
      expect(screen.getByText('Kairo')).toBeInTheDocument();
    });
    expect(screen.getByTestId('team-overlay-state')).toHaveTextContent('closed');

    await user.click(screen.getByTestId('execute-team-command'));

    expect(screen.getByTestId('team-overlay-state')).toHaveTextContent('open:e2e-workspace');
  });
});

