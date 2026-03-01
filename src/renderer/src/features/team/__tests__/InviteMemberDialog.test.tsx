import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InviteMemberDialog } from '../InviteMemberDialog';

const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

describe('InviteMemberDialog', () => {
  const inviteMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (window as any).workspaceApi = {
      invite: inviteMock,
    };
  });

  it('submits invite and calls refresh callback', async () => {
    inviteMock.mockResolvedValue({ id: 'inv-1' });
    const onInvited = vi.fn();
    const user = userEvent.setup();

    render(<InviteMemberDialog workspaceId="ws-1" onInvited={onInvited} />);

    await user.click(screen.getByRole('button', { name: /invite member/i }));
    const emailInput = await screen.findByLabelText(/email/i);
    await user.type(emailInput, 'teammate@example.com');
    await user.click(screen.getByRole('button', { name: /send invitation/i }));

    await waitFor(() => {
      expect(inviteMock).toHaveBeenCalledTimes(1);
      expect(inviteMock).toHaveBeenCalledWith({
        workspaceId: 'ws-1',
        email: 'teammate@example.com',
        role: 'member',
      });
      expect(onInvited).toHaveBeenCalled();
      expect(toastSuccessMock).toHaveBeenCalled();
    });
  }, 10_000);

  it('shows error toast when invite fails', async () => {
    inviteMock.mockRejectedValue(new Error('Invite failed'));
    const user = userEvent.setup();

    render(<InviteMemberDialog workspaceId="ws-1" onInvited={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /invite member/i }));
    const emailInput = await screen.findByLabelText(/email/i);
    await user.type(emailInput, 'teammate@example.com');
    await user.click(screen.getByRole('button', { name: /send invitation/i }));

    await waitFor(() => {
      expect(inviteMock).toHaveBeenCalledTimes(1);
      expect(toastErrorMock).toHaveBeenCalledWith('Invite failed');
    });
  }, 10_000);
});
