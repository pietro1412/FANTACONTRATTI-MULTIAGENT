import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SuperAdmin } from '../pages/SuperAdmin'

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
  Input: ({ value, onChange, placeholder, ...props }: React.ComponentProps<'input'>) => (
    <input value={value} onChange={onChange} placeholder={placeholder} {...props} />
  ),
}))

// Mock Card
vi.mock('../components/ui/Card', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>{children}</div>
  ),
}))

// Mock teamLogos
vi.mock('../utils/teamLogos', () => ({
  getTeamLogo: vi.fn(() => null),
}))

// Mock PositionBadge
vi.mock('../components/ui/PositionBadge', () => ({
  POSITION_GRADIENTS: {
    P: 'bg-amber-500',
    D: 'bg-blue-500',
    C: 'bg-emerald-500',
    A: 'bg-red-500',
  },
}))

// Mock API
const mockGetStatus = vi.fn()
const mockGetPlayersStats = vi.fn()
const mockGetUploadHistory = vi.fn()
const mockGetPlayers = vi.fn()
const mockGetLeagues = vi.fn()
const mockGetUsers = vi.fn()
const mockGetPlayersNeedingClassification = vi.fn()
const mockGetApiFootballStatus = vi.fn()
const mockGetMatchProposals = vi.fn()
const mockGetMatchedPlayers = vi.fn()
const mockGetTeams = vi.fn()

vi.mock('../services/api', () => ({
  superadminApi: {
    getStatus: (...args: unknown[]) => mockGetStatus(...args),
    getPlayersStats: (...args: unknown[]) => mockGetPlayersStats(...args),
    getUploadHistory: (...args: unknown[]) => mockGetUploadHistory(...args),
    getPlayers: (...args: unknown[]) => mockGetPlayers(...args),
    getLeagues: (...args: unknown[]) => mockGetLeagues(...args),
    getUsers: (...args: unknown[]) => mockGetUsers(...args),
    getPlayersNeedingClassification: (...args: unknown[]) => mockGetPlayersNeedingClassification(...args),
    importQuotazioni: vi.fn().mockResolvedValue({ success: true, message: 'Importazione completata' }),
    deleteAllPlayers: vi.fn().mockResolvedValue({ success: true, message: 'Giocatori eliminati' }),
    getApiFootballStatus: (...args: unknown[]) => mockGetApiFootballStatus(...args),
    getMatchProposals: (...args: unknown[]) => mockGetMatchProposals(...args),
    refreshApiFootballCache: vi.fn().mockResolvedValue({ success: true }),
    confirmMatch: vi.fn().mockResolvedValue({ success: true }),
    searchApiFootballPlayers: vi.fn().mockResolvedValue({ success: true, data: { players: [] } }),
    getMatchedPlayers: (...args: unknown[]) => mockGetMatchedPlayers(...args),
    removeMatch: vi.fn().mockResolvedValue({ success: true }),
    classifyExitedPlayers: vi.fn().mockResolvedValue({ success: true }),
    getMemberRoster: vi.fn().mockResolvedValue({ success: true, data: null }),
    setAdmin: vi.fn().mockResolvedValue({ success: true }),
  },
  playerApi: {
    getTeams: (...args: unknown[]) => mockGetTeams(...args),
  },
}))

// Sample data
const sampleStats = {
  totalPlayers: 500,
  inList: 450,
  notInList: 50,
  byPosition: [
    { position: 'P', listStatus: 'IN_LIST', _count: 50 },
    { position: 'P', listStatus: 'NOT_IN_LIST', _count: 10 },
    { position: 'D', listStatus: 'IN_LIST', _count: 150 },
    { position: 'D', listStatus: 'NOT_IN_LIST', _count: 15 },
    { position: 'C', listStatus: 'IN_LIST', _count: 150 },
    { position: 'C', listStatus: 'NOT_IN_LIST', _count: 15 },
    { position: 'A', listStatus: 'IN_LIST', _count: 100 },
    { position: 'A', listStatus: 'NOT_IN_LIST', _count: 10 },
  ],
}

const sampleLeagues = [
  {
    id: 'l1',
    name: 'Lega Alfa',
    status: 'ACTIVE',
    maxParticipants: 8,
    initialBudget: 500,
    createdAt: '2025-01-01',
    members: [
      { id: 'm1', role: 'ADMIN', status: 'ACTIVE', currentBudget: 350, user: { id: 'u1', username: 'Admin1', email: 'admin1@test.it' } },
    ],
    _count: { members: 4, marketSessions: 2 },
  },
]

const sampleUsers = [
  { id: 'u1', username: 'Admin1', email: 'admin1@test.it', emailVerified: true, isSuperAdmin: false, createdAt: '2025-01-01', _count: { leagueMemberships: 2 } },
  { id: 'u2', username: 'User2', email: 'user2@test.it', emailVerified: false, isSuperAdmin: false, createdAt: '2025-02-01', _count: { leagueMemberships: 0 } },
]

const sampleUploadHistory = [
  {
    id: 'up1',
    fileName: 'quotazioni.xlsx',
    sheetName: 'Tutti',
    playersCreated: 100,
    playersUpdated: 50,
    playersNotInList: 10,
    totalProcessed: 160,
    errors: null,
    createdAt: '2025-01-15T10:00:00Z',
    uploadedBy: { id: 'u1', username: 'Admin1' },
  },
]

