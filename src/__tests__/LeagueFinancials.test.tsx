import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'u1', email: 'test@test.com', username: 'TestUser' },
    isAuthenticated: true,
    isLoading: false,
  }),
}))

vi.mock('../components/ui/Toast', () => ({
  useToast: () => ({
    toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
  }),
}))

const mockFinancialsData = {
  leagueName: 'Test League',
  maxSlots: 25,
  isAdmin: true,
  inContrattiPhase: false,
  availableSessions: [],
  teams: [
    {
      memberId: 'm1',
      teamName: 'FC Uno',
      username: 'Admin',
      budget: 200,
      annualContractCost: 50,
      totalContractCost: 120,
      totalAcquisitionCost: 80,
      slotCount: 10,
      slotsFree: 15,
      maxSlots: 25,
      ageDistribution: { under20: 1, under25: 3, under30: 4, over30: 2, unknown: 0 },
      positionDistribution: { P: 2, D: 3, C: 3, A: 2 },
      players: [],
      preRenewalContractCost: 50,
      postRenewalContractCost: null,
      costByPosition: {
        P: { preRenewal: 10, postRenewal: null },
        D: { preRenewal: 15, postRenewal: null },
        C: { preRenewal: 15, postRenewal: null },
        A: { preRenewal: 10, postRenewal: null },
      },
      isConsolidated: false,
      consolidatedAt: null,
      preConsolidationBudget: null,
      totalReleaseCosts: null,
      totalIndemnities: null,
      totalRenewalCosts: null,
      tradeBudgetIn: 0,
      tradeBudgetOut: 0,
    },
  ],
}

const mockGetFinancials = vi.fn()
const mockGetFinancialTrends = vi.fn()

vi.mock('../services/api', () => ({
  leagueApi: {
    getFinancials: (...args: unknown[]) => mockGetFinancials(...args),
    getFinancialTrends: (...args: unknown[]) => mockGetFinancialTrends(...args),
    getPendingRequests: vi.fn().mockResolvedValue({ success: true, data: [] }),
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
}))

vi.mock('../components/Navigation', () => ({
  Navigation: () => <nav data-testid="navigation">Nav</nav>,
}))

vi.mock('../components/PullToRefresh', () => ({
  PullToRefresh: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('../components/ShareButton', () => ({
  ShareButton: () => <button data-testid="share-button">Share</button>,
}))

// Mock finance sub-components to isolate tests on the page shell
vi.mock('../components/finance/FinanceDashboard', () => ({
  FinanceDashboard: () => <div data-testid="finance-dashboard">Dashboard Content</div>,
}))

vi.mock('../components/finance/TeamComparison', () => ({
  TeamComparison: () => <div data-testid="team-comparison">Team Comparison Content</div>,
}))

vi.mock('../components/finance/TeamFinanceDetail', () => ({
  TeamFinanceDetail: () => <div data-testid="team-finance-detail">Team Detail Content</div>,
}))

vi.mock('../components/finance/FinanceTimeline', () => ({
  FinanceTimeline: () => <div data-testid="finance-timeline">Finance Timeline Content</div>,
}))

// ---------------------------------------------------------------------------
import LeagueFinancials from '../pages/LeagueFinancials'

describe('LeagueFinancials Page', () => {
  const mockOnNavigate = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders loading skeleton while data is being fetched', () => {
    mockGetFinancials.mockReturnValue(new Promise(() => {}))

    render(<LeagueFinancials leagueId="league-1" onNavigate={mockOnNavigate} />)

    // The loading state shows animate-pulse skeleton blocks
    const pulseContainer = document.querySelector('.animate-pulse')
    expect(pulseContainer).toBeTruthy()
  })

  it('renders error state when API fails', async () => {
    mockGetFinancials.mockRejectedValue(new Error('fail'))

    render(<LeagueFinancials leagueId="league-1" onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Errore di connessione')).toBeInTheDocument()
    })

    expect(screen.getByText('Riprova')).toBeInTheDocument()
  })

  it('renders error state with custom message from API', async () => {
    mockGetFinancials.mockResolvedValue({ success: false, message: 'Lega non accessibile' })

    render(<LeagueFinancials leagueId="league-1" onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Lega non accessibile')).toBeInTheDocument()
    })
  })

  it('renders the page header and FinanceDashboard after successful load', async () => {
    mockGetFinancials.mockResolvedValue({ success: true, data: mockFinancialsData })

    render(<LeagueFinancials leagueId="league-1" onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Finanze Lega')).toBeInTheDocument()
    })

    expect(screen.getByText('Test League')).toBeInTheDocument()

    // Default view is Panoramica which renders FinanceDashboard
    expect(screen.getByTestId('finance-dashboard')).toBeInTheDocument()
  })

  it('switches tabs between Panoramica, Squadre, and Movimenti', async () => {
    mockGetFinancials.mockResolvedValue({ success: true, data: mockFinancialsData })
    mockGetFinancialTrends.mockResolvedValue({ success: true, data: { trends: {} } })

    const user = userEvent.setup()

    render(<LeagueFinancials leagueId="league-1" onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByTestId('finance-dashboard')).toBeInTheDocument()
    })

    // Switch to Squadre tab
    await user.click(screen.getByText('Squadre'))

    await waitFor(() => {
      expect(screen.getByTestId('team-comparison')).toBeInTheDocument()
    })

    // Switch to Movimenti tab
    await user.click(screen.getByText('Movimenti'))

    await waitFor(() => {
      expect(screen.getByTestId('finance-timeline')).toBeInTheDocument()
    })

    // Switch back to Panoramica
    await user.click(screen.getByText('Panoramica'))

    await waitFor(() => {
      expect(screen.getByTestId('finance-dashboard')).toBeInTheDocument()
    })
  })

  it('shows CONTRATTI phase banner when phase is active', async () => {
    const dataWithContratti = { ...mockFinancialsData, inContrattiPhase: true }
    mockGetFinancials.mockResolvedValue({ success: true, data: dataWithContratti })

    render(<LeagueFinancials leagueId="league-1" onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Fase Contratti in Corso')).toBeInTheDocument()
    })
  })
})
