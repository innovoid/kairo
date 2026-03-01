import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SnippetPickerOverlay } from '../SnippetPickerOverlay';

vi.mock('@/stores/snippet-store', () => ({
  useSnippetStore: () => ({
    snippets: [
      {
        id: 'snip-1',
        workspaceId: 'ws-1',
        name: 'Tail logs',
        command: 'tail -f /var/log/syslog',
        description: 'Follow system logs',
        tags: ['logs'],
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
    ],
  }),
}));

describe('SnippetPickerOverlay', () => {
  it('renders as modal overlay and inserts selected snippet', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onClose = vi.fn();

    render(<SnippetPickerOverlay onSelect={onSelect} onClose={onClose} />);

    expect(screen.getByRole('heading', { name: 'Snippets' })).toBeInTheDocument();
    await user.click(screen.getByText('Tail logs'));

    expect(onSelect).toHaveBeenCalledWith('tail -f /var/log/syslog');
    expect(onClose).toHaveBeenCalled();
  });
});
