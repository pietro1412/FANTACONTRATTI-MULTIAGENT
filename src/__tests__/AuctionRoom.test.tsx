import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuctionRoom } from '../pages/AuctionRoom'

// Mock useAuth
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user1', username: 'TestUser', email: 'test@test.it', role: 'MANAGER' },
    isAuthenticated: true,
    isLoading: false,
    logout: vi.fn(),
  }),
}))

// Mock Toast
vi.mock('../components/ui/Toast', () => ({
  useToast: () => ({
    toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
  }),
}))

// Mock ConfirmDialog
vi.mock('@/components/ui/ConfirmDialog', () => ({
  useConfirmDialog: () => ({ confirm: vi.fn().mockResolvedValue(true) }),
}))

// Mock Navigation
vi.mock('../components/Navigation', () => ({
  Navigation: ({ currentPage }: { currentPage: string }) => (
    <nav data-testid="navigation" data-page={currentPage}>Navigation</nav>
  ),
}))

// Mock Button
vi.mock('../components/ui/Button', () => ({
  Button: ({ children, onClick, disabled, className, ...props }: React.ComponentProps<'button'>) => (
    <button onClick={onClick} disabled={disabled} className={className} {...props}>{children}</button>
  ),
}))

// Mock PositionBadge
vi.mock('../components/ui/PositionBadge', () => ({
  POSITION_GRADIENTS: {
    P: 'from-amber-500 to-amber-600',
    D: 'from-blue-500 to-blue-600',
    C: 'from-emerald-500 to-emerald-600',
    A: 'from-red-500 to-red-600',
  },
  POSITION_FILTER_COLORS: {},
}))

// Mock dnd-kit - replicate tree-shakeable exports
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <div data-testid="dnd-context">{children}</div>,
  closestCenter: vi.fn(),
}))

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <div data-testid="sortable-context">{children}</div>,
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
  verticalListSortingStrategy: {},
}))

vi.mock('@dnd-kit/utilities', () => ({
  CSS: {
    Transform: {
      toString: () => undefined,
    },
  },
}))

// Mock ContractModifier
vi.mock('../components/ContractModifier', () => ({
  ContractModifierModal: ({ isOpen }: { isOpen: boolean }) => (
    isOpen ? <div data-testid="contract-modifier-modal">ContractModifierModal</div> : null
  ),
}))

// Mock AuctionRoomLayout
vi.mock('../components/auction-room-v2', () => ({
  AuctionRoomLayout: ({ auction, isAdmin }: { auction: unknown; isAdmin: boolean }) => (
    <div data-testid="auction-room-layout" data-admin={String(isAdmin)} data-has-auction={String(!!auction)}>
      AuctionRoomLayout
    </div>
  ),
}))

// Mock auction-room modal components
vi.mock('../components/auction-room', () => ({
  ManagerDetailModal: ({ selectedManager }: { selectedManager: unknown }) => (
    selectedManager ? <div data-testid="manager-detail-modal">ManagerDetailModal</div> : null
  ),
  AcknowledgmentModal: ({ pendingAck }: { pendingAck: unknown }) => (
    pendingAck ? <div data-testid="acknowledgment-modal">AcknowledgmentModal</div> : null
  ),
  WaitingModal: ({ pendingAck }: { pendingAck: unknown }) => (
    pendingAck ? <div data-testid="waiting-modal">WaitingModal</div> : null
  ),
  AppealReviewModal: () => null,
  AppealAckModal: () => null,
  AwaitingResumeModal: () => null,
}))

// Mock useAuctionRoomState
const mockUseAuctionRoomState = vi.fn()
vi.mock('../hooks/useAuctionRoomState', () => ({
  useAuctionRoomState: (...args: unknown[]) => mockUseAuctionRoomState(...args),
}))

