import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LeagueDetail } from '../pages/LeagueDetail'

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
  Navigation: ({ currentPage, leagueId, isLeagueAdmin }: { currentPage: string; leagueId?: string; isLeagueAdmin?: boolean }) => (
    <nav data-testid="navigation" data-page={currentPage} data-league={leagueId} data-admin={isLeagueAdmin}>
      Navigation
    </nav>
  ),
}))

// Mock Button
vi.mock('../components/ui/Button', () => ({
  Button: ({ children, onClick, ...props }: React.ComponentProps<'button'>) => (
    <button onClick={onClick} {...props}>{children}</button>
  ),
}))

// Mock finance types
vi.mock('../components/finance/types', () => ({
  computeLeagueTotals: vi.fn().mockReturnValue({
    avgBudget: 350,
    avgSalary: 100,
    avgBalance: 250,
    totalContracts: 40,
    avgSlotsFilled: 10,
    budgetRange: { min: 200, max: 500 },
    salaryRange: { min: 50, max: 150 },
    balanceRange: { min: 100, max: 400 },
    giniIndex: 0.25,
  }),
}))

// Mock league-detail sub-components
vi.mock('../components/league-detail', () => ({
  LeagueDetailHeader: ({ leagueName }: { leagueName: string }) => (
    <div data-testid="league-header">{leagueName}</div>
  ),
  AdminBanner: ({ isAdmin, onOpenAuctionClick }: { isAdmin: boolean; onOpenAuctionClick: () => void; leagueStatus: string; activeSession: unknown; isFirstMarketCompleted: boolean; leagueId: string; onNavigate: unknown }) => (
    isAdmin ? <div data-testid="admin-banner"><button onClick={onOpenAuctionClick}>Start Auction</button></div> : null
  ),
  FinancialKPIs: () => <div data-testid="financial-kpis">KPIs</div>,
  StrategySummary: () => <div data-testid="strategy-summary">Strategy</div>,
  RecentMovements: () => <div data-testid="recent-movements">Movements</div>,
  ManagersSidebar: ({ onLeaveLeague }: { onLeaveLeague: () => void; members: unknown[]; maxParticipants: number; leagueId: string; leagueStatus: string; isAdmin: boolean; isLeaving: boolean; totals: unknown }) => (
    <div data-testid="managers-sidebar">
      <button data-testid="leave-button" onClick={onLeaveLeague}>Leave</button>
    </div>
  ),
  AuctionConfirmModal: ({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void; isRegularMarket: boolean; activeMembers: number; isCreating: boolean }) => (
    <div data-testid="auction-modal">
      <button data-testid="confirm-auction" onClick={onConfirm}>Confirm</button>
      <button data-testid="cancel-auction" onClick={onCancel}>Cancel</button>
    </div>
  ),
}))

// Mock API
const mockGetById = vi.fn()
const mockGetSessions = vi.fn()
const mockGetStatus = vi.fn()
const mockGetFinancials = vi.fn()
const mockGetLeagueMovements = vi.fn()
const mockGetStrategySummary = vi.fn()
const mockCreateSession = vi.fn()
const mockLeave = vi.fn()

