import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'u1', email: 'test@test.com', username: 'TestUser' },
    isAuthenticated: true,
    isLoading: false,
  }),
}))

vi.mock('../components/ui/Toast', () => ({
  useToast: () => ({
    toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
  }),
}))

const mockRosterData = {
  member: {
    id: 'm1',
    currentBudget: 200,
    user: { username: 'TestUser' },
    league: {
      goalkeeperSlots: 3,
      defenderSlots: 8,
      midfielderSlots: 8,
      forwardSlots: 6,
    },
  },
  roster: {
    P: [
      {
        id: 'r1',
        acquisitionPrice: 5,
        player: { id: 'p1', name: 'Keeper One', team: 'Inter', position: 'P', quotation: 10, apiFootballId: null, apiFootballStats: null },
        contract: { salary: 2, duration: 3, rescissionClause: 8 },
      },
    ],
    D: [
      {
        id: 'r2',
        acquisitionPrice: 10,
        player: { id: 'p2', name: 'Defender One', team: 'Juventus', position: 'D', quotation: 15, apiFootballId: null, apiFootballStats: null },
        contract: { salary: 4, duration: 2, rescissionClause: null },
      },
    ],
    C: [],
    A: [
      {
        id: 'r3',
        acquisitionPrice: 20,
        player: { id: 'p3', name: 'Striker One', team: 'Milan', position: 'A', quotation: 30, apiFootballId: null, apiFootballStats: null },
        contract: { salary: 8, duration: 1, rescissionClause: 15 },
      },
    ],
  },
  totals: { P: 1, D: 1, C: 0, A: 1, total: 3 },
  slots: { P: 3, D: 8, C: 8, A: 6 },
}

const mockGetRoster = vi.fn()
const mockGetById = vi.fn()
const mockGetSessions = vi.fn()

vi.mock('../services/api', () => ({
  auctionApi: {
    getRoster: (...args: unknown[]) => mockGetRoster(...args),
    getSessions: (...args: unknown[]) => mockGetSessions(...args),
  },
  leagueApi: {
    getById: (...args: unknown[]) => mockGetById(...args),
    getPendingRequests: vi.fn().mockResolvedValue({ success: true, data: [] }),
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
}))

vi.mock('../components/Navigation', () => ({
  Navigation: () => <nav data-testid="navigation">Nav</nav>,
}))

vi.mock('../components/ui/Button', () => ({
  Button: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
}))

vi.mock('../components/PlayerStatsModal', () => ({
  PlayerStatsModal: () => null,
}))

vi.mock('../utils/teamLogos', () => ({
  getTeamLogo: (team: string) => `https://logo.test/${team}.png`,
}))

vi.mock('../utils/player-images', () => ({
  getPlayerPhotoUrl: () => null,
}))

vi.mock('../components/ui/PositionBadge', () => ({
  POSITION_GRADIENTS: { P: 'from-amber-500', D: 'from-blue-500', C: 'from-emerald-500', A: 'from-red-500' },
}))

// ---------------------------------------------------------------------------
import { Roster } from '../pages/Roster'

describe('Roster Page', () => {
  const mockOnNavigate = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders loading spinner while data is being fetched', () => {
    mockGetRoster.mockReturnValue(new Promise(() => {}))
    mockGetById.mockReturnValue(new Promise(() => {}))
    mockGetSessions.mockReturnValue(new Promise(() => {}))

    render(<Roster leagueId="league-1" onNavigate={mockOnNavigate} />)

    expect(screen.getByText('Caricamento rosa...')).toBeInTheDocument()
  })

  it('renders error state when roster API fails', async () => {
    mockGetRoster.mockRejectedValue(new Error('Network error'))
    mockGetById.mockResolvedValue({ success: true, data: { isAdmin: false } })
    mockGetSessions.mockResolvedValue({ success: true, data: [] })

    render(<Roster leagueId="league-1" onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Errore nel caricamento della rosa')).toBeInTheDocument()
    })

    // Retry button should be present
    expect(screen.getByText('Riprova')).toBeInTheDocument()
  })

  it('renders the page header and player cards after successful load', async () => {
    mockGetRoster.mockResolvedValue({ success: true, data: mockRosterData })
    mockGetById.mockResolvedValue({ success: true, data: { isAdmin: false } })
    mockGetSessions.mockResolvedValue({ success: true, data: [] })

    render(<Roster leagueId="league-1" onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('La Mia Rosa')).toBeInTheDocument()
    })

    // Player names should render
    expect(screen.getByText('Keeper One')).toBeInTheDocument()
    expect(screen.getByText('Defender One')).toBeInTheDocument()
    expect(screen.getByText('Striker One')).toBeInTheDocument()
  })

  it('displays correct budget and totals', async () => {
    mockGetRoster.mockResolvedValue({ success: true, data: mockRosterData })
    mockGetById.mockResolvedValue({ success: true, data: { isAdmin: false } })
    mockGetSessions.mockResolvedValue({ success: true, data: [] })

    render(<Roster leagueId="league-1" onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      // Budget value
      expect(screen.getByText('200')).toBeInTheDocument()
    })

    // Total salary (2+4+8=14) should be displayed
    expect(screen.getByText('14')).toBeInTheDocument()

    // Total roster value (5+10+20=35) should be displayed
    expect(screen.getByText('35')).toBeInTheDocument()
  })

  it('displays the username in the header', async () => {
    mockGetRoster.mockResolvedValue({ success: true, data: mockRosterData })
    mockGetById.mockResolvedValue({ success: true, data: { isAdmin: false } })
    mockGetSessions.mockResolvedValue({ success: true, data: [] })

    render(<Roster leagueId="league-1" onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('TestUser')).toBeInTheDocument()
    })
  })

  it('shows "Vedi tutte le rose" navigation button', async () => {
    mockGetRoster.mockResolvedValue({ success: true, data: mockRosterData })
    mockGetById.mockResolvedValue({ success: true, data: { isAdmin: false } })
    mockGetSessions.mockResolvedValue({ success: true, data: [] })

    render(<Roster leagueId="league-1" onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText(/Vedi tutte le rose/)).toBeInTheDocument()
    })
  })
})
