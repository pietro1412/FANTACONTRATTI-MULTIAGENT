import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ForgotPassword } from '../pages/ForgotPassword'

// Mock the centralized API client
const mockForgotPassword = vi.fn()
vi.mock('../services/api', () => ({
  authApi: {
    forgotPassword: (email: string, turnstileToken?: string) =>
      mockForgotPassword(email, turnstileToken),
  },
}))

// Mock Turnstile (external widget)
vi.mock('../components/ui/Turnstile', () => ({
  Turnstile: ({ onVerify }: { onVerify: (token: string) => void }) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useEffect } = require('react')
    useEffect(() => { onVerify('mock-turnstile-token') }, [onVerify])
    return null
  },
}))

describe('ForgotPassword Page', () => {
  const mockOnNavigate = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders without crashing', () => {
    render(<ForgotPassword onNavigate={mockOnNavigate} />)

    expect(screen.getByText('Password dimenticata?')).toBeInTheDocument()
    expect(screen.getByText('Inserisci la tua email e ti invieremo un link per reimpostare la password.')).toBeInTheDocument()
  })

  it('shows expected UI elements', () => {
    render(<ForgotPassword onNavigate={mockOnNavigate} />)

    expect(screen.getByText('Password dimenticata?')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('La tua email')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Invia link di reset' })).toBeInTheDocument()
    expect(screen.getByText('Torna al login')).toBeInTheDocument()
  })

  it('validates empty email on blur', async () => {
    const user = userEvent.setup()
    render(<ForgotPassword onNavigate={mockOnNavigate} />)

    const emailInput = screen.getByPlaceholderText('La tua email')
    await user.click(emailInput)
    await user.tab()

    await waitFor(() => {
      expect(screen.getByText('Inserisci la tua email')).toBeInTheDocument()
    })
  })

  it('validates invalid email format on blur', async () => {
    const user = userEvent.setup()
    render(<ForgotPassword onNavigate={mockOnNavigate} />)

    const emailInput = screen.getByPlaceholderText('La tua email')
    await user.type(emailInput, 'invalid-email')
    await user.tab()

    await waitFor(() => {
      expect(screen.getByText('Formato email non valido')).toBeInTheDocument()
    })
  })

  it('submits form and shows success message', async () => {
    mockForgotPassword.mockResolvedValueOnce({ success: true })

    const user = userEvent.setup()
    render(<ForgotPassword onNavigate={mockOnNavigate} />)

    await user.type(screen.getByPlaceholderText('La tua email'), 'test@test.com')
    await user.click(screen.getByRole('button', { name: 'Invia link di reset' }))

    await waitFor(() => {
      expect(screen.getByText('Controlla la tua email')).toBeInTheDocument()
    })

    expect(screen.getByText(/Se l'indirizzo email esiste nel nostro sistema/)).toBeInTheDocument()
    expect(screen.getByText('← Torna al login')).toBeInTheDocument()
  })

  it('calls authApi.forgotPassword with correct data on submit', async () => {
    mockForgotPassword.mockResolvedValueOnce({ success: true })

    const user = userEvent.setup()
    render(<ForgotPassword onNavigate={mockOnNavigate} />)

    await user.type(screen.getByPlaceholderText('La tua email'), 'test@test.com')
    await user.click(screen.getByRole('button', { name: 'Invia link di reset' }))

    await waitFor(() => {
      expect(mockForgotPassword).toHaveBeenCalledWith('test@test.com', 'mock-turnstile-token')
    })
  })

  it('shows error message on API error', async () => {
    mockForgotPassword.mockResolvedValueOnce({ success: false, message: 'Troppi tentativi' })

    const user = userEvent.setup()
    render(<ForgotPassword onNavigate={mockOnNavigate} />)

    await user.type(screen.getByPlaceholderText('La tua email'), 'test@test.com')
    await user.click(screen.getByRole('button', { name: 'Invia link di reset' }))

    await waitFor(() => {
      expect(screen.getByText('Troppi tentativi')).toBeInTheDocument()
    })
  })

  it('shows default error when API fails without message', async () => {
    mockForgotPassword.mockResolvedValueOnce({ success: false })

    const user = userEvent.setup()
    render(<ForgotPassword onNavigate={mockOnNavigate} />)

    await user.type(screen.getByPlaceholderText('La tua email'), 'test@test.com')
    await user.click(screen.getByRole('button', { name: 'Invia link di reset' }))

    await waitFor(() => {
      expect(screen.getByText('Errore durante la richiesta')).toBeInTheDocument()
    })
  })

  it('submit button is disabled when email is empty', () => {
    render(<ForgotPassword onNavigate={mockOnNavigate} />)

    const submitButton = screen.getByRole('button', { name: 'Invia link di reset' })
    expect(submitButton).toBeDisabled()
  })

  it('submit button is enabled when email is filled', async () => {
    const user = userEvent.setup()
    render(<ForgotPassword onNavigate={mockOnNavigate} />)

    await user.type(screen.getByPlaceholderText('La tua email'), 'test@test.com')

    const submitButton = screen.getByRole('button', { name: 'Invia link di reset' })
    expect(submitButton).not.toBeDisabled()
  })

  it('navigates back to login when the link is clicked', async () => {
    const user = userEvent.setup()
    render(<ForgotPassword onNavigate={mockOnNavigate} />)

    await user.click(screen.getByText('Torna al login'))

    expect(mockOnNavigate).toHaveBeenCalledWith('login')
  })
})
