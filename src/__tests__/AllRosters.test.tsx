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
  }),
}))

vi.mock('../components/ui/Toast', () => ({
  useToast: () => ({
    toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
  }),
}))

const mockLeagueData = {
  id: 'league-1',
  name: 'Test League',
  isAdmin: true,
  inContrattiPhase: false,
  members: [
    {
      id: 'm1',
      userId: 'u1',
      role: 'ADMIN' as const,
      teamName: 'FC Uno',
      currentBudget: 200,
      user: { username: 'Admin' },
      roster: [
        {
          id: 'r1',
          playerId: 'p1',
          acquisitionPrice: 12,
          acquisitionType: 'AUCTION',
          player: { id: 'p1', name: 'Marco Verdi', team: 'Inter', position: 'C' as const, quotation: 20, apiFootballId: null },
          contract: { id: 'c1', salary: 5, duration: 2, rescissionClause: 10, signedAt: '2025-01-01' },
        },
        {
          id: 'r2',
          playerId: 'p2',
          acquisitionPrice: 8,
          acquisitionType: 'AUCTION',
          player: { id: 'p2', name: 'Luca Neri', team: 'Roma', position: 'A' as const, quotation: 25, apiFootballId: null },
          contract: { id: 'c2', salary: 6, duration: 1, rescissionClause: null, signedAt: '2025-01-01' },
        },
      ],
    },
    {
      id: 'm2',
      userId: 'u2',
      role: 'MEMBER' as const,
      teamName: 'FC Due',
      currentBudget: 180,
      user: { username: 'Player2' },
      roster: [
        {
          id: 'r3',
          playerId: 'p3',
          acquisitionPrice: 15,
          acquisitionType: 'AUCTION',
          player: { id: 'p3', name: 'Paolo Bianchi', team: 'Juventus', position: 'D' as const, quotation: 18, apiFootballId: null },
          contract: { id: 'c3', salary: 4, duration: 3, rescissionClause: 12, signedAt: '2025-01-01' },
        },
      ],
    },
  ],
}

const mockGetAllRosters = vi.fn()

vi.mock('../services/api', () => ({
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

vi.mock('../components/ui/PositionBadge', () => ({
  POSITION_GRADIENTS: { P: 'from-amber-500', D: 'from-blue-500', C: 'from-emerald-500', A: 'from-red-500' },
}))

vi.mock('../utils/teamLogos', () => ({
  getTeamLogo: (team: string) => `https://logo.test/${team}.png`,
}))

vi.mock('../utils/player-images', () => ({
  getPlayerPhotoUrl: () => null,
}))

// ---------------------------------------------------------------------------
import { AllRosters } from '../pages/AllRosters'

describe('AllRosters Page', () => {
  const mockOnNavigate = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders loading spinner while data is being fetched', () => {
    mockGetAllRosters.mockReturnValue(new Promise(() => {}))

    render(<AllRosters leagueId="league-1" onNavigate={mockOnNavigate} />)

    // The loading spinner uses the animate-spin class
    const spinner = document.querySelector('.animate-spin')
    expect(spinner).toBeTruthy()
  })

  it('renders error state when API fails', async () => {
    mockGetAllRosters.mockRejectedValue(new Error('Connection error'))

    render(<AllRosters leagueId="league-1" onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Errore di connessione')).toBeInTheDocument()
    })

    expect(screen.getByText('Riprova')).toBeInTheDocument()
  })

  it('renders the page header with league name after load', async () => {
    mockGetAllRosters.mockResolvedValue({ success: true, data: mockLeagueData })

    render(<AllRosters leagueId="league-1" onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Tutte le Rose')).toBeInTheDocument()
    })

    expect(screen.getByText('Test League')).toBeInTheDocument()
  })

  it('displays all members in the sidebar', async () => {
    mockGetAllRosters.mockResolvedValue({ success: true, data: mockLeagueData })

    render(<AllRosters leagueId="league-1" onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Admin')).toBeInTheDocument()
    })

    expect(screen.getByText('Player2')).toBeInTheDocument()
    expect(screen.getByText('Direttori Generali (2)')).toBeInTheDocument()
  })

  it('shows prompt to select a member before any selection', async () => {
    mockGetAllRosters.mockResolvedValue({ success: true, data: mockLeagueData })

    render(<AllRosters leagueId="league-1" onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Seleziona un Direttore Generale per vedere la sua rosa')).toBeInTheDocument()
    })
  })

  it('displays member roster after clicking on a member', async () => {
    mockGetAllRosters.mockResolvedValue({ success: true, data: mockLeagueData })

    const user = userEvent.setup()

    render(<AllRosters leagueId="league-1" onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Admin')).toBeInTheDocument()
    })

    // Click on the first member
    await user.click(screen.getByText('Admin'))

    // Member's players should now appear
    await waitFor(() => {
      expect(screen.getByText('Marco Verdi')).toBeInTheDocument()
    })

    expect(screen.getByText('Luca Neri')).toBeInTheDocument()
  })
})
