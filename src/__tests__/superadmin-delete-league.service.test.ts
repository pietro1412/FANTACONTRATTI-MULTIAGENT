/**
 * superadmin-delete-league.service.test.ts - Unit tests for deleteLeague
 *
 * Verifies the transactional cascade deletion of a league:
 * - error when league does not exist
 * - executes child deleteMany operations and league.delete inside $transaction
 * - leaves AuditLog / UserFeedback untouched (they self-detach via SetNull)
 * - returns success
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Hoist mock before imports
const { mockPrisma, MockPrismaClient } = vi.hoisted(() => {
  const mock = {
    user: {
      findUnique: vi.fn(),
    },
    league: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    leagueMember: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    marketSession: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    auction: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    playerRoster: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    auctionBid: { deleteMany: vi.fn() },
    auctionAcknowledgment: { deleteMany: vi.fn() },
    auctionAppeal: { deleteMany: vi.fn() },
    prophecy: { deleteMany: vi.fn() },
    playerMovement: { deleteMany: vi.fn() },
    playerContract: { deleteMany: vi.fn() },
    draftContract: { deleteMany: vi.fn() },
    sessionPrize: { deleteMany: vi.fn() },
    prizeCategory: { deleteMany: vi.fn() },
    prizePhaseConfig: { deleteMany: vi.fn() },
    contractConsolidation: { deleteMany: vi.fn() },
    indemnityDecision: { deleteMany: vi.fn() },
    tradeOffer: { deleteMany: vi.fn() },
    chatMessage: { deleteMany: vi.fn() },
    rubataPreference: { deleteMany: vi.fn() },
    auctionObjective: { deleteMany: vi.fn() },
    contractHistory: { deleteMany: vi.fn() },
    managerSessionSnapshot: { deleteMany: vi.fn() },
    prize: { deleteMany: vi.fn() },
    leagueInvite: { deleteMany: vi.fn() },
    // Models that must NOT be deleted (SetNull self-detach)
    auditLog: { deleteMany: vi.fn() },
    userFeedback: { deleteMany: vi.fn() },
    $transaction: vi.fn(),
  }

  const MockClass = function (this: typeof mock) {
    Object.assign(this, mock)
  } as unknown as new () => typeof mock

  return { mockPrisma: mock, MockPrismaClient: MockClass }
})

vi.mock('@prisma/client', () => ({
  PrismaClient: MockPrismaClient,
}))

// xlsx is imported by the service module but unused in these tests
vi.mock('xlsx', () => ({ read: vi.fn(), utils: {} }))

// Import after mocking
import { deleteLeague } from '../services/superadmin.service'

describe('deleteLeague', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // By default, $transaction runs the callback with mockPrisma as tx
    mockPrisma.$transaction.mockImplementation(
      async (cb: (tx: typeof mockPrisma) => Promise<unknown>) => cb(mockPrisma)
    )
    // Empty id collections by default
    mockPrisma.leagueMember.findMany.mockResolvedValue([])
    mockPrisma.marketSession.findMany.mockResolvedValue([])
    mockPrisma.auction.findMany.mockResolvedValue([])
    mockPrisma.playerRoster.findMany.mockResolvedValue([])
  })

  it('returns error when league does not exist', async () => {
    mockPrisma.league.findUnique.mockResolvedValue(null)

    const result = await deleteLeague('missing-league')

    expect(result.success).toBe(false)
    expect(result.message).toBe('Lega non trovata')
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    expect(mockPrisma.league.delete).not.toHaveBeenCalled()
  })

  it('deletes all dependents and the league inside a transaction', async () => {
    mockPrisma.league.findUnique.mockResolvedValue({ id: 'league-1', name: 'Test League' })

    const result = await deleteLeague('league-1')

    expect(result.success).toBe(true)
    expect(result.message).toContain('Test League')

    // Runs inside a single transaction
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1)

    // Representative leaf + intermediate + root deletions happened
    expect(mockPrisma.auctionBid.deleteMany).toHaveBeenCalled()
    expect(mockPrisma.playerContract.deleteMany).toHaveBeenCalled()
    expect(mockPrisma.playerRoster.deleteMany).toHaveBeenCalled()
    expect(mockPrisma.tradeOffer.deleteMany).toHaveBeenCalled()
    expect(mockPrisma.prophecy.deleteMany).toHaveBeenCalled()
    expect(mockPrisma.playerMovement.deleteMany).toHaveBeenCalled()
    expect(mockPrisma.auction.deleteMany).toHaveBeenCalledWith({ where: { leagueId: 'league-1' } })
    expect(mockPrisma.marketSession.deleteMany).toHaveBeenCalledWith({ where: { leagueId: 'league-1' } })
    expect(mockPrisma.leagueInvite.deleteMany).toHaveBeenCalledWith({ where: { leagueId: 'league-1' } })
    expect(mockPrisma.leagueMember.deleteMany).toHaveBeenCalledWith({ where: { leagueId: 'league-1' } })
    expect(mockPrisma.league.delete).toHaveBeenCalledWith({ where: { id: 'league-1' } })
  })

  it('does NOT delete AuditLog or UserFeedback (they self-detach via SetNull)', async () => {
    mockPrisma.league.findUnique.mockResolvedValue({ id: 'league-1', name: 'Test League' })

    await deleteLeague('league-1')

    expect(mockPrisma.auditLog.deleteMany).not.toHaveBeenCalled()
    expect(mockPrisma.userFeedback.deleteMany).not.toHaveBeenCalled()
  })

  it('deletes the league as the final operation (root last)', async () => {
    mockPrisma.league.findUnique.mockResolvedValue({ id: 'league-1', name: 'Test League' })

    const order: string[] = []
    mockPrisma.leagueMember.deleteMany.mockImplementation(() => {
      order.push('leagueMember')
      return Promise.resolve({ count: 0 })
    })
    mockPrisma.league.delete.mockImplementation(() => {
      order.push('league')
      return Promise.resolve({})
    })

    await deleteLeague('league-1')

    expect(order).toEqual(['leagueMember', 'league'])
  })

  it('returns failure message and does not throw when transaction fails', async () => {
    mockPrisma.league.findUnique.mockResolvedValue({ id: 'league-1', name: 'Test League' })
    mockPrisma.$transaction.mockRejectedValue(new Error('FK violation'))

    const result = await deleteLeague('league-1')

    expect(result.success).toBe(false)
    expect(result.message).toContain('FK violation')
  })
})
