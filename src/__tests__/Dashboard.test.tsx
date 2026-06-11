import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Dashboard } from '../pages/Dashboard'

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
vi.mock('../components/ui/Toast', () => ({
  useToast: () => ({
    toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
  }),
}))

// Mock ConfirmDialog
const mockConfirm = vi.fn().mockResolvedValue(true)
vi.mock('@/components/ui/ConfirmDialog', () => ({
  useConfirmDialog: () => ({ confirm: mockConfirm }),
}))

// Mock Navigation
vi.mock('../components/Navigation', () => ({
  Navigation: ({ currentPage }: { currentPage: string }) => (
    <nav data-testid="navigation" data-page={currentPage}>Navigation</nav>
  ),
}))

// Mock SearchLeaguesModal
vi.mock('../components/SearchLeaguesModal', () => ({
  SearchLeaguesModal: ({ isOpen }: { isOpen: boolean }) => (
    isOpen ? <div data-testid="search-modal">Search Modal</div> : null
  ),
}))

// Mock Skeleton
vi.mock('../components/ui/Skeleton', () => ({
  SkeletonCard: () => <div data-testid="skeleton-card">Loading...</div>,
}))

// Mock Button
vi.mock('../components/ui/Button', () => ({
  Button: ({ children, onClick, ...props }: React.ComponentProps<'button'>) => (
    <button onClick={onClick} {...props}>{children}</button>
  ),
}))

// Mock API
const mockGetAll = vi.fn()
const mockGetStatus = vi.fn()
const mockGetLeagueMovements = vi.fn()
const mockCancelRequest = vi.fn()
const mockGetDashboardSummary = vi.fn()

vi.mock('../services/api', () => ({
  leagueApi: {
    getAll: (...args: unknown[]) => mockGetAll(...args),
    getDashboardSummary: (...args: unknown[]) => mockGetDashboardSummary(...args),
    cancelRequest: (...args: unknown[]) => mockCancelRequest(...args),
    getPendingRequests: vi.fn().mockResolvedValue({ success: true, data: [] }),
  },
  superadminApi: {
    getStatus: (...args: unknown[]) => mockGetStatus(...args),
  },
  movementApi: {
    getLeagueMovements: (...args: unknown[]) => mockGetLeagueMovements(...args),
  },
  tradeApi: {
    getReceived: vi.fn().mockResolvedValue({ success: true, data: [] }),
  },
  userApi: {
    getMyPendingInvites: vi.fn().mockResolvedValue({ success: true, data: [] }),
  },
}))

// Sample league data
const sampleLeagues = [
  {
    membership: { id: 'm1', role: 'ADMIN', status: 'ACTIVE', currentBudget: 350 },
    league: { id: 'l1', name: 'Lega Test', status: 'ACTIVE', members: [{ id: 'm1', role: 'ADMIN' }] },
  },
  {
    membership: { id: 'm2', role: 'MEMBER', status: 'PENDING', currentBudget: 0 },
    league: { id: 'l2', name: 'Lega Pending', status: 'DRAFT', members: [{ id: 'm2', role: 'MEMBER' }] },
  },
]

