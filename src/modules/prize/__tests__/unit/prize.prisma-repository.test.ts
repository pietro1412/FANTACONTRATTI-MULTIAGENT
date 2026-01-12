/**
 * Prize Prisma Repository Tests
 *
 * Unit tests for PrizePrismaRepository with mocked Prisma client.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PrizePrismaRepository } from '../../infrastructure/repositories/prize.prisma-repository'

// Mock Prisma client
vi.mock('@/lib/prisma', () => ({
  prisma: {
    prizePhaseConfig: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    prizeCategory: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    sessionPrize: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
    marketSession: {
      findUnique: vi.fn(),
    },
    leagueMember: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

import { prisma } from '@/lib/prisma'

describe('PrizePrismaRepository', () => {
  let repository: PrizePrismaRepository

  const mockConfig = {
    id: 'config-1',
    marketSessionId: 'session-1',
    baseReincrement: 100,
    isFinalized: false,
    finalizedAt: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  }

  const mockCategory = {
    id: 'category-1',
    marketSessionId: 'session-1',
    name: 'Capocannoniere',
    isSystemPrize: false,
    createdAt: new Date('2024-01-01'),
  }

  const mockPrize = {
    id: 'prize-1',
    prizeCategoryId: 'category-1',
    leagueMemberId: 'member-1',
    amount: 50,
    createdAt: new Date('2024-01-01'),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    repository = new PrizePrismaRepository()
  })

  describe('getConfig', () => {
    it('should return config when found', async () => {
      vi.mocked(prisma.prizePhaseConfig.findUnique).mockResolvedValue(mockConfig)

      const result = await repository.getConfig('session-1')

      expect(result).not.toBeNull()
      expect(result?.sessionId).toBe('session-1')
      expect(result?.baseReincrement).toBe(100)
      expect(result?.status).toBe('IN_PROGRESS')
      expect(prisma.prizePhaseConfig.findUnique).toHaveBeenCalledWith({
        where: { marketSessionId: 'session-1' },
      })
    })

    it('should return null when config not found', async () => {
      vi.mocked(prisma.prizePhaseConfig.findUnique).mockResolvedValue(null)

      const result = await repository.getConfig('non-existent')

      expect(result).toBeNull()
    })

    it('should return FINALIZED status when isFinalized is true', async () => {
      vi.mocked(prisma.prizePhaseConfig.findUnique).mockResolvedValue({
        ...mockConfig,
        isFinalized: true,
        finalizedAt: new Date('2024-01-02'),
      })

      const result = await repository.getConfig('session-1')

      expect(result?.status).toBe('FINALIZED')
    })
  })

  describe('createConfig', () => {
    it('should create a new config', async () => {
      vi.mocked(prisma.prizePhaseConfig.create).mockResolvedValue(mockConfig)

      const result = await repository.createConfig({
        sessionId: 'session-1',
        baseReincrement: 100,
      })

      expect(result.sessionId).toBe('session-1')
      expect(prisma.prizePhaseConfig.create).toHaveBeenCalledWith({
        data: {
          marketSessionId: 'session-1',
          baseReincrement: 100,
          isFinalized: false,
        },
      })
    })

    it('should use default baseReincrement when not provided', async () => {
      vi.mocked(prisma.prizePhaseConfig.create).mockResolvedValue(mockConfig)

      await repository.createConfig({
        sessionId: 'session-1',
      })

      expect(prisma.prizePhaseConfig.create).toHaveBeenCalledWith({
        data: {
          marketSessionId: 'session-1',
          baseReincrement: 100,
          isFinalized: false,
        },
      })
    })
  })

  describe('updateConfig', () => {
    it('should update config status to finalized', async () => {
      vi.mocked(prisma.prizePhaseConfig.update).mockResolvedValue({
        ...mockConfig,
        isFinalized: true,
      })

      await repository.updateConfig('session-1', {
        status: 'FINALIZED',
        finalizedAt: new Date('2024-01-02'),
      })

      expect(prisma.prizePhaseConfig.update).toHaveBeenCalledWith({
        where: { marketSessionId: 'session-1' },
        data: expect.objectContaining({
          isFinalized: true,
        }),
      })
    })
  })

  describe('getCategoriesForSession', () => {
    it('should return categories for a session', async () => {
      vi.mocked(prisma.prizeCategory.findMany).mockResolvedValue([mockCategory])

      const result = await repository.getCategoriesForSession('session-1')

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('Capocannoniere')
      expect(result[0].isCustom).toBe(true)
    })
  })

  describe('createCategory', () => {
    it('should create a new category', async () => {
      vi.mocked(prisma.prizeCategory.create).mockResolvedValue(mockCategory)

      const result = await repository.createCategory({
        sessionId: 'session-1',
        name: 'Capocannoniere',
        isCustom: true,
      })

      expect(result.name).toBe('Capocannoniere')
      expect(prisma.prizeCategory.create).toHaveBeenCalled()
    })
  })

  describe('deleteCategory', () => {
    it('should delete a category', async () => {
      vi.mocked(prisma.prizeCategory.delete).mockResolvedValue(mockCategory)

      await repository.deleteCategory('category-1')

      expect(prisma.prizeCategory.delete).toHaveBeenCalledWith({
        where: { id: 'category-1' },
      })
    })
  })

  describe('getCategoryById', () => {
    it('should return category when found', async () => {
      vi.mocked(prisma.prizeCategory.findUnique).mockResolvedValue(mockCategory)

      const result = await repository.getCategoryById('category-1')

      expect(result).not.toBeNull()
      expect(result?.id).toBe('category-1')
    })

    it('should return null when category not found', async () => {
      vi.mocked(prisma.prizeCategory.findUnique).mockResolvedValue(null)

      const result = await repository.getCategoryById('non-existent')

      expect(result).toBeNull()
    })
  })

  describe('getPrizes', () => {
    it('should return all prizes for a session', async () => {
      vi.mocked(prisma.sessionPrize.findMany).mockResolvedValue([
        { ...mockPrize, prizeCategory: mockCategory },
      ])

      const result = await repository.getPrizes('session-1')

      expect(result).toHaveLength(1)
      expect(result[0].amount).toBe(50)
    })
  })

  describe('assignPrize', () => {
    it('should assign a prize to a member', async () => {
      vi.mocked(prisma.sessionPrize.upsert).mockResolvedValue(mockPrize)

      const result = await repository.assignPrize({
        categoryId: 'category-1',
        memberId: 'member-1',
        amount: 50,
        assignedBy: 'admin-1',
      })

      expect(result.amount).toBe(50)
      expect(prisma.sessionPrize.upsert).toHaveBeenCalledWith({
        where: {
          prizeCategoryId_leagueMemberId: {
            prizeCategoryId: 'category-1',
            leagueMemberId: 'member-1',
          },
        },
        update: { amount: 50 },
        create: {
          prizeCategoryId: 'category-1',
          leagueMemberId: 'member-1',
          amount: 50,
        },
      })
    })
  })

  describe('unassignPrize', () => {
    it('should remove a prize assignment', async () => {
      vi.mocked(prisma.sessionPrize.delete).mockResolvedValue(mockPrize)

      await repository.unassignPrize('category-1', 'member-1')

      expect(prisma.sessionPrize.delete).toHaveBeenCalledWith({
        where: {
          prizeCategoryId_leagueMemberId: {
            prizeCategoryId: 'category-1',
            leagueMemberId: 'member-1',
          },
        },
      })
    })
  })

  describe('getPrize', () => {
    it('should return specific prize assignment', async () => {
      vi.mocked(prisma.sessionPrize.findUnique).mockResolvedValue(mockPrize)

      const result = await repository.getPrize('category-1', 'member-1')

      expect(result).not.toBeNull()
      expect(result?.amount).toBe(50)
    })

    it('should return null when prize not found', async () => {
      vi.mocked(prisma.sessionPrize.findUnique).mockResolvedValue(null)

      const result = await repository.getPrize('category-1', 'non-existent')

      expect(result).toBeNull()
    })
  })

  describe('getSession', () => {
    it('should return session info', async () => {
      vi.mocked(prisma.marketSession.findUnique).mockResolvedValue({
        id: 'session-1',
        leagueId: 'league-1',
        status: 'ACTIVE',
        type: 'MERCATO_RICORRENTE',
        season: 1,
        semester: 1,
        currentPhase: 'PREMI',
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

      const result = await repository.getSession('session-1')

      expect(result).not.toBeNull()
      expect(result?.leagueId).toBe('league-1')
    })
  })

  describe('getActiveMembers', () => {
    it('should return all active members for a league', async () => {
      vi.mocked(prisma.leagueMember.findMany).mockResolvedValue([
        {
          id: 'member-1',
          userId: 'user-1',
          leagueId: 'league-1',
          teamName: 'Team A',
          role: 'MANAGER',
          status: 'ACTIVE',
          joinType: 'REQUEST',
          currentBudget: 100,
          rubataOrder: null,
          firstMarketOrder: null,
          joinedAt: new Date(),
          user: { username: 'user1' },
        },
      ])

      const result = await repository.getActiveMembers('league-1')

      expect(result).toHaveLength(1)
      expect(result[0].teamName).toBe('Team A')
      expect(result[0].currentBudget).toBe(100)
    })
  })

  describe('updateMemberBudget', () => {
    it('should update member budget', async () => {
      vi.mocked(prisma.leagueMember.update).mockResolvedValue({
        id: 'member-1',
        userId: 'user-1',
        leagueId: 'league-1',
        teamName: 'Team A',
        role: 'MANAGER',
        status: 'ACTIVE',
        joinType: 'REQUEST',
        currentBudget: 150,
        rubataOrder: null,
        firstMarketOrder: null,
        joinedAt: new Date(),
      })

      const result = await repository.updateMemberBudget('member-1', 50)

      expect(result).toBe(150)
      expect(prisma.leagueMember.update).toHaveBeenCalledWith({
        where: { id: 'member-1' },
        data: { currentBudget: { increment: 50 } },
      })
    })
  })

  describe('areAllRequiredCategoriesAssigned', () => {
    it('should return true when config exists', async () => {
      vi.mocked(prisma.prizePhaseConfig.findUnique).mockResolvedValue(mockConfig)

      const result = await repository.areAllRequiredCategoriesAssigned('session-1')

      expect(result).toBe(true)
    })

    it('should return false when config does not exist', async () => {
      vi.mocked(prisma.prizePhaseConfig.findUnique).mockResolvedValue(null)

      const result = await repository.areAllRequiredCategoriesAssigned('session-1')

      expect(result).toBe(false)
    })
  })
})
