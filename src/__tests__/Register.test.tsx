import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Register } from '../pages/Register'

// Mock useAuth hook
const mockRegister = vi.fn()

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    register: mockRegister,
    user: null,
    isAuthenticated: false,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}))

// Mock react-router-dom (Register uses useSearchParams)
const mockSearchParams = new URLSearchParams()
vi.mock('react-router-dom', () => ({
  useSearchParams: () => [mockSearchParams],
}))

// Mock Turnstile (external widget, renders nothing in tests)
vi.mock('../components/ui/Turnstile', () => ({
  Turnstile: ({ onVerify }: { onVerify: (token: string) => void }) => {
    // Use useEffect to avoid setState during render warning
    const { useEffect } = require('react')
    useEffect(() => { onVerify('mock-turnstile-token') }, [onVerify])
    return null
  },
}))

describe('Register Page', () => {
  const mockOnNavigate = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset search params
    mockSearchParams.delete('invite')
  })

  it('renders without crashing', () => {
    render(<Register onNavigate={mockOnNavigate} />)

    expect(screen.getByText('Unisciti a Fantacontratti')).toBeInTheDocument()
    expect(screen.getByText('Crea il tuo account e inizia a competere')).toBeInTheDocument()
  })

  it('shows expected UI elements', () => {
    render(<Register onNavigate={mockOnNavigate} />)

    // Inputs
    expect(screen.getByPlaceholderText('mario@email.com')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('MisterRossi')).toBeInTheDocument()
    // Two password fields with same placeholder
    const passwordInputs = screen.getAllByPlaceholderText('••••••••')
    expect(passwordInputs).toHaveLength(2)

    // Submit button
    expect(screen.getByRole('button', { name: 'Crea Account' })).toBeInTheDocument()

    // Login link
    expect(screen.getByText('Accedi')).toBeInTheDocument()

    // Password requirements text
    expect(screen.getByText('La password deve contenere almeno 8 caratteri, una lettera maiuscola e un numero.')).toBeInTheDocument()
  })

  it('validates email on blur', async () => {
    const user = userEvent.setup()
    render(<Register onNavigate={mockOnNavigate} />)

    const emailInput = screen.getByPlaceholderText('mario@email.com')

    // Empty email
    await user.click(emailInput)
    await user.tab()

    await waitFor(() => {
      expect(screen.getByText('Inserisci la tua email')).toBeInTheDocument()
    })
  })

  it('validates invalid email format on blur', async () => {
    const user = userEvent.setup()
    render(<Register onNavigate={mockOnNavigate} />)

    const emailInput = screen.getByPlaceholderText('mario@email.com')

    await user.type(emailInput, 'invalid-email')
    await user.tab()

    await waitFor(() => {
      expect(screen.getByText('Formato email non valido')).toBeInTheDocument()
    })
  })

  it('validates empty username on blur', async () => {
    const user = userEvent.setup()
    render(<Register onNavigate={mockOnNavigate} />)

    const usernameInput = screen.getByPlaceholderText('MisterRossi')

    await user.click(usernameInput)
    await user.tab()

    await waitFor(() => {
      expect(screen.getByText('Inserisci un username')).toBeInTheDocument()
    })
  })

  it('validates short username on blur', async () => {
    const user = userEvent.setup()
    render(<Register onNavigate={mockOnNavigate} />)

    const usernameInput = screen.getByPlaceholderText('MisterRossi')

    await user.type(usernameInput, 'ab')
    await user.tab()

    await waitFor(() => {
      expect(screen.getByText('Minimo 3 caratteri')).toBeInTheDocument()
    })
  })

  it('validates empty password on blur', async () => {
    const user = userEvent.setup()
    render(<Register onNavigate={mockOnNavigate} />)

    const passwordInputs = screen.getAllByPlaceholderText('••••••••')

    await user.click(passwordInputs[0])
    await user.tab()

    await waitFor(() => {
      expect(screen.getByText('Inserisci una password')).toBeInTheDocument()
    })
  })

  it('validates short password on blur', async () => {
    const user = userEvent.setup()
    render(<Register onNavigate={mockOnNavigate} />)

    const passwordInputs = screen.getAllByPlaceholderText('••••••••')

    await user.type(passwordInputs[0], 'Short1')
    await user.tab()

    await waitFor(() => {
      expect(screen.getByText('Minimo 8 caratteri')).toBeInTheDocument()
    })
  })

  it('validates password missing uppercase on blur', async () => {
    const user = userEvent.setup()
    render(<Register onNavigate={mockOnNavigate} />)

    const passwordInputs = screen.getAllByPlaceholderText('••••••••')

    await user.type(passwordInputs[0], 'lowercase1')
    await user.tab()

    await waitFor(() => {
      expect(screen.getByText('Serve almeno una lettera maiuscola')).toBeInTheDocument()
    })
  })

  it('validates password missing number on blur', async () => {
    const user = userEvent.setup()
    render(<Register onNavigate={mockOnNavigate} />)

    const passwordInputs = screen.getAllByPlaceholderText('••••••••')

    await user.type(passwordInputs[0], 'NoNumber!')
    await user.tab()

    await waitFor(() => {
      expect(screen.getByText('Serve almeno un numero')).toBeInTheDocument()
    })
  })

  it('shows password mismatch error on submit', async () => {
    const user = userEvent.setup()
    render(<Register onNavigate={mockOnNavigate} />)

    await user.type(screen.getByPlaceholderText('mario@email.com'), 'test@test.com')
    await user.type(screen.getByPlaceholderText('MisterRossi'), 'TestUser')

    const passwordInputs = screen.getAllByPlaceholderText('••••••••')
    await user.type(passwordInputs[0], 'Password1!')
    await user.type(passwordInputs[1], 'DifferentPass1!')

    await user.click(screen.getByRole('button', { name: 'Crea Account' }))

    await waitFor(() => {
      expect(screen.getByText('Le password non corrispondono')).toBeInTheDocument()
    })

    // register should NOT have been called
    expect(mockRegister).not.toHaveBeenCalled()
  })

  it('calls register with correct data on successful submit', async () => {
    mockRegister.mockResolvedValueOnce({ success: true })
    const user = userEvent.setup()
    render(<Register onNavigate={mockOnNavigate} />)

    await user.type(screen.getByPlaceholderText('mario@email.com'), 'test@test.com')
    await user.type(screen.getByPlaceholderText('MisterRossi'), 'TestUser')

    const passwordInputs = screen.getAllByPlaceholderText('••••••••')
    await user.type(passwordInputs[0], 'Password1!')
    await user.type(passwordInputs[1], 'Password1!')

    await user.click(screen.getByRole('button', { name: 'Crea Account' }))

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith(
        'test@test.com',
        'TestUser',
        'Password1!',
        'Password1!',
        'mock-turnstile-token'
      )
    })
  })

  it('navigates to login on successful registration', async () => {
    mockRegister.mockResolvedValueOnce({ success: true })
    const user = userEvent.setup()
    render(<Register onNavigate={mockOnNavigate} />)

    await user.type(screen.getByPlaceholderText('mario@email.com'), 'test@test.com')
    await user.type(screen.getByPlaceholderText('MisterRossi'), 'TestUser')

    const passwordInputs = screen.getAllByPlaceholderText('••••••••')
    await user.type(passwordInputs[0], 'Password1!')
    await user.type(passwordInputs[1], 'Password1!')

    await user.click(screen.getByRole('button', { name: 'Crea Account' }))

    await waitFor(() => {
      expect(mockOnNavigate).toHaveBeenCalledWith('login')
    })
  })

  it('shows generic error on failed registration', async () => {
    mockRegister.mockResolvedValueOnce({
      success: false,
      message: 'Email gia in uso',
    })
    const user = userEvent.setup()
    render(<Register onNavigate={mockOnNavigate} />)

    await user.type(screen.getByPlaceholderText('mario@email.com'), 'existing@test.com')
    await user.type(screen.getByPlaceholderText('MisterRossi'), 'TestUser')

    const passwordInputs = screen.getAllByPlaceholderText('••••••••')
    await user.type(passwordInputs[0], 'Password1!')
    await user.type(passwordInputs[1], 'Password1!')

    await user.click(screen.getByRole('button', { name: 'Crea Account' }))

    await waitFor(() => {
      expect(screen.getByText('Email gia in uso')).toBeInTheDocument()
    })
  })

  it('shows field-specific validation errors from API', async () => {
    mockRegister.mockResolvedValueOnce({
      success: false,
      errors: [
        { message: 'Username gia esistente', path: ['username'] },
      ],
    })
    const user = userEvent.setup()
    render(<Register onNavigate={mockOnNavigate} />)

    await user.type(screen.getByPlaceholderText('mario@email.com'), 'test@test.com')
    await user.type(screen.getByPlaceholderText('MisterRossi'), 'TakenUser')

    const passwordInputs = screen.getAllByPlaceholderText('••••••••')
    await user.type(passwordInputs[0], 'Password1!')
    await user.type(passwordInputs[1], 'Password1!')

    await user.click(screen.getByRole('button', { name: 'Crea Account' }))

    await waitFor(() => {
      expect(screen.getByText('Username gia esistente')).toBeInTheDocument()
    })
  })

  it('navigates to login when "Accedi" link is clicked', async () => {
    const user = userEvent.setup()
    render(<Register onNavigate={mockOnNavigate} />)

    await user.click(screen.getByText('Accedi'))

    expect(mockOnNavigate).toHaveBeenCalledWith('login')
  })

  it('shows password strength indicator', async () => {
    const user = userEvent.setup()
    render(<Register onNavigate={mockOnNavigate} />)

    const passwordInputs = screen.getAllByPlaceholderText('••••••••')

    // Weak password (only length >= 8)
    await user.type(passwordInputs[0], 'abcdefgh')

    await waitFor(() => {
      expect(screen.getByText('Debole')).toBeInTheDocument()
    })
  })

  it('shows invite banner when invite token is present', () => {
    mockSearchParams.set('invite', 'some-invite-token')
    render(<Register onNavigate={mockOnNavigate} />)

    expect(screen.getByText('Sei stato invitato a una lega!')).toBeInTheDocument()
    expect(screen.getByText("Registrati per accettare l'invito")).toBeInTheDocument()
  })

  it('navigates to inviteDetail after registration with invite token', async () => {
    mockSearchParams.set('invite', 'invite-123')
    mockRegister.mockResolvedValueOnce({ success: true })
    const user = userEvent.setup()
    render(<Register onNavigate={mockOnNavigate} />)

    await user.type(screen.getByPlaceholderText('mario@email.com'), 'test@test.com')
    await user.type(screen.getByPlaceholderText('MisterRossi'), 'TestUser')

    const passwordInputs = screen.getAllByPlaceholderText('••••••••')
    await user.type(passwordInputs[0], 'Password1!')
    await user.type(passwordInputs[1], 'Password1!')

    await user.click(screen.getByRole('button', { name: 'Crea Account' }))

    await waitFor(() => {
      expect(mockOnNavigate).toHaveBeenCalledWith('inviteDetail', { token: 'invite-123' })
    })
  })
})
