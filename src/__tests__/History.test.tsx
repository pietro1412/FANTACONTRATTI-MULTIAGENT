import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { History } from '../pages/History'

// Mock the useAuth hook
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: '1', email: 'test@test.com', username: 'Test' },
    isAuthenticated: true,
    isLoading: false,
  }),
}))

// Import mocks for controlling behavior per test
const mockGetById = vi.fn()
const mockGetSessionsOverview = vi.fn()
const mockSearchPlayers = vi.fn()

// Mock the API services
vi.mock('../services/api', () => ({
  leagueApi: {
    getById: (...args: unknown[]) => mockGetById(...args),
    getPendingRequests: vi.fn().mockResolvedValue({ success: true, data: [] }),
  },
  historyApi: {
    getSessionsOverview: (...args: unknown[]) => mockGetSessionsOverview(...args),
    searchPlayers: (...args: unknown[]) => mockSearchPlayers(...args),
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
  feedbackApi: {
    getMyFeedback: vi.fn().mockResolvedValue({ success: true, data: { items: [], total: 0 } }),
    getUnreadNotifications: vi.fn().mockResolvedValue({ success: true, data: { count: 0 } }),
  },
  inviteApi: {},
}))

// Mock Toast provider
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

// Mock Navigation
vi.mock('../components/Navigation', () => ({
  Navigation: ({ currentPage }: { currentPage: string }) => (
    <nav data-testid="navigation" data-page={currentPage}>Navigation</nav>
  ),
}))

// Mock child components to simplify testing
vi.mock('../components/history/SessionView', () => ({
  SessionView: ({ sessions }: { sessions: unknown[] }) => (
    <div data-testid="session-view">Session View ({sessions.length} sessions)</div>
  ),
}))

vi.mock('../components/history/TimelineView', () => ({
  TimelineView: ({ sessions }: { sessions: unknown[] }) => (
    <div data-testid="timeline-view">Timeline View ({sessions.length} sessions)</div>
  ),
}))

vi.mock('../components/history/PlayerCareerPanel', () => ({
  PlayerCareerPanel: ({ playerName, onClose }: { playerName: string; onClose: () => void }) => (
    <div data-testid="player-career-panel">
      Player Career: {playerName}
      <button onClick={onClose}>Close Career</button>
    </div>
  ),
}))

describe('History Page', () => {
  const defaultProps = {
    leagueId: 'league-123',
    onNavigate: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading state initially', () => {
    // Make API calls hang to keep loading state visible
    mockGetById.mockReturnValue(new Promise(() => {}))
    mockGetSessionsOverview.mockReturnValue(new Promise(() => {}))

    render(<History {...defaultProps} />)

    expect(screen.getByText('Caricamento storico...')).toBeInTheDocument()
  })

  it('renders session view after data loads', async () => {
    mockGetById.mockResolvedValue({
      success: true,
      data: { userMembership: { role: 'MEMBER' } },
    })
    mockGetSessionsOverview.mockResolvedValue({
      success: true,
      data: {
        sessions: [
          {
            id: 's1',
            type: 'PRIMO_MERCATO',
            season: 2025,
            semester: 'FIRST',
            status: 'COMPLETED',
            currentPhase: null,
            createdAt: '2025-01-01',
            startsAt: null,
            endsAt: null,
            counts: { auctions: 5, movements: 10, trades: 2, prizes: 3 },
            prizesFinalized: true,
            prizesFinalizedAt: null,
          },
        ],
      },
    })

    render(<History {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByTestId('session-view')).toBeInTheDocument()
    })

    // View toggle buttons should be present
    expect(screen.getByText('Per Sessione')).toBeInTheDocument()
    expect(screen.getByText('Timeline')).toBeInTheDocument()
  })

  it('shows empty state when no sessions exist', async () => {
    mockGetById.mockResolvedValue({
      success: true,
      data: { userMembership: { role: 'MEMBER' } },
    })
    mockGetSessionsOverview.mockResolvedValue({
      success: true,
      data: { sessions: [] },
    })

    render(<History {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('Nessuno storico disponibile')).toBeInTheDocument()
    })
    expect(
      screen.getByText('Le sessioni di mercato completate appariranno qui')
    ).toBeInTheDocument()
  })

  it('shows error message and retry button on API failure', async () => {
    mockGetById.mockResolvedValue({
      success: true,
      data: { userMembership: { role: 'MEMBER' } },
    })
    mockGetSessionsOverview.mockResolvedValue({
      success: false,
      message: 'Errore nel caricamento',
    })

    render(<History {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('Errore nel caricamento')).toBeInTheDocument()
    })
    expect(screen.getByText('Riprova')).toBeInTheDocument()
  })

  it('shows error on network exception', async () => {
    mockGetById.mockRejectedValue(new Error('Network error'))
    mockGetSessionsOverview.mockRejectedValue(new Error('Network error'))

    render(<History {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('Errore di connessione')).toBeInTheDocument()
    })
  })

  it('renders the back to league button', async () => {
    mockGetById.mockResolvedValue({
      success: true,
      data: { userMembership: { role: 'MEMBER' } },
    })
    mockGetSessionsOverview.mockResolvedValue({
      success: true,
      data: { sessions: [] },
    })

    render(<History {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('Torna alla Lega')).toBeInTheDocument()
    })
  })

  // ---------------------------------------------------------------------------
  // View mode toggle
  // ---------------------------------------------------------------------------

  it('switches to timeline view when Timeline button is clicked', async () => {
    const user = userEvent.setup()
    mockGetById.mockResolvedValue({
      success: true,
      data: { userMembership: { role: 'MEMBER' } },
    })
    mockGetSessionsOverview.mockResolvedValue({
      success: true,
      data: {
        sessions: [
          {
            id: 's1',
            type: 'PRIMO_MERCATO',
            season: 2025,
            semester: 'FIRST',
            status: 'COMPLETED',
            currentPhase: null,
            createdAt: '2025-01-01',
            startsAt: null,
            endsAt: null,
            counts: { auctions: 5, movements: 10, trades: 2, prizes: 3 },
            prizesFinalized: true,
            prizesFinalizedAt: null,
          },
        ],
      },
    })

    render(<History {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByTestId('session-view')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Timeline'))

    await waitFor(() => {
      expect(screen.getByTestId('timeline-view')).toBeInTheDocument()
      expect(screen.queryByTestId('session-view')).not.toBeInTheDocument()
    })
  })

  it('switches back to session view from timeline view', async () => {
    const user = userEvent.setup()
    mockGetById.mockResolvedValue({
      success: true,
      data: { userMembership: { role: 'MEMBER' } },
    })
    mockGetSessionsOverview.mockResolvedValue({
      success: true,
      data: {
        sessions: [
          {
            id: 's1',
            type: 'PRIMO_MERCATO',
            season: 2025,
            semester: 'FIRST',
            status: 'COMPLETED',
            currentPhase: null,
            createdAt: '2025-01-01',
            startsAt: null,
            endsAt: null,
            counts: { auctions: 5, movements: 10, trades: 2, prizes: 3 },
            prizesFinalized: true,
            prizesFinalizedAt: null,
          },
        ],
      },
    })

    render(<History {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByTestId('session-view')).toBeInTheDocument()
    })

    // Switch to timeline
    await user.click(screen.getByText('Timeline'))
    await waitFor(() => {
      expect(screen.getByTestId('timeline-view')).toBeInTheDocument()
    })

    // Switch back to sessions
    await user.click(screen.getByText('Per Sessione'))
    await waitFor(() => {
      expect(screen.getByTestId('session-view')).toBeInTheDocument()
    })
  })

  // ---------------------------------------------------------------------------
  // Player search
  // ---------------------------------------------------------------------------

  it('shows player search input', async () => {
    mockGetById.mockResolvedValue({
      success: true,
      data: { userMembership: { role: 'MEMBER' } },
    })
    mockGetSessionsOverview.mockResolvedValue({
      success: true,
      data: { sessions: [] },
    })

    render(<History {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Cerca giocatore...')).toBeInTheDocument()
    })
  })

  it('searches players and shows results dropdown', async () => {
    const user = userEvent.setup()
    mockGetById.mockResolvedValue({
      success: true,
      data: { userMembership: { role: 'MEMBER' } },
    })
    mockGetSessionsOverview.mockResolvedValue({
      success: true,
      data: { sessions: [] },
    })
    mockSearchPlayers.mockResolvedValue({
      success: true,
      data: {
        players: [
          { id: 'p1', name: 'Lautaro Martinez', position: 'A', team: 'Inter', currentOwner: { username: 'Test', teamName: 'FC Test' }, isActive: true },
          { id: 'p2', name: 'Barella Nicolo', position: 'C', team: 'Inter', currentOwner: null, isActive: true },
        ],
      },
    })

    render(<History {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Cerca giocatore...')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText('Cerca giocatore...')
    await user.click(searchInput)
    await user.type(searchInput, 'Lau')

    // Wait for debounced search
    await waitFor(() => {
      expect(mockSearchPlayers).toHaveBeenCalled()
    }, { timeout: 2000 })

    await waitFor(() => {
      expect(screen.getByText('Lautaro Martinez')).toBeInTheDocument()
    })
  })

  it('selects a player from search results and shows career panel', async () => {
    const user = userEvent.setup()
    mockGetById.mockResolvedValue({
      success: true,
      data: { userMembership: { role: 'MEMBER' } },
    })
    mockGetSessionsOverview.mockResolvedValue({
      success: true,
      data: {
        sessions: [
          {
            id: 's1',
            type: 'PRIMO_MERCATO',
            season: 2025,
            semester: 'FIRST',
            status: 'COMPLETED',
            currentPhase: null,
            createdAt: '2025-01-01',
            startsAt: null,
            endsAt: null,
            counts: { auctions: 5, movements: 10, trades: 2, prizes: 3 },
            prizesFinalized: true,
            prizesFinalizedAt: null,
          },
        ],
      },
    })
    mockSearchPlayers.mockResolvedValue({
      success: true,
      data: {
        players: [
          { id: 'p1', name: 'Lautaro Martinez', position: 'A', team: 'Inter', currentOwner: { username: 'Test', teamName: 'FC Test' }, isActive: true },
        ],
      },
    })

    render(<History {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Cerca giocatore...')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText('Cerca giocatore...')
    await user.click(searchInput)
    await user.type(searchInput, 'Lau')

    await waitFor(() => {
      expect(screen.getByText('Lautaro Martinez')).toBeInTheDocument()
    }, { timeout: 2000 })

    // Click on the player result
    await user.click(screen.getByText('Lautaro Martinez'))

    // Player career panel should be shown
    await waitFor(() => {
      expect(screen.getByTestId('player-career-panel')).toBeInTheDocument()
      expect(screen.getByText('Player Career: Lautaro Martinez')).toBeInTheDocument()
    })

    // Session view should be hidden when a player is selected
    expect(screen.queryByTestId('session-view')).not.toBeInTheDocument()
  })

  it('closes player career panel and returns to session view', async () => {
    const user = userEvent.setup()
    mockGetById.mockResolvedValue({
      success: true,
      data: { userMembership: { role: 'MEMBER' } },
    })
    mockGetSessionsOverview.mockResolvedValue({
      success: true,
      data: {
        sessions: [
          {
            id: 's1',
            type: 'PRIMO_MERCATO',
            season: 2025,
            semester: 'FIRST',
            status: 'COMPLETED',
            currentPhase: null,
            createdAt: '2025-01-01',
            startsAt: null,
            endsAt: null,
            counts: { auctions: 5, movements: 10, trades: 2, prizes: 3 },
            prizesFinalized: true,
            prizesFinalizedAt: null,
          },
        ],
      },
    })
    mockSearchPlayers.mockResolvedValue({
      success: true,
      data: {
        players: [
          { id: 'p1', name: 'Lautaro Martinez', position: 'A', team: 'Inter', currentOwner: null, isActive: true },
        ],
      },
    })

    render(<History {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Cerca giocatore...')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText('Cerca giocatore...')
    await user.click(searchInput)
    await user.type(searchInput, 'Lau')

    await waitFor(() => {
      expect(screen.getByText('Lautaro Martinez')).toBeInTheDocument()
    }, { timeout: 2000 })

    await user.click(screen.getByText('Lautaro Martinez'))

    await waitFor(() => {
      expect(screen.getByTestId('player-career-panel')).toBeInTheDocument()
    })

    // Close the career panel
    await user.click(screen.getByText('Close Career'))

    await waitFor(() => {
      expect(screen.queryByTestId('player-career-panel')).not.toBeInTheDocument()
      expect(screen.getByTestId('session-view')).toBeInTheDocument()
    })
  })

  // ---------------------------------------------------------------------------
  // Player filter display
  // ---------------------------------------------------------------------------

  it('shows filter badge with player name when player is selected', async () => {
    const user = userEvent.setup()
    mockGetById.mockResolvedValue({
      success: true,
      data: { userMembership: { role: 'MEMBER' } },
    })
    mockGetSessionsOverview.mockResolvedValue({
      success: true,
      data: { sessions: [] },
    })
    mockSearchPlayers.mockResolvedValue({
      success: true,
      data: {
        players: [
          { id: 'p1', name: 'Barella Nicolo', position: 'C', team: 'Inter', currentOwner: null, isActive: true },
        ],
      },
    })

    render(<History {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Cerca giocatore...')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText('Cerca giocatore...')
    await user.click(searchInput)
    await user.type(searchInput, 'Bar')

    await waitFor(() => {
      expect(screen.getByText('Barella Nicolo')).toBeInTheDocument()
    }, { timeout: 2000 })

    await user.click(screen.getByText('Barella Nicolo'))

    await waitFor(() => {
      // Filter badge should show
      expect(screen.getByText('Filtro:')).toBeInTheDocument()
      expect(screen.getByText('Barella Nicolo')).toBeInTheDocument()
      expect(screen.getByText('C')).toBeInTheDocument() // Position badge
    })
  })

  it('removes player filter when x button is clicked', async () => {
    const user = userEvent.setup()
    mockGetById.mockResolvedValue({
      success: true,
      data: { userMembership: { role: 'MEMBER' } },
    })
    mockGetSessionsOverview.mockResolvedValue({
      success: true,
      data: { sessions: [] },
    })
    mockSearchPlayers.mockResolvedValue({
      success: true,
      data: {
        players: [
          { id: 'p1', name: 'Barella Nicolo', position: 'C', team: 'Inter', currentOwner: null, isActive: true },
        ],
      },
    })

    render(<History {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Cerca giocatore...')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText('Cerca giocatore...')
    await user.click(searchInput)
    await user.type(searchInput, 'Bar')

    await waitFor(() => {
      expect(screen.getByText('Barella Nicolo')).toBeInTheDocument()
    }, { timeout: 2000 })

    await user.click(screen.getByText('Barella Nicolo'))

    await waitFor(() => {
      expect(screen.getByText('Filtro:')).toBeInTheDocument()
    })

    // Click the "x" button to remove filter
    await user.click(screen.getByText('x'))

    await waitFor(() => {
      expect(screen.queryByText('Filtro:')).not.toBeInTheDocument()
      expect(screen.getByPlaceholderText('Cerca giocatore...')).toBeInTheDocument()
    })
  })

  // ---------------------------------------------------------------------------
  // Retry on error
  // ---------------------------------------------------------------------------

  it('retries loading when Riprova button is clicked', async () => {
    const user = userEvent.setup()
    mockGetById
      .mockResolvedValueOnce({
        success: true,
        data: { userMembership: { role: 'MEMBER' } },
      })
      .mockResolvedValue({
        success: true,
        data: { userMembership: { role: 'MEMBER' } },
      })
    mockGetSessionsOverview
      .mockResolvedValueOnce({ success: false, message: 'Errore nel caricamento' })
      .mockResolvedValue({
        success: true,
        data: { sessions: [] },
      })

    render(<History {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('Errore nel caricamento')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Riprova'))

    await waitFor(() => {
      expect(mockGetSessionsOverview).toHaveBeenCalledTimes(2)
    })
  })

  // ---------------------------------------------------------------------------
  // Navigation & back button
  // ---------------------------------------------------------------------------

  it('navigates back to league when Torna alla Lega is clicked', async () => {
    const user = userEvent.setup()
    mockGetById.mockResolvedValue({
      success: true,
      data: { userMembership: { role: 'MEMBER' } },
    })
    mockGetSessionsOverview.mockResolvedValue({
      success: true,
      data: { sessions: [] },
    })

    render(<History {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('Torna alla Lega')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Torna alla Lega'))

    expect(defaultProps.onNavigate).toHaveBeenCalledWith('leagueDetail', { leagueId: 'league-123' })
  })

  // ---------------------------------------------------------------------------
  // Admin role detection
  // ---------------------------------------------------------------------------

  it('detects admin role from league data', async () => {
    mockGetById.mockResolvedValue({
      success: true,
      data: { userMembership: { role: 'ADMIN' } },
    })
    mockGetSessionsOverview.mockResolvedValue({
      success: true,
      data: { sessions: [] },
    })

    render(<History {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByTestId('navigation')).toBeInTheDocument()
    })
  })

  // ---------------------------------------------------------------------------
  // Multiple sessions
  // ---------------------------------------------------------------------------

  it('renders with multiple sessions passed to SessionView', async () => {
    mockGetById.mockResolvedValue({
      success: true,
      data: { userMembership: { role: 'MEMBER' } },
    })
    mockGetSessionsOverview.mockResolvedValue({
      success: true,
      data: {
        sessions: [
          {
            id: 's1',
            type: 'PRIMO_MERCATO',
            season: 2025,
            semester: 'FIRST',
            status: 'COMPLETED',
            currentPhase: null,
            createdAt: '2025-01-01',
            startsAt: null,
            endsAt: null,
            counts: { auctions: 5, movements: 10, trades: 2, prizes: 3 },
            prizesFinalized: true,
            prizesFinalizedAt: null,
          },
          {
            id: 's2',
            type: 'MERCATO_RICORRENTE',
            season: 2025,
            semester: 'SECOND',
            status: 'COMPLETED',
            currentPhase: null,
            createdAt: '2025-06-01',
            startsAt: null,
            endsAt: null,
            counts: { auctions: 3, movements: 8, trades: 1, prizes: 2 },
            prizesFinalized: false,
            prizesFinalizedAt: null,
          },
        ],
      },
    })

    render(<History {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('Session View (2 sessions)')).toBeInTheDocument()
    })
  })

  it('does not show player search results when query is too short', async () => {
    const user = userEvent.setup()
    mockGetById.mockResolvedValue({
      success: true,
      data: { userMembership: { role: 'MEMBER' } },
    })
    mockGetSessionsOverview.mockResolvedValue({
      success: true,
      data: { sessions: [] },
    })

    render(<History {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Cerca giocatore...')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText('Cerca giocatore...')
    await user.click(searchInput)
    await user.type(searchInput, 'L')

    // Short query (1 char) should not trigger search
    // Wait for debounce to fire, wrapped in act
    await act(async () => {
      await new Promise(r => setTimeout(r, 400))
    })
    expect(mockSearchPlayers).not.toHaveBeenCalled()
  })

  it('renders Navigation with history as currentPage', async () => {
    mockGetById.mockResolvedValue({
      success: true,
      data: { userMembership: { role: 'MEMBER' } },
    })
    mockGetSessionsOverview.mockResolvedValue({
      success: true,
      data: { sessions: [] },
    })

    render(<History {...defaultProps} />)

    await waitFor(() => {
      const nav = screen.getByTestId('navigation')
      expect(nav).toHaveAttribute('data-page', 'history')
    })
  })
})
