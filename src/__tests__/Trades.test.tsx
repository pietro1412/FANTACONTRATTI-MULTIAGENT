import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ---------------------------------------------------------------------------
// Mocks — must come before component imports
// ---------------------------------------------------------------------------

// Mock Navigation
vi.mock('../components/Navigation', () => ({
  Navigation: ({ currentPage }: { currentPage: string }) => (
    <nav data-testid="navigation" data-page={currentPage}>Navigation</nav>
  ),
}))

// Mock Button
vi.mock('../components/ui/Button', () => ({
  Button: ({ children, onClick, disabled, ...props }: React.ComponentProps<'button'>) => (
    <button onClick={onClick} disabled={disabled} {...props}>{children}</button>
  ),
}))

// Mock Card
vi.mock('../components/ui/Card', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>{children}</div>
  ),
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>{children}</div>
  ),
}))

// Mock EmptyState
vi.mock('../components/ui/EmptyState', () => ({
  EmptyState: ({ title, description }: { title: string; description?: string }) => (
    <div data-testid="empty-state">
      <p>{title}</p>
      {description && <p>{description}</p>}
    </div>
  ),
}))

// Mock BottomSheet
vi.mock('../components/ui/BottomSheet', () => ({
  BottomSheet: ({ children, isOpen }: { children: React.ReactNode; isOpen: boolean }) =>
    isOpen ? <div data-testid="bottom-sheet">{children}</div> : null,
}))

// Mock ContractModifierModal
vi.mock('../components/ContractModifier', () => ({
  ContractModifierModal: () => null,
}))

// Mock deal-room components
vi.mock('../components/trades/deal-room', () => ({
  DealFinanceBar: ({ isInTradePhase }: { isInTradePhase: boolean }) => (
    <div data-testid="deal-finance-bar" data-in-trade={isInTradePhase}>Finance Bar</div>
  ),
  DealRosterPanel: () => <div data-testid="deal-roster-panel">Roster Panel</div>,
  DealTable: () => <div data-testid="deal-table">Deal Table</div>,
  DealMobileFooter: () => <div data-testid="deal-mobile-footer">Mobile Footer</div>,
}))

// Mock PlayerStatsModal
vi.mock('../components/PlayerStatsModal', () => ({
  PlayerStatsModal: () => null,
}))

// Mock Toast
vi.mock('@/components/ui/Toast', () => ({
  useToast: () => ({
    toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
  }),
}))

// Mock haptics
vi.mock('../utils/haptics', () => ({
  default: {
    save: vi.fn(),
    success: vi.fn(),
    tap: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    send: vi.fn(),
  },
}))

// Mock Pusher
vi.mock('../services/pusher.client', () => ({
  usePusherTrades: () => ({ isConnected: true }),
}))

// Mock trades index (types, utils, components)
vi.mock('../components/trades', () => ({
  getTimeRemaining: () => ({ text: '23h', isUrgent: false, isExpired: false }),
  PlayersTable: ({ players }: { players: unknown[] }) => (
    <div data-testid="players-table">Players: {players.length}</div>
  ),
}))

// Mock finance types (type-only import, no runtime mock needed, but satisfy module resolution)
vi.mock('../components/finance/types', () => ({}))

// Mock API
const mockGetReceived = vi.fn()
const mockGetSent = vi.fn()
const mockGetHistory = vi.fn()
const mockCreate = vi.fn()
const mockAcceptTrade = vi.fn()
const mockRejectTrade = vi.fn()
const mockCancelTrade = vi.fn()
const mockGetMembers = vi.fn()
const mockGetRoster = vi.fn()
const mockGetSessions = vi.fn()
const mockGetLeagueById = vi.fn()
const mockGetLeagueRosters = vi.fn()
const mockGetFinancials = vi.fn()
const mockContractModify = vi.fn()

vi.mock('../services/api', () => ({
  tradeApi: {
    getReceived: (...args: unknown[]) => mockGetReceived(...args),
    getSent: (...args: unknown[]) => mockGetSent(...args),
    getHistory: (...args: unknown[]) => mockGetHistory(...args),
    create: (...args: unknown[]) => mockCreate(...args),
    accept: (...args: unknown[]) => mockAcceptTrade(...args),
    reject: (...args: unknown[]) => mockRejectTrade(...args),
    cancel: (...args: unknown[]) => mockCancelTrade(...args),
  },
  auctionApi: {
    getRoster: (...args: unknown[]) => mockGetRoster(...args),
    getSessions: (...args: unknown[]) => mockGetSessions(...args),
    getLeagueRosters: (...args: unknown[]) => mockGetLeagueRosters(...args),
  },
  leagueApi: {
    getMembers: (...args: unknown[]) => mockGetMembers(...args),
    getById: (...args: unknown[]) => mockGetLeagueById(...args),
    getFinancials: (...args: unknown[]) => mockGetFinancials(...args),
  },
  contractApi: {
    modify: (...args: unknown[]) => mockContractModify(...args),
  },
}))

