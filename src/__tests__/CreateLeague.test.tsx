import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CreateLeague } from '../pages/CreateLeague'

// Mock useAuth hook
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: '1', email: 'test@test.com', username: 'TestUser' },
    isAuthenticated: true,
    isLoading: false,
    logout: vi.fn(),
  }),
}))

// Mock Toast provider
vi.mock('../components/ui/Toast', () => ({
  useToast: () => ({
    toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
  }),
}))

// Mock Navigation
vi.mock('../components/Navigation', () => ({
  Navigation: ({ currentPage }: { currentPage: string }) => (
    <nav data-testid="navigation" data-page={currentPage}>Navigation</nav>
  ),
}))

// Mock Button — pass through all standard button props
vi.mock('../components/ui/Button', () => ({
  Button: ({ children, onClick, type, disabled, isLoading, ...rest }: React.ComponentProps<'button'> & { isLoading?: boolean }) => (
    <button onClick={onClick} type={type} disabled={disabled || isLoading} data-loading={isLoading} {...rest}>
      {isLoading ? 'Loading...' : children}
    </button>
  ),
}))

// Mock Input
vi.mock('../components/ui/Input', () => ({
  Input: ({ label, value, onChange, error, ...rest }: { label?: string; value: string; onChange: React.ChangeEventHandler<HTMLInputElement>; error?: string; [key: string]: unknown }) => (
    <div>
      {label && <label>{label}</label>}
      <input value={value} onChange={onChange} aria-label={label} {...rest} />
      {error && <span data-testid="field-error">{error}</span>}
    </div>
  ),
}))

// Mock NumberStepper
vi.mock('../components/ui/NumberStepper', () => ({
  NumberStepper: ({ label, value, onChange, min, max, step }: { label?: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; size?: string; error?: string }) => (
    <div data-testid={`stepper-${label || 'unnamed'}`}>
      {label && <span>{label}</span>}
      <span data-testid="stepper-value">{value}</span>
      <button data-testid="stepper-decrement" onClick={() => onChange(Math.max(min ?? 0, value - (step ?? 1)))}>-</button>
      <button data-testid="stepper-increment" onClick={() => onChange(Math.min(max ?? 999, value + (step ?? 1)))}>+</button>
    </div>
  ),
}))

// Mock API
const mockCreate = vi.fn()
const mockGetStatus = vi.fn()

vi.mock('../services/api', () => ({
  leagueApi: {
    create: (...args: unknown[]) => mockCreate(...args),
    getPendingRequests: vi.fn().mockResolvedValue({ success: true, data: [] }),
  },
  superadminApi: {
    getStatus: (...args: unknown[]) => mockGetStatus(...args),
  },
  tradeApi: {
    getReceived: vi.fn().mockResolvedValue({ success: true, data: [] }),
  },
  userApi: {
    getMyPendingInvites: vi.fn().mockResolvedValue({ success: true, data: [] }),
  },
}))

