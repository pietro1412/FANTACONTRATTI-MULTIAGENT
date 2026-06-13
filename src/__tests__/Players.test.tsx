import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'u1', email: 'test@test.com', username: 'TestUser' },
    isAuthenticated: true,
    isLoading: false,
    logout: vi.fn(),
  }),
}))

vi.mock('../components/ui/Toast', () => ({
  useToast: () => ({
    toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
  }),
}))

vi.mock('../components/Navigation', () => ({
  Navigation: ({ currentPage }: { currentPage: string }) => (
    <nav data-testid="navigation" data-page={currentPage}>Nav</nav>
  ),
}))

vi.mock('../components/cockpit/CockpitShell', () => ({
  CockpitShell: ({ header, adminBar, children }: { header: React.ReactNode; adminBar?: React.ReactNode; children: React.ReactNode }) => (
    <div>
      <div>{header}</div>
      <div>{adminBar}</div>
      <div>{children}</div>
    </div>
  ),
}))

vi.mock('../components/PlayerStatsModal', () => ({
  PlayerStatsModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="player-stats-modal">Modal</div> : null,
}))

vi.mock('../components/ui/BottomSheet', () => ({
  BottomSheet: ({ children, isOpen }: { children: React.ReactNode; isOpen: boolean }) =>
    isOpen ? <div data-testid="bottom-sheet">{children}</div> : null,
}))

vi.mock('../components/ui/EmptyState', () => ({
  EmptyState: ({ title }: { title: string }) => <div data-testid="empty-state">{title}</div>,
}))

vi.mock('../components/ui/Skeleton', () => ({
  SkeletonPlayerRow: () => <div data-testid="skeleton-row" />,
}))

vi.mock('../components/ui/LandscapeHint', () => ({
  LandscapeHint: () => <div data-testid="landscape-hint" />,
}))

vi.mock('../components/ui/RadarChart', () => ({
  default: () => <div data-testid="radar-chart" />,
}))

vi.mock('../components/ui/TeamLogo', () => ({
  TeamLogo: () => <span data-testid="team-logo" />,
}))

vi.mock('../components/ui/Monogram', () => ({
  Monogram: ({ name }: { name: string }) => <span data-testid="monogram">{name}</span>,
}))

vi.mock('../components/players/PlayerPhoto', () => ({
  PlayerPhoto: () => <span data-testid="player-photo" />,
}))

vi.mock('../components/ui/PositionBadge', () => ({
  POSITION_GRADIENTS: { P: 'from-amber-500', D: 'from-blue-500', C: 'from-emerald-500', A: 'from-red-500' },
  POSITION_FILTER_COLORS: { P: 'bg-amber-500/20', D: 'bg-blue-500/20', C: 'bg-emerald-500/20', A: 'bg-red-500/20' },
}))

vi.mock('../utils/player-images', () => ({
  getPlayerPhotoUrl: () => null,
}))

vi.mock('lucide-react', () => ({
  SlidersHorizontal: () => <span>SlidersHorizontal</span>,
  List: () => <span>List</span>,
  BarChart3: () => <span>BarChart3</span>,
}))

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: () => count * 56,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({ index: i, start: i * 56, size: 56, key: i })),
  }),
}))

// API mocks
const mockGetAllRosters = vi.fn()
const mockGetAllPlayers = vi.fn()
const mockGetStats = vi.fn()
const mockGetTeams = vi.fn()

vi.mock('../services/api', () => ({
  playerApi: {
    getAll: (...args: unknown[]) => mockGetAllPlayers(...args),
    getStats: (...args: unknown[]) => mockGetStats(...args),
    getTeams: (...args: unknown[]) => mockGetTeams(...args),
  },
  leagueApi: {
    getAllRosters: (...args: unknown[]) => mockGetAllRosters(...args),
  },
}))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const listPlayers = [
  { id: 'p1', name: 'Player Alpha', team: 'Juventus', position: 'A', quotation: 30, listStatus: 'LISTED', age: 24, apiFootballId: null, apiFootballStats: null, statsSyncedAt: null },
  { id: 'p2', name: 'Player Beta', team: 'Milan', position: 'C', quotation: 20, listStatus: 'LISTED', age: 28, apiFootballId: null, apiFootballStats: null, statsSyncedAt: null },
]

