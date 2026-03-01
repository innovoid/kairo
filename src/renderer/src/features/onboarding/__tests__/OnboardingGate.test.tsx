import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OnboardingGate } from '../OnboardingGate';

const isE2EModeMock = vi.fn(() => false);

vi.mock('@/lib/e2e', () => ({
  isE2EMode: () => isE2EModeMock(),
}));

describe('OnboardingGate', () => {
  beforeEach(() => {
    localStorage.clear();
    isE2EModeMock.mockReturnValue(false);

    (window as any).workspaceApi = {
      getActiveContext: vi.fn().mockResolvedValue({
        workspace: {
          id: 'ws-1',
          name: 'Personal Workspace',
          createdBy: 'u1',
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
      }),
      ensurePersonalWorkspace: vi.fn().mockResolvedValue({
        id: 'ws-1',
        name: 'Personal Workspace',
        createdBy: 'u1',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      }),
      update: vi.fn().mockResolvedValue({}),
    };

    (window as any).keysApi = {
      isWorkspaceEncryptionInitialized: vi.fn().mockResolvedValue(false),
      initializeWorkspaceEncryption: vi.fn().mockResolvedValue(undefined),
    };
  });

  it('renders app children when onboarding is already completed for workspace', async () => {
    localStorage.setItem('archterm:onboarding:v2:ws-1', 'true');

    render(
      <OnboardingGate>
        <div>APP_READY</div>
      </OnboardingGate>
    );

    await waitFor(() => {
      expect(screen.getByText('APP_READY')).toBeInTheDocument();
    });
  });

  it('renders setup flow when onboarding is not completed', async () => {
    render(
      <OnboardingGate>
        <div>APP_READY</div>
      </OnboardingGate>
    );

    await waitFor(() => {
      expect(screen.getByText('Initialize Workspace')).toBeInTheDocument();
    });
    expect(screen.queryByText('APP_READY')).not.toBeInTheDocument();
  });

  it('bypasses onboarding in e2e mode', async () => {
    isE2EModeMock.mockReturnValue(true);

    render(
      <OnboardingGate>
        <div>APP_READY</div>
      </OnboardingGate>
    );

    expect(screen.getByText('APP_READY')).toBeInTheDocument();
  });

  it('completes setup flow with workspace rename and encryption init', async () => {
    const user = userEvent.setup();
    const updateMock = vi.fn().mockResolvedValue({});
    const initEncryptionMock = vi.fn().mockResolvedValue(undefined);

    (window as any).workspaceApi.update = updateMock;
    (window as any).keysApi.initializeWorkspaceEncryption = initEncryptionMock;

    render(
      <OnboardingGate>
        <div>APP_READY</div>
      </OnboardingGate>
    );

    await screen.findByText('Initialize Workspace');
    await user.click(screen.getByRole('button', { name: /continue/i }));

    const workspaceInput = await screen.findByLabelText('Workspace Name');
    await user.clear(workspaceInput);
    await user.type(workspaceInput, 'Prod Ops');
    await user.click(screen.getByRole('button', { name: /^continue$/i }));

    await screen.findByText('Encryption Passphrase');
    await user.type(screen.getByLabelText('Passphrase'), 'StrongPassphrase#2026');
    await user.type(screen.getByLabelText('Confirm Passphrase'), 'StrongPassphrase#2026');
    await user.click(screen.getByRole('button', { name: /finish setup/i }));

    await waitFor(() => {
      expect(updateMock).toHaveBeenCalledWith('ws-1', { name: 'Prod Ops' });
      expect(initEncryptionMock).toHaveBeenCalledWith('ws-1', 'StrongPassphrase#2026');
      expect(screen.getByText('APP_READY')).toBeInTheDocument();
      expect(localStorage.getItem('archterm:onboarding:v2:ws-1')).toBe('true');
    });
  });
});
