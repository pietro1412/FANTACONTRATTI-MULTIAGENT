/**
 * Unit tests per placeBid in auction.service.ts — rilanci sull'asta Primo Mercato.
 *
 * Nessun test automatico esisteva per placeBid prima del fix race condition
 * 2026-08-29 (docs/reviews/fix-plan-race-bid-2026-08-29.md): la funzione non era
 * nemmeno wrappata in una transazione. Questi test bloccano una regressione sul
 * meccanismo CAS + retry introdotto dal fix.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockPrisma = {
  auction: { findUnique: vi.fn(), findFirst: vi.fn() },
  leagueMember: { findFirst: vi.fn() },
  playerContract: { aggregate: vi.fn() },
  playerRoster: { count: vi.fn() },
  marketSession: { findFirst: vi.fn() },
  $transaction: vi.fn(),
}

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))
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
vi.mock('./movement.service', () => ({ recordMovement: vi.fn() }))

const LEAGUE_ID = 'league-1'
const USER_ID = 'user-1'
const MEMBER_ID = 'member-1'
const AUCTION_ID = 'auction-1'
const PLAYER_ID = 'player-1'
const SESSION_ID = 'session-1'

function makeAuction(overrides: Record<string, unknown> = {}) {
  return {
    id: AUCTION_ID,
    leagueId: LEAGUE_ID,
    playerId: PLAYER_ID,
    marketSessionId: SESSION_ID,
    status: 'ACTIVE',
    currentPrice: 20,
    timerExpiresAt: new Date(Date.now() + 30_000),
    player: { id: PLAYER_ID, name: 'Test Player', position: 'C' },
    league: { goalkeeperSlots: 3, defenderSlots: 8, midfielderSlots: 8, forwardSlots: 6 },
    marketSession: { type: 'PRIMO_MERCATO' },
    ...overrides,
  }
}

async function getService() {
  return import('@/services/auction.service')
}

describe('auction.service — placeBid', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockPrisma.auction.findUnique.mockResolvedValue(makeAuction())
    mockPrisma.leagueMember.findFirst.mockResolvedValue({
      id: MEMBER_ID,
      leagueId: LEAGUE_ID,
      userId: USER_ID,
      status: 'ACTIVE',
      currentBudget: 500,
    })
    mockPrisma.playerContract.aggregate.mockResolvedValue({ _sum: { salary: 0 } })
    mockPrisma.playerRoster.count.mockResolvedValue(0)
    mockPrisma.marketSession.findFirst.mockResolvedValue({ id: SESSION_ID, auctionTimerSeconds: 30 })
  })

  function mockTransactionOnce(claimCount: number) {
    return async (fn: (tx: unknown) => Promise<unknown>) => {
      const txMock = {
        auction: { updateMany: vi.fn().mockResolvedValue({ count: claimCount }) },
        auctionBid: {
          updateMany: vi.fn(),
          create: vi.fn().mockResolvedValue({
            id: 'bid-1',
            auctionId: AUCTION_ID,
            bidderId: MEMBER_ID,
            userId: USER_ID,
            amount: 25,
            isWinning: true,
            bidder: { teamName: 'FC Test', user: { username: 'bidder' } },
          }),
        },
      }
      return fn(txMock)
    }
  }

  it('accetta il rilancio quando la CAS vince al primo tentativo', async () => {
    const { placeBid } = await getService()
    mockPrisma.$transaction.mockImplementation(mockTransactionOnce(1))

    const result = await placeBid(AUCTION_ID, USER_ID, 25)

    expect(result.success).toBe(true)
    const data = result.data as { amount: number; currentPrice?: number }
    expect(data.amount).toBe(25)
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1)
  })

  it('fa vincere comunque un rilancio piu alto se il primo tentativo perde la CAS contro un bid concorrente', async () => {
    const { placeBid } = await getService()

    // Rilettura fresca al 2o tentativo: un bid concorrente ha alzato il prezzo a 22,
    // ma la nostra offerta di 25 e' comunque piu alta e deve vincere.
    mockPrisma.auction.findUnique
      .mockResolvedValueOnce(makeAuction({ currentPrice: 20 })) // lettura iniziale
      .mockResolvedValueOnce(makeAuction({ currentPrice: 22 })) // rilettura di retry

    let transactionCallCount = 0
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      transactionCallCount++
      return mockTransactionOnce(transactionCallCount === 1 ? 0 : 1)(fn)
    })

    const result = await placeBid(AUCTION_ID, USER_ID, 25)

    expect(result.success).toBe(true)
    expect(transactionCallCount).toBe(2)
  })

  it('respinge in modo pulito (senza loop) se dopo la CAS persa la rilettura mostra un prezzo non piu superabile', async () => {
    const { placeBid } = await getService()

    mockPrisma.auction.findUnique
      .mockResolvedValueOnce(makeAuction({ currentPrice: 20 }))
      .mockResolvedValueOnce(makeAuction({ currentPrice: 25 })) // gia' salito al pari della nostra offerta

    mockPrisma.$transaction.mockImplementation(mockTransactionOnce(0))

    const result = await placeBid(AUCTION_ID, USER_ID, 25)

    expect(result.success).toBe(false)
    expect(result.message).toContain('Offerta minima')
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1)
  })

  it('rinuncia dopo troppi tentativi in contesa perpetua con un messaggio onesto', async () => {
    const { placeBid } = await getService()

    mockPrisma.auction.findUnique.mockImplementation(() => Promise.resolve(makeAuction({ currentPrice: 21 })))
    mockPrisma.$transaction.mockImplementation(mockTransactionOnce(0))

    const result = await placeBid(AUCTION_ID, USER_ID, 25)

    expect(result.success).toBe(false)
    expect(result.message).toContain('Troppi rilanci concorrenti')
  })

  it('respinge un\'offerta non superiore al prezzo corrente senza avviare alcuna transazione', async () => {
    const { placeBid } = await getService()
    mockPrisma.auction.findUnique.mockResolvedValue(makeAuction({ currentPrice: 30 }))

    const result = await placeBid(AUCTION_ID, USER_ID, 25)

    expect(result.success).toBe(false)
    expect(result.message).toContain('Offerta minima')
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })

  it('rework 01/09/2026: calcola il monte ingaggi per la validazione solo sui contratti non ancora pagati', async () => {
    const { placeBid } = await getService()
    mockPrisma.$transaction.mockImplementation(mockTransactionOnce(1))

    await placeBid(AUCTION_ID, USER_ID, 25)

    expect(mockPrisma.playerContract.aggregate).toHaveBeenCalledWith({
      where: { leagueMemberId: MEMBER_ID, paidAt: null },
      _sum: { salary: true },
    })
  })
})
