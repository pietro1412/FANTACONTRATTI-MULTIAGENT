import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ResetPassword } from '../pages/ResetPassword'

// Mock react-router-dom
const mockNavigate = vi.fn()
let mockSearchParams = new URLSearchParams('token=valid-reset-token')

vi.mock('react-router-dom', () => ({
  useSearchParams: () => [mockSearchParams],
  useNavigate: () => mockNavigate,
  Link: ({ children, to, ...props }: { children: React.ReactNode; to: string; className?: string }) => (
    <a href={to} {...props}>{children}</a>
  ),
}))

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock import.meta.env
vi.stubEnv('VITE_API_URL', 'http://localhost:3003')

describe('ResetPassword Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchParams = new URLSearchParams('token=valid-reset-token')
  })

  it('renders the form when a valid token is present', () => {
    render(<ResetPassword />)

    expect(screen.getByRole('heading', { name: 'Reimposta password' })).toBeInTheDocument()
    expect(screen.getByText('Inserisci la tua nuova password.')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Almeno 8 caratteri')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Ripeti la password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reimposta password' })).toBeInTheDocument()
  })

  it('shows invalid link message when token is missing', () => {
    mockSearchParams = new URLSearchParams('')
    render(<ResetPassword />)

    expect(screen.getByText('Link non valido')).toBeInTheDocument()
    expect(screen.getByText(/Il link di reset non è valido o è scaduto/)).toBeInTheDocument()
    expect(screen.getByText('Richiedi nuovo link')).toBeInTheDocument()
  })

  it('shows error when passwords do not match', async () => {
    const user = userEvent.setup()
    render(<ResetPassword />)

    await user.type(screen.getByPlaceholderText('Almeno 8 caratteri'), 'Password1!')
    await user.type(screen.getByPlaceholderText('Ripeti la password'), 'DifferentPass1!')
    await user.click(screen.getByRole('button', { name: 'Reimposta password' }))

    await waitFor(() => {
      expect(screen.getByText('Le password non corrispondono')).toBeInTheDocument()
    })

    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('shows error when password is too short', async () => {
    const user = userEvent.setup()
    render(<ResetPassword />)

    await user.type(screen.getByPlaceholderText('Almeno 8 caratteri'), 'Short1')
    await user.type(screen.getByPlaceholderText('Ripeti la password'), 'Short1')
    await user.click(screen.getByRole('button', { name: 'Reimposta password' }))

    await waitFor(() => {
      expect(screen.getByText('La password deve essere di almeno 8 caratteri')).toBeInTheDocument()
    })

    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('shows error when password is missing uppercase', async () => {
    const user = userEvent.setup()
    render(<ResetPassword />)

    await user.type(screen.getByPlaceholderText('Almeno 8 caratteri'), 'lowercase1!')
    await user.type(screen.getByPlaceholderText('Ripeti la password'), 'lowercase1!')
    await user.click(screen.getByRole('button', { name: 'Reimposta password' }))

    await waitFor(() => {
      expect(screen.getByText('La password deve contenere almeno una lettera maiuscola')).toBeInTheDocument()
    })

    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('shows error when password is missing a number', async () => {
    const user = userEvent.setup()
    render(<ResetPassword />)

    await user.type(screen.getByPlaceholderText('Almeno 8 caratteri'), 'NoNumber!')
    await user.type(screen.getByPlaceholderText('Ripeti la password'), 'NoNumber!')
    await user.click(screen.getByRole('button', { name: 'Reimposta password' }))

    await waitFor(() => {
      expect(screen.getByText('La password deve contenere almeno un numero')).toBeInTheDocument()
    })

    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('calls fetch with correct data on valid submit', async () => {
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ success: true }),
    })

    const user = userEvent.setup()
    render(<ResetPassword />)

    await user.type(screen.getByPlaceholderText('Almeno 8 caratteri'), 'NewPassword1!')
    await user.type(screen.getByPlaceholderText('Ripeti la password'), 'NewPassword1!')
    await user.click(screen.getByRole('button', { name: 'Reimposta password' }))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/reset-password'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: 'valid-reset-token', newPassword: 'NewPassword1!' }),
        })
      )
    })
  })

  it('shows success message after successful reset', async () => {
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ success: true }),
    })

    const user = userEvent.setup()
    render(<ResetPassword />)

    await user.type(screen.getByPlaceholderText('Almeno 8 caratteri'), 'NewPassword1!')
    await user.type(screen.getByPlaceholderText('Ripeti la password'), 'NewPassword1!')
    await user.click(screen.getByRole('button', { name: 'Reimposta password' }))

    await waitFor(() => {
      expect(screen.getByText('Password aggiornata!')).toBeInTheDocument()
    })

    expect(screen.getByText(/La tua password è stata reimpostata con successo/)).toBeInTheDocument()
    expect(screen.getByText('Vai al login')).toBeInTheDocument()
  })

  it('shows API error on failed reset', async () => {
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ success: false, error: 'Token scaduto' }),
    })

    const user = userEvent.setup()
    render(<ResetPassword />)

    await user.type(screen.getByPlaceholderText('Almeno 8 caratteri'), 'NewPassword1!')
    await user.type(screen.getByPlaceholderText('Ripeti la password'), 'NewPassword1!')
    await user.click(screen.getByRole('button', { name: 'Reimposta password' }))

    await waitFor(() => {
      expect(screen.getByText('Token scaduto')).toBeInTheDocument()
    })
  })

  it('shows connection error on network failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    const user = userEvent.setup()
    render(<ResetPassword />)

    await user.type(screen.getByPlaceholderText('Almeno 8 caratteri'), 'NewPassword1!')
    await user.type(screen.getByPlaceholderText('Ripeti la password'), 'NewPassword1!')
    await user.click(screen.getByRole('button', { name: 'Reimposta password' }))

    await waitFor(() => {
      expect(screen.getByText('Errore di connessione al server')).toBeInTheDocument()
    })
  })

  it('submit button is disabled when fields are empty', () => {
    render(<ResetPassword />)

    const submitButton = screen.getByRole('button', { name: 'Reimposta password' })
    expect(submitButton).toBeDisabled()
  })

  it('has a back to login link', () => {
    render(<ResetPassword />)

    const link = screen.getByText('Torna al login')
    expect(link).toHaveAttribute('href', '/login')
  })

  it('has a link to request new token when token is missing', () => {
    mockSearchParams = new URLSearchParams('')
    render(<ResetPassword />)

    const link = screen.getByText('Richiedi nuovo link')
    expect(link).toHaveAttribute('href', '/forgot-password')
  })
})
