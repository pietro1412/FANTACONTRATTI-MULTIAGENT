import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Mocks — must come before component imports
// ---------------------------------------------------------------------------

// Mock react-router-dom (Rose uses useParams)
vi.mock('react-router-dom', () => ({
  useParams: () => ({ leagueId: 'league-1' }),
}))

// Mock useAuth
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'u1', email: 'test@test.com', username: 'TestUser' },
    isAuthenticated: true,
    isLoading: false,
  }),
}))

// Mock Toast
vi.mock('../components/ui/Toast', () => ({
  useToast: () => ({
    toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
  }),
}))

// Build realistic mock data
const mockLeagueData = {
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
          acquisitionPrice: 10,
          acquisitionType: 'AUCTION',
          player: {
            id: 'p1',
            name: 'Mario Rossi',
            team: 'Juventus',
            position: 'A' as const,
            quotation: 25,
            apiFootballId: null,
            apiFootballStats: null,
            computedStats: null,
            statsSyncedAt: null,
          },
          contract: {
            id: 'c1',
            salary: 5,
            duration: 2,
            rescissionClause: 10,
            signedAt: '2025-01-01',
          },
        },
        {
          id: 'r2',
          playerId: 'p2',
          acquisitionPrice: 8,
          acquisitionType: 'AUCTION',
          player: {
            id: 'p2',
            name: 'Luigi Bianchi',
            team: 'Milan',
            position: 'D' as const,
            quotation: 15,
            apiFootballId: null,
            apiFootballStats: null,
            computedStats: null,
            statsSyncedAt: null,
          },
          contract: {
            id: 'c2',
            salary: 3,
            duration: 3,
            rescissionClause: null,
            signedAt: '2025-01-01',
          },
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

// Mock API
const mockGetAllRosters = vi.fn()
vi.mock('../services/api', () => ({
  leagueApi: {
    getAllRosters: (...args: unknown[]) => mockGetAllRosters(...args),
    getById: vi.fn().mockResolvedValue({ success: true, data: { id: 'league-1', name: 'Test League' } }),
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

// Mock child components that are not under test
vi.mock('../components/Navigation', () => ({
  Navigation: () => <nav data-testid="navigation">Nav</nav>,
}))

vi.mock('../components/PlayerStatsModal', () => ({
  PlayerStatsModal: () => null,
}))

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

vi.mock('../utils/teamLogos', () => ({
  getTeamLogo: (team: string) => `https://logo.test/${team}.png`,
}))

// ---------------------------------------------------------------------------
// Import the component under test AFTER all mocks
// ---------------------------------------------------------------------------
import { Rose } from '../pages/Rose'

describe('Rose Page', () => {
  const mockOnNavigate = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders loading skeletons while data is being fetched', () => {
    // Never resolve the API call so the component stays in the loading state
    mockGetAllRosters.mockReturnValue(new Promise(() => {}))

    render(<Rose onNavigate={mockOnNavigate} />)

    const skeletons = screen.getAllByTestId('skeleton-row')
    expect(skeletons.length).toBe(5)
  })

  it('renders error state when API returns no data', async () => {
    mockGetAllRosters.mockResolvedValue({ success: false })

    render(<Rose onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Errore nel caricamento delle rose')).toBeInTheDocument()
    })
  })

  it('renders the page header and player data after successful load', async () => {
    mockGetAllRosters.mockResolvedValue({ success: true, data: mockLeagueData })

    render(<Rose onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Rose')).toBeInTheDocument()
    })

    // Player names should appear (both in mobile card and desktop table)
    expect(screen.getAllByText('Mario Rossi').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Luigi Bianchi').length).toBeGreaterThan(0)
  })

  it('displays position counts and budget stats', async () => {
    mockGetAllRosters.mockResolvedValue({ success: true, data: mockLeagueData })

    render(<Rose onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      // Stats bar: position counts
      expect(screen.getByText('A: 1')).toBeInTheDocument()
      expect(screen.getByText('D: 1')).toBeInTheDocument()
    })

    // Budget display
    expect(screen.getAllByText('200M').length).toBeGreaterThan(0)
  })

  it('shows "LA MIA ROSA" badge for the current user', async () => {
    mockGetAllRosters.mockResolvedValue({ success: true, data: mockLeagueData })

    render(<Rose onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('LA MIA ROSA')).toBeInTheDocument()
    })
  })

  it('shows contracts phase warning when viewing another manager', async () => {
    const dataWithContracts = {
      ...mockLeagueData,
      inContrattiPhase: true,
      // Override currentUserId so selected member is NOT the current user
      currentUserId: 'u999',
    }
    mockGetAllRosters.mockResolvedValue({ success: true, data: dataWithContracts })

    render(<Rose onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText(/Fase CONTRATTI attiva/)).toBeInTheDocument()
    })
  })
})
