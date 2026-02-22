import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TransferProgress } from '../TransferProgress';
import type { TransferProgress as TransferProgressType } from '@shared/types/sftp';

const storeState: {
  transfers: Map<string, TransferProgressType>;
  removeTransfer: ReturnType<typeof vi.fn>;
  cancelTransfer: ReturnType<typeof vi.fn>;
  retryTransfer: ReturnType<typeof vi.fn>;
} = {
  transfers: new Map(),
  removeTransfer: vi.fn(),
  cancelTransfer: vi.fn(),
  retryTransfer: vi.fn(),
};

vi.mock('@/stores/transfer-store', () => ({
  useTransferStore: (selector: (state: typeof storeState) => unknown) => selector(storeState),
}));

describe('TransferProgress', () => {
  beforeEach(() => {
    storeState.transfers = new Map();
    storeState.removeTransfer.mockReset();
    storeState.cancelTransfer.mockReset();
    storeState.retryTransfer.mockReset();
  });

  it('renders nothing when there are no transfers', () => {
    const { container } = render(<TransferProgress />);
    expect(container.firstChild).toBeNull();
  });

  it('cancels active transfer from action button', async () => {
    const user = userEvent.setup();
    storeState.transfers = new Map([
      [
        't-active',
        {
          transferId: 't-active',
          filename: 'archive.tar.gz',
          direction: 'upload',
          status: 'active',
          bytesTransferred: 50,
          totalBytes: 100,
          updatedAt: '2026-02-23T00:00:00.000Z',
          startedAt: '2026-02-23T00:00:00.000Z',
        },
      ],
    ]);

    render(<TransferProgress variant="floating" />);

    expect(screen.getByText(/archive.tar.gz/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /cancel transfer/i }));

    expect(storeState.cancelTransfer).toHaveBeenCalledWith('t-active');
  });

  it('retries and dismisses failed transfer', async () => {
    const user = userEvent.setup();
    storeState.transfers = new Map([
      [
        't-error',
        {
          transferId: 't-error',
          filename: 'report.log',
          direction: 'download',
          status: 'error',
          bytesTransferred: 5,
          totalBytes: 100,
          error: 'network error',
          updatedAt: '2026-02-23T00:00:00.000Z',
          startedAt: '2026-02-23T00:00:00.000Z',
        },
      ],
    ]);

    render(<TransferProgress />);

    await user.click(screen.getByRole('button', { name: /retry transfer/i }));
    expect(storeState.retryTransfer).toHaveBeenCalledWith('t-error');

    await user.click(screen.getByRole('button', { name: /dismiss transfer/i }));
    expect(storeState.removeTransfer).toHaveBeenCalledWith('t-error');
  });
});

