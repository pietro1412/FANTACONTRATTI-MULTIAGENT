import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ForgotPassword } from '../pages/ForgotPassword'

// Mock react-router-dom (ForgotPassword uses Link)
vi.mock('react-router-dom', () => ({
  Link: ({ children, to, ...props }: { children: React.ReactNode; to: string; className?: string }) => (
    <a href={to} {...props}>{children}</a>
  ),
}))

// Mock Turnstile (external widget)
vi.mock('../components/ui/Turnstile', () => ({
  Turnstile: ({ onVerify }: { onVerify: (token: string) => void }) => {
    const { useEffect } = require('react')
    useEffect(() => { onVerify('mock-turnstile-token') }, [onVerify])
    return null
  },
}))

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock import.meta.env
vi.stubEnv('VITE_API_URL', 'http://localhost:3003')

describe('ForgotPassword Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders without crashing', () => {
    render(<ForgotPassword />)

    expect(screen.getByText('Password dimenticata?')).toBeInTheDocument()
    expect(screen.getByText('Inserisci la tua email e ti invieremo un link per reimpostare la password.')).toBeInTheDocument()
  })

  it('shows expected UI elements', () => {
    render(<ForgotPassword />)

    // Heading
    expect(screen.getByText('Password dimenticata?')).toBeInTheDocument()

    // Email input
    expect(screen.getByPlaceholderText('La tua email')).toBeInTheDocument()

    // Submit button
    expect(screen.getByRole('button', { name: 'Invia link di reset' })).toBeInTheDocument()

    // Back to login link
    expect(screen.getByText('Torna al login')).toBeInTheDocument()
  })

  it('validates empty email on blur', async () => {
    const user = userEvent.setup()
    render(<ForgotPassword />)

    const emailInput = screen.getByPlaceholderText('La tua email')

    await user.click(emailInput)
    await user.tab()

    await waitFor(() => {
      expect(screen.getByText('Inserisci la tua email')).toBeInTheDocument()
    })
  })

  it('validates invalid email format on blur', async () => {
    const user = userEvent.setup()
    render(<ForgotPassword />)

    const emailInput = screen.getByPlaceholderText('La tua email')

    await user.type(emailInput, 'invalid-email')
    await user.tab()

    await waitFor(() => {
      expect(screen.getByText('Formato email non valido')).toBeInTheDocument()
    })
  })

  it('submits form and shows success message', async () => {
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ success: true }),
    })

    const user = userEvent.setup()
    render(<ForgotPassword />)

    await user.type(screen.getByPlaceholderText('La tua email'), 'test@test.com')
    await user.click(screen.getByRole('button', { name: 'Invia link di reset' }))

    await waitFor(() => {
      expect(screen.getByText('Controlla la tua email')).toBeInTheDocument()
    })

    // Verify success state content
    expect(screen.getByText(/Se l'indirizzo email esiste nel nostro sistema/)).toBeInTheDocument()
    expect(screen.getByText('Torna al login')).toBeInTheDocument()
  })

  it('calls fetch with correct data on submit', async () => {
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ success: true }),
    })

    const user = userEvent.setup()
    render(<ForgotPassword />)

    await user.type(screen.getByPlaceholderText('La tua email'), 'test@test.com')
    await user.click(screen.getByRole('button', { name: 'Invia link di reset' }))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/forgot-password'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'test@test.com', turnstileToken: 'mock-turnstile-token' }),
        })
      )
    })
  })

  it('shows error message on API error', async () => {
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ success: false, error: 'Troppi tentativi' }),
    })

    const user = userEvent.setup()
    render(<ForgotPassword />)

    await user.type(screen.getByPlaceholderText('La tua email'), 'test@test.com')
    await user.click(screen.getByRole('button', { name: 'Invia link di reset' }))

    await waitFor(() => {
      expect(screen.getByText('Troppi tentativi')).toBeInTheDocument()
    })
  })

  it('shows default error when API fails without error message', async () => {
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ success: false }),
    })

    const user = userEvent.setup()
    render(<ForgotPassword />)

    await user.type(screen.getByPlaceholderText('La tua email'), 'test@test.com')
    await user.click(screen.getByRole('button', { name: 'Invia link di reset' }))

    await waitFor(() => {
      expect(screen.getByText('Errore durante la richiesta')).toBeInTheDocument()
    })
  })

  it('shows connection error on network failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    const user = userEvent.setup()
    render(<ForgotPassword />)

    await user.type(screen.getByPlaceholderText('La tua email'), 'test@test.com')
    await user.click(screen.getByRole('button', { name: 'Invia link di reset' }))

    await waitFor(() => {
      expect(screen.getByText('Errore di connessione al server')).toBeInTheDocument()
    })
  })

  it('submit button is disabled when email is empty', () => {
    render(<ForgotPassword />)

    const submitButton = screen.getByRole('button', { name: 'Invia link di reset' })
    expect(submitButton).toBeDisabled()
  })

  it('submit button is enabled when email is filled', async () => {
    const user = userEvent.setup()
    render(<ForgotPassword />)

    await user.type(screen.getByPlaceholderText('La tua email'), 'test@test.com')

    const submitButton = screen.getByRole('button', { name: 'Invia link di reset' })
    expect(submitButton).not.toBeDisabled()
  })

  it('has a link back to login page', () => {
    render(<ForgotPassword />)

    const link = screen.getByText('Torna al login')
    expect(link).toHaveAttribute('href', '/login')
  })
})
