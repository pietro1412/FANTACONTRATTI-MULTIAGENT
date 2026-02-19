import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock react-router-dom
const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}))

// Control isAuthenticated per test
let mockIsAuthenticated = true
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: mockIsAuthenticated ? { id: '1', email: 'test@test.com', username: 'Test' } : null,
    isAuthenticated: mockIsAuthenticated,
    isLoading: false,
  }),
}))

// Lazy import so the mock is applied first
import { Rules } from '../pages/Rules'

describe('Rules Page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsAuthenticated = true
  })

  it('renders without crashing', () => {
    render(<Rules />)

    expect(screen.getByText('Regole di Fantacontratti')).toBeInTheDocument()
  })

  it('renders the main section headings', () => {
    render(<Rules />)

    // These headings appear in section headers (and also TOC links), so use getAllByText
    const introHeadings = screen.getAllByText('Introduzione')
    expect(introHeadings.length).toBeGreaterThanOrEqual(1)

    const primoMercatoHeadings = screen.getAllByText('Primo Mercato Assoluto')
    expect(primoMercatoHeadings.length).toBeGreaterThanOrEqual(1)

    const mercatoRicorrenteHeadings = screen.getAllByText('Mercato Ricorrente')
    expect(mercatoRicorrenteHeadings.length).toBeGreaterThanOrEqual(1)

    const sistemaContrattiHeadings = screen.getAllByText('Sistema Contratti')
    expect(sistemaContrattiHeadings.length).toBeGreaterThanOrEqual(1)

    const glossarioHeadings = screen.getAllByText('Glossario')
    expect(glossarioHeadings.length).toBeGreaterThanOrEqual(1)

    const faqHeadings = screen.getAllByText('FAQ')
    expect(faqHeadings.length).toBeGreaterThanOrEqual(1)
  })

  it('renders the contract multiplier table', () => {
    render(<Rules />)

    // Verify the multiplier values are present
    expect(screen.getByText(/×11/)).toBeInTheDocument()
    expect(screen.getByText(/×9/)).toBeInTheDocument()
    expect(screen.getByText(/×7/)).toBeInTheDocument()
    expect(screen.getByText(/×4/)).toBeInTheDocument()
  })

  it('shows "Vai alla Dashboard" for authenticated users', () => {
    render(<Rules />)

    expect(screen.getByText('Vai alla Dashboard')).toBeInTheDocument()
    expect(
      screen.getByText('Torna alla dashboard per gestire le tue leghe.')
    ).toBeInTheDocument()
  })

  it('navigates to dashboard when back button is clicked for authenticated users', async () => {
    const user = userEvent.setup()
    render(<Rules />)

    const backButton = screen.getByLabelText('Torna indietro')
    await user.click(backButton)

    expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
  })

  it('shows login prompt and "Accedi" button when not authenticated', () => {
    mockIsAuthenticated = false

    render(<Rules />)

    expect(screen.getByText('Accedi')).toBeInTheDocument()
    expect(screen.getByText('Accedi o Registrati')).toBeInTheDocument()
  })
})
