/**
 * Admin Prisma Repository Tests
 *
 * Unit tests for AdminPrismaRepository and AuditLogPrismaRepository with mocked Prisma client.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AdminPrismaRepository, AuditLogPrismaRepository } from '../../infrastructure/repositories/admin.prisma-repository'

// Mock Prisma client
vi.mock('@/lib/prisma', () => ({
  prisma: {
    leagueMember: {
      findUnique: vi.fn(),
    },
    league: {
      findUnique: vi.fn(),
    },
    tradeOffer: {
      count: vi.fn(),
    },
    marketSession: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    serieAPlayer: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'

describe('AdminPrismaRepository', () => {
  let repository: AdminPrismaRepository

  const mockMember = {
    id: 'member-1',
    userId: 'user-1',
    leagueId: 'league-1',
    teamName: 'Team A',
    role: 'ADMIN',
    status: 'ACTIVE',
    joinType: 'CREATOR',
    currentBudget: 100,
    preConsolidationBudget: null,
    rubataOrder: null,
    firstMarketOrder: null,
    joinedAt: new Date(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    repository = new AdminPrismaRepository()
  })

  describe('verifyAdmin', () => {
    it('should return true when user is admin', async () => {
      vi.mocked(prisma.leagueMember.findUnique).mockResolvedValue(mockMember)

      const result = await repository.verifyAdmin('league-1', 'user-1')

      expect(result.isAdmin).toBe(true)
      expect(result.memberId).toBe('member-1')
    })

    it('should return false when user is not admin', async () => {
      vi.mocked(prisma.leagueMember.findUnique).mockResolvedValue({
        ...mockMember,
        role: 'MANAGER',
      })

      const result = await repository.verifyAdmin('league-1', 'user-1')

      expect(result.isAdmin).toBe(false)
      expect(result.memberId).toBe('member-1')
    })

    it('should return false when user is not active', async () => {
      vi.mocked(prisma.leagueMember.findUnique).mockResolvedValue({
        ...mockMember,
        status: 'PENDING',
      })

      const result = await repository.verifyAdmin('league-1', 'user-1')

      expect(result.isAdmin).toBe(false)
      expect(result.memberId).toBeNull()
    })

    it('should return false when member not found', async () => {
      vi.mocked(prisma.leagueMember.findUnique).mockResolvedValue(null)

      const result = await repository.verifyAdmin('league-1', 'user-1')

      expect(result.isAdmin).toBe(false)
      expect(result.memberId).toBeNull()
    })
  })

  describe('checkMembership', () => {
    it('should return member ID when user is active member', async () => {
      vi.mocked(prisma.leagueMember.findUnique).mockResolvedValue(mockMember)

      const result = await repository.checkMembership('league-1', 'user-1')

      expect(result).toBe('member-1')
    })

    it('should return null when user is not active', async () => {
      vi.mocked(prisma.leagueMember.findUnique).mockResolvedValue({
        ...mockMember,
        status: 'PENDING',
      })

      const result = await repository.checkMembership('league-1', 'user-1')

      expect(result).toBeNull()
    })

    it('should return null when member not found', async () => {
      vi.mocked(prisma.leagueMember.findUnique).mockResolvedValue(null)

      const result = await repository.checkMembership('league-1', 'user-1')

      expect(result).toBeNull()
    })
  })

  describe('getLeagueStatistics', () => {
    it('should return league statistics', async () => {
      vi.mocked(prisma.league.findUnique).mockResolvedValue({
        id: 'league-1',
        name: 'Test League',
        description: null,
        minParticipants: 6,
        maxParticipants: 20,
        requireEvenNumber: true,
        initialBudget: 500,
        goalkeeperSlots: 3,
        defenderSlots: 8,
        midfielderSlots: 8,
        forwardSlots: 6,
        status: 'ACTIVE',
        currentSeason: 1,
        inviteCode: 'abc123',
        createdAt: new Date(),
        updatedAt: new Date(),
        members: [
          {
            ...mockMember,
            user: { username: 'user1' },
            roster: [
              { id: 'roster-1', status: 'ACTIVE' },
              { id: 'roster-2', status: 'ACTIVE' },
            ],
          },
        ],
        auctions: [
          { id: 'auction-1', status: 'COMPLETED' },
        ],
      })
      vi.mocked(prisma.tradeOffer.count).mockResolvedValue(5)

      const result = await repository.getLeagueStatistics('league-1')

      expect(result).not.toBeNull()
      expect(result?.league.name).toBe('Test League')
      expect(result?.memberCount).toBe(1)
      expect(result?.totalPlayersAssigned).toBe(2)
      expect(result?.completedAuctions).toBe(1)
      expect(result?.completedTrades).toBe(5)
      expect(result?.memberStats).toHaveLength(1)
    })

    it('should return null when league not found', async () => {
      vi.mocked(prisma.league.findUnique).mockResolvedValue(null)

      const result = await repository.getLeagueStatistics('non-existent')

      expect(result).toBeNull()
    })
  })

  describe('getSessionStatistics', () => {
    it('should return session statistics', async () => {
      vi.mocked(prisma.marketSession.findUnique).mockResolvedValue({
        id: 'session-1',
        leagueId: 'league-1',
        type: 'MERCATO_RICORRENTE',
        season: 1,
        semester: 1,
        status: 'ACTIVE',
        currentPhase: 'ASTA_LIBERA',
        currentRole: null,
        turnOrder: null,
        currentTurnIndex: null,
        auctionTimerSeconds: 30,
        rubataOrder: null,
        rubataBoard: null,
        rubataBoardIndex: null,
        rubataOfferTimerSeconds: 30,
        rubataAuctionTimerSeconds: 15,
        rubataTimerStartedAt: null,
        rubataState: null,
        rubataReadyMembers: null,
        rubataAuctionReadyInfo: null,
        rubataPendingAck: null,
        svincolatiTurnOrder: null,
        svincolatiCurrentTurnIndex: null,
        svincolatiTimerSeconds: 30,
        svincolatiTimerStartedAt: null,
        svincolatiState: null,
        svincolatiReadyMembers: null,
        svincolatiPassedMembers: null,
        svincolatiFinishedMembers: null,
        svincolatiPendingPlayerId: null,
        svincolatiPendingNominatorId: null,
        svincolatiNominatorConfirmed: false,
        svincolatiPendingAck: null,
        readyMembers: null,
        pendingNominationPlayerId: null,
        pendingNominatorId: null,
        nominatorConfirmed: false,
        startsAt: null,
        endsAt: null,
        phaseStartedAt: null,
        createdAt: new Date(),
        auctions: [
          { id: 'auction-1', status: 'COMPLETED', _count: { bids: 5 } },
          { id: 'auction-2', status: 'ACTIVE', _count: { bids: 3 } },
          { id: 'auction-3', status: 'COMPLETED', _count: { bids: 7 } },
        ],
      })

      const result = await repository.getSessionStatistics('session-1')

      expect(result).not.toBeNull()
      expect(result?.totalAuctions).toBe(3)
      expect(result?.completedAuctions).toBe(2)
      expect(result?.activeAuctions).toBe(1)
      expect(result?.totalBids).toBe(15)
      expect(result?.averageBidCount).toBe(5)
    })

    it('should return null when session not found', async () => {
      vi.mocked(prisma.marketSession.findUnique).mockResolvedValue(null)

      const result = await repository.getSessionStatistics('non-existent')

      expect(result).toBeNull()
    })
  })

  describe('updateMarketPhase', () => {
    it('should update market phase', async () => {
      vi.mocked(prisma.marketSession.update).mockResolvedValue({
        id: 'session-1',
        currentPhase: 'CONTRATTI',
        phaseStartedAt: new Date(),
      } as never)

      const result = await repository.updateMarketPhase('session-1', 'CONTRATTI')

      expect(result).toBe(true)
      expect(prisma.marketSession.update).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        data: {
          currentPhase: 'CONTRATTI',
          phaseStartedAt: expect.any(Date),
        },
      })
    })

    it('should return false when update fails', async () => {
      vi.mocked(prisma.marketSession.update).mockRejectedValue(new Error('DB error'))

      const result = await repository.updateMarketPhase('non-existent', 'CONTRATTI')

      expect(result).toBe(false)
    })
  })

  describe('getSessionWithLeague', () => {
    it('should return session with league info', async () => {
      vi.mocked(prisma.marketSession.findUnique).mockResolvedValue({
        id: 'session-1',
        leagueId: 'league-1',
        status: 'ACTIVE',
        type: 'MERCATO_RICORRENTE',
        season: 1,
        semester: 1,
        currentPhase: 'ASTA_LIBERA',
        currentRole: null,
        turnOrder: null,
        currentTurnIndex: null,
        auctionTimerSeconds: 30,
        rubataOrder: null,
        rubataBoard: null,
        rubataBoardIndex: null,
        rubataOfferTimerSeconds: 30,
        rubataAuctionTimerSeconds: 15,
        rubataTimerStartedAt: null,
        rubataState: null,
        rubataReadyMembers: null,
        rubataAuctionReadyInfo: null,
        rubataPendingAck: null,
        svincolatiTurnOrder: null,
        svincolatiCurrentTurnIndex: null,
        svincolatiTimerSeconds: 30,
        svincolatiTimerStartedAt: null,
        svincolatiState: null,
        svincolatiReadyMembers: null,
        svincolatiPassedMembers: null,
        svincolatiFinishedMembers: null,
        svincolatiPendingPlayerId: null,
        svincolatiPendingNominatorId: null,
        svincolatiNominatorConfirmed: false,
        svincolatiPendingAck: null,
        readyMembers: null,
        pendingNominationPlayerId: null,
        pendingNominatorId: null,
        nominatorConfirmed: false,
        startsAt: null,
        endsAt: null,
        phaseStartedAt: null,
        createdAt: new Date(),
      })

      const result = await repository.getSessionWithLeague('session-1')

      expect(result).not.toBeNull()
      expect(result?.leagueId).toBe('league-1')
    })
  })

  describe('importPlayers', () => {
    it('should import new players', async () => {
      vi.mocked(prisma.serieAPlayer.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.serieAPlayer.create).mockResolvedValue({
        id: 'player-1',
        name: 'Mario Rossi',
        team: 'Inter',
        position: 'A',
        quotation: 25,
        isActive: true,
        externalId: null,
        age: null,
        listStatus: 'IN_LIST',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = await repository.importPlayers([
        { name: 'Mario Rossi', team: 'Inter', position: 'A', quotation: 25 },
      ])

      expect(result.imported).toBe(1)
      expect(result.updated).toBe(0)
      expect(result.errors).toHaveLength(0)
    })

    it('should update existing players', async () => {
      vi.mocked(prisma.serieAPlayer.findFirst).mockResolvedValue({
        id: 'player-1',
        name: 'Mario Rossi',
        team: 'Inter',
        position: 'A',
        quotation: 20,
        isActive: true,
        externalId: null,
        age: null,
        listStatus: 'IN_LIST',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      vi.mocked(prisma.serieAPlayer.update).mockResolvedValue({
        id: 'player-1',
        name: 'Mario Rossi',
        team: 'Inter',
        position: 'A',
        quotation: 25,
        isActive: true,
        externalId: null,
        age: null,
        listStatus: 'IN_LIST',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = await repository.importPlayers([
        { name: 'Mario Rossi', team: 'Inter', position: 'A', quotation: 25 },
      ])

      expect(result.imported).toBe(0)
      expect(result.updated).toBe(1)
    })

    it('should handle invalid positions', async () => {
      const result = await repository.importPlayers([
        { name: 'Mario Rossi', team: 'Inter', position: 'INVALID', quotation: 25 },
      ])

      expect(result.imported).toBe(0)
      expect(result.updated).toBe(0)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toContain('Invalid position')
    })

    it('should normalize position variations', async () => {
      vi.mocked(prisma.serieAPlayer.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.serieAPlayer.create).mockResolvedValue({
        id: 'player-1',
        name: 'Mario Rossi',
        team: 'Inter',
        position: 'A',
        quotation: 25,
        isActive: true,
        externalId: null,
        age: null,
        listStatus: 'IN_LIST',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      await repository.importPlayers([
        { name: 'Mario Rossi', team: 'Inter', position: 'ATT', quotation: 25 },
      ])

      expect(prisma.serieAPlayer.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          position: 'A',
        }),
      })
    })
  })
})

describe('AuditLogPrismaRepository', () => {
  let repository: AuditLogPrismaRepository

  const mockLog = {
    id: 'log-1',
    userId: 'user-1',
    leagueId: 'league-1',
    action: 'PHASE_CHANGED',
    entityType: 'MarketSession',
    entityId: 'session-1',
    oldValues: { phase: 'ASTA_LIBERA' },
    newValues: { phase: 'CONTRATTI' },
    ipAddress: '127.0.0.1',
    userAgent: 'Mozilla/5.0',
    createdAt: new Date('2024-01-01'),
    user: { username: 'user1' },
    league: { name: 'Test League' },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    repository = new AuditLogPrismaRepository()
  })

  describe('create', () => {
    it('should create a new audit log entry', async () => {
      vi.mocked(prisma.auditLog.create).mockResolvedValue(mockLog)

      await repository.create({
        userId: 'user-1',
        leagueId: 'league-1',
        action: 'PHASE_CHANGED',
        entityType: 'MarketSession',
        entityId: 'session-1',
        oldValues: { phase: 'ASTA_LIBERA' },
        newValues: { phase: 'CONTRATTI' },
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
      })

      expect(prisma.auditLog.create).toHaveBeenCalled()
    })
  })

  describe('findMany', () => {
    it('should return audit logs with filters', async () => {
      vi.mocked(prisma.auditLog.findMany).mockResolvedValue([mockLog])

      const result = await repository.findMany({
        leagueId: 'league-1',
        action: 'PHASE_CHANGED',
        limit: 10,
        offset: 0,
      })

      expect(result).toHaveLength(1)
      expect(result[0].action).toBe('PHASE_CHANGED')
      expect(result[0].user?.username).toBe('user1')
    })

    it('should filter by action', async () => {
      vi.mocked(prisma.auditLog.findMany).mockResolvedValue([mockLog])

      await repository.findMany({
        leagueId: 'league-1',
        action: 'PHASE_CHANGED',
      })

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            leagueId: 'league-1',
            action: 'PHASE_CHANGED',
          },
        })
      )
    })
  })

  describe('findById', () => {
    it('should return audit log when found', async () => {
      vi.mocked(prisma.auditLog.findUnique).mockResolvedValue(mockLog)

      const result = await repository.findById('log-1')

      expect(result).not.toBeNull()
      expect(result?.action).toBe('PHASE_CHANGED')
    })

    it('should return null when log not found', async () => {
      vi.mocked(prisma.auditLog.findUnique).mockResolvedValue(null)

      const result = await repository.findById('non-existent')

      expect(result).toBeNull()
    })
  })
})