// ---------------------------------------------------------------------------
// Import the component under test AFTER all mocks
// ---------------------------------------------------------------------------
import { Trades } from '../pages/Trades'

// ---------------------------------------------------------------------------
// Helper: default API mock setup
// ---------------------------------------------------------------------------
function setupDefaultMocks() {
  mockGetReceived.mockResolvedValue({ success: true, data: [] })
  mockGetSent.mockResolvedValue({ success: true, data: [] })
  mockGetHistory.mockResolvedValue({ success: true, data: [] })
  mockGetMembers.mockResolvedValue({
    success: true,
    data: {
      members: [
        { id: 'm1', userId: 'u1', role: 'MEMBER', teamName: 'FC Test', currentBudget: 200, user: { username: 'TestUser' } },
        { id: 'm2', userId: 'u2', role: 'MEMBER', teamName: 'FC Rival', currentBudget: 180, user: { username: 'Rival' } },
      ],
    },
  })
  mockGetRoster.mockResolvedValue({
    success: true,
    data: {
      member: { id: 'm1', currentBudget: 200 },
      roster: {
        P: [],
        D: [
          {
            id: 'r1',
            player: { id: 'p1', name: 'Test Player D', team: 'Juventus', position: 'D', quotation: 15, age: 25, apiFootballId: null, computedStats: null, statsSyncedAt: null },
            contract: { salary: 5, duration: 2, rescissionClause: 35 },
            acquisitionPrice: 10,
          },
        ],
        C: [],
        A: [
          {
            id: 'r2',
            player: { id: 'p2', name: 'Test Player A', team: 'Milan', position: 'A', quotation: 30, age: 28, apiFootballId: null, computedStats: null, statsSyncedAt: null },
            contract: { salary: 8, duration: 3, rescissionClause: 72 },
            acquisitionPrice: 20,
          },
        ],
      },
    },
  })
  mockGetSessions.mockResolvedValue({
    success: true,
    data: [
      { id: 's1', status: 'ACTIVE', currentPhase: 'OFFERTE_PRE_RINNOVO' },
    ],
  })
  mockGetLeagueById.mockResolvedValue({
    success: true,
    data: { id: 'league-1', name: 'Test League', userMembership: { role: 'MEMBER' } },
  })
  mockGetLeagueRosters.mockResolvedValue({ success: true, data: [] })
  mockGetFinancials.mockResolvedValue({
    success: true,
    data: {
      inContrattiPhase: false,
      teams: [
        { memberId: 'm1', budget: 200, annualContractCost: 13, slotCount: 2, totalReleaseCosts: null, totalIndemnities: null },
        { memberId: 'm2', budget: 180, annualContractCost: 10, slotCount: 3, totalReleaseCosts: null, totalIndemnities: null },
      ],
    },
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('Trades Page', () => {
  const mockOnNavigate = vi.fn()
  const leagueId = 'league-1'

  beforeEach(() => {
    vi.clearAllMocks()
    setupDefaultMocks()
  })

  it('renders loading spinner initially', () => {
    // Make all API calls never resolve
    mockGetReceived.mockReturnValue(new Promise(() => {}))
    mockGetSent.mockReturnValue(new Promise(() => {}))
    mockGetMembers.mockReturnValue(new Promise(() => {}))
    mockGetRoster.mockReturnValue(new Promise(() => {}))
    mockGetSessions.mockReturnValue(new Promise(() => {}))
    mockGetLeagueById.mockReturnValue(new Promise(() => {}))
    mockGetLeagueRosters.mockReturnValue(new Promise(() => {}))
    mockGetFinancials.mockReturnValue(new Promise(() => {}))
    mockGetHistory.mockReturnValue(new Promise(() => {}))

    render(<Trades leagueId={leagueId} onNavigate={mockOnNavigate} />)

    expect(screen.getByText('Caricamento trattative...')).toBeInTheDocument()
  })

  it('renders page header with title after data loads', async () => {
    render(<Trades leagueId={leagueId} onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Trattative')).toBeInTheDocument()
    })
  })

  it('renders Navigation component with trades page', async () => {
    render(<Trades leagueId={leagueId} onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      const nav = screen.getByTestId('navigation')
      expect(nav).toBeInTheDocument()
      expect(nav.getAttribute('data-page')).toBe('trades')
    })
  })

  it('shows active trade phase indicator when in trade phase', async () => {
    render(<Trades leagueId={leagueId} onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Scambi attivi')).toBeInTheDocument()
    })
  })

  it('shows inactive trade phase indicator when not in trade phase', async () => {
    mockGetSessions.mockResolvedValue({ success: true, data: [] })

    render(<Trades leagueId={leagueId} onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Scambi non disponibili')).toBeInTheDocument()
    })
  })

  it('renders all four tab buttons', async () => {
    render(<Trades leagueId={leagueId} onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Nuova Offerta')).toBeInTheDocument()
    })
    expect(screen.getByText('Ricevute')).toBeInTheDocument()
    expect(screen.getByText('Inviate')).toBeInTheDocument()
    expect(screen.getByText('Concluse')).toBeInTheDocument()
  })

  it('shows DealFinanceBar component', async () => {
    render(<Trades leagueId={leagueId} onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByTestId('deal-finance-bar')).toBeInTheDocument()
    })
  })

  it('shows received offers count badge when there are offers', async () => {
    mockGetReceived.mockResolvedValue({
      success: true,
      data: [
        {
          id: 'offer1',
          fromMember: { id: 'm2', user: { username: 'Rival' }, teamName: 'FC Rival' },
          toMember: { id: 'm1', user: { username: 'TestUser' }, teamName: 'FC Test' },
          offeredPlayers: [],
          requestedPlayers: [],
          offeredBudget: 10,
          requestedBudget: 0,
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
          createdAt: new Date().toISOString(),
        },
      ],
    })

    render(<Trades leagueId={leagueId} onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      // The badge shows count "1" next to "Ricevute"
      const ricevuteTab = screen.getByText('Ricevute')
      const badge = ricevuteTab.parentElement?.querySelector('span')
      expect(badge).toBeTruthy()
    })
  })

  it('switches to received tab on click', async () => {
    const user = userEvent.setup()

    render(<Trades leagueId={leagueId} onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Ricevute')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Ricevute'))

    // After switching to received tab, check that the tab is highlighted
    // (border-accent-500 class indicates active received tab)
    const ricevuteButton = screen.getByText('Ricevute').closest('button')
    expect(ricevuteButton?.className).toContain('border-accent-500')
  })

  it('switches to sent tab on click', async () => {
    const user = userEvent.setup()

    render(<Trades leagueId={leagueId} onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Inviate')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Inviate'))

    const inviateButton = screen.getByText('Inviate').closest('button')
    expect(inviateButton?.className).toContain('border-primary-500')
  })

  it('shows not-in-phase message when creating offer outside trade phase', async () => {
    mockGetSessions.mockResolvedValue({ success: true, data: [] })

    render(<Trades leagueId={leagueId} onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText(/Puoi creare offerte solo durante la fase SCAMBI\/OFFERTE/)).toBeInTheDocument()
    })
  })

  it('shows DealTable when in trade phase on create tab', async () => {
    render(<Trades leagueId={leagueId} onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByTestId('deal-table')).toBeInTheDocument()
    })
  })

  it('shows load error with retry button on API failure', async () => {
    mockGetReceived.mockRejectedValue(new Error('Network error'))

    render(<Trades leagueId={leagueId} onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Errore nel caricamento delle trattative. Verifica la connessione.')).toBeInTheDocument()
    })

    expect(screen.getByText('Riprova')).toBeInTheDocument()
  })

  it('retries loading when Riprova button is clicked', async () => {
    const user = userEvent.setup()

    // First call fails, second succeeds
    mockGetReceived
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValue({ success: true, data: [] })

    render(<Trades leagueId={leagueId} onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Riprova')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Riprova'))

    await waitFor(() => {
      // After retry, loadData should be called again
      expect(mockGetReceived).toHaveBeenCalledTimes(2)
    })
  })

  it('calls all required APIs on mount', async () => {
    render(<Trades leagueId={leagueId} onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(mockGetReceived).toHaveBeenCalledWith(leagueId)
      expect(mockGetSent).toHaveBeenCalledWith(leagueId)
      expect(mockGetMembers).toHaveBeenCalledWith(leagueId)
      expect(mockGetRoster).toHaveBeenCalledWith(leagueId)
      expect(mockGetSessions).toHaveBeenCalledWith(leagueId)
      expect(mockGetLeagueById).toHaveBeenCalledWith(leagueId)
      expect(mockGetLeagueRosters).toHaveBeenCalledWith(leagueId)
      expect(mockGetFinancials).toHaveBeenCalledWith(leagueId)
      expect(mockGetHistory).toHaveBeenCalledWith(leagueId)
    })
  })

  it('starts on received tab when highlightOfferId is provided', async () => {
    render(
      <Trades leagueId={leagueId} onNavigate={mockOnNavigate} highlightOfferId="offer-123" />
    )

    await waitFor(() => {
      // When highlightOfferId is set, activeTab defaults to 'received'
      const ricevuteButton = screen.getByText('Ricevute').closest('button')
      expect(ricevuteButton?.className).toContain('border-accent-500')
    })
  })
})
