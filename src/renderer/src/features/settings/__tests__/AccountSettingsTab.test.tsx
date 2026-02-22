import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AccountSettingsTab from '../AccountSettingsTab'

// Mock Supabase client
const mockSupabase = vi.hoisted(() => ({
  auth: {
    getUser: vi.fn()
  }
}))

vi.mock('@/lib/supabase', () => ({
  supabase: mockSupabase
}))

// Mock useDataExport hook
const mockExportData = vi.hoisted(() => vi.fn())
vi.mock('../hooks/useDataExport', () => ({
  useDataExport: () => ({
    exportData: mockExportData,
    isExporting: false
  })
}))

describe('AccountSettingsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders loading state initially', () => {
    mockSupabase.auth.getUser.mockReturnValue(new Promise(() => {}))
    render(<AccountSettingsTab />)
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('renders profile summary with user information', async () => {
    const mockUser = {
      email: 'test@example.com',
      user_metadata: {
        full_name: 'Test User'
      }
    }

    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null
    })

    render(<AccountSettingsTab />)

    await waitFor(() => {
      expect(screen.getByText('Profile Summary')).toBeInTheDocument()
    })

    expect(screen.getByText('Test User')).toBeInTheDocument()
    expect(screen.getByText('test@example.com')).toBeInTheDocument()
  })

  it('renders export your data card', async () => {
    const mockUser = {
      email: 'test@example.com',
      user_metadata: {
        full_name: 'Test User'
      }
    }

    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null
    })

    render(<AccountSettingsTab />)

    await waitFor(() => {
      expect(screen.getByText('Export Your Data')).toBeInTheDocument()
    })

    expect(
      screen.getByText(/download a copy of all your data/i)
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /download data/i })).toBeInTheDocument()
  })

  it('calls exportData when download button is clicked', async () => {
    const user = userEvent.setup()
    const mockUser = {
      email: 'test@example.com',
      user_metadata: {
        full_name: 'Test User'
      }
    }

    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null
    })

    render(<AccountSettingsTab />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /download data/i })).toBeInTheDocument()
    })

    const downloadButton = screen.getByRole('button', { name: /download data/i })
    await user.click(downloadButton)

    expect(mockExportData).toHaveBeenCalledTimes(1)
  })

  it('renders manage account card with link to profile', async () => {
    const mockUser = {
      email: 'test@example.com',
      user_metadata: {
        full_name: 'Test User'
      }
    }

    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null
    })

    render(<AccountSettingsTab />)

    await waitFor(() => {
      expect(screen.getByText('Manage Account')).toBeInTheDocument()
    })

    expect(
      screen.getByText(/view and update your profile settings/i)
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /go to profile/i })).toBeInTheDocument()
  })

  it('displays error message when user fetch fails', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Failed to fetch user' }
    })

    render(<AccountSettingsTab />)

    await waitFor(() => {
      expect(screen.getByText(/failed to load user data/i)).toBeInTheDocument()
    })
  })

  it('renders with all required icons', async () => {
    const mockUser = {
      email: 'test@example.com',
      user_metadata: {
        full_name: 'Test User'
      }
    }

    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null
    })

    const { container } = render(<AccountSettingsTab />)

    await waitFor(() => {
      expect(screen.getByText('Profile Summary')).toBeInTheDocument()
    })

    // Check that icons are rendered (they should be in the SVG elements)
    const svgs = container.querySelectorAll('svg')
    expect(svgs.length).toBeGreaterThan(0)
  })

  it('handles missing user name gracefully', async () => {
    const mockUser = {
      email: 'test@example.com',
      user_metadata: {}
    }

    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null
    })

    render(<AccountSettingsTab />)

    await waitFor(() => {
      expect(screen.getByText('Profile Summary')).toBeInTheDocument()
    })

    expect(screen.getByText('Not set')).toBeInTheDocument()
    expect(screen.getByText('test@example.com')).toBeInTheDocument()
  })
})
