import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useHostStore } from '../host-store';
import { useWorkspaceStore } from '../workspace-store';
import type { Host, HostFolder } from '@shared/types/hosts';

const hostFixture: Host = {
  id: 'host-1',
  workspaceId: 'ws-1',
  folderId: null,
  label: 'Production',
  hostname: '10.0.0.5',
  port: 22,
  username: 'root',
  authType: 'key',
  password: null,
  keyId: 'key-1',
  tags: ['prod'],
  createdAt: '2026-02-01T00:00:00.000Z',
  updatedAt: '2026-02-01T00:00:00.000Z',
};

const folderFixture: HostFolder = {
  id: 'folder-1',
  workspaceId: 'ws-1',
  parentId: null,
  name: 'Servers',
  position: 0,
  createdAt: '2026-02-01T00:00:00.000Z',
};

const mockHostsApi = {
  list: vi.fn<() => Promise<Host[]>>(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  moveToFolder: vi.fn(),
};

const mockFoldersApi = {
  list: vi.fn<() => Promise<HostFolder[]>>(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

(globalThis as any).window = {
  ...(globalThis as any).window,
  hostsApi: mockHostsApi,
  foldersApi: mockFoldersApi,
};

describe('useHostStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useHostStore.setState({
      hosts: [],
      folders: [],
      isLoading: false,
      error: null,
    });
    useWorkspaceStore.setState({
      workspaces: [],
      activeWorkspace: { id: 'ws-1', name: 'Workspace', createdBy: 'u1', createdAt: '', updatedAt: '' },
      isLoading: false,
      error: null,
    });
  });

  it('fetches hosts and folders together', async () => {
    mockHostsApi.list.mockResolvedValue([hostFixture]);
    mockFoldersApi.list.mockResolvedValue([folderFixture]);

    await useHostStore.getState().fetchHosts('ws-1');

    expect(mockHostsApi.list).toHaveBeenCalledWith('ws-1');
    expect(mockFoldersApi.list).toHaveBeenCalledWith('ws-1');
    expect(useHostStore.getState().hosts).toEqual([hostFixture]);
    expect(useHostStore.getState().folders).toEqual([folderFixture]);
    expect(useHostStore.getState().error).toBeNull();
  });

  it('moves a host to folder and syncs backend response', async () => {
    const movedHost = { ...hostFixture, folderId: 'folder-1' };
    useHostStore.setState({ hosts: [hostFixture] });
    mockHostsApi.moveToFolder.mockResolvedValue(movedHost);

    await useHostStore.getState().moveToFolder('host-1', 'folder-1');

    expect(mockHostsApi.moveToFolder).toHaveBeenCalledWith('host-1', 'folder-1');
    expect(useHostStore.getState().hosts[0]?.folderId).toBe('folder-1');
  });

  it('rolls back folder optimistic create when API fails', async () => {
    mockFoldersApi.create.mockRejectedValue(new Error('create failed'));

    await expect(
      useHostStore.getState().createFolder({ workspaceId: 'ws-1', name: 'New Folder' })
    ).rejects.toThrow('create failed');

    expect(useHostStore.getState().folders).toEqual([]);
    expect(useHostStore.getState().error).toBe('create failed');
  });
});

