/**
 * Roster Prisma Repository Integration Tests
 *
 * Tests the RosterPrismaRepository with mocked Prisma client.
 * Uses vitest mocking to simulate database interactions.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { RosterPrismaRepository } from '../repositories/roster.prisma-repository'

// Mock the Prisma client
vi.mock('@/lib/prisma', () => ({
  prisma: {
    playerRoster: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    playerContract: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    leagueMember: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

// Import the mocked prisma after mocking
import { prisma } from '@/lib/prisma'

describe('RosterPrismaRepository', () => {
  let repository: RosterPrismaRepository

  // Mock Prisma data
  const mockPrismaRoster = {
    id: 'roster-1',
    leagueMemberId: 'member-1',
    playerId: 'player-1',
    acquisitionType: 'FIRST_MARKET' as const,
    acquisitionPrice: 50,
    status: 'ACTIVE' as const,
    acquiredAt: new Date('2024-01-01'),
    releasedAt: null,
    player: {
      id: 'player-1',
      name: 'Test Player',
      team: 'Test Team',
      position: 'C' as const,
      quotation: 10,
    },
    contract: null,
  }

  const mockPrismaContract = {
    id: 'contract-1',
    rosterId: 'roster-1',
    leagueMemberId: 'member-1',
    salary: 10,
    duration: 3,
    initialSalary: 10,
    initialDuration: 3,
    rescissionClause: 70, // 10 * 7 (multiplier for 3 years)
    draftSalary: null,
    draftDuration: null,
    draftReleased: false,
    draftExitDecision: null,
    preConsolidationSalary: null,
    preConsolidationDuration: null,
    signedAt: new Date('2024-01-01'),
    expiresAt: null,
    renewalHistory: null,
    roster: mockPrismaRoster,
  }

  beforeEach(() => {
    repository = new RosterPrismaRepository()
    vi.clearAllMocks()
  })

  describe('findByMemberId', () => {
    it('should return all active roster entries for a member', async () => {
      vi.mocked(prisma.playerRoster.findMany).mockResolvedValue([mockPrismaRoster])

      const result = await repository.findByMemberId('member-1')

      expect(prisma.playerRoster.findMany).toHaveBeenCalledWith({
        where: {
          leagueMemberId: 'member-1',
          status: 'ACTIVE',
        },
        include: {
          player: true,
          contract: true,
        },
        orderBy: {
          acquiredAt: 'desc',
        },
      })

      expect(result).toHaveLength(1)
      expect(result[0]!.id).toBe('roster-1')
      expect(result[0]!.acquisitionType).toBe('AUCTION') // Mapped from FIRST_MARKET
    })

    it('should return empty array when no rosters found', async () => {
      vi.mocked(prisma.playerRoster.findMany).mockResolvedValue([])

      const result = await repository.findByMemberId('member-999')

      expect(result).toEqual([])
    })
  })

  describe('findById', () => {
    it('should return roster entry by ID', async () => {
      vi.mocked(prisma.playerRoster.findUnique).mockResolvedValue(mockPrismaRoster)

      const result = await repository.findById('roster-1')

      expect(prisma.playerRoster.findUnique).toHaveBeenCalledWith({
        where: { id: 'roster-1' },
        include: {
          player: true,
          contract: true,
        },
      })

      expect(result).not.toBeNull()
      expect(result?.id).toBe('roster-1')
    })

    it('should return null when roster not found', async () => {
      vi.mocked(prisma.playerRoster.findUnique).mockResolvedValue(null)

      const result = await repository.findById('non-existent')

      expect(result).toBeNull()
    })
  })

  describe('getContract', () => {
    it('should return contract by roster ID', async () => {
      vi.mocked(prisma.playerContract.findUnique).mockResolvedValue(mockPrismaContract)

      const result = await repository.getContract('roster-1')

      expect(prisma.playerContract.findUnique).toHaveBeenCalledWith({
        where: { rosterId: 'roster-1' },
      })

      expect(result).not.toBeNull()
      expect(result?.salary).toBe(10)
      expect(result?.duration).toBe(3)
      expect(result?.clausola).toBe(70)
    })

    it('should return null when contract not found', async () => {
      vi.mocked(prisma.playerContract.findUnique).mockResolvedValue(null)

      const result = await repository.getContract('roster-no-contract')

      expect(result).toBeNull()
    })
  })

  describe('createRoster', () => {
    it('should create a new roster entry', async () => {
      const newRoster = {
        ...mockPrismaRoster,
        id: 'roster-new',
      }
      vi.mocked(prisma.playerRoster.create).mockResolvedValue(newRoster)

      const result = await repository.createRoster({
        leagueMemberId: 'member-1',
        playerId: 'player-1',
        acquisitionType: 'AUCTION',
        acquisitionPrice: 50,
      })

      expect(prisma.playerRoster.create).toHaveBeenCalledWith({
        data: {
          leagueMemberId: 'member-1',
          playerId: 'player-1',
          acquisitionType: 'FIRST_MARKET', // Mapped from AUCTION
          acquisitionPrice: 50,
          status: 'ACTIVE',
          acquiredAt: expect.any(Date),
        },
        include: {
          player: true,
          contract: true,
        },
      })

      expect(result.id).toBe('roster-new')
    })

    it('should map different acquisition types correctly', async () => {
      const newRoster = { ...mockPrismaRoster, id: 'roster-rubata', acquisitionType: 'RUBATA' as const }
      vi.mocked(prisma.playerRoster.create).mockResolvedValue(newRoster)

      await repository.createRoster({
        leagueMemberId: 'member-1',
        playerId: 'player-1',
        acquisitionType: 'RUBATA',
        acquisitionPrice: 30,
      })

      expect(prisma.playerRoster.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            acquisitionType: 'RUBATA',
          }),
        })
      )
    })
  })

  describe('createContract', () => {
    it('should create a new contract with calculated rescission clause', async () => {
      vi.mocked(prisma.playerRoster.findUnique).mockResolvedValue(mockPrismaRoster)
      vi.mocked(prisma.playerContract.create).mockResolvedValue(mockPrismaContract)

      const result = await repository.createContract({
        rosterId: 'roster-1',
        salary: 10,
        duration: 3,
      })

      expect(prisma.playerContract.create).toHaveBeenCalledWith({
        data: {
          rosterId: 'roster-1',
          leagueMemberId: 'member-1',
          salary: 10,
          duration: 3,
          initialSalary: 10,
          initialDuration: 3,
          rescissionClause: 70, // 10 * 7 (multiplier for 3 semesters)
        },
      })

      expect(result.salary).toBe(10)
      expect(result.clausola).toBe(70)
    })

    it('should throw error if roster not found', async () => {
      vi.mocked(prisma.playerRoster.findUnique).mockResolvedValue(null)

      await expect(
        repository.createContract({
          rosterId: 'non-existent',
          salary: 10,
          duration: 3,
        })
      ).rejects.toThrow('Roster not found')
    })

    it('should calculate correct rescission clause for different durations', async () => {
      vi.mocked(prisma.playerRoster.findUnique).mockResolvedValue(mockPrismaRoster)

      // Duration 1: multiplier = 3
      vi.mocked(prisma.playerContract.create).mockResolvedValue({
        ...mockPrismaContract,
        duration: 1,
        rescissionClause: 30,
      })

      await repository.createContract({
        rosterId: 'roster-1',
        salary: 10,
        duration: 1,
      })

      expect(prisma.playerContract.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            rescissionClause: 30, // 10 * 3
          }),
        })
      )
    })
  })

  describe('updateContract', () => {
    it('should update contract salary and recalculate rescission clause', async () => {
      vi.mocked(prisma.playerContract.findUnique).mockResolvedValue(mockPrismaContract)
      vi.mocked(prisma.playerContract.update).mockResolvedValue({
        ...mockPrismaContract,
        salary: 15,
        rescissionClause: 105, // 15 * 7
      })

      const result = await repository.updateContract('contract-1', {
        salary: 15,
      })

      expect(prisma.playerContract.update).toHaveBeenCalledWith({
        where: { id: 'contract-1' },
        data: expect.objectContaining({
          salary: 15,
          rescissionClause: 105,
        }),
      })

      expect(result.salary).toBe(15)
    })

    it('should throw error if contract not found', async () => {
      vi.mocked(prisma.playerContract.findUnique).mockResolvedValue(null)

      await expect(
        repository.updateContract('non-existent', { salary: 15 })
      ).rejects.toThrow('Contract not found')
    })
  })

  describe('releasePlayer', () => {
    it('should mark roster as released', async () => {
      vi.mocked(prisma.playerRoster.update).mockResolvedValue({
        ...mockPrismaRoster,
        status: 'RELEASED' as const,
        releasedAt: new Date(),
      })

      await repository.releasePlayer('roster-1')

      expect(prisma.playerRoster.update).toHaveBeenCalledWith({
        where: { id: 'roster-1' },
        data: {
          status: 'RELEASED',
          releasedAt: expect.any(Date),
        },
      })
    })
  })

  describe('findContractsByMemberId', () => {
    it('should return contracts with their roster info', async () => {
      vi.mocked(prisma.playerContract.findMany).mockResolvedValue([mockPrismaContract])

      const result = await repository.findContractsByMemberId('member-1')

      expect(prisma.playerContract.findMany).toHaveBeenCalledWith({
        where: {
          leagueMemberId: 'member-1',
          roster: {
            status: 'ACTIVE',
          },
        },
        include: {
          roster: {
            include: {
              player: true,
            },
          },
        },
        orderBy: {
          roster: {
            acquiredAt: 'desc',
          },
        },
      })

      expect(result).toHaveLength(1)
      expect(result[0]!.roster.id).toBe('roster-1')
      expect(result[0]!.contract.salary).toBe(10)
    })
  })

  describe('findConsolidationEligible', () => {
    it('should return contracts with duration >= 4', async () => {
      const eligibleContract = {
        ...mockPrismaContract,
        duration: 4,
      }
      vi.mocked(prisma.playerContract.findMany).mockResolvedValue([eligibleContract])

      const result = await repository.findConsolidationEligible('member-1')

      expect(prisma.playerContract.findMany).toHaveBeenCalledWith({
        where: {
          leagueMemberId: 'member-1',
          duration: {
            gte: 4,
          },
          roster: {
            status: 'ACTIVE',
          },
        },
      })

      expect(result).toHaveLength(1)
      expect(result[0]!.duration).toBe(4)
    })
  })

  describe('getMemberBudget', () => {
    it('should return member current budget', async () => {
      vi.mocked(prisma.leagueMember.findUnique).mockResolvedValue({
        id: 'member-1',
        currentBudget: 150,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- vi.mocked partial mock
      } as any)

      const result = await repository.getMemberBudget('member-1')

      expect(prisma.leagueMember.findUnique).toHaveBeenCalledWith({
        where: { id: 'member-1' },
        select: { currentBudget: true },
      })

      expect(result).toBe(150)
    })

    it('should throw error if member not found', async () => {
      vi.mocked(prisma.leagueMember.findUnique).mockResolvedValue(null)

      await expect(repository.getMemberBudget('non-existent')).rejects.toThrow('Member not found')
    })
  })

  describe('updateMemberBudget', () => {
    it('should increment member budget', async () => {
      vi.mocked(prisma.leagueMember.update).mockResolvedValue({
        id: 'member-1',
        currentBudget: 200,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- vi.mocked partial mock
      } as any)

      const result = await repository.updateMemberBudget('member-1', 50)

      expect(prisma.leagueMember.update).toHaveBeenCalledWith({
        where: { id: 'member-1' },
        data: {
          currentBudget: {
            increment: 50,
          },
        },
        select: { currentBudget: true },
      })

      expect(result).toBe(200)
    })

    it('should decrement member budget with negative amount', async () => {
      vi.mocked(prisma.leagueMember.update).mockResolvedValue({
        id: 'member-1',
        currentBudget: 100,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- vi.mocked partial mock
      } as any)

      const result = await repository.updateMemberBudget('member-1', -50)

      expect(prisma.leagueMember.update).toHaveBeenCalledWith({
        where: { id: 'member-1' },
        data: {
          currentBudget: {
            increment: -50,
          },
        },
        select: { currentBudget: true },
      })

      expect(result).toBe(100)
    })
  })

  describe('mapping functions', () => {
    it('should correctly map RUBATA acquisition type', async () => {
      const rubataRoster = {
        ...mockPrismaRoster,
        acquisitionType: 'RUBATA' as const,
      }
      vi.mocked(prisma.playerRoster.findMany).mockResolvedValue([rubataRoster])

      const result = await repository.findByMemberId('member-1')

      expect(result[0]!.acquisitionType).toBe('RUBATA')
    })

    it('should correctly map SVINCOLATI acquisition type', async () => {
      const svincolatiRoster = {
        ...mockPrismaRoster,
        acquisitionType: 'SVINCOLATI' as const,
      }
      vi.mocked(prisma.playerRoster.findMany).mockResolvedValue([svincolatiRoster])

      const result = await repository.findByMemberId('member-1')

      expect(result[0]!.acquisitionType).toBe('SVINCOLATI')
    })

    it('should correctly map TRADE acquisition type', async () => {
      const tradeRoster = {
        ...mockPrismaRoster,
        acquisitionType: 'TRADE' as const,
      }
      vi.mocked(prisma.playerRoster.findMany).mockResolvedValue([tradeRoster])

      const result = await repository.findByMemberId('member-1')

      expect(result[0]!.acquisitionType).toBe('TRADE')
    })
  })
})