// Default state returned by the hook
function createDefaultHookState(overrides: Record<string, unknown> = {}) {
  return {
    auction: { id: 'auction1', status: 'ACTIVE', currentPlayerId: null },
    membership: { id: 'm1', role: 'MEMBER' },
    players: [],
    bidAmount: 10,
    setBidAmount: vi.fn(),
    searchQuery: '',
    setSearchQuery: vi.fn(),
    selectedTeam: '',
    setSelectedTeam: vi.fn(),
    availableTeams: ['Inter', 'Milan'],
    teamDropdownOpen: false,
    setTeamDropdownOpen: vi.fn(),
    isLoading: false,
    error: '',
    successMessage: '',
    marketProgress: { completed: 5, total: 20, percentage: 25 },
    timeLeft: 30,
    timerSetting: 60,
    firstMarketStatus: null,
    turnOrderDraft: [],
    readyStatus: null,
    markingReady: false,
    pendingAck: null,
    prophecyContent: '',
    setProphecyContent: vi.fn(),
    ackSubmitting: false,
    isAppealMode: false,
    setIsAppealMode: vi.fn(),
    appealContent: '',
    setAppealContent: vi.fn(),
    myRosterSlots: { P: 0, D: 0, C: 0, A: 0 },
    managersStatus: [],
    selectedManager: null,
    setSelectedManager: vi.fn(),
    appealStatus: null,
    pendingContractModification: null,
    isAdmin: false,
    isPrimoMercato: false,
    hasTurnOrder: true,
    isMyTurn: false,
    currentTurnManager: null,
    isUserWinning: false,
    isTimerExpired: false,
    currentUsername: 'TestUser',
    connectionStatus: 'connected',
    isConnected: true,
    sensors: [],
    handleDragEnd: vi.fn(),
    handleSetTurnOrder: vi.fn(),
    handleNominatePlayer: vi.fn(),
    handleConfirmNomination: vi.fn(),
    handleCancelNomination: vi.fn(),
    handleMarkReady: vi.fn(),
    handleForceAllReady: vi.fn(),
    handleBotBid: vi.fn(),
    handleBotNominate: vi.fn(),
    handleBotConfirmNomination: vi.fn(),
    handleForceAcknowledgeAll: vi.fn(),
    handleSimulateAppeal: vi.fn(),
    handleAcknowledgeAppealDecision: vi.fn(),
    handleReadyToResume: vi.fn(),
    handleForceAllAppealAcks: vi.fn(),
    handleForceAllReadyResume: vi.fn(),
    handleResetFirstMarket: vi.fn(),
    handleRequestPause: vi.fn(),
    handlePauseAuction: vi.fn(),
    handleResumeAuction: vi.fn(),
    pauseRequest: null,
    dismissPauseRequest: vi.fn(),
    handleCompleteAllSlots: vi.fn(),
    handlePlaceBid: vi.fn(),
    handleCloseAuction: vi.fn(),
    isBidding: false,
    handleUpdateTimer: vi.fn(),
    handleAcknowledge: vi.fn(),
    handleContractModification: vi.fn(),
    handleSkipContractModification: vi.fn(),
    ...overrides,
  }
}

