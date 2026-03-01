import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmptyKeysState } from '../EmptyKeysState';

describe('EmptyKeysState', () => {
  it('renders the component', () => {
    const onImportKey = vi.fn();
    render(<EmptyKeysState onImportKey={onImportKey} />);

    expect(screen.getByText('No SSH keys')).toBeInTheDocument();
  });

  it('displays the helpful message about importing keys', () => {
    const onImportKey = vi.fn();
    render(<EmptyKeysState onImportKey={onImportKey} />);

    expect(screen.getByText(/import your private keys to authenticate/i)).toBeInTheDocument();
  });

  it('renders the Import Key button', () => {
    const onImportKey = vi.fn();
    render(<EmptyKeysState onImportKey={onImportKey} />);

    expect(screen.getByRole('button', { name: /import key/i })).toBeInTheDocument();
  });

  it('calls onImportKey callback when Import Key button is clicked', async () => {
    const user = userEvent.setup();
    const onImportKey = vi.fn();
    render(<EmptyKeysState onImportKey={onImportKey} />);

    await user.click(screen.getByRole('button', { name: /import key/i }));

    expect(onImportKey).toHaveBeenCalledTimes(1);
  });

  it('displays key and shield icons', () => {
    const onImportKey = vi.fn();
    const { container } = render(<EmptyKeysState onImportKey={onImportKey} />);

    expect(container.querySelector('.lucide-key')).toBeInTheDocument();
    expect(container.querySelector('.lucide-shield-check')).toBeInTheDocument();
  });

  it('shows supported key types text', () => {
    const onImportKey = vi.fn();
    render(<EmptyKeysState onImportKey={onImportKey} />);

    expect(screen.getByText(/supports RSA, Ed25519, ECDSA, and more/i)).toBeInTheDocument();
  });
});
