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

// Mock EmptyState
vi.mock('../components/ui/EmptyState', () => ({
  EmptyState: ({ icon, title, description }: { icon?: string; title: string; description?: string }) => (
    <div data-testid="empty-state">
      {icon && <span>{icon}</span>}
      <p>{title}</p>
      {description && <p>{description}</p>}
    </div>
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
    expect(screen.getByText('Caricamento rubata...')).toBeInTheDocument()
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

  // =========================================================================
  // NEW TESTS — Targeting uncovered code paths to increase coverage
  // =========================================================================

  // Helper data factories
  const makeBoardPlayer = (overrides: Record<string, unknown> = {}) => ({
    rosterId: 'r1',
    memberId: 'member2',
    playerId: 'player1',
    playerName: 'Mario Rossi',
    playerPosition: 'C' as const,
    playerTeam: 'Juventus',
    playerQuotation: 25,
    playerAge: 28,
    playerApiFootballId: 123,
    playerComputedStats: null,
    ownerUsername: 'Owner1',
    ownerTeamName: 'Team Owner1',
    rubataPrice: 10,
    contractSalary: 5,
    contractDuration: 3,
    contractClause: 15,
    stolenById: null,
    stolenByUsername: null,
    stolenPrice: null,
    ...overrides,
  })

  const makeStolenPlayer = (overrides: Record<string, unknown> = {}) => makeBoardPlayer({
    rosterId: 'r2',
    playerId: 'player2',
    playerName: 'Luca Bianchi',
    playerPosition: 'A' as const,
    playerTeam: 'Milan',
    playerAge: 22,
    stolenById: 'member3',
    stolenByUsername: 'Thief99',
    stolenPrice: 20,
    rubataPrice: 8,
    contractDuration: 1,
    ...overrides,
  })

  const makeNoPhotoPlayer = (overrides: Record<string, unknown> = {}) => makeBoardPlayer({
    rosterId: 'r3',
    playerId: 'player3',
    playerName: 'Paolo Verdi',
    playerPosition: 'D' as const,
    playerTeam: 'Inter',
    playerAge: 35,
    playerApiFootballId: null,
    contractDuration: 2,
    ...overrides,
  })

  const makeMyPlayer = (overrides: Record<string, unknown> = {}) => makeBoardPlayer({
    rosterId: 'r4',
    playerId: 'player4',
    playerName: 'Il Mio Giocatore',
    memberId: 'member1',
    playerAge: null,
    ...overrides,
  })

  const makeBudgets = () => [
    { memberId: 'm1', teamName: 'Team1', residuo: 100, currentBudget: 200, totalSalaries: 100, username: 'User1' },
    { memberId: 'm2', teamName: 'Team2', residuo: 40, currentBudget: 150, totalSalaries: 110, username: 'User2' },
    { memberId: 'm3', teamName: 'Team3', residuo: -5, currentBudget: 95, totalSalaries: 100, username: 'User3' },
    { memberId: 'm4', teamName: 'Team4', residuo: 200, currentBudget: 300, totalSalaries: 100, username: 'User4' },
    { memberId: 'm5', teamName: 'Team5', residuo: 10, currentBudget: 110, totalSalaries: 100, username: 'User5' },
  ]

  // ---- SortableOrderItem move buttons ----
  it('calls moveInOrder("up") when up-arrow button clicked in order setup', async () => {
    const user = userEvent.setup()
    hookOverrides = {
      isRubataPhase: true,
      isOrderSet: false,
      isAdmin: true,
      members: [
        { id: 'm1', user: { username: 'Alice' }, teamName: 'TeamA' } as never,
        { id: 'm2', user: { username: 'Bob' }, teamName: 'TeamB' } as never,
      ],
      orderDraft: ['m1', 'm2'],
    }

    render(<Rubata leagueId={leagueId} onNavigate={mockOnNavigate} />)

    // Bob is at index 1 -> "Sposta Bob in su" should be enabled
    const upBtn = screen.getByLabelText('Sposta Bob in su')
    expect(upBtn).not.toBeDisabled()
    await user.click(upBtn)
    expect(mockMoveInOrder).toHaveBeenCalledWith(1, 'up')
  })

  it('calls moveInOrder("down") when down-arrow button clicked in order setup', async () => {
    const user = userEvent.setup()
    hookOverrides = {
      isRubataPhase: true,
      isOrderSet: false,
      isAdmin: true,
      members: [
        { id: 'm1', user: { username: 'Alice' }, teamName: 'TeamA' } as never,
        { id: 'm2', user: { username: 'Bob' }, teamName: 'TeamB' } as never,
      ],
      orderDraft: ['m1', 'm2'],
    }

    render(<Rubata leagueId={leagueId} onNavigate={mockOnNavigate} />)

    // Alice is at index 0 -> "Sposta Alice in giù" should be enabled
    const downBtn = screen.getByLabelText('Sposta Alice in giù')
    expect(downBtn).not.toBeDisabled()
    await user.click(downBtn)
    expect(mockMoveInOrder).toHaveBeenCalledWith(0, 'down')
  })

  it('disables up button for first member and down button for last member in order draft', () => {
    hookOverrides = {
      isRubataPhase: true,
      isOrderSet: false,
      isAdmin: true,
      members: [
        { id: 'm1', user: { username: 'Alice' }, teamName: 'TeamA' } as never,
        { id: 'm2', user: { username: 'Bob' }, teamName: 'TeamB' } as never,
      ],
      orderDraft: ['m1', 'm2'],
    }

    render(<Rubata leagueId={leagueId} onNavigate={mockOnNavigate} />)

    // First member: up is disabled
    expect(screen.getByLabelText('Sposta Alice in su')).toBeDisabled()
    // Last member: down is disabled
    expect(screen.getByLabelText('Sposta Bob in giù')).toBeDisabled()
  })

  // ---- isSubmitting state shows "Salvando..." ----
  it('shows "Salvando..." text on confirm order button when isSubmitting is true', () => {
    hookOverrides = {
      isRubataPhase: true,
      isOrderSet: false,
      isAdmin: true,
      isSubmitting: true,
      members: [{ id: 'm1', user: { username: 'Alice' }, teamName: 'TeamA' } as never],
      orderDraft: ['m1'],
    }

    render(<Rubata leagueId={leagueId} onNavigate={mockOnNavigate} />)

    expect(screen.getByText('Salvando...')).toBeInTheDocument()
  })

  // ---- Timer settings: "Salva Timer" button ----
  it('calls handleUpdateTimers when "Salva Timer" button is clicked in setup', async () => {
    const user = userEvent.setup()
    hookOverrides = {
      isRubataPhase: true,
      isOrderSet: false,
      isAdmin: true,
      members: [],
      orderDraft: [],
    }

    render(<Rubata leagueId={leagueId} onNavigate={mockOnNavigate} />)

    await user.click(screen.getByText('Salva Timer'))
    expect(mockHandleUpdateTimers).toHaveBeenCalled()
  })

  // ---- PAUSED state with ready status ----
  it('renders PAUSED state panel with ready check and "Sono Pronto" button', async () => {
    const user = userEvent.setup()
    hookOverrides = {
      isRubataPhase: true,
      isOrderSet: true,
      rubataState: 'PAUSED',
      boardData: {
        totalPlayers: 5,
        currentIndex: 0,
        memberBudgets: [],
        pausedRemainingSeconds: 22,
        pausedFromState: 'AUCTION',
      } as never,
      board: [],
      readyStatus: {
        readyCount: 1,
        totalMembers: 3,
        userIsReady: false,
        pendingMembers: [
          { id: 'pm1', username: 'WaitingUser', isConnected: true },
        ],
      } as never,
    }

    render(<Rubata leagueId={leagueId} onNavigate={mockOnNavigate} />)

    expect(screen.getByText('IN PAUSA')).toBeInTheDocument()
    expect(screen.getByText(/22s rimanenti/)).toBeInTheDocument()
    expect(screen.getByText(/Asta/)).toBeInTheDocument()
    expect(screen.getByText(/Pronti a riprendere\?/)).toBeInTheDocument()
    expect(screen.getByText('WaitingUser')).toBeInTheDocument()

    // Click "Sono Pronto"
    const readyBtns = screen.getAllByText(/Sono Pronto/)
    await user.click(readyBtns[0])
    expect(mockHandleSetReady).toHaveBeenCalled()
  })

  it('renders PAUSED state with "Pronto" badge when user is already ready', () => {
    hookOverrides = {
      isRubataPhase: true,
      isOrderSet: true,
      rubataState: 'PAUSED',
      boardData: {
        totalPlayers: 5,
        currentIndex: 0,
        memberBudgets: [],
        pausedRemainingSeconds: 10,
        pausedFromState: 'OFFERING',
      } as never,
      board: [],
      readyStatus: {
        readyCount: 2,
        totalMembers: 3,
        userIsReady: true,
        pendingMembers: [],
      } as never,
    }

    render(<Rubata leagueId={leagueId} onNavigate={mockOnNavigate} />)

    expect(screen.getByText('IN PAUSA')).toBeInTheDocument()
    expect(screen.getByText(/Offerta/)).toBeInTheDocument()
    // Should show "Pronto" badge
    const prontoBadges = screen.getAllByText(/✓ Pronto/)
    expect(prontoBadges.length).toBeGreaterThanOrEqual(1)
  })

  it('renders PAUSED state with admin ForceAllReady button', async () => {
    const user = userEvent.setup()
    const mockForceAllReady = vi.fn()
    hookOverrides = {
      isRubataPhase: true,
      isOrderSet: true,
      isAdmin: true,
      rubataState: 'PAUSED',
      boardData: {
        totalPlayers: 5,
        currentIndex: 0,
        memberBudgets: [],
        pausedRemainingSeconds: null,
      } as never,
      board: [],
      readyStatus: {
        readyCount: 1,
        totalMembers: 3,
        userIsReady: false,
        pendingMembers: [],
      } as never,
      handleForceAllReady: mockForceAllReady,
    }

    render(<Rubata leagueId={leagueId} onNavigate={mockOnNavigate} />)

    // Admin sees "Forza Tutti Pronti" buttons
    const forceButtons = screen.getAllByText(/Forza Tutti Pronti/)
    expect(forceButtons.length).toBeGreaterThanOrEqual(1)
    await user.click(forceButtons[0])
    expect(mockForceAllReady).toHaveBeenCalled()
  })

  // ---- Admin: ForceAllReady in READY_CHECK ----
  it('shows admin "Forza Tutti Pronti" button in READY_CHECK state and calls handler', async () => {
    const user = userEvent.setup()
    const mockForceAll = vi.fn()
    hookOverrides = {
      isRubataPhase: true,
      isOrderSet: true,
      isAdmin: true,
      rubataState: 'READY_CHECK',
      boardData: { totalPlayers: 5, currentIndex: 0, memberBudgets: [] } as never,
      board: [],
      readyStatus: {
        readyCount: 1,
        totalMembers: 5,
        userIsReady: false,
        pendingMembers: [],
      } as never,
      handleForceAllReady: mockForceAll,
    }

    render(<Rubata leagueId={leagueId} onNavigate={mockOnNavigate} />)

    const forceBtn = screen.getByText(/Forza Tutti Pronti/)
    expect(forceBtn).toBeInTheDocument()
    await user.click(forceBtn)
    expect(mockForceAll).toHaveBeenCalled()
  })

  // ---- Active Auction panel renders ----
  it('renders RubataBidPanel when in AUCTION state with an active auction', () => {
    hookOverrides = {
      isRubataPhase: true,
      isOrderSet: true,
      rubataState: 'AUCTION',
      activeAuction: {
        id: 'auction1',
        player: { id: 'p1', name: 'Test Player', team: 'Napoli', position: 'A' },
        basePrice: 10,
        currentPrice: 15,
        sellerId: 'seller1',
        bids: [{ amount: 15, bidder: 'Bidder1', bidderId: 'b1', isWinning: true }],
      } as never,
      boardData: { totalPlayers: 10, currentIndex: 3, memberBudgets: [] } as never,
      board: [],
    }

    render(<Rubata leagueId={leagueId} onNavigate={mockOnNavigate} />)

    expect(screen.getByTestId('rubata-bid-panel')).toBeInTheDocument()
  })

  // ---- Board cards with players ----
  it('renders board cards with player entries including current, passed, and stolen players', () => {
    const players = [
      makeStolenPlayer(), // index 0 - passed+stolen
      makeBoardPlayer(), // index 1 - current
      makeNoPhotoPlayer(), // index 2 - future
    ]

    hookOverrides = {
      isRubataPhase: true,
      isOrderSet: true,
      boardData: { totalPlayers: 3, currentIndex: 1, memberBudgets: [] } as never,
      board: players as never[],
    }

    render(<Rubata leagueId={leagueId} onNavigate={mockOnNavigate} />)

    // Player names rendered
    expect(screen.getAllByText('Luca Bianchi').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Mario Rossi').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Paolo Verdi').length).toBeGreaterThanOrEqual(1)

    // Stolen player shows thief name
    expect(screen.getAllByText(/Thief99/).length).toBeGreaterThanOrEqual(1)
  })

  // ---- Board: player with no apiFootballId renders fallback position badge ----
  it('renders position badge fallback when player has no apiFootballId', () => {
    hookOverrides = {
      isRubataPhase: true,
      isOrderSet: true,
      boardData: { totalPlayers: 1, currentIndex: 0, memberBudgets: [] } as never,
      board: [makeNoPhotoPlayer()] as never[],
    }

    render(<Rubata leagueId={leagueId} onNavigate={mockOnNavigate} />)

    // No <img> element should exist for this player
    const images = document.querySelectorAll('img')
    expect(images.length).toBe(0)
  })

  // ---- Board: "Mio" label for own player in strategy column ----
  it('shows "Mio" label for own player in strategy column', () => {
    hookOverrides = {
      isRubataPhase: true,
      isOrderSet: true,
      boardData: { totalPlayers: 1, currentIndex: 0, memberBudgets: [] } as never,
      board: [makeMyPlayer()] as never[],
      myMemberId: 'member1',
    }

    render(<Rubata leagueId={leagueId} onNavigate={mockOnNavigate} />)

    expect(screen.getAllByText('Mio').length).toBeGreaterThanOrEqual(1)
  })

  // ---- Board: preference indicators in strategy column ----
  it('shows preference indicators (priority stars, maxBid, notes) in strategy column', () => {
    const prefMap = new Map()
    prefMap.set('player1', { priority: 3, maxBid: 50, notes: 'Must have' })

    hookOverrides = {
      isRubataPhase: true,
      isOrderSet: true,
      boardData: { totalPlayers: 1, currentIndex: 0, memberBudgets: [] } as never,
      board: [makeBoardPlayer()] as never[],
      preferencesMap: prefMap,
      canEditPreferences: true,
    }

    render(<Rubata leagueId={leagueId} onNavigate={mockOnNavigate} />)

    // Priority stars: 3 stars
    expect(screen.getAllByText('★★★').length).toBeGreaterThanOrEqual(1)
    // Max bid
    expect(screen.getAllByText('Max: 50M').length).toBeGreaterThanOrEqual(1)
  })

  // ---- Board: preference with only notes (no priority/maxBid) shows notebook icon ----
  it('shows notes icon when preference has only notes', () => {
    const prefMap = new Map()
    prefMap.set('player1', { priority: null, maxBid: null, notes: 'Interesting player' })

    hookOverrides = {
      isRubataPhase: true,
      isOrderSet: true,
      boardData: { totalPlayers: 1, currentIndex: 0, memberBudgets: [] } as never,
      board: [makeBoardPlayer()] as never[],
      preferencesMap: prefMap,
      canEditPreferences: false,
    }

    render(<Rubata leagueId={leagueId} onNavigate={mockOnNavigate} />)

    // Strategy section shows notes emoji
    const noteIcons = document.querySelectorAll('[title="Interesting player"]')
    expect(noteIcons.length).toBeGreaterThanOrEqual(1)
  })

  // ---- Board: "Nessuna strategia" label for no-pref player ----
  it('shows "Nessuna strategia" in card view for player without preference', () => {
    hookOverrides = {
      isRubataPhase: true,
      isOrderSet: true,
      boardData: { totalPlayers: 1, currentIndex: 0, memberBudgets: [] } as never,
      board: [makeBoardPlayer()] as never[],
      preferencesMap: new Map(),
      canEditPreferences: false,
    }

    render(<Rubata leagueId={leagueId} onNavigate={mockOnNavigate} />)

    expect(screen.getAllByText('Nessuna strategia').length).toBeGreaterThanOrEqual(1)
  })

  // ---- Board: edit preference button calls openPrefsModal ----
  it('renders strategy edit button when canEditPreferences is true', () => {
    hookOverrides = {
      isRubataPhase: true,
      isOrderSet: true,
      boardData: { totalPlayers: 1, currentIndex: 0, memberBudgets: [] } as never,
      board: [makeBoardPlayer()] as never[],
      preferencesMap: new Map(),
      canEditPreferences: true,
    }

    render(<Rubata leagueId={leagueId} onNavigate={mockOnNavigate} />)

    const strategyBtns = screen.getAllByTitle('Imposta strategia')
    expect(strategyBtns.length).toBeGreaterThanOrEqual(1)
  })

  // ---- Mobile: "SUL PIATTO" badge for current player ----
  it('shows "SUL PIATTO" badge on mobile for the current player', () => {
    hookOverrides = {
      isRubataPhase: true,
      isOrderSet: true,
      boardData: { totalPlayers: 1, currentIndex: 0, memberBudgets: [] } as never,
      board: [makeBoardPlayer()] as never[],
    }

    render(<Rubata leagueId={leagueId} onNavigate={mockOnNavigate} />)

    expect(screen.getAllByText('SUL PIATTO').length).toBeGreaterThanOrEqual(1)
  })

  // ---- Mobile: passed and not stolen shows "Non rubato" ----
  it('shows "Non rubato" for passed players that were not stolen in mobile view', () => {
    hookOverrides = {
      isRubataPhase: true,
      isOrderSet: true,
      boardData: { totalPlayers: 2, currentIndex: 1, memberBudgets: [] } as never,
      board: [makeBoardPlayer({ rosterId: 'passed1' }), makeBoardPlayer({ rosterId: 'r-current' })] as never[],
    }

    render(<Rubata leagueId={leagueId} onNavigate={mockOnNavigate} />)

    expect(screen.getAllByText(/Non rubato/).length).toBeGreaterThanOrEqual(1)
  })

  // ---- Mobile: stolen player shows stolen price when higher than rubata price ----
  it('shows stolen price on mobile when stolenPrice > rubataPrice', () => {
    hookOverrides = {
      isRubataPhase: true,
      isOrderSet: true,
      boardData: { totalPlayers: 2, currentIndex: 1, memberBudgets: [] } as never,
      board: [
        makeStolenPlayer({ stolenPrice: 20, rubataPrice: 8 }),
        makeBoardPlayer({ rosterId: 'r-current' }),
      ] as never[],
    }

    render(<Rubata leagueId={leagueId} onNavigate={mockOnNavigate} />)

    // Shows "(20M)" next to stolen player
    expect(screen.getAllByText('(20M)').length).toBeGreaterThanOrEqual(1)
  })

  // ---- Scroll to current player button ----
  it('renders scroll-to-current-player button when current player is not visible', () => {
    hookOverrides = {
      isRubataPhase: true,
      isOrderSet: true,
      isCurrentPlayerVisible: false,
      currentPlayer: makeBoardPlayer({ playerName: 'Federico Chiesa' }) as never,
      boardData: { totalPlayers: 5, currentIndex: 2, memberBudgets: [] } as never,
      board: [],
    }

    render(<Rubata leagueId={leagueId} onNavigate={mockOnNavigate} />)

    // Should show button with player's last name
    expect(screen.getByText(/Torna a Chiesa/)).toBeInTheDocument()
  })

  it('does NOT render scroll button when current player IS visible', () => {
    hookOverrides = {
      isRubataPhase: true,
      isOrderSet: true,
      isCurrentPlayerVisible: true,
      currentPlayer: makeBoardPlayer({ playerName: 'Federico Chiesa' }) as never,
      boardData: { totalPlayers: 5, currentIndex: 2, memberBudgets: [] } as never,
      board: [],
    }

    render(<Rubata leagueId={leagueId} onNavigate={mockOnNavigate} />)

    expect(screen.queryByText(/Torna a Chiesa/)).not.toBeInTheDocument()
  })

  it('calls scrollToCurrentPlayer when scroll button is clicked', async () => {
    const user = userEvent.setup()
    const mockScroll = vi.fn()
    hookOverrides = {
      isRubataPhase: true,
      isOrderSet: true,
      isCurrentPlayerVisible: false,
      currentPlayer: makeBoardPlayer({ playerName: 'Federico Chiesa' }) as never,
      scrollToCurrentPlayer: mockScroll,
      boardData: { totalPlayers: 5, currentIndex: 2, memberBudgets: [] } as never,
      board: [],
    }

    render(<Rubata leagueId={leagueId} onNavigate={mockOnNavigate} />)

    await user.click(screen.getByText(/Torna a Chiesa/))
    expect(mockScroll).toHaveBeenCalled()
  })

  // ---- Mobile Admin FAB opens BottomSheet ----
  it('opens admin BottomSheet when mobile FAB is clicked', async () => {
    const user = userEvent.setup()
    hookOverrides = {
      isRubataPhase: true,
      isOrderSet: true,
      isAdmin: true,
      boardData: {
        totalPlayers: 5,
        currentIndex: 0,
        memberBudgets: [{ memberId: 'm1', teamName: 'T1', residuo: 100, currentBudget: 200, totalSalaries: 100 }],
      } as never,
      board: [],
    }

    render(<Rubata leagueId={leagueId} onNavigate={mockOnNavigate} />)

    // Click the FAB
    await user.click(screen.getByText('Admin'))

    // The BottomSheet should now be open with title "Controlli Admin"
    expect(screen.getByTestId('bottom-sheet')).toBeInTheDocument()
    expect(screen.getByText('Controlli Admin')).toBeInTheDocument()
  })

  // ---- Mobile Budget Footer renders ----
  it('renders mobile budget footer when budgets are available and board is active', () => {
    hookOverrides = {
      isRubataPhase: true,
      isOrderSet: true,
      boardData: {
        totalPlayers: 5,
        currentIndex: 0,
        memberBudgets: makeBudgets(),
      } as never,
      board: [],
    }

    render(<Rubata leagueId={leagueId} onNavigate={mockOnNavigate} />)

    // Budget footer shows team names (first 4 when collapsed)
    expect(screen.getAllByText('Team1').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Team2').length).toBeGreaterThanOrEqual(1)
    // Shows residuo values
    expect(screen.getAllByText('100M').length).toBeGreaterThanOrEqual(1)
    // Shows expand button
    expect(screen.getAllByText(/Espandi/).length).toBeGreaterThanOrEqual(1)
  })

  // ---- Contract Modification Modal ----
  it('renders ContractModifierModal when pendingContractModification is set', () => {
    hookOverrides = {
      isRubataPhase: true,
      isOrderSet: true,
      boardData: { totalPlayers: 5, currentIndex: 0, memberBudgets: [] } as never,
      board: [],
      pendingContractModification: {
        contractId: 'c1',
        rosterId: 'r1',
        playerId: 'p1',
        playerName: 'Contracted Player',
        playerTeam: 'Roma',
        playerPosition: 'C',
        salary: 10,
        duration: 3,
        initialSalary: 8,
        rescissionClause: 20,
      } as never,
    }

    render(<Rubata leagueId={leagueId} onNavigate={mockOnNavigate} />)

    expect(screen.getByTestId('contract-modifier-modal')).toBeInTheDocument()
  })

  // ---- PlayerStatsModal renders when player selected ----
  it('renders PlayerStatsModal when selectedPlayerForStats is set', () => {
    hookOverrides = {
      isRubataPhase: true,
      isOrderSet: true,
      boardData: { totalPlayers: 5, currentIndex: 0, memberBudgets: [] } as never,
      board: [],
      selectedPlayerForStats: {
        name: 'Stats Player',
        team: 'Lazio',
        position: 'A',
        quotation: 30,
        age: 25,
        apiFootballId: 456,
        computedStats: null,
      } as never,
    }

    render(<Rubata leagueId={leagueId} onNavigate={mockOnNavigate} />)

    expect(screen.getByTestId('player-stats-modal')).toBeInTheDocument()
  })

  // ---- PlayerStatsModal does NOT render when no player selected ----
  it('does NOT render PlayerStatsModal when selectedPlayerForStats is null', () => {
    hookOverrides = {
      isRubataPhase: true,
      isOrderSet: true,
      boardData: { totalPlayers: 5, currentIndex: 0, memberBudgets: [] } as never,
      board: [],
      selectedPlayerForStats: null,
    }

    render(<Rubata leagueId={leagueId} onNavigate={mockOnNavigate} />)

    expect(screen.queryByTestId('player-stats-modal')).not.toBeInTheDocument()
  })

  // ---- PENDING_ACK modal renders ----
  it('renders PendingAckModal when rubataState is PENDING_ACK and pendingAck exists', () => {
    hookOverrides = {
      isRubataPhase: true,
      isOrderSet: true,
      rubataState: 'PENDING_ACK',
      boardData: { totalPlayers: 5, currentIndex: 0, memberBudgets: [] } as never,
      board: [],
      pendingAck: {
        auctionId: 'a1',
        player: { id: 'p1', name: 'Acked Player', team: 'Napoli', position: 'A' },
        winner: { id: 'w1', username: 'Winner' },
        seller: { id: 's1', username: 'Seller' },
        finalPrice: 15,
        acknowledgedMembers: [],
        pendingMembers: [],
        totalMembers: 5,
        totalAcknowledged: 3,
        userAcknowledged: false,
        allAcknowledged: false,
      } as never,
    }

    render(<Rubata leagueId={leagueId} onNavigate={mockOnNavigate} />)

    expect(screen.getByTestId('pending-ack-modal')).toBeInTheDocument()
  })

  // ---- Appeal modals ----
  it('renders AppealReviewModal when appealStatus has APPEAL_REVIEW status', () => {
    hookOverrides = {
      isRubataPhase: true,
      isOrderSet: true,
      boardData: { totalPlayers: 5, currentIndex: 0, memberBudgets: [] } as never,
      board: [],
      appealStatus: {
        auctionId: 'a1',
        auctionStatus: 'APPEAL_REVIEW',
        hasActiveAppeal: true,
        appeal: { id: 'ap1', status: 'PENDING', reason: 'Unfair bid' },
        userHasAcked: false,
        appealDecisionAcks: [],
        allMembers: [],
        userIsReady: false,
        resumeReadyMembers: [],
      } as never,
    }

    render(<Rubata leagueId={leagueId} onNavigate={mockOnNavigate} />)

    expect(screen.getByTestId('appeal-review-modal')).toBeInTheDocument()
  })

  it('renders AppealAckModal when appealStatus has AWAITING_APPEAL_ACK status', () => {
    hookOverrides = {
      isRubataPhase: true,
      isOrderSet: true,
      boardData: { totalPlayers: 5, currentIndex: 0, memberBudgets: [] } as never,
      board: [],
      appealStatus: {
        auctionId: 'a1',
        auctionStatus: 'AWAITING_APPEAL_ACK',
        hasActiveAppeal: true,
        appeal: { id: 'ap1', status: 'APPROVED', reason: 'Unfair bid' },
        userHasAcked: false,
        appealDecisionAcks: [],
        allMembers: [],
        userIsReady: false,
        resumeReadyMembers: [],
      } as never,
    }

    render(<Rubata leagueId={leagueId} onNavigate={mockOnNavigate} />)

    expect(screen.getByTestId('appeal-ack-modal')).toBeInTheDocument()
  })

  it('renders AwaitingResumeModal when appealStatus has AWAITING_RESUME status', () => {
    hookOverrides = {
      isRubataPhase: true,
      isOrderSet: true,
      boardData: { totalPlayers: 5, currentIndex: 0, memberBudgets: [] } as never,
      board: [],
      appealStatus: {
        auctionId: 'a1',
        auctionStatus: 'AWAITING_RESUME',
        hasActiveAppeal: false,
        appeal: null,
        userHasAcked: true,
        appealDecisionAcks: [],
        allMembers: [],
        userIsReady: false,
        resumeReadyMembers: [],
      } as never,
    }

    render(<Rubata leagueId={leagueId} onNavigate={mockOnNavigate} />)

    expect(screen.getByTestId('awaiting-resume-modal')).toBeInTheDocument()
  })

  // ---- AuctionReadyCheckModal ----
  it('renders AuctionReadyCheckModal when rubataState is AUCTION_READY_CHECK', () => {
    hookOverrides = {
      isRubataPhase: true,
      isOrderSet: true,
      rubataState: 'AUCTION_READY_CHECK',
      boardData: { totalPlayers: 5, currentIndex: 0, memberBudgets: [] } as never,
      board: [],
      readyStatus: {
        readyCount: 2,
        totalMembers: 5,
        userIsReady: false,
        pendingMembers: [],
      } as never,
    }

    render(<Rubata leagueId={leagueId} onNavigate={mockOnNavigate} />)

    expect(screen.getByTestId('auction-ready-check-modal')).toBeInTheDocument()
  })

  // ---- PreferenceModal shown when selectedPlayerForPrefs is set ----
  it('renders PreferenceModal when selectedPlayerForPrefs is set', () => {
    hookOverrides = {
      isRubataPhase: true,
      isOrderSet: true,
      boardData: { totalPlayers: 5, currentIndex: 0, memberBudgets: [] } as never,
      board: [],
      selectedPlayerForPrefs: makeBoardPlayer() as never,
    }

    render(<Rubata leagueId={leagueId} onNavigate={mockOnNavigate} />)

    expect(screen.getByTestId('preference-modal')).toBeInTheDocument()
  })

  // ---- Board: player age brackets render in card view ----
  it('renders player ages in card view for different age brackets', () => {
    const youngPlayer = makeBoardPlayer({ rosterId: 'ry', playerAge: 21, playerName: 'Young' })
    const midPlayer = makeBoardPlayer({ rosterId: 'rm', playerAge: 26, playerName: 'Mid', playerId: 'p-mid' })
    const seniorPlayer = makeBoardPlayer({ rosterId: 'rs', playerAge: 29, playerName: 'Senior', playerId: 'p-senior' })
    const oldPlayer = makeBoardPlayer({ rosterId: 'ro', playerAge: 33, playerName: 'Old', playerId: 'p-old' })

    hookOverrides = {
      isRubataPhase: true,
      isOrderSet: true,
      boardData: { totalPlayers: 4, currentIndex: 4, memberBudgets: [] } as never,
      board: [youngPlayer, midPlayer, seniorPlayer, oldPlayer] as never[],
    }

    render(<Rubata leagueId={leagueId} onNavigate={mockOnNavigate} />)

    // All ages appear in card format (e.g. "21a", "26a")
    expect(screen.getAllByText(/21a/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/26a/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/29a/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/33a/).length).toBeGreaterThanOrEqual(1)
  })

  // ---- Board: owner team name shown in mobile view ----
  it('shows owner team name in mobile card view', () => {
    hookOverrides = {
      isRubataPhase: true,
      isOrderSet: true,
      boardData: { totalPlayers: 1, currentIndex: 0, memberBudgets: [] } as never,
      board: [makeBoardPlayer({ ownerTeamName: 'FC Fantastica' })] as never[],
    }

    render(<Rubata leagueId={leagueId} onNavigate={mockOnNavigate} />)

    expect(screen.getAllByText('(FC Fantastica)').length).toBeGreaterThanOrEqual(1)
  })

  // ---- Board: contract duration color coding ----
  it('renders contract duration with color coding for different values', () => {
    const d1 = makeBoardPlayer({ rosterId: 'd1', contractDuration: 1, playerId: 'pd1' })
    const d2 = makeBoardPlayer({ rosterId: 'd2', contractDuration: 2, playerId: 'pd2' })
    const d4 = makeBoardPlayer({ rosterId: 'd4', contractDuration: 4, playerId: 'pd4' })

    hookOverrides = {
      isRubataPhase: true,
      isOrderSet: true,
      boardData: { totalPlayers: 3, currentIndex: 3, memberBudgets: [] } as never,
      board: [d1, d2, d4] as never[],
    }

    render(<Rubata leagueId={leagueId} onNavigate={mockOnNavigate} />)

    // Contract durations in mobile view have "s" suffix
    expect(screen.getAllByText('1s').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('2s').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('4s').length).toBeGreaterThanOrEqual(1)
  })

  // ---- BottomSheet: admin panels inside the sheet ----
  it('renders admin panels inside BottomSheet when sheet is opened by admin', async () => {
    const user = userEvent.setup()
    hookOverrides = {
      isRubataPhase: true,
      isOrderSet: true,
      isAdmin: true,
      boardData: {
        totalPlayers: 5,
        currentIndex: 0,
        memberBudgets: makeBudgets(),
      } as never,
      board: [],
    }

    render(<Rubata leagueId={leagueId} onNavigate={mockOnNavigate} />)

    // Open the BottomSheet via FAB
    await user.click(screen.getByText('Admin'))

    // Verify the BottomSheet is open and contains admin panels
    const sheet = screen.getByTestId('bottom-sheet')
    expect(sheet).toBeInTheDocument()

    // Inside the BottomSheet, admin panels should be rendered
    // Budget, Timer, Bot Simulation, and CompleteRubata panels
    const budgetPanels = screen.getAllByTestId('budget-panel')
    expect(budgetPanels.length).toBeGreaterThanOrEqual(2) // desktop + bottom sheet
    const timerPanels = screen.getAllByTestId('timer-settings-panel')
    expect(timerPanels.length).toBeGreaterThanOrEqual(2)
    const botPanels = screen.getAllByTestId('bot-simulation-panel')
    expect(botPanels.length).toBeGreaterThanOrEqual(2)
    const completePanels = screen.getAllByTestId('complete-rubata-panel')
    expect(completePanels.length).toBeGreaterThanOrEqual(2)
  })

  // ---- Mobile Budget Footer: expanded state shows "Chiudi" ----
  it('shows expanded budget footer with "Chiudi" button when mobileBudgetExpanded is true', () => {
    hookOverrides = {
      isRubataPhase: true,
      isOrderSet: true,
      mobileBudgetExpanded: true,
      boardData: {
        totalPlayers: 5,
        currentIndex: 0,
        memberBudgets: makeBudgets(),
      } as never,
      board: [],
    }

    render(<Rubata leagueId={leagueId} onNavigate={mockOnNavigate} />)

    // When expanded, shows "Chiudi" text
    expect(screen.getAllByText(/Chiudi/).length).toBeGreaterThanOrEqual(1)
    // Shows all 5 team budgets (not just first 4)
    expect(screen.getAllByText('Team5').length).toBeGreaterThanOrEqual(1)
  })

  // ---- Mobile Budget Footer: negative residuo gets danger styling ----
  it('renders negative residuo with danger styling in mobile budget footer', () => {
    hookOverrides = {
      isRubataPhase: true,
      isOrderSet: true,
      mobileBudgetExpanded: true,
      boardData: {
        totalPlayers: 5,
        currentIndex: 0,
        memberBudgets: makeBudgets(), // Team3 has residuo -5
      } as never,
      board: [],
    }

    render(<Rubata leagueId={leagueId} onNavigate={mockOnNavigate} />)

    // Team3 with negative residuo should be displayed
    expect(screen.getAllByText('-5M').length).toBeGreaterThanOrEqual(1)
  })

  // ---- Mobile Budget Footer: expanded details line ----
  it('shows budget detail line (currentBudget - totalSalaries) when expanded', () => {
    hookOverrides = {
      isRubataPhase: true,
      isOrderSet: true,
      mobileBudgetExpanded: true,
      boardData: {
        totalPlayers: 5,
        currentIndex: 0,
        memberBudgets: [
          { memberId: 'm1', teamName: 'TeamX', residuo: 50, currentBudget: 200, totalSalaries: 150, username: 'UserX' },
        ],
      } as never,
      board: [],
    }

    render(<Rubata leagueId={leagueId} onNavigate={mockOnNavigate} />)

    // When expanded, shows detail line like "200M - 150M"
    expect(screen.getAllByText('200M - 150M').length).toBeGreaterThanOrEqual(1)
  })

  // ---- Mobile: preference with priority + maxBid shown in card view ----
  it('shows strategy indicators in mobile card for player with preferences', () => {
    const prefMap = new Map()
    prefMap.set('player1', { priority: 2, maxBid: 30, notes: null })

    hookOverrides = {
      isRubataPhase: true,
      isOrderSet: true,
      boardData: { totalPlayers: 1, currentIndex: 0, memberBudgets: [] } as never,
      board: [makeBoardPlayer()] as never[],
      preferencesMap: prefMap,
      canEditPreferences: true,
    }

    render(<Rubata leagueId={leagueId} onNavigate={mockOnNavigate} />)

    // Mobile view shows "Max: 30M" text
    expect(screen.getAllByText('Max: 30M').length).toBeGreaterThanOrEqual(1)
    // Shows priority stars
    expect(screen.getAllByText('★★').length).toBeGreaterThanOrEqual(1)
    // Shows mobile strategy button
    expect(screen.getAllByText(/Strategia/).length).toBeGreaterThanOrEqual(1)
  })

  // ---- Board: player with no age omits age from card ----
  it('omits age display when player age is null', () => {
    hookOverrides = {
      isRubataPhase: true,
      isOrderSet: true,
      boardData: { totalPlayers: 1, currentIndex: 0, memberBudgets: [] } as never,
      board: [makeMyPlayer({ playerAge: null })] as never[],
    }

    render(<Rubata leagueId={leagueId} onNavigate={mockOnNavigate} />)

    // Card view omits age when null — no age suffix "a" should appear
    expect(screen.queryByText(/\d+a/)).not.toBeInTheDocument()
  })

  // ---- PAUSED: no pausedRemainingSeconds hides timer info ----
  it('renders PAUSED state without timer info when pausedRemainingSeconds is null', () => {
    hookOverrides = {
      isRubataPhase: true,
      isOrderSet: true,
      rubataState: 'PAUSED',
      boardData: {
        totalPlayers: 5,
        currentIndex: 0,
        memberBudgets: [],
        pausedRemainingSeconds: null,
      } as never,
      board: [],
      readyStatus: {
        readyCount: 0,
        totalMembers: 3,
        userIsReady: false,
        pendingMembers: [],
      } as never,
    }

    render(<Rubata leagueId={leagueId} onNavigate={mockOnNavigate} />)

    expect(screen.getByText('IN PAUSA')).toBeInTheDocument()
    // No remaining seconds shown
    expect(screen.queryByText(/rimanenti/)).not.toBeInTheDocument()
  })
})
