import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsPage } from '../SettingsPage';

const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();
const toastInfoMock = vi.fn();

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
    info: (...args: unknown[]) => toastInfoMock(...args),
  },
}));

vi.mock('@/stores/settings-store', () => ({
  useSettingsStore: () => ({
    fetchSettings: vi.fn(),
    settings: {
      theme: 'dark',
      terminalFont: 'JetBrains Mono',
      terminalFontSize: 13,
      terminalTheme: 'dracula',
      promptStyle: 'default',
      scrollbackLines: 10000,
      cursorStyle: 'block',
      bellStyle: 'none',
      lineHeight: 1,
      copyOnSelect: false,
      aiProvider: 'gemini',
    },
    updateSettings: vi.fn(),
  }),
}));

vi.mock('@/features/settings/AccountSettingsTab', () => ({
  default: () => <div data-testid="account-tab" />,
}));

vi.mock('@/features/settings/ShortcutsSettingsTab', () => ({
  ShortcutsSettingsTab: () => <div data-testid="shortcuts-tab" />,
}));

describe('SettingsPage security tab', () => {
  const listKnownHosts = vi.fn();
  const removeKnownHost = vi.fn();
  const listHostKeyEvents = vi.fn();
  const clearHostKeyEvents = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    listKnownHosts.mockResolvedValue([
      {
        id: 'known-1',
        hostPattern: 'prod.example.com',
        displayHost: 'prod.example.com',
        keyType: 'ssh-ed25519',
        fingerprint: 'SHA256:known1',
        lineNumber: 1,
        hashed: false,
      },
      {
        id: 'known-2',
        hostPattern: 'staging.example.com',
        displayHost: 'staging.example.com',
        keyType: 'ssh-ed25519',
        fingerprint: 'SHA256:known2',
        lineNumber: 2,
        hashed: false,
      },
    ]);
    removeKnownHost.mockResolvedValue(true);
    listHostKeyEvents.mockResolvedValue([
      {
        id: 'evt-1',
        type: 'mismatch_blocked',
        timestamp: '2026-03-01T00:00:00.000Z',
        host: 'prod.example.com',
        port: 22,
        displayHost: 'prod.example.com',
        hostCandidates: ['prod.example.com', '[prod.example.com]:22'],
        keyType: 'ssh-ed25519',
        presentedFingerprint: 'SHA256:newkey',
        knownFingerprints: ['SHA256:known1'],
      },
    ]);
    clearHostKeyEvents.mockResolvedValue(undefined);

    (window as unknown as { sshApi: unknown }).sshApi = {
      listKnownHosts,
      removeKnownHost,
      listHostKeyEvents,
      clearHostKeyEvents,
      connect: vi.fn(),
      disconnect: vi.fn(),
      send: vi.fn(),
      resize: vi.fn(),
      onData: vi.fn(() => () => {}),
      onClosed: vi.fn(() => () => {}),
      onError: vi.fn(() => () => {}),
    };
  });

  it('loads trusted keys and mismatch events on open', async () => {
    render(<SettingsPage activeTab="security" onTabChange={vi.fn()} workspaceId="ws-1" />);

    await waitFor(() => {
      expect(listKnownHosts).toHaveBeenCalled();
      expect(listHostKeyEvents).toHaveBeenCalledWith(100);
    });

    expect((await screen.findAllByText('prod.example.com')).length).toBeGreaterThan(0);
  });

  it('revokes matching trusted entries from mismatch review', async () => {
    const user = userEvent.setup();
    render(<SettingsPage activeTab="security" onTabChange={vi.fn()} workspaceId="ws-1" />);

    const reviewButton = await screen.findByRole('button', { name: /revoke matching trust/i });
    await user.click(reviewButton);

    await waitFor(() => {
      expect(removeKnownHost).toHaveBeenCalledWith('known-1');
      expect(toastSuccessMock).toHaveBeenCalled();
    });
  }, 10_000);

  it('clears host key event history', async () => {
    const user = userEvent.setup();
    render(<SettingsPage activeTab="security" onTabChange={vi.fn()} workspaceId="ws-1" />);

    const clearButton = await screen.findByRole('button', { name: /clear history/i });
    await user.click(clearButton);

    await waitFor(() => {
      expect(clearHostKeyEvents).toHaveBeenCalledTimes(1);
      expect(toastSuccessMock).toHaveBeenCalledWith('Host key event history cleared');
    });
  });
});