describe('CreateLeague', () => {
  const mockOnNavigate = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetStatus.mockResolvedValue({ success: true, data: { isSuperAdmin: false } })
  })

  it('shows loading spinner while checking superadmin status', () => {
    mockGetStatus.mockReturnValue(new Promise(() => {}))

    render(<CreateLeague onNavigate={mockOnNavigate} />)

    // Should show a spinner (the animate-spin element)
    const spinner = document.querySelector('.animate-spin')
    expect(spinner).toBeTruthy()
  })

  it('renders form after superadmin check completes', async () => {
    render(<CreateLeague onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Crea una Nuova Lega')).toBeInTheDocument()
    })

    expect(screen.getByText('Informazioni Lega')).toBeInTheDocument()
    expect(screen.getByText('Configurazione')).toBeInTheDocument()
    expect(screen.getByText('Slot Rosa')).toBeInTheDocument()
  })

  it('redirects superadmin to dashboard', async () => {
    mockGetStatus.mockResolvedValue({ success: true, data: { isSuperAdmin: true } })

    render(<CreateLeague onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(mockOnNavigate).toHaveBeenCalledWith('dashboard')
    })
  })

  it('shows success state with invite code after successful creation', async () => {
    const user = userEvent.setup()
    mockCreate.mockResolvedValue({ success: true, data: { inviteCode: 'ABC123' } })

    render(<CreateLeague onNavigate={mockOnNavigate} />)

    // Wait for form to render
    await waitFor(() => {
      expect(screen.getByText('Crea una Nuova Lega')).toBeInTheDocument()
    })

    // Fill required fields
    const nameInput = screen.getByLabelText('Nome Lega')
    const teamNameInput = screen.getByLabelText('Nome della tua Squadra')

    await user.type(nameInput, 'Lega Champions')
    await user.type(teamNameInput, 'FC Test')

    // Submit form
    const submitButton = screen.getByText('Crea Lega')
    await user.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('Lega Creata!')).toBeInTheDocument()
    })

    expect(screen.getByText('ABC123')).toBeInTheDocument()
    expect(screen.getByText('Condividi questo codice con i tuoi amici')).toBeInTheDocument()
  })

  it('shows error message on failed creation', async () => {
    const user = userEvent.setup()
    mockCreate.mockResolvedValue({ success: false, message: 'Nome lega gia in uso' })

    render(<CreateLeague onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Crea una Nuova Lega')).toBeInTheDocument()
    })

    const nameInput = screen.getByLabelText('Nome Lega')
    const teamNameInput = screen.getByLabelText('Nome della tua Squadra')

    await user.type(nameInput, 'Lega Champions')
    await user.type(teamNameInput, 'FC Test')

    const submitButton = screen.getByText('Crea Lega')
    await user.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('Nome lega gia in uso')).toBeInTheDocument()
    })
  })

  it('shows field-level validation errors from API', async () => {
    const user = userEvent.setup()
    mockCreate.mockResolvedValue({
      success: false,
      message: 'Validation failed',
      errors: [
        { path: ['name'], message: 'Nome troppo corto' },
      ],
    })

    render(<CreateLeague onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Crea una Nuova Lega')).toBeInTheDocument()
    })

    const nameInput = screen.getByLabelText('Nome Lega')
    const teamNameInput = screen.getByLabelText('Nome della tua Squadra')

    await user.type(nameInput, 'AB')
    await user.type(teamNameInput, 'FC')

    const submitButton = screen.getByText('Crea Lega')
    await user.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('Nome troppo corto')).toBeInTheDocument()
    })
  })

  it('navigates to dashboard when "Annulla" is clicked', async () => {
    const user = userEvent.setup()

    render(<CreateLeague onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Crea una Nuova Lega')).toBeInTheDocument()
    })

    const cancelButton = screen.getByText('Annulla')
    await user.click(cancelButton)

    expect(mockOnNavigate).toHaveBeenCalledWith('dashboard')
  })

  it('displays total slots count from default values', async () => {
    render(<CreateLeague onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Crea una Nuova Lega')).toBeInTheDocument()
    })

    // Default: P=3, D=8, C=8, A=6 = 25
    expect(screen.getByText('25')).toBeInTheDocument()
  })

  it('navigates to dashboard after success when "Vai alla Dashboard" is clicked', async () => {
    const user = userEvent.setup()
    mockCreate.mockResolvedValue({ success: true, data: { inviteCode: 'XYZ' } })

    render(<CreateLeague onNavigate={mockOnNavigate} />)

    await waitFor(() => {
      expect(screen.getByText('Crea una Nuova Lega')).toBeInTheDocument()
    })

    const nameInput = screen.getByLabelText('Nome Lega')
    const teamNameInput = screen.getByLabelText('Nome della tua Squadra')
    await user.type(nameInput, 'Lega OK')
    await user.type(teamNameInput, 'Team OK')

    await user.click(screen.getByText('Crea Lega'))

    await waitFor(() => {
      expect(screen.getByText('Lega Creata!')).toBeInTheDocument()
    })

    await user.click(screen.getByText('Vai alla Dashboard'))
    expect(mockOnNavigate).toHaveBeenCalledWith('dashboard')
  })
})
