/**
 * Unit tests for rubata auction functions in rubata.service.ts
 *
 * Functions tested:
 * - makeRubataOffer
 * - bidOnRubataAuction
 * - closeCurrentRubataAuction
 * - advanceRubataPlayer
 * - goBackRubataPlayer
 * - simulateRubataOffer
 * - simulateRubataBid
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ──

const mockPrisma = {
  leagueMember: { findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
  marketSession: { findFirst: vi.fn(), update: vi.fn() },
  playerRoster: { findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  playerContract: { findFirst: vi.fn(), update: vi.fn(), aggregate: vi.fn() },
  auction: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), findMany: vi.fn() },
  auctionBid: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
  playerMovement: { findFirst: vi.fn(), create: vi.fn() },
  serieAPlayer: { findUnique: vi.fn() },
  $transaction: vi.fn(),
}

vi.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}))

vi.mock('./movement.service', () => ({ recordMovement: vi.fn() }))
vi.mock('./pusher.service', () => ({
  triggerRubataBidPlaced: vi.fn().mockReturnValue(Promise.resolve()),
  triggerRubataStealDeclared: vi.fn().mockReturnValue(Promise.resolve()),
  triggerRubataReadyChanged: vi.fn().mockReturnValue(Promise.resolve()),
  triggerAuctionClosed: vi.fn().mockReturnValue(Promise.resolve()),
}))
vi.mock('./player-stats.service', () => ({
  computeSeasonStatsBatch: vi.fn().mockResolvedValue([]),
  computeAutoTagsBatch: vi.fn().mockResolvedValue([]),
}))

// ── Fixtures ──

const LEAGUE_ID = 'league-1'
const USER_ID = 'user-1'
const ADMIN_USER_ID = 'admin-user-1'
const MEMBER_ID = 'member-1'
const ADMIN_MEMBER_ID = 'admin-member-1'
const SELLER_MEMBER_ID = 'seller-member-1'
const TARGET_MEMBER_ID = 'target-member-1'
const SESSION_ID = 'session-1'
const PLAYER_ID = 'player-1'
const AUCTION_ID = 'auction-1'
const ROSTER_ID = 'roster-1'
const CONTRACT_ID = 'contract-1'

function makeMember(overrides: Record<string, unknown> = {}) {
  return {
    id: MEMBER_ID,
    leagueId: LEAGUE_ID,
    userId: USER_ID,
    status: 'ACTIVE',
    role: 'MANAGER',
    currentBudget: 500,
    ...overrides,
  }
}

function makeAdminMember(overrides: Record<string, unknown> = {}) {
  return {
    id: ADMIN_MEMBER_ID,
    leagueId: LEAGUE_ID,
    userId: ADMIN_USER_ID,
    status: 'ACTIVE',
    role: 'ADMIN',
    currentBudget: 500,
    ...overrides,
  }
}

function makeBoardItem(overrides: Record<string, unknown> = {}) {
  return {
    rosterId: ROSTER_ID,
    memberId: SELLER_MEMBER_ID,
    playerId: PLAYER_ID,
    playerName: 'Test Player',
    playerPosition: 'C',
    playerTeam: 'Juventus',
    ownerUsername: 'seller-user',
    ownerTeamName: 'Seller FC',
    rubataPrice: 20,
    contractSalary: 5,
    contractDuration: 3,
    contractClause: 45,
    ...overrides,
  }
}

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    id: SESSION_ID,
    leagueId: LEAGUE_ID,
    status: 'ACTIVE',
    currentPhase: 'RUBATA',
    rubataState: 'OFFERING',
    rubataBoard: [makeBoardItem()],
    rubataBoardIndex: 0,
    rubataTimerStartedAt: null,
    rubataOfferTimerSeconds: 30,
    rubataAuctionTimerSeconds: 30,
    rubataReadyMembers: [],
    ...overrides,
  }
}

function makeAuction(overrides: Record<string, unknown> = {}) {
  return {
    id: AUCTION_ID,
    leagueId: LEAGUE_ID,
    marketSessionId: SESSION_ID,
    playerId: PLAYER_ID,
    type: 'RUBATA',
    basePrice: 20,
    currentPrice: 20,
    sellerId: SELLER_MEMBER_ID,
    status: 'ACTIVE',
    ...overrides,
  }
}

// ── Lazy import (after mocks) ──

async function getService() {
  return await import('@/services/rubata.service')
}

beforeEach(() => {
  vi.clearAllMocks()
  // Default $transaction: execute the callback with mock tx
  mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
    const txMock = {
      leagueMember: { findFirst: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
      marketSession: { update: vi.fn() },
      playerRoster: { findFirst: vi.fn(), update: vi.fn() },
      playerContract: { findFirst: vi.fn(), update: vi.fn() },
      auction: { create: vi.fn().mockResolvedValue({ id: AUCTION_ID }), update: vi.fn(), findFirst: vi.fn() },
      auctionBid: { create: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn() },
      playerMovement: { create: vi.fn() },
    }
    return fn(txMock as unknown as typeof mockPrisma)
  })
})

// ====================================================================
// makeRubataOffer
// ====================================================================

describe('makeRubataOffer', () => {
  it('should succeed when all conditions are met', async () => {
    const { makeRubataOffer } = await getService()

    mockPrisma.leagueMember.findFirst.mockResolvedValue(makeMember())
    mockPrisma.marketSession.findFirst.mockResolvedValue(makeSession())
    mockPrisma.playerMovement.findFirst.mockResolvedValue(null)
    mockPrisma.playerContract.aggregate.mockResolvedValue({ _sum: { salary: 10 } })
    mockPrisma.auction.findFirst.mockResolvedValue(null)
    mockPrisma.leagueMember.findUnique.mockResolvedValue({
      id: MEMBER_ID,
      user: { username: 'TestUser' },
    })

    const result = await makeRubataOffer(LEAGUE_ID, USER_ID)

    expect(result.success).toBe(true)
    const data = result.data as { auctionId: string; price: number }
    expect(data.auctionId).toBe(AUCTION_ID)
    expect(data.price).toBe(20)
  })

  it('should fail if user is not a member', async () => {
    const { makeRubataOffer } = await getService()

    mockPrisma.leagueMember.findFirst.mockResolvedValue(null)

    const result = await makeRubataOffer(LEAGUE_ID, USER_ID)

    expect(result.success).toBe(false)
    expect(result.message).toBe('Non sei membro di questa lega')
  })

  it('should fail if no active rubata session', async () => {
    const { makeRubataOffer } = await getService()

    mockPrisma.leagueMember.findFirst.mockResolvedValue(makeMember())
    mockPrisma.marketSession.findFirst.mockResolvedValue(null)

    const result = await makeRubataOffer(LEAGUE_ID, USER_ID)

    expect(result.success).toBe(false)
    expect(result.message).toBe('Nessuna sessione rubata attiva')
  })

  it('should fail if rubata state is not OFFERING', async () => {
    const { makeRubataOffer } = await getService()

    mockPrisma.leagueMember.findFirst.mockResolvedValue(makeMember())
    mockPrisma.marketSession.findFirst.mockResolvedValue(makeSession({ rubataState: 'AUCTION' }))

    const result = await makeRubataOffer(LEAGUE_ID, USER_ID)

    expect(result.success).toBe(false)
    expect(result.message).toBe('Non è il momento di fare offerte')
  })

  it('should fail if timer has expired', async () => {
    const { makeRubataOffer } = await getService()

    const expiredTime = new Date(Date.now() - 60_000) // 60s ago
    mockPrisma.leagueMember.findFirst.mockResolvedValue(makeMember())
    mockPrisma.marketSession.findFirst.mockResolvedValue(
      makeSession({ rubataTimerStartedAt: expiredTime })
    )

    const result = await makeRubataOffer(LEAGUE_ID, USER_ID)

    expect(result.success).toBe(false)
    expect(result.message).toBe('Timer scaduto')
  })

  it('should fail if member tries to steal own player', async () => {
    const { makeRubataOffer } = await getService()

    // Board item owned by the same member
    mockPrisma.leagueMember.findFirst.mockResolvedValue(makeMember())
    mockPrisma.marketSession.findFirst.mockResolvedValue(
      makeSession({ rubataBoard: [makeBoardItem({ memberId: MEMBER_ID })] })
    )

    const result = await makeRubataOffer(LEAGUE_ID, USER_ID)

    expect(result.success).toBe(false)
    expect(result.message).toBe('Non puoi rubare un tuo giocatore')
  })

  it('should fail if member released the player in this session', async () => {
    const { makeRubataOffer } = await getService()

    mockPrisma.leagueMember.findFirst.mockResolvedValue(makeMember())
    mockPrisma.marketSession.findFirst.mockResolvedValue(makeSession())
    mockPrisma.playerMovement.findFirst.mockResolvedValue({ id: 'movement-1' }) // found a release

    const result = await makeRubataOffer(LEAGUE_ID, USER_ID)

    expect(result.success).toBe(false)
    expect(result.message).toContain('svincolato in questa sessione')
  })

  it('should fail if budget is insufficient', async () => {
    const { makeRubataOffer } = await getService()

    mockPrisma.leagueMember.findFirst.mockResolvedValue(makeMember({ currentBudget: 25 }))
    mockPrisma.marketSession.findFirst.mockResolvedValue(makeSession())
    mockPrisma.playerMovement.findFirst.mockResolvedValue(null)
    // monteIngaggi = 10 => bilancio = 25 - 10 = 15 < rubataPrice 20
    mockPrisma.playerContract.aggregate.mockResolvedValue({ _sum: { salary: 10 } })

    const result = await makeRubataOffer(LEAGUE_ID, USER_ID)

    expect(result.success).toBe(false)
    expect(result.message).toContain('Budget insufficiente')
  })

  it('should fail if an auction already exists', async () => {
    const { makeRubataOffer } = await getService()

    mockPrisma.leagueMember.findFirst.mockResolvedValue(makeMember())
    mockPrisma.marketSession.findFirst.mockResolvedValue(makeSession())
    mockPrisma.playerMovement.findFirst.mockResolvedValue(null)
    mockPrisma.playerContract.aggregate.mockResolvedValue({ _sum: { salary: 0 } })
    mockPrisma.auction.findFirst.mockResolvedValue(makeAuction())

    const result = await makeRubataOffer(LEAGUE_ID, USER_ID)

    expect(result.success).toBe(false)
    expect(result.message).toContain('asta in corso')
  })
})

// ====================================================================
// bidOnRubataAuction
// ====================================================================

describe('bidOnRubataAuction', () => {
  it('should succeed when bid is valid', async () => {
    const { bidOnRubataAuction } = await getService()

    mockPrisma.leagueMember.findFirst.mockResolvedValue(makeMember())
    mockPrisma.marketSession.findFirst.mockResolvedValue(makeSession({ rubataState: 'AUCTION' }))
    mockPrisma.auction.findFirst.mockResolvedValue(makeAuction({ currentPrice: 20 }))
    // monteIngaggi = 10 => bilancio = 500 - 10 = 490 => maxBid = 489
    mockPrisma.playerContract.aggregate.mockResolvedValue({ _sum: { salary: 10 } })
    mockPrisma.leagueMember.findUnique.mockResolvedValue({
      id: MEMBER_ID,
      user: { username: 'Bidder' },
    })
    mockPrisma.serieAPlayer.findUnique.mockResolvedValue({ id: PLAYER_ID, name: 'Test Player' })

    const result = await bidOnRubataAuction(LEAGUE_ID, USER_ID, 25)

    expect(result.success).toBe(true)
    const data = result.data as { currentPrice: number }
    expect(data.currentPrice).toBe(25)
  })

  it('should fail if member not found', async () => {
    const { bidOnRubataAuction } = await getService()

    mockPrisma.leagueMember.findFirst.mockResolvedValue(null)

    const result = await bidOnRubataAuction(LEAGUE_ID, USER_ID, 25)

    expect(result.success).toBe(false)
    expect(result.message).toBe('Non sei membro di questa lega')
  })

  it('should fail if rubata state is not AUCTION', async () => {
    const { bidOnRubataAuction } = await getService()

    mockPrisma.leagueMember.findFirst.mockResolvedValue(makeMember())
    mockPrisma.marketSession.findFirst.mockResolvedValue(makeSession({ rubataState: 'OFFERING' }))

    const result = await bidOnRubataAuction(LEAGUE_ID, USER_ID, 25)

    expect(result.success).toBe(false)
    expect(result.message).toBe('Nessuna asta in corso')
  })

  it('should fail if bid is not higher than current price', async () => {
    const { bidOnRubataAuction } = await getService()

    mockPrisma.leagueMember.findFirst.mockResolvedValue(makeMember())
    mockPrisma.marketSession.findFirst.mockResolvedValue(makeSession({ rubataState: 'AUCTION' }))
    mockPrisma.auction.findFirst.mockResolvedValue(makeAuction({ currentPrice: 30 }))

    const result = await bidOnRubataAuction(LEAGUE_ID, USER_ID, 25)

    expect(result.success).toBe(false)
    expect(result.message).toContain('maggiore di 30')
  })

  it('should fail if bid equals current price', async () => {
    const { bidOnRubataAuction } = await getService()

    mockPrisma.leagueMember.findFirst.mockResolvedValue(makeMember())
    mockPrisma.marketSession.findFirst.mockResolvedValue(makeSession({ rubataState: 'AUCTION' }))
    mockPrisma.auction.findFirst.mockResolvedValue(makeAuction({ currentPrice: 25 }))

    const result = await bidOnRubataAuction(LEAGUE_ID, USER_ID, 25)

    expect(result.success).toBe(false)
    expect(result.message).toContain('maggiore di 25')
  })

  it('should fail if seller tries to bid', async () => {
    const { bidOnRubataAuction } = await getService()

    mockPrisma.leagueMember.findFirst.mockResolvedValue(makeMember({ id: SELLER_MEMBER_ID }))
    mockPrisma.marketSession.findFirst.mockResolvedValue(makeSession({ rubataState: 'AUCTION' }))
    mockPrisma.auction.findFirst.mockResolvedValue(makeAuction({ sellerId: SELLER_MEMBER_ID }))

    const result = await bidOnRubataAuction(LEAGUE_ID, USER_ID, 25)

    expect(result.success).toBe(false)
    expect(result.message).toContain('tuo giocatore')
  })

  it('should fail if budget is insufficient (amount > bilancio - 1)', async () => {
    const { bidOnRubataAuction } = await getService()

    // budget=30, monteIngaggi=5, bilancio=25, maxBid=24
    mockPrisma.leagueMember.findFirst.mockResolvedValue(makeMember({ currentBudget: 30 }))
    mockPrisma.marketSession.findFirst.mockResolvedValue(makeSession({ rubataState: 'AUCTION' }))
    mockPrisma.auction.findFirst.mockResolvedValue(makeAuction({ currentPrice: 20 }))
    mockPrisma.playerContract.aggregate.mockResolvedValue({ _sum: { salary: 5 } })

    const result = await bidOnRubataAuction(LEAGUE_ID, USER_ID, 25)

    expect(result.success).toBe(false)
    expect(result.message).toContain('Budget insufficiente')
  })
})

// ====================================================================
// closeCurrentRubataAuction
// ====================================================================

describe('closeCurrentRubataAuction', () => {
  it('should succeed and transfer contract, roster, and budget', async () => {
    const { closeCurrentRubataAuction } = await getService()

    const winningBid = {
      bidderId: MEMBER_ID,
      userId: USER_ID,
      amount: 25,
      isWinning: true,
      bidder: { user: { username: 'WinnerUser' } },
    }

    mockPrisma.leagueMember.findFirst.mockResolvedValue(makeAdminMember())
    mockPrisma.marketSession.findFirst.mockResolvedValue(makeSession({ rubataState: 'AUCTION' }))
    mockPrisma.auction.findFirst.mockResolvedValue(
      makeAuction({
        currentPrice: 25,
        bids: [winningBid],
        player: { id: PLAYER_ID, name: 'Test Player', team: 'Juventus', position: 'C' },
        include: true,
      })
    )

    // $transaction mock: simulate the transfer logic
    const txUpdateMember = vi.fn()
    const txUpdateRoster = vi.fn()
    const txUpdateContract = vi.fn()
    const txUpdateAuction = vi.fn()
    const txFindUniqueSeller = vi.fn().mockResolvedValue({
      id: SELLER_MEMBER_ID,
      currentBudget: 400,
    })
    const txFindRoster = vi.fn().mockResolvedValue({
      id: ROSTER_ID,
      leagueMemberId: SELLER_MEMBER_ID,
      playerId: PLAYER_ID,
      status: 'ACTIVE',
      contract: { id: CONTRACT_ID, salary: 5, duration: 3, rescissionClause: 45 },
    })

    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn({
        leagueMember: { findUnique: txFindUniqueSeller, update: txUpdateMember },
        playerRoster: { findFirst: txFindRoster, update: txUpdateRoster },
        playerContract: { update: txUpdateContract },
        auction: { update: txUpdateAuction },
      })
    })

    // After transaction: findFirst for transferred roster
    mockPrisma.playerRoster.findFirst.mockResolvedValue({
      id: ROSTER_ID,
      leagueMemberId: MEMBER_ID,
      playerId: PLAYER_ID,
      contract: { salary: 5, duration: 3, rescissionClause: 45 },
    })

    // Seller info for pending ack
    mockPrisma.leagueMember.findUnique.mockResolvedValue({
      id: SELLER_MEMBER_ID,
      user: { username: 'SellerUser' },
    })

    // marketSession.update for pending ack board
    mockPrisma.marketSession.update.mockResolvedValue({})

    const result = await closeCurrentRubataAuction(LEAGUE_ID, ADMIN_USER_ID)

    expect(result.success).toBe(true)
    const data = result.data as {
      winnerId: string
      winnerUsername: string
      finalPrice: number
      pendingAck: boolean
    }
    expect(data.winnerId).toBe(MEMBER_ID)
    expect(data.winnerUsername).toBe('WinnerUser')
    expect(data.finalPrice).toBe(25)
    expect(data.pendingAck).toBe(true)

    // Verify budget transfers inside tx
    // Winner budget decremented by sellerPayment = price - salary = 25 - 5 = 20
    expect(txUpdateMember).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: MEMBER_ID },
        data: { currentBudget: { decrement: 20 } },
      })
    )
    // Seller budget incremented by OFFERTA = price - salary = 25 - 5 = 20
    expect(txUpdateMember).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: SELLER_MEMBER_ID },
        data: { currentBudget: { increment: 20 } },
      })
    )

    // Roster transferred (UPDATE, not delete/recreate)
    expect(txUpdateRoster).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ROSTER_ID },
        data: expect.objectContaining({
          leagueMemberId: MEMBER_ID,
          acquisitionType: 'RUBATA',
          acquisitionPrice: 25,
        }),
      })
    )

    // Contract transferred to winner
    expect(txUpdateContract).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: CONTRACT_ID },
        data: { leagueMemberId: MEMBER_ID },
      })
    )
  })

  it('should fail if user is not admin', async () => {
    const { closeCurrentRubataAuction } = await getService()

    mockPrisma.leagueMember.findFirst.mockResolvedValue(null)

    const result = await closeCurrentRubataAuction(LEAGUE_ID, ADMIN_USER_ID)

    expect(result.success).toBe(false)
    expect(result.message).toBe('Non autorizzato')
  })

  it('should fail if no active rubata session', async () => {
    const { closeCurrentRubataAuction } = await getService()

    mockPrisma.leagueMember.findFirst.mockResolvedValue(makeAdminMember())
    mockPrisma.marketSession.findFirst.mockResolvedValue(null)

    const result = await closeCurrentRubataAuction(LEAGUE_ID, ADMIN_USER_ID)

    expect(result.success).toBe(false)
    expect(result.message).toBe('Nessuna sessione rubata attiva')
  })

  it('should decrement winner budget by sellerPayment (payment - salary), not full payment', async () => {
    const { closeCurrentRubataAuction } = await getService()

    const winningBid = {
      bidderId: MEMBER_ID,
      userId: USER_ID,
      amount: 30,
      isWinning: true,
      bidder: { user: { username: 'WinnerUser' } },
    }

    // currentPrice = 30, contract salary = 8 => sellerPayment = 22
    mockPrisma.leagueMember.findFirst.mockResolvedValue(makeAdminMember())
    mockPrisma.marketSession.findFirst.mockResolvedValue(makeSession({ rubataState: 'AUCTION' }))
    mockPrisma.auction.findFirst.mockResolvedValue(
      makeAuction({
        currentPrice: 30,
        bids: [winningBid],
        player: { id: PLAYER_ID, name: 'Test Player', team: 'Juventus', position: 'C' },
      })
    )

    const txUpdateMember = vi.fn()
    const txFindUniqueSeller = vi.fn().mockResolvedValue({
      id: SELLER_MEMBER_ID,
      currentBudget: 400,
    })
    const txFindRoster = vi.fn().mockResolvedValue({
      id: ROSTER_ID,
      leagueMemberId: SELLER_MEMBER_ID,
      playerId: PLAYER_ID,
      status: 'ACTIVE',
      contract: { id: CONTRACT_ID, salary: 8, duration: 3, rescissionClause: 72 },
    })

    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn({
        leagueMember: { findUnique: txFindUniqueSeller, update: txUpdateMember },
        playerRoster: { findFirst: txFindRoster, update: vi.fn() },
        playerContract: { update: vi.fn() },
        auction: { update: vi.fn() },
      })
    })

    mockPrisma.playerRoster.findFirst.mockResolvedValue({
      id: ROSTER_ID,
      leagueMemberId: MEMBER_ID,
      playerId: PLAYER_ID,
      contract: { salary: 8, duration: 3, rescissionClause: 72 },
    })
    mockPrisma.leagueMember.findUnique.mockResolvedValue({
      id: SELLER_MEMBER_ID,
      user: { username: 'SellerUser' },
    })
    mockPrisma.marketSession.update.mockResolvedValue({})

    const result = await closeCurrentRubataAuction(LEAGUE_ID, ADMIN_USER_ID)

    expect(result.success).toBe(true)

    // Winner budget must be decremented by sellerPayment = 30 - 8 = 22, NOT by 30
    expect(txUpdateMember).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: MEMBER_ID },
        data: { currentBudget: { decrement: 22 } },
      })
    )

    // Seller budget must be incremented by sellerPayment = 22
    expect(txUpdateMember).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: SELLER_MEMBER_ID },
        data: { currentBudget: { increment: 22 } },
      })
    )
  })

  it('should advance to next player if no auction exists', async () => {
    const { closeCurrentRubataAuction } = await getService()

    const board = [makeBoardItem(), makeBoardItem({ playerId: 'player-2' })]
    mockPrisma.leagueMember.findFirst.mockResolvedValue(makeAdminMember())
    mockPrisma.marketSession.findFirst.mockResolvedValue(
      makeSession({ rubataState: 'AUCTION', rubataBoard: board })
    )
    mockPrisma.auction.findFirst.mockResolvedValue(null)
    mockPrisma.marketSession.update.mockResolvedValue({})

    const result = await closeCurrentRubataAuction(LEAGUE_ID, ADMIN_USER_ID)

    // Should call advanceRubataPlayer internally
    expect(result.success).toBe(true)
    const data = result.data as { currentIndex: number }
    expect(data.currentIndex).toBe(1)
  })
})

// ====================================================================
// advanceRubataPlayer
// ====================================================================

describe('advanceRubataPlayer', () => {
  it('should advance to next player', async () => {
    const { advanceRubataPlayer } = await getService()

    const board = [makeBoardItem(), makeBoardItem({ playerId: 'player-2' })]
    mockPrisma.leagueMember.findFirst.mockResolvedValue(makeAdminMember())
    mockPrisma.marketSession.findFirst.mockResolvedValue(
      makeSession({ rubataBoard: board, rubataBoardIndex: 0 })
    )
    mockPrisma.marketSession.update.mockResolvedValue({})

    const result = await advanceRubataPlayer(LEAGUE_ID, ADMIN_USER_ID)

    expect(result.success).toBe(true)
    const data = result.data as { currentIndex: number; totalPlayers: number }
    expect(data.currentIndex).toBe(1)
    expect(data.totalPlayers).toBe(2)
  })

  it('should mark rubata as completed at end of board', async () => {
    const { advanceRubataPlayer } = await getService()

    mockPrisma.leagueMember.findFirst.mockResolvedValue(makeAdminMember())
    mockPrisma.marketSession.findFirst.mockResolvedValue(
      makeSession({ rubataBoard: [makeBoardItem()], rubataBoardIndex: 0 })
    )
    mockPrisma.marketSession.update.mockResolvedValue({})

    const result = await advanceRubataPlayer(LEAGUE_ID, ADMIN_USER_ID)

    expect(result.success).toBe(true)
    const data = result.data as { completed: boolean }
    expect(data.completed).toBe(true)

    // Should set state to COMPLETED
    expect(mockPrisma.marketSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ rubataState: 'COMPLETED' }),
      })
    )
  })

  it('should fail if user is not admin', async () => {
    const { advanceRubataPlayer } = await getService()

    mockPrisma.leagueMember.findFirst.mockResolvedValue(null)

    const result = await advanceRubataPlayer(LEAGUE_ID, ADMIN_USER_ID)

    expect(result.success).toBe(false)
    expect(result.message).toBe('Non autorizzato')
  })

  it('should fail if no active session', async () => {
    const { advanceRubataPlayer } = await getService()

    mockPrisma.leagueMember.findFirst.mockResolvedValue(makeAdminMember())
    mockPrisma.marketSession.findFirst.mockResolvedValue(null)

    const result = await advanceRubataPlayer(LEAGUE_ID, ADMIN_USER_ID)

    expect(result.success).toBe(false)
    expect(result.message).toBe('Nessuna sessione rubata attiva')
  })

  it('should fail if board is not available', async () => {
    const { advanceRubataPlayer } = await getService()

    mockPrisma.leagueMember.findFirst.mockResolvedValue(makeAdminMember())
    mockPrisma.marketSession.findFirst.mockResolvedValue(
      makeSession({ rubataBoard: null })
    )

    const result = await advanceRubataPlayer(LEAGUE_ID, ADMIN_USER_ID)

    expect(result.success).toBe(false)
    expect(result.message).toBe('Tabellone non disponibile')
  })
})

// ====================================================================
// goBackRubataPlayer
// ====================================================================

describe('goBackRubataPlayer', () => {
  it('should go back to previous player', async () => {
    const { goBackRubataPlayer } = await getService()

    const board = [makeBoardItem(), makeBoardItem({ playerId: 'player-2' })]
    mockPrisma.leagueMember.findFirst.mockResolvedValue(makeAdminMember())
    mockPrisma.marketSession.findFirst.mockResolvedValue(
      makeSession({ rubataBoard: board, rubataBoardIndex: 1 })
    )
    mockPrisma.marketSession.update.mockResolvedValue({})

    const result = await goBackRubataPlayer(LEAGUE_ID, ADMIN_USER_ID)

    expect(result.success).toBe(true)
    const data = result.data as { currentIndex: number }
    expect(data.currentIndex).toBe(0)

    // Should reset state to OFFERING with timer
    expect(mockPrisma.marketSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          rubataBoardIndex: 0,
          rubataState: 'OFFERING',
        }),
      })
    )
  })

  it('should fail if already at first player', async () => {
    const { goBackRubataPlayer } = await getService()

    mockPrisma.leagueMember.findFirst.mockResolvedValue(makeAdminMember())
    mockPrisma.marketSession.findFirst.mockResolvedValue(
      makeSession({ rubataBoardIndex: 0 })
    )

    const result = await goBackRubataPlayer(LEAGUE_ID, ADMIN_USER_ID)

    expect(result.success).toBe(false)
    expect(result.message).toBe('Sei già al primo giocatore')
  })

  it('should fail if user is not admin', async () => {
    const { goBackRubataPlayer } = await getService()

    mockPrisma.leagueMember.findFirst.mockResolvedValue(null)

    const result = await goBackRubataPlayer(LEAGUE_ID, ADMIN_USER_ID)

    expect(result.success).toBe(false)
    expect(result.message).toBe('Non autorizzato')
  })

  it('should fail if no active session', async () => {
    const { goBackRubataPlayer } = await getService()

    mockPrisma.leagueMember.findFirst.mockResolvedValue(makeAdminMember())
    mockPrisma.marketSession.findFirst.mockResolvedValue(null)

    const result = await goBackRubataPlayer(LEAGUE_ID, ADMIN_USER_ID)

    expect(result.success).toBe(false)
    expect(result.message).toBe('Nessuna sessione rubata attiva')
  })
})

// ====================================================================
// simulateRubataOffer
// ====================================================================

describe('simulateRubataOffer', () => {
  it('should succeed when admin simulates offer for a target member', async () => {
    const { simulateRubataOffer } = await getService()

    // First call: admin check. Second call: target member check
    mockPrisma.leagueMember.findFirst
      .mockResolvedValueOnce(makeAdminMember())
      .mockResolvedValueOnce(makeMember({ id: TARGET_MEMBER_ID, currentBudget: 500 }))
      .mockResolvedValueOnce({ id: SELLER_MEMBER_ID, user: { username: 'OwnerUser' } })

    mockPrisma.marketSession.findFirst.mockResolvedValue(makeSession())
    mockPrisma.playerContract.aggregate.mockResolvedValue({ _sum: { salary: 5 } })
    mockPrisma.auction.findFirst.mockResolvedValue(null)
    mockPrisma.leagueMember.findUnique.mockResolvedValue({
      id: TARGET_MEMBER_ID,
      user: { username: 'TargetUser' },
    })
    mockPrisma.serieAPlayer.findUnique.mockResolvedValue({
      id: PLAYER_ID,
      name: 'Test Player',
      team: 'Juventus',
      position: 'C',
    })

    const result = await simulateRubataOffer(LEAGUE_ID, ADMIN_USER_ID, TARGET_MEMBER_ID)

    expect(result.success).toBe(true)
    const data = result.data as { auctionId: string; price: number }
    expect(data.auctionId).toBe(AUCTION_ID)
    expect(data.price).toBe(20)
  })

  it('should fail if user is not admin', async () => {
    const { simulateRubataOffer } = await getService()

    mockPrisma.leagueMember.findFirst.mockResolvedValue(null)

    const result = await simulateRubataOffer(LEAGUE_ID, ADMIN_USER_ID, TARGET_MEMBER_ID)

    expect(result.success).toBe(false)
    expect(result.message).toBe('Non autorizzato')
  })

  it('should fail if target member not found', async () => {
    const { simulateRubataOffer } = await getService()

    mockPrisma.leagueMember.findFirst
      .mockResolvedValueOnce(makeAdminMember())
      .mockResolvedValueOnce(null)

    const result = await simulateRubataOffer(LEAGUE_ID, ADMIN_USER_ID, TARGET_MEMBER_ID)

    expect(result.success).toBe(false)
    expect(result.message).toBe('Manager non trovato')
  })

  it('should fail if target member tries to steal own player', async () => {
    const { simulateRubataOffer } = await getService()

    mockPrisma.leagueMember.findFirst
      .mockResolvedValueOnce(makeAdminMember())
      .mockResolvedValueOnce(makeMember({ id: SELLER_MEMBER_ID }))

    mockPrisma.marketSession.findFirst.mockResolvedValue(makeSession())

    const result = await simulateRubataOffer(LEAGUE_ID, ADMIN_USER_ID, SELLER_MEMBER_ID)

    expect(result.success).toBe(false)
    expect(result.message).toContain('proprio giocatore')
  })

  it('should fail if target member has insufficient budget', async () => {
    const { simulateRubataOffer } = await getService()

    mockPrisma.leagueMember.findFirst
      .mockResolvedValueOnce(makeAdminMember())
      .mockResolvedValueOnce(makeMember({ id: TARGET_MEMBER_ID, currentBudget: 15 }))

    mockPrisma.marketSession.findFirst.mockResolvedValue(makeSession())
    // monteIngaggi = 5, bilancio = 15 - 5 = 10 < rubataPrice 20
    mockPrisma.playerContract.aggregate.mockResolvedValue({ _sum: { salary: 5 } })

    const result = await simulateRubataOffer(LEAGUE_ID, ADMIN_USER_ID, TARGET_MEMBER_ID)

    expect(result.success).toBe(false)
    expect(result.message).toContain('Budget insufficiente')
  })
})

// ====================================================================
// simulateRubataBid
// ====================================================================

describe('simulateRubataBid', () => {
  it('should succeed when admin simulates a valid bid', async () => {
    const { simulateRubataBid } = await getService()

    mockPrisma.leagueMember.findFirst
      .mockResolvedValueOnce(makeAdminMember())
      .mockResolvedValueOnce(makeMember({ id: TARGET_MEMBER_ID, userId: 'target-user', currentBudget: 500 }))

    mockPrisma.marketSession.findFirst.mockResolvedValue(makeSession({ rubataState: 'AUCTION' }))
    mockPrisma.auction.findFirst.mockResolvedValue(makeAuction({ currentPrice: 20 }))
    mockPrisma.playerContract.aggregate.mockResolvedValue({ _sum: { salary: 10 } })

    const result = await simulateRubataBid(LEAGUE_ID, ADMIN_USER_ID, TARGET_MEMBER_ID, 30)

    expect(result.success).toBe(true)
    const data = result.data as { currentPrice: number }
    expect(data.currentPrice).toBe(30)
  })

  it('should fail if not admin', async () => {
    const { simulateRubataBid } = await getService()

    mockPrisma.leagueMember.findFirst.mockResolvedValue(null)

    const result = await simulateRubataBid(LEAGUE_ID, ADMIN_USER_ID, TARGET_MEMBER_ID, 30)

    expect(result.success).toBe(false)
    expect(result.message).toBe('Non autorizzato')
  })

  it('should fail if target member not found', async () => {
    const { simulateRubataBid } = await getService()

    mockPrisma.leagueMember.findFirst
      .mockResolvedValueOnce(makeAdminMember())
      .mockResolvedValueOnce(null)

    const result = await simulateRubataBid(LEAGUE_ID, ADMIN_USER_ID, TARGET_MEMBER_ID, 30)

    expect(result.success).toBe(false)
    expect(result.message).toBe('Manager non trovato')
  })

  it('should fail if state is not AUCTION', async () => {
    const { simulateRubataBid } = await getService()

    mockPrisma.leagueMember.findFirst
      .mockResolvedValueOnce(makeAdminMember())
      .mockResolvedValueOnce(makeMember({ id: TARGET_MEMBER_ID }))

    mockPrisma.marketSession.findFirst.mockResolvedValue(makeSession({ rubataState: 'OFFERING' }))

    const result = await simulateRubataBid(LEAGUE_ID, ADMIN_USER_ID, TARGET_MEMBER_ID, 30)

    expect(result.success).toBe(false)
    expect(result.message).toBe('Nessuna asta in corso')
  })

  it('should fail if bid is not higher than current price', async () => {
    const { simulateRubataBid } = await getService()

    mockPrisma.leagueMember.findFirst
      .mockResolvedValueOnce(makeAdminMember())
      .mockResolvedValueOnce(makeMember({ id: TARGET_MEMBER_ID }))

    mockPrisma.marketSession.findFirst.mockResolvedValue(makeSession({ rubataState: 'AUCTION' }))
    mockPrisma.auction.findFirst.mockResolvedValue(makeAuction({ currentPrice: 30 }))

    const result = await simulateRubataBid(LEAGUE_ID, ADMIN_USER_ID, TARGET_MEMBER_ID, 25)

    expect(result.success).toBe(false)
    expect(result.message).toContain('maggiore di 30')
  })

  it('should fail if target is the seller', async () => {
    const { simulateRubataBid } = await getService()

    mockPrisma.leagueMember.findFirst
      .mockResolvedValueOnce(makeAdminMember())
      .mockResolvedValueOnce(makeMember({ id: SELLER_MEMBER_ID }))

    mockPrisma.marketSession.findFirst.mockResolvedValue(makeSession({ rubataState: 'AUCTION' }))
    mockPrisma.auction.findFirst.mockResolvedValue(makeAuction({ sellerId: SELLER_MEMBER_ID }))

    const result = await simulateRubataBid(LEAGUE_ID, ADMIN_USER_ID, SELLER_MEMBER_ID, 25)

    expect(result.success).toBe(false)
    expect(result.message).toContain('proprio giocatore')
  })

  it('should fail if budget is insufficient for target member', async () => {
    const { simulateRubataBid } = await getService()

    // budget=30, monteIngaggi=5, bilancio=25, maxBid=24
    mockPrisma.leagueMember.findFirst
      .mockResolvedValueOnce(makeAdminMember())
      .mockResolvedValueOnce(makeMember({ id: TARGET_MEMBER_ID, currentBudget: 30 }))

    mockPrisma.marketSession.findFirst.mockResolvedValue(makeSession({ rubataState: 'AUCTION' }))
    mockPrisma.auction.findFirst.mockResolvedValue(makeAuction({ currentPrice: 20 }))
    mockPrisma.playerContract.aggregate.mockResolvedValue({ _sum: { salary: 5 } })

    const result = await simulateRubataBid(LEAGUE_ID, ADMIN_USER_ID, TARGET_MEMBER_ID, 25)

    expect(result.success).toBe(false)
    expect(result.message).toContain('Budget insufficiente')
  })
})
