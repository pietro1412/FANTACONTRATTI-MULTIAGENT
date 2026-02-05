/**
 * League Prisma Repository Tests
 *
 * Tests for the LeaguePrismaRepository implementation using mocked Prisma client.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { LeaguePrismaRepository } from '../repositories/league.prisma-repository'

// Mock the Prisma client
vi.mock('@/lib/prisma', () => ({
  prisma: {
    league: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    leagueMember: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'

describe('LeaguePrismaRepository', () => {
  let repository: LeaguePrismaRepository

  const mockPrismaLeague = {
    id: 'league-123',
    name: 'Test League',
    description: 'A test league',
    maxParticipants: 10,
    minParticipants: 6,
    requireEvenNumber: true,
    initialBudget: 500,
    goalkeeperSlots: 3,
    defenderSlots: 8,
    midfielderSlots: 8,
    forwardSlots: 6,
    status: 'DRAFT' as const,
    currentSeason: 1,
    inviteCode: 'ABC123',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
  }

  const mockPrismaUser = {
    id: 'user-123',
    email: 'test@example.com',
    username: 'testuser',
    profilePhoto: null,
  }

  const mockPrismaMember = {
    id: 'member-123',
    leagueId: 'league-123',
    userId: 'user-123',
    teamName: 'Test Team',
    currentBudget: 500,
    preConsolidationBudget: null,
    role: 'ADMIN' as const,
    status: 'ACTIVE' as const,
    joinType: 'CREATOR' as const,
    rubataOrder: null,
    firstMarketOrder: null,
    joinedAt: new Date('2024-01-01T00:00:00Z'),
  }

  beforeEach(() => {
    repository = new LeaguePrismaRepository()
    vi.clearAllMocks()
  })

  describe('findById', () => {
    it('should return league when found', async () => {
      vi.mocked(prisma.league.findUnique).mockResolvedValue(mockPrismaLeague)

      const result = await repository.findById('league-123')

      expect(prisma.league.findUnique).toHaveBeenCalledWith({
        where: { id: 'league-123' }
      })
      expect(result).toEqual({
        id: 'league-123',
        name: 'Test League',
        description: 'A test league',
        adminId: '',
        maxMembers: 10,
        minMembers: 6,
        initialBudget: 500,
        maxPlayersPerRole: {
          P: 3,
          D: 8,
          C: 8,
          A: 6,
        },
        status: 'DRAFT',
        currentSeason: 1,
        inviteCode: 'ABC123',
        createdAt: mockPrismaLeague.createdAt,
      })
    })

    it('should return null when league not found', async () => {
      vi.mocked(prisma.league.findUnique).mockResolvedValue(null)

      const result = await repository.findById('nonexistent-id')

      expect(result).toBeNull()
    })
  })

  describe('findByInviteCode', () => {
    it('should return league when found', async () => {
      vi.mocked(prisma.league.findUnique).mockResolvedValue(mockPrismaLeague)

      const result = await repository.findByInviteCode('ABC123')

      expect(prisma.league.findUnique).toHaveBeenCalledWith({
        where: { inviteCode: 'ABC123' }
      })
      expect(result).not.toBeNull()
      expect(result?.inviteCode).toBe('ABC123')
    })

    it('should return null when invite code not found', async () => {
      vi.mocked(prisma.league.findUnique).mockResolvedValue(null)

      const result = await repository.findByInviteCode('INVALID')

      expect(result).toBeNull()
    })
  })

  describe('findByUserId', () => {
    it('should return all leagues user is member of', async () => {
      vi.mocked(prisma.leagueMember.findMany).mockResolvedValue([
        { ...mockPrismaMember, league: mockPrismaLeague }
      ] as any)

      const result = await repository.findByUserId('user-123')

      expect(prisma.leagueMember.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        include: { league: true }
      })
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('league-123')
    })

    it('should return empty array when user has no memberships', async () => {
      vi.mocked(prisma.leagueMember.findMany).mockResolvedValue([])

      const result = await repository.findByUserId('user-456')

      expect(result).toEqual([])
    })
  })

  describe('create', () => {
    it('should create a new league with defaults', async () => {
      vi.mocked(prisma.league.create).mockResolvedValue(mockPrismaLeague)

      const result = await repository.create({
        name: 'New League',
        adminId: 'user-123',
      })

      expect(prisma.league.create).toHaveBeenCalledWith({
        data: {
          name: 'New League',
          description: undefined,
          maxParticipants: 20,
          minParticipants: 6,
          initialBudget: 500,
          goalkeeperSlots: 3,
          defenderSlots: 8,
          midfielderSlots: 8,
          forwardSlots: 6,
          status: 'DRAFT',
          currentSeason: 1,
        }
      })
      expect(result.name).toBe('Test League')
    })

    it('should create a league with custom settings', async () => {
      vi.mocked(prisma.league.create).mockResolvedValue({
        ...mockPrismaLeague,
        maxParticipants: 8,
        initialBudget: 300,
      })

      await repository.create({
        name: 'Custom League',
        description: 'My custom league',
        adminId: 'user-123',
        maxMembers: 8,
        initialBudget: 300,
        maxPlayersPerRole: { P: 2, D: 6 },
      })

      expect(prisma.league.create).toHaveBeenCalledWith({
        data: {
          name: 'Custom League',
          description: 'My custom league',
          maxParticipants: 8,
          minParticipants: 6,
          initialBudget: 300,
          goalkeeperSlots: 2,
          defenderSlots: 6,
          midfielderSlots: 8,
          forwardSlots: 6,
          status: 'DRAFT',
          currentSeason: 1,
        }
      })
    })
  })

  describe('addMember', () => {
    it('should add a new member to a league', async () => {
      vi.mocked(prisma.leagueMember.create).mockResolvedValue(mockPrismaMember)

      const result = await repository.addMember({
        leagueId: 'league-123',
        userId: 'user-123',
        teamName: 'Test Team',
        role: 'ADMIN',
        status: 'ACTIVE',
        joinType: 'CREATOR',
        initialBudget: 500,
      })

      expect(prisma.leagueMember.create).toHaveBeenCalledWith({
        data: {
          leagueId: 'league-123',
          userId: 'user-123',
          teamName: 'Test Team',
          role: 'ADMIN',
          status: 'ACTIVE',
          joinType: 'CREATOR',
          currentBudget: 500,
        }
      })
      expect(result).toEqual({
        id: 'member-123',
        leagueId: 'league-123',
        userId: 'user-123',
        teamName: 'Test Team',
        budget: 500,
        role: 'ADMIN',
        status: 'ACTIVE',
        joinType: 'CREATOR',
        joinedAt: mockPrismaMember.joinedAt,
      })
    })
  })

  describe('getMember', () => {
    it('should return member when found', async () => {
      vi.mocked(prisma.leagueMember.findUnique).mockResolvedValue(mockPrismaMember)

      const result = await repository.getMember('league-123', 'user-123')

      expect(prisma.leagueMember.findUnique).toHaveBeenCalledWith({
        where: {
          userId_leagueId: {
            userId: 'user-123',
            leagueId: 'league-123'
          }
        }
      })
      expect(result).not.toBeNull()
      expect(result?.id).toBe('member-123')
    })

    it('should return null when member not found', async () => {
      vi.mocked(prisma.leagueMember.findUnique).mockResolvedValue(null)

      const result = await repository.getMember('league-123', 'user-456')

      expect(result).toBeNull()
    })
  })

  describe('getMembers', () => {
    it('should return all members with user info', async () => {
      vi.mocked(prisma.leagueMember.findMany).mockResolvedValue([
        { ...mockPrismaMember, user: mockPrismaUser }
      ] as any)

      const result = await repository.getMembers('league-123')

      expect(prisma.leagueMember.findMany).toHaveBeenCalledWith({
        where: { leagueId: 'league-123' },
        include: { user: true }
      })
      expect(result).toHaveLength(1)
      expect(result[0].user.username).toBe('testuser')
    })
  })

  describe('getActiveMemberCount', () => {
    it('should return count of active members', async () => {
      vi.mocked(prisma.leagueMember.count).mockResolvedValue(5)

      const result = await repository.getActiveMemberCount('league-123')

      expect(prisma.leagueMember.count).toHaveBeenCalledWith({
        where: {
          leagueId: 'league-123',
          status: 'ACTIVE'
        }
      })
      expect(result).toBe(5)
    })
  })

  describe('updateMemberBudget', () => {
    it('should update member budget', async () => {
      vi.mocked(prisma.leagueMember.update).mockResolvedValue(mockPrismaMember)

      await repository.updateMemberBudget('member-123', 300)

      expect(prisma.leagueMember.update).toHaveBeenCalledWith({
        where: { id: 'member-123' },
        data: { currentBudget: 300 }
      })
    })
  })

  describe('memberExists', () => {
    it('should return true when member exists', async () => {
      vi.mocked(prisma.leagueMember.findUnique).mockResolvedValue(mockPrismaMember)

      const result = await repository.memberExists('league-123', 'user-123')

      expect(result).toBe(true)
    })

    it('should return false when member does not exist', async () => {
      vi.mocked(prisma.leagueMember.findUnique).mockResolvedValue(null)

      const result = await repository.memberExists('league-123', 'user-456')

      expect(result).toBe(false)
    })
  })
})
