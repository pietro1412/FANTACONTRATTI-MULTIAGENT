import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FeedbackHub } from '../pages/FeedbackHub'

// Mock the useAuth hook
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: '1', email: 'test@test.com', username: 'Test', isSuperAdmin: false },
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
  inviteApi: {},
  feedbackApi: {
    getMyFeedback: vi.fn().mockResolvedValue({ success: true, data: { items: [], total: 0 } }),
    getUnreadNotifications: vi.fn().mockResolvedValue({ success: true, data: { count: 0 } }),
    getAll: vi.fn().mockResolvedValue({ success: true, data: { items: [], total: 0 } }),
    getById: vi.fn().mockResolvedValue({ success: true, data: {} }),
    submit: vi.fn().mockResolvedValue({ success: true }),
  },
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

// Mock child components to simplify testing
vi.mock('../components/FeedbackForm', () => ({
  FeedbackForm: ({ onCancel }: { onCancel: () => void }) => (
    <div data-testid="feedback-form">
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
}))

vi.mock('../components/FeedbackList', () => ({
  FeedbackList: () => <div data-testid="feedback-list">Feedback List</div>,
}))

vi.mock('../components/FeedbackDetail', () => ({
  FeedbackDetail: () => <div data-testid="feedback-detail">Feedback Detail</div>,
}))

describe('FeedbackHub Page', () => {
  const defaultProps = {
    leagueId: 'league-123',
    onNavigate: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the page heading and description', () => {
    render(<FeedbackHub {...defaultProps} />)

    expect(screen.getByText('Feedback Hub')).toBeInTheDocument()
    expect(
      screen.getByText('Novita, segnalazioni e suggerimenti')
    ).toBeInTheDocument()
  })

  it('renders the Alpha Test badge', () => {
    render(<FeedbackHub {...defaultProps} />)

    expect(screen.getByText('Alpha Test')).toBeInTheDocument()
    expect(
      screen.getByText('Aiutaci a migliorare segnalando problemi!')
    ).toBeInTheDocument()
  })

  it('renders tab buttons', () => {
    render(<FeedbackHub {...defaultProps} />)

    expect(screen.getByText('Novita')).toBeInTheDocument()
    expect(screen.getByText('Le mie Segnalazioni')).toBeInTheDocument()
  })

  it('shows patch notes in the news tab by default', () => {
    render(<FeedbackHub {...defaultProps} />)

    // Known patch note titles from the hardcoded list
    expect(screen.getByText('Sistema di backup automatico pre-deploy')).toBeInTheDocument()
    expect(screen.getByText('Statistiche giocatori accurate')).toBeInTheDocument()
  })

  it('switches to feedback list when "Le mie Segnalazioni" tab is clicked', async () => {
    const user = userEvent.setup()
    render(<FeedbackHub {...defaultProps} />)

    await user.click(screen.getByText('Le mie Segnalazioni'))

    await waitFor(() => {
      expect(screen.getByTestId('feedback-list')).toBeInTheDocument()
    })

    // Patch notes should no longer be visible
    expect(
      screen.queryByText('Sistema di backup automatico pre-deploy')
    ).not.toBeInTheDocument()
  })

  it('opens the feedback form modal when "Nuova Segnalazione" is clicked', async () => {
    const user = userEvent.setup()
    render(<FeedbackHub {...defaultProps} />)

    // The button has two labels: "Nuova Segnalazione" (desktop) and "Segnala" (mobile)
    await user.click(screen.getByText('Nuova Segnalazione'))

    await waitFor(() => {
      expect(screen.getByTestId('feedback-form')).toBeInTheDocument()
    })
    expect(screen.getByText('Nuova Segnalazione', { selector: 'h2' })).toBeInTheDocument()
  })

  it('does not show "Tutte le Segnalazioni" tab for non-superadmin users', () => {
    render(<FeedbackHub {...defaultProps} />)

    expect(screen.queryByText('Tutte le Segnalazioni')).not.toBeInTheDocument()
  })

  it('renders the footer text', () => {
    render(<FeedbackHub {...defaultProps} />)

    expect(
      screen.getByText("Grazie per il tuo contributo nel migliorare l'app!")
    ).toBeInTheDocument()
  })
})
