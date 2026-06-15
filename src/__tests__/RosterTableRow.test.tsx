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
      computedStats: null,
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

  it('should show the age in years when present (Axiom 6)', () => {
    render(<RosterTableRow entry={makeEntry({ age: 24 })} onPlayerClick={() => {}} />)
    expect(screen.getByText(/24 anni/)).toBeInTheDocument()
  })

  it('should fall back to N.D. when the age is missing (Axiom 6)', () => {
    render(<RosterTableRow entry={makeEntry({ age: null })} onPlayerClick={() => {}} />)
    expect(screen.getByText(/N\.D\./)).toBeInTheDocument()
  })

  it('should render missing season stats as ND, not 0 or - (Axiom 6)', () => {
    render(<RosterTableRow entry={makeEntry({ computedStats: null })} onPlayerClick={() => {}} />)
    // PR / G / A / VT all fall back to ND when stats are absent
    expect(screen.getAllByText('ND').length).toBeGreaterThanOrEqual(4)
  })
})
