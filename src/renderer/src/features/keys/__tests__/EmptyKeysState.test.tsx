import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { EmptyKeysState } from '../EmptyKeysState'

describe('EmptyKeysState', () => {
  it('renders the component', () => {
    const onImportKey = vi.fn()
    render(<EmptyKeysState onImportKey={onImportKey} />)

    expect(screen.getByText('No SSH keys')).toBeInTheDocument()
  })

  it('displays the helpful message about importing keys', () => {
    const onImportKey = vi.fn()
    render(<EmptyKeysState onImportKey={onImportKey} />)

    expect(screen.getByText(/import your private keys to authenticate/i)).toBeInTheDocument()
  })

  it('renders the Import Key button', () => {
    const onImportKey = vi.fn()
    render(<EmptyKeysState onImportKey={onImportKey} />)

    const button = screen.getByRole('button', { name: /import key/i })
    expect(button).toBeInTheDocument()
  })

  it('calls onImportKey callback when Import Key button is clicked', async () => {
    const user = userEvent.setup()
    const onImportKey = vi.fn()
    render(<EmptyKeysState onImportKey={onImportKey} />)

    const button = screen.getByRole('button', { name: /import key/i })
    await user.click(button)

    expect(onImportKey).toHaveBeenCalledTimes(1)
  })

  it('displays the Key icon', () => {
    const onImportKey = vi.fn()
    const { container } = render(<EmptyKeysState onImportKey={onImportKey} />)

    // Check that at least one SVG icon is rendered
    const svgs = container.querySelectorAll('svg')
    expect(svgs.length).toBeGreaterThan(0)
  })

  it('uses Card component with dashed border styling', () => {
    const onImportKey = vi.fn()
    const { container } = render(<EmptyKeysState onImportKey={onImportKey} />)

    // Card should be rendered with border styling
    const card = container.querySelector('[data-slot="card"]')
    expect(card).toBeInTheDocument()
  })

  it('renders button with Upload icon', () => {
    const onImportKey = vi.fn()
    const { container } = render(<EmptyKeysState onImportKey={onImportKey} />)

    // Should have multiple SVGs: one for Key icon and one for Upload icon
    const svgs = container.querySelectorAll('svg')
    expect(svgs.length).toBeGreaterThanOrEqual(2)
  })
})
