import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Profile } from '../pages/Profile'

// Import mocked APIs so we can control them
import { userApi } from '../services/api'

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

// Mock Toast
vi.mock('../components/ui/Toast', () => ({
  useToast: () => ({
    toast: {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
    },
  }),
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

  it('renders profile page after loading', async () => {
    render(<Profile onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Il tuo Profilo')).toBeInTheDocument()
    })

    expect(screen.getByText('Gestisci le impostazioni del tuo account')).toBeInTheDocument()
  })

  it('displays user account information', async () => {
    render(<Profile onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Informazioni Account')).toBeInTheDocument()
    })

    // Username and email appear in both Navigation and Profile sections
    // Use getAllByText to verify they are present
    const usernames = screen.getAllByText('TestUser')
    expect(usernames.length).toBeGreaterThanOrEqual(1)

    const emails = screen.getAllByText('test@test.com')
    expect(emails.length).toBeGreaterThanOrEqual(1)
  })

  it('displays league memberships', async () => {
    render(<Profile onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Le tue Squadre')).toBeInTheDocument()
    })

    expect(screen.getByText('FC Test')).toBeInTheDocument()
    expect(screen.getByText('Serie A Fantasy')).toBeInTheDocument()
    expect(screen.getByText('150')).toBeInTheDocument()
    expect(screen.getByText('crediti')).toBeInTheDocument()
  })

  it('shows user initial when no profile photo', async () => {
    render(<Profile onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      // 'T' appears in the profile photo avatar area and possibly in Navigation
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

    // Password form should now be visible
    expect(screen.getByPlaceholderText('Inserisci la password attuale')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Minimo 6 caratteri')).toBeInTheDocument()
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

  it('validates minimum password length', async () => {
    const user = userEvent.setup()
    render(<Profile onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Cambia Password')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Cambia Password'))

    await user.type(screen.getByPlaceholderText('Inserisci la password attuale'), 'OldPass1!')
    await user.type(screen.getByPlaceholderText('Minimo 6 caratteri'), '12345')
    await user.type(screen.getByPlaceholderText('Ripeti la nuova password'), '12345')

    await user.click(screen.getByRole('button', { name: 'Salva Password' }))

    await waitFor(() => {
      expect(screen.getByText('La nuova password deve essere di almeno 6 caratteri')).toBeInTheDocument()
    })
  })

  it('validates password confirmation match', async () => {
    const user = userEvent.setup()
    render(<Profile onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Cambia Password')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Cambia Password'))

    await user.type(screen.getByPlaceholderText('Inserisci la password attuale'), 'OldPass1!')
    await user.type(screen.getByPlaceholderText('Minimo 6 caratteri'), 'NewPass1!')
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
    await user.type(screen.getByPlaceholderText('Minimo 6 caratteri'), 'NewPass1!')
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

  it('shows success message after password change', async () => {
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
    await user.type(screen.getByPlaceholderText('Minimo 6 caratteri'), 'NewPass1!')
    await user.type(screen.getByPlaceholderText('Ripeti la nuova password'), 'NewPass1!')

    await user.click(screen.getByRole('button', { name: 'Salva Password' }))

    await waitFor(() => {
      expect(screen.getByText('Password modificata con successo!')).toBeInTheDocument()
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

    await user.type(screen.getByPlaceholderText('Inserisci la password attuale'), 'WrongPass!')
    await user.type(screen.getByPlaceholderText('Minimo 6 caratteri'), 'NewPass1!')
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

    // Form is visible
    expect(screen.getByPlaceholderText('Inserisci la password attuale')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Annulla' }))

    // Form should be hidden
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

  it('shows Foto Profilo section with change button', async () => {
    render(<Profile onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Foto Profilo')).toBeInTheDocument()
    })

    expect(screen.getByText('Cambia Foto')).toBeInTheDocument()
    expect(screen.getByText(/Formati supportati/)).toBeInTheDocument()
  })

  it('does not show teams section when no memberships', async () => {
    vi.mocked(userApi.getProfile).mockResolvedValueOnce({
      success: true,
      data: { ...mockProfile, leagueMemberships: [] },
    })

    render(<Profile onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Il tuo Profilo')).toBeInTheDocument()
    })

    expect(screen.queryByText('Le tue Squadre')).not.toBeInTheDocument()
  })

  it('shows Notifiche section', async () => {
    render(<Profile onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Notifiche')).toBeInTheDocument()
    })
  })
})
