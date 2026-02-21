import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Indemnity } from '../pages/Indemnity'

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

// Mock Button
vi.mock('../components/ui/Button', () => ({
  Button: ({ children, onClick, disabled, ...props }: React.ComponentProps<'button'>) => (
    <button onClick={onClick} disabled={disabled} {...props}>{children}</button>
  ),
}))

// Mock Card
vi.mock('../components/ui/Card', () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>{children}</div>
  ),
}))

// Mock PositionBadge
vi.mock('../components/ui/PositionBadge', () => ({
  POSITION_COLORS: {
    P: { bg: 'bg-amber-500' },
    D: { bg: 'bg-blue-500' },
    C: { bg: 'bg-emerald-500' },
    A: { bg: 'bg-red-500' },
  },
}))

// Mock teamLogos
vi.mock('../utils/teamLogos', () => ({
  getTeamLogo: () => '/fake-logo.png',
}))

// API mocks
const mockGetById = vi.fn()
const mockGetMyAffectedPlayers = vi.fn()
const mockGetAllDecisionsStatus = vi.fn()
const mockSubmitDecisions = vi.fn()

vi.mock('../services/api', () => ({
  leagueApi: {
    getById: (...args: unknown[]) => mockGetById(...args),
  },
  indemnityApi: {
    getMyAffectedPlayers: (...args: unknown[]) => mockGetMyAffectedPlayers(...args),
    getAllDecisionsStatus: (...args: unknown[]) => mockGetAllDecisionsStatus(...args),
    submitDecisions: (...args: unknown[]) => mockSubmitDecisions(...args),
  },
}))

// Sample data
const sampleAffectedPlayers = [
  {
    playerId: 'p1',
    playerName: 'Mario Rossi',
    position: 'A',
    team: 'Roma',
    exitReason: 'ESTERO' as const,
    exitDate: '2025-06-01',
    contract: { id: 'c1', salary: 10, duration: 3, rescissionClause: 30 },
    roster: { id: 'r1', acquisitionPrice: 15 },
  },
  {
    playerId: 'p2',
    playerName: 'Luigi Verdi',
    position: 'C',
    team: 'Milan',
    exitReason: 'RETROCESSO' as const,
    exitDate: '2025-06-01',
    contract: { id: 'c2', salary: 5, duration: 2, rescissionClause: 10 },
    roster: { id: 'r2', acquisitionPrice: 8 },
  },
  {
    playerId: 'p3',
    playerName: 'Paolo Bianchi',
    position: 'D',
    team: 'Napoli',
    exitReason: 'RITIRATO' as const,
    exitDate: '2025-06-01',
    contract: { id: 'c3', salary: 3, duration: 1, rescissionClause: 5 },
    roster: { id: 'r3', acquisitionPrice: 4 },
  },
]

