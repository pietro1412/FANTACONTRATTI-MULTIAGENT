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

// Mock BottomSheet
vi.mock('../components/ui/BottomSheet', () => ({
  BottomSheet: ({ isOpen, children, title }: { isOpen: boolean; children: React.ReactNode; title: string }) => (
    isOpen ? <div data-testid="bottom-sheet"><h3>{title}</h3>{children}</div> : null
  ),
}))

// Mock child components
vi.mock('../components/ContractModifier', () => ({
  ContractModifierModal: () => <div data-testid="contract-modifier-modal">ContractModifier</div>,
}))

vi.mock('../components/PlayerStatsModal', () => ({
  PlayerStatsModal: ({ isOpen }: { isOpen: boolean }) => (
    isOpen ? <div data-testid="player-stats-modal">PlayerStats</div> : null
  ),
}))

vi.mock('../components/rubata/RubataStepper', () => ({
  RubataStepper: () => <div data-testid="rubata-stepper">Stepper</div>,
}))

vi.mock('../components/rubata/PreferenceModal', () => ({
  PreferenceModal: () => <div data-testid="preference-modal">PreferenceModal</div>,
}))

vi.mock('../components/rubata/TeamLogo', () => ({
  TeamLogo: ({ team }: { team: string }) => <span data-testid="team-logo">{team}</span>,
}))

vi.mock('../components/rubata/RubataModals', () => ({
  PendingAckModal: () => <div data-testid="pending-ack-modal">PendingAck</div>,
  AppealReviewModal: () => <div data-testid="appeal-review-modal">AppealReview</div>,
  AppealAckModal: () => <div data-testid="appeal-ack-modal">AppealAck</div>,
  AwaitingResumeModal: () => <div data-testid="awaiting-resume-modal">AwaitingResume</div>,
  AuctionReadyCheckModal: () => <div data-testid="auction-ready-check-modal">AuctionReadyCheck</div>,
}))

vi.mock('../components/rubata/RubataAdminControls', () => ({
  BudgetPanel: () => <div data-testid="budget-panel">BudgetPanel</div>,
  TimerSettingsPanel: () => <div data-testid="timer-settings-panel">TimerSettings</div>,
  BotSimulationPanel: () => <div data-testid="bot-simulation-panel">BotSimulation</div>,
  CompleteRubataPanel: () => <div data-testid="complete-rubata-panel">CompleteRubata</div>,
}))

vi.mock('../components/rubata/RubataTimerPanel', () => ({
  RubataTimerPanel: () => <div data-testid="rubata-timer-panel">TimerPanel</div>,
}))

