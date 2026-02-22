import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamPage } from '../TeamPage';

vi.mock('../InviteMemberDialog', () => ({
  InviteMemberDialog: () => <div data-testid="invite-member-dialog" />,
}));

vi.mock('@/components/ui/select', () => {
  const ReactModule = React;
  const Ctx = ReactModule.createContext<{ onValueChange?: (value: string) => void }>({});

  return {
    Select: ({ onValueChange, children }: any) => (
      <Ctx.Provider value={{ onValueChange }}>
        <div data-testid="select">{children}</div>
      </Ctx.Provider>
    ),
    SelectTrigger: ({ children }: any) => <button type="button">{children}</button>,
    SelectValue: ({ children }: any) => <span>{children}</span>,
    SelectContent: ({ children }: any) => <div>{children}</div>,
    SelectItem: ({ value, children }: any) => {
      const ctx = ReactModule.useContext(Ctx);
      return (
        <button
          type="button"
          data-testid={`select-item-${value}`}
          onClick={() => ctx.onValueChange?.(value)}
        >
          {children}
        </button>
      );
    },
  };
});

const listMembersMock = vi.fn();
const updateRoleMock = vi.fn();
const removeMemberMock = vi.fn();

describe('TeamPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (window as any).workspaceApi = {
      members: {
        list: listMembersMock,
        updateRole: updateRoleMock,
        remove: removeMemberMock,
      },
    };

    listMembersMock.mockResolvedValue([
      {
        workspaceId: 'ws-1',
        userId: 'u1',
        email: 'owner@example.com',
        role: 'owner',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      {
        workspaceId: 'ws-1',
        userId: 'u2',
        email: 'member@example.com',
        role: 'member',
        createdAt: '2026-01-02T00:00:00.000Z',
      },
    ]);
    updateRoleMock.mockResolvedValue(undefined);
    removeMemberMock.mockResolvedValue(undefined);
  });

  it('loads and displays members list', async () => {
    render(<TeamPage workspaceId="ws-1" />);

    await waitFor(() => {
      expect(listMembersMock).toHaveBeenCalledWith('ws-1');
      expect(screen.getByText('owner@example.com')).toBeInTheDocument();
      expect(screen.getByText('member@example.com')).toBeInTheDocument();
    });
  });

  it('updates member role and refreshes members', async () => {
    const user = userEvent.setup();
    render(<TeamPage workspaceId="ws-1" />);

    await screen.findByText('member@example.com');
    await user.click(screen.getByTestId('select-item-admin'));

    await waitFor(() => {
      expect(updateRoleMock).toHaveBeenCalledWith({
        workspaceId: 'ws-1',
        userId: 'u2',
        role: 'admin',
      });
      expect(listMembersMock).toHaveBeenCalledTimes(2);
    });
  });

  it('removes member after confirmation and refreshes list', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<TeamPage workspaceId="ws-1" />);

    await screen.findByText('member@example.com');
    await user.click(screen.getByRole('button', { name: /remove/i }));

    await waitFor(() => {
      expect(removeMemberMock).toHaveBeenCalledWith('ws-1', 'u2');
      expect(listMembersMock).toHaveBeenCalledTimes(2);
    });

    confirmSpy.mockRestore();
  });
});

