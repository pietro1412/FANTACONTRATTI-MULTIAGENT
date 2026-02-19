import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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
})
