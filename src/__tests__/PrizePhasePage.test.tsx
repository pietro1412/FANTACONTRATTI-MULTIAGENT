import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PrizePhasePage } from '../pages/PrizePhasePage'

// Mock useAuth
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user1', username: 'TestUser', email: 'test@test.it', role: 'MANAGER' },
    isAuthenticated: true,
    isLoading: false,
    logout: vi.fn(),
  }),
}))

// Mock Toast
vi.mock('../components/ui/Toast', () => ({
  useToast: () => ({
    toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
  }),
}))

// Mock ConfirmDialog
vi.mock('@/components/ui/ConfirmDialog', () => ({
  useConfirmDialog: () => ({ confirm: vi.fn().mockResolvedValue(true) }),
}))

// Mock Navigation
vi.mock('../components/Navigation', () => ({
  Navigation: ({ currentPage }: { currentPage: string }) => (
    <nav data-testid="navigation" data-page={currentPage}>Navigation</nav>
  ),
}))

// Mock PrizePhaseManager
vi.mock('../components/PrizePhaseManager', () => ({
  PrizePhaseManager: ({ sessionId, isAdmin }: { sessionId: string; isAdmin: boolean }) => (
    <div data-testid="prize-phase-manager" data-session-id={sessionId} data-admin={String(isAdmin)}>
      PrizePhaseManager
    </div>
  ),
}))

// API mocks
const mockGetById = vi.fn()
const mockGetSessions = vi.fn()
const mockGetHistory = vi.fn()

vi.mock('../services/api', () => ({
  leagueApi: {
    getById: (...args: unknown[]) => mockGetById(...args),
  },
  auctionApi: {
    getSessions: (...args: unknown[]) => mockGetSessions(...args),
  },
  prizePhaseApi: {
    getHistory: (...args: unknown[]) => mockGetHistory(...args),
  },
}))

// Sample data
const sampleActiveSession = {
  id: 'session1',
  type: 'PRIMO_MERCATO',
  status: 'ACTIVE',
  currentPhase: 'PREMI',
}

const sampleHistorySession = {
  sessionId: 'session-old',
  type: 'PRIMO_MERCATO',
  season: 1,
  semester: 'FIRST',
  finalizedAt: '2025-01-15T10:00:00Z',
  baseReincrement: 20,
  categories: [
    { name: 'Miglior Difesa', isSystemPrize: true },
    { name: 'Capocannoniere', isSystemPrize: false },
  ],
  members: [
    {
      memberId: 'm1',
      teamName: 'FC Test',
      username: 'testuser',
      baseReincrement: 20,
      categoryPrizes: { 'Miglior Difesa': 10, 'Capocannoniere': 0 },
      total: 30,
    },
    {
      memberId: 'm2',
      teamName: 'FC Other',
      username: 'otheruser',
      baseReincrement: 20,
      categoryPrizes: { 'Miglior Difesa': 0, 'Capocannoniere': 15 },
      total: 35,
    },
  ],
}

