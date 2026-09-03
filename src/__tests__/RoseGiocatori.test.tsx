import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ---------------------------------------------------------------------------
// Mocks — must come before component imports
// ---------------------------------------------------------------------------

vi.mock('react-router-dom', () => ({
  useParams: () => ({ leagueId: 'league-1' }),
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
}))

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

vi.mock('../components/Navigation', () => ({
  Navigation: ({ currentPage }: { currentPage: string }) => (
    <nav data-testid="navigation" data-page={currentPage}>Nav</nav>
  ),
}))

vi.mock('../components/PlayerStatsModal', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../components/PlayerStatsModal')>()
  return {
    ...actual,
    PlayerStatsModal: ({ isOpen }: { isOpen: boolean }) =>
      isOpen ? <div data-testid="player-stats-modal">Modal</div> : null,
  }
})

vi.mock('../components/ShareButton', () => ({
  ShareButton: () => <button data-testid="share-button">Share</button>,
}))

vi.mock('../components/ui/Skeleton', () => ({
  SkeletonPlayerRow: () => <div data-testid="skeleton-row" />,
}))

vi.mock('../components/ui/BottomSheet', () => ({
  BottomSheet: ({ children, isOpen }: { children: React.ReactNode; isOpen: boolean }) =>
    isOpen ? <div data-testid="bottom-sheet">{children}</div> : null,
}))

vi.mock('../components/ui/EmptyState', () => ({
  EmptyState: ({ title }: { title: string }) => <div data-testid="empty-state">{title}</div>,
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

vi.mock('../utils/teamLogos', () => ({
  getTeamLogo: (team: string) => `https://logo.test/${team}.png`,
}))

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: () => count * 56,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({ index: i, start: i * 56, size: 56, key: i })),
  }),
}))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// Shared leagueApi.getAllRosters fixture — realistic superset consumed both by
// the Rose tab (currentUserId/role/currentBudget) and by "Tutti i giocatori"
// (roster status lookup by playerId).
const combinedLeagueData = {
  id: 'league-1',
  name: 'Test League',
  currentUserId: 'u1',
  isAdmin: false,
  inContrattiPhase: false,
  members: [
    {
      id: 'm1',
      userId: 'u1',
      role: 'MEMBER' as const,
      teamName: 'FC Test',
      currentBudget: 200,
      user: { username: 'TestUser' },
      roster: [
        {
          id: 'r1',
          playerId: 'p1',
          acquisitionPrice: 15,
          acquisitionType: 'AUCTION',
          player: {
            id: 'p1',
            name: 'Player Alpha',
            team: 'Juventus',
            position: 'A' as const,
            quotation: 30,
            apiFootballId: null,
            apiFootballStats: null,
            computedStats: null,
            statsSyncedAt: null,
          },
          contract: { id: 'c1', salary: 5, duration: 2, rescissionClause: null, signedAt: '2025-01-01' },
        },
      ],
    },
    {
      id: 'm2',
      userId: 'u2',
      role: 'ADMIN' as const,
      teamName: 'FC Rival',
      currentBudget: 150,
      user: { username: 'Rival' },
      roster: [],
    },
  ],
}

const listPlayers = [
  { id: 'p1', name: 'Player Alpha', team: 'Juventus', position: 'A', quotation: 30, listStatus: 'LISTED', age: 24, apiFootballId: null, apiFootballStats: null, statsSyncedAt: null },
  { id: 'p2', name: 'Player Beta', team: 'Milan', position: 'C', quotation: 20, listStatus: 'LISTED', age: 28, apiFootballId: null, apiFootballStats: null, statsSyncedAt: null },
]

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

// Mock API
const mockGetAllRosters = vi.fn()
const mockGetOngoingIndicator = vi.fn()
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
    getById: vi.fn().mockResolvedValue({ success: true, data: { id: 'league-1', name: 'Test League' } }),
    getPendingRequests: vi.fn().mockResolvedValue({ success: true, data: [] }),
  },
  tradeApi: {
    getReceived: vi.fn().mockResolvedValue({ success: true, data: [] }),
    getOngoingIndicator: (...args: unknown[]) => mockGetOngoingIndicator(...args),
  },
  superadminApi: {
    getStatus: vi.fn().mockResolvedValue({ success: true, data: { isSuperAdmin: false } }),
  },
  userApi: {
    getMyPendingInvites: vi.fn().mockResolvedValue({ success: true, data: [] }),
  },
}))

// ---------------------------------------------------------------------------
// Import the component under test AFTER all mocks
// ---------------------------------------------------------------------------
import { RoseGiocatori } from '../pages/RoseGiocatori'

