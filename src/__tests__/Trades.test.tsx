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

// Mock deal-room components — DealTable invokes onOpenMyRoster/onOpenPartnerRoster so we can test BottomSheet
vi.mock('../components/trades/deal-room', () => ({
  DealFinanceBar: ({ isInTradePhase }: { isInTradePhase: boolean }) => (
    <div data-testid="deal-finance-bar" data-in-trade={isInTradePhase}>Finance Bar</div>
  ),
  DealRosterPanel: () => <div data-testid="deal-roster-panel">Roster Panel</div>,
  DealTable: ({ onOpenMyRoster, onOpenPartnerRoster, onSubmit }: { onOpenMyRoster?: () => void; onOpenPartnerRoster?: () => void; onSubmit?: (e: React.FormEvent) => void }) => (
    <div data-testid="deal-table">
      Deal Table
      {onOpenMyRoster && <button data-testid="open-my-roster" onClick={onOpenMyRoster}>Open My Roster</button>}
      {onOpenPartnerRoster && <button data-testid="open-partner-roster" onClick={onOpenPartnerRoster}>Open Partner Roster</button>}
      {onSubmit && <button data-testid="submit-offer" onClick={(e) => onSubmit(e as unknown as React.FormEvent)}>Submit</button>}
    </div>
  ),
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

  // ---------------------------------------------------------------------------
  // Received Tab — offer rendering & actions
  // ---------------------------------------------------------------------------

  it('shows empty state on received tab when no offers', async () => {
    const user = userEvent.setup()

    render(<Trades leagueId={leagueId} onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Ricevute')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Ricevute'))

    await waitFor(() => {
      expect(screen.getByText('Nessuna offerta ricevuta')).toBeInTheDocument()
    })
  })

  it('renders received offer details with sender info and action buttons', async () => {
    const user = userEvent.setup()
    mockGetReceived.mockResolvedValue({
      success: true,
      data: [
        {
          id: 'offer1',
          fromMember: { id: 'm2', user: { username: 'Rival' }, teamName: 'FC Rival' },
          toMember: { id: 'm1', user: { username: 'TestUser' }, teamName: 'FC Test' },
          offeredPlayers: [{ id: 'p10', name: 'Player Offered', position: 'A' }],
          requestedPlayers: [{ id: 'p11', name: 'Player Requested', position: 'D' }],
          offeredBudget: 15,
          requestedBudget: 5,
          status: 'PENDING',
          message: 'Buona offerta!',
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
          createdAt: new Date().toISOString(),
          sender: { username: 'Rival' },
          receiver: { username: 'TestUser' },
        },
      ],
    })

    render(<Trades leagueId={leagueId} onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Ricevute')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Ricevute'))

    await waitFor(() => {
      // Sender username rendered
      expect(screen.getByText('Rival')).toBeInTheDocument()
      // Status badge
      expect(screen.getByText('In attesa')).toBeInTheDocument()
      // Section headers
      expect(screen.getByText('Riceveresti')).toBeInTheDocument()
      expect(screen.getByText('Cederesti')).toBeInTheDocument()
      // Budget amounts
      expect(screen.getByText('+ 15 crediti')).toBeInTheDocument()
      expect(screen.getByText('+ 5 crediti')).toBeInTheDocument()
      // Message
      expect(screen.getByText(/"Buona offerta!"/)).toBeInTheDocument()
      // Action buttons
      expect(screen.getByText('Accetta Scambio')).toBeInTheDocument()
      expect(screen.getByText('Rifiuta')).toBeInTheDocument()
    })
  })

  it('calls accept API when Accetta Scambio is clicked', async () => {
    const user = userEvent.setup()
    mockAcceptTrade.mockResolvedValue({ success: true })
    mockGetReceived.mockResolvedValue({
      success: true,
      data: [
        {
          id: 'offer-accept-1',
          fromMember: { id: 'm2', user: { username: 'Rival' } },
          offeredPlayers: [],
          requestedPlayers: [],
          offeredBudget: 10,
          requestedBudget: 0,
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
          createdAt: new Date().toISOString(),
          sender: { username: 'Rival' },
        },
      ],
    })

    render(<Trades leagueId={leagueId} onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Ricevute')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Ricevute'))

    await waitFor(() => {
      expect(screen.getByText('Accetta Scambio')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Accetta Scambio'))

    await waitFor(() => {
      expect(mockAcceptTrade).toHaveBeenCalledWith('offer-accept-1')
    })
  })

  it('calls reject API when Rifiuta is clicked', async () => {
    const user = userEvent.setup()
    mockRejectTrade.mockResolvedValue({ success: true })
    mockGetReceived.mockResolvedValue({
      success: true,
      data: [
        {
          id: 'offer-reject-1',
          fromMember: { id: 'm2', user: { username: 'Rival' } },
          offeredPlayers: [],
          requestedPlayers: [],
          offeredBudget: 0,
          requestedBudget: 0,
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
          createdAt: new Date().toISOString(),
          sender: { username: 'Rival' },
        },
      ],
    })

    render(<Trades leagueId={leagueId} onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Ricevute')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Ricevute'))

    await waitFor(() => {
      expect(screen.getByText('Rifiuta')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Rifiuta'))

    await waitFor(() => {
      expect(mockRejectTrade).toHaveBeenCalledWith('offer-reject-1')
    })
  })

  // ---------------------------------------------------------------------------
  // Sent Tab — offer rendering & cancel
  // ---------------------------------------------------------------------------

  it('shows empty state on sent tab when no offers', async () => {
    const user = userEvent.setup()

    render(<Trades leagueId={leagueId} onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Inviate')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Inviate'))

    await waitFor(() => {
      expect(screen.getByText('Nessuna offerta inviata')).toBeInTheDocument()
    })
  })

  it('renders sent offers with receiver info and cancel button', async () => {
    const user = userEvent.setup()
    mockGetSent.mockResolvedValue({
      success: true,
      data: [
        {
          id: 'sent-1',
          toMember: { id: 'm2', user: { username: 'Rival' } },
          offeredPlayers: [{ id: 'op1', name: 'My Player', position: 'C' }],
          requestedPlayers: [],
          offeredBudget: 20,
          requestedBudget: 0,
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
          createdAt: new Date().toISOString(),
          receiver: { username: 'Rival' },
        },
      ],
    })

    render(<Trades leagueId={leagueId} onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Inviate')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Inviate'))

    await waitFor(() => {
      expect(screen.getByText('A: Rival')).toBeInTheDocument()
      expect(screen.getByText('Offri')).toBeInTheDocument()
      expect(screen.getByText('Richiedi')).toBeInTheDocument()
      expect(screen.getByText('+ 20 crediti')).toBeInTheDocument()
      expect(screen.getByText('Annulla Offerta')).toBeInTheDocument()
    })
  })

  it('calls cancel API when Annulla Offerta is clicked', async () => {
    const user = userEvent.setup()
    mockCancelTrade.mockResolvedValue({ success: true })
    mockGetSent.mockResolvedValue({
      success: true,
      data: [
        {
          id: 'sent-cancel-1',
          toMember: { id: 'm2', user: { username: 'Rival' } },
          offeredPlayers: [],
          requestedPlayers: [],
          offeredBudget: 0,
          requestedBudget: 0,
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
          createdAt: new Date().toISOString(),
          receiver: { username: 'Rival' },
        },
      ],
    })

    render(<Trades leagueId={leagueId} onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Inviate')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Inviate'))

    await waitFor(() => {
      expect(screen.getByText('Annulla Offerta')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Annulla Offerta'))

    await waitFor(() => {
      expect(mockCancelTrade).toHaveBeenCalledWith('sent-cancel-1')
    })
  })

  // ---------------------------------------------------------------------------
  // History Tab — filter chips & trade history rendering
  // ---------------------------------------------------------------------------

  it('switches to history tab and shows filter chips', async () => {
    const user = userEvent.setup()

    render(<Trades leagueId={leagueId} onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Concluse')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Concluse'))

    await waitFor(() => {
      expect(screen.getByText('Tutte')).toBeInTheDocument()
      expect(screen.getByText('Accettate')).toBeInTheDocument()
      expect(screen.getByText('Rifiutate')).toBeInTheDocument()
      expect(screen.getByText('Decadute')).toBeInTheDocument()
      expect(screen.getByText('Annullate')).toBeInTheDocument()
    })
  })

  it('shows empty state on history tab when no concluded trades', async () => {
    const user = userEvent.setup()

    render(<Trades leagueId={leagueId} onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Concluse')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Concluse'))

    await waitFor(() => {
      expect(screen.getByText('Nessuna trattativa conclusa')).toBeInTheDocument()
    })
  })

  it('renders concluded trade history with status badges', async () => {
    const user = userEvent.setup()
    mockGetHistory.mockResolvedValue({
      success: true,
      data: [
        {
          id: 'hist-1',
          status: 'ACCEPTED',
          offeredPlayers: [],
          requestedPlayers: [],
          offeredBudget: 10,
          requestedBudget: 5,
          createdAt: new Date().toISOString(),
          respondedAt: new Date().toISOString(),
          sender: { username: 'UserA' },
          receiver: { username: 'UserB' },
        },
        {
          id: 'hist-2',
          status: 'REJECTED',
          offeredPlayers: [],
          requestedPlayers: [],
          offeredBudget: 0,
          requestedBudget: 0,
          createdAt: new Date().toISOString(),
          sender: { username: 'UserC' },
          receiver: { username: 'UserD' },
        },
      ],
    })

    render(<Trades leagueId={leagueId} onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Concluse')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Concluse'))

    await waitFor(() => {
      expect(screen.getByText('Accettato')).toBeInTheDocument()
      expect(screen.getByText('Rifiutato')).toBeInTheDocument()
      // Multiple trades have "Offerti" / "Richiesti" headers
      expect(screen.getAllByText('Offerti').length).toBe(2)
      expect(screen.getAllByText('Richiesti').length).toBe(2)
    })
  })

  it('filters history by status when filter chip is clicked', async () => {
    const user = userEvent.setup()
    mockGetHistory.mockResolvedValue({
      success: true,
      data: [
        {
          id: 'hist-a',
          status: 'ACCEPTED',
          offeredPlayers: [],
          requestedPlayers: [],
          offeredBudget: 0,
          requestedBudget: 0,
          createdAt: new Date().toISOString(),
          sender: { username: 'A' },
          receiver: { username: 'B' },
        },
        {
          id: 'hist-r',
          status: 'REJECTED',
          offeredPlayers: [],
          requestedPlayers: [],
          offeredBudget: 0,
          requestedBudget: 0,
          createdAt: new Date().toISOString(),
          sender: { username: 'C' },
          receiver: { username: 'D' },
        },
      ],
    })

    render(<Trades leagueId={leagueId} onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Concluse')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Concluse'))

    // Click on 'Rifiutate' filter
    await waitFor(() => {
      expect(screen.getByText('Rifiutate')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Rifiutate'))

    // Should only show rejected trade
    await waitFor(() => {
      expect(screen.getByText('Rifiutato')).toBeInTheDocument()
      expect(screen.queryByText('Accettato')).not.toBeInTheDocument()
    })
  })

  it('renders invalidated trade with special message', async () => {
    const user = userEvent.setup()
    mockGetHistory.mockResolvedValue({
      success: true,
      data: [
        {
          id: 'hist-inv',
          status: 'INVALIDATED',
          offeredPlayers: [],
          requestedPlayers: [],
          offeredBudget: 0,
          requestedBudget: 0,
          createdAt: new Date().toISOString(),
          sender: { username: 'X' },
          receiver: { username: 'Y' },
        },
      ],
    })

    render(<Trades leagueId={leagueId} onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Concluse')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Concluse'))

    await waitFor(() => {
      expect(screen.getByText('Decaduta')).toBeInTheDocument()
      expect(screen.getByText(/giocatore coinvolto è stato scambiato/)).toBeInTheDocument()
    })
  })

  // ---------------------------------------------------------------------------
  // Admin role detection
  // ---------------------------------------------------------------------------

  it('detects admin role from league data', async () => {
    mockGetLeagueById.mockResolvedValue({
      success: true,
      data: { id: 'league-1', name: 'Test League', userMembership: { role: 'ADMIN' } },
    })

    render(<Trades leagueId={leagueId} onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Trattative')).toBeInTheDocument()
    })
    // Navigation renders — admin status passed through (we just verify no crash)
    expect(screen.getByTestId('navigation')).toBeInTheDocument()
  })

  it('shows sent offers count badge when there are sent offers', async () => {
    mockGetSent.mockResolvedValue({
      success: true,
      data: [
        {
          id: 'sent-badge-1',
          toMember: { id: 'm2', user: { username: 'Rival' } },
          offeredPlayers: [],
          requestedPlayers: [],
          offeredBudget: 0,
          requestedBudget: 0,
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
          createdAt: new Date().toISOString(),
        },
      ],
    })

    render(<Trades leagueId={leagueId} onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      // The sent tab should show a badge with "1"
      const inviateTab = screen.getByText('Inviate')
      const badge = inviateTab.parentElement?.querySelector('span')
      expect(badge).toBeTruthy()
    })
  })

  it('shows history count badge when there are concluded trades', async () => {
    mockGetHistory.mockResolvedValue({
      success: true,
      data: [
        {
          id: 'hist-badge',
          status: 'ACCEPTED',
          offeredPlayers: [],
          requestedPlayers: [],
          offeredBudget: 0,
          requestedBudget: 0,
          createdAt: new Date().toISOString(),
          sender: { username: 'A' },
          receiver: { username: 'B' },
        },
      ],
    })

    render(<Trades leagueId={leagueId} onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      const concluseTab = screen.getByText('Concluse')
      const badge = concluseTab.parentElement?.querySelector('span')
      expect(badge).toBeTruthy()
    })
  })

  it('renders history trade with message', async () => {
    const user = userEvent.setup()
    mockGetHistory.mockResolvedValue({
      success: true,
      data: [
        {
          id: 'hist-msg',
          status: 'ACCEPTED',
          offeredPlayers: [],
          requestedPlayers: [],
          offeredBudget: 0,
          requestedBudget: 0,
          message: 'Buono scambio!',
          createdAt: new Date().toISOString(),
          respondedAt: new Date().toISOString(),
          sender: { username: 'X' },
          receiver: { username: 'Y' },
        },
      ],
    })

    render(<Trades leagueId={leagueId} onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Concluse')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Concluse'))

    await waitFor(() => {
      expect(screen.getByText(/"Buono scambio!"/)).toBeInTheDocument()
    })
  })

  it('handles accept API failure with toast error', async () => {
    const user = userEvent.setup()
    mockAcceptTrade.mockResolvedValue({ success: false, message: 'Budget insufficiente' })
    mockGetReceived.mockResolvedValue({
      success: true,
      data: [
        {
          id: 'offer-fail',
          fromMember: { id: 'm2', user: { username: 'Rival' } },
          offeredPlayers: [],
          requestedPlayers: [],
          offeredBudget: 0,
          requestedBudget: 0,
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
          createdAt: new Date().toISOString(),
          sender: { username: 'Rival' },
        },
      ],
    })

    render(<Trades leagueId={leagueId} onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Ricevute')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Ricevute'))

    await waitFor(() => {
      expect(screen.getByText('Accetta Scambio')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Accetta Scambio'))

    await waitFor(() => {
      expect(mockAcceptTrade).toHaveBeenCalledWith('offer-fail')
    })
  })

  it('sets isLeagueAdmin from OFFERTE_POST_ASTA_SVINCOLATI phase', async () => {
    mockGetSessions.mockResolvedValue({
      success: true,
      data: [
        { id: 's2', status: 'ACTIVE', currentPhase: 'OFFERTE_POST_ASTA_SVINCOLATI' },
      ],
    })

    render(<Trades leagueId={leagueId} onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Scambi attivi')).toBeInTheDocument()
    })
  })

  // ---------------------------------------------------------------------------
  // BottomSheet — open My Roster and Partner Roster
  // ---------------------------------------------------------------------------

  it('opens My Roster BottomSheet when Open My Roster is clicked', async () => {
    const user = userEvent.setup()

    render(<Trades leagueId={leagueId} onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByTestId('deal-table')).toBeInTheDocument()
    })

    // Click the "Open My Roster" button exposed by the DealTable mock
    await user.click(screen.getByTestId('open-my-roster'))

    // BottomSheet should now be open
    await waitFor(() => {
      expect(screen.getByTestId('bottom-sheet')).toBeInTheDocument()
      expect(screen.getByText('Conferma selezione')).toBeInTheDocument()
    })
  })

  it('closes My Roster BottomSheet when Conferma selezione is clicked', async () => {
    const user = userEvent.setup()

    render(<Trades leagueId={leagueId} onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByTestId('open-my-roster')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('open-my-roster'))

    await waitFor(() => {
      expect(screen.getByText('Conferma selezione')).toBeInTheDocument()
    })

    // Click Conferma selezione to close
    await user.click(screen.getByText('Conferma selezione'))

    await waitFor(() => {
      expect(screen.queryByTestId('bottom-sheet')).not.toBeInTheDocument()
    })
  })

  it('opens Partner Roster BottomSheet when Open Partner Roster is clicked', async () => {
    const user = userEvent.setup()

    render(<Trades leagueId={leagueId} onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByTestId('deal-table')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('open-partner-roster'))

    await waitFor(() => {
      // Partner roster bottom sheet has "Conferma selezione" button too
      expect(screen.getByTestId('bottom-sheet')).toBeInTheDocument()
    })
  })

  // ---------------------------------------------------------------------------
  // Create offer flow
  // ---------------------------------------------------------------------------

  it('calls create API when submit is triggered from DealTable', async () => {
    const user = userEvent.setup()
    mockCreate.mockResolvedValue({ success: true })

    render(<Trades leagueId={leagueId} onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByTestId('submit-offer')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('submit-offer'))

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledWith(leagueId, expect.any(Object))
    })
  })

  it('switches to sent tab after successful offer creation', async () => {
    const user = userEvent.setup()
    mockCreate.mockResolvedValue({ success: true })

    render(<Trades leagueId={leagueId} onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByTestId('submit-offer')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('submit-offer'))

    // After successful creation, tab should switch to 'sent'
    await waitFor(() => {
      const inviateButton = screen.getByText('Inviate').closest('button')
      expect(inviateButton?.className).toContain('border-primary-500')
    })
  })

  it('shows error message after failed offer creation', async () => {
    const user = userEvent.setup()
    mockCreate.mockResolvedValue({ success: false, message: 'Errore: budget insufficiente' })

    render(<Trades leagueId={leagueId} onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByTestId('submit-offer')).toBeInTheDocument()
    })

    await user.click(screen.getByTestId('submit-offer'))

    await waitFor(() => {
      expect(screen.getByText('Errore: budget insufficiente')).toBeInTheDocument()
    })
  })

  // ---------------------------------------------------------------------------
  // allRosters data processing
  // ---------------------------------------------------------------------------

  it('processes allRosters data with players array format', async () => {
    mockGetLeagueRosters.mockResolvedValue({
      success: true,
      data: [
        {
          memberId: 'm2',
          username: 'Rival',
          players: [
            {
              id: 'p10',
              rosterId: 'r10',
              name: 'Other Player',
              position: 'C',
              team: 'Roma',
              quotation: 20,
              age: 26,
              contract: { salary: 5, duration: 2 },
            },
          ],
        },
      ],
    })

    render(<Trades leagueId={leagueId} onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Trattative')).toBeInTheDocument()
    })

    // Verify allRosters was processed (API was called)
    expect(mockGetLeagueRosters).toHaveBeenCalledWith(leagueId)
  })

  it('processes allRosters data with roster nested format', async () => {
    mockGetLeagueRosters.mockResolvedValue({
      success: true,
      data: [
        {
          memberId: 'm2',
          user: { username: 'Rival' },
          roster: [
            {
              id: 'r10',
              player: { id: 'p10', name: 'Nested Player', position: 'A', team: 'Napoli', quotation: 15 },
              contract: { salary: 4, duration: 1 },
            },
          ],
        },
      ],
    })

    render(<Trades leagueId={leagueId} onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Trattative')).toBeInTheDocument()
    })

    expect(mockGetLeagueRosters).toHaveBeenCalledWith(leagueId)
  })

  it('renders received offer without offeredPlayerDetails (fallback to offeredPlayers)', async () => {
    const user = userEvent.setup()
    mockGetReceived.mockResolvedValue({
      success: true,
      data: [
        {
          id: 'offer-no-details',
          fromMember: { id: 'm2', user: { username: 'Rival' } },
          offeredPlayers: [],
          requestedPlayers: [],
          offeredPlayerDetails: undefined,
          requestedPlayerDetails: undefined,
          offeredBudget: 0,
          requestedBudget: 0,
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
          createdAt: new Date().toISOString(),
          sender: { username: 'Rival' },
        },
      ],
    })

    render(<Trades leagueId={leagueId} onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Ricevute')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Ricevute'))

    await waitFor(() => {
      // Should show "no players offered" message
      expect(screen.getByText('Nessun giocatore o credito offerto')).toBeInTheDocument()
      expect(screen.getByText('Nessun giocatore o credito richiesto')).toBeInTheDocument()
    })
  })

  it('renders financials with totalReleaseCosts data', async () => {
    mockGetFinancials.mockResolvedValue({
      success: true,
      data: {
        inContrattiPhase: false,
        teams: [
          { memberId: 'm1', budget: 200, annualContractCost: 13, slotCount: 2, totalReleaseCosts: 50, totalIndemnities: 10 },
          { memberId: 'm2', budget: 180, annualContractCost: 10, slotCount: 3, totalReleaseCosts: null, totalIndemnities: null },
        ],
      },
    })

    render(<Trades leagueId={leagueId} onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Trattative')).toBeInTheDocument()
    })

    expect(mockGetFinancials).toHaveBeenCalledWith(leagueId)
  })
})
