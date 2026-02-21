import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ---------------------------------------------------------------------------
// Mocks — must come before component imports
// ---------------------------------------------------------------------------

// Mock useAuth
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user1', name: 'Test User', email: 'test@test.it', role: 'MANAGER' },
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
  Button: ({ children, onClick, disabled, ...props }: React.ComponentProps<'button'>) => (
    <button onClick={onClick} disabled={disabled} {...props}>{children}</button>
  ),
}))

// Mock Input
vi.mock('../components/ui/Input', () => ({
  Input: ({ ...props }: React.ComponentProps<'input'>) => <input {...props} />,
}))

// Mock ContractModifierModal
vi.mock('../components/ContractModifier', () => ({
  ContractModifierModal: () => <div data-testid="contract-modifier-modal">ContractModifier</div>,
}))

// Mock dnd-kit
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <div data-testid="dnd-context">{children}</div>,
  closestCenter: vi.fn(),
  PointerSensor: vi.fn(),
  KeyboardSensor: vi.fn(),
  useSensor: vi.fn(),
  useSensors: vi.fn().mockReturnValue([]),
}))

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <div data-testid="sortable-context">{children}</div>,
  verticalListSortingStrategy: 'vertical',
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
  sortableKeyboardCoordinates: vi.fn(),
  arrayMove: vi.fn(),
}))

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => '' } },
}))

// Mock team logos
vi.mock('../utils/teamLogos', () => ({
  getTeamLogo: (team: string) => `https://logos/${team}`,
}))

// Mock types
vi.mock('../types/svincolati.types', async () => {
  const actual = await vi.importActual('../types/svincolati.types') as Record<string, unknown>
  return {
    ...actual,
    POSITION_COLORS: { P: 'from-yellow to-yellow', D: 'from-green to-green', C: 'from-blue to-blue', A: 'from-red to-red' },
    POSITION_BG: { P: 'bg-yellow', D: 'bg-green', C: 'bg-blue', A: 'bg-red' },
    SERIE_A_TEAMS: ['Juventus', 'Milan', 'Inter', 'Napoli'],
  }
})

// Mock Pusher
vi.mock('../services/pusher.client', () => ({
  usePusherAuction: vi.fn().mockReturnValue({ isConnected: true }),
}))

// Mock API
vi.mock('../services/api', () => ({
  svincolatiApi: {
    getBoard: vi.fn().mockResolvedValue({ success: true, data: null }),
    getFreeAgents: vi.fn().mockResolvedValue({ success: true, data: [] }),
  },
  leagueApi: {
    getById: vi.fn().mockResolvedValue({ success: true, data: { id: 'league1', name: 'Test League' } }),
  },
  auctionApi: {
    getActive: vi.fn().mockResolvedValue({ success: true, data: null }),
  },
  contractApi: {
    modify: vi.fn().mockResolvedValue({ success: true }),
  },
}))

// The central hook mock
const mockLoadBoard = vi.fn()
const mockSetError = vi.fn()
const mockHandleSetTurnOrder = vi.fn()
const mockHandleBid = vi.fn()
const mockHandleNominate = vi.fn()
const mockHandleConfirmNomination = vi.fn()
const mockHandleCancelNomination = vi.fn()
const mockHandlePassTurn = vi.fn()
const mockHandleMarkReady = vi.fn()
const mockHandleDeclareFinished = vi.fn()
const mockHandlePause = vi.fn()
const mockHandleSetTimer = vi.fn()

const defaultHookReturn = {
  isLoading: false,
  board: null as unknown,
  freeAgents: [] as Array<{ id: string; name: string; team: string; position: string; quotation: number }>,
  searchQuery: '',
  setSearchQuery: vi.fn(),
  selectedPosition: '',
  setSelectedPosition: vi.fn(),
  selectedTeam: '',
  setSelectedTeam: vi.fn(),
  teamDropdownOpen: false,
  setTeamDropdownOpen: vi.fn(),
  teamDropdownRef: { current: null },
  turnOrderDraft: [] as Array<{ id: string; username: string; budget: number }>,
  bidAmount: '',
  setBidAmount: vi.fn(),
  timerRemaining: null as number | null,
  error: '',
  success: '',
  isSubmitting: false,
  timerInput: 30,
  setTimerInput: vi.fn(),
  isAppealMode: false,
  setIsAppealMode: vi.fn(),
  appealContent: '',
  setAppealContent: vi.fn(),
  appealStatus: null,
  ackSubmitting: false,
  userHasAcked: false,
  showFinishConfirmModal: false,
  setShowFinishConfirmModal: vi.fn(),
  pendingContractModification: null,
  selectedManager: null,
  setSelectedManager: vi.fn(),
  loadingManager: false,
  isPusherConnected: true,
  isTimerExpired: false,
  currentUsername: 'TestUser',
  isUserWinning: false,
  getTimerClass: () => 'text-4xl font-bold text-white',
  handleDndDragEnd: vi.fn(),
  handleDndDragStart: vi.fn(),
  handleSetTurnOrder: mockHandleSetTurnOrder,
  handleViewManagerRoster: vi.fn(),
  handleNominate: mockHandleNominate,
  handleConfirmNomination: mockHandleConfirmNomination,
  handleCancelNomination: mockHandleCancelNomination,
  handlePassTurn: mockHandlePassTurn,
  handleDeclareFinished: mockHandleDeclareFinished,
  confirmDeclareFinished: vi.fn(),
  handleForceAllFinished: vi.fn(),
  handleMarkReady: mockHandleMarkReady,
  handleForceReady: vi.fn(),
  handleBid: mockHandleBid,
  handleCloseAuction: vi.fn(),
  handleAcknowledge: vi.fn(),
  handleForceAck: vi.fn(),
  handleContractModification: vi.fn(),
  handleSkipContractModification: vi.fn(),
  handleSimulateAppeal: vi.fn(),
  handleAcknowledgeAppealDecision: vi.fn(),
  handleReadyToResume: vi.fn(),
  handleForceAllAppealAcks: vi.fn(),
  handleForceAllReadyResume: vi.fn(),
  handlePause: mockHandlePause,
  handleResume: vi.fn(),
  handleSetTimer: mockHandleSetTimer,
  handleCompletePhase: vi.fn(),
  handleBotNominate: vi.fn(),
  handleBotConfirmNomination: vi.fn(),
  handleBotBid: vi.fn(),
  setError: mockSetError,
  loadBoard: mockLoadBoard,
}

let hookOverrides: Partial<typeof defaultHookReturn> = {}

vi.mock('../hooks/useSvincolatiState', () => ({
  useSvincolatiState: () => ({ ...defaultHookReturn, ...hookOverrides }),
}))

