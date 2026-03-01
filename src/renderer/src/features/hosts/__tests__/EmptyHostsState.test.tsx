import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmptyHostsState } from '../EmptyHostsState';

describe('EmptyHostsState', () => {
  it('renders the component with server icon', () => {
    const mockOnAddHost = vi.fn();
    const { container } = render(<EmptyHostsState onAddHost={mockOnAddHost} />);

    const serverIcon = container.querySelector('.lucide-server');
    expect(serverIcon).toBeInTheDocument();
  });

  it('displays "No hosts yet" heading', () => {
    const mockOnAddHost = vi.fn();
    render(<EmptyHostsState onAddHost={mockOnAddHost} />);

    expect(screen.getByText('No hosts yet')).toBeInTheDocument();
  });

  it('displays helpful message about adding SSH hosts', () => {
    const mockOnAddHost = vi.fn();
    render(<EmptyHostsState onAddHost={mockOnAddHost} />);

    expect(screen.getByText(/add an SSH host/i)).toBeInTheDocument();
  });

  it('renders Add Host button', () => {
    const mockOnAddHost = vi.fn();
    render(<EmptyHostsState onAddHost={mockOnAddHost} />);

    expect(screen.getByRole('button', { name: /add host/i })).toBeInTheDocument();
  });

  it('calls onAddHost callback when button is clicked', async () => {
    const user = userEvent.setup();
    const mockOnAddHost = vi.fn();
    render(<EmptyHostsState onAddHost={mockOnAddHost} />);

    await user.click(screen.getByRole('button', { name: /add host/i }));

    expect(mockOnAddHost).toHaveBeenCalledTimes(1);
  });

  it('shows supported authentication methods text', () => {
    const mockOnAddHost = vi.fn();
    render(<EmptyHostsState onAddHost={mockOnAddHost} />);

    expect(screen.getByText(/supports password, SSH key, and SSH agent auth/i)).toBeInTheDocument();
  });
});
