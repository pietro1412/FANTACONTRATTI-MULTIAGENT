import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InviteDetail } from '../pages/InviteDetail'

// Mock useAuth hook
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: '1', email: 'test@test.com', username: 'TestUser' },
    isAuthenticated: true,
    isLoading: false,
    logout: vi.fn(),
  }),
}))

// Mock Toast provider
const mockToastError = vi.fn()
vi.mock('@/components/ui/Toast', () => ({
  useToast: () => ({
    toast: { success: vi.fn(), error: mockToastError, warning: vi.fn(), info: vi.fn() },
  }),
}))

// Mock Navigation
vi.mock('../components/Navigation', () => ({
  Navigation: ({ currentPage }: { currentPage: string }) => (
    <nav data-testid="navigation" data-page={currentPage}>Navigation</nav>
  ),
}))

// Mock Button
vi.mock('../components/ui/Button', () => ({
  Button: ({ children, onClick, disabled, ...props }: React.ComponentProps<'button'>) => (
    <button onClick={onClick} disabled={disabled} {...props}>{children}</button>
  ),
}))

// Mock Input
vi.mock('../components/ui/Input', () => ({
  Input: ({ value, onChange, placeholder, ...rest }: { value: string; onChange: React.ChangeEventHandler<HTMLInputElement>; placeholder?: string; label?: string; [key: string]: unknown }) => (
    <input value={value} onChange={onChange} placeholder={placeholder} aria-label={rest.label || placeholder} {...rest} />
  ),
}))

// Mock API
const mockGetDetails = vi.fn()
const mockAccept = vi.fn()
const mockReject = vi.fn()

vi.mock('../services/api', () => ({
  inviteApi: {
    getDetails: (...args: unknown[]) => mockGetDetails(...args),
    accept: (...args: unknown[]) => mockAccept(...args),
    reject: (...args: unknown[]) => mockReject(...args),
  },
  superadminApi: {
    getStatus: vi.fn().mockResolvedValue({ success: true, data: { isSuperAdmin: false } }),
  },
  tradeApi: {
    getReceived: vi.fn().mockResolvedValue({ success: true, data: [] }),
  },
  userApi: {
    getMyPendingInvites: vi.fn().mockResolvedValue({ success: true, data: [] }),
  },
  leagueApi: {
    getPendingRequests: vi.fn().mockResolvedValue({ success: true, data: [] }),
  },
}))

// Sample invite data
const sampleInvite = {
  token: 'abc123',
  email: 'test@test.com',
  expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days from now
  createdAt: '2025-01-01T00:00:00.000Z',
  inviter: {
    username: 'AdminUser',
    profilePhoto: null,
  },
  league: {
    id: 'l1',
    name: 'Lega Champions',
    description: 'The best fantasy league',
    status: 'DRAFT',
    createdAt: '2025-01-01T00:00:00.000Z',
    config: {
      minParticipants: 4,
      maxParticipants: 8,
      initialBudget: 500,
      slots: {
        goalkeeper: 3,
        defender: 8,
        midfielder: 8,
        forward: 6,
      },
    },
    admin: {
      username: 'AdminUser',
      teamName: 'Team Admin',
      profilePhoto: null,
    },
    members: [
      { id: 'm1', role: 'ADMIN', teamName: 'Team Admin', username: 'AdminUser', profilePhoto: null },
      { id: 'm2', role: 'MEMBER', teamName: 'Team Beta', username: 'Player2', profilePhoto: null },
    ],
    currentMembers: 2,
    availableSpots: 6,
  },
}

