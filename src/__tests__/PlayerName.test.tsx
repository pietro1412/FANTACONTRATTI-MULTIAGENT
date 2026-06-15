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
})
