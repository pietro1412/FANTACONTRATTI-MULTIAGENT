/**
 * Unit Tests for Simulatore Service
 *
 * Tests the simulator service functionality for calculating cessione analysis,
 * budget analysis, and replacement suggestions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Use vi.hoisted to create mock functions that are available when vi.mock runs
const { mockLeagueMemberFindFirst, mockPlayerRosterFindMany, mockSerieAPlayerFindUnique, mockSerieAPlayerFindMany } = vi.hoisted(() => ({
  mockLeagueMemberFindFirst: vi.fn(),
  mockPlayerRosterFindMany: vi.fn(),
  mockSerieAPlayerFindUnique: vi.fn(),
  mockSerieAPlayerFindMany: vi.fn(),
}))

// Mock PrismaClient before importing the service
vi.mock('@prisma/client', () => {
  // Use a class constructor as required by vitest
  class MockPrismaClient {
    leagueMember = {
      findFirst: mockLeagueMemberFindFirst,
    }
    playerRoster = {
      findMany: mockPlayerRosterFindMany,
    }
    serieAPlayer = {
      findUnique: mockSerieAPlayerFindUnique,
      findMany: mockSerieAPlayerFindMany,
    }
  }

  return {
    PrismaClient: MockPrismaClient,
    RosterStatus: {
      ACTIVE: 'ACTIVE',
      RELEASED: 'RELEASED',
      TRADED: 'TRADED',
    },
    MemberStatus: {
      ACTIVE: 'ACTIVE',
      PENDING: 'PENDING',
      SUSPENDED: 'SUSPENDED',
      LEFT: 'LEFT',
    },
    Position: {
      P: 'P',
      D: 'D',
      C: 'C',
      A: 'A',
    },
  }
})

// Mock contract service
vi.mock('../../src/services/contract.service', () => ({
  calculateRescissionClause: (salary: number, duration: number) => {
    const multipliers: Record<number, number> = { 4: 11, 3: 9, 2: 7, 1: 4 }
    return salary * (multipliers[duration] ?? 4)
  },
  calculateReleaseCost: (salary: number, duration: number) => {
    return Math.ceil((salary * duration) / 2)
  },
}))

// Import after mocks
import {
  getCessioneAnalysis,
  getBudgetAnalysis,
  getSostituti,
} from '../../src/services/simulatore.service'

describe('Simulatore Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getCessioneAnalysis', () => {
    it('should return error if user is not a member', async () => {
      mockLeagueMemberFindFirst.mockResolvedValue(null)

      const result = await getCessioneAnalysis('league1', 'user1')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non sei membro di questa lega')
    })

    it('should return empty array if no players with contracts', async () => {
      mockLeagueMemberFindFirst.mockResolvedValue({
        id: 'member1',
        currentBudget: 100,
      })
      mockPlayerRosterFindMany.mockResolvedValue([
        { player: { name: 'Player1', position: 'D' }, contract: null },
      ])

      const result = await getCessioneAnalysis('league1', 'user1')

      expect(result.success).toBe(true)
      expect(result.data).toEqual([])
    })

    it('should calculate correct rescission cost and budget impact', async () => {
      mockLeagueMemberFindFirst.mockResolvedValue({
        id: 'member1',
        currentBudget: 100,
      })
      mockPlayerRosterFindMany.mockResolvedValue([
        {
          id: 'roster1',
          player: {
            id: 'player1',
            name: 'Player1',
            position: 'D',
            team: 'Juventus',
            quotation: 50,
          },
          contract: {
            id: 'contract1',
            salary: 10,
            duration: 2, // rescission cost = (10 * 2) / 2 = 10
          },
        },
      ])

      const result = await getCessioneAnalysis('league1', 'user1')

      expect(result.success).toBe(true)
      const analyses = result.data as any[]
      expect(analyses).toHaveLength(1)

      const analysis = analyses[0]
      expect(analysis.player.name).toBe('Player1')
      expect(analysis.currentSalary).toBe(10)
      expect(analysis.currentDuration).toBe(2)
      expect(analysis.rescissionCost).toBe(10) // (10 * 2) / 2
      expect(analysis.budgetFreed).toBe(10) // salary freed
      expect(analysis.newBudget).toBe(100) // 100 - 10 + 10
    })

    it('should calculate positive budget impact for short contracts', async () => {
      mockLeagueMemberFindFirst.mockResolvedValue({
        id: 'member1',
        currentBudget: 100,
      })
      mockPlayerRosterFindMany.mockResolvedValue([
        {
          id: 'roster1',
          player: {
            id: 'player1',
            name: 'Player1',
            position: 'A',
            team: 'Milan',
            quotation: 30,
          },
          contract: {
            id: 'contract1',
            salary: 20, // high salary
            duration: 1, // short contract, cost = (20 * 1) / 2 = 10
          },
        },
      ])

      const result = await getCessioneAnalysis('league1', 'user1')

      expect(result.success).toBe(true)
      const analysis = (result.data as any[])[0]
      // Budget impact = salary freed - rescission cost = 20 - 10 = +10
      expect(analysis.rescissionCost).toBe(10)
      expect(analysis.budgetFreed).toBe(20)
      expect(analysis.newBudget).toBe(110) // 100 - 10 + 20
    })
  })

  describe('getBudgetAnalysis', () => {
    it('should return error if user is not a member', async () => {
      mockLeagueMemberFindFirst.mockResolvedValue(null)

      const result = await getBudgetAnalysis('league1', 'user1')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non sei membro di questa lega')
    })

    it('should calculate correct budget breakdown', async () => {
      mockLeagueMemberFindFirst.mockResolvedValue({
        id: 'member1',
        currentBudget: 150,
        league: {
          goalkeeperSlots: 3,
          defenderSlots: 8,
          midfielderSlots: 8,
          forwardSlots: 6,
        },
      })
      mockPlayerRosterFindMany.mockResolvedValue([
        {
          player: { position: 'P' },
          contract: { salary: 5, duration: 2 },
        },
        {
          player: { position: 'D' },
          contract: { salary: 10, duration: 3 },
        },
        {
          player: { position: 'D' },
          contract: { salary: 15, duration: 4 },
        },
      ])

      const result = await getBudgetAnalysis('league1', 'user1')

      expect(result.success).toBe(true)
      const budget = result.data as any

      expect(budget.currentBudget).toBe(150)
      expect(budget.totalSalary).toBe(30) // 5 + 10 + 15
      expect(budget.slotsByPosition.P.used).toBe(1)
      expect(budget.slotsByPosition.D.used).toBe(2)
      expect(budget.slotsByPosition.C.used).toBe(0)
      expect(budget.slotsByPosition.A.used).toBe(0)
      expect(budget.totalSlots.used).toBe(3)
      expect(budget.totalSlots.max).toBe(25) // 3 + 8 + 8 + 6
    })

    it('should include draft renewals impact', async () => {
      mockLeagueMemberFindFirst.mockResolvedValue({
        id: 'member1',
        currentBudget: 100,
        league: {
          goalkeeperSlots: 3,
          defenderSlots: 8,
          midfielderSlots: 8,
          forwardSlots: 6,
        },
      })
      mockPlayerRosterFindMany.mockResolvedValue([
        {
          player: { position: 'C' },
          contract: {
            salary: 10,
            duration: 2,
            draftSalary: 15, // draft renewal to 15/sem for 3 semesters
            draftDuration: 3,
          },
        },
      ])

      const result = await getBudgetAnalysis('league1', 'user1')

      expect(result.success).toBe(true)
      const budget = result.data as any

      // Current value: 10 * 2 = 20
      // Draft value: 15 * 3 = 45
      // Draft impact: 45 - 20 = 25
      expect(budget.draftRenewalsImpact).toBe(25)
      expect(budget.projectedBudget).toBe(75) // 100 - 25
      expect(budget.availableForPurchase).toBe(75)
    })
  })

  describe('getSostituti', () => {
    it('should return error if user is not a member', async () => {
      mockLeagueMemberFindFirst.mockResolvedValue(null)

      const result = await getSostituti('league1', 'player1', 'user1')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non sei membro di questa lega')
    })

    it('should return error if player not found', async () => {
      mockLeagueMemberFindFirst.mockResolvedValue({ id: 'member1' })
      mockSerieAPlayerFindUnique.mockResolvedValue(null)

      const result = await getSostituti('league1', 'nonexistent', 'user1')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Giocatore non trovato')
    })

    it('should return players of same position sorted by match score', async () => {
      mockLeagueMemberFindFirst.mockResolvedValue({ id: 'member1' })
      mockSerieAPlayerFindUnique.mockResolvedValue({
        id: 'player1',
        position: 'D',
        quotation: 50,
      })
      mockSerieAPlayerFindMany.mockResolvedValue([
        {
          id: 'player2',
          name: 'Alternative1',
          position: 'D',
          team: 'Inter',
          quotation: 48,
          apiFootballStats: { games: { rating: '7.5' } },
        },
        {
          id: 'player3',
          name: 'Alternative2',
          position: 'D',
          team: 'Milan',
          quotation: 30,
          apiFootballStats: null,
        },
      ])
      mockPlayerRosterFindMany.mockResolvedValue([])

      const result = await getSostituti('league1', 'player1', 'user1', 10)

      expect(result.success).toBe(true)
      const suggestions = result.data as any[]
      expect(suggestions).toHaveLength(2)

      // First should have higher match score (closer quotation + has rating)
      expect(suggestions[0].player.name).toBe('Alternative1')
      expect(suggestions[0].rating).toBe(7.5)
      expect(suggestions[0].isOwned).toBe(false)
    })

    it('should mark owned players correctly', async () => {
      mockLeagueMemberFindFirst.mockResolvedValue({ id: 'member1' })
      mockSerieAPlayerFindUnique.mockResolvedValue({
        id: 'player1',
        position: 'A',
        quotation: 40,
      })
      mockSerieAPlayerFindMany.mockResolvedValue([
        {
          id: 'player2',
          name: 'OwnedPlayer',
          position: 'A',
          team: 'Roma',
          quotation: 42,
          apiFootballStats: null,
        },
      ])
      mockPlayerRosterFindMany.mockResolvedValue([
        {
          playerId: 'player2',
          leagueMember: {
            id: 'member2',
            teamName: 'FC Rival',
          },
        },
      ])

      const result = await getSostituti('league1', 'player1', 'user1', 10)

      expect(result.success).toBe(true)
      const suggestions = result.data as any[]
      expect(suggestions[0].isOwned).toBe(true)
      expect(suggestions[0].ownerId).toBe('member2')
      expect(suggestions[0].ownerTeamName).toBe('FC Rival')
    })

    it('should filter by position correctly', async () => {
      mockLeagueMemberFindFirst.mockResolvedValue({ id: 'member1' })
      mockSerieAPlayerFindUnique.mockResolvedValue({
        id: 'player1',
        position: 'P', // Goalkeeper
        quotation: 20,
      })
      mockSerieAPlayerFindMany.mockResolvedValue([
        {
          id: 'player2',
          name: 'Goalkeeper1',
          position: 'P',
          team: 'Napoli',
          quotation: 18,
          apiFootballStats: null,
        },
      ])
      mockPlayerRosterFindMany.mockResolvedValue([])

      const result = await getSostituti('league1', 'player1', 'user1', 10)

      expect(result.success).toBe(true)
      // Verify the findMany query filter
      expect(mockSerieAPlayerFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            position: 'P',
            listStatus: 'IN_LIST',
          }),
        })
      )
    })
  })
})