describe('Dashboard', () => {
  const mockOnNavigate = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetStatus.mockResolvedValue({ success: true, data: { isSuperAdmin: false } })
    mockGetAll.mockResolvedValue({ success: true, data: sampleLeagues })
    mockGetDashboardSummary.mockResolvedValue({ success: true, data: { summaries: {} } })
    mockGetLeagueMovements.mockResolvedValue({ success: true, data: { movements: [] } })
  })

  it('renders loading skeleton initially', () => {
    // Make the API never resolve during this test
    mockGetStatus.mockReturnValue(new Promise(() => {}))

    render(<Dashboard onNavigate={mockOnNavigate} />)

    expect(screen.getAllByTestId('skeleton-card').length).toBeGreaterThan(0)
  })

  it('renders league cards after data loads', async () => {
    render(<Dashboard onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Lega Test')).toBeInTheDocument()
    })

    expect(screen.getByText('Lega Pending')).toBeInTheDocument()
  })

  it('shows page title and subtitle', async () => {
    render(<Dashboard onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Le mie Leghe')).toBeInTheDocument()
    })

    expect(screen.getByText('Gestisci le tue leghe fantasy')).toBeInTheDocument()
  })

  it('redirects superadmin to superadmin panel', async () => {
    mockGetStatus.mockResolvedValue({ success: true, data: { isSuperAdmin: true } })

    render(<Dashboard onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(mockOnNavigate).toHaveBeenCalledWith('superadmin')
    })
  })

  it('shows empty state when no leagues', async () => {
    mockGetAll.mockResolvedValue({ success: true, data: [] })

    render(<Dashboard onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Benvenuto su Fantacontratti!')).toBeInTheDocument()
    })
  })

  it('shows error state on API failure and allows retry', async () => {
    mockGetStatus.mockRejectedValueOnce(new Error('Network error'))

    render(<Dashboard onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Errore nel caricamento dei dati. Verifica la connessione.')).toBeInTheDocument()
    })

    expect(screen.getByText('Riprova')).toBeInTheDocument()
  })

  it('navigates to create-league when "Crea Nuova Lega" is clicked', async () => {
    const user = userEvent.setup()

    render(<Dashboard onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Lega Test')).toBeInTheDocument()
    })

    // The "Crea Nuova Lega" button in the header area
    const createButton = screen.getByText(/Crea Nuova Lega/)
    await user.click(createButton)

    expect(mockOnNavigate).toHaveBeenCalledWith('create-league')
  })

  it('navigates to league detail when an active league card is clicked', async () => {
    render(<Dashboard onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Lega Test')).toBeInTheDocument()
    })

    // Click on the league card text
    const leagueCard = screen.getByText('Lega Test').closest('div[class*="cursor-pointer"]')
    expect(leagueCard).toBeTruthy()
    if (leagueCard) {
      await userEvent.click(leagueCard)
      expect(mockOnNavigate).toHaveBeenCalledWith('leagueDetail', { leagueId: 'l1' })
    }
  })

  it('shows pending banner for pending membership', async () => {
    render(<Dashboard onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText(/in attesa di approvazione/i)).toBeInTheDocument()
    })
  })

  it('surfaces a league with trade offers in the attention section', async () => {
    mockGetDashboardSummary.mockResolvedValue({
      success: true,
      data: {
        summaries: {
          l1: {
            phase: { type: 'MERCATO_RICORRENTE', currentPhase: 'OFFERTE_PRE_RINNOVO' },
            tradeOffersReceived: 2,
            isAdmin: true,
            pendingJoinRequests: 0,
            pendingAppeals: 0,
            needsConsolidation: false,
          },
        },
      },
    })

    render(<Dashboard onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Richiede la tua attenzione')).toBeInTheDocument()
    })

    // Primary CTA for the trade-offers signal
    const cta = screen.getByText('Valuta offerte →')
    await userEvent.click(cta)
    expect(mockOnNavigate).toHaveBeenCalledWith('trades', { leagueId: 'l1' })
  })

  it('surfaces a "tocca a te" turn signal and navigates to the auction room', async () => {
    mockGetDashboardSummary.mockResolvedValue({
      success: true,
      data: {
        summaries: {
          l1: {
            phase: { type: 'PRIMO_MERCATO', currentPhase: 'ASTA_LIBERA' },
            tradeOffersReceived: 0,
            isAdmin: true,
            pendingJoinRequests: 0,
            pendingAppeals: 0,
            needsConsolidation: false,
            isYourTurn: true,
            turnTarget: { kind: 'auction', sessionId: 'sess-1' },
          },
        },
      },
    })

    render(<Dashboard onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Richiede la tua attenzione')).toBeInTheDocument()
    })

    expect(screen.getByText('🔴 Tocca a te')).toBeInTheDocument()
    expect(screen.getByText('È il tuo turno')).toBeInTheDocument()

    const cta = screen.getByText('Entra →')
    await userEvent.click(cta)
    expect(mockOnNavigate).toHaveBeenCalledWith('auction', { leagueId: 'l1', sessionId: 'sess-1' })
  })

  it('opens search modal when "Cerca Leghe" button is clicked', async () => {
    const user = userEvent.setup()

    render(<Dashboard onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Lega Test')).toBeInTheDocument()
    })

    const searchButton = screen.getByText('Cerca Leghe')
    await user.click(searchButton)

    expect(screen.getByTestId('search-modal')).toBeInTheDocument()
  })
})