describe('SuperAdmin', () => {
  const mockOnNavigate = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetStatus.mockResolvedValue({
      success: true,
      data: { isSuperAdmin: true },
    })
    mockGetPlayersStats.mockResolvedValue({
      success: true,
      data: sampleStats,
    })
    mockGetUploadHistory.mockResolvedValue({
      success: true,
      data: { uploads: sampleUploadHistory },
    })
    mockGetPlayers.mockResolvedValue({
      success: true,
      data: { players: [], total: 0, page: 1, limit: 50, totalPages: 0 },
    })
    mockGetLeagues.mockResolvedValue({
      success: true,
      data: { leagues: sampleLeagues },
    })
    mockGetUsers.mockResolvedValue({
      success: true,
      data: { users: sampleUsers },
    })
    mockGetPlayersNeedingClassification.mockResolvedValue({
      success: true,
      data: { players: [] },
    })
    mockGetApiFootballStatus.mockResolvedValue({
      success: true,
      data: { totalPlayers: 500, matched: 300, unmatched: 200, withStats: 250, withoutStats: 50, lastSync: null },
    })
    mockGetMatchProposals.mockResolvedValue({
      success: true,
      data: { proposals: [], cacheRefreshed: false },
    })
    mockGetMatchedPlayers.mockResolvedValue({
      success: true,
      data: { players: [] },
    })
    mockGetTeams.mockResolvedValue({
      success: true,
      data: [],
    })
  })

  it('renders loading state while checking permissions', () => {
    mockGetStatus.mockReturnValue(new Promise(() => {}))

    render(<SuperAdmin onNavigate={mockOnNavigate} />)

    expect(screen.getByText('Verifica permessi...')).toBeInTheDocument()
  })

  it('shows access denied when user is not super admin', async () => {
    mockGetStatus.mockResolvedValue({
      success: true,
      data: { isSuperAdmin: false },
    })

    render(<SuperAdmin onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Accesso Negato')).toBeInTheDocument()
    })

    expect(screen.getByText('Non hai i permessi di Superadmin per accedere a questa area.')).toBeInTheDocument()
  })

  it('shows back to dashboard button on access denied page', async () => {
    mockGetStatus.mockResolvedValue({
      success: true,
      data: { isSuperAdmin: false },
    })

    const user = userEvent.setup()
    render(<SuperAdmin onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Torna alla Dashboard')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Torna alla Dashboard'))
    expect(mockOnNavigate).toHaveBeenCalledWith('dashboard')
  })

  it('renders the super admin panel header after authentication', async () => {
    render(<SuperAdmin onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Pannello Super Admin')).toBeInTheDocument()
    })

    expect(screen.getByText('Gestione piattaforma Fantacontratti')).toBeInTheDocument()
  })

  it('renders Navigation component with correct props', async () => {
    render(<SuperAdmin onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      const nav = screen.getByTestId('navigation')
      expect(nav).toBeInTheDocument()
      expect(nav).toHaveAttribute('data-page', 'superadmin')
    })
  })

  it('defaults to upload tab', async () => {
    render(<SuperAdmin onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Pannello Super Admin')).toBeInTheDocument()
    })

    // Upload tab is active by default, so loadUploadHistory should have been called
    expect(mockGetUploadHistory).toHaveBeenCalled()
  })

  it('uses initialTab prop to set starting tab', async () => {
    render(<SuperAdmin onNavigate={mockOnNavigate} initialTab="leagues" />)

    await waitFor(() => {
      expect(screen.getByText('Pannello Super Admin')).toBeInTheDocument()
    })

    // Leagues tab should load leagues
    expect(mockGetLeagues).toHaveBeenCalled()
  })

  it('loads players stats on mount', async () => {
    render(<SuperAdmin onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(mockGetPlayersStats).toHaveBeenCalled()
    })
  })

  it('calls getStatus on mount to verify superadmin', async () => {
    render(<SuperAdmin onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(mockGetStatus).toHaveBeenCalled()
    })
  })

  it('loads upload history when on upload tab', async () => {
    render(<SuperAdmin onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(mockGetUploadHistory).toHaveBeenCalled()
    })
  })

  it('loads users when switching to users tab', async () => {
    render(<SuperAdmin onNavigate={mockOnNavigate} initialTab="users" />)

    await waitFor(() => {
      expect(mockGetUsers).toHaveBeenCalled()
    })
  })

  it('loads leagues when switching to leagues tab', async () => {
    render(<SuperAdmin onNavigate={mockOnNavigate} initialTab="leagues" />)

    await waitFor(() => {
      expect(mockGetLeagues).toHaveBeenCalled()
    })
  })

  it('loads players when switching to players tab', async () => {
    render(<SuperAdmin onNavigate={mockOnNavigate} initialTab="players" />)

    await waitFor(() => {
      expect(mockGetPlayers).toHaveBeenCalled()
    })
  })

  it('loads API Football status when switching to stats tab', async () => {
    render(<SuperAdmin onNavigate={mockOnNavigate} initialTab="stats" />)

    await waitFor(() => {
      expect(mockGetApiFootballStatus).toHaveBeenCalled()
    })
  })

  it('loads players needing classification on upload tab', async () => {
    render(<SuperAdmin onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(mockGetPlayersNeedingClassification).toHaveBeenCalled()
    })
  })
})
