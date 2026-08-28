/**
 * Unit tests for closeSvincolatiAuction in svincolati.service.ts.
 *
 * Nessun test automatico esisteva per questo file prima del controllo definitivo
 * bilanci 2026-08-28 (buco di test trovato durante l'audit). Questi test bloccano
 * l'invariante centrale (Bibbia FINANZE.md): il prezzo d'asta scala il Budget, il
 * nuovo ingaggio incrementa il Monte Ingaggi (contratto nuovo, non trasferito) —
 * e il claim anti-doppia-chiusura aggiunto nella stessa sessione.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockPrisma = {
  auction: { findUnique: vi.fn() },
  leagueMember: { findFirst: vi.fn() },
  $transaction: vi.fn(),
}

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))
vi.mock('./movement.service', () => ({ recordMovement: vi.fn() }))
vi.mock('./admin.service', () => ({ logAction: vi.fn() }))
vi.mock('./pusher.service', () => ({
  triggerSvincolatiNomination: vi.fn(),
  triggerSvincolatiBidPlaced: vi.fn(),
  triggerSvincolatiReadyChanged: vi.fn(),
  triggerSvincolatiAuctionClosed: vi.fn().mockReturnValue(Promise.resolve()),
  triggerSvincolatiTurnAdvanced: vi.fn(),
}))

const LEAGUE_ID = 'league-1'
const WINNER_MEMBER_ID = 'winner-member-1'
const AUCTION_ID = 'auction-1'
const PLAYER_ID = 'player-1'
const WINNING_PRICE = 30

function makeAuction(overrides: Record<string, unknown> = {}) {
  return {
    id: AUCTION_ID,
    leagueId: LEAGUE_ID,
    playerId: PLAYER_ID,
    marketSessionId: 'session-1',
    status: 'ACTIVE',
    currentPrice: WINNING_PRICE,
    player: { id: PLAYER_ID, name: 'Test Player' },
    marketSession: { svincolatiTurnOrder: [] },
    bids: [
      { bidderId: WINNER_MEMBER_ID, bidder: { id: WINNER_MEMBER_ID, user: { username: 'winner' } } },
    ],
    ...overrides,
  }
}

describe('svincolati.service — closeSvincolatiAuction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('scala il Budget per il prezzo e incrementa il Monte Ingaggi per il nuovo ingaggio', async () => {
    mockPrisma.auction.findUnique.mockResolvedValue(makeAuction())

    const txMemberUpdate = vi.fn().mockResolvedValue({})
    const txAuctionUpdateMany = vi.fn().mockResolvedValue({ count: 1 })

    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        auction: { updateMany: txAuctionUpdateMany },
        leagueMember: { update: txMemberUpdate },
        playerRoster: { create: vi.fn().mockResolvedValue({ id: 'roster-1' }) },
        playerContract: { create: vi.fn().mockResolvedValue({}) },
        marketSession: { update: vi.fn().mockResolvedValue({}) },
      })
    )

    const { closeSvincolatiAuction } = await import('../services/svincolati.service')
    const result = await closeSvincolatiAuction(AUCTION_ID)

    expect(result.success).toBe(true)

    expect(txAuctionUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: AUCTION_ID, status: 'ACTIVE' },
        data: expect.objectContaining({ status: 'COMPLETED', winnerId: WINNER_MEMBER_ID }),
      })
    )

    // Budget: decrementato per l'ESATTO prezzo d'asta.
    expect(txMemberUpdate).toHaveBeenCalledWith({
      where: { id: WINNER_MEMBER_ID },
      data: { currentBudget: { decrement: WINNING_PRICE } },
    })

    // Monte Ingaggi: incrementato per l'ingaggio del nuovo contratto (10% del prezzo,
    // min 1 — calculateDefaultSalary(30) = 3).
    expect(txMemberUpdate).toHaveBeenCalledWith({
      where: { id: WINNER_MEMBER_ID },
      data: { totalSalaries: { increment: 3 } },
    })
  })

  it('rifiuta la chiusura se un\'altra richiesta concorrente ha già chiuso la stessa asta', async () => {
    mockPrisma.auction.findUnique.mockResolvedValue(makeAuction())

    const txMemberUpdate = vi.fn()
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        auction: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
        leagueMember: { update: txMemberUpdate },
        playerRoster: { create: vi.fn() },
        playerContract: { create: vi.fn() },
        marketSession: { update: vi.fn() },
      })
    )

    const { closeSvincolatiAuction } = await import('../services/svincolati.service')
    const result = await closeSvincolatiAuction(AUCTION_ID)

    expect(result.success).toBe(false)
    expect(txMemberUpdate).not.toHaveBeenCalled()
  })

  it('con nessuna offerta chiude come NO_BIDS senza toccare budget o monte ingaggi', async () => {
    mockPrisma.auction.findUnique.mockResolvedValue(makeAuction({ bids: [] }))

    const txMemberUpdate = vi.fn()
    const txAuctionUpdateMany = vi.fn().mockResolvedValue({ count: 1 })
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        auction: { updateMany: txAuctionUpdateMany },
        leagueMember: { update: txMemberUpdate },
        marketSession: { update: vi.fn().mockResolvedValue({}) },
      })
    )

    const { closeSvincolatiAuction } = await import('../services/svincolati.service')
    const result = await closeSvincolatiAuction(AUCTION_ID)

    expect(result.success).toBe(true)
    expect(txAuctionUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'NO_BIDS' }) })
    )
    expect(txMemberUpdate).not.toHaveBeenCalled()
  })
})