describe('PrizePhasePage', () => {
  const mockOnNavigate = vi.fn()
  const defaultLeagueId = 'league1'

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetById.mockResolvedValue({
      success: true,
      data: { isAdmin: false },
    })
    mockGetSessions.mockResolvedValue({
      success: true,
      data: [sampleActiveSession],
    })
    mockGetHistory.mockResolvedValue({
      success: true,
      data: { history: [] },
    })
  })

  it('shows loading spinner initially', () => {
    mockGetById.mockReturnValue(new Promise(() => {}))
    render(<PrizePhasePage leagueId={defaultLeagueId} onNavigate={mockOnNavigate} />)
    expect(screen.getByText('Caricamento fase premi...')).toBeInTheDocument()
  })

  it('renders Navigation with correct currentPage', async () => {
    render(<PrizePhasePage leagueId={defaultLeagueId} onNavigate={mockOnNavigate} />)
    await waitFor(() => {
      expect(screen.getByTestId('navigation')).toHaveAttribute('data-page', 'prizes')
    })
  })

  it('renders PrizePhaseManager when an active session exists', async () => {
    render(<PrizePhasePage leagueId={defaultLeagueId} onNavigate={mockOnNavigate} />)
    await waitFor(() => {
      expect(screen.getByTestId('prize-phase-manager')).toBeInTheDocument()
    })
    expect(screen.getByTestId('prize-phase-manager')).toHaveAttribute('data-session-id', 'session1')
  })

  it('shows no active session message when no sessions are active', async () => {
    mockGetSessions.mockResolvedValue({
      success: true,
      data: [{ id: 's1', type: 'PRIMO_MERCATO', status: 'COMPLETED', currentPhase: null }],
    })
    render(<PrizePhasePage leagueId={defaultLeagueId} onNavigate={mockOnNavigate} />)
    await waitFor(() => {
      expect(screen.getByText('Nessuna sessione di mercato attiva')).toBeInTheDocument()
    })
  })

  it('shows back to league button and navigates when clicked', async () => {
    const user = userEvent.setup()
    render(<PrizePhasePage leagueId={defaultLeagueId} onNavigate={mockOnNavigate} />)
    await waitFor(() => {
      expect(screen.getByText('Torna alla Lega')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Torna alla Lega'))
    expect(mockOnNavigate).toHaveBeenCalledWith('leagueDetail', { leagueId: defaultLeagueId })
  })

  it('shows empty prize history message when no history', async () => {
    mockGetSessions.mockResolvedValue({
      success: true,
      data: [],
    })
    render(<PrizePhasePage leagueId={defaultLeagueId} onNavigate={mockOnNavigate} />)
    await waitFor(() => {
      expect(screen.getByText('Nessuno storico premi disponibile')).toBeInTheDocument()
    })
  })

  it('renders prize history with session details', async () => {
    mockGetSessions.mockResolvedValue({
      success: true,
      data: [],
    })
    mockGetHistory.mockResolvedValue({
      success: true,
      data: { history: [sampleHistorySession] },
    })
    render(<PrizePhasePage leagueId={defaultLeagueId} onNavigate={mockOnNavigate} />)
    await waitFor(() => {
      expect(screen.getByText(/Primo Mercato - Stagione 1/)).toBeInTheDocument()
    })
  })

  it('expands prize history entry when clicked', async () => {
    const user = userEvent.setup()
    mockGetSessions.mockResolvedValue({ success: true, data: [] })
    mockGetHistory.mockResolvedValue({
      success: true,
      data: { history: [sampleHistorySession] },
    })
    render(<PrizePhasePage leagueId={defaultLeagueId} onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText(/Primo Mercato - Stagione 1/)).toBeInTheDocument()
    })

    // Click to expand
    const sessionButton = screen.getByText(/Primo Mercato - Stagione 1/).closest('button')
    expect(sessionButton).toBeTruthy()
    await user.click(sessionButton!)

    // Should now show member details (names may appear in categories legend + table header)
    await waitFor(() => {
      expect(screen.getByText('FC Test')).toBeInTheDocument()
    })
    expect(screen.getByText('FC Other')).toBeInTheDocument()
    expect(screen.getAllByText('Miglior Difesa').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Capocannoniere').length).toBeGreaterThan(0)
  })

  it('collapses expanded history entry when clicked again', async () => {
    const user = userEvent.setup()
    mockGetSessions.mockResolvedValue({ success: true, data: [] })
    mockGetHistory.mockResolvedValue({
      success: true,
      data: { history: [sampleHistorySession] },
    })
    render(<PrizePhasePage leagueId={defaultLeagueId} onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText(/Primo Mercato - Stagione 1/)).toBeInTheDocument()
    })

    const sessionButton = screen.getByText(/Primo Mercato - Stagione 1/).closest('button')

    // Expand
    await user.click(sessionButton!)
    await waitFor(() => {
      expect(screen.getByText('FC Test')).toBeInTheDocument()
    })

    // Collapse
    await user.click(sessionButton!)
    await waitFor(() => {
      expect(screen.queryByText('FC Test')).not.toBeInTheDocument()
    })
  })

  it('passes isAdmin=true to PrizePhaseManager when user is admin', async () => {
    mockGetById.mockResolvedValue({
      success: true,
      data: { isAdmin: true },
    })
    render(<PrizePhasePage leagueId={defaultLeagueId} onNavigate={mockOnNavigate} />)
    await waitFor(() => {
      expect(screen.getByTestId('prize-phase-manager')).toHaveAttribute('data-admin', 'true')
    })
  })

  it('shows Storico Premi heading when active session has history', async () => {
    mockGetHistory.mockResolvedValue({
      success: true,
      data: { history: [sampleHistorySession] },
    })
    render(<PrizePhasePage leagueId={defaultLeagueId} onNavigate={mockOnNavigate} />)
    await waitFor(() => {
      expect(screen.getAllByText('Storico Premi').length).toBeGreaterThan(0)
    })
  })

  it('does not render PrizePhaseManager when no active session', async () => {
    mockGetSessions.mockResolvedValue({
      success: true,
      data: [],
    })
    render(<PrizePhasePage leagueId={defaultLeagueId} onNavigate={mockOnNavigate} />)
    await waitFor(() => {
      expect(screen.getByText('Nessuna sessione di mercato attiva')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('prize-phase-manager')).not.toBeInTheDocument()
  })
})