describe('InviteDetail', () => {
  const mockOnNavigate = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetDetails.mockResolvedValue({ success: true, data: sampleInvite })
  })

  it('shows loading spinner initially', () => {
    mockGetDetails.mockReturnValue(new Promise(() => {}))

    render(<InviteDetail token="abc123" onNavigate={mockOnNavigate} />)

    expect(screen.getByText('Caricamento invito...')).toBeInTheDocument()
  })

  it('renders invite details after loading', async () => {
    render(<InviteDetail token="abc123" onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Sei stato invitato!')).toBeInTheDocument()
    })

    expect(screen.getByText('Lega Champions')).toBeInTheDocument()
    expect(screen.getByText('The best fantasy league')).toBeInTheDocument()
    // AdminUser appears multiple times (inviter text + sidebar)
    const adminUsers = screen.getAllByText('AdminUser')
    expect(adminUsers.length).toBeGreaterThan(0)
  })

  it('shows error state when invite is not found', async () => {
    mockGetDetails.mockResolvedValue({ success: false, message: 'Invito scaduto' })

    render(<InviteDetail token="bad-token" onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Invito non valido')).toBeInTheDocument()
    })

    expect(screen.getByText('Invito scaduto')).toBeInTheDocument()
  })

  it('shows league configuration stats', async () => {
    render(<InviteDetail token="abc123" onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Configurazione Lega')).toBeInTheDocument()
    })

    // Budget
    expect(screen.getByText('500')).toBeInTheDocument()
    expect(screen.getByText('Budget Iniziale')).toBeInTheDocument()

    // Total slots: 3+8+8+6 = 25
    expect(screen.getByText('25')).toBeInTheDocument()
    expect(screen.getByText('Slot Rosa')).toBeInTheDocument()

    // Members - rendered as separate text nodes "2" "/" "8" inside a <p>
    const participantsLabel = screen.getByText('Partecipanti')
    expect(participantsLabel).toBeInTheDocument()
    // The parent stat card contains "2/8"
    const statCard = participantsLabel.closest('div')
    expect(statCard?.textContent).toContain('2')
    expect(statCard?.textContent).toContain('8')

    // Available spots
    expect(screen.getByText('Posti Liberi')).toBeInTheDocument()
  })

  it('disables accept button when team name is too short', async () => {
    const user = userEvent.setup()

    render(<InviteDetail token="abc123" onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Sei stato invitato!')).toBeInTheDocument()
    })

    // With empty team name, accept button should be disabled
    const acceptButton = screen.getByText('Accetta Invito')
    expect(acceptButton).toBeDisabled()

    // Type a single character (still too short)
    const teamInput = screen.getByPlaceholderText('Es. FC Campioni, Inter Stars...')
    await user.type(teamInput, 'A')
    expect(acceptButton).toBeDisabled()

    // Type another character (now valid, length >= 2)
    await user.type(teamInput, 'B')
    expect(acceptButton).not.toBeDisabled()
  })

  it('accepts invite and navigates to league detail', async () => {
    const user = userEvent.setup()
    mockAccept.mockResolvedValue({ success: true })

    render(<InviteDetail token="abc123" onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Sei stato invitato!')).toBeInTheDocument()
    })

    const teamInput = screen.getByPlaceholderText('Es. FC Campioni, Inter Stars...')
    await user.type(teamInput, 'My Team FC')

    const acceptButton = screen.getByText('Accetta Invito')
    await user.click(acceptButton)

    await waitFor(() => {
      expect(mockAccept).toHaveBeenCalledWith('abc123', 'My Team FC')
    })

    expect(mockOnNavigate).toHaveBeenCalledWith('leagueDetail', { leagueId: 'l1' })
  })

  it('shows toast error on failed accept', async () => {
    const user = userEvent.setup()
    mockAccept.mockResolvedValue({ success: false, message: 'Lega piena' })

    render(<InviteDetail token="abc123" onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Sei stato invitato!')).toBeInTheDocument()
    })

    const teamInput = screen.getByPlaceholderText('Es. FC Campioni, Inter Stars...')
    await user.type(teamInput, 'My Team FC')

    await user.click(screen.getByText('Accetta Invito'))

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Lega piena')
    })
  })

  it('rejects invite and navigates to dashboard', async () => {
    const user = userEvent.setup()
    mockReject.mockResolvedValue({ success: true })

    render(<InviteDetail token="abc123" onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Sei stato invitato!')).toBeInTheDocument()
    })

    const rejectButton = screen.getByText('Rifiuta Invito')
    await user.click(rejectButton)

    await waitFor(() => {
      expect(mockReject).toHaveBeenCalledWith('abc123')
    })

    expect(mockOnNavigate).toHaveBeenCalledWith('dashboard')
  })

  it('navigates to dashboard when "Torna alla Dashboard" back link is clicked', async () => {
    const user = userEvent.setup()

    render(<InviteDetail token="abc123" onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Sei stato invitato!')).toBeInTheDocument()
    })

    const backButton = screen.getByText('Torna alla Dashboard')
    await user.click(backButton)

    expect(mockOnNavigate).toHaveBeenCalledWith('dashboard')
  })

  it('displays member list with roles', async () => {
    render(<InviteDetail token="abc123" onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Partecipanti (2)')).toBeInTheDocument()
    })

    expect(screen.getByText('Team Admin')).toBeInTheDocument()
    expect(screen.getByText('Team Beta')).toBeInTheDocument()
    expect(screen.getByText('Presidente')).toBeInTheDocument()
  })

  it('navigates to dashboard from error page button', async () => {
    const user = userEvent.setup()
    mockGetDetails.mockResolvedValue({ success: false, message: 'Token non valido' })

    render(<InviteDetail token="bad-token" onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Invito non valido')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Torna alla Dashboard'))
    expect(mockOnNavigate).toHaveBeenCalledWith('dashboard')
  })
})
