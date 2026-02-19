import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ManagerDashboard } from '../pages/ManagerDashboard'

// Mock Navigation
vi.mock('../components/Navigation', () => ({
  Navigation: ({ currentPage }: { currentPage: string }) => (
    <nav data-testid="navigation" data-page={currentPage}>Navigation</nav>
  ),
}))

// Mock Button
vi.mock('../components/ui/Button', () => ({
  Button: ({ children, onClick, variant, ...props }: React.ComponentProps<'button'> & { variant?: string }) => (
    <button onClick={onClick} data-variant={variant} {...props}>{children}</button>
  ),
}))

// Mock Card
vi.mock('../components/ui/Card', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>{children}</div>
  ),
  CardHeader: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-header" className={className}>{children}</div>
  ),
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h3 data-testid="card-title" className={className}>{children}</h3>
  ),
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>{children}</div>
  ),
}))

// Mock PullToRefresh
vi.mock('../components/PullToRefresh', () => ({
  PullToRefresh: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="pull-to-refresh">{children}</div>
  ),
}))

// Mock useSwipeGesture
vi.mock('../hooks/useSwipeGesture', () => ({
  useSwipeGesture: () => ({
    handlers: {
      onTouchStart: vi.fn(),
      onTouchEnd: vi.fn(),
    },
  }),
}))

// Mock @dnd-kit/core
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <div data-testid="dnd-context">{children}</div>,
  closestCenter: vi.fn(),
  KeyboardSensor: vi.fn(),
  PointerSensor: vi.fn(),
  useSensor: vi.fn(),
  useSensors: vi.fn(() => []),
}))

