/**
 * admin.service.test.ts - Unit Tests for Admin Service
 *
 * Tests for admin service functions: exportAllRosters, getAuditLog, logAction,
 * getLeagueStatistics, resetFirstMarket, migrateProphecies, assignPrize,
 * getPrizeHistory, getMembersForPrizes, completeLeagueWithTestUsers.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Hoist mock before imports
const { mockPrisma, MockPrismaClient } = vi.hoisted(() => {
  const mock = {
    leagueMember: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
    },
    auditLog: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    league: {
      findUnique: vi.fn(),
    },
    playerRoster: {
      count: vi.fn(),
      deleteMany: vi.fn(),
    },
    auction: {
      count: vi.fn(),
      deleteMany: vi.fn(),
    },
    tradeOffer: {
      count: vi.fn(),
    },
    marketSession: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    auctionAppeal: {
      deleteMany: vi.fn(),
    },
    auctionAcknowledgment: {
      deleteMany: vi.fn(),
      findMany: vi.fn(),
    },
    auctionBid: {
      deleteMany: vi.fn(),
    },
    prophecy: {
      deleteMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    playerMovement: {
      deleteMany: vi.fn(),
      findFirst: vi.fn(),
    },
    playerContract: {
      deleteMany: vi.fn(),
    },
    prize: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  }

  const MockClass = function (this: typeof mock) {
    Object.assign(this, mock)
  } as unknown as new () => typeof mock

  return { mockPrisma: mock, MockPrismaClient: MockClass }
})

// Mock Prisma with hoisted mock
vi.mock('@prisma/client', () => ({
  PrismaClient: MockPrismaClient,
  MemberStatus: {
    ACTIVE: 'ACTIVE',
    INACTIVE: 'INACTIVE',
    PENDING: 'PENDING',
  },
  ProphecyRole: {
    BUYER: 'BUYER',
    SELLER: 'SELLER',
  },
  Prisma: {
    JsonNull: 'DbNull',
  },
}))

// Mock bcryptjs
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('hashed-password'),
  },
}))

// Import after mocking
import * as adminService from '../services/admin.service'

describe('Admin Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ==================== exportAllRosters ====================

  describe('exportAllRosters', () => {
    it('returns error when user is not admin', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue(null)

      const result = await adminService.exportAllRosters('league-1', 'user-1')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non autorizzato')
    })

    it('returns roster export data for all active members', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'admin-member-1', role: 'ADMIN' })
      mockPrisma.leagueMember.findMany.mockResolvedValue([
        {
          user: { username: 'player1' },
          teamName: 'Team Alpha',
          currentBudget: 100,
          roster: [
            {
              player: { name: 'Leao', team: 'Milan', position: 'A', quotation: 30 },
              contract: { salary: 10, duration: 3, rescissionClause: 15 },
              acquisitionPrice: 25,
              acquisitionType: 'AUCTION',
            },
          ],
        },
      ])

      const result = await adminService.exportAllRosters('league-1', 'admin-user')

      expect(result.success).toBe(true)
      const data = result.data as Array<Record<string, unknown>>
      expect(data).toHaveLength(1)
      expect(data[0]).toEqual({
        username: 'player1',
        teamName: 'Team Alpha',
        budget: 100,
        players: [
          {
            name: 'Leao',
            team: 'Milan',
            position: 'A',
            quotation: 30,
            acquisitionPrice: 25,
            acquisitionType: 'AUCTION',
            salary: 10,
            duration: 3,
            rescissionClause: 15,
          },
        ],
      })
    })
  })

  // ==================== getAuditLog ====================

  describe('getAuditLog', () => {
    it('returns error when user is not admin', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue(null)

      const result = await adminService.getAuditLog('league-1', 'user-1')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non autorizzato')
    })

    it('returns audit logs with default pagination', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'admin-1', role: 'ADMIN' })
      const mockLogs = [
        { id: 'log-1', action: 'CREATE', user: { username: 'admin' }, createdAt: new Date() },
      ]
      mockPrisma.auditLog.findMany.mockResolvedValue(mockLogs)

      const result = await adminService.getAuditLog('league-1', 'admin-user')

      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockLogs)
      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 100,
          skip: 0,
        })
      )
    })

    it('filters audit logs by action when provided', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'admin-1', role: 'ADMIN' })
      mockPrisma.auditLog.findMany.mockResolvedValue([])

      await adminService.getAuditLog('league-1', 'admin-user', {
        action: 'RESET_MARKET',
        limit: 50,
        offset: 10,
      })

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { leagueId: 'league-1', action: 'RESET_MARKET' },
          take: 50,
          skip: 10,
        })
      )
    })
  })

  // ==================== logAction ====================

  describe('logAction', () => {
    it('creates an audit log entry', async () => {
      mockPrisma.auditLog.create.mockResolvedValue({})

      await adminService.logAction('user-1', 'league-1', 'TEST_ACTION', 'User', 'entity-1')

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          leagueId: 'league-1',
          action: 'TEST_ACTION',
          entityType: 'User',
          entityId: 'entity-1',
        }),
      })
    })

    it('silently handles errors without throwing', async () => {
      mockPrisma.auditLog.create.mockRejectedValue(new Error('DB error'))

      // Should not throw
      await expect(
        adminService.logAction('user-1', 'league-1', 'ACTION')
      ).resolves.toBeUndefined()
    })
  })

  // ==================== getLeagueStatistics ====================

  describe('getLeagueStatistics', () => {
    it('returns error when user is not a league member', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue(null)

      const result = await adminService.getLeagueStatistics('league-1', 'user-1')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non sei membro di questa lega')
    })

    it('returns comprehensive league statistics', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'member-1' })
      mockPrisma.league.findUnique.mockResolvedValue({
        name: 'Test League',
        status: 'ACTIVE',
        maxParticipants: 8,
        initialBudget: 200,
      })
      mockPrisma.leagueMember.findMany.mockResolvedValue([
        {
          user: { username: 'player1' },
          teamName: 'Team A',
          currentBudget: 150,
          roster: [{ id: 'r1' }, { id: 'r2' }],
        },
        {
          user: { username: 'player2' },
          teamName: 'Team B',
          currentBudget: 180,
          roster: [{ id: 'r3' }],
        },
      ])
      mockPrisma.playerRoster.count.mockResolvedValue(3)
      mockPrisma.auction.count.mockResolvedValue(10)
      mockPrisma.tradeOffer.count.mockResolvedValue(2)

      const result = await adminService.getLeagueStatistics('league-1', 'user-1')

      expect(result.success).toBe(true)
      const data = result.data as Record<string, unknown>
      expect(data).toMatchObject({
        league: {
          name: 'Test League',
          status: 'ACTIVE',
          maxParticipants: 8,
          initialBudget: 200,
        },
        memberCount: 2,
        totalPlayersAssigned: 3,
        completedAuctions: 10,
        completedTrades: 2,
      })
      // memberStats should be sorted by playerCount desc
      const memberStats = data.memberStats as Array<Record<string, unknown>>
      expect(memberStats[0].playerCount).toBe(2)
      expect(memberStats[1].playerCount).toBe(1)
    })
  })

  // ==================== resetFirstMarket ====================

  describe('resetFirstMarket', () => {
    it('returns error when user is not admin', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue(null)

      const result = await adminService.resetFirstMarket('league-1', 'user-1')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non autorizzato')
    })

    it('returns error when league not found', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'admin-1', role: 'ADMIN' })
      mockPrisma.league.findUnique.mockResolvedValue(null)

      const result = await adminService.resetFirstMarket('league-1', 'admin-user')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Lega non trovata')
    })

    it('returns error when no PRIMO_MERCATO session exists', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'admin-1', role: 'ADMIN' })
      mockPrisma.league.findUnique.mockResolvedValue({ id: 'league-1', initialBudget: 200 })
      mockPrisma.marketSession.findFirst.mockResolvedValue(null)

      const result = await adminService.resetFirstMarket('league-1', 'admin-user')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Nessuna sessione PRIMO MERCATO trovata')
    })

    it('resets all market data and returns success', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'admin-1', role: 'ADMIN' })
      mockPrisma.league.findUnique.mockResolvedValue({ id: 'league-1', initialBudget: 200 })
      mockPrisma.marketSession.findFirst.mockResolvedValue({ id: 'session-1' })
      mockPrisma.auctionAppeal.deleteMany.mockResolvedValue({ count: 1 })
      mockPrisma.auctionAcknowledgment.deleteMany.mockResolvedValue({ count: 2 })
      mockPrisma.auctionBid.deleteMany.mockResolvedValue({ count: 5 })
      mockPrisma.auction.deleteMany.mockResolvedValue({ count: 3 })
      mockPrisma.prophecy.deleteMany.mockResolvedValue({ count: 1 })
      mockPrisma.playerMovement.deleteMany.mockResolvedValue({ count: 3 })
      mockPrisma.playerContract.deleteMany.mockResolvedValue({ count: 3 })
      mockPrisma.playerRoster.deleteMany.mockResolvedValue({ count: 3 })
      mockPrisma.leagueMember.updateMany.mockResolvedValue({ count: 8 })
      mockPrisma.marketSession.update.mockResolvedValue({ id: 'session-1' })

      const result = await adminService.resetFirstMarket('league-1', 'admin-user')

      expect(result.success).toBe(true)
      expect(result.message).toBe('Primo Mercato resettato. Pronto per ricominciare.')
      const data = result.data as Record<string, unknown>
      expect(data.sessionId).toBe('session-1')
      expect(data.initialBudget).toBe(200)

      // Verify all deletions were called
      expect(mockPrisma.auctionAppeal.deleteMany).toHaveBeenCalled()
      expect(mockPrisma.auctionAcknowledgment.deleteMany).toHaveBeenCalled()
      expect(mockPrisma.auctionBid.deleteMany).toHaveBeenCalled()
      expect(mockPrisma.auction.deleteMany).toHaveBeenCalled()
      expect(mockPrisma.prophecy.deleteMany).toHaveBeenCalled()
      expect(mockPrisma.playerMovement.deleteMany).toHaveBeenCalled()
      expect(mockPrisma.playerContract.deleteMany).toHaveBeenCalled()
      expect(mockPrisma.playerRoster.deleteMany).toHaveBeenCalled()
      expect(mockPrisma.leagueMember.updateMany).toHaveBeenCalled()
      expect(mockPrisma.marketSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'session-1' },
          data: expect.objectContaining({
            currentTurnIndex: 0,
            currentRole: 'P',
            status: 'ACTIVE',
          }),
        })
      )
    })
  })

  // ==================== assignPrize ====================

  describe('assignPrize', () => {
    it('returns error when user is not admin', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue(null)

      const result = await adminService.assignPrize('league-1', 'user-1', 'member-1', 10)

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non autorizzato')
    })

    it('returns error when amount is not a positive integer', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'admin-1', role: 'ADMIN' })

      const result = await adminService.assignPrize('league-1', 'admin-user', 'member-1', -5)

      expect(result.success).toBe(false)
      expect(result.message).toBe("L'importo deve essere un numero intero positivo")
    })

    it('returns error when amount is zero', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'admin-1', role: 'ADMIN' })

      const result = await adminService.assignPrize('league-1', 'admin-user', 'member-1', 0)

      expect(result.success).toBe(false)
      expect(result.message).toBe("L'importo deve essere un numero intero positivo")
    })

    it('returns error when target member not found', async () => {
      // First call for admin check, second call for target member
      mockPrisma.leagueMember.findFirst
        .mockResolvedValueOnce({ id: 'admin-1', role: 'ADMIN' })
        .mockResolvedValueOnce(null)

      const result = await adminService.assignPrize('league-1', 'admin-user', 'bad-member', 10)

      expect(result.success).toBe(false)
      expect(result.message).toBe('Manager non trovato')
    })

    it('assigns prize and increments budget successfully', async () => {
      mockPrisma.leagueMember.findFirst
        .mockResolvedValueOnce({ id: 'admin-1', role: 'ADMIN' })
        .mockResolvedValueOnce({
          id: 'member-1',
          teamName: 'Team Alpha',
          user: { username: 'player1' },
        })

      mockPrisma.$transaction.mockResolvedValue([
        { currentBudget: 210 },
        { id: 'prize-1' },
      ])

      const result = await adminService.assignPrize(
        'league-1',
        'admin-user',
        'member-1',
        10,
        'Miglior squadra'
      )

      expect(result.success).toBe(true)
      expect(result.message).toContain('Premio di 10M assegnato a Team Alpha')
      expect(result.message).toContain('Miglior squadra')
      const data = result.data as Record<string, unknown>
      expect(data.newBudget).toBe(210)
      expect(data.prizeId).toBe('prize-1')
    })
  })

  // ==================== getPrizeHistory ====================

  describe('getPrizeHistory', () => {
    it('returns error when user is not admin', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue(null)

      const result = await adminService.getPrizeHistory('league-1', 'user-1')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non autorizzato')
    })

    it('returns formatted prize history', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'admin-1', role: 'ADMIN' })
      const createdAt = new Date('2025-06-01')
      mockPrisma.prize.findMany.mockResolvedValue([
        {
          id: 'prize-1',
          memberId: 'member-1',
          member: { teamName: 'Team Alpha', user: { username: 'player1' } },
          admin: { user: { username: 'admin1' } },
          amount: 15,
          reason: 'Best team',
          createdAt,
        },
      ])

      const result = await adminService.getPrizeHistory('league-1', 'admin-user')

      expect(result.success).toBe(true)
      const data = result.data as Array<Record<string, unknown>>
      expect(data).toHaveLength(1)
      expect(data[0]).toEqual({
        id: 'prize-1',
        memberId: 'member-1',
        teamName: 'Team Alpha',
        username: 'player1',
        adminUsername: 'admin1',
        amount: 15,
        reason: 'Best team',
        createdAt,
      })
    })
  })

  // ==================== getMembersForPrizes ====================

  describe('getMembersForPrizes', () => {
    it('returns error when user is not admin', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue(null)

      const result = await adminService.getMembersForPrizes('league-1', 'user-1')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non autorizzato')
    })

    it('returns formatted member list for prize assignment', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'admin-1', role: 'ADMIN' })
      mockPrisma.leagueMember.findMany.mockResolvedValue([
        { id: 'member-1', teamName: 'Team Alpha', user: { username: 'player1' }, currentBudget: 100 },
        { id: 'member-2', teamName: 'Team Beta', user: { username: 'player2' }, currentBudget: 150 },
      ])

      const result = await adminService.getMembersForPrizes('league-1', 'admin-user')

      expect(result.success).toBe(true)
      const data = result.data as Array<Record<string, unknown>>
      expect(data).toHaveLength(2)
      expect(data[0]).toEqual({
        id: 'member-1',
        teamName: 'Team Alpha',
        username: 'player1',
        currentBudget: 100,
      })
    })
  })

  // ==================== completeLeagueWithTestUsers ====================

  describe('completeLeagueWithTestUsers', () => {
    it('returns error when user is not admin', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue(null)

      const result = await adminService.completeLeagueWithTestUsers('league-1', 'user-1')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non autorizzato')
    })

    it('returns error when league not found', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'admin-1', role: 'ADMIN' })
      mockPrisma.league.findUnique.mockResolvedValue(null)

      const result = await adminService.completeLeagueWithTestUsers('league-1', 'admin-user')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Lega non trovata')
    })

    it('returns error when league already has 8 or more members', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'admin-1', role: 'ADMIN' })
      mockPrisma.league.findUnique.mockResolvedValue({ id: 'league-1', initialBudget: 200 })
      mockPrisma.leagueMember.count.mockResolvedValue(8)

      const result = await adminService.completeLeagueWithTestUsers('league-1', 'admin-user')

      expect(result.success).toBe(false)
      expect(result.message).toBe('La lega ha già 8 o più manager')
    })

    it('adds test users until league has 8 members', async () => {
      mockPrisma.leagueMember.findFirst
        .mockResolvedValueOnce({ id: 'admin-1', role: 'ADMIN' }) // admin check
        .mockResolvedValueOnce(null) // no existing membership for test1
        .mockResolvedValueOnce(null) // no existing membership for test2

      mockPrisma.league.findUnique.mockResolvedValue({ id: 'league-1', initialBudget: 200 })
      mockPrisma.leagueMember.count.mockResolvedValue(6) // needs 2 more

      // test1 user does not exist, test2 user already exists
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(null) // test1 not found
        .mockResolvedValueOnce({ id: 'existing-user-2', email: 'test2@test.com' }) // test2 exists

      mockPrisma.user.create.mockResolvedValue({ id: 'new-user-1', email: 'test1@test.com' })
      mockPrisma.leagueMember.create.mockResolvedValue({})

      const result = await adminService.completeLeagueWithTestUsers('league-1', 'admin-user')

      expect(result.success).toBe(true)
      expect(result.message).toContain('Aggiunti 2 manager di test')
      const data = result.data as Record<string, unknown>
      expect(data.addedCount).toBe(2)
      expect(data.totalMembers).toBe(8)
    })
  })

  // ==================== migrateProphecies ====================

  describe('migrateProphecies', () => {
    it('returns error when user is not admin', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue(null)

      const result = await adminService.migrateProphecies('league-1', 'user-1')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non autorizzato')
    })

    it('skips acknowledgments with empty prophecy text', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'admin-1', role: 'ADMIN' })
      mockPrisma.auctionAcknowledgment.findMany.mockResolvedValue([
        {
          prophecy: '   ',
          auctionId: 'auction-1',
          memberId: 'member-1',
          auction: { playerId: 'player-1', player: { name: 'Leao' } },
          member: { id: 'member-1' },
        },
      ])

      const result = await adminService.migrateProphecies('league-1', 'admin-user')

      expect(result.success).toBe(true)
      expect(result.message).toContain('0 profezie migrate')
      expect(result.message).toContain('1 saltate')
    })

    it('migrates prophecy when movement and role are valid', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'admin-1', role: 'ADMIN' })
      mockPrisma.auctionAcknowledgment.findMany.mockResolvedValue([
        {
          prophecy: 'Great player!',
          auctionId: 'auction-1',
          memberId: 'member-1',
          acknowledgedAt: new Date('2025-01-01'),
          auction: { playerId: 'player-1', player: { name: 'Leao' } },
          member: { id: 'member-1' },
        },
      ])
      mockPrisma.playerMovement.findFirst.mockResolvedValue({
        id: 'movement-1',
        toMemberId: 'member-1',
        fromMemberId: 'member-2',
      })
      mockPrisma.prophecy.findUnique.mockResolvedValue(null) // no existing prophecy
      mockPrisma.prophecy.create.mockResolvedValue({ id: 'prophecy-1' })

      const result = await adminService.migrateProphecies('league-1', 'admin-user')

      expect(result.success).toBe(true)
      expect(result.message).toContain('1 profezie migrate')
      expect(mockPrisma.prophecy.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          leagueId: 'league-1',
          playerId: 'player-1',
          authorId: 'member-1',
          movementId: 'movement-1',
          authorRole: 'BUYER',
          content: 'Great player!',
        }),
      })
    })

    it('skips when prophecy already exists for movement', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'admin-1', role: 'ADMIN' })
      mockPrisma.auctionAcknowledgment.findMany.mockResolvedValue([
        {
          prophecy: 'Duplicate prophecy',
          auctionId: 'auction-1',
          memberId: 'member-1',
          auction: { playerId: 'player-1', player: { name: 'Leao' } },
          member: { id: 'member-1' },
        },
      ])
      mockPrisma.playerMovement.findFirst.mockResolvedValue({
        id: 'movement-1',
        toMemberId: 'member-1',
        fromMemberId: 'member-2',
      })
      mockPrisma.prophecy.findUnique.mockResolvedValue({ id: 'existing-prophecy' })

      const result = await adminService.migrateProphecies('league-1', 'admin-user')

      expect(result.success).toBe(true)
      expect(result.message).toContain('0 profezie migrate')
      expect(result.message).toContain('1 saltate')
      expect(mockPrisma.prophecy.create).not.toHaveBeenCalled()
    })

    it('reports errors when no movement found for auction', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'admin-1', role: 'ADMIN' })
      mockPrisma.auctionAcknowledgment.findMany.mockResolvedValue([
        {
          prophecy: 'Good player',
          auctionId: 'auction-1',
          memberId: 'member-1',
          auction: { playerId: 'player-1', player: { name: 'Leao' } },
          member: { id: 'member-1' },
        },
      ])
      mockPrisma.playerMovement.findFirst.mockResolvedValue(null)

      const result = await adminService.migrateProphecies('league-1', 'admin-user')

      expect(result.success).toBe(true)
      const data = result.data as Record<string, unknown>
      const errors = data.errors as string[]
      expect(errors).toHaveLength(1)
      expect(errors[0]).toContain('Nessun movimento trovato per asta auction-1')
    })
  })
})
