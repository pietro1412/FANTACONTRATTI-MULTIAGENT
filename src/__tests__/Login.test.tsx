import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Login } from '../pages/Login'

// Mock useAuth hook
const mockLogin = vi.fn()

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    login: mockLogin,
    user: null,
    isAuthenticated: false,
    isLoading: false,
    logout: vi.fn(),
    register: vi.fn(),
  }),
}))

describe('Login Page', () => {
  const mockOnNavigate = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders without crashing', () => {
    render(<Login onNavigate={mockOnNavigate} />)

    expect(screen.getByText('Fantacontratti')).toBeInTheDocument()
    expect(screen.getByText('Accedi al tuo account')).toBeInTheDocument()
  })

  it('shows expected UI elements', () => {
    render(<Login onNavigate={mockOnNavigate} />)

    // Heading
    expect(screen.getByText('Accedi al tuo account')).toBeInTheDocument()

    // Inputs
    expect(screen.getByPlaceholderText('mario@email.com')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument()

    // Button
    expect(screen.getByRole('button', { name: 'Accedi' })).toBeInTheDocument()

    // Navigation links
    expect(screen.getByText('Password dimenticata?')).toBeInTheDocument()
    expect(screen.getByText('Registrati ora')).toBeInTheDocument()
    expect(screen.getByText('Leggi le regole del gioco')).toBeInTheDocument()
  })

  it('validates empty emailOrUsername on blur', async () => {
    const user = userEvent.setup()
    render(<Login onNavigate={mockOnNavigate} />)

    const emailInput = screen.getByPlaceholderText('mario@email.com')

    // Focus then blur with empty value
    await user.click(emailInput)
    await user.tab()

    await waitFor(() => {
      expect(screen.getByText('Inserisci email o username')).toBeInTheDocument()
    })
  })

  it('validates empty password on blur', async () => {
    const user = userEvent.setup()
    render(<Login onNavigate={mockOnNavigate} />)

    const passwordInput = screen.getByPlaceholderText('••••••••')

    await user.click(passwordInput)
    await user.tab()

    await waitFor(() => {
      expect(screen.getByText('Inserisci la password')).toBeInTheDocument()
    })
  })

  it('calls login with correct data on submit', async () => {
    mockLogin.mockResolvedValueOnce({ success: true })
    const user = userEvent.setup()
    render(<Login onNavigate={mockOnNavigate} />)

    await user.type(screen.getByPlaceholderText('mario@email.com'), 'test@test.com')
    await user.type(screen.getByPlaceholderText('••••••••'), 'Password123!')
    await user.click(screen.getByRole('button', { name: 'Accedi' }))

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test@test.com', 'Password123!')
    })
  })

  it('navigates to dashboard on successful login', async () => {
    mockLogin.mockResolvedValueOnce({ success: true })
    const user = userEvent.setup()
    render(<Login onNavigate={mockOnNavigate} />)

    await user.type(screen.getByPlaceholderText('mario@email.com'), 'test@test.com')
    await user.type(screen.getByPlaceholderText('••••••••'), 'Password123!')
    await user.click(screen.getByRole('button', { name: 'Accedi' }))

    await waitFor(() => {
      expect(mockOnNavigate).toHaveBeenCalledWith('dashboard')
    })
  })

  it('shows generic error on failed login without field errors', async () => {
    mockLogin.mockResolvedValueOnce({
      success: false,
      message: 'Credenziali non valide',
    })
    const user = userEvent.setup()
    render(<Login onNavigate={mockOnNavigate} />)

    await user.type(screen.getByPlaceholderText('mario@email.com'), 'wrong@test.com')
    await user.type(screen.getByPlaceholderText('••••••••'), 'wrongpass')
    await user.click(screen.getByRole('button', { name: 'Accedi' }))

    await waitFor(() => {
      expect(screen.getByText('Credenziali non valide')).toBeInTheDocument()
    })
  })

  it('shows field-specific validation errors from API', async () => {
    mockLogin.mockResolvedValueOnce({
      success: false,
      errors: [
        { message: 'Email non trovata', path: ['emailOrUsername'] },
      ],
    })
    const user = userEvent.setup()
    render(<Login onNavigate={mockOnNavigate} />)

    await user.type(screen.getByPlaceholderText('mario@email.com'), 'notfound@test.com')
    await user.type(screen.getByPlaceholderText('••••••••'), 'somepass')
    await user.click(screen.getByRole('button', { name: 'Accedi' }))

    await waitFor(() => {
      expect(screen.getByText('Email non trovata')).toBeInTheDocument()
    })
  })

  it('shows default error message when login fails without message', async () => {
    mockLogin.mockResolvedValueOnce({ success: false })
    const user = userEvent.setup()
    render(<Login onNavigate={mockOnNavigate} />)

    await user.type(screen.getByPlaceholderText('mario@email.com'), 'test@test.com')
    await user.type(screen.getByPlaceholderText('••••••••'), 'somepass')
    await user.click(screen.getByRole('button', { name: 'Accedi' }))

    await waitFor(() => {
      expect(screen.getByText('Errore durante il login')).toBeInTheDocument()
    })
  })

  it('navigates to forgot-password page when link is clicked', async () => {
    const user = userEvent.setup()
    render(<Login onNavigate={mockOnNavigate} />)

    await user.click(screen.getByText('Password dimenticata?'))

    expect(mockOnNavigate).toHaveBeenCalledWith('forgot-password')
  })

  it('navigates to register page when link is clicked', async () => {
    const user = userEvent.setup()
    render(<Login onNavigate={mockOnNavigate} />)

    await user.click(screen.getByText('Registrati ora'))

    expect(mockOnNavigate).toHaveBeenCalledWith('register')
  })

  it('navigates to rules page when link is clicked', async () => {
    const user = userEvent.setup()
    render(<Login onNavigate={mockOnNavigate} />)

    await user.click(screen.getByText('Leggi le regole del gioco'))

    expect(mockOnNavigate).toHaveBeenCalledWith('rules')
  })

  it('clears field error when user starts typing again', async () => {
    const user = userEvent.setup()
    render(<Login onNavigate={mockOnNavigate} />)

    // Trigger validation error
    const emailInput = screen.getByPlaceholderText('mario@email.com')
    await user.click(emailInput)
    await user.tab()

    await waitFor(() => {
      expect(screen.getByText('Inserisci email o username')).toBeInTheDocument()
    })

    // Type to clear the error
    await user.type(emailInput, 'a')

    await waitFor(() => {
      expect(screen.queryByText('Inserisci email o username')).not.toBeInTheDocument()
    })
  })
})
