import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { CommandPalette } from '../CommandPalette';

// Mock stores
const mockHosts = [
  {
    id: 'host-1',
    label: 'Production Server',
    hostname: 'prod.example.com',
    port: 22,
    username: 'admin',
    authType: 'key' as const,
    workspaceId: 'ws-1',
    folderId: null,
    keyId: 'key-1',
    password: null,
    tags: [],
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'host-2',
    label: 'Dev Server',
    hostname: 'dev.example.com',
    port: 22,
    username: 'dev',
    authType: 'password' as const,
    workspaceId: 'ws-1',
    folderId: null,
    keyId: null,
    password: null,
    tags: [],
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
];

const mockTabs = new Map();
const mockOpenTab = vi.fn();
const mockCloseTab = vi.fn();
const mockSetActiveTab = vi.fn();

vi.mock('@/stores/host-store', () => ({
  useHostStore: () => ({
    hosts: mockHosts,
  }),
}));

vi.mock('@/stores/session-store', () => ({
  useSessionStore: (selector: any) => {
    const state = {
      tabs: mockTabs,
      openTab: mockOpenTab,
      closeTab: mockCloseTab,
      setActiveTab: mockSetActiveTab,
    };
    return selector ? selector(state) : state;
  },
}));

// Mock window.sshApi
const mockConnect = vi.fn();
const mockDisconnect = vi.fn().mockResolvedValue(undefined);
(global as any).window = {
  sshApi: {
    connect: mockConnect,
    disconnect: mockDisconnect,
  },
};

describe('CommandPalette', () => {
  const mockOnOpenSettings = vi.fn();
  const mockOnOpenKeys = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockTabs.clear();
  });

  it('renders when open', () => {
    render(
      <CommandPalette
        onOpenSettings={mockOnOpenSettings}
        onOpenKeys={mockOnOpenKeys}
      />
    );

    // Initially closed
    expect(screen.queryByPlaceholderText(/type a command/i)).not.toBeInTheDocument();
  });

  it('opens with Cmd+K keyboard shortcut', async () => {
    const user = userEvent.setup();
    render(
      <CommandPalette
        onOpenSettings={mockOnOpenSettings}
        onOpenKeys={mockOnOpenKeys}
      />
    );

    // Press Cmd+K
    await user.keyboard('{Meta>}k{/Meta}');

    // Dialog should be open
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/type a command/i)).toBeInTheDocument();
    });
  });

  it('opens with Ctrl+K keyboard shortcut', async () => {
    const user = userEvent.setup();
    render(
      <CommandPalette
        onOpenSettings={mockOnOpenSettings}
        onOpenKeys={mockOnOpenKeys}
      />
    );

    // Press Ctrl+K
    await user.keyboard('{Control>}k{/Control}');

    // Dialog should be open
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/type a command/i)).toBeInTheDocument();
    });
  });

  it('displays host actions from store', async () => {
    const user = userEvent.setup();
    render(
      <CommandPalette
        onOpenSettings={mockOnOpenSettings}
        onOpenKeys={mockOnOpenKeys}
      />
    );

    // Open palette
    await user.keyboard('{Meta>}k{/Meta}');

    await waitFor(() => {
      expect(screen.getByText(/connect to production server/i)).toBeInTheDocument();
      expect(screen.getByText(/connect to dev server/i)).toBeInTheDocument();
    });
  });

  it('displays navigation actions', async () => {
    const user = userEvent.setup();
    render(
      <CommandPalette
        onOpenSettings={mockOnOpenSettings}
        onOpenKeys={mockOnOpenKeys}
      />
    );

    // Open palette
    await user.keyboard('{Meta>}k{/Meta}');

    await waitFor(() => {
      expect(screen.getByText(/open settings/i)).toBeInTheDocument();
      expect(screen.getByText(/manage ssh keys/i)).toBeInTheDocument();
    });
  });

  it('connects to host when host action is selected', async () => {
    const user = userEvent.setup();
    render(
      <CommandPalette
        onOpenSettings={mockOnOpenSettings}
        onOpenKeys={mockOnOpenKeys}
      />
    );

    // Open palette
    await user.keyboard('{Meta>}k{/Meta}');

    // Click on a host
    await waitFor(() => {
      expect(screen.getByText(/connect to production server/i)).toBeInTheDocument();
    });

    await user.click(screen.getByText(/connect to production server/i));

    // Should call openTab with correct parameters
    expect(mockOpenTab).toHaveBeenCalled();
    expect(mockConnect).toHaveBeenCalled();
  });

  it('calls onOpenSettings when settings action is selected', async () => {
    const user = userEvent.setup();
    render(
      <CommandPalette
        onOpenSettings={mockOnOpenSettings}
        onOpenKeys={mockOnOpenKeys}
      />
    );

    // Open palette
    await user.keyboard('{Meta>}k{/Meta}');

    // Click on settings
    await waitFor(() => {
      expect(screen.getByText(/open settings/i)).toBeInTheDocument();
    });

    await user.click(screen.getByText(/open settings/i));

    // Should call the callback
    expect(mockOnOpenSettings).toHaveBeenCalled();
  });

  it('calls onOpenKeys when keys action is selected', async () => {
    const user = userEvent.setup();
    render(
      <CommandPalette
        onOpenSettings={mockOnOpenSettings}
        onOpenKeys={mockOnOpenKeys}
      />
    );

    // Open palette
    await user.keyboard('{Meta>}k{/Meta}');

    // Click on keys
    await waitFor(() => {
      expect(screen.getByText(/manage ssh keys/i)).toBeInTheDocument();
    });

    await user.click(screen.getByText(/manage ssh keys/i));

    // Should call the callback
    expect(mockOnOpenKeys).toHaveBeenCalled();
  });

  it('closes palette when action is selected', async () => {
    const user = userEvent.setup();
    render(
      <CommandPalette
        onOpenSettings={mockOnOpenSettings}
        onOpenKeys={mockOnOpenKeys}
      />
    );

    // Open palette
    await user.keyboard('{Meta>}k{/Meta}');

    await waitFor(() => {
      expect(screen.getByText(/open settings/i)).toBeInTheDocument();
    });

    // Click on settings
    await user.click(screen.getByText(/open settings/i));

    // Palette should close
    await waitFor(() => {
      expect(screen.queryByPlaceholderText(/type a command/i)).not.toBeInTheDocument();
    });
  });

  it('closes palette with Escape key', async () => {
    const user = userEvent.setup();
    render(
      <CommandPalette
        onOpenSettings={mockOnOpenSettings}
        onOpenKeys={mockOnOpenKeys}
      />
    );

    // Open palette
    await user.keyboard('{Meta>}k{/Meta}');

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/type a command/i)).toBeInTheDocument();
    });

    // Press Escape
    await user.keyboard('{Escape}');

    // Palette should close
    await waitFor(() => {
      expect(screen.queryByPlaceholderText(/type a command/i)).not.toBeInTheDocument();
    });
  });

  it('shows disconnect all action when there are active sessions', async () => {
    const user = userEvent.setup();

    // Add an active terminal tab
    mockTabs.set('tab-1', {
      tabId: 'tab-1',
      tabType: 'terminal',
      label: 'Production Server',
      sessionId: 'session-1',
      hostId: 'host-1',
    });

    render(
      <CommandPalette
        onOpenSettings={mockOnOpenSettings}
        onOpenKeys={mockOnOpenKeys}
      />
    );

    // Open palette
    await user.keyboard('{Meta>}k{/Meta}');

    await waitFor(() => {
      expect(screen.getByText(/disconnect all/i)).toBeInTheDocument();
    });
  });

  it('does not show disconnect all action when no active sessions', async () => {
    const user = userEvent.setup();
    render(
      <CommandPalette
        onOpenSettings={mockOnOpenSettings}
        onOpenKeys={mockOnOpenKeys}
      />
    );

    // Open palette
    await user.keyboard('{Meta>}k{/Meta}');

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/type a command/i)).toBeInTheDocument();
    });

    expect(screen.queryByText(/disconnect all/i)).not.toBeInTheDocument();
  });

  it('filters hosts by search query', async () => {
    const user = userEvent.setup();
    render(
      <CommandPalette
        onOpenSettings={mockOnOpenSettings}
        onOpenKeys={mockOnOpenKeys}
      />
    );

    // Open palette
    await user.keyboard('{Meta>}k{/Meta}');

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/type a command/i)).toBeInTheDocument();
    });

    // Type search query
    const input = screen.getByPlaceholderText(/type a command/i);
    await user.type(input, 'production');

    // Should show only matching host
    await waitFor(() => {
      expect(screen.getByText(/connect to production server/i)).toBeInTheDocument();
      expect(screen.queryByText(/connect to dev server/i)).not.toBeInTheDocument();
    });
  });

  it('switches to existing tab if host is already connected', async () => {
    const user = userEvent.setup();

    // Add existing terminal tab for host-1
    mockTabs.set('existing-tab', {
      tabId: 'existing-tab',
      tabType: 'terminal',
      label: 'Production Server',
      sessionId: 'existing-session',
      hostId: 'host-1',
    });

    render(
      <CommandPalette
        onOpenSettings={mockOnOpenSettings}
        onOpenKeys={mockOnOpenKeys}
      />
    );

    // Open palette
    await user.keyboard('{Meta>}k{/Meta}');

    await waitFor(() => {
      expect(screen.getByText(/connect to production server/i)).toBeInTheDocument();
    });

    await user.click(screen.getByText(/connect to production server/i));

    // Should switch to existing tab, not open new one
    expect(mockSetActiveTab).toHaveBeenCalledWith('existing-tab');
    expect(mockOpenTab).not.toHaveBeenCalled();
    expect(mockConnect).not.toHaveBeenCalled();
  });
});
