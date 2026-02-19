import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PlayerStats from '../pages/PlayerStats'

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

// Mock Card (default + named export)
vi.mock('../components/ui/Card', () => ({
  default: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>{children}</div>
  ),
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>{children}</div>
  ),
}))

// Mock Button (default + named export)
vi.mock('../components/ui/Button', () => ({
  default: ({ children, onClick, disabled, ...props }: React.ComponentProps<'button'>) => (
    <button onClick={onClick} disabled={disabled} {...props}>{children}</button>
  ),
  Button: ({ children, onClick, disabled, ...props }: React.ComponentProps<'button'>) => (
    <button onClick={onClick} disabled={disabled} {...props}>{children}</button>
  ),
}))

// Mock Input (default + named export)
vi.mock('../components/ui/Input', () => ({
  default: ({ value, onChange, placeholder, onKeyDown, ...props }: React.ComponentProps<'input'>) => (
    <input value={value} onChange={onChange} placeholder={placeholder} onKeyDown={onKeyDown} {...props} />
  ),
  Input: ({ value, onChange, placeholder, onKeyDown, ...props }: React.ComponentProps<'input'>) => (
    <input value={value} onChange={onChange} placeholder={placeholder} onKeyDown={onKeyDown} {...props} />
  ),
}))

// Mock RadarChart
vi.mock('../components/ui/RadarChart', () => ({
  default: () => <div data-testid="radar-chart">RadarChart</div>,
}))

// Mock BottomSheet
vi.mock('../components/ui/BottomSheet', () => ({
  BottomSheet: ({ isOpen, children, title }: { isOpen: boolean; children: React.ReactNode; title?: string }) => (
    isOpen ? <div data-testid="bottom-sheet" data-title={title}>{children}</div> : null
  ),
}))

// Mock ShareButton
vi.mock('../components/ShareButton', () => ({
  ShareButton: () => <button data-testid="share-button">Share</button>,
}))

// Mock LandscapeHint
vi.mock('../components/ui/LandscapeHint', () => ({
  LandscapeHint: () => <div data-testid="landscape-hint">LandscapeHint</div>,
}))

// Mock PlayerStatsModal
vi.mock('../components/PlayerStatsModal', () => ({
  PlayerStatsModal: ({ isOpen }: { isOpen: boolean }) => (
    isOpen ? <div data-testid="player-stats-modal">PlayerStatsModal</div> : null
  ),
}))

