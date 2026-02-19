import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { WelcomeScreen } from '../WelcomeScreen'

describe('WelcomeScreen', () => {
  const mockOnComplete = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the welcome title', () => {
    render(<WelcomeScreen onComplete={mockOnComplete} />)
    expect(screen.getByText('Welcome to ArchTerm')).toBeInTheDocument()
  })

  it('renders the subtitle about SSH client', () => {
    render(<WelcomeScreen onComplete={mockOnComplete} />)
    expect(
      screen.getByText(/your powerful SSH client with team collaboration/i)
    ).toBeInTheDocument()
  })

  it('renders Terminal icon in primary circle', () => {
    const { container } = render(<WelcomeScreen onComplete={mockOnComplete} />)
    // Check for the Terminal icon SVG
    const svgs = container.querySelectorAll('svg')
    expect(svgs.length).toBeGreaterThan(0)
  })

  it('renders 4 feature cards', () => {
    render(<WelcomeScreen onComplete={mockOnComplete} />)
    // Look for the feature card titles
    expect(screen.getByText('Terminal')).toBeInTheDocument()
    expect(screen.getByText('Teams')).toBeInTheDocument()
    expect(screen.getByText('Security')).toBeInTheDocument()
    expect(screen.getByText('Organize')).toBeInTheDocument()
  })

  it('renders feature cards with descriptions', () => {
    render(<WelcomeScreen onComplete={mockOnComplete} />)
    expect(
      screen.getByText(/lightweight and powerful terminal emulation/i)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/collaborate seamlessly with your team/i)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/built-in encryption and key management/i)
    ).toBeInTheDocument()
    expect(
      screen.getByText(/keep your hosts organized/i)
    ).toBeInTheDocument()
  })

  it('renders Get Started button', () => {
    render(<WelcomeScreen onComplete={mockOnComplete} />)
    expect(screen.getByRole('button', { name: /get started/i })).toBeInTheDocument()
  })

  it('calls onComplete when Get Started button is clicked', async () => {
    const user = userEvent.setup()
    render(<WelcomeScreen onComplete={mockOnComplete} />)

    const button = screen.getByRole('button', { name: /get started/i })
    await user.click(button)

    expect(mockOnComplete).toHaveBeenCalledTimes(1)
  })

  it('renders with gradient background', () => {
    const { container } = render(<WelcomeScreen onComplete={mockOnComplete} />)
    const mainDiv = container.firstChild
    expect(mainDiv).toHaveClass('bg-gradient-to-br')
  })

  it('renders Card components for feature cards', () => {
    const { container } = render(<WelcomeScreen onComplete={mockOnComplete} />)
    // Card components have data-slot="card" attribute
    const cards = container.querySelectorAll('[data-slot="card"]')
    expect(cards.length).toBeGreaterThanOrEqual(4)
  })

  it('displays all required feature icons', () => {
    const { container } = render(<WelcomeScreen onComplete={mockOnComplete} />)
    const svgs = container.querySelectorAll('svg')
    // Should have Terminal icon + 4 feature icons + potentially more
    expect(svgs.length).toBeGreaterThanOrEqual(5)
  })

  it('arranges feature cards in 2x2 grid', () => {
    const { container } = render(<WelcomeScreen onComplete={mockOnComplete} />)
    // Look for the grid container with grid-cols-2
    const gridContainer = container.querySelector('.grid-cols-2')
    expect(gridContainer).toBeInTheDocument()
  })
})
