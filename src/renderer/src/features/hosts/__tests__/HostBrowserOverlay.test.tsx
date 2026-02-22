import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HostBrowserOverlay } from '../HostBrowserOverlay';

let capturedOnDragEnd: ((event: any) => void | Promise<void>) | null = null;

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children, onDragEnd }: any) => {
    capturedOnDragEnd = onDragEnd;
    return <div data-testid="dnd-context">{children}</div>;
  },
  DragOverlay: ({ children }: any) => <div data-testid="drag-overlay">{children}</div>,
  PointerSensor: function PointerSensor() {},
  useSensor: () => ({}),
  useSensors: () => [],
  useDraggable: ({ id }: any) => ({
    setNodeRef: () => {},
    listeners: { 'data-draggable-id': id },
    attributes: {},
    transform: null,
    isDragging: false,
  }),
  useDroppable: () => ({
    setNodeRef: () => {},
    isOver: false,
  }),
}));

const hostStoreMock = {
  hosts: [
    {
      id: 'host-1',
      workspaceId: 'ws-1',
      folderId: null,
      label: 'Prod',
      hostname: 'prod.example.com',
      port: 22,
      username: 'root',
      authType: 'key' as const,
      password: null,
      keyId: 'key-1',
      tags: ['critical'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  folders: [
    {
      id: 'folder-1',
      workspaceId: 'ws-1',
      parentId: null,
      name: 'Servers',
      position: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  fetchHosts: vi.fn(() => Promise.resolve()),
  createFolder: vi.fn(() => Promise.resolve()),
  updateFolder: vi.fn(() => Promise.resolve()),
  deleteFolder: vi.fn(() => Promise.resolve()),
  moveToFolder: vi.fn(() => Promise.resolve()),
};

vi.mock('@/stores/host-store', () => ({
  useHostStore: () => hostStoreMock,
}));

describe('HostBrowserOverlay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedOnDragEnd = null;
  });

  it('creates a folder from overlay footer action', async () => {
    const user = userEvent.setup();
    render(
      <HostBrowserOverlay
        open={true}
        onOpenChange={vi.fn()}
        workspaceId="ws-1"
        onConnect={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /new folder/i }));
    await user.type(screen.getByLabelText(/folder name/i), 'Databases');
    await user.click(screen.getByRole('button', { name: /^create$/i }));

    await waitFor(() => {
      expect(hostStoreMock.createFolder).toHaveBeenCalledWith({
        workspaceId: 'ws-1',
        name: 'Databases',
      });
    });
  });

  it('moves host to target folder on drag end', async () => {
    render(
      <HostBrowserOverlay
        open={true}
        onOpenChange={vi.fn()}
        workspaceId="ws-1"
        onConnect={vi.fn()}
      />
    );

    expect(capturedOnDragEnd).toBeTruthy();
    await act(async () => {
      await capturedOnDragEnd?.({
        active: { id: 'host:host-1' },
        over: { id: 'folder:folder-1' },
      });
    });

    expect(hostStoreMock.moveToFolder).toHaveBeenCalledWith('host-1', 'folder-1');
  });

  it('connects and closes overlay when host row is clicked', async () => {
    const user = userEvent.setup();
    const onConnect = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <HostBrowserOverlay
        open={true}
        onOpenChange={onOpenChange}
        workspaceId="ws-1"
        onConnect={onConnect}
      />
    );

    await user.click(screen.getByRole('button', { name: /prod/i }));

    expect(onConnect).toHaveBeenCalledWith('host-1');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

