import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PlayerName } from '@/components/players/PlayerName'
import type { PlayerInfo } from '@/components/PlayerStatsModal'

const player: PlayerInfo = {
  name: 'Mario Rossi',
  team: 'Napoli',
  position: 'A',
  age: 27,
}

describe('PlayerName', () => {
  it('should render the player name as a button', () => {
    render(<PlayerName player={player} />)
    expect(screen.getByRole('button', { name: 'Mario Rossi' })).toBeInTheDocument()
  })

  it('should not render the modal until clicked', () => {
    render(<PlayerName player={player} />)
    // Modal headings (e.g. tab "Panoramica") are absent before opening
    expect(screen.queryByText('Panoramica')).not.toBeInTheDocument()
  })

  it('should open the stats modal on click', async () => {
    const user = userEvent.setup()
    render(<PlayerName player={player} />)
    await user.click(screen.getByRole('button', { name: 'Mario Rossi' }))
    // The modal renders the tab bar with "Panoramica"
    expect(screen.getByText('Panoramica')).toBeInTheDocument()
  })

  it('should render with minimal player data (no league/career ids)', () => {
    const minimal: PlayerInfo = { name: 'Solo Nome', team: 'Inter', position: 'C' }
    render(<PlayerName player={minimal} />)
    expect(screen.getByRole('button', { name: 'Solo Nome' })).toBeInTheDocument()
  })

  // Axioms 6 + 9: ingaggio/durata/clausola/prezzo rubata always shown WITH
  // labels, prominently in the modal (not buried in "Carriera Lega").
  it('should show ingaggio/durata/clausola/rubata with explicit labels when a contract is provided', async () => {
    const user = userEvent.setup()
    const withContract: PlayerInfo = { ...player, contract: { salary: 12, duration: 3, clause: 84 } }
    render(<PlayerName player={withContract} />)
    await user.click(screen.getByRole('button', { name: 'Mario Rossi' }))

    expect(screen.getByText('Contratto')).toBeInTheDocument()
    expect(screen.getByText('Ingaggio')).toBeInTheDocument()
    expect(screen.getByText('12M')).toBeInTheDocument()
    expect(screen.getByText('Durata')).toBeInTheDocument()
    expect(screen.getByText('3 sem')).toBeInTheDocument()
    expect(screen.getByText('Clausola')).toBeInTheDocument()
    expect(screen.getByText('84M')).toBeInTheDocument()
    expect(screen.getByText('Rubata')).toBeInTheDocument()
    // Prezzo rubata = clausola + ingaggio
    expect(screen.getByText('96M')).toBeInTheDocument()
  })

  it('should hide the contract block gracefully when no contract is available', async () => {
    const user = userEvent.setup()
    render(<PlayerName player={player} />)
    await user.click(screen.getByRole('button', { name: 'Mario Rossi' }))

    expect(screen.getByText('Panoramica')).toBeInTheDocument()
    expect(screen.queryByText('Contratto')).not.toBeInTheDocument()
  })
})
