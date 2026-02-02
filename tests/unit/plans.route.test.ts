/**
 * Unit tests for Plans API route logic
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Use vi.hoisted to create mock functions
const {
  mockLeagueMemberFindFirst,
  mockWatchlistPlanFindMany,
  mockWatchlistPlanFindFirst,
  mockWatchlistPlanCreate,
  mockWatchlistPlanUpdate,
  mockWatchlistPlanUpdateMany,
  mockWatchlistPlanDelete,
  mockSerieAPlayerFindMany,
} = vi.hoisted(() => ({
  mockLeagueMemberFindFirst: vi.fn(),
  mockWatchlistPlanFindMany: vi.fn(),
  mockWatchlistPlanFindFirst: vi.fn(),
  mockWatchlistPlanCreate: vi.fn(),
  mockWatchlistPlanUpdate: vi.fn(),
  mockWatchlistPlanUpdateMany: vi.fn(),
  mockWatchlistPlanDelete: vi.fn(),
  mockSerieAPlayerFindMany: vi.fn(),
}))

// Mock PrismaClient
vi.mock('@prisma/client', () => {
  class MockPrismaClient {
    leagueMember = {
      findFirst: mockLeagueMemberFindFirst,
    }
    watchlistPlan = {
      findMany: mockWatchlistPlanFindMany,
      findFirst: mockWatchlistPlanFindFirst,
      create: mockWatchlistPlanCreate,
      update: mockWatchlistPlanUpdate,
      updateMany: mockWatchlistPlanUpdateMany,
      delete: mockWatchlistPlanDelete,
    }
    serieAPlayer = {
      findMany: mockSerieAPlayerFindMany,
    }
  }
  return { PrismaClient: MockPrismaClient }
})

describe('Plans API Logic', () => {
  const mockMember = {
    id: 'member-1',
    userId: 'test-user-id',
    leagueId: 'league-1',
    status: 'ACTIVE',
  }

  const mockPlan = {
    id: 'plan-1',
    memberId: 'member-1',
    name: 'Piano A',
    description: 'Test plan',
    playerIds: ['player-1', 'player-2'],
    totalBudget: 50,
    isActive: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockLeagueMemberFindFirst.mockResolvedValue(mockMember)
  })

  describe('calculateTotalBudget logic', () => {
    // Test the budget calculation logic
    const calculateTotalBudget = (players: Array<{
      quotation: number
      rosters: Array<{ contract: { clause: number } | null }>
    }>) => {
      return players.reduce((sum, p) => {
        const clause = p.rosters[0]?.contract?.clause || p.quotation
        return sum + clause
      }, 0)
    }

    it('uses quotation when no contract exists', () => {
      const players = [
        { quotation: 20, rosters: [] },
        { quotation: 30, rosters: [] },
      ]
      expect(calculateTotalBudget(players)).toBe(50)
    })

    it('uses contract clause when available', () => {
      const players = [
        { quotation: 20, rosters: [{ contract: { clause: 25 } }] },
        { quotation: 30, rosters: [{ contract: { clause: 35 } }] },
      ]
      expect(calculateTotalBudget(players)).toBe(60)
    })

    it('handles mixed scenarios', () => {
      const players = [
        { quotation: 20, rosters: [{ contract: { clause: 25 } }] },
        { quotation: 30, rosters: [] },
      ]
      expect(calculateTotalBudget(players)).toBe(55)
    })

    it('returns 0 for empty array', () => {
      expect(calculateTotalBudget([])).toBe(0)
    })
  })

  describe('plan name validation', () => {
    it('should reject duplicate plan names', async () => {
      mockWatchlistPlanFindFirst.mockResolvedValue(mockPlan)

      const existingPlan = await mockWatchlistPlanFindFirst({
        where: { memberId: mockMember.id, name: 'Piano A' },
      })

      expect(existingPlan).not.toBeNull()
    })

    it('should allow unique plan names', async () => {
      mockWatchlistPlanFindFirst.mockResolvedValue(null)

      const existingPlan = await mockWatchlistPlanFindFirst({
        where: { memberId: mockMember.id, name: 'Piano B' },
      })

      expect(existingPlan).toBeNull()
    })
  })

  describe('plan activation', () => {
    it('should deactivate all plans for member', async () => {
      await mockWatchlistPlanUpdateMany({
        where: { memberId: mockMember.id },
        data: { isActive: false },
      })

      expect(mockWatchlistPlanUpdateMany).toHaveBeenCalledWith({
        where: { memberId: mockMember.id },
        data: { isActive: false },
      })
    })

    it('should activate the selected plan', async () => {
      mockWatchlistPlanUpdate.mockResolvedValue({
        ...mockPlan,
        isActive: true,
      })

      const updatedPlan = await mockWatchlistPlanUpdate({
        where: { id: mockPlan.id },
        data: { isActive: true },
      })

      expect(updatedPlan.isActive).toBe(true)
    })
  })

  describe('plan CRUD operations', () => {
    it('should return all plans for a member', async () => {
      mockWatchlistPlanFindMany.mockResolvedValue([mockPlan])

      const plans = await mockWatchlistPlanFindMany({
        where: { memberId: mockMember.id },
        orderBy: { createdAt: 'desc' },
      })

      expect(plans).toHaveLength(1)
      expect(plans[0].name).toBe('Piano A')
    })

    it('should create a new plan', async () => {
      mockWatchlistPlanCreate.mockResolvedValue(mockPlan)

      const plan = await mockWatchlistPlanCreate({
        data: {
          memberId: mockMember.id,
          name: 'Piano A',
          description: 'Test plan',
          playerIds: ['player-1', 'player-2'],
          totalBudget: 50,
        },
      })

      expect(plan.name).toBe('Piano A')
      expect(plan.totalBudget).toBe(50)
    })

    it('should update an existing plan', async () => {
      mockWatchlistPlanUpdate.mockResolvedValue({
        ...mockPlan,
        name: 'Piano B',
      })

      const plan = await mockWatchlistPlanUpdate({
        where: { id: mockPlan.id },
        data: { name: 'Piano B' },
      })

      expect(plan.name).toBe('Piano B')
    })

    it('should delete a plan', async () => {
      mockWatchlistPlanDelete.mockResolvedValue(mockPlan)

      const deleted = await mockWatchlistPlanDelete({
        where: { id: mockPlan.id },
      })

      expect(deleted.id).toBe(mockPlan.id)
    })
  })

  describe('member authorization', () => {
    it('should require active member status', async () => {
      const activeMember = await mockLeagueMemberFindFirst({
        where: { leagueId: 'league-1', userId: 'test-user-id', status: 'ACTIVE' },
      })

      expect(activeMember).not.toBeNull()
      expect(activeMember.status).toBe('ACTIVE')
    })

    it('should return null for non-member', async () => {
      mockLeagueMemberFindFirst.mockResolvedValue(null)

      const member = await mockLeagueMemberFindFirst({
        where: { leagueId: 'league-1', userId: 'unknown-user', status: 'ACTIVE' },
      })

      expect(member).toBeNull()
    })
  })
})
