import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ResetPassword } from '../pages/ResetPassword'

// Mock react-router-dom (ResetPassword reads the token from useSearchParams)
let mockSearchParams = new URLSearchParams('token=valid-reset-token')
vi.mock('react-router-dom', () => ({
  useSearchParams: () => [mockSearchParams],
}))

// Mock the centralized API client
const mockResetPassword = vi.fn()
vi.mock('../services/api', () => ({
  authApi: {
    resetPassword: (token: string, newPassword: string) => mockResetPassword(token, newPassword),
  },
}))

describe('ResetPassword Page', () => {
  const mockOnNavigate = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchParams = new URLSearchParams('token=valid-reset-token')
  })

  it('renders the form when a valid token is present', () => {
    render(<ResetPassword onNavigate={mockOnNavigate} />)

    expect(screen.getByRole('heading', { name: 'Nuova password' })).toBeInTheDocument()
    expect(screen.getByText('Scegli una password sicura per il tuo account.')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Almeno 8 caratteri')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Ripeti la password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reimposta password' })).toBeInTheDocument()
  })

  it('shows invalid link message when token is missing', () => {
    mockSearchParams = new URLSearchParams('')
    render(<ResetPassword onNavigate={mockOnNavigate} />)

    expect(screen.getByText('Link non valido')).toBeInTheDocument()
    expect(screen.getByText(/Il link di reset non è valido o è scaduto/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Richiedi nuovo link' })).toBeInTheDocument()
  })

  it('shows error when passwords do not match', async () => {
    const user = userEvent.setup()
    render(<ResetPassword onNavigate={mockOnNavigate} />)

    await user.type(screen.getByPlaceholderText('Almeno 8 caratteri'), 'Password1!')
    await user.type(screen.getByPlaceholderText('Ripeti la password'), 'DifferentPass1!')
    await user.click(screen.getByRole('button', { name: 'Reimposta password' }))

    await waitFor(() => {
      expect(screen.getByText('Le password non corrispondono')).toBeInTheDocument()
    })

    expect(mockResetPassword).not.toHaveBeenCalled()
  })

  it('shows error when password is too short', async () => {
    const user = userEvent.setup()
    render(<ResetPassword onNavigate={mockOnNavigate} />)

    await user.type(screen.getByPlaceholderText('Almeno 8 caratteri'), 'Short1')
    await user.type(screen.getByPlaceholderText('Ripeti la password'), 'Short1')
    await user.click(screen.getByRole('button', { name: 'Reimposta password' }))

    await waitFor(() => {
      expect(screen.getByText('Minimo 8 caratteri')).toBeInTheDocument()
    })

    expect(mockResetPassword).not.toHaveBeenCalled()
  })

  it('shows error when password is missing uppercase', async () => {
    const user = userEvent.setup()
    render(<ResetPassword onNavigate={mockOnNavigate} />)

    await user.type(screen.getByPlaceholderText('Almeno 8 caratteri'), 'lowercase1!')
    await user.type(screen.getByPlaceholderText('Ripeti la password'), 'lowercase1!')
    await user.click(screen.getByRole('button', { name: 'Reimposta password' }))

    await waitFor(() => {
      expect(screen.getByText('Serve almeno una lettera maiuscola')).toBeInTheDocument()
    })

    expect(mockResetPassword).not.toHaveBeenCalled()
  })

  it('shows error when password is missing a number', async () => {
    const user = userEvent.setup()
    render(<ResetPassword onNavigate={mockOnNavigate} />)

    await user.type(screen.getByPlaceholderText('Almeno 8 caratteri'), 'NoNumber!')
    await user.type(screen.getByPlaceholderText('Ripeti la password'), 'NoNumber!')
    await user.click(screen.getByRole('button', { name: 'Reimposta password' }))

    await waitFor(() => {
      expect(screen.getByText('Serve almeno un numero')).toBeInTheDocument()
    })

    expect(mockResetPassword).not.toHaveBeenCalled()
  })

  it('calls authApi.resetPassword with correct data on valid submit', async () => {
    mockResetPassword.mockResolvedValueOnce({ success: true })

    const user = userEvent.setup()
    render(<ResetPassword onNavigate={mockOnNavigate} />)

    await user.type(screen.getByPlaceholderText('Almeno 8 caratteri'), 'NewPassword1!')
    await user.type(screen.getByPlaceholderText('Ripeti la password'), 'NewPassword1!')
    await user.click(screen.getByRole('button', { name: 'Reimposta password' }))

    await waitFor(() => {
      expect(mockResetPassword).toHaveBeenCalledWith('valid-reset-token', 'NewPassword1!')
    })
  })

  it('shows success message after successful reset', async () => {
    mockResetPassword.mockResolvedValueOnce({ success: true })

    const user = userEvent.setup()
    render(<ResetPassword onNavigate={mockOnNavigate} />)

    await user.type(screen.getByPlaceholderText('Almeno 8 caratteri'), 'NewPassword1!')
    await user.type(screen.getByPlaceholderText('Ripeti la password'), 'NewPassword1!')
    await user.click(screen.getByRole('button', { name: 'Reimposta password' }))

    await waitFor(() => {
      expect(screen.getByText('Password aggiornata!')).toBeInTheDocument()
    })

    expect(screen.getByText(/La tua password è stata reimpostata con successo/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Vai al login' })).toBeInTheDocument()
  })

  it('shows API error on failed reset', async () => {
    mockResetPassword.mockResolvedValueOnce({ success: false, message: 'Token scaduto' })

    const user = userEvent.setup()
    render(<ResetPassword onNavigate={mockOnNavigate} />)

    await user.type(screen.getByPlaceholderText('Almeno 8 caratteri'), 'NewPassword1!')
    await user.type(screen.getByPlaceholderText('Ripeti la password'), 'NewPassword1!')
    await user.click(screen.getByRole('button', { name: 'Reimposta password' }))

    await waitFor(() => {
      expect(screen.getByText('Token scaduto')).toBeInTheDocument()
    })
  })

  it('submit button is disabled when fields are empty', () => {
    render(<ResetPassword onNavigate={mockOnNavigate} />)

    const submitButton = screen.getByRole('button', { name: 'Reimposta password' })
    expect(submitButton).toBeDisabled()
  })

  it('navigates back to login when the link is clicked', async () => {
    const user = userEvent.setup()
    render(<ResetPassword onNavigate={mockOnNavigate} />)

    await user.click(screen.getByText('Torna al login'))

    expect(mockOnNavigate).toHaveBeenCalledWith('login')
  })

  it('navigates to forgot-password when requesting a new token', async () => {
    mockSearchParams = new URLSearchParams('')
    const user = userEvent.setup()
    render(<ResetPassword onNavigate={mockOnNavigate} />)

    await user.click(screen.getByRole('button', { name: 'Richiedi nuovo link' }))

    expect(mockOnNavigate).toHaveBeenCalledWith('forgot-password')
  })
})
