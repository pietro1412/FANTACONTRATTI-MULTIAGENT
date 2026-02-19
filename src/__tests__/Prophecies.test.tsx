import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Prophecies } from '../pages/Prophecies'

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

// Mock EmptyState
vi.mock('../components/ui/EmptyState', () => ({
  EmptyState: ({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) => (
    <div data-testid="empty-state">
      <p>{title}</p>
      {description && <p>{description}</p>}
      {action}
    </div>
  ),
}))

// Mock IntersectionObserver as a class
class MockIntersectionObserver {
  observe = vi.fn()
  disconnect = vi.fn()
  unobserve = vi.fn()
  constructor() {
    // noop
  }
}
vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)

// API mocks
const mockGetById = vi.fn()
const mockGetProphecies = vi.fn()
const mockGetProphecyStats = vi.fn()

vi.mock('../services/api', () => ({
  leagueApi: {
    getById: (...args: unknown[]) => mockGetById(...args),
  },
  historyApi: {
    getProphecies: (...args: unknown[]) => mockGetProphecies(...args),
    getProphecyStats: (...args: unknown[]) => mockGetProphecyStats(...args),
  },
}))

// Sample data
const sampleProphecies = [
  {
    id: 'pr1',
    content: 'Sara il capocannoniere della stagione',
    authorRole: 'BUYER' as const,
    createdAt: '2025-06-01T10:00:00Z',
    player: { id: 'pl1', name: 'Lautaro Martinez', position: 'A', team: 'Inter' },
    author: { memberId: 'm1', username: 'TestUser', teamName: 'FC Test' },
    session: { type: 'PRIMO_MERCATO', season: 1, semester: 'FIRST' },
    movementType: 'FIRST_MARKET',
    movementPrice: 40,
  },
  {
    id: 'pr2',
    content: 'Giocatore sottovalutato, fara bene',
    authorRole: 'SELLER' as const,
    createdAt: '2025-06-02T10:00:00Z',
    player: { id: 'pl2', name: 'Barella Nicolo', position: 'C', team: 'Inter' },
    author: { memberId: 'm2', username: 'OtherUser', teamName: 'FC Other' },
    session: { type: 'PRIMO_MERCATO', season: 1, semester: 'FIRST' },
    movementType: 'RUBATA',
    movementPrice: 15,
  },
]

const sampleStats = {
  total: 2,
  byAuthor: [
    { memberId: 'm1', username: 'TestUser', teamName: 'FC Test', count: 5 },
    { memberId: 'm2', username: 'OtherUser', teamName: 'FC Other', count: 3 },
  ],
  topPlayers: [
    { playerId: 'pl1', name: 'Lautaro Martinez', position: 'A', team: 'Inter', count: 4 },
    { playerId: 'pl2', name: 'Barella Nicolo', position: 'C', team: 'Inter', count: 2 },
  ],
}

