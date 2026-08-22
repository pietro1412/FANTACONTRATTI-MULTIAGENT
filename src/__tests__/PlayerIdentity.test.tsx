import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PlayerIdentity } from '@/components/players/PlayerIdentity'
import type { PlayerInfo } from '@/components/PlayerStatsModal'

const player: PlayerInfo = {
  name: 'Mario Rossi',
  team: 'Napoli',
  position: 'A',
  age: 27,
}

describe('PlayerIdentity', () => {
  it('should render role, name, team and age in hierarchy order', () => {
    const { container } = render(
      <PlayerIdentity
        player={player}
        contract={{ salary: 12, duration: 3, clause: 84 }}
        stats={{ appearances: 30, goals: 10, assists: 5, avgRating: 6.8 }}
      />
    )
    const text = container.textContent || ''
    // Role badge label (Attaccante) appears before name, name before team, etc.
    const iRole = text.indexOf('A')
    const iName = text.indexOf('Mario Rossi')
    const iTeam = text.indexOf('Napoli')
    const iAge = text.indexOf('27 anni')
    const iSalary = text.indexOf('12M')
    expect(iRole).toBeGreaterThanOrEqual(0)
    expect(iName).toBeLessThan(iTeam)
    expect(iTeam).toBeLessThan(iAge)
    expect(iAge).toBeLessThan(iSalary)
  })

  it('should render the player name as a clickable button', () => {
    render(<PlayerIdentity player={player} />)
    expect(screen.getByRole('button', { name: 'Mario Rossi' })).toBeInTheDocument()
  })

  it('should show N.D. when age is missing', () => {
    const noAge: PlayerInfo = { name: 'Senza Eta', team: 'Roma', position: 'D' }
    render(<PlayerIdentity player={noAge} />)
    expect(screen.getByText('N.D.')).toBeInTheDocument()
  })

  it('should show ND for missing stats', () => {
    render(
      <PlayerIdentity
        player={player}
        stats={{ appearances: null, goals: null, assists: null, avgRating: null }}
      />
    )
    expect(screen.getAllByText('ND').length).toBeGreaterThan(0)
  })

  it('should hide the contract block when showContract is false', () => {
    render(
      <PlayerIdentity
        player={player}
        contract={{ salary: 12, duration: 3 }}
        showContract={false}
      />
    )
    expect(screen.queryByText('Ingaggio')).not.toBeInTheDocument()
  })

  it('should hide the age when showAge is false', () => {
    render(<PlayerIdentity player={player} showAge={false} />)
    expect(screen.queryByText('27 anni')).not.toBeInTheDocument()
  })

  it('should forward the contract to the stats modal opened via the name', async () => {
    const user = userEvent.setup()
    render(
      <PlayerIdentity
        player={player}
        contract={{ salary: 12, duration: 3, clause: 84, rubataPrice: 96 }}
      />
    )
    await user.click(screen.getByRole('button', { name: 'Mario Rossi' }))
    // The modal shows its own labelled "Contratto" block (Axioms 6 + 9),
    // not just the compact inline row rendered next to the name.
    expect(screen.getByText('Contratto')).toBeInTheDocument()
  })
})
