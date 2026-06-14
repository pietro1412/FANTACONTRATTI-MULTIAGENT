import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Profile } from '../pages/Profile'

// Import mocked APIs so we can control them
import { userApi } from '../services/api'

// Shared toast mock so assertions can inspect calls
const toastMock = {
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
}

// Mock useAuth hook
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: '1', email: 'test@test.com', username: 'TestUser' },
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
  }),
}))

// Mock APIs
vi.mock('../services/api', () => ({
  userApi: {
    getProfile: vi.fn(),
    updateProfile: vi.fn(),
    changePassword: vi.fn(),
    updateProfilePhoto: vi.fn(),
    removeProfilePhoto: vi.fn(),
    getMyPendingInvites: vi.fn().mockResolvedValue({ success: true, data: [] }),
  },
  pushApi: {
    getVapidKey: vi.fn().mockResolvedValue({ success: false }),
    getPreferences: vi.fn().mockResolvedValue({ success: false }),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    updatePreferences: vi.fn(),
  },
  superadminApi: {
    getStatus: vi.fn().mockResolvedValue({ success: true, data: { isSuperAdmin: false } }),
  },
  tradeApi: {
    getReceived: vi.fn().mockResolvedValue({ success: true, data: [] }),
  },
  leagueApi: {
    getPendingRequests: vi.fn().mockResolvedValue({ success: true, data: [] }),
  },
  feedbackApi: {
    getUnreadNotifications: vi.fn().mockResolvedValue({ success: true, data: [] }),
  },
}))

// Mock Toast (shared instance so we can assert on toast calls)
vi.mock('../components/ui/Toast', () => ({
  useToast: () => ({ toast: toastMock }),
}))

// Mock ConfirmDialog
const mockConfirm = vi.fn()
vi.mock('@/components/ui/ConfirmDialog', () => ({
  useConfirmDialog: () => ({
    confirm: mockConfirm,
  }),
}))

const mockProfile = {
  id: '1',
  email: 'test@test.com',
  username: 'TestUser',
  profilePhoto: null,
  emailVerified: true,
  createdAt: '2024-01-01T00:00:00.000Z',
  leagueMemberships: [
    {
      id: 'mem-1',
      role: 'MANAGER',
      teamName: 'FC Test',
      status: 'ACTIVE',
      currentBudget: 150,
      league: { id: 'league-1', name: 'Serie A Fantasy', status: 'ACTIVE' },
    },
  ],
}