vi.mock('../components/rubata/RubataBidPanel', () => ({
  RubataBidPanel: () => <div data-testid="rubata-bid-panel">BidPanel</div>,
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

// Mock utils
vi.mock('../utils/player-images', () => ({
  getPlayerPhotoUrl: (id: number) => `https://photo/${id}`,
}))

// Mock types
vi.mock('../types/rubata.types', () => ({
  POSITION_COLORS: { P: 'bg-yellow', D: 'bg-green', C: 'bg-blue', A: 'bg-red' },
}))

// Mock Pusher
vi.mock('../services/pusher.client', () => ({
  usePusherAuction: vi.fn().mockReturnValue({ isConnected: true }),
}))

// Mock API
vi.mock('../services/api', () => ({
  rubataApi: {
    getBoard: vi.fn().mockResolvedValue({ success: true, data: null }),
    getAllPlayersForStrategies: vi.fn().mockResolvedValue({ success: true, data: { players: [] } }),
    getAllSvincolatiForStrategies: vi.fn().mockResolvedValue({ success: true, data: { players: [] } }),
    setPreference: vi.fn().mockResolvedValue({ success: true }),
  },
  leagueApi: {
    getById: vi.fn().mockResolvedValue({ success: true, data: { id: 'league1', name: 'Test League' } }),
    getLeagueDetail: vi.fn().mockResolvedValue({ success: true, data: { id: 'league1', name: 'Test League' } }),
  },
  auctionApi: {
    getActive: vi.fn().mockResolvedValue({ success: true, data: null }),
  },
  contractApi: {
    modify: vi.fn().mockResolvedValue({ success: true }),
  },
}))

// Mock useRubataState — the central hook
const mockLoadData = vi.fn()
const mockSetError = vi.fn()
const mockHandleSetOrder = vi.fn()
const mockHandleGenerateBoard = vi.fn()
const mockHandleStartRubata = vi.fn()
const mockHandleUpdateTimers = vi.fn()
const mockHandlePause = vi.fn()
const mockHandleResume = vi.fn()
const mockHandleAdvance = vi.fn()
const mockHandleGoBack = vi.fn()
const mockHandleMakeOffer = vi.fn()
const mockHandleBid = vi.fn()
const mockHandleSetReady = vi.fn()
const mockMoveInOrder = vi.fn()
const mockHandleCloseAuction = vi.fn()

const defaultHookReturn = {
  isLoading: false,
  isAdmin: false,
  error: '',
  success: '',
  isSubmitting: false,
  members: [],
  boardData: null,
  board: null,
  rubataState: null,
  currentPlayer: null,
  activeAuction: null,
  myMemberId: 'member1',
  isRubataPhase: false,
  isOrderSet: false,
  canMakeOffer: false,
  isPusherConnected: true,
  timerDisplay: null,
  offerTimer: 30,
  setOfferTimer: vi.fn(),
  auctionTimer: 15,
  setAuctionTimer: vi.fn(),
  mobileBudgetExpanded: false,
  setMobileBudgetExpanded: vi.fn(),
  readyStatus: null,
  pendingAck: null,
  appealStatus: null,
  isAppealMode: false,
  setIsAppealMode: vi.fn(),
  appealContent: '',
  setAppealContent: vi.fn(),
  prophecyContent: '',
  setProphecyContent: vi.fn(),
  bidAmount: 0,
  setBidAmount: vi.fn(),
  simulateMemberId: '',
  setSimulateMemberId: vi.fn(),
  simulateBidAmount: 0,
  setSimulateBidAmount: vi.fn(),
  orderDraft: [],
  moveInOrder: mockMoveInOrder,
  handleDndDragEnd: vi.fn(),
  handleDndDragStart: vi.fn(),
  preferencesMap: new Map(),
  selectedPlayerForPrefs: null,
  openPrefsModal: vi.fn(),
  closePrefsModal: vi.fn(),
  currentPlayerPreference: null,
  canEditPreferences: false,
  progressStats: null,
  currentPlayerRef: { current: null },
  isCurrentPlayerVisible: true,
  scrollToCurrentPlayer: vi.fn(),
  pendingContractModification: null,
  selectedPlayerForStats: null,
  setSelectedPlayerForStats: vi.fn(),
  handleSetOrder: mockHandleSetOrder,
  handleGenerateBoard: mockHandleGenerateBoard,
  handleStartRubata: mockHandleStartRubata,
  handleUpdateTimers: mockHandleUpdateTimers,
  handlePause: mockHandlePause,
  handleResume: mockHandleResume,
  handleAdvance: mockHandleAdvance,
  handleGoBack: mockHandleGoBack,
  handleCloseAuction: mockHandleCloseAuction,
  handleCompleteRubata: vi.fn(),
  handleMakeOffer: mockHandleMakeOffer,
  handleBid: mockHandleBid,
  handleSetReady: mockHandleSetReady,
  handleForceAllReady: vi.fn(),
  handleAcknowledgeWithAppeal: vi.fn(),
  handleForceAllAcknowledge: vi.fn(),
  handleAcknowledgeAppealDecision: vi.fn(),
  handleMarkReadyToResume: vi.fn(),
  handleForceAllAppealAcks: vi.fn(),
  handleForceAllReadyResume: vi.fn(),
  handleSimulateAppeal: vi.fn(),
  handleContractModification: vi.fn(),
  handleSkipContractModification: vi.fn(),
  handleSimulateOffer: vi.fn(),
  handleSimulateBid: vi.fn(),
  handleSavePreference: vi.fn(),
  handleDeletePreference: vi.fn(),
  setError: mockSetError,
  loadData: mockLoadData,
}

let hookOverrides: Partial<typeof defaultHookReturn> = {}

vi.mock('../hooks/useRubataState', () => ({
  useRubataState: () => ({ ...defaultHookReturn, ...hookOverrides }),
}))

// Lucide icon mock
vi.mock('lucide-react', () => ({
  Settings: () => <span data-testid="settings-icon">Settings</span>,
}))

import { Rubata } from '../pages/Rubata'

describe('Rubata', () => {
  const mockOnNavigate = vi.fn()
  const leagueId = 'league1'

  beforeEach(() => {
    vi.clearAllMocks()
    hookOverrides = {}
  })

  // ---- Loading state ----
  it('renders loading spinner when isLoading is true', () => {
    hookOverrides = { isLoading: true }

    render(<Rubata leagueId={leagueId} onNavigate={mockOnNavigate} />)

    expect(screen.getByTestId('navigation')).toBeInTheDocument()
    expect(screen.getByTestId('navigation').getAttribute('data-page')).toBe('rubata')
    // The loading spinner has the animate-spin class
    const spinner = document.querySelector('.animate-spin')
    expect(spinner).toBeTruthy()
  })

  // ---- Phase not active ----
  it('shows "Fase RUBATA non attiva" when isRubataPhase is false', () => {
    hookOverrides = { isRubataPhase: false }

    render(<Rubata leagueId={leagueId} onNavigate={mockOnNavigate} />)

    expect(screen.getByText('Fase RUBATA non attiva')).toBeInTheDocument()
    expect(screen.getByText(/La fase rubata inizierà dopo il consolidamento/)).toBeInTheDocument()
  })

  // ---- Error display ----
  it('displays error message and retry button when error is set', async () => {
    const user = userEvent.setup()
    hookOverrides = { isRubataPhase: true, isOrderSet: false, isAdmin: true, error: 'Test error message' }

    render(<Rubata leagueId={leagueId} onNavigate={mockOnNavigate} />)

    expect(screen.getByText('Test error message')).toBeInTheDocument()
    expect(screen.getByText('Riprova')).toBeInTheDocument()

    await user.click(screen.getByText('Riprova'))
    expect(mockSetError).toHaveBeenCalledWith('')
    expect(mockLoadData).toHaveBeenCalled()
  })

  // ---- Success message ----
  it('displays success message when success is set', () => {
    hookOverrides = { isRubataPhase: true, isOrderSet: false, isAdmin: true, success: 'Operation completed!' }

    render(<Rubata leagueId={leagueId} onNavigate={mockOnNavigate} />)

    expect(screen.getByText('Operation completed!')).toBeInTheDocument()
  })

  // ---- Admin: Setup Order phase ----
  it('shows order setup UI for admin when order is not set', () => {
    hookOverrides = {
      isRubataPhase: true,
      isOrderSet: false,
      isAdmin: true,
      members: [
        { id: 'm1', user: { username: 'Player1' }, teamName: 'Team1' } as never,
        { id: 'm2', user: { username: 'Player2' }, teamName: 'Team2' } as never,
      ],
      orderDraft: ['m1', 'm2'],
    }

    render(<Rubata leagueId={leagueId} onNavigate={mockOnNavigate} />)

    expect(screen.getByText('Ordine Rubata')).toBeInTheDocument()
    expect(screen.getByText(/Trascina i manager per impostare l'ordine/)).toBeInTheDocument()
    expect(screen.getByText('Impostazioni Timer')).toBeInTheDocument()
    expect(screen.getByText('Conferma Ordine')).toBeInTheDocument()
    expect(screen.getByText('Genera Tabellone')).toBeInTheDocument()
  })

  // ---- Admin: Confirm order button triggers handler ----
  it('calls handleSetOrder when "Conferma Ordine" is clicked', async () => {
    const user = userEvent.setup()
    hookOverrides = {
      isRubataPhase: true,
      isOrderSet: false,
      isAdmin: true,
      orderDraft: ['m1'],
      members: [{ id: 'm1', user: { username: 'Player1' }, teamName: 'Team1' } as never],
    }

    render(<Rubata leagueId={leagueId} onNavigate={mockOnNavigate} />)

    await user.click(screen.getByText('Conferma Ordine'))
    expect(mockHandleSetOrder).toHaveBeenCalled()
  })

  // ---- Admin: Generate board button triggers handler ----
  it('calls handleGenerateBoard when "Genera Tabellone" is clicked', async () => {
    const user = userEvent.setup()
    hookOverrides = {
      isRubataPhase: true,
      isOrderSet: false,
      isAdmin: true,
      orderDraft: [],
      members: [],
    }

    render(<Rubata leagueId={leagueId} onNavigate={mockOnNavigate} />)

    await user.click(screen.getByText('Genera Tabellone'))
    expect(mockHandleGenerateBoard).toHaveBeenCalled()
  })

  // ---- Non-admin: Waiting for order ----
  it('shows waiting message for non-admin when order is not set', () => {
    hookOverrides = { isRubataPhase: true, isOrderSet: false, isAdmin: false }

    render(<Rubata leagueId={leagueId} onNavigate={mockOnNavigate} />)

    expect(screen.getByText("In attesa dell'ordine rubata")).toBeInTheDocument()
    expect(screen.getByText(/L'admin della lega sta impostando l'ordine/)).toBeInTheDocument()
  })

  // ---- Board is set: Stepper and Timer panels shown ----
  it('renders board view with stepper and timer panel when order is set', () => {
    hookOverrides = {
      isRubataPhase: true,
      isOrderSet: true,
      boardData: { totalPlayers: 10, currentIndex: 0, memberBudgets: [] } as never,
      board: [],
    }

    render(<Rubata leagueId={leagueId} onNavigate={mockOnNavigate} />)

    expect(screen.getByTestId('rubata-stepper')).toBeInTheDocument()
    expect(screen.getByTestId('rubata-timer-panel')).toBeInTheDocument()
    expect(screen.getByText('Tabellone Rubata')).toBeInTheDocument()
  })

  // ---- Board view shows player count ----
  it('displays correct total player count in board view', () => {
    hookOverrides = {
      isRubataPhase: true,
      isOrderSet: true,
      boardData: { totalPlayers: 42, currentIndex: 0, memberBudgets: [] } as never,
      board: [],
    }

    render(<Rubata leagueId={leagueId} onNavigate={mockOnNavigate} />)

    expect(screen.getByText('42 giocatori in ordine di rubata')).toBeInTheDocument()
  })

  // ---- Ready check panel ----
  it('shows ready check panel with "Sono Pronto" button during READY_CHECK state', async () => {
    const user = userEvent.setup()
    hookOverrides = {
      isRubataPhase: true,
      isOrderSet: true,
      rubataState: 'READY_CHECK',
      boardData: { totalPlayers: 5, currentIndex: 0, memberBudgets: [] } as never,
      board: [],
      readyStatus: {
        readyCount: 2,
        totalMembers: 5,
        userIsReady: false,
        pendingMembers: [
          { id: 'pm1', username: 'UserA', isConnected: true },
          { id: 'pm2', username: 'UserB', isConnected: false },
        ],
      } as never,
    }

    render(<Rubata leagueId={leagueId} onNavigate={mockOnNavigate} />)

    expect(screen.getByText(/Sono Pronto/)).toBeInTheDocument()
    expect(screen.getByText('UserA')).toBeInTheDocument()
    expect(screen.getByText('UserB')).toBeInTheDocument()

    await user.click(screen.getByText(/Sono Pronto/))
    expect(mockHandleSetReady).toHaveBeenCalled()
  })

  // ---- Ready check: already ready ----
  it('shows "Pronto" badge when user is already ready during READY_CHECK', () => {
    hookOverrides = {
      isRubataPhase: true,
      isOrderSet: true,
      rubataState: 'READY_CHECK',
      boardData: { totalPlayers: 5, currentIndex: 0, memberBudgets: [] } as never,
      board: [],
      readyStatus: {
        readyCount: 3,
        totalMembers: 5,
        userIsReady: true,
        pendingMembers: [],
      } as never,
    }

    render(<Rubata leagueId={leagueId} onNavigate={mockOnNavigate} />)

    // The "Pronto" text badge instead of the "Sono Pronto" button
    // When user is ready, the badge with "Pronto" is shown
    expect(screen.getByText(/✓ Pronto/)).toBeInTheDocument()
  })

  // ---- Admin: Mobile FAB shown ----
  it('shows admin FAB button on mobile when board is active and user is admin', () => {
    hookOverrides = {
      isRubataPhase: true,
      isOrderSet: true,
      isAdmin: true,
      boardData: { totalPlayers: 5, currentIndex: 0, memberBudgets: [] } as never,
      board: [],
    }

    render(<Rubata leagueId={leagueId} onNavigate={mockOnNavigate} />)

    // The FAB button shows "Admin" text
    expect(screen.getByText('Admin')).toBeInTheDocument()
    expect(screen.getByTestId('settings-icon')).toBeInTheDocument()
  })

  // ---- Admin: Budget panel renders ----
  it('renders admin panels (budget, timer, simulation) when admin and board active', () => {
    hookOverrides = {
      isRubataPhase: true,
      isOrderSet: true,
      isAdmin: true,
      boardData: {
        totalPlayers: 5,
        currentIndex: 0,
        memberBudgets: [{ memberId: 'm1', teamName: 'Team1', residuo: 100, currentBudget: 200, totalSalaries: 100 }],
      } as never,
      board: [],
    }

    render(<Rubata leagueId={leagueId} onNavigate={mockOnNavigate} />)

    // Desktop panels
    expect(screen.getAllByTestId('budget-panel').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByTestId('timer-settings-panel').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByTestId('bot-simulation-panel').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByTestId('complete-rubata-panel').length).toBeGreaterThanOrEqual(1)
  })

  // ---- Navigation rendered with correct page ----
  it('renders navigation with currentPage "rubata"', () => {
    hookOverrides = { isRubataPhase: false }

    render(<Rubata leagueId={leagueId} onNavigate={mockOnNavigate} />)

    const nav = screen.getByTestId('navigation')
    expect(nav.getAttribute('data-page')).toBe('rubata')
  })
})
