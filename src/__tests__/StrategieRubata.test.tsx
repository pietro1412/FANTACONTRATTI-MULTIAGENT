import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Mocks — must come before component imports
// ---------------------------------------------------------------------------

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  useParams: () => ({ leagueId: 'league1' }),
}))

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
const mockToastError = vi.fn()
const mockToastSuccess = vi.fn()
vi.mock('../components/ui/Toast', () => ({
  useToast: () => ({
    toast: { success: mockToastSuccess, error: mockToastError, warning: vi.fn(), info: vi.fn() },
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

// Mock PlayerStatsModal
vi.mock('../components/PlayerStatsModal', () => ({
  PlayerStatsModal: ({ isOpen }: { isOpen: boolean }) => (
    isOpen ? <div data-testid="player-stats-modal">PlayerStats</div> : null
  ),
}))

// Mock RadarChart
vi.mock('../components/ui/RadarChart', () => ({
  default: () => <div data-testid="radar-chart">RadarChart</div>,
}))

// Mock PositionBadge
vi.mock('../components/ui/PositionBadge', () => ({
  POSITION_COLORS: { P: 'bg-yellow-500', D: 'bg-green-500', C: 'bg-blue-500', A: 'bg-red-500' },
  POSITION_GRADIENTS: { P: 'from-yellow', D: 'from-green', C: 'from-blue', A: 'from-red' },
  POSITION_FILTER_COLORS: { P: 'bg-yellow-500', D: 'bg-green-500', C: 'bg-blue-500', A: 'bg-red-500' },
}))

// Mock team logos
vi.mock('../utils/teamLogos', () => ({
  getTeamLogo: (team: string) => `https://logos/${team}`,
}))

// Mock player images
vi.mock('../utils/player-images', () => ({
  getPlayerPhotoUrl: (id: number) => `https://photo/${id}`,
}))

// Mock player stats service
vi.mock('../services/player-stats.service', () => ({
  AUTO_TAG_DEFS: {},
}))

// Mock API
const mockGetById = vi.fn()
const mockGetAllPlayersForStrategies = vi.fn()
const mockGetAllSvincolatiForStrategies = vi.fn()
const mockSetPreference = vi.fn()

vi.mock('../services/api', () => ({
  rubataApi: {
    getAllPlayersForStrategies: (...args: unknown[]) => mockGetAllPlayersForStrategies(...args),
    getAllSvincolatiForStrategies: (...args: unknown[]) => mockGetAllSvincolatiForStrategies(...args),
    setPreference: (...args: unknown[]) => mockSetPreference(...args),
  },
  leagueApi: {
    getById: (...args: unknown[]) => mockGetById(...args),
  },
}))

import { StrategieRubata } from '../pages/StrategieRubata'

// Sample player data
const sampleOwnedPlayers = [
  {
    rosterId: 'r1',
    memberId: 'myMember1',
    playerId: 'p1',
    playerName: 'Mario Rossi',
    playerPosition: 'A',
    playerTeam: 'Juventus',
    playerQuotation: 25,
    playerAge: 28,
    playerApiFootballId: null,
    playerApiFootballStats: null,
    playerComputedStats: null,
    playerAutoTags: [],
    ownerUsername: 'TestUser',
    ownerTeamName: 'FC Test',
    ownerRubataOrder: 1,
    rubataPrice: 30,
    contractSalary: 5,
    contractDuration: 2,
    contractClause: 10,
    preference: null,
  },
  {
    rosterId: 'r2',
    memberId: 'otherMember1',
    playerId: 'p2',
    playerName: 'Luigi Bianchi',
    playerPosition: 'D',
    playerTeam: 'Milan',
    playerQuotation: 15,
    playerAge: 24,
    playerApiFootballId: null,
    playerApiFootballStats: null,
    playerComputedStats: null,
    playerAutoTags: [],
    ownerUsername: 'Rival',
    ownerTeamName: 'FC Rival',
    ownerRubataOrder: 2,
    rubataPrice: 20,
    contractSalary: 3,
    contractDuration: 3,
    contractClause: 8,
    preference: null,
  },
  {
    rosterId: 'r3',
    memberId: 'otherMember2',
    playerId: 'p3',
    playerName: 'Paolo Verdi',
    playerPosition: 'C',
    playerTeam: 'Inter',
    playerQuotation: 20,
    playerAge: 26,
    playerApiFootballId: null,
    playerApiFootballStats: null,
    playerComputedStats: null,
    playerAutoTags: [],
    ownerUsername: 'User2',
    ownerTeamName: 'FC User2',
    ownerRubataOrder: 3,
    rubataPrice: 25,
    contractSalary: 4,
    contractDuration: 2,
    contractClause: 12,
    preference: {
      id: 'pref1',
      playerId: 'p3',
      memberId: 'myMember1',
      maxBid: 30,
      priority: 2,
      notes: 'Target player',
      isWatchlist: true,
      isAutoPass: false,
      watchlistCategory: 'DA_RUBARE',
    },
  },
]

const sampleSvincolatiPlayers = [
  {
    playerId: 'sp1',
    playerName: 'Franco Neri',
    playerPosition: 'P',
    playerTeam: 'Napoli',
    playerAge: 30,
    playerApiFootballId: null,
    playerApiFootballStats: null,
    playerComputedStats: null,
    playerAutoTags: [],
    preference: null,
  },
]

const strategiesResponse = {
  success: true,
  data: {
    players: sampleOwnedPlayers,
    myMemberId: 'myMember1',
    hasRubataBoard: true,
    hasRubataOrder: true,
    rubataState: 'READY_CHECK',
    sessionId: 'session1',
    totalPlayers: 3,
  },
}

const svincolatiResponse = {
  success: true,
  data: {
    players: sampleSvincolatiPlayers,
    myMemberId: 'myMember1',
    sessionId: 'session1',
    totalPlayers: 1,
  },
}

describe('StrategieRubata', () => {
  const mockOnNavigate = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetById.mockResolvedValue({
      success: true,
      data: { id: 'league1', name: 'Test League', userMembership: { role: 'MEMBER' } },
    })
    mockGetAllPlayersForStrategies.mockResolvedValue(strategiesResponse)
    mockGetAllSvincolatiForStrategies.mockResolvedValue(svincolatiResponse)
    mockSetPreference.mockResolvedValue({ success: true })
  })

  // ---- Loading state ----
  it('renders loading skeleton initially', () => {
    // Make API hang forever
    mockGetById.mockReturnValue(new Promise(() => {}))

    render(<StrategieRubata onNavigate={mockOnNavigate} />)

    expect(screen.getByTestId('navigation')).toBeInTheDocument()
    const skeleton = document.querySelector('.animate-pulse')
    expect(skeleton).toBeTruthy()
  })

  // ---- Navigation rendered with correct page ----
  it('renders navigation with currentPage "strategie-rubata"', async () => {
    render(<StrategieRubata onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Strategie Rubata' })).toBeInTheDocument()
    })

    const nav = screen.getByTestId('navigation')
    expect(nav.getAttribute('data-page')).toBe('strategie-rubata')
  })

  // ---- Main content loads (overview is the default landing view) ----
  it('renders header and overview after loading', async () => {
    render(<StrategieRubata onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Strategie Rubata' })).toBeInTheDocument()
    })

    // Default view is overview: top-priority section is shown
    expect(screen.getByText(/Top priorità/)).toBeInTheDocument()
    // and the add-players CTA
    expect(screen.getByText(/Aggiungi giocatori/)).toBeInTheDocument()
  })

  // ---- Scope tabs ----
  it('shows scope tabs (Overview, Mia rosa, Altre rose, Svincolati, Tutti)', async () => {
    render(<StrategieRubata onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Strategie Rubata' })).toBeInTheDocument()
    })

    expect(screen.getByText('Overview')).toBeInTheDocument()
    expect(screen.getByText('Mia rosa')).toBeInTheDocument()
    expect(screen.getByText('Altre rose')).toBeInTheDocument()
    expect(screen.getByText('Svincolati')).toBeInTheDocument()
    expect(screen.getByText('Tutti')).toBeInTheDocument()
  })

  // ---- Overview shows watchlist category cards ----
  it('shows watchlist category cards in overview', async () => {
    render(<StrategieRubata onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Strategie Rubata' })).toBeInTheDocument()
    })

    // Category labels from WATCHLIST_CATEGORIES ("Da Rubare" also appears as a
    // headline stat label in the testata, hence getAllByText).
    expect(screen.getAllByText('Da Rubare').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Osservazione')).toBeInTheDocument()
    expect(screen.getByText('Pot. Acquisto')).toBeInTheDocument()
  })

  // ---- Error display via toast ----
  it('reports an error via toast when API fails', async () => {
    mockGetAllPlayersForStrategies.mockResolvedValueOnce({
      success: false,
      message: 'Errore nel caricamento giocatori',
    })

    render(<StrategieRubata onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Strategie Rubata' })).toBeInTheDocument()
    })

    expect(mockToastError).toHaveBeenCalledWith('Errore nel caricamento giocatori')
  })

  // ---- Catches thrown error ----
  it('reports a generic error via toast when API throws', async () => {
    mockGetById.mockRejectedValueOnce(new Error('Network error'))

    render(<StrategieRubata onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Errore nel caricamento')
    })
  })

  // ---- API is called with correct leagueId ----
  it('calls APIs with the correct leagueId from route params', async () => {
    render(<StrategieRubata onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Strategie Rubata' })).toBeInTheDocument()
    })

    expect(mockGetById).toHaveBeenCalledWith('league1')
    expect(mockGetAllPlayersForStrategies).toHaveBeenCalledWith('league1')
    expect(mockGetAllSvincolatiForStrategies).toHaveBeenCalledWith('league1')
  })

  // ---- Admin detection from league response ----
  it('detects admin status from league API response', async () => {
    mockGetById.mockResolvedValueOnce({
      success: true,
      data: { id: 'league1', name: 'Test League', userMembership: { role: 'ADMIN' } },
    })

    render(<StrategieRubata onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Strategie Rubata' })).toBeInTheDocument()
    })

    expect(screen.getByTestId('navigation')).toBeInTheDocument()
  })

  // ---- Loads existing preferences ----
  it('loads existing preferences into local state from API data', async () => {
    render(<StrategieRubata onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Strategie Rubata' })).toBeInTheDocument()
    })

    // Player p3 (Paolo Verdi) has a DA_RUBARE preference + priority → appears in
    // overview (both the Da Rubare category card and the top-priority section).
    expect(screen.getAllByText('Paolo Verdi').length).toBeGreaterThanOrEqual(1)
    expect(mockGetAllPlayersForStrategies).toHaveBeenCalled()
    expect(mockGetAllSvincolatiForStrategies).toHaveBeenCalled()
  })
})
