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
})
