import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RosterTableRow } from '@/components/players/RosterTableRow'
import type { RosterEntry } from '@/components/players/types'

function makeEntry(overrides: Partial<RosterEntry['player']> = {}): RosterEntry {
  return {
    id: 'r1',
    playerId: 'p1',
    acquisitionPrice: 50,
    acquisitionType: 'FIRST_MARKET',
    player: {
      id: 'p1',
      name: 'Mario Rossi',
      team: 'Inter',
      position: 'A',
      quotation: 30,
      age: 24,
      fantacalcioStats: null,
      ...overrides,
    },
    contract: {
      id: 'c1',
      salary: 12,
      duration: 3,
      rescissionClause: 84,
      signedAt: new Date().toISOString(),
    },
  }
}

describe('RosterTableRow', () => {
  it('should show ingaggio and durata with identifying labels (Axiom 9)', () => {
    render(<RosterTableRow entry={makeEntry()} onPlayerClick={() => {}} />)
    // compact ContractInline keeps an accessible extended label
    expect(screen.getByLabelText('Ingaggio 12M')).toBeInTheDocument()
    expect(screen.getByLabelText('Durata 3 s')).toBeInTheDocument()
  })

  it('should show the age in its own dedicated column when present (Axiom 6)', () => {
    render(<RosterTableRow entry={makeEntry({ age: 24 })} onPlayerClick={() => {}} />)
    expect(screen.getByLabelText('Età 24 anni')).toBeInTheDocument()
  })

  it('should fall back to N.D. in the age column when the age is missing (Axiom 6)', () => {
    render(<RosterTableRow entry={makeEntry({ age: null })} onPlayerClick={() => {}} />)
    expect(screen.getByLabelText('Età non disponibile')).toBeInTheDocument()
    expect(screen.getByText(/N\.D\./)).toBeInTheDocument()
  })

  it('should collapse season mini-stats into a muted note when all 4 are missing (Axiom 6)', () => {
    render(<RosterTableRow entry={makeEntry({ fantacalcioStats: null })} onPlayerClick={() => {}} />)
    // All 4 (PR/G/A/VT) missing collapses into a single note instead of 4 "ND" cells
    expect(screen.getByText('stats non sync.')).toBeInTheDocument()
    expect(screen.queryByText('ND')).not.toBeInTheDocument()
  })

  it('should show individual mini-stats, including ND for missing ones, when at least one is present (Axiom 6)', () => {
    render(
      <RosterTableRow
        entry={makeEntry({
          fantacalcioStats: {
            season: '2025-2026',
            presenze: 18,
            titolare: 15,
            subentrato: 3,
            avgMv: null,
            avgFm: null,
            golSegnati: 3,
            golSubiti: 0,
            autoreti: 0,
            rigoriSegnati: 0,
            rigoriSbagliati: 0,
            rigoriParati: 0,
            assist: 4,
            potm: 0,
          },
        })}
        onPlayerClick={() => {}}
      />
    )
    expect(screen.getByText('18')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('ND')).toBeInTheDocument()
  })
})