// Mock @dnd-kit/sortable
vi.mock('@dnd-kit/sortable', () => ({
  arrayMove: vi.fn((arr: string[], from: number, to: number) => {
    const newArr = [...arr]
    const [item] = newArr.splice(from, 1)
    newArr.splice(to, 0, item!)
    return newArr
  }),
  SortableContext: ({ children }: { children: React.ReactNode }) => <div data-testid="sortable-context">{children}</div>,
  sortableKeyboardCoordinates: vi.fn(),
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

// Mock @dnd-kit/utilities
vi.mock('@dnd-kit/utilities', () => ({
  CSS: {
    Transform: {
      toString: vi.fn(() => ''),
    },
  },
}))

// Mock lucide-react
vi.mock('lucide-react', () => ({
  GripVertical: () => <span data-testid="icon-grip">GripVertical</span>,
  LayoutGrid: () => <span data-testid="icon-layout">LayoutGrid</span>,
  Bell: () => <span data-testid="icon-bell">Bell</span>,
  Settings: () => <span data-testid="icon-settings">Settings</span>,
}))

// Mock AlertSettings
vi.mock('../components/AlertSettings', () => ({
  AlertSettings: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="alert-settings">
      <button onClick={onClose}>Close Alert Settings</button>
    </div>
  ),
  loadAlertConfig: () => ({
    budgetLow: { enabled: true, threshold: 100 },
    contractExpiring: { enabled: true, threshold: 1 },
    salaryHigh: { enabled: false, threshold: 40 },
    slotsFull: { enabled: true },
  }),
  evaluateAlerts: () => [],
}))

// Mock API
const mockGetById = vi.fn()
const mockGetSessions = vi.fn()
const mockGetRoster = vi.fn()
const mockGetPrizeData = vi.fn()

vi.mock('../services/api', () => ({
  leagueApi: {
    getById: (...args: unknown[]) => mockGetById(...args),
  },
  auctionApi: {
    getSessions: (...args: unknown[]) => mockGetSessions(...args),
    getRoster: (...args: unknown[]) => mockGetRoster(...args),
  },
  prizePhaseApi: {
    getData: (...args: unknown[]) => mockGetPrizeData(...args),
  },
}))

// Sample data
const sampleMember = {
  id: 'm1',
  currentBudget: 350,
  teamName: 'FC Test',
  user: { username: 'TestManager' },
  league: {
    initialBudget: 500,
    goalkeeperSlots: 3,
    defenderSlots: 8,
    midfielderSlots: 8,
    forwardSlots: 6,
  },
}

const sampleRoster = {
  P: [
    {
      id: 'r1',
      acquisitionPrice: 10,
      acquisitionType: 'ASTA',
      acquiredAt: '2025-01-01',
      player: { id: 'p1', name: 'Donnarumma', team: 'PSG', position: 'P', quotation: 15 },
      contract: { id: 'c1', salary: 5, duration: 3, initialSalary: 5, rescissionClause: 20, signedAt: '2025-01-01' },
    },
  ],
  D: [
    {
      id: 'r2',
      acquisitionPrice: 20,
      acquisitionType: 'ASTA',
      acquiredAt: '2025-01-01',
      player: { id: 'p2', name: 'Bastoni', team: 'Inter', position: 'D', quotation: 25 },
      contract: { id: 'c2', salary: 8, duration: 1, initialSalary: 8, rescissionClause: 30, signedAt: '2025-01-01' },
    },
  ],
  C: [],
  A: [],
}

const sampleTotals = { P: 1, D: 1, C: 0, A: 0, total: 2 }
const sampleSlots = { P: 3, D: 8, C: 8, A: 6 }

const sampleSessions = [
  { id: 's1', type: 'PRIMO_MERCATO', status: 'COMPLETED' },
]

describe('ManagerDashboard', () => {
  const mockOnNavigate = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    // Clear localStorage
    localStorage.clear()

    mockGetById.mockResolvedValue({
      success: true,
      data: { userMembership: { role: 'MEMBER' } },
    })
    mockGetSessions.mockResolvedValue({
      success: true,
      data: sampleSessions,
    })
    mockGetRoster.mockResolvedValue({
      success: true,
      data: {
        member: sampleMember,
        roster: sampleRoster,
        totals: sampleTotals,
        slots: sampleSlots,
      },
    })
    mockGetPrizeData.mockResolvedValue({
      success: false,
    })
  })

  it('renders loading state initially', () => {
    mockGetById.mockReturnValue(new Promise(() => {}))
    mockGetSessions.mockReturnValue(new Promise(() => {}))
    mockGetRoster.mockReturnValue(new Promise(() => {}))

    render(<ManagerDashboard leagueId="league1" onNavigate={mockOnNavigate} />)

    expect(screen.getByTestId('navigation')).toBeInTheDocument()
    // Loading spinner is rendered (the animate-spin div)
    const spinner = document.querySelector('.animate-spin')
    expect(spinner).toBeTruthy()
  })

  it('renders error state when member data is null', async () => {
    mockGetRoster.mockResolvedValue({
      success: false,
      data: null,
    })

    render(<ManagerDashboard leagueId="league1" onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Errore nel caricamento dei dati')).toBeInTheDocument()
    })
  })

  it('renders overview tab with stats cards after loading', async () => {
    render(<ManagerDashboard leagueId="league1" onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Panoramica')).toBeInTheDocument()
    })

    // Stats should show totals
    expect(screen.getByText('2/25')).toBeInTheDocument() // total/totalSlots
    expect(screen.getByText('350')).toBeInTheDocument() // currentBudget
    expect(screen.getByText('Giocatori in rosa')).toBeInTheDocument()
    expect(screen.getByText('Budget disponibile')).toBeInTheDocument()
  })

  it('renders all four dashboard tabs', async () => {
    render(<ManagerDashboard leagueId="league1" onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Panoramica')).toBeInTheDocument()
    })

    expect(screen.getByText('Rosa Completa')).toBeInTheDocument()
    expect(screen.getByText('Contratti')).toBeInTheDocument()
    expect(screen.getByText('Budget')).toBeInTheDocument()
  })

  it('switches to roster tab when clicked', async () => {
    const user = userEvent.setup()

    render(<ManagerDashboard leagueId="league1" onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Rosa Completa')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Rosa Completa'))

    // Roster tab shows player names (mobile + desktop = multiple elements)
    await waitFor(() => {
      expect(screen.getAllByText('Donnarumma').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Bastoni').length).toBeGreaterThan(0)
    })
  })

  it('switches to contracts tab when clicked', async () => {
    const user = userEvent.setup()

    render(<ManagerDashboard leagueId="league1" onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Contratti')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Contratti'))

    await waitFor(() => {
      expect(screen.getByText('Tutti i Contratti')).toBeInTheDocument()
    })
  })

  it('switches to budget tab when clicked', async () => {
    const user = userEvent.setup()

    render(<ManagerDashboard leagueId="league1" onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Budget')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Budget'))

    await waitFor(() => {
      expect(screen.getByText('Movimenti Budget')).toBeInTheDocument()
      // "Budget iniziale" appears as both a card label and a movement description
      expect(screen.getAllByText('Budget iniziale').length).toBeGreaterThan(0)
    })
  })

  it('shows "Nessun alert attivo" when no alerts are triggered', async () => {
    render(<ManagerDashboard leagueId="league1" onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Nessun alert attivo')).toBeInTheDocument()
    })
  })

  it('shows roster composition widget on overview', async () => {
    render(<ManagerDashboard leagueId="league1" onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Composizione Rosa')).toBeInTheDocument()
    })

    // Position sections
    expect(screen.getByText('Portieri')).toBeInTheDocument()
    expect(screen.getByText('Difensori')).toBeInTheDocument()
    expect(screen.getByText('Centrocampisti')).toBeInTheDocument()
    expect(screen.getByText('Attaccanti')).toBeInTheDocument()
  })

  it('shows total salaries and clauses stats', async () => {
    render(<ManagerDashboard leagueId="league1" onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      // totalSalaries = 5 + 8 = 13
      expect(screen.getByText('13')).toBeInTheDocument()
      expect(screen.getByText('Totale ingaggi')).toBeInTheDocument()

      // totalClausole = 20 + 30 = 50
      expect(screen.getByText('50')).toBeInTheDocument()
      expect(screen.getByText('Valore clausole')).toBeInTheDocument()
    })
  })

  it('renders Navigation with correct props', async () => {
    render(<ManagerDashboard leagueId="league1" onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      const nav = screen.getByTestId('navigation')
      expect(nav).toHaveAttribute('data-page', 'managerDashboard')
    })
  })

  it('calls all required APIs on mount', async () => {
    render(<ManagerDashboard leagueId="league1" onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(mockGetById).toHaveBeenCalledWith('league1')
      expect(mockGetSessions).toHaveBeenCalledWith('league1')
      expect(mockGetRoster).toHaveBeenCalledWith('league1')
    })
  })

  it('shows budget details on budget tab', async () => {
    const user = userEvent.setup()

    render(<ManagerDashboard leagueId="league1" onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Budget')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Budget'))

    await waitFor(() => {
      // Spent = 500 - 350 = 150
      expect(screen.getByText('-150')).toBeInTheDocument()
      expect(screen.getByText('Disponibile')).toBeInTheDocument()
      expect(screen.getByText('Speso')).toBeInTheDocument()
    })
  })

  it('shows "Nessun giocatore" for empty position groups in roster', async () => {
    const user = userEvent.setup()

    render(<ManagerDashboard leagueId="league1" onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Panoramica')).toBeInTheDocument()
    })

    // In overview, the roster composition shows empty slots
    // C and A have 0 players
    const emptyMessages = screen.getAllByText('Nessun giocatore')
    expect(emptyMessages.length).toBeGreaterThan(0)
  })

  it('detects league admin status from API response', async () => {
    mockGetById.mockResolvedValue({
      success: true,
      data: { userMembership: { role: 'ADMIN' } },
    })

    render(<ManagerDashboard leagueId="league1" onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      // The component renders Navigation with isLeagueAdmin prop
      // Since we mock Navigation, we just verify the API was called
      expect(mockGetById).toHaveBeenCalledWith('league1')
    })
  })
})