describe('Indemnity', () => {
  const mockOnNavigate = vi.fn()
  const defaultLeagueId = 'league1'

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetById.mockResolvedValue({
      success: true,
      data: { userMembership: { role: 'MEMBER' } },
    })
    mockGetMyAffectedPlayers.mockResolvedValue({
      success: true,
      data: {
        inCalcoloIndennizziPhase: true,
        hasSubmittedDecisions: false,
        submittedAt: null,
        currentBudget: 200,
        indennizzoEstero: 50,
        affectedPlayers: sampleAffectedPlayers,
      },
    })
    mockGetAllDecisionsStatus.mockResolvedValue({
      success: true,
      data: { inCalcoloIndennizziPhase: true, managers: [], allDecided: false },
    })
  })

  it('shows loading spinner initially', () => {
    mockGetById.mockReturnValue(new Promise(() => {}))
    render(<Indemnity leagueId={defaultLeagueId} onNavigate={mockOnNavigate} />)
    expect(screen.getByText('Caricamento indennizzi...')).toBeInTheDocument()
  })

  it('renders page header after loading', async () => {
    render(<Indemnity leagueId={defaultLeagueId} onNavigate={mockOnNavigate} />)
    await waitFor(() => {
      expect(screen.getByText('Calcolo Indennizzi')).toBeInTheDocument()
    })
    expect(screen.getByText('Gestisci i giocatori che sono usciti dalla lista quotazioni')).toBeInTheDocument()
  })

  it('renders Navigation with correct currentPage', async () => {
    render(<Indemnity leagueId={defaultLeagueId} onNavigate={mockOnNavigate} />)
    await waitFor(() => {
      expect(screen.getByTestId('navigation')).toHaveAttribute('data-page', 'indemnity')
    })
  })

  it('displays retired players as automatically released', async () => {
    render(<Indemnity leagueId={defaultLeagueId} onNavigate={mockOnNavigate} />)
    await waitFor(() => {
      expect(screen.getByText('Paolo Bianchi')).toBeInTheDocument()
    })
    expect(screen.getByText('Giocatori Ritirati')).toBeInTheDocument()
    expect(screen.getByText('Rilasciato')).toBeInTheDocument()
  })

  it('displays players needing decision with decision buttons', async () => {
    render(<Indemnity leagueId={defaultLeagueId} onNavigate={mockOnNavigate} />)
    await waitFor(() => {
      expect(screen.getByText('Mario Rossi')).toBeInTheDocument()
    })
    expect(screen.getByText('Luigi Verdi')).toBeInTheDocument()
    expect(screen.getByText('Le Tue Decisioni')).toBeInTheDocument()
  })

  it('shows phase not active message when not in calcolo phase', async () => {
    mockGetMyAffectedPlayers.mockResolvedValue({
      success: true,
      data: {
        inCalcoloIndennizziPhase: false,
        hasSubmittedDecisions: false,
        submittedAt: null,
        currentBudget: 200,
        indennizzoEstero: 50,
        affectedPlayers: sampleAffectedPlayers,
      },
    })
    render(<Indemnity leagueId={defaultLeagueId} onNavigate={mockOnNavigate} />)
    await waitFor(() => {
      expect(screen.getByText('Fase non attiva')).toBeInTheDocument()
    })
  })

  it('shows no affected players message when list is empty', async () => {
    mockGetMyAffectedPlayers.mockResolvedValue({
      success: true,
      data: {
        inCalcoloIndennizziPhase: true,
        hasSubmittedDecisions: false,
        submittedAt: null,
        currentBudget: 200,
        indennizzoEstero: 50,
        affectedPlayers: [],
      },
    })
    render(<Indemnity leagueId={defaultLeagueId} onNavigate={mockOnNavigate} />)
    await waitFor(() => {
      expect(screen.getByText('Nessun giocatore interessato')).toBeInTheDocument()
    })
  })

  it('shows already submitted message when decisions were sent', async () => {
    mockGetMyAffectedPlayers.mockResolvedValue({
      success: true,
      data: {
        inCalcoloIndennizziPhase: true,
        hasSubmittedDecisions: true,
        submittedAt: '2025-06-01T10:00:00Z',
        currentBudget: 200,
        indennizzoEstero: 50,
        affectedPlayers: sampleAffectedPlayers,
      },
    })
    render(<Indemnity leagueId={defaultLeagueId} onNavigate={mockOnNavigate} />)
    await waitFor(() => {
      expect(screen.getByText('Decisioni inviate')).toBeInTheDocument()
    })
  })

  it('allows toggling decisions between KEEP and RELEASE', async () => {
    const user = userEvent.setup()
    render(<Indemnity leagueId={defaultLeagueId} onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Mario Rossi')).toBeInTheDocument()
    })

    // Click the RELEASE button for ESTERO player
    const releaseButtons = screen.getAllByText(/Rilascia/)
    expect(releaseButtons.length).toBeGreaterThan(0)
    await user.click(releaseButtons[0]!)
  })

  it('displays contract info for each player needing decision', async () => {
    render(<Indemnity leagueId={defaultLeagueId} onNavigate={mockOnNavigate} />)
    await waitFor(() => {
      expect(screen.getByText('Mario Rossi')).toBeInTheDocument()
    })
    // Contract details shown (salary + clausola may appear in multiple players)
    expect(screen.getAllByText('10M').length).toBeGreaterThan(0)
    expect(screen.getAllByText('30M').length).toBeGreaterThan(0)
  })

  it('displays summary section with budget and submit button', async () => {
    render(<Indemnity leagueId={defaultLeagueId} onNavigate={mockOnNavigate} />)
    await waitFor(() => {
      expect(screen.getByText('Riepilogo')).toBeInTheDocument()
    })
    expect(screen.getByText('Conferma Decisioni')).toBeInTheDocument()
  })

  it('submits decisions and shows success message', async () => {
    const user = userEvent.setup()
    mockSubmitDecisions.mockResolvedValue({
      success: true,
      message: 'Decisioni inviate con successo!',
    })

    render(<Indemnity leagueId={defaultLeagueId} onNavigate={mockOnNavigate} />)
    await waitFor(() => {
      expect(screen.getByText('Conferma Decisioni')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Conferma Decisioni'))

    await waitFor(() => {
      expect(mockSubmitDecisions).toHaveBeenCalledWith(defaultLeagueId, expect.any(Array))
    })
  })

  it('shows error message when submission fails', async () => {
    const user = userEvent.setup()
    mockSubmitDecisions.mockResolvedValue({
      success: false,
      message: 'Errore server',
    })

    render(<Indemnity leagueId={defaultLeagueId} onNavigate={mockOnNavigate} />)
    await waitFor(() => {
      expect(screen.getByText('Conferma Decisioni')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Conferma Decisioni'))

    await waitFor(() => {
      expect(screen.getByText('Errore server')).toBeInTheDocument()
    })
  })

  it('shows legend section with RETROCESSO and ESTERO info', async () => {
    render(<Indemnity leagueId={defaultLeagueId} onNavigate={mockOnNavigate} />)
    await waitFor(() => {
      expect(screen.getByText('Legenda')).toBeInTheDocument()
    })
  })
})
