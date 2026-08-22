import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AdminBanner } from '../components/league-detail/AdminBanner'

describe('AdminBanner — sorgente unica fase→etichetta (@/lib/phaseSteps)', () => {
  it('mostra il titolo della fase corrente in un caso coerente (MERCATO_RICORRENTE/RUBATA)', () => {
    render(
      <AdminBanner
        leagueStatus="ACTIVE"
        isAdmin={false}
        activeSession={{ id: 's1', type: 'MERCATO_RICORRENTE', status: 'ACTIVE', currentPhase: 'RUBATA', phaseStartedAt: null }}
        isFirstMarketCompleted={true}
        leagueId="l1"
        onNavigate={vi.fn()}
        onOpenAuctionClick={vi.fn()}
      />,
    )
    expect(screen.getByText('Rubata')).toBeInTheDocument()
  })

  it('mostra uno stato d\'errore esplicito per una sessione con type/currentPhase incoerenti (bug reale: PRIMO_MERCATO + CONTRATTI)', () => {
    render(
      <AdminBanner
        leagueStatus="ACTIVE"
        isAdmin={true}
        activeSession={{ id: 's-anomala', type: 'PRIMO_MERCATO', status: 'ACTIVE', currentPhase: 'CONTRATTI', phaseStartedAt: null }}
        isFirstMarketCompleted={false}
        leagueId="l1"
        onNavigate={vi.fn()}
        onOpenAuctionClick={vi.fn()}
      />,
    )
    expect(screen.getByText('Stato sessione non valido')).toBeInTheDocument()
    expect(screen.getByText(/PRIMO_MERCATO/)).toBeInTheDocument()
    expect(screen.getByText(/CONTRATTI/)).toBeInTheDocument()
  })

  it('per un non-admin lo stato non valido non mostra dettagli tecnici', () => {
    render(
      <AdminBanner
        leagueStatus="ACTIVE"
        isAdmin={false}
        activeSession={{ id: 's-anomala', type: 'PRIMO_MERCATO', status: 'ACTIVE', currentPhase: 'CONTRATTI', phaseStartedAt: null }}
        isFirstMarketCompleted={false}
        leagueId="l1"
        onNavigate={vi.fn()}
        onOpenAuctionClick={vi.fn()}
      />,
    )
    expect(screen.getByText('Stato sessione non valido')).toBeInTheDocument()
    expect(screen.queryByText(/currentPhase:/)).toBeNull()
  })

  it('PRIMO_MERCATO con ASTA_LIBERA (caso normale) resta invariato', () => {
    render(
      <AdminBanner
        leagueStatus="ACTIVE"
        isAdmin={false}
        activeSession={{ id: 's2', type: 'PRIMO_MERCATO', status: 'ACTIVE', currentPhase: 'ASTA_LIBERA', phaseStartedAt: null }}
        isFirstMarketCompleted={false}
        leagueId="l1"
        onNavigate={vi.fn()}
        onOpenAuctionClick={vi.fn()}
      />,
    )
    expect(screen.getByText('Asta Primo Mercato')).toBeInTheDocument()
  })
})
