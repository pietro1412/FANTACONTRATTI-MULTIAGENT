import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ContractModifier } from '../components/ContractModifier'

describe('ContractModifier — increaseOnly mode (post-rubata)', () => {
  const basePlayer = { id: 'p1', name: 'Mario Rossi', team: 'Juventus', position: 'C' }
  const baseContract = { salary: 5, duration: 2, initialSalary: 5, rescissionClause: 35 }
  const noop = vi.fn()
  const noopAsync = vi.fn().mockResolvedValue(undefined)

  it('should reject duration increase without salary increase in increaseOnly mode', async () => {
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

    // Increase duration from 2 to 3 without touching salary
    const durationPlusButtons = screen.getAllByText('+')
    // The second '+' button is the duration one (first is salary)
    await user.click(durationPlusButtons[1])

    // Should show "Modifica non valida" — NOT "Anteprima nuovo contratto"
    expect(screen.getByText('Modifica non valida')).toBeInTheDocument()
    expect(screen.getByText(/Per aumentare la durata devi anche aumentare l'ingaggio/)).toBeInTheDocument()
  })

  it('should allow duration increase when salary also increases in increaseOnly mode', async () => {
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

    // First increase salary
    const plusButtons = screen.getAllByText('+')
    await user.click(plusButtons[0]) // salary +1

    // Then increase duration
    await user.click(plusButtons[1]) // duration +1

    // Should show valid preview
    expect(screen.getByText('Anteprima nuovo contratto')).toBeInTheDocument()
  })
})
