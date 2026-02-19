import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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

// Mock child components to simplify testing
vi.mock('../components/history/SessionView', () => ({
  SessionView: () => <div data-testid="session-view">Session View</div>,
}))

vi.mock('../components/history/TimelineView', () => ({
  TimelineView: () => <div data-testid="timeline-view">Timeline View</div>,
}))

vi.mock('../components/history/PlayerCareerPanel', () => ({
  PlayerCareerPanel: () => <div data-testid="player-career-panel">Player Career Panel</div>,
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
})