import { Svincolati } from '../pages/Svincolati'

describe('Svincolati', () => {
  const mockOnNavigate = vi.fn()
  const leagueId = 'league1'

  beforeEach(() => {
    vi.clearAllMocks()
    hookOverrides = {}
  })

  // ---- Loading state ----
  it('renders loading spinner when isLoading is true', () => {
    hookOverrides = { isLoading: true }

    render(<Svincolati leagueId={leagueId} onNavigate={mockOnNavigate} />)

    expect(screen.getByText('Caricamento sala asta svincolati...')).toBeInTheDocument()
    const spinner = document.querySelector('.animate-spin')
    expect(spinner).toBeTruthy()
  })

  // ---- Phase not active: free agents read-only view ----
  it('shows free agents read-only view when board is not active', () => {
    hookOverrides = {
      board: { isActive: false, isAdmin: false, state: 'SETUP' } as never,
      freeAgents: [
        { id: 'p1', name: 'Mario Rossi', team: 'Juventus', position: 'A', quotation: 25 },
        { id: 'p2', name: 'Luigi Bianchi', team: 'Milan', position: 'D', quotation: 15 },
      ],
    }

    render(<Svincolati leagueId={leagueId} onNavigate={mockOnNavigate} />)

    expect(screen.getByText('Giocatori Svincolati')).toBeInTheDocument()
    expect(screen.getByText('Giocatori attualmente non in rosa')).toBeInTheDocument()
    expect(screen.getByText('Mario Rossi')).toBeInTheDocument()
    expect(screen.getByText('Luigi Bianchi')).toBeInTheDocument()
    expect(screen.getByText('Giocatori Liberi (2)')).toBeInTheDocument()
  })

  // ---- Free agents empty with filters ----
  it('shows "Nessun giocatore trovato" when free agents list is empty and board not active', () => {
    hookOverrides = {
      board: { isActive: false, isAdmin: false, state: 'SETUP' } as never,
      freeAgents: [],
    }

    render(<Svincolati leagueId={leagueId} onNavigate={mockOnNavigate} />)

    expect(screen.getByText('Nessun giocatore trovato con i filtri selezionati')).toBeInTheDocument()
  })

  // ---- Admin: Setup phase - Turn order ----
  it('shows turn order setup UI for admin during SETUP state', () => {
    hookOverrides = {
      board: { isActive: true, isAdmin: true, state: 'SETUP' } as never,
      turnOrderDraft: [
        { id: 'm1', username: 'Player1', budget: 200 },
        { id: 'm2', username: 'Player2', budget: 150 },
      ],
    }

    render(<Svincolati leagueId={leagueId} onNavigate={mockOnNavigate} />)

    expect(screen.getByText('Asta Svincolati - Ordine Turni')).toBeInTheDocument()
    expect(screen.getByText(/Trascina i Direttori Generali/)).toBeInTheDocument()
    expect(screen.getByText('Player1')).toBeInTheDocument()
    expect(screen.getByText('Player2')).toBeInTheDocument()
    expect(screen.getByText('Conferma e Inizia Aste')).toBeInTheDocument()
    expect(screen.getByText('2 partecipanti')).toBeInTheDocument()
  })

  // ---- Admin: Confirm turn order ----
  it('calls handleSetTurnOrder when "Conferma e Inizia Aste" is clicked', async () => {
    const user = userEvent.setup()
    hookOverrides = {
      board: { isActive: true, isAdmin: true, state: 'SETUP' } as never,
      turnOrderDraft: [{ id: 'm1', username: 'Player1', budget: 200 }],
    }

    render(<Svincolati leagueId={leagueId} onNavigate={mockOnNavigate} />)

    await user.click(screen.getByText('Conferma e Inizia Aste'))
    expect(mockHandleSetTurnOrder).toHaveBeenCalled()
  })

  // ---- Admin: Empty turn order shows message ----
  it('shows "Nessun manager trovato" when turnOrderDraft is empty', () => {
    hookOverrides = {
      board: { isActive: true, isAdmin: true, state: 'SETUP' } as never,
      turnOrderDraft: [],
    }

    render(<Svincolati leagueId={leagueId} onNavigate={mockOnNavigate} />)

    expect(screen.getByText('Nessun manager trovato')).toBeInTheDocument()
  })

  // ---- Non-admin: Setup waiting ----
  it('shows waiting message for non-admin during SETUP state', () => {
    hookOverrides = {
      board: { isActive: true, isAdmin: false, state: 'SETUP' } as never,
    }

    render(<Svincolati leagueId={leagueId} onNavigate={mockOnNavigate} />)

    expect(screen.getByText('Sala Riunioni Svincolati')).toBeInTheDocument()
    expect(screen.getByText(/L'admin sta definendo l'ordine dei turni/)).toBeInTheDocument()
  })

  // ---- Auction room: Header and budget shown ----
  it('renders the auction room header with budget when board is active and past setup', () => {
    hookOverrides = {
      board: {
        isActive: true,
        isAdmin: false,
        state: 'READY_CHECK',
        isMyTurn: false,
        currentTurnUsername: 'OtherUser',
        myBudget: 250,
        turnOrder: [],
        readyMembers: [],
        pendingPlayer: null,
        finishedMembers: [],
        isFinished: false,
        myMemberId: 'member1',
      } as never,
    }

    render(<Svincolati leagueId={leagueId} onNavigate={mockOnNavigate} />)

    expect(screen.getByText('Asta Svincolati')).toBeInTheDocument()
    expect(screen.getByText('250')).toBeInTheDocument()
    expect(screen.getByText('Budget')).toBeInTheDocument()
    // OtherUser appears in both the turn banner and the waiting text
    expect(screen.getAllByText(/OtherUser/).length).toBeGreaterThanOrEqual(1)
  })

  // ---- My Turn: Player selection shown ----
  it('shows player selection UI when it is my turn during READY_CHECK', () => {
    hookOverrides = {
      board: {
        isActive: true,
        isAdmin: false,
        state: 'READY_CHECK',
        isMyTurn: true,
        currentTurnUsername: 'TestUser',
        myBudget: 200,
        turnOrder: [],
        readyMembers: [],
        pendingPlayer: null,
        finishedMembers: [],
        isFinished: false,
        myMemberId: 'member1',
      } as never,
      freeAgents: [
        { id: 'p1', name: 'Mario Rossi', team: 'Juventus', position: 'A', quotation: 25 },
      ],
    }

    render(<Svincolati leagueId={leagueId} onNavigate={mockOnNavigate} />)

    // "IL TUO TURNO" appears in both the turn banner and the selection panel
    expect(screen.getAllByText(/il tuo turno/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Mario Rossi')).toBeInTheDocument()
    expect(screen.getByText(/Passo \(non chiamo più\)/)).toBeInTheDocument()
  })

  // ---- Not my turn: Waiting ----
  it('shows waiting message when it is not my turn during READY_CHECK', () => {
    hookOverrides = {
      board: {
        isActive: true,
        isAdmin: false,
        state: 'READY_CHECK',
        isMyTurn: false,
        currentTurnUsername: 'OtherUser',
        myBudget: 200,
        turnOrder: [],
        readyMembers: [],
        pendingPlayer: null,
        finishedMembers: [],
        isFinished: false,
        myMemberId: 'member1',
      } as never,
    }

    render(<Svincolati leagueId={leagueId} onNavigate={mockOnNavigate} />)

    expect(screen.getByText('In attesa...')).toBeInTheDocument()
  })

  // ---- Completed state ----
  it('shows completed message when state is COMPLETED', () => {
    hookOverrides = {
      board: {
        isActive: true,
        isAdmin: false,
        state: 'COMPLETED',
        myBudget: 200,
        turnOrder: [],
        readyMembers: [],
        finishedMembers: [],
        isFinished: false,
        myMemberId: 'member1',
      } as never,
    }

    render(<Svincolati leagueId={leagueId} onNavigate={mockOnNavigate} />)

    expect(screen.getByText('Fase Svincolati Completata!')).toBeInTheDocument()
    expect(screen.getByText('Tutti i manager hanno terminato le chiamate.')).toBeInTheDocument()
  })

  // ---- Error display and retry ----
  it('displays error message with retry button in auction room', async () => {
    const user = userEvent.setup()
    hookOverrides = {
      board: {
        isActive: true,
        isAdmin: false,
        state: 'READY_CHECK',
        isMyTurn: false,
        currentTurnUsername: 'Other',
        myBudget: 200,
        turnOrder: [],
        readyMembers: [],
        pendingPlayer: null,
        finishedMembers: [],
        isFinished: false,
        myMemberId: 'member1',
      } as never,
      error: 'Something went wrong',
    }

    render(<Svincolati leagueId={leagueId} onNavigate={mockOnNavigate} />)

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    await user.click(screen.getByText('Riprova'))
    expect(mockSetError).toHaveBeenCalledWith('')
    expect(mockLoadBoard).toHaveBeenCalled()
  })

  // ---- Error display in setup phase ----
  it('displays error message and retry in setup phase', async () => {
    const user = userEvent.setup()
    hookOverrides = {
      board: { isActive: true, isAdmin: true, state: 'SETUP' } as never,
      turnOrderDraft: [],
      error: 'Setup error',
    }

    render(<Svincolati leagueId={leagueId} onNavigate={mockOnNavigate} />)

    expect(screen.getByText('Setup error')).toBeInTheDocument()
    await user.click(screen.getByText('Riprova'))
    expect(mockSetError).toHaveBeenCalledWith('')
    expect(mockLoadBoard).toHaveBeenCalled()
  })

  // ---- Timer setting in setup ----
  it('renders timer setting controls in admin setup view', () => {
    hookOverrides = {
      board: { isActive: true, isAdmin: true, state: 'SETUP' } as never,
      turnOrderDraft: [{ id: 'm1', username: 'Player1', budget: 200 }],
      timerInput: 30,
    }

    render(<Svincolati leagueId={leagueId} onNavigate={mockOnNavigate} />)

    expect(screen.getByText('Timer Asta')).toBeInTheDocument()
    expect(screen.getByText('30')).toBeInTheDocument()
    expect(screen.getByText('secondi')).toBeInTheDocument()
    expect(screen.getByText('Imposta Timer')).toBeInTheDocument()
  })

  // ---- Set Timer handler ----
  it('calls handleSetTimer when "Imposta Timer" is clicked', async () => {
    const user = userEvent.setup()
    hookOverrides = {
      board: { isActive: true, isAdmin: true, state: 'SETUP' } as never,
      turnOrderDraft: [{ id: 'm1', username: 'Player1', budget: 200 }],
    }

    render(<Svincolati leagueId={leagueId} onNavigate={mockOnNavigate} />)

    await user.click(screen.getByText('Imposta Timer'))
    expect(mockHandleSetTimer).toHaveBeenCalled()
  })

  // ---- Back to league link in setup ----
  it('renders "Torna alla lega" link in setup view', async () => {
    const user = userEvent.setup()
    hookOverrides = {
      board: { isActive: true, isAdmin: true, state: 'SETUP' } as never,
      turnOrderDraft: [],
    }

    render(<Svincolati leagueId={leagueId} onNavigate={mockOnNavigate} />)

    const backLink = screen.getByText('Torna alla lega')
    expect(backLink).toBeInTheDocument()
    await user.click(backLink)
    expect(mockOnNavigate).toHaveBeenCalledWith('leagueDetail', { leagueId })
  })

  // ===========================================================================
  // NEW TESTS — Expanding coverage to 50%+
  // ===========================================================================

  // Helper to build a standard "auction room" board (active, past SETUP)
  const makeAuctionBoard = (overrides: Record<string, unknown> = {}) => ({
    isActive: true,
    isAdmin: false,
    state: 'READY_CHECK',
    isMyTurn: false,
    currentTurnUsername: 'OtherUser',
    currentTurnMemberId: 'm2',
    myBudget: 200,
    myMemberId: 'member1',
    turnOrder: [
      { id: 'member1', username: 'TestUser', budget: 200, hasPassed: false, isConnected: true },
      { id: 'm2', username: 'OtherUser', budget: 150, hasPassed: false, isConnected: true },
    ],
    readyMembers: [],
    pendingPlayer: null,
    pendingNominatorId: null,
    nominatorConfirmed: false,
    nominatorUsername: null,
    finishedMembers: [],
    isFinished: false,
    activeAuction: null,
    pendingAck: null,
    ...overrides,
  })

  // ---- NOMINATION: pending player (nominator sees confirm/cancel) ----
  it('shows nomination confirm/cancel buttons for the nominator', () => {
    hookOverrides = {
      board: makeAuctionBoard({
        state: 'NOMINATION',
        isMyTurn: true,
        currentTurnUsername: 'TestUser',
        currentTurnMemberId: 'member1',
        pendingPlayer: { id: 'p1', name: 'Mario Rossi', team: 'Juventus', position: 'A' },
        pendingNominatorId: 'member1',
        nominatorConfirmed: false,
      }) as never,
    }

    render(<Svincolati leagueId={leagueId} onNavigate={mockOnNavigate} />)

    expect(screen.getByText('Conferma la tua scelta')).toBeInTheDocument()
    expect(screen.getByText('Mario Rossi')).toBeInTheDocument()
    expect(screen.getByText('Juventus')).toBeInTheDocument()
    expect(screen.getByText(/CONFERMA/)).toBeInTheDocument()
    expect(screen.getByText('Cambia')).toBeInTheDocument()
  })

  // ---- NOMINATION: confirm nomination handler ----
  it('calls handleConfirmNomination when CONFERMA button is clicked', async () => {
    const user = userEvent.setup()
    hookOverrides = {
      board: makeAuctionBoard({
        state: 'NOMINATION',
        pendingPlayer: { id: 'p1', name: 'Mario Rossi', team: 'Juventus', position: 'A' },
        pendingNominatorId: 'member1',
        nominatorConfirmed: false,
      }) as never,
    }

    render(<Svincolati leagueId={leagueId} onNavigate={mockOnNavigate} />)

    await user.click(screen.getByText(/CONFERMA/))
    expect(mockHandleConfirmNomination).toHaveBeenCalled()
  })

  // ---- NOMINATION: cancel nomination handler ----
  it('calls handleCancelNomination when "Cambia" button is clicked', async () => {
    const user = userEvent.setup()
    hookOverrides = {
      board: makeAuctionBoard({
        state: 'NOMINATION',
        pendingPlayer: { id: 'p1', name: 'Mario Rossi', team: 'Juventus', position: 'A' },
        pendingNominatorId: 'member1',
        nominatorConfirmed: false,
      }) as never,
    }

    render(<Svincolati leagueId={leagueId} onNavigate={mockOnNavigate} />)

    await user.click(screen.getByText('Cambia'))
    expect(mockHandleCancelNomination).toHaveBeenCalled()
  })

  // ---- NOMINATION: other user sees "ha chiamato" with ready status ----
  it('shows ready check progress for non-nominator after nomination is confirmed', () => {
    hookOverrides = {
      board: makeAuctionBoard({
        state: 'NOMINATION',
        pendingPlayer: { id: 'p1', name: 'Mario Rossi', team: 'Juventus', position: 'A' },
        pendingNominatorId: 'm2',
        nominatorConfirmed: true,
        nominatorUsername: 'OtherUser',
        readyMembers: ['m2'],
      }) as never,
    }

    render(<Svincolati leagueId={leagueId} onNavigate={mockOnNavigate} />)

    expect(screen.getByText('OtherUser ha chiamato')).toBeInTheDocument()
    expect(screen.getByText('DG pronti')).toBeInTheDocument()
    expect(screen.getByText('1/2')).toBeInTheDocument()
    expect(screen.getByText('SONO PRONTO')).toBeInTheDocument()
  })

  // ---- NOMINATION: mark ready handler ----
  it('calls handleMarkReady when SONO PRONTO button is clicked', async () => {
    const user = userEvent.setup()
    hookOverrides = {
      board: makeAuctionBoard({
        state: 'NOMINATION',
        pendingPlayer: { id: 'p1', name: 'Mario Rossi', team: 'Juventus', position: 'A' },
        pendingNominatorId: 'm2',
        nominatorConfirmed: true,
        nominatorUsername: 'OtherUser',
        readyMembers: [],
      }) as never,
    }

    render(<Svincolati leagueId={leagueId} onNavigate={mockOnNavigate} />)

    await user.click(screen.getByText('SONO PRONTO'))
    expect(mockHandleMarkReady).toHaveBeenCalled()
  })

  // ---- NOMINATION: user already ready shows "Pronto" text ----
  it('shows already-ready message when user has marked ready', () => {
    hookOverrides = {
      board: makeAuctionBoard({
        state: 'NOMINATION',
        pendingPlayer: { id: 'p1', name: 'Mario Rossi', team: 'Juventus', position: 'A' },
        pendingNominatorId: 'm2',
        nominatorConfirmed: true,
        nominatorUsername: 'OtherUser',
        readyMembers: ['member1', 'm2'],
      }) as never,
    }

    render(<Svincolati leagueId={leagueId} onNavigate={mockOnNavigate} />)

    expect(screen.getByText(/Pronto - In attesa degli altri/)).toBeInTheDocument()
  })

  // ---- AUCTION: active auction with bids ----
  it('renders the active auction view with player, price, and bid history', () => {
    hookOverrides = {
      board: makeAuctionBoard({
        state: 'AUCTION',
        activeAuction: {
          player: { id: 'p1', name: 'Mario Rossi', team: 'Juventus', position: 'A' },
          currentPrice: 15,
          basePrice: 10,
          timerExpiresAt: new Date(Date.now() + 30000).toISOString(),
          bids: [
            { bidder: 'OtherUser', amount: 15 },
            { bidder: 'TestUser', amount: 12 },
          ],
        },
      }) as never,
      timerRemaining: 25,
      bidAmount: '16',
    }

    render(<Svincolati leagueId={leagueId} onNavigate={mockOnNavigate} />)

    expect(screen.getByText('Asta in Corso')).toBeInTheDocument()
    expect(screen.getByText('Mario Rossi')).toBeInTheDocument()
    // "15" appears in both the main price display and the bid history — use getAllByText
    expect(screen.getAllByText('15').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Offerta Attuale')).toBeInTheDocument()
    expect(screen.getByText('di OtherUser')).toBeInTheDocument()
    expect(screen.getByText('Offri')).toBeInTheDocument()
    expect(screen.getByText('Storico Offerte')).toBeInTheDocument()
    expect(screen.getByText('2 offerte')).toBeInTheDocument()
    expect(screen.getByText('Tempo rimanente')).toBeInTheDocument()
  })

  // ---- AUCTION: bid button calls handleBid ----
  it('calls handleBid when "Offri" button is clicked', async () => {
    const user = userEvent.setup()
    hookOverrides = {
      board: makeAuctionBoard({
        state: 'AUCTION',
        activeAuction: {
          player: { id: 'p1', name: 'Mario Rossi', team: 'Juventus', position: 'A' },
          currentPrice: 10,
          basePrice: 10,
          timerExpiresAt: null,
          bids: [],
        },
      }) as never,
      bidAmount: '12',
    }

    render(<Svincolati leagueId={leagueId} onNavigate={mockOnNavigate} />)

    await user.click(screen.getByText('Offri'))
    expect(mockHandleBid).toHaveBeenCalled()
  })

  // ---- AUCTION: no bids shows base price ----
  it('shows base price text when there are no bids yet', () => {
    hookOverrides = {
      board: makeAuctionBoard({
        state: 'AUCTION',
        activeAuction: {
          player: { id: 'p1', name: 'Mario Rossi', team: 'Juventus', position: 'A' },
          currentPrice: 10,
          basePrice: 10,
          timerExpiresAt: null,
          bids: [],
        },
      }) as never,
    }

    render(<Svincolati leagueId={leagueId} onNavigate={mockOnNavigate} />)

    expect(screen.getByText(/Base d'asta: 10/)).toBeInTheDocument()
  })

  // ---- AUCTION: isUserWinning shows badge ----
  it('shows "Stai vincendo!" badge when isUserWinning is true', () => {
    hookOverrides = {
      board: makeAuctionBoard({
        state: 'AUCTION',
        activeAuction: {
          player: { id: 'p1', name: 'Mario Rossi', team: 'Juventus', position: 'A' },
          currentPrice: 15,
          basePrice: 10,
          timerExpiresAt: null,
          bids: [{ bidder: 'TestUser', amount: 15 }],
        },
      }) as never,
      isUserWinning: true,
    }

    render(<Svincolati leagueId={leagueId} onNavigate={mockOnNavigate} />)

    expect(screen.getByText('Stai vincendo!')).toBeInTheDocument()
  })

  // ---- AUCTION: current user bid highlighted with (TU) ----
  it('highlights current user bid with (TU) label', () => {
    hookOverrides = {
      board: makeAuctionBoard({
        state: 'AUCTION',
        activeAuction: {
          player: { id: 'p1', name: 'Mario Rossi', team: 'Juventus', position: 'A' },
          currentPrice: 15,
          basePrice: 10,
          timerExpiresAt: null,
          bids: [{ bidder: 'TestUser', amount: 15 }],
        },
      }) as never,
      currentUsername: 'TestUser',
    }

    render(<Svincolati leagueId={leagueId} onNavigate={mockOnNavigate} />)

    expect(screen.getByText(/di TestUser/)).toBeInTheDocument()
    expect(screen.getByText(/\(TU\)/)).toBeInTheDocument()
  })

  // ---- AUCTION: timer near expiry shows "Affrettati!" ----
  it('shows "Affrettati!" warning when timer is <= 10 seconds', () => {
    hookOverrides = {
      board: makeAuctionBoard({
        state: 'AUCTION',
        activeAuction: {
          player: { id: 'p1', name: 'Mario Rossi', team: 'Juventus', position: 'A' },
          currentPrice: 10,
          basePrice: 10,
          timerExpiresAt: new Date(Date.now() + 5000).toISOString(),
          bids: [],
        },
      }) as never,
      timerRemaining: 5,
    }

    render(<Svincolati leagueId={leagueId} onNavigate={mockOnNavigate} />)

    expect(screen.getByText('Affrettati!')).toBeInTheDocument()
  })

  // ---- AUCTION: finished user sees disabled bid and "Finito" label ----
  it('shows "Finito" button label and warning when board.isFinished is true', () => {
    hookOverrides = {
      board: makeAuctionBoard({
        state: 'AUCTION',
        isFinished: true,
        activeAuction: {
          player: { id: 'p1', name: 'Mario Rossi', team: 'Juventus', position: 'A' },
          currentPrice: 10,
          basePrice: 10,
          timerExpiresAt: null,
          bids: [],
        },
      }) as never,
      bidAmount: '12',
    }

    render(<Svincolati leagueId={leagueId} onNavigate={mockOnNavigate} />)

    expect(screen.getByText('Finito')).toBeInTheDocument()
    expect(screen.getByText(/Hai dichiarato di aver finito questa fase/)).toBeInTheDocument()
  })

  // ---- AUCTION: admin sees "Chiudi Asta Manualmente" ----
  it('shows admin close auction button during AUCTION state', () => {
    hookOverrides = {
      board: makeAuctionBoard({
        state: 'AUCTION',
        isAdmin: true,
        activeAuction: {
          player: { id: 'p1', name: 'Mario Rossi', team: 'Juventus', position: 'A' },
          currentPrice: 10,
          basePrice: 10,
          timerExpiresAt: null,
          bids: [],
        },
      }) as never,
    }

    render(<Svincolati leagueId={leagueId} onNavigate={mockOnNavigate} />)

    expect(screen.getByText('Chiudi Asta Manualmente')).toBeInTheDocument()
  })

  // ---- Admin controls panel: timer, pause, test buttons ----
  it('renders admin controls panel with timer buttons and pause in auction room', () => {
    hookOverrides = {
      board: makeAuctionBoard({
        state: 'AUCTION',
        isAdmin: true,
        activeAuction: {
          player: { id: 'p1', name: 'Mario Rossi', team: 'Juventus', position: 'A' },
          currentPrice: 10,
          basePrice: 10,
          timerExpiresAt: null,
          bids: [],
        },
      }) as never,
    }

    render(<Svincolati leagueId={leagueId} onNavigate={mockOnNavigate} />)

    expect(screen.getByText('Controlli Admin')).toBeInTheDocument()
    expect(screen.getByText('Timer Asta')).toBeInTheDocument()
    expect(screen.getByText('10s')).toBeInTheDocument()
    expect(screen.getByText('30s')).toBeInTheDocument()
    expect(screen.getByText('60s')).toBeInTheDocument()
    expect(screen.getByText('Pausa')).toBeInTheDocument()
    expect(screen.getByText('Test Mode')).toBeInTheDocument()
    expect(screen.getByText('Termina Fase')).toBeInTheDocument()
  })

  // ---- PAUSED state shows resume button ----
  it('shows "Riprendi" button for admin when state is PAUSED', () => {
    hookOverrides = {
      board: makeAuctionBoard({
        state: 'PAUSED',
        isAdmin: true,
      }) as never,
    }

    render(<Svincolati leagueId={leagueId} onNavigate={mockOnNavigate} />)

    expect(screen.getByText('Riprendi')).toBeInTheDocument()
  })

  // ---- DG list: turn order, current turn indicator, passed/finished ----
  it('renders DG list with turn indicators and current/passed/finished statuses', () => {
    hookOverrides = {
      board: makeAuctionBoard({
        state: 'READY_CHECK',
        currentTurnMemberId: 'm2',
        turnOrder: [
          { id: 'member1', username: 'TestUser', budget: 200, hasPassed: false, isConnected: true },
          { id: 'm2', username: 'OtherUser', budget: 150, hasPassed: false, isConnected: true },
          { id: 'm3', username: 'PassedUser', budget: 100, hasPassed: true, isConnected: false },
        ],
        finishedMembers: ['m3'],
      }) as never,
    }

    render(<Svincolati leagueId={leagueId} onNavigate={mockOnNavigate} />)

    expect(screen.getByText('Direttori Generali')).toBeInTheDocument()
    // "TestUser" appears in the DG list; "OtherUser" appears in both turn banner and DG list
    expect(screen.getAllByText('TestUser').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('(tu)')).toBeInTheDocument()
    expect(screen.getAllByText(/OtherUser/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('TURNO')).toBeInTheDocument()
    expect(screen.getByText('PASS')).toBeInTheDocument()
    expect(screen.getByText('FINITO')).toBeInTheDocument()
  })

  // ---- DG list: "Ho Finito" button (user not finished) ----
  it('shows "Ho Finito" button when user has not declared finished', async () => {
    const user = userEvent.setup()
    hookOverrides = {
      board: makeAuctionBoard({
        state: 'READY_CHECK',
        isFinished: false,
      }) as never,
    }

    render(<Svincolati leagueId={leagueId} onNavigate={mockOnNavigate} />)

    const btn = screen.getByText(/Ho Finito/)
    expect(btn).toBeInTheDocument()
    await user.click(btn)
    expect(mockHandleDeclareFinished).toHaveBeenCalled()
  })

  // ---- DG list: user already finished shows info text ----
  it('shows "Hai dichiarato di aver finito" when user is finished in DG panel', () => {
    hookOverrides = {
      board: makeAuctionBoard({
        state: 'READY_CHECK',
        isFinished: true,
      }) as never,
    }

    render(<Svincolati leagueId={leagueId} onNavigate={mockOnNavigate} />)

    expect(screen.getByText('Hai dichiarato di aver finito')).toBeInTheDocument()
    expect(screen.getByText(/Non puoi più fare offerte/)).toBeInTheDocument()
  })

  // ---- DG list: admin can force all finished ----
  it('shows "Simula Tutti Finiti" for admin when not all members are finished', () => {
    hookOverrides = {
      board: makeAuctionBoard({
        state: 'READY_CHECK',
        isAdmin: true,
        finishedMembers: ['member1'],
      }) as never,
    }

    render(<Svincolati leagueId={leagueId} onNavigate={mockOnNavigate} />)

    expect(screen.getByText(/Simula Tutti Finiti/)).toBeInTheDocument()
  })

  // ---- DG list: admin "Chiudi Fase" when all finished ----
  it('shows "Chiudi Fase Svincolati" for admin when all members finished', () => {
    hookOverrides = {
      board: makeAuctionBoard({
        state: 'READY_CHECK',
        isAdmin: true,
        finishedMembers: ['member1', 'm2'],
      }) as never,
    }

    render(<Svincolati leagueId={leagueId} onNavigate={mockOnNavigate} />)

    expect(screen.getByText('Chiudi Fase Svincolati')).toBeInTheDocument()
  })

  // ---- Finish confirm modal ----
  it('renders the finish confirm modal when showFinishConfirmModal is true', () => {
    hookOverrides = {
      board: makeAuctionBoard() as never,
      showFinishConfirmModal: true,
    }

    render(<Svincolati leagueId={leagueId} onNavigate={mockOnNavigate} />)

    expect(screen.getByText('Conferma Fine Fase')).toBeInTheDocument()
    expect(screen.getByText(/Questa azione è/)).toBeInTheDocument()
    expect(screen.getByText('Annulla')).toBeInTheDocument()
    expect(screen.getByText('Conferma')).toBeInTheDocument()
  })

  // ---- PENDING_ACK: acknowledgment modal with winner ----
  it('renders PENDING_ACK modal with winner details and acknowledge button', () => {
    hookOverrides = {
      board: makeAuctionBoard({
        state: 'PENDING_ACK',
        pendingAck: {
          playerName: 'Mario Rossi',
          winnerUsername: 'OtherUser',
          price: 15,
          acknowledgedMembers: ['m2'],
        },
      }) as never,
      userHasAcked: false,
    }

    render(<Svincolati leagueId={leagueId} onNavigate={mockOnNavigate} />)

    expect(screen.getByText('Transazione Completata')).toBeInTheDocument()
    expect(screen.getByText('Mario Rossi')).toBeInTheDocument()
    // "OtherUser" appears in both the turn banner and the ack modal
    expect(screen.getAllByText(/OtherUser/).length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('Ho Visto, Conferma')).toBeInTheDocument()
    expect(screen.getByText(/Contesta questa transazione/)).toBeInTheDocument()
  })

  // ---- PENDING_ACK: no winner ----
  it('renders PENDING_ACK modal without winner (remains free agent)', () => {
    hookOverrides = {
      board: makeAuctionBoard({
        state: 'PENDING_ACK',
        pendingAck: {
          playerName: 'Mario Rossi',
          winnerUsername: null,
          price: null,
          acknowledgedMembers: [],
        },
      }) as never,
      userHasAcked: false,
    }

    render(<Svincolati leagueId={leagueId} onNavigate={mockOnNavigate} />)

    expect(screen.getByText('Asta Conclusa')).toBeInTheDocument()
    expect(screen.getByText(/Nessuna offerta - rimane svincolato/)).toBeInTheDocument()
  })

  // ---- PENDING_ACK: appeal mode toggle ----
  it('shows appeal textarea when isAppealMode is true', () => {
    hookOverrides = {
      board: makeAuctionBoard({
        state: 'PENDING_ACK',
        pendingAck: {
          playerName: 'Mario Rossi',
          winnerUsername: 'OtherUser',
          price: 15,
          acknowledgedMembers: [],
        },
      }) as never,
      userHasAcked: false,
      isAppealMode: true,
    }

    render(<Svincolati leagueId={leagueId} onNavigate={mockOnNavigate} />)

    expect(screen.getByText(/Indica il motivo/)).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Descrivi il motivo del ricorso...')).toBeInTheDocument()
    expect(screen.getByText('Invia Ricorso')).toBeInTheDocument()
    expect(screen.getByText('Annulla')).toBeInTheDocument()
  })

  // ---- PENDING_ACK: waiting modal after acknowledging ----
  it('renders waiting modal after user has acknowledged', () => {
    hookOverrides = {
      board: makeAuctionBoard({
        state: 'PENDING_ACK',
        pendingAck: {
          playerName: 'Mario Rossi',
          winnerUsername: 'OtherUser',
          price: 15,
          acknowledgedMembers: ['member1'],
        },
      }) as never,
      userHasAcked: true,
    }

    render(<Svincolati leagueId={leagueId} onNavigate={mockOnNavigate} />)

    expect(screen.getByText('In attesa degli altri')).toBeInTheDocument()
    expect(screen.getByText('1/2 confermati')).toBeInTheDocument()
  })

  // ---- APPEAL_REVIEW modal ----
  it('renders APPEAL_REVIEW modal with appeal details', () => {
    hookOverrides = {
      board: makeAuctionBoard({
        state: 'PENDING_ACK',
      }) as never,
      appealStatus: {
        auctionStatus: 'APPEAL_REVIEW',
        player: { name: 'Mario Rossi', team: 'Juventus' },
        appeal: {
          reason: 'Bid was invalid',
          submittedBy: { username: 'TestUser' },
        },
        winner: { username: 'OtherUser' },
        finalPrice: 15,
      },
    }

    render(<Svincolati leagueId={leagueId} onNavigate={mockOnNavigate} />)

    expect(screen.getByText('Ricorso in Valutazione')).toBeInTheDocument()
    expect(screen.getByText(/L'admin della lega sta valutando/)).toBeInTheDocument()
    expect(screen.getByText('Bid was invalid')).toBeInTheDocument()
    expect(screen.getByText('Transazione contestata')).toBeInTheDocument()
  })

  // ---- APPEAL_REVIEW: admin sees "Gestisci Ricorso" ----
  it('shows "Gestisci Ricorso" button for admin in APPEAL_REVIEW', async () => {
    const user = userEvent.setup()
    hookOverrides = {
      board: makeAuctionBoard({
        state: 'PENDING_ACK',
        isAdmin: true,
      }) as never,
      appealStatus: {
        auctionStatus: 'APPEAL_REVIEW',
        player: { name: 'Mario Rossi', team: 'Juventus' },
        appeal: {
          reason: 'Test',
          submittedBy: { username: 'TestUser' },
        },
        winner: null,
        finalPrice: null,
      },
    }

    render(<Svincolati leagueId={leagueId} onNavigate={mockOnNavigate} />)

    const btn = screen.getByText('Gestisci Ricorso')
    expect(btn).toBeInTheDocument()
    await user.click(btn)
    expect(mockOnNavigate).toHaveBeenCalledWith('admin', { leagueId, tab: 'appeals' })
  })

  // ---- AWAITING_APPEAL_ACK modal: accepted appeal ----
  it('renders AWAITING_APPEAL_ACK modal when appeal is accepted', () => {
    hookOverrides = {
      board: makeAuctionBoard({ state: 'PENDING_ACK' }) as never,
      appealStatus: {
        auctionStatus: 'AWAITING_APPEAL_ACK',
        player: { name: 'Mario Rossi', team: 'Juventus' },
        appeal: {
          status: 'ACCEPTED',
          adminNotes: 'Asta ripetuta',
        },
        appealDecisionAcks: ['member1'],
        allMembers: [
          { id: 'member1', username: 'TestUser' },
          { id: 'm2', username: 'OtherUser' },
        ],
        userHasAcked: false,
      },
    }

    render(<Svincolati leagueId={leagueId} onNavigate={mockOnNavigate} />)

    expect(screen.getByText('Ricorso Accolto')).toBeInTheDocument()
    expect(screen.getByText(/La transazione è stata annullata/)).toBeInTheDocument()
    expect(screen.getByText('Asta ripetuta')).toBeInTheDocument()
    expect(screen.getByText("Note dell'admin")).toBeInTheDocument()
    expect(screen.getByText('Ho Preso Visione')).toBeInTheDocument()
    expect(screen.getByText('1/2')).toBeInTheDocument()
  })

  // ---- AWAITING_APPEAL_ACK: user already acked ----
  it('shows "Hai confermato" text in AWAITING_APPEAL_ACK when user has acknowledged', () => {
    hookOverrides = {
      board: makeAuctionBoard({ state: 'PENDING_ACK' }) as never,
      appealStatus: {
        auctionStatus: 'AWAITING_APPEAL_ACK',
        player: { name: 'Mario Rossi', team: 'Juventus' },
        appeal: { status: 'REJECTED' },
        appealDecisionAcks: ['member1', 'm2'],
        allMembers: [
          { id: 'member1', username: 'TestUser' },
          { id: 'm2', username: 'OtherUser' },
        ],
        userHasAcked: true,
      },
    }

    render(<Svincolati leagueId={leagueId} onNavigate={mockOnNavigate} />)

    expect(screen.getByText('Ricorso Respinto')).toBeInTheDocument()
    expect(screen.getByText(/La transazione è confermata/)).toBeInTheDocument()
    expect(screen.getByText(/Hai confermato. In attesa degli altri.../)).toBeInTheDocument()
  })

  // ---- AWAITING_RESUME modal ----
  it('renders AWAITING_RESUME modal with ready-to-resume button', () => {
    hookOverrides = {
      board: makeAuctionBoard({ state: 'PENDING_ACK' }) as never,
      appealStatus: {
        auctionStatus: 'AWAITING_RESUME',
        player: { name: 'Mario Rossi', team: 'Juventus' },
        resumeReadyMembers: [],
        allMembers: [
          { id: 'member1', username: 'TestUser' },
          { id: 'm2', username: 'OtherUser' },
        ],
        userIsReady: false,
      },
    }

    render(<Svincolati leagueId={leagueId} onNavigate={mockOnNavigate} />)

    expect(screen.getByText('Ripresa Asta')).toBeInTheDocument()
    expect(screen.getByText(/Tutti devono confermare/)).toBeInTheDocument()
    expect(screen.getByText(/Il ricorso è stato accolto/)).toBeInTheDocument()
    expect(screen.getByText('Sono Pronto')).toBeInTheDocument()
  })

  // ---- AWAITING_RESUME: user already ready ----
  it('shows "Sei pronto" text in AWAITING_RESUME when user is ready', () => {
    hookOverrides = {
      board: makeAuctionBoard({ state: 'PENDING_ACK' }) as never,
      appealStatus: {
        auctionStatus: 'AWAITING_RESUME',
        player: { name: 'Mario Rossi', team: 'Juventus' },
        resumeReadyMembers: ['member1'],
        allMembers: [
          { id: 'member1', username: 'TestUser' },
          { id: 'm2', username: 'OtherUser' },
        ],
        userIsReady: true,
      },
    }

    render(<Svincolati leagueId={leagueId} onNavigate={mockOnNavigate} />)

    expect(screen.getByText(/Sei pronto. In attesa degli altri.../)).toBeInTheDocument()
  })

  // ---- Contract modification modal ----
  it('renders ContractModifierModal when pendingContractModification is set', () => {
    hookOverrides = {
      board: makeAuctionBoard() as never,
      pendingContractModification: {
        playerId: 'p1',
        playerName: 'Mario Rossi',
        playerTeam: 'Juventus',
        playerPosition: 'A',
        salary: 10,
        duration: 3,
        initialSalary: 10,
        rescissionClause: 5,
      },
    }

    render(<Svincolati leagueId={leagueId} onNavigate={mockOnNavigate} />)

    expect(screen.getByTestId('contract-modifier-modal')).toBeInTheDocument()
  })

  // ---- Manager roster modal (loading state) ----
  it('renders loading spinner in manager roster modal when loadingManager is true', () => {
    hookOverrides = {
      board: makeAuctionBoard() as never,
      loadingManager: true,
    }

    render(<Svincolati leagueId={leagueId} onNavigate={mockOnNavigate} />)

    const spinners = document.querySelectorAll('.animate-spin')
    expect(spinners.length).toBeGreaterThan(0)
  })

  // ---- Manager roster modal (with data) ----
  it('renders manager roster modal with player data', () => {
    hookOverrides = {
      board: makeAuctionBoard() as never,
      selectedManager: {
        username: 'OtherUser',
        teamName: 'Team Beta',
        currentBudget: 150,
        slotsFilled: 3,
        totalSlots: 25,
        slotsByPosition: {
          P: { filled: 1, total: 3 },
          D: { filled: 1, total: 8 },
          C: { filled: 1, total: 8 },
          A: { filled: 0, total: 6 },
        },
        roster: [
          { id: 'r1', position: 'P', playerName: 'Gigi Buffon', playerTeam: 'Juventus', acquisitionPrice: 10, contract: { salary: 5, duration: 2, rescissionClause: 3 } },
          { id: 'r2', position: 'D', playerName: 'Paolo Maldini', playerTeam: 'Milan', acquisitionPrice: 20, contract: { salary: 8, duration: 4, rescissionClause: 10 } },
          { id: 'r3', position: 'C', playerName: 'Andrea Pirlo', playerTeam: 'Juventus', acquisitionPrice: 15, contract: null },
        ],
      },
    }

    render(<Svincolati leagueId={leagueId} onNavigate={mockOnNavigate} />)

    // "OtherUser" appears in both the turn banner and the roster modal
    expect(screen.getAllByText(/OtherUser/).length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('Team Beta')).toBeInTheDocument()
    expect(screen.getByText('3/25')).toBeInTheDocument()
    expect(screen.getByText('Gigi Buffon')).toBeInTheDocument()
    expect(screen.getByText('Paolo Maldini')).toBeInTheDocument()
    expect(screen.getByText('Andrea Pirlo')).toBeInTheDocument()
    // Position with no players shows "Nessuno"
    expect(screen.getByText('Nessuno')).toBeInTheDocument()
  })

  // ---- Success message display in auction room ----
  it('displays success message in auction room', () => {
    hookOverrides = {
      board: makeAuctionBoard() as never,
      success: 'Operazione riuscita!',
    }

    render(<Svincolati leagueId={leagueId} onNavigate={mockOnNavigate} />)

    expect(screen.getByText('Operazione riuscita!')).toBeInTheDocument()
  })

  // ---- Pusher disconnected indicator ----
  it('renders red dot when Pusher is disconnected', () => {
    hookOverrides = {
      board: makeAuctionBoard() as never,
      isPusherConnected: false,
    }

    render(<Svincolati leagueId={leagueId} onNavigate={mockOnNavigate} />)

    const dot = document.querySelector('[title="Real-time disconnesso"]')
    expect(dot).toBeTruthy()
    expect(dot?.classList.contains('bg-red-400')).toBe(true)
  })

  // ---- PENDING_ACK spinner in center column ----
  it('shows transaction spinner in center column during PENDING_ACK', () => {
    hookOverrides = {
      board: makeAuctionBoard({
        state: 'PENDING_ACK',
        pendingAck: {
          playerName: 'Mario Rossi',
          winnerUsername: 'OtherUser',
          price: 15,
          acknowledgedMembers: [],
        },
      }) as never,
      userHasAcked: true,
    }

    render(<Svincolati leagueId={leagueId} onNavigate={mockOnNavigate} />)

    expect(screen.getByText('Conferma transazione in corso...')).toBeInTheDocument()
  })

  // ---- COMPLETED header shows "Fase completata" subtitle ----
  it('shows "Fase completata" subtitle in header during COMPLETED state', () => {
    hookOverrides = {
      board: makeAuctionBoard({
        state: 'COMPLETED',
        currentTurnUsername: null,
      }) as never,
    }

    render(<Svincolati leagueId={leagueId} onNavigate={mockOnNavigate} />)

    expect(screen.getByText('Fase completata')).toBeInTheDocument()
  })

  // ---- My turn nomination click calls handleNominate ----
  it('calls handleNominate when a player is clicked during my turn', async () => {
    const user = userEvent.setup()
    hookOverrides = {
      board: makeAuctionBoard({
        state: 'READY_CHECK',
        isMyTurn: true,
        currentTurnUsername: 'TestUser',
        currentTurnMemberId: 'member1',
      }) as never,
      freeAgents: [
        { id: 'p1', name: 'Mario Rossi', team: 'Juventus', position: 'A', quotation: 25 },
      ],
    }

    render(<Svincolati leagueId={leagueId} onNavigate={mockOnNavigate} />)

    await user.click(screen.getByText('Mario Rossi'))
    expect(mockHandleNominate).toHaveBeenCalledWith('p1')
  })

  // ---- Pass turn handler ----
  it('calls handlePassTurn when pass button is clicked during my turn', async () => {
    const user = userEvent.setup()
    hookOverrides = {
      board: makeAuctionBoard({
        state: 'READY_CHECK',
        isMyTurn: true,
        currentTurnUsername: 'TestUser',
        currentTurnMemberId: 'member1',
      }) as never,
      freeAgents: [
        { id: 'p1', name: 'Mario Rossi', team: 'Juventus', position: 'A', quotation: 25 },
      ],
    }

    render(<Svincolati leagueId={leagueId} onNavigate={mockOnNavigate} />)

    await user.click(screen.getByText(/Passo \(non chiamo più\)/))
    expect(mockHandlePassTurn).toHaveBeenCalled()
  })

  // ---- Finished members progress text ----
  it('shows finished members count in DG panel', () => {
    hookOverrides = {
      board: makeAuctionBoard({
        finishedMembers: ['member1'],
      }) as never,
    }

    render(<Svincolati leagueId={leagueId} onNavigate={mockOnNavigate} />)

    expect(screen.getByText('1/2 manager hanno finito')).toBeInTheDocument()
  })
})