const leagueRosters = {
  id: 'league-1',
  name: 'Test League',
  isAdmin: false,
  members: [
    {
      id: 'm1',
      user: { username: 'TestUser' },
      teamName: 'FC Test',
      roster: [{ playerId: 'p1', acquisitionPrice: 15, contract: { salary: 5, duration: 2, rescissionClause: null } }],
    },
  ],
}

const statsPlayers = [
  {
    id: 'p1', name: 'Lautaro Martinez', team: 'Inter', position: 'A', quotation: 42, apiFootballId: 123, statsSyncedAt: '2025-06-01T10:00:00Z',
    stats: { appearances: 30, minutes: 2500, rating: 7.2, goals: 20, assists: 5, yellowCards: 3, redCards: 0, passesTotal: 800, passesKey: 40, passAccuracy: 85, shotsTotal: 80, shotsOn: 45, tacklesTotal: 10, interceptions: 5, dribblesAttempts: 50, dribblesSuccess: 30, penaltyScored: 3, penaltyMissed: 1 },
  },
  {
    id: 'p2', name: 'Barella Nicolo', team: 'Inter', position: 'C', quotation: 30, apiFootballId: 456, statsSyncedAt: '2025-06-01T10:00:00Z',
    stats: { appearances: 28, minutes: 2200, rating: 7.0, goals: 5, assists: 10, yellowCards: 6, redCards: 1, passesTotal: 1500, passesKey: 60, passAccuracy: 90, shotsTotal: 40, shotsOn: 20, tacklesTotal: 40, interceptions: 20, dribblesAttempts: 30, dribblesSuccess: 20, penaltyScored: 0, penaltyMissed: 0 },
  },
]

// ---------------------------------------------------------------------------
import { Players } from '../pages/Players'

