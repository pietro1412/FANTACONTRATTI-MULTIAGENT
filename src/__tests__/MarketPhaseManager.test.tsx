import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MarketPhaseManager } from '../components/MarketPhaseManager'

const noop = vi.fn()

describe('MarketPhaseManager — sorgente unica fase→etichetta (@/lib/phaseSteps)', () => {
  it('mostra la fase corrente e consente di avanzare in un caso coerente (MERCATO_RICORRENTE/CONTRATTI)', () => {
    render(
      <MarketPhaseManager
        session={{ id: 's1', type: 'MERCATO_RICORRENTE', status: 'ACTIVE', currentPhase: 'CONTRATTI' }}
        consolidationStatus={{ allConsolidated: true, members: [] }}
        isSubmitting={false}
        onSetPhase={noop}
        onCloseSession={noop}
        onCreateSession={noop}
        hasCompletedFirstMarket={true}
      />,
    )
    expect(screen.getByText('Rinnovo Contratti')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Avanza a Rubata/ })).toBeEnabled()
  })

  it('mostra uno stato d\'errore esplicito per una sessione con type/currentPhase incoerenti (bug reale: PRIMO_MERCATO + CONTRATTI)', () => {
    render(
      <MarketPhaseManager
        session={{ id: 's-anomala', type: 'PRIMO_MERCATO', status: 'ACTIVE', currentPhase: 'CONTRATTI' }}
        consolidationStatus={null}
        isSubmitting={false}
        onSetPhase={noop}
        onCloseSession={noop}
        onCreateSession={noop}
        hasCompletedFirstMarket={false}
      />,
    )
    expect(screen.getByText('Stato sessione non valido')).toBeInTheDocument()
    expect(screen.getByText(/s-anomala/)).toBeInTheDocument()
    // Nessun bottone di avanzamento fase silenziosamente disabilitato.
    expect(screen.queryByRole('button', { name: /Avanza a/ })).toBeNull()
  })

  it('PRIMO_MERCATO con ASTA_LIBERA (caso normale) resta gestibile', () => {
    render(
      <MarketPhaseManager
        session={{ id: 's2', type: 'PRIMO_MERCATO', status: 'ACTIVE', currentPhase: 'ASTA_LIBERA' }}
        consolidationStatus={null}
        isSubmitting={false}
        onSetPhase={noop}
        onCloseSession={noop}
        onCreateSession={noop}
        hasCompletedFirstMarket={false}
      />,
    )
    expect(screen.getByText('Primo Mercato')).toBeInTheDocument()
    expect(screen.getAllByText('Asta Primo Mercato').length).toBeGreaterThan(0)
  })
})
