import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { EmptyHostsState } from '../EmptyHostsState'

describe('EmptyHostsState', () => {
  it('renders the component with server icon', () => {
    const mockOnAddHost = vi.fn()
    const { container } = render(<EmptyHostsState onAddHost={mockOnAddHost} />)

    // Check for server icon (lucide-react Server icon)
    const serverIcon = container.querySelector('.lucide-server')
    expect(serverIcon).toBeInTheDocument()
  })

  it('displays "No hosts yet" heading', () => {
    const mockOnAddHost = vi.fn()
    render(<EmptyHostsState onAddHost={mockOnAddHost} />)

    expect(screen.getByText('No hosts yet')).toBeInTheDocument()
  })

  it('displays helpful message about adding SSH hosts', () => {
    const mockOnAddHost = vi.fn()
    render(<EmptyHostsState onAddHost={mockOnAddHost} />)

    expect(screen.getByText(/add your first SSH host/i)).toBeInTheDocument()
  })

  it('renders Add Host button with Plus icon', () => {
    const mockOnAddHost = vi.fn()
    render(<EmptyHostsState onAddHost={mockOnAddHost} />)

    const button = screen.getByRole('button', { name: /add host/i })
    expect(button).toBeInTheDocument()
  })

  it('calls onAddHost callback when button is clicked', async () => {
    const user = userEvent.setup()
    const mockOnAddHost = vi.fn()
    render(<EmptyHostsState onAddHost={mockOnAddHost} />)

    const button = screen.getByRole('button', { name: /add host/i })
    await user.click(button)

    expect(mockOnAddHost).toHaveBeenCalledTimes(1)
  })

  it('uses Card with dashed border', () => {
    const mockOnAddHost = vi.fn()
    const { container } = render(<EmptyHostsState onAddHost={mockOnAddHost} />)

    const card = container.querySelector('[data-slot="card"]')
    expect(card).toBeInTheDocument()

    // Check for dashed border
    expect(card?.className).toContain('border-dashed')
  })

  it('displays server icon in rounded background', () => {
    const mockOnAddHost = vi.fn()
    const { container } = render(<EmptyHostsState onAddHost={mockOnAddHost} />)

    const iconContainer = container.querySelector('[data-testid="server-icon-container"]')
    expect(iconContainer).toBeInTheDocument()

    // Verify it has rounded classes
    expect(iconContainer?.className).toContain('rounded')
    expect(iconContainer?.className).toContain('bg')
  })
})
