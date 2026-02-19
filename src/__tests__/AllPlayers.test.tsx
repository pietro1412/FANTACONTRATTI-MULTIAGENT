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

const mockPlayers = [
  {
    id: 'p1',
    name: 'Player Alpha',
    team: 'Juventus',
    position: 'A' as const,
    quotation: 30,
    listStatus: 'LISTED',
    age: 24,
    apiFootballId: null,
    apiFootballStats: null,
    statsSyncedAt: null,
  },
  {
    id: 'p2',
    name: 'Player Beta',
    team: 'Milan',
    position: 'C' as const,
    quotation: 20,
    listStatus: 'LISTED',
    age: 28,
    apiFootballId: null,
    apiFootballStats: null,
    statsSyncedAt: null,
  },
]

const mockLeagueRosters = {
  id: 'league-1',
  name: 'Test League',
  isAdmin: false,
  members: [
    {
      id: 'm1',
      user: { username: 'TestUser' },
      teamName: 'FC Test',
      roster: [
        { playerId: 'p1', acquisitionPrice: 15, contract: { salary: 5, duration: 2, rescissionClause: null } },
      ],
    },
  ],
}

const mockGetAllRosters = vi.fn()
const mockGetAllPlayers = vi.fn()

vi.mock('../services/api', () => ({
  playerApi: {
    getAll: (...args: unknown[]) => mockGetAllPlayers(...args),
  },
  leagueApi: {
    getAllRosters: (...args: unknown[]) => mockGetAllRosters(...args),
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

vi.mock('../components/PullToRefresh', () => ({
  PullToRefresh: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('../components/PlayerStatsModal', () => ({
  PlayerStatsModal: () => null,
}))

vi.mock('../components/ui/Input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input data-testid="search-input" {...props} />
  ),
}))

vi.mock('../components/ui/EmptyState', () => ({
  EmptyState: ({ title }: { title: string }) => <div data-testid="empty-state">{title}</div>,
}))

vi.mock('../components/ui/BottomSheet', () => ({
  BottomSheet: ({ children, isOpen }: { children: React.ReactNode; isOpen: boolean }) =>
    isOpen ? <div data-testid="bottom-sheet">{children}</div> : null,
}))

vi.mock('../components/ui/Skeleton', () => ({
  SkeletonPlayerRow: () => <div data-testid="skeleton-row" />,
}))

vi.mock('../components/ui/PositionBadge', () => ({
  POSITION_GRADIENTS: { P: 'from-amber-500', D: 'from-blue-500', C: 'from-emerald-500', A: 'from-red-500' },
  POSITION_FILTER_COLORS: { P: 'bg-amber-500/20', D: 'bg-blue-500/20', C: 'bg-emerald-500/20', A: 'bg-red-500/20' },
}))

vi.mock('../utils/player-images', () => ({
  getPlayerPhotoUrl: () => null,
}))

// Mock @tanstack/react-virtual for virtualized list
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: () => count * 72,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({
        index: i,
        start: i * 72,
        size: 72,
        key: i,
      })),
  }),
}))

// ---------------------------------------------------------------------------
import { AllPlayers } from '../pages/AllPlayers'

describe('AllPlayers Page', () => {
  const mockOnNavigate = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders loading skeletons while data is being fetched', () => {
    mockGetAllRosters.mockReturnValue(new Promise(() => {}))
    mockGetAllPlayers.mockReturnValue(new Promise(() => {}))

    render(<AllPlayers leagueId="league-1" onNavigate={mockOnNavigate} />)

    const skeletons = screen.getAllByTestId('skeleton-row')
    expect(skeletons.length).toBe(5)
  })

  it('renders the page title and league name after load', async () => {
    mockGetAllRosters.mockResolvedValue({ success: true, data: mockLeagueRosters })
    mockGetAllPlayers.mockResolvedValue({ success: true, data: mockPlayers })

    render(<AllPlayers leagueId="league-1" onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Tutti i Giocatori')).toBeInTheDocument()
    })

    expect(screen.getByText('Test League')).toBeInTheDocument()
  })

  it('displays player names and teams in the list', async () => {
    mockGetAllRosters.mockResolvedValue({ success: true, data: mockLeagueRosters })
    mockGetAllPlayers.mockResolvedValue({ success: true, data: mockPlayers })

    render(<AllPlayers leagueId="league-1" onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Player Alpha')).toBeInTheDocument()
    })

    expect(screen.getByText('Player Beta')).toBeInTheDocument()
    expect(screen.getByText('Juventus')).toBeInTheDocument()
    expect(screen.getByText('Milan')).toBeInTheDocument()
  })

  it('shows roster info for rostered players', async () => {
    mockGetAllRosters.mockResolvedValue({ success: true, data: mockLeagueRosters })
    mockGetAllPlayers.mockResolvedValue({ success: true, data: mockPlayers })

    render(<AllPlayers leagueId="league-1" onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      // Player Alpha is in TestUser's roster
      expect(screen.getByText('TestUser')).toBeInTheDocument()
    })

    // Player Beta is free
    expect(screen.getByText('Libero')).toBeInTheDocument()
  })

  it('shows the total count of filtered players', async () => {
    mockGetAllRosters.mockResolvedValue({ success: true, data: mockLeagueRosters })
    mockGetAllPlayers.mockResolvedValue({ success: true, data: mockPlayers })

    render(<AllPlayers leagueId="league-1" onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('2 giocatori trovati')).toBeInTheDocument()
    })
  })

  it('renders empty state when API returns no players', async () => {
    mockGetAllRosters.mockResolvedValue({ success: true, data: { ...mockLeagueRosters, members: [] } })
    mockGetAllPlayers.mockResolvedValue({ success: true, data: [] })

    render(<AllPlayers leagueId="league-1" onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument()
    })
  })
})
