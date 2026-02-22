import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FilePane } from '../FilePane';

const addTransferMock = vi.fn();

vi.mock('@/stores/transfer-store', () => ({
  useTransferStore: () => ({
    addTransfer: addTransferMock,
  }),
}));

describe('FilePane', () => {
  const listMock = vi.fn();
  const downloadMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    listMock.mockResolvedValue([
      {
        name: 'logs',
        path: '/logs',
        type: 'directory',
        size: 0,
        permissions: '755',
        modifiedAt: '2026-02-23T00:00:00.000Z',
        owner: 'root',
      },
      {
        name: 'report.txt',
        path: '/report.txt',
        type: 'file',
        size: 1200,
        permissions: '644',
        modifiedAt: '2026-02-23T00:00:00.000Z',
        owner: 'root',
      },
    ]);
    downloadMock.mockResolvedValue(undefined);

    (window as any).sftpApi = {
      list: listMock,
      mkdir: vi.fn(),
      delete: vi.fn(),
      pickUploadFiles: vi.fn(),
      upload: vi.fn(),
      download: downloadMock,
    };
  });

  it('loads and renders directory entries', async () => {
    render(<FilePane sessionId="session-1" title="Remote" />);

    await waitFor(() => {
      expect(listMock).toHaveBeenCalledWith('session-1', '/');
      expect(screen.getByText('logs')).toBeInTheDocument();
      expect(screen.getByText('report.txt')).toBeInTheDocument();
    });
  });

  it('creates transfer and downloads on file double click', async () => {
    const user = userEvent.setup();
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('report.txt');

    render(<FilePane sessionId="session-1" title="Remote" />);

    const row = await screen.findByText('report.txt');
    await user.dblClick(row);

    await waitFor(() => {
      expect(addTransferMock).toHaveBeenCalledTimes(1);
      expect(downloadMock).toHaveBeenCalledWith(
        'session-1',
        '/report.txt',
        'report.txt',
        expect.any(String)
      );
    });

    promptSpy.mockRestore();
  });

  it('creates directory from toolbar action and refreshes listing', async () => {
    const user = userEvent.setup();
    const mkdirMock = vi.fn().mockResolvedValue(undefined);
    (window as any).sftpApi.mkdir = mkdirMock;
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('new-folder');

    render(<FilePane sessionId="session-1" title="Remote" />);
    await screen.findByText('report.txt');

    await user.click(screen.getByTitle('New folder'));

    await waitFor(() => {
      expect(mkdirMock).toHaveBeenCalledWith('session-1', '/new-folder');
      expect(listMock).toHaveBeenCalledTimes(2);
    });

    promptSpy.mockRestore();
  });

  it('deletes entry from context menu when confirmed', async () => {
    const deleteMock = vi.fn().mockResolvedValue(undefined);
    (window as any).sftpApi.delete = deleteMock;
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<FilePane sessionId="session-1" title="Remote" />);
    const fileRowText = await screen.findByText('report.txt');
    fireEvent.contextMenu(fileRowText);

    await waitFor(() => {
      expect(deleteMock).toHaveBeenCalledWith('session-1', '/report.txt', false);
      expect(listMock).toHaveBeenCalledTimes(2);
    });

    confirmSpy.mockRestore();
  });

  it('uploads selected files and continues after partial failures', async () => {
    const user = userEvent.setup();
    const uploadMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('network glitch'))
      .mockResolvedValueOnce(undefined);
    const pickUploadFilesMock = vi.fn().mockResolvedValue(['/tmp/a.txt', '/tmp/b.txt']);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    (window as any).sftpApi.pickUploadFiles = pickUploadFilesMock;
    (window as any).sftpApi.upload = uploadMock;

    render(<FilePane sessionId="session-1" title="Remote" />);
    await screen.findByText('report.txt');

    await user.click(screen.getByTitle('Upload files'));

    await waitFor(() => {
      expect(addTransferMock).toHaveBeenCalledTimes(2);
      expect(uploadMock).toHaveBeenNthCalledWith(1, 'session-1', '/tmp/a.txt', '/a.txt', expect.any(String));
      expect(uploadMock).toHaveBeenNthCalledWith(2, 'session-1', '/tmp/b.txt', '/b.txt', expect.any(String));
      expect(listMock).toHaveBeenCalledTimes(2);
    });

    expect(errorSpy).toHaveBeenCalledWith('Upload failed:', expect.any(Error));
    errorSpy.mockRestore();
  });

  it('uploads dropped files with path and skips files without path', async () => {
    const uploadMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('first failed'))
      .mockResolvedValueOnce(undefined);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    (window as any).sftpApi.upload = uploadMock;

    render(<FilePane sessionId="session-1" title="Remote" />);
    await screen.findByText('report.txt');

    const droppedA = new File(['a'], 'a.txt', { type: 'text/plain' });
    Object.defineProperty(droppedA, 'path', { value: '/tmp/a.txt' });
    const droppedB = new File(['b'], 'b.txt', { type: 'text/plain' });
    Object.defineProperty(droppedB, 'path', { value: '/tmp/b.txt' });
    const droppedWithoutPath = new File(['c'], 'c.txt', { type: 'text/plain' });

    fireEvent.drop(screen.getByText('report.txt'), {
      dataTransfer: {
        files: [droppedA, droppedWithoutPath, droppedB],
      },
    });

    await waitFor(() => {
      expect(addTransferMock).toHaveBeenCalledTimes(2);
      expect(uploadMock).toHaveBeenCalledTimes(2);
      expect(uploadMock).toHaveBeenNthCalledWith(1, 'session-1', '/tmp/a.txt', '/a.txt', expect.any(String));
      expect(uploadMock).toHaveBeenNthCalledWith(2, 'session-1', '/tmp/b.txt', '/b.txt', expect.any(String));
      expect(listMock).toHaveBeenCalledTimes(2);
    });

    expect(errorSpy).toHaveBeenCalledWith('Upload failed:', expect.any(Error));
    errorSpy.mockRestore();
  });
});