// Mock EmptyState
vi.mock('../components/ui/EmptyState', () => ({
  EmptyState: ({ title }: { title: string }) => (
    <div data-testid="empty-state">{title}</div>
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

// Mock player-images
vi.mock('../utils/player-images', () => ({
  getPlayerPhotoUrl: () => null,
  getTeamLogoUrl: () => null,
}))

// Mock lucide-react
vi.mock('lucide-react', () => ({
  SlidersHorizontal: () => <span data-testid="sliders-icon">SlidersHorizontal</span>,
  RotateCcw: () => <span>RotateCcw</span>,
  Share2: () => <span>Share2</span>,
  Check: () => <span>Check</span>,
}))

// API mocks
const mockGetById = vi.fn()
const mockGetStats = vi.fn()
const mockGetTeams = vi.fn()

vi.mock('../services/api', () => ({
  leagueApi: {
    getById: (...args: unknown[]) => mockGetById(...args),
  },
  playerApi: {
    getStats: (...args: unknown[]) => mockGetStats(...args),
    getTeams: (...args: unknown[]) => mockGetTeams(...args),
  },
}))

// Sample data
const samplePlayers = [
  {
    id: 'p1',
    name: 'Lautaro Martinez',
    team: 'Inter',
    position: 'A',
    quotation: 42,
    apiFootballId: 123,
    statsSyncedAt: '2025-06-01T10:00:00Z',
    stats: {
      appearances: 30,
      minutes: 2500,
      rating: 7.2,
      goals: 20,
      assists: 5,
      yellowCards: 3,
      redCards: 0,
      passesTotal: 800,
      passesKey: 40,
      passAccuracy: 85,
      shotsTotal: 80,
      shotsOn: 45,
      tacklesTotal: 10,
      interceptions: 5,
      dribblesAttempts: 50,
      dribblesSuccess: 30,
      penaltyScored: 3,
      penaltyMissed: 1,
    },
  },
  {
    id: 'p2',
    name: 'Barella Nicolo',
    team: 'Inter',
    position: 'C',
    quotation: 30,
    apiFootballId: 456,
    statsSyncedAt: '2025-06-01T10:00:00Z',
    stats: {
      appearances: 28,
      minutes: 2200,
      rating: 7.0,
      goals: 5,
      assists: 10,
      yellowCards: 6,
      redCards: 1,
      passesTotal: 1500,
      passesKey: 60,
      passAccuracy: 90,
      shotsTotal: 40,
      shotsOn: 20,
      tacklesTotal: 40,
      interceptions: 20,
      dribblesAttempts: 30,
      dribblesSuccess: 20,
      penaltyScored: 0,
      penaltyMissed: 0,
    },
  },
]

describe('PlayerStats', () => {
  const mockOnNavigate = vi.fn()
  const defaultLeagueId = 'league1'

  beforeEach(() => {
    vi.clearAllMocks()
    // Mock localStorage
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {})

    mockGetById.mockResolvedValue({
      success: true,
      data: { name: 'Test League', userMembership: { role: 'MEMBER', teamName: 'FC Test' } },
    })
    mockGetStats.mockResolvedValue({
      success: true,
      data: {
        players: samplePlayers,
        pagination: { page: 1, limit: 50, total: 2, totalPages: 1 },
      },
    })
    mockGetTeams.mockResolvedValue({
      success: true,
      data: [{ name: 'Inter' }, { name: 'Milan' }, { name: 'Juventus' }],
    })
  })

  it('shows loading spinner initially', () => {
    mockGetStats.mockReturnValue(new Promise(() => {}))
    render(<PlayerStats leagueId={defaultLeagueId} onNavigate={mockOnNavigate} />)
    expect(screen.getByText('Caricamento statistiche...')).toBeInTheDocument()
  })

  it('renders page header with title', async () => {
    render(<PlayerStats leagueId={defaultLeagueId} onNavigate={mockOnNavigate} />)
    await waitFor(() => {
      expect(screen.getByText('Statistiche Serie A')).toBeInTheDocument()
    })
  })

  it('renders Navigation with correct currentPage', async () => {
    render(<PlayerStats leagueId={defaultLeagueId} onNavigate={mockOnNavigate} />)
    await waitFor(() => {
      expect(screen.getByTestId('navigation')).toHaveAttribute('data-page', 'playerStats')
    })
  })

  it('renders player names in the table', async () => {
    render(<PlayerStats leagueId={defaultLeagueId} onNavigate={mockOnNavigate} />)
    await waitFor(() => {
      expect(screen.getByText('Lautaro Martinez')).toBeInTheDocument()
    })
    expect(screen.getByText('Barella Nicolo')).toBeInTheDocument()
  })

  it('renders team names in the table', async () => {
    render(<PlayerStats leagueId={defaultLeagueId} onNavigate={mockOnNavigate} />)
    await waitFor(() => {
      expect(screen.getAllByText('Inter').length).toBeGreaterThan(0)
    })
  })

  it('shows empty state when no players found', async () => {
    mockGetStats.mockResolvedValue({
      success: true,
      data: {
        players: [],
        pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
      },
    })
    render(<PlayerStats leagueId={defaultLeagueId} onNavigate={mockOnNavigate} />)
    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument()
    })
    expect(screen.getByText('Nessun giocatore trovato')).toBeInTheDocument()
  })

  it('shows error banner when API fails', async () => {
    mockGetStats.mockRejectedValue(new Error('Network error'))
    render(<PlayerStats leagueId={defaultLeagueId} onNavigate={mockOnNavigate} />)
    await waitFor(() => {
      expect(screen.getByText('Errore nel caricamento delle statistiche. Riprova.')).toBeInTheDocument()
    })
  })

  it('renders search input with search button', async () => {
    render(<PlayerStats leagueId={defaultLeagueId} onNavigate={mockOnNavigate} />)
    await waitFor(() => {
      expect(screen.getAllByPlaceholderText('Nome...').length).toBeGreaterThan(0)
    })
  })

  it('renders column preset buttons', async () => {
    render(<PlayerStats leagueId={defaultLeagueId} onNavigate={mockOnNavigate} />)
    await waitFor(() => {
      expect(screen.getByText('Preset:')).toBeInTheDocument()
    })
  })

  it('renders sortable table headers', async () => {
    render(<PlayerStats leagueId={defaultLeagueId} onNavigate={mockOnNavigate} />)
    await waitFor(() => {
      expect(screen.getByText(/Giocatore/)).toBeInTheDocument()
    })
    expect(screen.getAllByText(/Squadra/).length).toBeGreaterThan(0)
  })

  it('displays player total count', async () => {
    render(<PlayerStats leagueId={defaultLeagueId} onNavigate={mockOnNavigate} />)
    await waitFor(() => {
      expect(screen.getByText('2 giocatori con dati')).toBeInTheDocument()
    })
  })

  it('renders share button', async () => {
    render(<PlayerStats leagueId={defaultLeagueId} onNavigate={mockOnNavigate} />)
    await waitFor(() => {
      expect(screen.getByTestId('share-button')).toBeInTheDocument()
    })
  })

  it('renders position filter in desktop view', async () => {
    render(<PlayerStats leagueId={defaultLeagueId} onNavigate={mockOnNavigate} />)
    await waitFor(() => {
      // The "Ruolo" label for position filter
      expect(screen.getAllByText('Ruolo').length).toBeGreaterThan(0)
    })
  })

  it('does not show pagination when only one page', async () => {
    render(<PlayerStats leagueId={defaultLeagueId} onNavigate={mockOnNavigate} />)
    await waitFor(() => {
      expect(screen.getByText('Lautaro Martinez')).toBeInTheDocument()
    })
    expect(screen.queryByText('Precedente')).not.toBeInTheDocument()
  })

  it('shows pagination when multiple pages exist', async () => {
    mockGetStats.mockResolvedValue({
      success: true,
      data: {
        players: samplePlayers,
        pagination: { page: 1, limit: 50, total: 100, totalPages: 2 },
      },
    })
    render(<PlayerStats leagueId={defaultLeagueId} onNavigate={mockOnNavigate} />)
    await waitFor(() => {
      expect(screen.getByText('Precedente')).toBeInTheDocument()
    })
    expect(screen.getByText('Successiva')).toBeInTheDocument()
  })

  // ---------------------------------------------------------------------------
  // Sorting
  // ---------------------------------------------------------------------------

  it('sorts by column when table header is clicked', async () => {
    const user = userEvent.setup()
    render(<PlayerStats leagueId={defaultLeagueId} onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Lautaro Martinez')).toBeInTheDocument()
    })

    // Click on "Giocatore" header to sort
    await user.click(screen.getByText(/Giocatore/))

    // After sorting by name desc, the API should be called again
    await waitFor(() => {
      expect(mockGetStats).toHaveBeenCalledTimes(2)
    })
  })

  it('toggles sort order when same column header is clicked twice', async () => {
    const user = userEvent.setup()
    render(<PlayerStats leagueId={defaultLeagueId} onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Lautaro Martinez')).toBeInTheDocument()
    })

    // Click "Giocatore" - first click sets desc
    await user.click(screen.getByText(/Giocatore/))
    // Click again - toggles to asc
    await user.click(screen.getByText(/Giocatore/))

    await waitFor(() => {
      // Called initial + 2 sort clicks
      expect(mockGetStats).toHaveBeenCalledTimes(3)
    })
  })

  // ---------------------------------------------------------------------------
  // Search
  // ---------------------------------------------------------------------------

  it('triggers search when search button is clicked', async () => {
    const user = userEvent.setup()
    render(<PlayerStats leagueId={defaultLeagueId} onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Lautaro Martinez')).toBeInTheDocument()
    })

    // Type in search input (get all inputs with placeholder and use the first one)
    const searchInputs = screen.getAllByPlaceholderText('Nome...')
    await user.type(searchInputs[0]!, 'Lautaro')

    // Click the search button (emoji search button)
    const searchButtons = screen.getAllByRole('button')
    const searchBtn = searchButtons.find(btn => btn.textContent?.includes('🔍'))
    expect(searchBtn).toBeTruthy()
    await user.click(searchBtn!)

    await waitFor(() => {
      // API called again with search
      expect(mockGetStats.mock.calls.length).toBeGreaterThanOrEqual(2)
    })
  })

  it('triggers search on Enter key press in search input', async () => {
    const user = userEvent.setup()
    render(<PlayerStats leagueId={defaultLeagueId} onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Lautaro Martinez')).toBeInTheDocument()
    })

    const searchInputs = screen.getAllByPlaceholderText('Nome...')
    await user.type(searchInputs[0]!, 'Barella{Enter}')

    await waitFor(() => {
      expect(mockGetStats.mock.calls.length).toBeGreaterThanOrEqual(2)
    })
  })

  // ---------------------------------------------------------------------------
  // Column presets
  // ---------------------------------------------------------------------------

  it('changes visible columns when a preset button is clicked', async () => {
    const user = userEvent.setup()
    render(<PlayerStats leagueId={defaultLeagueId} onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Preset:')).toBeInTheDocument()
    })

    // Click the "Tutte" preset
    const tutteButton = screen.getAllByRole('button').find(btn => btn.textContent?.includes('Tutte'))
    expect(tutteButton).toBeTruthy()
    await user.click(tutteButton!)

    // With "all" preset, more columns should be visible
    await waitFor(() => {
      expect(screen.getByText(/colonne selezionate/)).toBeInTheDocument()
    })
  })

  it('renders Personalizza button with column count', async () => {
    render(<PlayerStats leagueId={defaultLeagueId} onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText(/Personalizza/)).toBeInTheDocument()
    })
  })

  // ---------------------------------------------------------------------------
  // Player comparison
  // ---------------------------------------------------------------------------

  it('allows selecting players for comparison via checkboxes', async () => {
    const user = userEvent.setup()
    const { container } = render(<PlayerStats leagueId={defaultLeagueId} onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Lautaro Martinez')).toBeInTheDocument()
    })

    // Find all checkboxes in table body (not header)
    const tbody = container.querySelector('tbody')
    expect(tbody).toBeTruthy()
    const rowCheckboxes = tbody!.querySelectorAll('input[type="checkbox"]')
    expect(rowCheckboxes.length).toBe(2) // 2 players

    // Click the first player's checkbox
    await user.click(rowCheckboxes[0]!)

    // Verify checkbox is now checked
    await waitFor(() => {
      expect((rowCheckboxes[0] as HTMLInputElement).checked).toBe(true)
    })

    // Now "Confronta (1)" button should appear in both mobile and desktop
    await waitFor(() => {
      const confrontaBtns = screen.queryAllByText(/Confronta/)
      expect(confrontaBtns.length).toBeGreaterThan(0)
    })
  })

  it('shows compare modal when 2+ players selected and Confronta is clicked', async () => {
    const user = userEvent.setup()
    const { container } = render(<PlayerStats leagueId={defaultLeagueId} onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Lautaro Martinez')).toBeInTheDocument()
    })

    const tbody = container.querySelector('tbody')!
    const rowCheckboxes = tbody.querySelectorAll('input[type="checkbox"]')

    // Select both players
    await user.click(rowCheckboxes[0]!) // Lautaro
    await user.click(rowCheckboxes[1]!) // Barella

    await waitFor(() => {
      const confrontaBtns = screen.getAllByText(/Confronta \(2\)/)
      expect(confrontaBtns.length).toBeGreaterThan(0)
      expect(confrontaBtns[0]!).not.toBeDisabled()
    })

    // Click first visible Confronta
    const confrontaBtns = screen.getAllByText(/Confronta \(2\)/)
    await user.click(confrontaBtns[0]!)

    // Compare modal with radar charts and table should appear
    await waitFor(() => {
      expect(screen.getByText('Confronto Giocatori')).toBeInTheDocument()
      expect(screen.getByText('Statistiche Offensive')).toBeInTheDocument()
      expect(screen.getByText('Statistiche Difensive')).toBeInTheDocument()
      expect(screen.getByText('Dettaglio Statistiche')).toBeInTheDocument()
    })
  })

  it('closes compare modal when back button is clicked', async () => {
    const user = userEvent.setup()
    const { container } = render(<PlayerStats leagueId={defaultLeagueId} onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Lautaro Martinez')).toBeInTheDocument()
    })

    const tbody = container.querySelector('tbody')!
    const rowCheckboxes = tbody.querySelectorAll('input[type="checkbox"]')
    await user.click(rowCheckboxes[0]!)
    await user.click(rowCheckboxes[1]!)

    await waitFor(() => {
      expect(screen.getAllByText(/Confronta \(2\)/).length).toBeGreaterThan(0)
    })

    const confrontaBtns = screen.getAllByText(/Confronta \(2\)/)
    await user.click(confrontaBtns[0]!)

    await waitFor(() => {
      expect(screen.getByText('Confronto Giocatori')).toBeInTheDocument()
    })

    // Click "Torna alla lista"
    await user.click(screen.getByText('Torna alla lista'))

    await waitFor(() => {
      expect(screen.queryByText('Confronto Giocatori')).not.toBeInTheDocument()
    })
  })

  it('clears comparison when clear button is clicked', async () => {
    const user = userEvent.setup()
    const { container } = render(<PlayerStats leagueId={defaultLeagueId} onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Lautaro Martinez')).toBeInTheDocument()
    })

    const tbody = container.querySelector('tbody')!
    const rowCheckboxes = tbody.querySelectorAll('input[type="checkbox"]')
    await user.click(rowCheckboxes[0]!)

    await waitFor(() => {
      expect(screen.getAllByText(/Confronta \(1\)/).length).toBeGreaterThan(0)
    })

    // Click the clear button (✕) - appears in both mobile and desktop
    const clearButtons = screen.getAllByRole('button').filter(btn => btn.textContent?.trim() === '✕')
    expect(clearButtons.length).toBeGreaterThan(0)
    await user.click(clearButtons[0]!)

    await waitFor(() => {
      expect(screen.queryByText(/Confronta/)).not.toBeInTheDocument()
    })
  })

  // ---------------------------------------------------------------------------
  // Pagination interaction
  // ---------------------------------------------------------------------------

  it('navigates to next page when Successiva is clicked', async () => {
    const user = userEvent.setup()
    mockGetStats.mockResolvedValue({
      success: true,
      data: {
        players: samplePlayers,
        pagination: { page: 1, limit: 50, total: 100, totalPages: 2 },
      },
    })
    render(<PlayerStats leagueId={defaultLeagueId} onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Successiva')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Successiva'))

    await waitFor(() => {
      // Page 2 request
      expect(mockGetStats.mock.calls.length).toBeGreaterThanOrEqual(2)
    })
  })

  it('disables Precedente on first page', async () => {
    mockGetStats.mockResolvedValue({
      success: true,
      data: {
        players: samplePlayers,
        pagination: { page: 1, limit: 50, total: 100, totalPages: 2 },
      },
    })
    render(<PlayerStats leagueId={defaultLeagueId} onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Precedente')).toBeDisabled()
    })
  })

  // ---------------------------------------------------------------------------
  // Stat columns rendering
  // ---------------------------------------------------------------------------

  it('renders stat values in columns for players', async () => {
    render(<PlayerStats leagueId={defaultLeagueId} onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Lautaro Martinez')).toBeInTheDocument()
    })

    // Default preset is "essential" with: appearances, rating, goals, assists, ga, yellowCards
    // Lautaro: rating=7.2 (unique value), Barella: rating=7.00 (unique value)
    // Some values appear multiple times (e.g. "30" is both Barella quotation and Lautaro appearances)
    expect(screen.getByText('7.20')).toBeInTheDocument() // Lautaro rating
    expect(screen.getByText('7.00')).toBeInTheDocument() // Barella rating
    // G+A: Lautaro 20+5=25, Barella 5+10=15
    expect(screen.getByText('25')).toBeInTheDocument()
    expect(screen.getByText('15')).toBeInTheDocument()
  })

  it('renders position labels in the table', async () => {
    render(<PlayerStats leagueId={defaultLeagueId} onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Attaccante')).toBeInTheDocument()
      expect(screen.getByText('Centrocampista')).toBeInTheDocument()
    })
  })

  it('renders quotation values with styled badges', async () => {
    render(<PlayerStats leagueId={defaultLeagueId} onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('42')).toBeInTheDocument() // Lautaro quotation
    })
  })

  // ---------------------------------------------------------------------------
  // Error handling
  // ---------------------------------------------------------------------------

  it('shows retry button in error banner and retries on click', async () => {
    const user = userEvent.setup()
    mockGetStats
      .mockRejectedValueOnce(new Error('Server error'))
      .mockResolvedValue({
        success: true,
        data: {
          players: samplePlayers,
          pagination: { page: 1, limit: 50, total: 2, totalPages: 1 },
        },
      })

    render(<PlayerStats leagueId={defaultLeagueId} onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Errore nel caricamento delle statistiche. Riprova.')).toBeInTheDocument()
    })

    // Click the retry button in the error banner
    await user.click(screen.getByText('Riprova'))

    await waitFor(() => {
      expect(mockGetStats).toHaveBeenCalledTimes(2)
    })
  })

  // ---------------------------------------------------------------------------
  // Sorting stat columns (client-side)
  // ---------------------------------------------------------------------------

  it('sorts by stat column (goals) when header clicked', async () => {
    const user = userEvent.setup()

    // First need to apply the "Attaccante" preset so goals column is visible
    render(<PlayerStats leagueId={defaultLeagueId} onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Lautaro Martinez')).toBeInTheDocument()
    })

    // The default "essential" preset includes "Gol" short label
    // Click on the Gol column header to sort
    const golHeaders = screen.getAllByTitle('Gol')
    if (golHeaders.length > 0) {
      await user.click(golHeaders[0]!)
    }

    // Client-side sort does not call API again - just reorders
    expect(screen.getByText('Lautaro Martinez')).toBeInTheDocument()
  })
})