describe('AuctionRoom', () => {
  const mockOnNavigate = vi.fn()
  const defaultProps = {
    sessionId: 'session1',
    leagueId: 'league1',
    onNavigate: mockOnNavigate,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuctionRoomState.mockReturnValue(createDefaultHookState())
  })

  it('shows loading spinner when isLoading is true', () => {
    mockUseAuctionRoomState.mockReturnValue(createDefaultHookState({ isLoading: true }))
    render(<AuctionRoom {...defaultProps} />)
    expect(screen.getByText('Caricamento sala asta...')).toBeInTheDocument()
  })

  it('renders AuctionRoomLayout when loaded and has turn order', () => {
    render(<AuctionRoom {...defaultProps} />)
    expect(screen.getByTestId('auction-room-layout')).toBeInTheDocument()
  })

  it('renders Navigation with correct currentPage', () => {
    render(<AuctionRoom {...defaultProps} />)
    expect(screen.getByTestId('navigation')).toHaveAttribute('data-page', 'auction')
  })

  it('shows error message when error state is set', () => {
    mockUseAuctionRoomState.mockReturnValue(createDefaultHookState({
      error: 'Errore di connessione',
    }))
    render(<AuctionRoom {...defaultProps} />)
    expect(screen.getByText('Errore di connessione')).toBeInTheDocument()
  })

  it('shows success message when successMessage state is set', () => {
    mockUseAuctionRoomState.mockReturnValue(createDefaultHookState({
      successMessage: 'Offerta piazzata con successo!',
    }))
    render(<AuctionRoom {...defaultProps} />)
    expect(screen.getByText('Offerta piazzata con successo!')).toBeInTheDocument()
  })

  it('shows turn order setup for admin in primo mercato without turn order', () => {
    mockUseAuctionRoomState.mockReturnValue(createDefaultHookState({
      isPrimoMercato: true,
      hasTurnOrder: false,
      isAdmin: true,
      firstMarketStatus: {
        memberStatus: [
          { memberId: 'm1', username: 'User1', teamName: 'Team1' },
          { memberId: 'm2', username: 'User2', teamName: 'Team2' },
        ],
      },
      turnOrderDraft: ['m1', 'm2'],
    }))
    render(<AuctionRoom {...defaultProps} />)
    expect(screen.getByText('Ordine di Chiamata')).toBeInTheDocument()
    expect(screen.getByText('Conferma e Inizia Aste')).toBeInTheDocument()
  })

  it('shows waiting state for non-admin in primo mercato without turn order', () => {
    mockUseAuctionRoomState.mockReturnValue(createDefaultHookState({
      isPrimoMercato: true,
      hasTurnOrder: false,
      isAdmin: false,
    }))
    render(<AuctionRoom {...defaultProps} />)
    expect(screen.getByText('Sala Riunioni')).toBeInTheDocument()
    expect(screen.getByText("L'admin sta definendo l'ordine dei turni...")).toBeInTheDocument()
  })

  it('renders drag-and-drop turn order list for admin', () => {
    mockUseAuctionRoomState.mockReturnValue(createDefaultHookState({
      isPrimoMercato: true,
      hasTurnOrder: false,
      isAdmin: true,
      firstMarketStatus: {
        memberStatus: [
          { memberId: 'm1', username: 'User1', teamName: 'Team1' },
          { memberId: 'm2', username: 'User2', teamName: 'Team2' },
        ],
      },
      turnOrderDraft: ['m1', 'm2'],
    }))
    render(<AuctionRoom {...defaultProps} />)
    expect(screen.getByTestId('dnd-context')).toBeInTheDocument()
    expect(screen.getByText('User1')).toBeInTheDocument()
    expect(screen.getByText('User2')).toBeInTheDocument()
  })

  it('passes isAdmin to AuctionRoomLayout', () => {
    mockUseAuctionRoomState.mockReturnValue(createDefaultHookState({ isAdmin: true }))
    render(<AuctionRoom {...defaultProps} />)
    expect(screen.getByTestId('auction-room-layout')).toHaveAttribute('data-admin', 'true')
  })

  it('shows back to league link in turn order setup', async () => {
    const user = userEvent.setup()
    mockUseAuctionRoomState.mockReturnValue(createDefaultHookState({
      isPrimoMercato: true,
      hasTurnOrder: false,
      isAdmin: true,
      firstMarketStatus: {
        memberStatus: [
          { memberId: 'm1', username: 'User1', teamName: 'Team1' },
        ],
      },
      turnOrderDraft: ['m1'],
    }))
    render(<AuctionRoom {...defaultProps} />)

    const backLink = screen.getByText('Torna alla lega')
    await user.click(backLink)
    expect(mockOnNavigate).toHaveBeenCalledWith('leagueDetail', { leagueId: 'league1' })
  })

  it('shows participant count in turn order setup', () => {
    mockUseAuctionRoomState.mockReturnValue(createDefaultHookState({
      isPrimoMercato: true,
      hasTurnOrder: false,
      isAdmin: true,
      firstMarketStatus: {
        memberStatus: [
          { memberId: 'm1', username: 'User1', teamName: 'Team1' },
          { memberId: 'm2', username: 'User2', teamName: 'Team2' },
          { memberId: 'm3', username: 'User3', teamName: 'Team3' },
        ],
      },
      turnOrderDraft: ['m1', 'm2', 'm3'],
    }))
    render(<AuctionRoom {...defaultProps} />)
    expect(screen.getByText('3 partecipanti')).toBeInTheDocument()
  })

  it('calls handleSetTurnOrder when confirm button is clicked', async () => {
    const user = userEvent.setup()
    const mockHandleSetTurnOrder = vi.fn()
    mockUseAuctionRoomState.mockReturnValue(createDefaultHookState({
      isPrimoMercato: true,
      hasTurnOrder: false,
      isAdmin: true,
      handleSetTurnOrder: mockHandleSetTurnOrder,
      firstMarketStatus: {
        memberStatus: [
          { memberId: 'm1', username: 'User1', teamName: 'Team1' },
        ],
      },
      turnOrderDraft: ['m1'],
    }))
    render(<AuctionRoom {...defaultProps} />)

    await user.click(screen.getByText('Conferma e Inizia Aste'))
    expect(mockHandleSetTurnOrder).toHaveBeenCalled()
  })

  it('does not show ContractModifierModal when no pending modification', () => {
    render(<AuctionRoom {...defaultProps} />)
    expect(screen.queryByTestId('contract-modifier-modal')).not.toBeInTheDocument()
  })

  it('shows ContractModifierModal when there is a pending modification', () => {
    mockUseAuctionRoomState.mockReturnValue(createDefaultHookState({
      pendingContractModification: {
        playerId: 'p1',
        playerName: 'Lautaro Martinez',
        playerTeam: 'Inter',
        playerPosition: 'A',
        salary: 10,
        duration: 3,
        initialSalary: 10,
        rescissionClause: 30,
      },
    }))
    render(<AuctionRoom {...defaultProps} />)
    expect(screen.getByTestId('contract-modifier-modal')).toBeInTheDocument()
  })
})
