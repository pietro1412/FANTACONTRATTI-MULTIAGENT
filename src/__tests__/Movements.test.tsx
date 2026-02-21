import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { Movements } from '../pages/Movements'

// Mock the useAuth hook
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: '1', email: 'test@test.com', username: 'Test' },
    isAuthenticated: true,
    isLoading: false,
  }),
}))

// Import mocks for controlling behavior per test
const mockGetById = vi.fn()
const mockGetLeagueMovements = vi.fn()
const mockCanMakeProphecy = vi.fn()

// Mock the API services
vi.mock('../services/api', () => ({
  leagueApi: {
    getById: (...args: unknown[]) => mockGetById(...args),
    getPendingRequests: vi.fn().mockResolvedValue({ success: true, data: [] }),
  },
  movementApi: {
    getLeagueMovements: (...args: unknown[]) => mockGetLeagueMovements(...args),
    canMakeProphecy: (...args: unknown[]) => mockCanMakeProphecy(...args),
    addProphecy: vi.fn().mockResolvedValue({ success: true }),
  },
  superadminApi: {
    getStatus: vi.fn().mockResolvedValue({ success: true, data: { isSuperAdmin: false } }),
  },
  tradeApi: {
    getReceived: vi.fn().mockResolvedValue({ success: true, data: [] }),
  },
  userApi: {
    getMyPendingInvites: vi.fn().mockResolvedValue({ success: true, data: [] }),
  },
  feedbackApi: {
    getMyFeedback: vi.fn().mockResolvedValue({ success: true, data: { items: [], total: 0 } }),
    getUnreadNotifications: vi.fn().mockResolvedValue({ success: true, data: { count: 0 } }),
  },
  inviteApi: {},
}))

// Mock Toast provider
vi.mock('../components/ui/Toast', () => ({
  useToast: () => ({
    toast: {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
    },
  }),
}))

// Mock the PullToRefresh component
vi.mock('../components/PullToRefresh', () => ({
  PullToRefresh: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

// Mock the BottomSheet component
vi.mock('../components/ui/BottomSheet', () => ({
  BottomSheet: ({ children, isOpen }: { children: React.ReactNode; isOpen: boolean }) =>
    isOpen ? <div data-testid="bottom-sheet">{children}</div> : null,
}))

// Mock team logos utility
vi.mock('../utils/teamLogos', () => ({
  getTeamLogo: () => 'https://example.com/logo.png',
}))

describe('Movements Page', () => {
  const defaultProps = {
    leagueId: 'league-123',
    onNavigate: vi.fn(),
  }

  const sampleMovements = [
    {
      id: 'mov-1',
      type: 'FIRST_MARKET',
      player: { id: 'p1', name: 'Vlahovic', team: 'Juventus', position: 'A' },
      from: null,
      to: { memberId: 'm1', username: 'Mario', teamName: 'Mario FC' },
      price: 25,
      oldContract: null,
      newContract: { salary: 25, duration: 3, clause: 225 },
      prophecies: [],
      createdAt: '2025-06-15T10:30:00Z',
      season: 2025,
      semester: 1,
    },
    {
      id: 'mov-2',
      type: 'TRADE',
      player: { id: 'p2', name: 'Barella', team: 'Inter', position: 'C' },
      from: { memberId: 'm1', username: 'Mario', teamName: 'Mario FC' },
      to: { memberId: 'm2', username: 'Luigi', teamName: 'Luigi FC' },
      price: 30,
      oldContract: { salary: 15, duration: 2, clause: 105 },
      newContract: { salary: 15, duration: 2, clause: 105 },
      prophecies: [
        {
          id: 'pr1',
          content: 'Grande acquisto!',
          authorRole: 'BUYER' as const,
          author: { memberId: 'm2', username: 'Luigi', teamName: 'Luigi FC' },
          createdAt: '2025-06-15T11:00:00Z',
        },
      ],
      createdAt: '2025-06-16T14:00:00Z',
      season: 2025,
      semester: 1,
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetById.mockResolvedValue({
      success: true,
      data: { isAdmin: false },
    })
    mockCanMakeProphecy.mockResolvedValue({
      success: true,
      data: { canMakeProphecy: false },
    })
  })

  it('shows loading skeletons initially', () => {
    mockGetLeagueMovements.mockReturnValue(new Promise(() => {}))

    render(<Movements {...defaultProps} />)

    // SkeletonPlayerRow renders divs with animate-pulse;
    // the loading branch is rendered (no heading yet)
    expect(screen.queryByText('Storico Movimenti')).not.toBeInTheDocument()
  })

  it('renders the page heading and movements after loading', async () => {
    mockGetLeagueMovements.mockResolvedValue({
      success: true,
      data: sampleMovements,
    })

    render(<Movements {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('Storico Movimenti')).toBeInTheDocument()
    })

    // Player names should be visible (they appear in both mobile and desktop views)
    const vlahovicElements = screen.getAllByText('Vlahovic')
    expect(vlahovicElements.length).toBeGreaterThan(0)

    const barellaElements = screen.getAllByText('Barella')
    expect(barellaElements.length).toBeGreaterThan(0)
  })

  it('shows empty state when no movements exist', async () => {
    mockGetLeagueMovements.mockResolvedValue({
      success: true,
      data: [],
    })

    render(<Movements {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('Nessun movimento registrato')).toBeInTheDocument()
    })
  })

  it('shows error message on API failure', async () => {
    mockGetLeagueMovements.mockResolvedValue({
      success: false,
      message: 'Errore nel caricamento',
    })

    render(<Movements {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('Errore nel caricamento')).toBeInTheDocument()
    })
    expect(screen.getByText('Riprova')).toBeInTheDocument()
  })

  it('renders the movement type legend', async () => {
    mockGetLeagueMovements.mockResolvedValue({
      success: true,
      data: sampleMovements,
    })

    render(<Movements {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('Storico Movimenti')).toBeInTheDocument()
    })

    // Legend labels from movement-constants (some also appear in filter selects)
    expect(screen.getAllByText('Primo Mercato').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Scambio').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Rubata').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Svincolati').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Taglio').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Rinnovo').length).toBeGreaterThanOrEqual(1)
  })
})
