import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PhaseBar } from '../components/league/PhaseBar'

describe('PhaseBar (P2)', () => {
  it('non si mostra se non c\'è una fase navigabile', () => {
    const { container } = render(
      <PhaseBar leagueId="l1" currentPhase={null} onNavigate={vi.fn()} />,
    )
    expect(container.querySelector('[data-testid="phase-bar"]')).toBeNull()
  })

  it('mostra titolo, posizione "Fase 4 di 7" e CTA durante la Rubata', () => {
    render(<PhaseBar leagueId="l1" currentPhase="RUBATA" onNavigate={vi.fn()} />)
    expect(screen.getByTestId('phase-bar')).toBeInTheDocument()
    expect(screen.getByText('Asta Rubata')).toBeInTheDocument()
    expect(screen.getByText(/Fase 4 di 7/)).toBeInTheDocument()
    expect(screen.getByTestId('phase-bar-cta')).toHaveTextContent('Entra nella Rubata')
  })

  it('la CTA naviga alla sezione della fase corrente', async () => {
    const onNavigate = vi.fn()
    const user = userEvent.setup()
    render(<PhaseBar leagueId="l1" currentPhase="RUBATA" onNavigate={onNavigate} />)
    await user.click(screen.getByTestId('phase-bar-cta'))
    expect(onNavigate).toHaveBeenCalledWith('rubata', { leagueId: 'l1' })
  })

  it('uno step di fase passata è cliccabile e naviga; uno futuro è disabilitato', async () => {
    const onNavigate = vi.fn()
    const user = userEvent.setup()
    render(<PhaseBar leagueId="l1" currentPhase="RUBATA" onNavigate={onNavigate} />)

    // Scambi è una fase passata (done) rispetto a Rubata → naviga a 'trades'
    await user.click(screen.getByRole('button', { name: /Scambi/ }))
    expect(onNavigate).toHaveBeenCalledWith('trades', { leagueId: 'l1' })

    onNavigate.mockClear()
    // Svincolati è futura rispetto a Rubata → bottone disabilitato, nessuna navigazione
    const future = screen.getByRole('button', { name: /Svincolati/ })
    expect(future).toBeDisabled()
    await user.click(future).catch(() => {})
    expect(onNavigate).not.toHaveBeenCalled()
  })
})