vi.mock('../services/api', () => ({
  leagueApi: {
    getById: (...args: unknown[]) => mockGetById(...args),
    getFinancials: (...args: unknown[]) => mockGetFinancials(...args),
    getStrategySummary: (...args: unknown[]) => mockGetStrategySummary(...args),
    leave: (...args: unknown[]) => mockLeave(...args),
    getPendingRequests: vi.fn().mockResolvedValue({ success: true, data: [] }),
  },
  auctionApi: {
    getSessions: (...args: unknown[]) => mockGetSessions(...args),
    createSession: (...args: unknown[]) => mockCreateSession(...args),
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

// Sample data
const sampleLeague = {
  id: 'l1',
  name: 'Lega Champions',
  description: 'A great league',
  minParticipants: 4,
  maxParticipants: 8,
  initialBudget: 500,
  status: 'ACTIVE',
  goalkeeperSlots: 3,
  defenderSlots: 8,
  midfielderSlots: 8,
  forwardSlots: 6,
  members: [
    { id: 'm1', role: 'ADMIN', status: 'ACTIVE', currentBudget: 350, teamName: 'Team Alpha', user: { id: 'u1', username: 'Admin1' } },
    { id: 'm2', role: 'MEMBER', status: 'ACTIVE', currentBudget: 400, teamName: 'Team Beta', user: { id: 'u2', username: 'Player2' } },
  ],
}

const sampleSessions = [
  { id: 's1', type: 'PRIMO_MERCATO', status: 'COMPLETED', currentPhase: 'ASTA_SVINCOLATI', createdAt: '2025-01-01', startsAt: null, phaseStartedAt: null },
]

describe('LeagueDetail', () => {
  const mockOnNavigate = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetStatus.mockResolvedValue({ success: true, data: { isSuperAdmin: false } })
    mockGetById.mockResolvedValue({
      success: true,
      data: { league: sampleLeague, isAdmin: true, userMembership: { id: 'm1', currentBudget: 350 } },
    })
    mockGetSessions.mockResolvedValue({ success: true, data: sampleSessions })
    mockGetFinancials.mockResolvedValue({ success: true, data: { teams: [] } })
    mockGetLeagueMovements.mockResolvedValue({ success: true, data: [] })
    mockGetStrategySummary.mockResolvedValue({ success: true, data: { targets: 3, topPriority: 1, watching: 2, toSell: 0, total: 6 } })
  })

  it('shows initial loading spinner while checking superadmin', () => {
    mockGetStatus.mockReturnValue(new Promise(() => {}))

    render(<LeagueDetail leagueId="l1" onNavigate={mockOnNavigate} />)

    const spinner = document.querySelector('.animate-spin')
    expect(spinner).toBeTruthy()
  })

  it('shows loading skeleton while fetching league data', async () => {
    mockGetStatus.mockResolvedValue({ success: true, data: { isSuperAdmin: false } })
    mockGetById.mockReturnValue(new Promise(() => {}))
    mockGetSessions.mockReturnValue(new Promise(() => {}))

    render(<LeagueDetail leagueId="l1" onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      const pulseElements = document.querySelectorAll('.animate-pulse')
      expect(pulseElements.length).toBeGreaterThan(0)
    })
  })

  it('renders league detail after data loads', async () => {
    render(<LeagueDetail leagueId="l1" onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByTestId('league-header')).toHaveTextContent('Lega Champions')
    })

    expect(screen.getByTestId('managers-sidebar')).toBeInTheDocument()
  })

  it('redirects superadmin to dashboard', async () => {
    mockGetStatus.mockResolvedValue({ success: true, data: { isSuperAdmin: true } })

    render(<LeagueDetail leagueId="l1" onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(mockOnNavigate).toHaveBeenCalledWith('dashboard')
    })
  })

  it('shows "Lega non trovata" when league data is missing', async () => {
    mockGetById.mockResolvedValue({ success: false, message: 'Not found' })

    render(<LeagueDetail leagueId="l1" onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Lega non trovata')).toBeInTheDocument()
    })

    expect(screen.getByText('Torna alla Dashboard')).toBeInTheDocument()
  })

  it('shows admin banner for admin users', async () => {
    render(<LeagueDetail leagueId="l1" onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByTestId('admin-banner')).toBeInTheDocument()
    })
  })

  it('does not show admin banner for non-admin users', async () => {
    mockGetById.mockResolvedValue({
      success: true,
      data: { league: sampleLeague, isAdmin: false, userMembership: { id: 'm2', currentBudget: 400 } },
    })

    render(<LeagueDetail leagueId="l1" onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByTestId('league-header')).toBeInTheDocument()
    })

    expect(screen.queryByTestId('admin-banner')).not.toBeInTheDocument()
  })

  it('navigates to dashboard when "Torna alla Dashboard" is clicked on error state', async () => {
    const user = userEvent.setup()
    mockGetById.mockResolvedValue({ success: false })

    render(<LeagueDetail leagueId="l1" onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Torna alla Dashboard')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Torna alla Dashboard'))
    expect(mockOnNavigate).toHaveBeenCalledWith('dashboard')
  })
})
