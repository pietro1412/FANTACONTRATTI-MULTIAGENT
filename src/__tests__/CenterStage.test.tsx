import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { getAuctionPhase } from '../components/auction-room-v2/CenterStage'
import { MarketCompletePanel } from '../components/auction-room-v2/MarketCompletePanel'

describe('getAuctionPhase', () => {
  const base = {
    pendingAck: null,
    readyStatus: null,
    auction: null,
    isMyTurn: false,
    isPrimoMercato: true,
    marketProgress: null,
  }

  it('torna "marketComplete" quando il Primo Mercato ha riempito tutti gli slot di lega', () => {
    const phase = getAuctionPhase({
      ...base,
      marketProgress: { currentRole: 'A', currentRoleName: 'Attaccanti', filledSlots: 48, totalSlots: 48, roleSequence: ['P', 'D', 'C', 'A'], slotLimits: { P: 3, D: 8, C: 8, A: 6 } },
    })
    expect(phase).toBe('marketComplete')
  })

  it('resta "waiting" se manca ancora almeno uno slot', () => {
    const phase = getAuctionPhase({
      ...base,
      marketProgress: { currentRole: 'A', currentRoleName: 'Attaccanti', filledSlots: 47, totalSlots: 48, roleSequence: ['P', 'D', 'C', 'A'], slotLimits: { P: 3, D: 8, C: 8, A: 6 } },
    })
    expect(phase).toBe('waiting')
  })

  it('non torna "marketComplete" fuori dal Primo Mercato (mercato ricorrente)', () => {
    const phase = getAuctionPhase({
      ...base,
      isPrimoMercato: false,
      marketProgress: { currentRole: 'A', currentRoleName: 'Attaccanti', filledSlots: 48, totalSlots: 48, roleSequence: ['P', 'D', 'C', 'A'], slotLimits: { P: 3, D: 8, C: 8, A: 6 } },
    })
    expect(phase).toBe('waiting')
  })

  it('la conferma d\'acquisto pendente ha priorita\' su "marketComplete"', () => {
    const phase = getAuctionPhase({
      ...base,
      pendingAck: { id: '1' } as never,
      marketProgress: { currentRole: 'A', currentRoleName: 'Attaccanti', filledSlots: 48, totalSlots: 48, roleSequence: ['P', 'D', 'C', 'A'], slotLimits: { P: 3, D: 8, C: 8, A: 6 } },
    })
    expect(phase).toBe('acknowledgment')
  })

  it('torna "nomination" quando e\' il turno dell\'utente e mancano slot', () => {
    const phase = getAuctionPhase({
      ...base,
      isMyTurn: true,
      marketProgress: { currentRole: 'A', currentRoleName: 'Attaccanti', filledSlots: 40, totalSlots: 48, roleSequence: ['P', 'D', 'C', 'A'], slotLimits: { P: 3, D: 8, C: 8, A: 6 } },
    })
    expect(phase).toBe('nomination')
  })
})

describe('MarketCompletePanel', () => {
  it('mostra il CTA verso Admin > Fasi per l\'admin', async () => {
    const onNavigate = vi.fn()
    render(<MarketCompletePanel isAdmin leagueId="league1" onNavigate={onNavigate} />)

    expect(screen.getByText('Primo Mercato completato')).toBeInTheDocument()
    const cta = screen.getByRole('button', { name: /Fasi & Stato/ })
    await userEvent.click(cta)
    expect(onNavigate).toHaveBeenCalledWith('admin', { leagueId: 'league1', tab: 'phases' })
  })

  it('non mostra il CTA admin per un manager non admin', () => {
    render(<MarketCompletePanel isAdmin={false} leagueId="league1" />)

    expect(screen.getByText('Primo Mercato completato')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByText(/in attesa che l'admin concluda/i)).toBeInTheDocument()
  })
})