describe('RoseGiocatori Page (Rose / Tutti i giocatori / Statistiche)', () => {
  const mockOnNavigate = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {})

    mockGetAllRosters.mockResolvedValue({ success: true, data: combinedLeagueData })
    mockGetOngoingIndicator.mockResolvedValue({ success: true, data: { count: 0 } })
    mockGetAllPlayers.mockResolvedValue({ success: true, data: listPlayers })
    mockGetStats.mockResolvedValue({
      success: true,
      data: { players: statsPlayers, pagination: { page: 1, limit: 50, total: 2, totalPages: 1 } },
    })
    mockGetTeams.mockResolvedValue({ success: true, data: [{ name: 'Inter' }, { name: 'Milan' }, { name: 'Juventus' }] })
  })

  // ===== "Rose" tab (default) =====

  describe('tab "Rose" (default)', () => {
    it('renders loading skeletons while data is being fetched', () => {
      mockGetAllRosters.mockReturnValue(new Promise(() => {}))
      render(<RoseGiocatori onNavigate={mockOnNavigate} />)
      const skeletons = screen.getAllByTestId('skeleton-row')
      expect(skeletons.length).toBe(5)
    })

    it('renders error state when API returns no data', async () => {
      mockGetAllRosters.mockResolvedValue({ success: false })
      render(<RoseGiocatori onNavigate={mockOnNavigate} />)
      await waitFor(() => {
        expect(screen.getByText('Errore nel caricamento delle rose')).toBeInTheDocument()
      })
    })

    it('renders the page header and player data after successful load', async () => {
      render(<RoseGiocatori onNavigate={mockOnNavigate} />)
      await waitFor(() => {
        expect(screen.getByText('Ingaggi rosa')).toBeInTheDocument()
      })
      expect(screen.getAllByText('Player Alpha').length).toBeGreaterThan(0)
    })

    it('shows the "La mia rosa" badge for the current user', async () => {
      render(<RoseGiocatori onNavigate={mockOnNavigate} />)
      await waitFor(() => {
        expect(screen.getByText('La mia rosa')).toBeInTheDocument()
      })
    })

    it('shows ongoing trades indicator for third parties', async () => {
      mockGetOngoingIndicator.mockResolvedValue({ success: true, data: { count: 2 } })
      mockGetAllRosters.mockResolvedValue({ success: true, data: { ...combinedLeagueData, currentUserId: 'u999' } })
      render(<RoseGiocatori onNavigate={mockOnNavigate} />)
      await waitFor(() => {
        expect(screen.getByText(/2 trattative/)).toBeInTheDocument()
      })
    })

    it('shows contracts phase warning when viewing another manager', async () => {
      mockGetAllRosters.mockResolvedValue({
        success: true,
        data: { ...combinedLeagueData, inContrattiPhase: true, currentUserId: 'u999' },
      })
      render(<RoseGiocatori onNavigate={mockOnNavigate} />)
      await waitFor(() => {
        expect(screen.getByText(/Fase CONTRATTI attiva/)).toBeInTheDocument()
      })
    })

    it('renders the composition ranking with the selected member highlighted', async () => {
      render(<RoseGiocatori onNavigate={mockOnNavigate} />)
      await waitFor(() => {
        expect(screen.getByText('Classifica composizione')).toBeInTheDocument()
      })
      const card = screen.getByTestId('composition-ranking')
      const myRow = within(card).getByRole('button', { name: /FC Test/ })
      expect(myRow).toHaveAttribute('aria-pressed', 'true')
      const rivalRow = within(card).getByRole('button', { name: /FC Rival/ })
      expect(rivalRow).toHaveAttribute('aria-pressed', 'false')
    })

    it('switches the viewed roster when clicking a ranking row', async () => {
      render(<RoseGiocatori onNavigate={mockOnNavigate} />)
      await waitFor(() => {
        expect(screen.getByTestId('composition-ranking')).toBeInTheDocument()
      })
      const card = screen.getByTestId('composition-ranking')
      fireEvent.click(within(card).getByRole('button', { name: /FC Rival/ }))
      await waitFor(() => {
        expect(within(card).getByRole('button', { name: /FC Rival/ })).toHaveAttribute('aria-pressed', 'true')
      })
      expect(screen.getByText('Composizione · 0 giocatori')).toBeInTheDocument()
    })
  })

  // ===== "Tutti i giocatori" tab =====

  describe('tab "Tutti i giocatori"', () => {
    it('renders player names and league name', async () => {
      render(<RoseGiocatori onNavigate={mockOnNavigate} initialView="players" />)
      await waitFor(() => {
        expect(screen.getAllByText('Player Alpha').length).toBeGreaterThan(0)
      })
      expect(screen.getAllByText('Player Beta').length).toBeGreaterThan(0)
      expect(screen.getByText(/Test League/)).toBeInTheDocument()
    })

    it('shows roster owner for rostered players and LIBERO for free players', async () => {
      render(<RoseGiocatori onNavigate={mockOnNavigate} initialView="players" />)
      await waitFor(() => {
        expect(screen.getAllByText('Player Alpha').length).toBeGreaterThan(0)
      })
      // Player Alpha is in FC Test roster (owner monogram + name)
      expect(screen.getAllByText('FC Test').length).toBeGreaterThan(0)
      // Player Beta is free
      expect(screen.getAllByText('LIBERO').length).toBeGreaterThan(0)
    })

    it('renders Navigation with the unified "rose" page for every tab', async () => {
      render(<RoseGiocatori onNavigate={mockOnNavigate} initialView="players" />)
      await waitFor(() => {
        expect(screen.getByTestId('navigation')).toHaveAttribute('data-page', 'rose')
      })
    })

    it('renders empty state when no players match', async () => {
      mockGetAllPlayers.mockResolvedValue({ success: true, data: [] })
      render(<RoseGiocatori onNavigate={mockOnNavigate} initialView="players" />)
      await waitFor(() => {
        expect(screen.getByTestId('empty-state')).toBeInTheDocument()
      })
    })
  })

  // ===== "Statistiche" tab =====

  describe('tab "Statistiche"', () => {
    it('renders stats view with player names in the table', async () => {
      render(<RoseGiocatori onNavigate={mockOnNavigate} initialView="stats" />)
      await waitFor(() => {
        expect(screen.getAllByText('Lautaro Martinez').length).toBeGreaterThan(0)
      })
      expect(screen.getAllByText('Barella Nicolo').length).toBeGreaterThan(0)
    })

    it('shows error banner when stats API fails', async () => {
      mockGetStats.mockRejectedValue(new Error('Network error'))
      render(<RoseGiocatori onNavigate={mockOnNavigate} initialView="stats" />)
      await waitFor(() => {
        expect(screen.getByText('Errore nel caricamento delle statistiche. Riprova.')).toBeInTheDocument()
      })
    })

    it('renders preset buttons in stats view', async () => {
      render(<RoseGiocatori onNavigate={mockOnNavigate} initialView="stats" />)
      await waitFor(() => {
        expect(screen.getAllByText('Lautaro Martinez').length).toBeGreaterThan(0)
      })
      expect(screen.getAllByText('Essenziali').length).toBeGreaterThan(0)
    })

    it('selects players for comparison and shows Confronta action', async () => {
      const user = userEvent.setup()
      const { container } = render(<RoseGiocatori onNavigate={mockOnNavigate} initialView="stats" />)
      await waitFor(() => {
        expect(screen.getAllByText('Lautaro Martinez').length).toBeGreaterThan(0)
      })
      const checkboxes = container.querySelectorAll('tbody input[type="checkbox"]')
      expect(checkboxes.length).toBe(2)
      await user.click(checkboxes[0]!)
      await waitFor(() => {
        expect(screen.getByText(/Confronta \(1\)/)).toBeInTheDocument()
      })
    })
  })

  // ===== Tab switcher =====

  describe('tab switcher', () => {
    it('switches from Rose to Tutti i giocatori via the Tabs bar', async () => {
      const user = userEvent.setup()
      render(<RoseGiocatori onNavigate={mockOnNavigate} />)
      await waitFor(() => {
        expect(screen.getByText('Ingaggi rosa')).toBeInTheDocument()
      })
      await user.click(screen.getByRole('tab', { name: /Tutti i giocatori/ }))
      await waitFor(() => {
        expect(screen.getAllByText('Player Alpha').length).toBeGreaterThan(0)
      })
    })

    it('switches from Rose to Statistiche via the Tabs bar', async () => {
      const user = userEvent.setup()
      render(<RoseGiocatori onNavigate={mockOnNavigate} />)
      await waitFor(() => {
        expect(screen.getByText('Ingaggi rosa')).toBeInTheDocument()
      })
      await user.click(screen.getByRole('tab', { name: 'Statistiche' }))
      await waitFor(() => {
        expect(screen.getAllByText('Lautaro Martinez').length).toBeGreaterThan(0)
      })
    })
  })
})
