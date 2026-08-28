/**
 * Unit tests for closeAuction in auction.service.ts — chiusura asta Primo Mercato.
 *
 * Nessun test automatico esisteva per questo file prima del controllo definitivo
 * bilanci 2026-08-28 (buco di test trovato durante l'audit): questi test bloccano
 * i due bug corretti in quella sessione — atomicità mancante e claim anti-doppia-
 * chiusura — così una regressione futura verrebbe intercettata da npm run test:all
 * invece che da un audit manuale.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockPrisma = {
  auction: { findUnique: vi.fn(), updateMany: vi.fn() },
  leagueMember: { findFirst: vi.fn() },
  marketSession: { findFirst: vi.fn() },
  $transaction: vi.fn(),
}

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))
vi.mock('./movement.service', () => ({ recordMovement: vi.fn() }))
vi.mock('./pusher.service', () => ({
  triggerBidPlaced: vi.fn(),
  triggerNominationPending: vi.fn(),
  triggerNominationConfirmed: vi.fn(),
  triggerMemberReady: vi.fn(),
  triggerAuctionStarted: vi.fn(),
  triggerAuctionResumed: vi.fn(),
  triggerAuctionStateChanged: vi.fn(),
  triggerAuctionClosed: vi.fn().mockResolvedValue(undefined),
  triggerPauseRequested: vi.fn(),
}))

const LEAGUE_ID = 'league-1'
const ADMIN_USER_ID = 'admin-user-1'
const ADMIN_MEMBER_ID = 'admin-member-1'
const WINNER_MEMBER_ID = 'winner-member-1'
const AUCTION_ID = 'auction-1'
const PLAYER_ID = 'player-1'
const WINNING_BID_AMOUNT = 50

function makeAuction(overrides: Record<string, unknown> = {}) {
  return {
    id: AUCTION_ID,
    leagueId: LEAGUE_ID,
    playerId: PLAYER_ID,
    marketSessionId: 'session-1',
    status: 'ACTIVE',
    currentPrice: WINNING_BID_AMOUNT,
    player: { id: PLAYER_ID, name: 'Test Player' },
    league: {},
    bids: [
      {
        amount: WINNING_BID_AMOUNT,
        bidder: { id: WINNER_MEMBER_ID, teamName: 'FC Test', user: { username: 'winner' } },
      },
    ],
    ...overrides,
  }
}

describe('auction.service — closeAuction', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockPrisma.leagueMember.findFirst.mockResolvedValue({
      id: ADMIN_MEMBER_ID,
      leagueId: LEAGUE_ID,
      userId: ADMIN_USER_ID,
      role: 'ADMIN',
      status: 'ACTIVE',
    })
    mockPrisma.marketSession.findFirst.mockResolvedValue({ id: 'session-1' })
  })

  it('assegna il giocatore e scala il budget del vincitore per l\'importo della vincita', async () => {
    mockPrisma.auction.findUnique.mockResolvedValue(makeAuction())

    const txRosterCreate = vi.fn().mockResolvedValue({ id: 'roster-1' })
    const txContractCreate = vi.fn().mockResolvedValue({})
    const txMemberUpdate = vi.fn().mockResolvedValue({})
    const txAuctionUpdateMany = vi.fn().mockResolvedValue({ count: 1 })

    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        auction: { updateMany: txAuctionUpdateMany },
        playerRoster: { create: txRosterCreate },
        playerContract: { create: txContractCreate },
        leagueMember: { update: txMemberUpdate },
      })
    )

    const { closeAuction } = await import('../services/auction.service')
    const result = await closeAuction(AUCTION_ID, ADMIN_USER_ID)

    expect(result.success).toBe(true)

    // Il claim deve girare guardato su status:'ACTIVE' PRIMA di scrivere altro.
    expect(txAuctionUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: AUCTION_ID, status: 'ACTIVE' },
        data: expect.objectContaining({ status: 'COMPLETED', winnerId: WINNER_MEMBER_ID }),
      })
    )

    // Budget scalato per l'ESATTO importo della vincita, non un valore diverso.
    expect(txMemberUpdate).toHaveBeenCalledWith({
      where: { id: WINNER_MEMBER_ID },
      data: { currentBudget: { decrement: WINNING_BID_AMOUNT } },
    })

    expect(txRosterCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          leagueMemberId: WINNER_MEMBER_ID,
          acquisitionPrice: WINNING_BID_AMOUNT,
        }),
      })
    )
  })

  it('rifiuta la chiusura se un\'altra richiesta concorrente ha già chiuso la stessa asta (claim.count===0)', async () => {
    mockPrisma.auction.findUnique.mockResolvedValue(makeAuction())

    // Simula la race: il claim non trova più status:'ACTIVE' (un'altra richiesta
    // concorrente — es. l'auto-chiusura lazy per timer scaduto — ha già vinto).
    const txAuctionUpdateMany = vi.fn().mockResolvedValue({ count: 0 })
    const txMemberUpdate = vi.fn()

    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        auction: { updateMany: txAuctionUpdateMany },
        playerRoster: { create: vi.fn() },
        playerContract: { create: vi.fn() },
        leagueMember: { update: txMemberUpdate },
      })
    )

    const { closeAuction } = await import('../services/auction.service')
    const result = await closeAuction(AUCTION_ID, ADMIN_USER_ID)

    expect(result.success).toBe(false)
    // Nessuna scrittura sul budget deve avvenire se il claim fallisce — altrimenti
    // sarebbe di nuovo il bug della doppia assegnazione/doppio scalo.
    expect(txMemberUpdate).not.toHaveBeenCalled()
  })

  it('chiude come NO_BIDS senza toccare alcun budget quando non ci sono offerte', async () => {
    mockPrisma.auction.findUnique.mockResolvedValue(makeAuction({ bids: [] }))
    mockPrisma.auction.updateMany.mockResolvedValue({ count: 1 })

    const { closeAuction } = await import('../services/auction.service')
    const result = await closeAuction(AUCTION_ID, ADMIN_USER_ID)

    expect(result.success).toBe(true)
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })
})
