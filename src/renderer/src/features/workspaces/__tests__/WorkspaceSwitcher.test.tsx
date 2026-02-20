import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WorkspaceSwitcher } from '../WorkspaceSwitcher';

// Mock workspace-store
vi.mock('../../../stores/workspace-store', () => ({
  useWorkspaceStore: vi.fn(),
}));

describe('WorkspaceSwitcher', () => {
  const mockWorkspaces = [
    { id: 'ws-1', name: 'Personal Workspace', createdBy: 'user-1', createdAt: '2026-01-01', updatedAt: '2026-01-01' },
    { id: 'ws-2', name: 'Team Alpha', createdBy: 'user-1', createdAt: '2026-01-02', updatedAt: '2026-01-02' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render current workspace name', () => {
    const { useWorkspaceStore } = require('../../../stores/workspace-store');
    useWorkspaceStore.mockReturnValue({
      workspaces: mockWorkspaces,
      activeWorkspace: mockWorkspaces[0],
      setActiveWorkspace: vi.fn(),
      fetchWorkspaces: vi.fn(),
    });

    render(<WorkspaceSwitcher />);
    expect(screen.getByText('Personal Workspace')).toBeInTheDocument();
  });

  it('should show workspace list when clicked', async () => {
    const { useWorkspaceStore } = require('../../../stores/workspace-store');
    useWorkspaceStore.mockReturnValue({
      workspaces: mockWorkspaces,
      activeWorkspace: mockWorkspaces[0],
      setActiveWorkspace: vi.fn(),
      fetchWorkspaces: vi.fn(),
    });

    render(<WorkspaceSwitcher />);

    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText('Team Alpha')).toBeInTheDocument();
    });
  });

  it('should switch workspace when selection changes', async () => {
    const mockSetActiveWorkspace = vi.fn();
    const { useWorkspaceStore } = require('../../../stores/workspace-store');
    useWorkspaceStore.mockReturnValue({
      workspaces: mockWorkspaces,
      activeWorkspace: mockWorkspaces[0],
      setActiveWorkspace: mockSetActiveWorkspace,
      fetchWorkspaces: vi.fn(),
    });

    render(<WorkspaceSwitcher />);

    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);

    await waitFor(() => {
      const teamOption = screen.getByText('Team Alpha');
      fireEvent.click(teamOption);
    });

    expect(mockSetActiveWorkspace).toHaveBeenCalledWith('ws-2');
  });
});
