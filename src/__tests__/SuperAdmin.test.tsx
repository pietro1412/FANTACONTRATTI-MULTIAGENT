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
const mockDeleteAllPlayers = vi.fn()
const mockImportQuotazioni = vi.fn()
const mockGetMemberRoster = vi.fn()
const mockClassifyExitedPlayers = vi.fn()
const mockConfirmMatch = vi.fn()
const mockRemoveMatch = vi.fn()
const mockRefreshApiFootballCache = vi.fn()

vi.mock('../services/api', () => ({
  superadminApi: {
    getStatus: (...args: unknown[]) => mockGetStatus(...args),
    getPlayersStats: (...args: unknown[]) => mockGetPlayersStats(...args),
    getUploadHistory: (...args: unknown[]) => mockGetUploadHistory(...args),
    getPlayers: (...args: unknown[]) => mockGetPlayers(...args),
    getLeagues: (...args: unknown[]) => mockGetLeagues(...args),
    getUsers: (...args: unknown[]) => mockGetUsers(...args),
    getPlayersNeedingClassification: (...args: unknown[]) => mockGetPlayersNeedingClassification(...args),
    importQuotazioni: (...args: unknown[]) => mockImportQuotazioni(...args),
    deleteAllPlayers: (...args: unknown[]) => mockDeleteAllPlayers(...args),
    getApiFootballStatus: (...args: unknown[]) => mockGetApiFootballStatus(...args),
    getMatchProposals: (...args: unknown[]) => mockGetMatchProposals(...args),
    refreshApiFootballCache: (...args: unknown[]) => mockRefreshApiFootballCache(...args),
    confirmMatch: (...args: unknown[]) => mockConfirmMatch(...args),
    searchApiFootballPlayers: vi.fn().mockResolvedValue({ success: true, data: { players: [] } }),
    getMatchedPlayers: (...args: unknown[]) => mockGetMatchedPlayers(...args),
    removeMatch: (...args: unknown[]) => mockRemoveMatch(...args),
    classifyExitedPlayers: (...args: unknown[]) => mockClassifyExitedPlayers(...args),
    getMemberRoster: (...args: unknown[]) => mockGetMemberRoster(...args),
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
    mockDeleteAllPlayers.mockResolvedValue({ success: true, message: 'Giocatori eliminati' })
    mockImportQuotazioni.mockResolvedValue({ success: true, message: 'Importazione completata' })
    mockGetMemberRoster.mockResolvedValue({ success: true, data: null })
    mockClassifyExitedPlayers.mockResolvedValue({ success: true })
    mockConfirmMatch.mockResolvedValue({ success: true })
    mockRemoveMatch.mockResolvedValue({ success: true })
    mockRefreshApiFootballCache.mockResolvedValue({ success: true })
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

  // ---- NEW TESTS: Upload tab content ----

  it('displays player stats cards on the upload tab', async () => {
    render(<SuperAdmin onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Pannello Super Admin')).toBeInTheDocument()
    })

    // Stats should render the total players
    await waitFor(() => {
      expect(screen.getByText('500')).toBeInTheDocument()
    })
    expect(screen.getByText('Totale Giocatori')).toBeInTheDocument()
    expect(screen.getByText('450')).toBeInTheDocument()
    expect(screen.getByText('In Lista')).toBeInTheDocument()
    expect(screen.getByText('50')).toBeInTheDocument()
    expect(screen.getByText('Non in Lista')).toBeInTheDocument()
    expect(screen.getByText('90%')).toBeInTheDocument()
    expect(screen.getByText('Attivi')).toBeInTheDocument()
  })

  it('displays position breakdown in upload tab', async () => {
    render(<SuperAdmin onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Giocatori per Ruolo')).toBeInTheDocument()
    })

    expect(screen.getByText('Portieri')).toBeInTheDocument()
    expect(screen.getByText('Difensori')).toBeInTheDocument()
    expect(screen.getByText('Centrocampisti')).toBeInTheDocument()
    expect(screen.getByText('Attaccanti')).toBeInTheDocument()
    // Multiple positions have "X attivi" / "X rimossi", use getAllByText
    expect(screen.getAllByText('50 attivi').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('150 attivi').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('100 attivi').length).toBeGreaterThanOrEqual(1)
  })

  it('displays the upload form with sheet name input', async () => {
    render(<SuperAdmin onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Carica Quotazioni')).toBeInTheDocument()
    })

    expect(screen.getByPlaceholderText('Es: Tutti')).toBeInTheDocument()
    expect(screen.getByText('Importa Quotazioni')).toBeInTheDocument()
    expect(screen.getByText('Cancella Tutti i Giocatori')).toBeInTheDocument()
  })

  it('displays upload history with entries', async () => {
    render(<SuperAdmin onNavigate={mockOnNavigate} />)

    // Wait until upload history is rendered (async data loading)
    await waitFor(() => {
      expect(screen.getByText('quotazioni.xlsx')).toBeInTheDocument()
    })

    expect(screen.getByText('Storico Caricamenti')).toBeInTheDocument()
    expect(screen.getByText('+100 nuovi')).toBeInTheDocument()
    expect(screen.getByText('50 aggiornati')).toBeInTheDocument()
    expect(screen.getByText('10 non in lista')).toBeInTheDocument()
    expect(screen.getByText('(160 totali)')).toBeInTheDocument()
  })

  it('displays "no upload history" message when history is empty', async () => {
    mockGetUploadHistory.mockResolvedValue({
      success: true,
      data: { uploads: [] },
    })

    render(<SuperAdmin onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Nessun caricamento effettuato')).toBeInTheDocument()
    })
  })

  it('displays "no players to classify" when there are none', async () => {
    render(<SuperAdmin onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Nessun giocatore da classificare')).toBeInTheDocument()
    })
  })

  it('shows delete confirmation modal when delete button is clicked', async () => {
    const user = userEvent.setup()
    render(<SuperAdmin onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Cancella Tutti i Giocatori')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Cancella Tutti i Giocatori'))

    await waitFor(() => {
      expect(screen.getByText('Conferma Cancellazione')).toBeInTheDocument()
    })

    expect(screen.getByText('Annulla')).toBeInTheDocument()
    expect(screen.getByText('Conferma')).toBeInTheDocument()
  })

  it('closes delete confirmation when Annulla is clicked', async () => {
    const user = userEvent.setup()
    render(<SuperAdmin onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Cancella Tutti i Giocatori')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Cancella Tutti i Giocatori'))

    await waitFor(() => {
      expect(screen.getByText('Conferma Cancellazione')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Annulla'))

    await waitFor(() => {
      expect(screen.queryByText('Conferma Cancellazione')).not.toBeInTheDocument()
    })
  })

  // ---- NEW TESTS: Players tab content ----

  it('renders player filters on the players tab', async () => {
    render(<SuperAdmin onNavigate={mockOnNavigate} initialTab="players" />)

    await waitFor(() => {
      expect(screen.getByText('Pannello Super Admin')).toBeInTheDocument()
    })

    expect(screen.getByPlaceholderText('Nome giocatore...')).toBeInTheDocument()
    expect(screen.getByText('Reset')).toBeInTheDocument()
  })

  it('displays players table when players exist', async () => {
    mockGetPlayers.mockResolvedValue({
      success: true,
      data: {
        players: [
          { id: 'p1', externalId: null, name: 'Mario Rossi', team: 'Juventus', position: 'A', quotation: 25, listStatus: 'IN_LIST' },
          { id: 'p2', externalId: null, name: 'Luigi Bianchi', team: 'Milan', position: 'C', quotation: 15, listStatus: 'NOT_IN_LIST' },
        ],
        total: 2,
        page: 1,
        limit: 50,
        totalPages: 1,
      },
    })

    render(<SuperAdmin onNavigate={mockOnNavigate} initialTab="players" />)

    await waitFor(() => {
      expect(screen.getByText('Mario Rossi')).toBeInTheDocument()
    })

    expect(screen.getByText('Luigi Bianchi')).toBeInTheDocument()
    // Multiple players have In Lista/Non in Lista badges, use getAllByText
    expect(screen.getAllByText('In Lista').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Non in Lista').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('2 giocatori totali')).toBeInTheDocument()
  })

  it('displays "no players found" message when players list is empty', async () => {
    render(<SuperAdmin onNavigate={mockOnNavigate} initialTab="players" />)

    await waitFor(() => {
      expect(screen.getByText('Nessun giocatore trovato')).toBeInTheDocument()
    })
  })

  it('displays pagination controls with players', async () => {
    mockGetPlayers.mockResolvedValue({
      success: true,
      data: {
        players: [
          { id: 'p1', externalId: null, name: 'Player1', team: 'Team1', position: 'A', quotation: 10, listStatus: 'IN_LIST' },
        ],
        total: 100,
        page: 2,
        limit: 50,
        totalPages: 2,
      },
    })

    render(<SuperAdmin onNavigate={mockOnNavigate} initialTab="players" />)

    await waitFor(() => {
      expect(screen.getByText('100 giocatori totali')).toBeInTheDocument()
    })

    expect(screen.getByText('Prec.')).toBeInTheDocument()
    expect(screen.getByText('Succ.')).toBeInTheDocument()
    expect(screen.getByText('2 / 2')).toBeInTheDocument()
  })

  // ---- NEW TESTS: Leagues tab content ----

  it('renders leagues list on leagues tab', async () => {
    render(<SuperAdmin onNavigate={mockOnNavigate} initialTab="leagues" />)

    await waitFor(() => {
      expect(screen.getByText('Lega Alfa')).toBeInTheDocument()
    })

    expect(screen.getByText('500')).toBeInTheDocument() // initialBudget
  })

  it('renders league search input on leagues tab', async () => {
    render(<SuperAdmin onNavigate={mockOnNavigate} initialTab="leagues" />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Nome lega o username...')).toBeInTheDocument()
    })

    expect(screen.getByText('Cerca')).toBeInTheDocument()
  })

  it('expands league to show members when clicked', async () => {
    const user = userEvent.setup()
    render(<SuperAdmin onNavigate={mockOnNavigate} initialTab="leagues" />)

    await waitFor(() => {
      expect(screen.getByText('Lega Alfa')).toBeInTheDocument()
    })

    // Click the league row to expand it
    await user.click(screen.getByText('Lega Alfa'))

    await waitFor(() => {
      expect(screen.getByText('Membri della Lega')).toBeInTheDocument()
    })

    expect(screen.getByText('Admin1')).toBeInTheDocument()
    expect(screen.getByText('admin1@test.it')).toBeInTheDocument()
    expect(screen.getByText('Presidente')).toBeInTheDocument()
    expect(screen.getByText('Vedi Rosa')).toBeInTheDocument()
  })

  it('collapses expanded league when clicked again', async () => {
    const user = userEvent.setup()
    render(<SuperAdmin onNavigate={mockOnNavigate} initialTab="leagues" />)

    await waitFor(() => {
      expect(screen.getByText('Lega Alfa')).toBeInTheDocument()
    })

    // Expand
    await user.click(screen.getByText('Lega Alfa'))
    await waitFor(() => {
      expect(screen.getByText('Membri della Lega')).toBeInTheDocument()
    })

    // Collapse
    await user.click(screen.getByText('Lega Alfa'))
    await waitFor(() => {
      expect(screen.queryByText('Membri della Lega')).not.toBeInTheDocument()
    })
  })

  it('shows "no leagues found" when leagues list is empty', async () => {
    mockGetLeagues.mockResolvedValue({
      success: true,
      data: { leagues: [] },
    })

    render(<SuperAdmin onNavigate={mockOnNavigate} initialTab="leagues" />)

    await waitFor(() => {
      expect(screen.getByText('Nessuna lega trovata')).toBeInTheDocument()
    })
  })

  // ---- NEW TESTS: Users tab content ----

  it('renders users table on users tab', async () => {
    render(<SuperAdmin onNavigate={mockOnNavigate} initialTab="users" />)

    await waitFor(() => {
      expect(screen.getByText('Admin1')).toBeInTheDocument()
    })

    expect(screen.getByText('admin1@test.it')).toBeInTheDocument()
    expect(screen.getByText('Verificato')).toBeInTheDocument()
    expect(screen.getByText('User2')).toBeInTheDocument()
    expect(screen.getByText('user2@test.it')).toBeInTheDocument()
    expect(screen.getByText('Non verificato')).toBeInTheDocument()
  })

  it('shows "no users found" when users list is empty', async () => {
    mockGetUsers.mockResolvedValue({
      success: true,
      data: { users: [] },
    })

    render(<SuperAdmin onNavigate={mockOnNavigate} initialTab="users" />)

    await waitFor(() => {
      expect(screen.getByText('Nessun utente trovato')).toBeInTheDocument()
    })
  })

  it('displays SuperAdmin badge for super admin users', async () => {
    mockGetUsers.mockResolvedValue({
      success: true,
      data: {
        users: [
          { id: 'u1', username: 'SuperUser', email: 'super@test.it', emailVerified: true, isSuperAdmin: true, createdAt: '2025-01-01', _count: { leagueMemberships: 1 } },
        ],
      },
    })

    render(<SuperAdmin onNavigate={mockOnNavigate} initialTab="users" />)

    await waitFor(() => {
      expect(screen.getByText('SuperAdmin')).toBeInTheDocument()
    })
  })

  // ---- NEW TESTS: Stats tab content ----

  it('renders API Football status cards on stats tab', async () => {
    render(<SuperAdmin onNavigate={mockOnNavigate} initialTab="stats" />)

    await waitFor(() => {
      expect(screen.getByText('Stato Sync API-Football')).toBeInTheDocument()
    })

    // Check the status values
    await waitFor(() => {
      expect(screen.getByText('Giocatori Totali')).toBeInTheDocument()
    })
    expect(screen.getByText('Matchati')).toBeInTheDocument()
    expect(screen.getByText('Non Matchati')).toBeInTheDocument()
    expect(screen.getByText('Con Stats')).toBeInTheDocument()
    expect(screen.getByText('Senza Stats')).toBeInTheDocument()
    expect(screen.getByText('300')).toBeInTheDocument() // matched
    expect(screen.getByText('200')).toBeInTheDocument() // unmatched
    expect(screen.getByText('250')).toBeInTheDocument() // withStats
  })

  it('renders match and sync action cards on stats tab', async () => {
    render(<SuperAdmin onNavigate={mockOnNavigate} initialTab="stats" />)

    await waitFor(() => {
      expect(screen.getByText('1. Match Giocatori')).toBeInTheDocument()
    })

    expect(screen.getByText('2. Sync Statistiche')).toBeInTheDocument()
    expect(screen.getByText('Match Manuale')).toBeInTheDocument()
  })

  it('renders matching assistito section on stats tab', async () => {
    render(<SuperAdmin onNavigate={mockOnNavigate} initialTab="stats" />)

    await waitFor(() => {
      expect(screen.getByText('Matching Assistito')).toBeInTheDocument()
    })

    expect(screen.getByText('Aggiorna Cache API')).toBeInTheDocument()
    expect(screen.getByText('Genera Proposte')).toBeInTheDocument()
  })

  it('renders existing matches section on stats tab', async () => {
    render(<SuperAdmin onNavigate={mockOnNavigate} initialTab="stats" />)

    await waitFor(() => {
      expect(screen.getByText('Associazioni Esistenti')).toBeInTheDocument()
    })

    expect(screen.getByText('Nessuna associazione trovata')).toBeInTheDocument()
  })

  it('shows "all players associated" when no proposals exist', async () => {
    render(<SuperAdmin onNavigate={mockOnNavigate} initialTab="stats" />)

    await waitFor(() => {
      expect(screen.getByText('Tutti i giocatori sono stati associati')).toBeInTheDocument()
    })
  })

  it('loads teams when on players tab', async () => {
    render(<SuperAdmin onNavigate={mockOnNavigate} initialTab="players" />)

    await waitFor(() => {
      expect(mockGetTeams).toHaveBeenCalled()
    })
  })

  it('loads match proposals on stats tab', async () => {
    render(<SuperAdmin onNavigate={mockOnNavigate} initialTab="stats" />)

    await waitFor(() => {
      expect(mockGetMatchProposals).toHaveBeenCalled()
    })
  })

  it('loads matched players on stats tab', async () => {
    render(<SuperAdmin onNavigate={mockOnNavigate} initialTab="stats" />)

    await waitFor(() => {
      expect(mockGetMatchedPlayers).toHaveBeenCalled()
    })
  })

  // ---- NEW TESTS: Players needing classification ----

  it('displays players needing classification when they exist', async () => {
    mockGetPlayersNeedingClassification.mockResolvedValue({
      success: true,
      data: {
        players: [
          {
            playerId: 'ep1',
            playerName: 'Carlo Verdi',
            position: 'A',
            team: 'Fiorentina',
            lastQuotation: 20,
            contracts: [
              { leagueId: 'l1', leagueName: 'Lega Alfa', memberId: 'm1', memberUsername: 'Admin1', salary: 5, duration: 2 },
            ],
          },
        ],
      },
    })

    render(<SuperAdmin onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Carlo Verdi')).toBeInTheDocument()
    })

    expect(screen.getByText('Fiorentina')).toBeInTheDocument()
    expect(screen.getByText('Giocatori da Classificare')).toBeInTheDocument()
  })

  // ---- NEW TESTS: Delete all players confirmation flow ----

  it('executes delete all players when Conferma is clicked', async () => {
    const user = userEvent.setup()
    render(<SuperAdmin onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Cancella Tutti i Giocatori')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Cancella Tutti i Giocatori'))

    await waitFor(() => {
      expect(screen.getByText('Conferma')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Conferma'))

    await waitFor(() => {
      expect(mockDeleteAllPlayers).toHaveBeenCalled()
    })
  })

  // ---- NEW TESTS: Stats tab with matched players ----

  it('displays matched players list on stats tab', async () => {
    mockGetMatchedPlayers.mockResolvedValue({
      success: true,
      data: {
        players: [
          { id: 'mp1', name: 'Matched Player', team: 'Inter', position: 'C', quotation: 20, apiFootballId: 123, apiFootballName: 'M. Player' },
        ],
      },
    })

    render(<SuperAdmin onNavigate={mockOnNavigate} initialTab="stats" />)

    await waitFor(() => {
      expect(screen.getByText('Matched Player')).toBeInTheDocument()
    })

    expect(screen.getByText('M. Player')).toBeInTheDocument()
    expect(screen.getByText('API ID: 123')).toBeInTheDocument()
    expect(screen.getByText('Rimuovi')).toBeInTheDocument()
  })

  it('displays match proposals with confidence levels on stats tab', async () => {
    mockGetMatchProposals.mockResolvedValue({
      success: true,
      data: {
        proposals: [
          {
            dbPlayer: { id: 'db1', name: 'DB Player 1', team: 'Juventus', position: 'A', quotation: 25 },
            apiPlayer: { id: 456, name: 'API Player 1', team: 'Juventus' },
            confidence: 'HIGH',
            method: 'exact',
          },
          {
            dbPlayer: { id: 'db2', name: 'DB Player 2', team: 'Milan', position: 'D', quotation: 10 },
            apiPlayer: null,
            confidence: 'NONE',
            method: 'none',
          },
        ],
        cacheRefreshed: true,
      },
    })

    render(<SuperAdmin onNavigate={mockOnNavigate} initialTab="stats" />)

    await waitFor(() => {
      expect(screen.getByText('DB Player 1')).toBeInTheDocument()
    })

    expect(screen.getByText('API Player 1')).toBeInTheDocument()
    // "Alta" appears in both the summary card and the confidence badge on the row
    expect(screen.getAllByText('Alta').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Nessuna').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Conferma')).toBeInTheDocument()
    // DB Player 2 has no API match, so "Nessuna proposta" should show
    expect(screen.getByText('Nessuna proposta')).toBeInTheDocument()
    // Cache refreshed message
    expect(screen.getByText(/Cache aggiornata/)).toBeInTheDocument()
  })

  it('shows match proposals summary counts', async () => {
    mockGetMatchProposals.mockResolvedValue({
      success: true,
      data: {
        proposals: [
          { dbPlayer: { id: 'db1', name: 'P1', team: 'T1', position: 'A', quotation: 1 }, apiPlayer: { id: 1, name: 'AP1', team: 'T1' }, confidence: 'HIGH', method: 'exact' },
          { dbPlayer: { id: 'db2', name: 'P2', team: 'T2', position: 'D', quotation: 2 }, apiPlayer: { id: 2, name: 'AP2', team: 'T2' }, confidence: 'MEDIUM', method: 'fuzzy' },
          { dbPlayer: { id: 'db3', name: 'P3', team: 'T3', position: 'C', quotation: 3 }, apiPlayer: null, confidence: 'NONE', method: 'none' },
        ],
        cacheRefreshed: false,
      },
    })

    render(<SuperAdmin onNavigate={mockOnNavigate} initialTab="stats" />)

    await waitFor(() => {
      expect(screen.getByText('P1')).toBeInTheDocument()
    })

    // Summary counts and confidence badges may duplicate text
    expect(screen.getAllByText('Alta').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Media').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Bassa').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Nessuna').length).toBeGreaterThanOrEqual(1)
  })

  // ---- NEW TESTS: Roster modal via leagues tab ----

  it('opens roster modal when Vedi Rosa is clicked in expanded league', async () => {
    const user = userEvent.setup()
    mockGetMemberRoster.mockResolvedValue({
      success: true,
      data: {
        member: {
          id: 'm1',
          username: 'Admin1',
          email: 'admin1@test.it',
          currentBudget: 350,
          role: 'ADMIN',
          league: { id: 'l1', name: 'Lega Alfa' },
        },
        roster: [
          {
            id: 'r1',
            player: { id: 'p1', name: 'Portiere1', team: 'Napoli', position: 'P', quotation: 12 },
            contract: { id: 'c1', purchasePrice: 8, acquiredAt: '2025-01-01' },
          },
        ],
      },
    })

    render(<SuperAdmin onNavigate={mockOnNavigate} initialTab="leagues" />)

    await waitFor(() => {
      expect(screen.getByText('Lega Alfa')).toBeInTheDocument()
    })

    // Expand league
    await user.click(screen.getByText('Lega Alfa'))
    await waitFor(() => {
      expect(screen.getByText('Vedi Rosa')).toBeInTheDocument()
    })

    // Click "Vedi Rosa"
    await user.click(screen.getByText('Vedi Rosa'))

    await waitFor(() => {
      expect(mockGetMemberRoster).toHaveBeenCalledWith('m1')
    })

    // Roster modal should show player data
    await waitFor(() => {
      expect(screen.getByText('Rosa di Admin1')).toBeInTheDocument()
    })

    expect(screen.getByText('Portiere1')).toBeInTheDocument()
    expect(screen.getByText('Napoli')).toBeInTheDocument()
  })

  it('closes roster modal when Chiudi button is clicked', async () => {
    const user = userEvent.setup()
    mockGetMemberRoster.mockResolvedValue({
      success: true,
      data: {
        member: {
          id: 'm1',
          username: 'Admin1',
          email: 'admin1@test.it',
          currentBudget: 350,
          role: 'ADMIN',
          league: { id: 'l1', name: 'Lega Alfa' },
        },
        roster: [],
      },
    })

    render(<SuperAdmin onNavigate={mockOnNavigate} initialTab="leagues" />)

    await waitFor(() => {
      expect(screen.getByText('Lega Alfa')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Lega Alfa'))
    await waitFor(() => {
      expect(screen.getByText('Vedi Rosa')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Vedi Rosa'))

    await waitFor(() => {
      expect(screen.getByText('Chiudi')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Chiudi'))

    await waitFor(() => {
      expect(screen.queryByText('Rosa di Admin1')).not.toBeInTheDocument()
    })
  })

  // ---- NEW TESTS: Stats tab API Football status with lastSync ----

  it('shows last sync date when available', async () => {
    mockGetApiFootballStatus.mockResolvedValue({
      success: true,
      data: {
        totalPlayers: 500,
        matched: 300,
        unmatched: 200,
        withStats: 250,
        withoutStats: 50,
        lastSync: '2025-06-15T14:30:00Z',
      },
    })

    render(<SuperAdmin onNavigate={mockOnNavigate} initialTab="stats" />)

    await waitFor(() => {
      expect(screen.getByText(/Ultimo sync/)).toBeInTheDocument()
    })
  })

  // ---- NEW TESTS: Classification modal flow ----

  it('opens classification modal and displays edit step', async () => {
    const user = userEvent.setup()
    mockGetPlayersNeedingClassification.mockResolvedValue({
      success: true,
      data: {
        players: [
          {
            playerId: 'ep1',
            playerName: 'Carlo Verdi',
            position: 'A',
            team: 'Torino',
            lastQuotation: 20,
            contracts: [
              { leagueId: 'l1', leagueName: 'Lega Alfa', memberId: 'm1', memberUsername: 'Admin1', salary: 5, duration: 2 },
            ],
          },
        ],
      },
    })

    render(<SuperAdmin onNavigate={mockOnNavigate} />)

    // Wait for the "Classifica" button to appear
    await waitFor(() => {
      expect(screen.getByText('Classifica (1)')).toBeInTheDocument()
    })

    // Open classification modal
    await user.click(screen.getByText('Classifica (1)'))

    await waitFor(() => {
      expect(screen.getByText('Classifica Giocatori Usciti')).toBeInTheDocument()
    })

    // Should be in edit step with legend
    expect(screen.getByText('Legenda Classificazioni')).toBeInTheDocument()
    expect(screen.getByText('Prosegui (1)')).toBeInTheDocument()
    expect(screen.getByText('Annulla')).toBeInTheDocument()
  })

  it('advances to confirm step from classification modal', async () => {
    const user = userEvent.setup()
    mockGetPlayersNeedingClassification.mockResolvedValue({
      success: true,
      data: {
        players: [
          {
            playerId: 'ep1',
            playerName: 'Carlo Verdi',
            position: 'A',
            team: 'Torino',
            lastQuotation: 20,
            contracts: [
              { leagueId: 'l1', leagueName: 'Lega Alfa', memberId: 'm1', memberUsername: 'Admin1', salary: 5, duration: 2 },
            ],
          },
        ],
      },
    })

    render(<SuperAdmin onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Classifica (1)')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Classifica (1)'))

    await waitFor(() => {
      expect(screen.getByText('Prosegui (1)')).toBeInTheDocument()
    })

    // Click Prosegui to go to confirm step
    await user.click(screen.getByText('Prosegui (1)'))

    await waitFor(() => {
      expect(screen.getByText('Conferma Classificazioni')).toBeInTheDocument()
    })

    expect(screen.getByText('Riepilogo Classificazioni')).toBeInTheDocument()
    expect(screen.getByText('Conferma e Salva')).toBeInTheDocument()
    expect(screen.getByText('Modifica')).toBeInTheDocument()
  })

  it('submits classifications and calls the API', async () => {
    const user = userEvent.setup()

    const classificationPlayers = [
      {
        playerId: 'ep1',
        playerName: 'Carlo Verdi',
        position: 'A',
        team: 'Torino',
        lastQuotation: 20,
        contracts: [
          { leagueId: 'l1', leagueName: 'Lega Alfa', memberId: 'm1', memberUsername: 'Admin1', salary: 5, duration: 2 },
        ],
      },
    ]

    mockGetPlayersNeedingClassification.mockResolvedValue({
      success: true,
      data: { players: classificationPlayers },
    })

    render(<SuperAdmin onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Classifica (1)')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Classifica (1)'))
    await waitFor(() => {
      expect(screen.getByText('Prosegui (1)')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Prosegui (1)'))
    await waitFor(() => {
      expect(screen.getByText('Conferma e Salva')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Conferma e Salva'))

    await waitFor(() => {
      expect(mockClassifyExitedPlayers).toHaveBeenCalledWith([
        { playerId: 'ep1', exitReason: 'RITIRATO' },
      ])
    })
  })

  it('goes back from confirm to edit step in classification modal', async () => {
    const user = userEvent.setup()
    mockGetPlayersNeedingClassification.mockResolvedValue({
      success: true,
      data: {
        players: [
          {
            playerId: 'ep1',
            playerName: 'Carlo Verdi',
            position: 'A',
            team: 'Torino',
            lastQuotation: 20,
            contracts: [
              { leagueId: 'l1', leagueName: 'Lega Alfa', memberId: 'm1', memberUsername: 'Admin1', salary: 5, duration: 2 },
            ],
          },
        ],
      },
    })

    render(<SuperAdmin onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Classifica (1)')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Classifica (1)'))
    await waitFor(() => {
      expect(screen.getByText('Prosegui (1)')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Prosegui (1)'))
    await waitFor(() => {
      expect(screen.getByText('Modifica')).toBeInTheDocument()
    })

    // Click Modifica to go back to edit
    await user.click(screen.getByText('Modifica'))

    await waitFor(() => {
      expect(screen.getByText('Legenda Classificazioni')).toBeInTheDocument()
    })
  })

  // ---- NEW TESTS: Error handling ----

  it('shows proposals error message on stats tab', async () => {
    mockGetMatchProposals.mockResolvedValue({
      success: false,
      message: 'Errore nel caricamento delle proposte',
    })

    render(<SuperAdmin onNavigate={mockOnNavigate} initialTab="stats" />)

    await waitFor(() => {
      expect(screen.getByText('Errore nel caricamento delle proposte')).toBeInTheDocument()
    })
  })

  // ---- NEW TESTS: Upload history with errors ----

  it('displays upload entry with errors when they exist', async () => {
    mockGetUploadHistory.mockResolvedValue({
      success: true,
      data: {
        uploads: [{
          id: 'up2',
          fileName: 'errored.xlsx',
          sheetName: 'Tutti',
          playersCreated: 10,
          playersUpdated: 5,
          playersNotInList: 2,
          totalProcessed: 17,
          errors: ['Errore riga 5', 'Errore riga 10'],
          createdAt: '2025-02-01T10:00:00Z',
          uploadedBy: { id: 'u1', username: 'Admin1' },
        }],
      },
    })

    render(<SuperAdmin onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('errored.xlsx')).toBeInTheDocument()
    })

    expect(screen.getByText("2 errori durante l'import")).toBeInTheDocument()
  })

  // ---- NEW TESTS: Empty state for stats ----

  it('handles zero total players stat gracefully (0% active)', async () => {
    mockGetPlayersStats.mockResolvedValue({
      success: true,
      data: { totalPlayers: 0, inList: 0, notInList: 0, byPosition: [] },
    })

    render(<SuperAdmin onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Totale Giocatori')).toBeInTheDocument()
    })

    // Position breakdown should not render with 0 players
    expect(screen.queryByText('Giocatori per Ruolo')).not.toBeInTheDocument()
  })
})
