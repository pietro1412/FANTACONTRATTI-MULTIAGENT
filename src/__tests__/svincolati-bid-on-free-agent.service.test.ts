/**
 * Unit tests per bidOnFreeAgent in svincolati.service.ts — rilanci sull'asta Svincolati.
 *
 * Nessun test automatico esisteva per bidOnFreeAgent prima del fix race condition
 * 2026-08-29 (docs/reviews/fix-plan-race-bid-2026-08-29.md). Questi test bloccano
 * una regressione sul meccanismo CAS + retry introdotto dal fix.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockPrisma = {
  auction: { findUnique: vi.fn() },
  leagueMember: { findFirst: vi.fn(), findUnique: vi.fn() },
  playerContract: { aggregate: vi.fn() },
  $transaction: vi.fn(),
}

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))
vi.mock('./movement.service', () => ({ recordMovement: vi.fn() }))
vi.mock('./admin.service', () => ({ logAction: vi.fn() }))
vi.mock('./pusher.service', () => ({
  triggerSvincolatiNomination: vi.fn(),
  triggerSvincolatiBidPlaced: vi.fn().mockReturnValue(Promise.resolve()),
  triggerSvincolatiReadyChanged: vi.fn(),
  triggerSvincolatiAuctionClosed: vi.fn().mockReturnValue(Promise.resolve()),
  triggerSvincolatiTurnAdvanced: vi.fn(),
}))

const LEAGUE_ID = 'league-1'
const USER_ID = 'user-1'
const MEMBER_ID = 'member-1'
const AUCTION_ID = 'auction-1'
const PLAYER_ID = 'player-1'

function makeAuction(overrides: Record<string, unknown> = {}) {
  return {
    id: AUCTION_ID,
    leagueId: LEAGUE_ID,
    playerId: PLAYER_ID,
    marketSessionId: 'session-1',
    type: 'FREE_BID',
    status: 'ACTIVE',
    currentPrice: 20,
    player: { id: PLAYER_ID, name: 'Test Player', position: 'C' },
    // Fase turn-based: bypassa il check slot ruolo/lega per tenere la fixture minima.
    marketSession: { currentPhase: 'ASTA_SVINCOLATI', svincolatiState: 'AUCTION', svincolatiTimerSeconds: 30 },
    ...overrides,
  }
}

async function getService() {
  return import('@/services/svincolati.service')
}

describe('svincolati.service — bidOnFreeAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockPrisma.auction.findUnique.mockResolvedValue(makeAuction())
    mockPrisma.leagueMember.findFirst.mockResolvedValue({
      id: MEMBER_ID,
      leagueId: LEAGUE_ID,
      userId: USER_ID,
      status: 'ACTIVE',
      currentBudget: 500,
      totalSalaries: 0,
    })
    mockPrisma.leagueMember.findUnique.mockResolvedValue({
      id: MEMBER_ID,
      user: { username: 'Bidder' },
    })
  })

  function mockTransactionOnce(claimCount: number) {
    return async (fn: (tx: unknown) => Promise<unknown>) => {
      const txMock = {
        auction: { updateMany: vi.fn().mockResolvedValue({ count: claimCount }) },
        auctionBid: { updateMany: vi.fn(), create: vi.fn() },
      }
      return fn(txMock)
    }
  }

  it('accetta il rilancio quando la CAS vince al primo tentativo', async () => {
    const { bidOnFreeAgent } = await getService()
    mockPrisma.$transaction.mockImplementation(mockTransactionOnce(1))

    const result = await bidOnFreeAgent(AUCTION_ID, USER_ID, 25)

    expect(result.success).toBe(true)
    const data = result.data as { currentPrice: number }
    expect(data.currentPrice).toBe(25)
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1)
  })

  it('fa vincere comunque un rilancio piu alto se il primo tentativo perde la CAS contro un bid concorrente', async () => {
    const { bidOnFreeAgent } = await getService()

    mockPrisma.auction.findUnique
      .mockResolvedValueOnce(makeAuction({ currentPrice: 20 })) // lettura iniziale
      .mockResolvedValueOnce(makeAuction({ currentPrice: 22 })) // rilettura di retry

    let transactionCallCount = 0
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      transactionCallCount++
      return mockTransactionOnce(transactionCallCount === 1 ? 0 : 1)(fn)
    })

    const result = await bidOnFreeAgent(AUCTION_ID, USER_ID, 25)

    expect(result.success).toBe(true)
    const data = result.data as { currentPrice: number }
    expect(data.currentPrice).toBe(25)
    expect(transactionCallCount).toBe(2)
  })

  it('respinge in modo pulito (senza loop) se dopo la CAS persa la rilettura mostra un prezzo non piu superabile', async () => {
    const { bidOnFreeAgent } = await getService()

    mockPrisma.auction.findUnique
      .mockResolvedValueOnce(makeAuction({ currentPrice: 20 }))
      .mockResolvedValueOnce(makeAuction({ currentPrice: 25 }))

    mockPrisma.$transaction.mockImplementation(mockTransactionOnce(0))

    const result = await bidOnFreeAgent(AUCTION_ID, USER_ID, 25)

    expect(result.success).toBe(false)
    expect(result.message).toContain('maggiore di 25')
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1)
  })

  it('rinuncia dopo troppi tentativi in contesa perpetua con un messaggio onesto', async () => {
    const { bidOnFreeAgent } = await getService()

    mockPrisma.auction.findUnique.mockImplementation(() => Promise.resolve(makeAuction({ currentPrice: 21 })))
    mockPrisma.$transaction.mockImplementation(mockTransactionOnce(0))

    const result = await bidOnFreeAgent(AUCTION_ID, USER_ID, 25)

    expect(result.success).toBe(false)
    expect(result.message).toContain('Troppi rilanci concorrenti')
  })

  it('respinge un\'offerta non superiore al prezzo corrente senza avviare alcuna transazione', async () => {
    const { bidOnFreeAgent } = await getService()
    mockPrisma.auction.findUnique.mockResolvedValue(makeAuction({ currentPrice: 30 }))

    const result = await bidOnFreeAgent(AUCTION_ID, USER_ID, 25)

    expect(result.success).toBe(false)
    expect(result.message).toContain('maggiore di 30')
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })

  it('fix 03/09/2026: usa il monte ingaggi persistito (non una query live) — il credito da una vendita precedente e\' subito spendibile', async () => {
    const { bidOnFreeAgent } = await getService()
    // currentBudget 30, totalSalaries -10 (credito da una rubata precedente) → bilancio 40, offerta 25+ingaggio(3) = 28 <= 40
    mockPrisma.leagueMember.findFirst.mockResolvedValue({
      id: MEMBER_ID,
      leagueId: LEAGUE_ID,
      userId: USER_ID,
      status: 'ACTIVE',
      currentBudget: 30,
      totalSalaries: -10,
    })
    mockPrisma.$transaction.mockImplementation(mockTransactionOnce(1))

    const result = await bidOnFreeAgent(AUCTION_ID, USER_ID, 25)

    expect(result.success).toBe(true)
    expect(mockPrisma.playerContract.aggregate).not.toHaveBeenCalled()
  })

  it('fix 03/09/2026: respinge l\'offerta se currentBudget - totalSalaries (persistito) e\' insufficiente', async () => {
    const { bidOnFreeAgent } = await getService()
    // currentBudget 30, totalSalaries 10 → bilancio 20, offerta 25+ingaggio(3)=28 > 20
    mockPrisma.leagueMember.findFirst.mockResolvedValue({
      id: MEMBER_ID,
      leagueId: LEAGUE_ID,
      userId: USER_ID,
      status: 'ACTIVE',
      currentBudget: 30,
      totalSalaries: 10,
    })

    const result = await bidOnFreeAgent(AUCTION_ID, USER_ID, 25)

    expect(result.success).toBe(false)
    expect(result.message).toContain('Budget insufficiente')
  })
})