describe('Players Page', () => {
  const mockOnNavigate = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {})

    mockGetAllRosters.mockResolvedValue({ success: true, data: leagueRosters })
    mockGetAllPlayers.mockResolvedValue({ success: true, data: listPlayers })
    mockGetStats.mockResolvedValue({
      success: true,
      data: { players: statsPlayers, pagination: { page: 1, limit: 50, total: 2, totalPages: 1 } },
    })
    mockGetTeams.mockResolvedValue({ success: true, data: [{ name: 'Inter' }, { name: 'Milan' }] })
  })

  // ===== List view =====

  it('renders list view with player names and league name', async () => {
    render(<Players leagueId="league-1" onNavigate={mockOnNavigate} initialView="list" />)
    await waitFor(() => {
      expect(screen.getByText('Player Alpha')).toBeInTheDocument()
    })
    expect(screen.getByText('Player Beta')).toBeInTheDocument()
    expect(screen.getByText(/Test League/)).toBeInTheDocument()
  })

  it('shows roster owner for rostered players and LIBERO for free players', async () => {
    render(<Players leagueId="league-1" onNavigate={mockOnNavigate} initialView="list" />)
    await waitFor(() => {
      expect(screen.getByText('Player Alpha')).toBeInTheDocument()
    })
    // Player Alpha is in FC Test roster (shown as the manager monogram + label)
    expect(screen.getAllByText('FC Test').length).toBeGreaterThan(0)
    expect(screen.getByTestId('monogram')).toHaveTextContent('FC Test')
    // Player Beta is free
    expect(screen.getByText('LIBERO')).toBeInTheDocument()
  })

  it('renders Navigation with allPlayers page for list view', async () => {
    render(<Players leagueId="league-1" onNavigate={mockOnNavigate} initialView="list" />)
    await waitFor(() => {
      expect(screen.getByTestId('navigation')).toHaveAttribute('data-page', 'allPlayers')
    })
  })

  it('renders empty state when no players match in list view', async () => {
    mockGetAllPlayers.mockResolvedValue({ success: true, data: [] })
    mockGetAllRosters.mockResolvedValue({ success: true, data: { ...leagueRosters, members: [] } })
    render(<Players leagueId="league-1" onNavigate={mockOnNavigate} initialView="list" />)
    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument()
    })
  })

  // ===== Stats view =====

  it('renders stats view with player names in the table', async () => {
    render(<Players leagueId="league-1" onNavigate={mockOnNavigate} initialView="stats" />)
    await waitFor(() => {
      expect(screen.getByText('Lautaro Martinez')).toBeInTheDocument()
    })
    expect(screen.getByText('Barella Nicolo')).toBeInTheDocument()
  })

  it('renders Navigation with playerStats page for stats view', async () => {
    render(<Players leagueId="league-1" onNavigate={mockOnNavigate} initialView="stats" />)
    await waitFor(() => {
      expect(screen.getByTestId('navigation')).toHaveAttribute('data-page', 'playerStats')
    })
  })

  it('shows error banner when stats API fails', async () => {
    mockGetStats.mockRejectedValue(new Error('Network error'))
    render(<Players leagueId="league-1" onNavigate={mockOnNavigate} initialView="stats" />)
    await waitFor(() => {
      expect(screen.getByText('Errore nel caricamento delle statistiche. Riprova.')).toBeInTheDocument()
    })
  })

  it('renders preset buttons in stats view', async () => {
    render(<Players leagueId="league-1" onNavigate={mockOnNavigate} initialView="stats" />)
    await waitFor(() => {
      expect(screen.getByText('Lautaro Martinez')).toBeInTheDocument()
    })
    expect(screen.getAllByText('Essenziali').length).toBeGreaterThan(0)
  })

  it('shows empty state when stats API returns no players', async () => {
    mockGetStats.mockResolvedValue({
      success: true,
      data: { players: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } },
    })
    render(<Players leagueId="league-1" onNavigate={mockOnNavigate} initialView="stats" />)
    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument()
    })
  })

  it('selects players for comparison and shows Confronta action', async () => {
    const user = userEvent.setup()
    const { container } = render(<Players leagueId="league-1" onNavigate={mockOnNavigate} initialView="stats" />)
    await waitFor(() => {
      expect(screen.getByText('Lautaro Martinez')).toBeInTheDocument()
    })
    const checkboxes = container.querySelectorAll('tbody input[type="checkbox"]')
    expect(checkboxes.length).toBe(2)
    await user.click(checkboxes[0]!)
    await waitFor(() => {
      expect(screen.getByText(/Confronta \(1\)/)).toBeInTheDocument()
    })
  })

  it('sorts stats table by name when player header is clicked (backend re-query)', async () => {
    const user = userEvent.setup()
    render(<Players leagueId="league-1" onNavigate={mockOnNavigate} initialView="stats" />)
    await waitFor(() => {
      expect(screen.getByText('Lautaro Martinez')).toBeInTheDocument()
    })
    await user.click(screen.getByText(/Giocatore/))
    await waitFor(() => {
      expect(mockGetStats.mock.calls.length).toBeGreaterThanOrEqual(2)
    })
  })

  // ===== View toggle =====

  it('switches from list to stats view via the toggle', async () => {
    const user = userEvent.setup()
    render(<Players leagueId="league-1" onNavigate={mockOnNavigate} initialView="list" />)
    await waitFor(() => {
      expect(screen.getByText('Player Alpha')).toBeInTheDocument()
    })
    // Click the "Statistiche" segment (first occurrence is in the toggle)
    const statsButtons = screen.getAllByText('Statistiche')
    await user.click(statsButtons[0]!)
    await waitFor(() => {
      expect(screen.getByText('Lautaro Martinez')).toBeInTheDocument()
    })
  })
})
