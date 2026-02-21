import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PatchNotes } from '../pages/PatchNotes'

// Mock the useAuth hook
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: '1', email: 'test@test.com', username: 'Test' },
    isAuthenticated: true,
    isLoading: false,
  }),
}))

// Mock the API services
vi.mock('../services/api', () => ({
  leagueApi: {
    getById: vi.fn().mockResolvedValue({
      success: true,
      data: {
        name: 'Test League',
        userMembership: { role: 'MEMBER', teamName: 'Test FC' },
      },
    }),
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

describe('PatchNotes Page', () => {
  const defaultProps = {
    leagueId: 'league-123',
    onNavigate: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the page heading', () => {
    render(<PatchNotes {...defaultProps} />)

    expect(screen.getByText('Patch Notes')).toBeInTheDocument()
    expect(
      screen.getByText("Cronologia degli aggiornamenti dell'applicazione")
    ).toBeInTheDocument()
  })

  it('renders the Alpha Test badge', () => {
    render(<PatchNotes {...defaultProps} />)

    expect(screen.getByText('Alpha Test')).toBeInTheDocument()
  })

  it('renders patch note entries with titles', () => {
    render(<PatchNotes {...defaultProps} />)

    // Verify a few known patch note titles from the hardcoded list
    expect(screen.getByText('Sistema di backup automatico pre-deploy')).toBeInTheDocument()
    expect(screen.getByText('Statistiche giocatori accurate')).toBeInTheDocument()
    expect(screen.getByText('Fix salvataggio strategie Rubata')).toBeInTheDocument()
    expect(screen.getByText('Pagina Patch Notes')).toBeInTheDocument()
  })

  it('renders type badges (feature, fix, improvement)', () => {
    render(<PatchNotes {...defaultProps} />)

    const featureBadges = screen.getAllByText('Nuova Funzionalita')
    const fixBadges = screen.getAllByText('Bug Fix')
    const improvementBadges = screen.getAllByText('Miglioramento')

    expect(featureBadges.length).toBeGreaterThan(0)
    expect(fixBadges.length).toBeGreaterThan(0)
    expect(improvementBadges.length).toBeGreaterThan(0)
  })

  it('renders issue numbers where present', () => {
    render(<PatchNotes {...defaultProps} />)

    // Issue numbers from the hardcoded data
    expect(screen.getByText('#217')).toBeInTheDocument()
    expect(screen.getByText('#214')).toBeInTheDocument()
    expect(screen.getByText('#208')).toBeInTheDocument()
  })

  it('renders the footer text', () => {
    render(<PatchNotes {...defaultProps} />)

    expect(
      screen.getByText(
        "Hai suggerimenti o hai trovato un bug? Contatta l'amministratore della lega."
      )
    ).toBeInTheDocument()
  })
})
