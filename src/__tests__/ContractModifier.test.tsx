import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ContractModifier } from '../components/ContractModifier'

describe('ContractModifier — increaseOnly mode (post-rubata)', () => {
  const basePlayer = { id: 'p1', name: 'Mario Rossi', team: 'Juventus', position: 'C' }
  const baseContract = { salary: 5, duration: 2, initialSalary: 5, rescissionClause: 35 }
  const noop = vi.fn()
  const noopAsync = vi.fn().mockResolvedValue(undefined)

  it('should keep duration increase blocked (disabled) until salary is increased first', async () => {
    const user = userEvent.setup()

    render(
      <ContractModifier
        player={basePlayer}
        contract={baseContract}
        onConfirm={noopAsync}
        onSkip={noop}
        increaseOnly={true}
      />
    )

    // Duration "+" is disabled from the start — the invalid combination
    // (duration up, salary unchanged) is unreachable, not just flagged after a click
    const plusButtons = screen.getAllByRole('button', { name: 'Aumenta' })
    const durationPlus = plusButtons[1] as HTMLElement
    expect(durationPlus).toBeDisabled()

    // Clicking a disabled button is a no-op: nothing changed, single CTA still reads
    // "Mantieni contratto"
    await user.click(durationPlus)
    expect(screen.getByRole('button', { name: /Mantieni contratto/ })).toBeInTheDocument()
  })

  it('should unlock duration increase once salary is increased, and allow confirming', async () => {
    const user = userEvent.setup()

    render(
      <ContractModifier
        player={basePlayer}
        contract={baseContract}
        onConfirm={noopAsync}
        onSkip={noop}
        increaseOnly={true}
      />
    )

    const plusButtons = screen.getAllByRole('button', { name: 'Aumenta' })
    await user.click(plusButtons[0] as HTMLElement) // salary +1 -> unlocks duration

    const durationPlus = screen.getAllByRole('button', { name: 'Aumenta' })[1] as HTMLElement
    expect(durationPlus).not.toBeDisabled()
    await user.click(durationPlus)

    // Single CTA now reads "Conferma modifica" and is enabled — no separate banner needed
    const confirmButton = screen.getByRole('button', { name: /Conferma modifica/ })
    expect(confirmButton).not.toBeDisabled()
  })

  it('should show a single button that adapts: "Mantieni contratto" without changes, "Conferma modifica" with changes', async () => {
    const user = userEvent.setup()

    render(
      <ContractModifier
        player={basePlayer}
        contract={baseContract}
        onConfirm={noopAsync}
        onSkip={noop}
        increaseOnly={true}
      />
    )

    // No changes yet: only one button, "Mantieni contratto"
    expect(screen.getByRole('button', { name: /Mantieni contratto/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Conferma modifica/ })).not.toBeInTheDocument()

    // Increase salary: the same slot now reads "Conferma modifica"
    const salaryPlus = screen.getAllByRole('button', { name: 'Aumenta' })[0] as HTMLElement
    await user.click(salaryPlus)
    expect(screen.getByRole('button', { name: /Conferma modifica/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Mantieni contratto/ })).not.toBeInTheDocument()

    // Revert back to the original value: reverts to "Mantieni contratto"
    const salaryMinus = screen.getAllByRole('button', { name: 'Diminuisci' })[0] as HTMLElement
    await user.click(salaryMinus)
    expect(screen.getByRole('button', { name: /Mantieni contratto/ })).toBeInTheDocument()
  })

  it('should stay usable after a backend error: show message, re-enable the button, allow reverting to skip', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn().mockRejectedValue(new Error('Errore dal server'))
    const onSkip = vi.fn()

    render(
      <ContractModifier
        player={basePlayer}
        contract={baseContract}
        onConfirm={onConfirm}
        onSkip={onSkip}
        increaseOnly={true}
      />
    )

    // Make a valid modification (salary +1) so the button reads "Conferma modifica"
    const salaryPlus = screen.getAllByRole('button', { name: 'Aumenta' })[0] as HTMLElement
    await user.click(salaryPlus)

    const confirmButton = screen.getByRole('button', { name: /Conferma modifica/ })
    await user.click(confirmButton)

    // Error propagated and shown; button usable again
    expect(await screen.findByText('Errore dal server')).toBeInTheDocument()
    expect(confirmButton).not.toBeDisabled()

    // Revert the change: the same button now reads "Mantieni contratto" and calls onSkip
    const salaryMinus = screen.getAllByRole('button', { name: 'Diminuisci' })[0] as HTMLElement
    await user.click(salaryMinus)
    const skipButton = screen.getByRole('button', { name: /Mantieni contratto/ })
    expect(skipButton).not.toBeDisabled()
    await user.click(skipButton)
    expect(onSkip).toHaveBeenCalledTimes(1)
  })
})

describe('ContractModifier — svincolati mode', () => {
  const basePlayer = { id: 'p1', name: 'Mario Rossi', team: 'Juventus', position: 'C' }
  const baseContract = { salary: 5, duration: 3, initialSalary: 5, rescissionClause: 45 }
  const noop = vi.fn()

  it('should block salary and duration decrease directly (no decrease ever allowed)', () => {
    render(
      <ContractModifier
        player={basePlayer}
        contract={baseContract}
        onConfirm={vi.fn()}
        onSkip={noop}
        isSvincolatiMode={true}
      />
    )

    const minusButtons = screen.getAllByRole('button', { name: 'Diminuisci' })
    expect(minusButtons[0]).toBeDisabled() // salary can't go below current
    expect(minusButtons[1]).toBeDisabled() // duration can't go below 3 (== current here)
  })
})

describe('ContractModifier — normal renewal mode (Scambi)', () => {
  const basePlayer = { id: 'p1', name: 'Mario Rossi', team: 'Juventus', position: 'C' }
  const noop = vi.fn()

  it('should block salary/duration decrease directly when not spalma-eligible (duration > 1)', () => {
    const contract = { salary: 5, duration: 2, initialSalary: 5, rescissionClause: 35 }
    render(
      <ContractModifier
        player={basePlayer}
        contract={contract}
        onConfirm={vi.fn()}
        onSkip={noop}
      />
    )

    const minusButtons = screen.getAllByRole('button', { name: 'Diminuisci' })
    expect(minusButtons[0]).toBeDisabled() // salary can't go below current — no spalma available
    expect(minusButtons[1]).toBeDisabled() // duration can't go below current
  })

  it('should still allow decreasing salary/duration when spalma-eligible (duration === 1)', () => {
    const contract = { salary: 10, duration: 1, initialSalary: 10, rescissionClause: 30 }
    render(
      <ContractModifier
        player={basePlayer}
        contract={contract}
        onConfirm={vi.fn()}
        onSkip={noop}
      />
    )

    const minusButtons = screen.getAllByRole('button', { name: 'Diminuisci' })
    expect(minusButtons[0]).not.toBeDisabled() // spalma: salary can decrease
    expect(minusButtons[1]).toBeDisabled() // duration already at its floor (1)
  })
})