describe('Prophecies', () => {
  const mockOnNavigate = vi.fn()
  const defaultLeagueId = 'league1'

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetById.mockResolvedValue({
      success: true,
      data: { userMembership: { role: 'MEMBER' } },
    })
    mockGetProphecies.mockResolvedValue({
      success: true,
      data: {
        prophecies: sampleProphecies,
        pagination: { hasMore: false, total: 2 },
      },
    })
    mockGetProphecyStats.mockResolvedValue({
      success: true,
      data: sampleStats,
    })
  })

  it('shows loading spinner initially', () => {
    mockGetProphecies.mockReturnValue(new Promise(() => {}))
    render(<Prophecies leagueId={defaultLeagueId} onNavigate={mockOnNavigate} />)
    // The loading spinner has the animate-spin class
    const spinner = document.querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()
  })

  it('renders page header with title and count', async () => {
    render(<Prophecies leagueId={defaultLeagueId} onNavigate={mockOnNavigate} />)
    await waitFor(() => {
      expect(screen.getByText('Profezie')).toBeInTheDocument()
    })
    expect(screen.getByText('(2)')).toBeInTheDocument()
  })

  it('renders Navigation with correct currentPage', async () => {
    render(<Prophecies leagueId={defaultLeagueId} onNavigate={mockOnNavigate} />)
    await waitFor(() => {
      expect(screen.getByTestId('navigation')).toHaveAttribute('data-page', 'prophecies')
    })
  })

  it('renders prophecy list in compact (table) view by default', async () => {
    render(<Prophecies leagueId={defaultLeagueId} onNavigate={mockOnNavigate} />)
    await waitFor(() => {
      // Player names appear in stats + table rows, so use getAllByText
      expect(screen.getAllByText('Lautaro Martinez').length).toBeGreaterThan(0)
    })
    expect(screen.getAllByText('Barella Nicolo').length).toBeGreaterThan(0)
    // Table headers in compact view
    expect(screen.getByText('Giocatore')).toBeInTheDocument()
    expect(screen.getByText('Autore')).toBeInTheDocument()
  })

  it('displays stats cards with Top Profeti and Top Giocatori', async () => {
    render(<Prophecies leagueId={defaultLeagueId} onNavigate={mockOnNavigate} />)
    await waitFor(() => {
      expect(screen.getByText('Top Profeti')).toBeInTheDocument()
    })
    expect(screen.getByText('Top Giocatori')).toBeInTheDocument()
    // Team names appear in both stats section and table rows
    expect(screen.getAllByText('FC Test').length).toBeGreaterThan(0)
    expect(screen.getAllByText('FC Other').length).toBeGreaterThan(0)
  })

  it('renders search input', async () => {
    render(<Prophecies leagueId={defaultLeagueId} onNavigate={mockOnNavigate} />)
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Cerca giocatore, manager o testo...')).toBeInTheDocument()
    })
  })

  it('shows empty state when no prophecies found', async () => {
    mockGetProphecies.mockResolvedValue({
      success: true,
      data: {
        prophecies: [],
        pagination: { hasMore: false, total: 0 },
      },
    })
    render(<Prophecies leagueId={defaultLeagueId} onNavigate={mockOnNavigate} />)
    await waitFor(() => {
      expect(screen.getByTestId('empty-state')).toBeInTheDocument()
    })
    expect(screen.getByText('Nessuna profezia trovata')).toBeInTheDocument()
  })

  it('toggles stats visibility when stats button is clicked', async () => {
    const user = userEvent.setup()
    render(<Prophecies leagueId={defaultLeagueId} onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Top Profeti')).toBeInTheDocument()
    })

    // Click the toggle stats button
    const toggleStatsBtn = screen.getByLabelText('Nascondi statistiche')
    await user.click(toggleStatsBtn)

    expect(screen.queryByText('Top Profeti')).not.toBeInTheDocument()
  })

  it('shows results count', async () => {
    render(<Prophecies leagueId={defaultLeagueId} onNavigate={mockOnNavigate} />)
    await waitFor(() => {
      expect(screen.getByText('2 risultati')).toBeInTheDocument()
    })
  })

  it('shows end of list indicator when no more items', async () => {
    render(<Prophecies leagueId={defaultLeagueId} onNavigate={mockOnNavigate} />)
    await waitFor(() => {
      expect(screen.getByText('Fine delle profezie')).toBeInTheDocument()
    })
  })

  it('filters by author when clicking author name in stats', async () => {
    const user = userEvent.setup()
    render(<Prophecies leagueId={defaultLeagueId} onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Top Profeti')).toBeInTheDocument()
    })

    // Record how many times getProphecies has been called so far
    const initialCallCount = mockGetProphecies.mock.calls.length

    // Click on first author in stats section - the one with count 5
    const authorButtons = screen.getAllByText('FC Test')
    // Find the one in the stats area (first occurrence)
    await user.click(authorButtons[0]!)

    // Should trigger additional loadProphecies calls (filtering by author)
    await waitFor(() => {
      expect(mockGetProphecies.mock.calls.length).toBeGreaterThan(initialCallCount)
    })
  })

  it('shows Reset button when filters are active', async () => {
    const user = userEvent.setup()
    render(<Prophecies leagueId={defaultLeagueId} onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Top Profeti')).toBeInTheDocument()
    })

    // Click on an author to activate filter
    const authorButtons = screen.getAllByText('FC Test')
    await user.click(authorButtons[0]!)

    await waitFor(() => {
      expect(screen.getByText('Reset')).toBeInTheDocument()
    })
  })

  it('displays movement type labels in the table', async () => {
    render(<Prophecies leagueId={defaultLeagueId} onNavigate={mockOnNavigate} />)
    await waitFor(() => {
      expect(screen.getByText('Primo Mercato')).toBeInTheDocument()
    })
    expect(screen.getByText('Rubata')).toBeInTheDocument()
  })
})
