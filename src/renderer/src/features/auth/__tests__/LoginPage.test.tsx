import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginPage } from '../LoginPage';

const authMocks = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  signInWithOAuth: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: authMocks.signInWithPassword,
      signUp: authMocks.signUp,
      signInWithOAuth: authMocks.signInWithOAuth,
    },
  },
}));

describe('LoginPage', () => {
  beforeEach(() => {
    authMocks.signInWithPassword.mockReset();
    authMocks.signUp.mockReset();
    authMocks.signInWithOAuth.mockReset();
    authMocks.signInWithPassword.mockResolvedValue({ error: null });
    authMocks.signUp.mockResolvedValue({ error: null });
    authMocks.signInWithOAuth.mockResolvedValue({ error: null });
  });

  it('signs in with trimmed email', async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText('Email'), '  user@example.com  ');
    await user.type(screen.getByLabelText('Password'), 'password123!');
    await user.click(screen.getByRole('button', { name: 'Enter ArchTerm' }));

    await waitFor(() => {
      expect(authMocks.signInWithPassword).toHaveBeenCalledWith({
        email: 'user@example.com',
        password: 'password123!',
      });
    });
  });

  it('blocks weak signup password before API call', async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.click(screen.getByRole('button', { name: 'Sign Up' }));
    await user.type(screen.getByLabelText('Operator Name'), 'Alice');
    await user.type(screen.getByLabelText('Email'), 'alice@example.com');
    await user.type(screen.getByLabelText('Password'), 'short');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(authMocks.signUp).not.toHaveBeenCalled();
    expect(
      await screen.findByText('Use at least 8 characters for account security.')
    ).toBeInTheDocument();
  });

  it('signs up with trimmed identity data', async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.click(screen.getByRole('button', { name: 'Sign Up' }));
    await user.type(screen.getByLabelText('Operator Name'), '  Alice Admin  ');
    await user.type(screen.getByLabelText('Email'), '  alice@example.com  ');
    await user.type(screen.getByLabelText('Password'), 'StrongPassword#123');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => {
      expect(authMocks.signUp).toHaveBeenCalledWith({
        email: 'alice@example.com',
        password: 'StrongPassword#123',
        options: {
          data: {
            name: 'Alice Admin',
          },
        },
      });
      expect(screen.getByText(/Account created/i)).toBeInTheDocument();
    });
  });

  it('starts GitHub OAuth flow when selected', async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.click(screen.getByRole('button', { name: 'GitHub' }));

    await waitFor(() => {
      expect(authMocks.signInWithOAuth).toHaveBeenCalledWith({ provider: 'github' });
    });
  });
});