describe('Profile Page', () => {
  const mockOnNavigate = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(userApi.getProfile).mockResolvedValue({
      success: true,
      data: mockProfile,
    })
  })

  it('shows loading spinner initially', () => {
    // Delay profile response to see loading state
    vi.mocked(userApi.getProfile).mockReturnValue(new Promise(() => {}))
    render(<Profile onNavigate={mockOnNavigate} />)

    // The loading spinner has the animate-spin class
    expect(document.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('renders profile header after loading', async () => {
    render(<Profile onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Email verificata', { exact: false })).toBeInTheDocument()
    })

    // Username + email appear in the header (and possibly Navigation)
    expect(screen.getAllByText('TestUser').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('test@test.com').length).toBeGreaterThanOrEqual(1)
  })

  it('displays user account information section', async () => {
    render(<Profile onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Informazioni account')).toBeInTheDocument()
    })

    const usernames = screen.getAllByText('TestUser')
    expect(usernames.length).toBeGreaterThanOrEqual(1)

    const emails = screen.getAllByText('test@test.com')
    expect(emails.length).toBeGreaterThanOrEqual(1)
  })

  it('displays league memberships', async () => {
    render(<Profile onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Le mie squadre')).toBeInTheDocument()
    })

    expect(screen.getByText('FC Test')).toBeInTheDocument()
    // League name appears in the team row
    expect(screen.getByText('Serie A Fantasy')).toBeInTheDocument()
    expect(screen.getByText('Apri →')).toBeInTheDocument()
  })

  it('navigates to league detail when a team is clicked', async () => {
    const user = userEvent.setup()
    render(<Profile onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('FC Test')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Apri →'))

    expect(mockOnNavigate).toHaveBeenCalledWith('leagueDetail', { leagueId: 'league-1' })
  })

  it('shows user initial when no profile photo', async () => {
    render(<Profile onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      // 'T' appears in the header avatar / photo section / possibly Navigation
      const initials = screen.getAllByText('T')
      expect(initials.length).toBeGreaterThanOrEqual(1)
    })
  })

  it('shows Change Password button and reveals form on click', async () => {
    const user = userEvent.setup()
    render(<Profile onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Cambia Password')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Cambia Password'))

    expect(screen.getByPlaceholderText('Inserisci la password attuale')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Nuova password')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Ripeti la nuova password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Salva Password' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Annulla' })).toBeInTheDocument()
  })

  it('validates that all password fields are required', async () => {
    const user = userEvent.setup()
    render(<Profile onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Cambia Password')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Cambia Password'))
    await user.click(screen.getByRole('button', { name: 'Salva Password' }))

    await waitFor(() => {
      expect(screen.getByText('Tutti i campi sono obbligatori')).toBeInTheDocument()
    })
  })

  it('enforces the unified password policy (min 8)', async () => {
    const user = userEvent.setup()
    render(<Profile onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Cambia Password')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Cambia Password'))

    await user.type(screen.getByPlaceholderText('Inserisci la password attuale'), 'OldPass1!')
    await user.type(screen.getByPlaceholderText('Nuova password'), 'Ab1')
    await user.type(screen.getByPlaceholderText('Ripeti la nuova password'), 'Ab1')

    await user.click(screen.getByRole('button', { name: 'Salva Password' }))

    await waitFor(() => {
      expect(screen.getByText('Minimo 8 caratteri')).toBeInTheDocument()
    })
    expect(userApi.changePassword).not.toHaveBeenCalled()
  })

  it('validates password confirmation match', { timeout: 15000 }, async () => {
    const user = userEvent.setup()
    render(<Profile onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Cambia Password')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Cambia Password'))

    await user.type(screen.getByPlaceholderText('Inserisci la password attuale'), 'OldPass1!')
    await user.type(screen.getByPlaceholderText('Nuova password'), 'NewPass1!')
    await user.type(screen.getByPlaceholderText('Ripeti la nuova password'), 'DifferentPass1!')

    await user.click(screen.getByRole('button', { name: 'Salva Password' }))

    await waitFor(() => {
      expect(screen.getByText('Le password non corrispondono')).toBeInTheDocument()
    })
  })

  it('calls changePassword API with correct data on valid submit', async () => {
    vi.mocked(userApi.changePassword).mockResolvedValueOnce({
      success: true,
      message: 'Password aggiornata',
    })
    const user = userEvent.setup()
    render(<Profile onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Cambia Password')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Cambia Password'))

    await user.type(screen.getByPlaceholderText('Inserisci la password attuale'), 'OldPass1!')
    await user.type(screen.getByPlaceholderText('Nuova password'), 'NewPass1!')
    await user.type(screen.getByPlaceholderText('Ripeti la nuova password'), 'NewPass1!')

    await user.click(screen.getByRole('button', { name: 'Salva Password' }))

    await waitFor(() => {
      expect(userApi.changePassword).toHaveBeenCalledWith({
        currentPassword: 'OldPass1!',
        newPassword: 'NewPass1!',
        confirmNewPassword: 'NewPass1!',
      })
    })
  })

  it('shows success toast after password change', async () => {
    vi.mocked(userApi.changePassword).mockResolvedValueOnce({
      success: true,
      message: 'Password aggiornata',
    })
    const user = userEvent.setup()
    render(<Profile onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Cambia Password')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Cambia Password'))

    await user.type(screen.getByPlaceholderText('Inserisci la password attuale'), 'OldPass1!')
    await user.type(screen.getByPlaceholderText('Nuova password'), 'NewPass1!')
    await user.type(screen.getByPlaceholderText('Ripeti la nuova password'), 'NewPass1!')

    await user.click(screen.getByRole('button', { name: 'Salva Password' }))

    await waitFor(() => {
      expect(toastMock.success).toHaveBeenCalledWith('Password modificata con successo!')
    })
  })

  it('shows error message on failed password change', async () => {
    vi.mocked(userApi.changePassword).mockResolvedValueOnce({
      success: false,
      message: 'Password attuale errata',
    })
    const user = userEvent.setup()
    render(<Profile onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Cambia Password')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Cambia Password'))

    await user.type(screen.getByPlaceholderText('Inserisci la password attuale'), 'WrongPass1!')
    await user.type(screen.getByPlaceholderText('Nuova password'), 'NewPass1!')
    await user.type(screen.getByPlaceholderText('Ripeti la nuova password'), 'NewPass1!')

    await user.click(screen.getByRole('button', { name: 'Salva Password' }))

    await waitFor(() => {
      expect(screen.getByText('Password attuale errata')).toBeInTheDocument()
    })
  })

  it('hides password form when Cancel button is clicked', async () => {
    const user = userEvent.setup()
    render(<Profile onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Cambia Password')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Cambia Password'))

    expect(screen.getByPlaceholderText('Inserisci la password attuale')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Annulla' }))

    expect(screen.queryByPlaceholderText('Inserisci la password attuale')).not.toBeInTheDocument()
  })

  it('navigates to dashboard when back button is clicked', async () => {
    const user = userEvent.setup()
    render(<Profile onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Torna alla Dashboard')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Torna alla Dashboard'))

    expect(mockOnNavigate).toHaveBeenCalledWith('dashboard')
  })

  it('shows Foto profilo section with change button', async () => {
    render(<Profile onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Foto profilo')).toBeInTheDocument()
    })

    expect(screen.getByText('Cambia foto')).toBeInTheDocument()
    expect(screen.getByText(/max 500KB/)).toBeInTheDocument()
  })

  it('does not show teams section when no memberships', async () => {
    vi.mocked(userApi.getProfile).mockResolvedValueOnce({
      success: true,
      data: { ...mockProfile, leagueMemberships: [] },
    })

    render(<Profile onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Informazioni account')).toBeInTheDocument()
    })

    expect(screen.queryByText('Le mie squadre')).not.toBeInTheDocument()
  })

  it('shows Notifiche section', async () => {
    render(<Profile onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Notifiche')).toBeInTheDocument()
    })
  })
})
