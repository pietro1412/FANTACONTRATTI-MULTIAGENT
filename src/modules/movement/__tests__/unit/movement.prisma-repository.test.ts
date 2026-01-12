/**
 * Movement Prisma Repository Tests
 *
 * Unit tests for MovementPrismaRepository and ProphecyPrismaRepository with mocked Prisma client.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MovementPrismaRepository, ProphecyPrismaRepository } from '../../infrastructure/repositories/movement.prisma-repository'

// Mock Prisma client
vi.mock('@/lib/prisma', () => ({
  prisma: {
    playerMovement: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    prophecy: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    leagueMember: {
      findUnique: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'

describe('MovementPrismaRepository', () => {
  let repository: MovementPrismaRepository

  const mockMovement = {
    id: 'movement-1',
    leagueId: 'league-1',
    playerId: 'player-1',
    movementType: 'FIRST_MARKET',
    fromMemberId: null,
    toMemberId: 'member-1',
    price: 10,
    oldSalary: null,
    oldDuration: null,
    oldClause: null,
    newSalary: 5,
    newDuration: 3,
    newClause: 20,
    auctionId: 'auction-1',
    tradeId: null,
    marketSessionId: 'session-1',
    createdAt: new Date('2024-01-01'),
    player: {
      id: 'player-1',
      name: 'Mario Rossi',
      position: 'A',
      team: 'Inter',
    },
    fromMember: null,
    toMember: {
      id: 'member-1',
      teamName: 'Team A',
      user: { username: 'user1' },
    },
    prophecies: [],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    repository = new MovementPrismaRepository()
  })

  describe('create', () => {
    it('should create a new movement record', async () => {
      vi.mocked(prisma.playerMovement.create).mockResolvedValue({
        id: 'movement-1',
        leagueId: 'league-1',
        playerId: 'player-1',
        movementType: 'FIRST_MARKET',
        fromMemberId: null,
        toMemberId: 'member-1',
        price: 10,
        oldSalary: null,
        oldDuration: null,
        oldClause: null,
        newSalary: 5,
        newDuration: 3,
        newClause: 20,
        auctionId: 'auction-1',
        tradeId: null,
        marketSessionId: 'session-1',
        createdAt: new Date(),
      })

      const result = await repository.create({
        leagueId: 'league-1',
        playerId: 'player-1',
        movementType: 'FIRST_MARKET',
        toMemberId: 'member-1',
        price: 10,
        newSalary: 5,
        newDuration: 3,
        newClause: 20,
        auctionId: 'auction-1',
        marketSessionId: 'session-1',
      })

      expect(result).toBe('movement-1')
      expect(prisma.playerMovement.create).toHaveBeenCalled()
    })

    it('should return null when creation fails', async () => {
      vi.mocked(prisma.playerMovement.create).mockRejectedValue(new Error('DB error'))

      const result = await repository.create({
        leagueId: 'league-1',
        playerId: 'player-1',
        movementType: 'FIRST_MARKET',
        toMemberId: 'member-1',
      })

      expect(result).toBeNull()
    })
  })

  describe('findById', () => {
    it('should return movement with details when found', async () => {
      vi.mocked(prisma.playerMovement.findUnique).mockResolvedValue(mockMovement)

      const result = await repository.findById('movement-1')

      expect(result).not.toBeNull()
      expect(result?.id).toBe('movement-1')
      expect(result?.playerId).toBe('player-1')
      expect(result?.newContract).toEqual({
        salary: 5,
        duration: 3,
        clause: 20,
      })
    })

    it('should return null when movement not found', async () => {
      vi.mocked(prisma.playerMovement.findUnique).mockResolvedValue(null)

      const result = await repository.findById('non-existent')

      expect(result).toBeNull()
    })
  })

  describe('findMany', () => {
    it('should return formatted movements with filters', async () => {
      vi.mocked(prisma.playerMovement.findMany).mockResolvedValue([mockMovement])

      const result = await repository.findMany({
        leagueId: 'league-1',
        limit: 10,
      })

      expect(result).toHaveLength(1)
      expect(result[0].player.name).toBe('Mario Rossi')
      expect(result[0].to?.teamName).toBe('Team A')
    })

    it('should filter by playerId', async () => {
      vi.mocked(prisma.playerMovement.findMany).mockResolvedValue([mockMovement])

      await repository.findMany({
        leagueId: 'league-1',
        playerId: 'player-1',
      })

      expect(prisma.playerMovement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            playerId: 'player-1',
          }),
        })
      )
    })

    it('should filter by memberId', async () => {
      vi.mocked(prisma.playerMovement.findMany).mockResolvedValue([mockMovement])

      await repository.findMany({
        leagueId: 'league-1',
        memberId: 'member-1',
      })

      expect(prisma.playerMovement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { fromMemberId: 'member-1' },
              { toMemberId: 'member-1' },
            ],
          }),
        })
      )
    })
  })

  describe('findByPlayer', () => {
    it('should return movements for a player', async () => {
      vi.mocked(prisma.playerMovement.findMany).mockResolvedValue([mockMovement])

      const result = await repository.findByPlayer('league-1', 'player-1')

      expect(result).toHaveLength(1)
      expect(prisma.playerMovement.findMany).toHaveBeenCalledWith({
        where: {
          leagueId: 'league-1',
          playerId: 'player-1',
        },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      })
    })
  })

  describe('findByMember', () => {
    it('should return movements for a member', async () => {
      vi.mocked(prisma.playerMovement.findMany).mockResolvedValue([mockMovement])

      const result = await repository.findByMember('league-1', 'member-1')

      expect(result).toHaveLength(1)
      expect(prisma.playerMovement.findMany).toHaveBeenCalledWith({
        where: {
          leagueId: 'league-1',
          OR: [{ fromMemberId: 'member-1' }, { toMemberId: 'member-1' }],
        },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      })
    })
  })

  describe('checkMembership', () => {
    it('should return member ID when user is active member', async () => {
      vi.mocked(prisma.leagueMember.findUnique).mockResolvedValue({
        id: 'member-1',
        status: 'ACTIVE',
        userId: 'user-1',
        leagueId: 'league-1',
        role: 'MANAGER',
        teamName: 'Team A',
        joinType: 'REQUEST',
        currentBudget: 100,
        rubataOrder: null,
        firstMarketOrder: null,
        joinedAt: new Date(),
      })

      const result = await repository.checkMembership('league-1', 'user-1')

      expect(result).toBe('member-1')
    })

    it('should return null when user is not active member', async () => {
      vi.mocked(prisma.leagueMember.findUnique).mockResolvedValue({
        id: 'member-1',
        status: 'PENDING',
        userId: 'user-1',
        leagueId: 'league-1',
        role: 'MANAGER',
        teamName: 'Team A',
        joinType: 'REQUEST',
        currentBudget: 100,
        rubataOrder: null,
        firstMarketOrder: null,
        joinedAt: new Date(),
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
})

describe('ProphecyPrismaRepository', () => {
  let repository: ProphecyPrismaRepository

  const mockProphecy = {
    id: 'prophecy-1',
    leagueId: 'league-1',
    playerId: 'player-1',
    authorId: 'member-1',
    movementId: 'movement-1',
    authorRole: 'BUYER',
    content: 'Great player!',
    createdAt: new Date('2024-01-01'),
    author: {
      id: 'member-1',
      teamName: 'Team A',
      user: { username: 'user1' },
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    repository = new ProphecyPrismaRepository()
  })

  describe('create', () => {
    it('should create a new prophecy', async () => {
      vi.mocked(prisma.prophecy.create).mockResolvedValue(mockProphecy)

      const result = await repository.create({
        leagueId: 'league-1',
        playerId: 'player-1',
        authorId: 'member-1',
        movementId: 'movement-1',
        authorRole: 'BUYER',
        content: 'Great player!',
      })

      expect(result.content).toBe('Great player!')
      expect(result.authorRole).toBe('BUYER')
      expect(prisma.prophecy.create).toHaveBeenCalled()
    })
  })

  describe('findByMovementAndAuthor', () => {
    it('should return prophecy when found', async () => {
      vi.mocked(prisma.prophecy.findUnique).mockResolvedValue(mockProphecy)

      const result = await repository.findByMovementAndAuthor('movement-1', 'member-1')

      expect(result).not.toBeNull()
      expect(result?.content).toBe('Great player!')
    })

    it('should return null when prophecy not found', async () => {
      vi.mocked(prisma.prophecy.findUnique).mockResolvedValue(null)

      const result = await repository.findByMovementAndAuthor('movement-1', 'non-existent')

      expect(result).toBeNull()
    })
  })

  describe('findByPlayer', () => {
    it('should return prophecies for a player', async () => {
      vi.mocked(prisma.prophecy.findMany).mockResolvedValue([mockProphecy])

      const result = await repository.findByPlayer('league-1', 'player-1')

      expect(result).toHaveLength(1)
      expect(prisma.prophecy.findMany).toHaveBeenCalledWith({
        where: {
          leagueId: 'league-1',
          playerId: 'player-1',
        },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      })
    })
  })

  describe('findByMovement', () => {
    it('should return prophecies for a movement', async () => {
      vi.mocked(prisma.prophecy.findMany).mockResolvedValue([mockProphecy])

      const result = await repository.findByMovement('movement-1')

      expect(result).toHaveLength(1)
      expect(prisma.prophecy.findMany).toHaveBeenCalledWith({
        where: { movementId: 'movement-1' },
        include: expect.any(Object),
        orderBy: { createdAt: 'asc' },
      })
    })
  })
})
