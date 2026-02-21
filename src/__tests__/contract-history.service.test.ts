/**
 * contract-history.service.test.ts - Unit Tests for Contract History Service
 *
 * Tests for contract history tracking, manager snapshots, and session summaries.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Hoist mock before imports
const { mockPrisma, MockPrismaClient } = vi.hoisted(() => {
  const mock = {
    contractHistory: {
      create: vi.fn(),
      createMany: vi.fn(),
      findMany: vi.fn(),
    },
    managerSessionSnapshot: {
      upsert: vi.fn(),
      findMany: vi.fn(),
    },
    leagueMember: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    playerContract: {
      findMany: vi.fn(),
    },
    marketSession: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
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
  RosterStatus: {
    ACTIVE: 'ACTIVE',
    RELEASED: 'RELEASED',
  },
}))

// Mock calculateReleaseCost from contract.service
vi.mock('../services/contract.service', () => ({
  calculateReleaseCost: (salary: number, duration: number) =>
    Math.ceil((salary * duration) / 2),
}))

// Import after mocking
import * as contractHistoryService from '../services/contract-history.service'

describe('Contract History Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ==================== createContractHistoryEntry ====================

  describe('createContractHistoryEntry', () => {
    it('creates a history entry and returns its id', async () => {
      mockPrisma.contractHistory.create.mockResolvedValue({ id: 'history-1' })

      const result = await contractHistoryService.createContractHistoryEntry({
        contractId: 'contract-1',
        playerId: 'player-1',
        leagueMemberId: 'member-1',
        marketSessionId: 'session-1',
        eventType: 'RENEWAL',
        previousSalary: 10,
        newSalary: 15,
      })

      expect(result).toBe('history-1')
      expect(mockPrisma.contractHistory.create).toHaveBeenCalledOnce()
    })

    it('returns null on database error', async () => {
      mockPrisma.contractHistory.create.mockRejectedValue(new Error('DB error'))

      const result = await contractHistoryService.createContractHistoryEntry({
        playerId: 'player-1',
        leagueMemberId: 'member-1',
        marketSessionId: 'session-1',
        eventType: 'RELEASE_NORMAL',
      })

      expect(result).toBeNull()
    })
  })

  // ==================== createContractHistoryEntries ====================

  describe('createContractHistoryEntries', () => {
    it('batch creates entries and returns count', async () => {
      mockPrisma.contractHistory.createMany.mockResolvedValue({ count: 3 })

      const inputs = [
        { playerId: 'p1', leagueMemberId: 'm1', marketSessionId: 's1', eventType: 'RENEWAL' as const },
        { playerId: 'p2', leagueMemberId: 'm1', marketSessionId: 's1', eventType: 'RELEASE_NORMAL' as const },
        { playerId: 'p3', leagueMemberId: 'm1', marketSessionId: 's1', eventType: 'SPALMA' as const },
      ]

      const result = await contractHistoryService.createContractHistoryEntries(inputs)

      expect(result).toBe(3)
      expect(mockPrisma.contractHistory.createMany).toHaveBeenCalledOnce()
    })

    it('returns 0 on database error', async () => {
      mockPrisma.contractHistory.createMany.mockRejectedValue(new Error('DB error'))

      const result = await contractHistoryService.createContractHistoryEntries([
        { playerId: 'p1', leagueMemberId: 'm1', marketSessionId: 's1', eventType: 'RENEWAL' as const },
      ])

      expect(result).toBe(0)
    })
  })

  // ==================== createManagerSnapshot ====================

  describe('createManagerSnapshot', () => {
    it('upserts a snapshot and returns its id', async () => {
      mockPrisma.managerSessionSnapshot.upsert.mockResolvedValue({ id: 'snapshot-1' })

      const result = await contractHistoryService.createManagerSnapshot({
        leagueMemberId: 'member-1',
        marketSessionId: 'session-1',
        snapshotType: 'SESSION_START',
        budget: 200,
        totalSalaries: 100,
        balance: 100,
        contractCount: 10,
      })

      expect(result).toBe('snapshot-1')
      expect(mockPrisma.managerSessionSnapshot.upsert).toHaveBeenCalledOnce()
    })

    it('returns null on database error', async () => {
      mockPrisma.managerSessionSnapshot.upsert.mockRejectedValue(new Error('DB error'))

      const result = await contractHistoryService.createManagerSnapshot({
        leagueMemberId: 'member-1',
        marketSessionId: 'session-1',
        snapshotType: 'SESSION_START',
        budget: 200,
        totalSalaries: 100,
        balance: 100,
        contractCount: 10,
      })

      expect(result).toBeNull()
    })
  })

  // ==================== createSessionStartSnapshots ====================

  describe('createSessionStartSnapshots', () => {
    it('creates snapshots for all active members', async () => {
      mockPrisma.leagueMember.findMany.mockResolvedValue([
        { id: 'member-1', currentBudget: 200 },
        { id: 'member-2', currentBudget: 150 },
      ])
      mockPrisma.playerContract.findMany.mockResolvedValue([
        { salary: 30 },
        { salary: 20 },
      ])
      mockPrisma.managerSessionSnapshot.upsert.mockResolvedValue({ id: 'snap-1' })

      const result = await contractHistoryService.createSessionStartSnapshots('session-1', 'league-1')

      expect(result.created).toBe(2)
      expect(result.failed).toBe(0)
    })

    it('counts failures when snapshot creation fails', async () => {
      mockPrisma.leagueMember.findMany.mockResolvedValue([
        { id: 'member-1', currentBudget: 200 },
      ])
      mockPrisma.playerContract.findMany.mockResolvedValue([])
      mockPrisma.managerSessionSnapshot.upsert.mockRejectedValue(new Error('DB error'))

      const result = await contractHistoryService.createSessionStartSnapshots('session-1', 'league-1')

      expect(result.created).toBe(0)
      expect(result.failed).toBe(1)
    })

    it('returns zeros when no members found', async () => {
      mockPrisma.leagueMember.findMany.mockResolvedValue([])

      const result = await contractHistoryService.createSessionStartSnapshots('session-1', 'league-1')

      expect(result.created).toBe(0)
      expect(result.failed).toBe(0)
    })
  })

  // ==================== getSessionContractHistory ====================

  describe('getSessionContractHistory', () => {
    it('returns error when user is not authorized', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue(null)

      const result = await contractHistoryService.getSessionContractHistory('session-1', 'member-1', 'user-1')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non sei autorizzato a vedere questo storico')
    })

    it('returns contract history when authorized', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'member-1' })
      mockPrisma.contractHistory.findMany.mockResolvedValue([
        {
          id: 'h1',
          eventType: 'RENEWAL',
          player: { id: 'p1', name: 'Leao', team: 'Milan', position: 'A' },
        },
      ])

      const result = await contractHistoryService.getSessionContractHistory('session-1', 'member-1', 'user-1')

      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(1)
    })
  })

  // ==================== getFullSessionContractHistory ====================

  describe('getFullSessionContractHistory', () => {
    it('returns error when user is not admin', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue(null)

      const result = await contractHistoryService.getFullSessionContractHistory('session-1', 'user-1', 'league-1')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Solo gli admin possono vedere lo storico completo')
    })

    it('returns full history for admin', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'member-1', role: 'ADMIN' })
      mockPrisma.contractHistory.findMany.mockResolvedValue([
        {
          id: 'h1',
          eventType: 'RENEWAL',
          player: { id: 'p1', name: 'Leao', team: 'Milan', position: 'A' },
          leagueMember: { user: { username: 'manager1' } },
        },
        {
          id: 'h2',
          eventType: 'RELEASE_NORMAL',
          player: { id: 'p2', name: 'Theo', team: 'Milan', position: 'D' },
          leagueMember: { user: { username: 'manager2' } },
        },
      ])

      const result = await contractHistoryService.getFullSessionContractHistory('session-1', 'user-1', 'league-1')

      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(2)
    })
  })

  // ==================== getManagerSessionSummary ====================

  describe('getManagerSessionSummary', () => {
    it('returns error when user is not authorized', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue(null)

      const result = await contractHistoryService.getManagerSessionSummary('session-1', 'member-1', 'user-1')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non sei autorizzato a vedere questo riepilogo')
    })

    it('returns session summary with computed totals', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({
        id: 'member-1',
        currentBudget: 180,
        teamName: 'Team Alpha',
        user: { username: 'manager1' },
      })
      mockPrisma.managerSessionSnapshot.findMany.mockResolvedValue([
        {
          snapshotType: 'SESSION_START',
          budget: 200,
          totalSalaries: 100,
          balance: 100,
          contractCount: 10,
        },
      ])
      mockPrisma.contractHistory.findMany.mockResolvedValue([
        { eventType: 'RELEASE_NORMAL', cost: 15, income: null, newSalary: null, previousSalary: null },
        { eventType: 'RENEWAL', cost: null, income: null, newSalary: 20, previousSalary: 10 },
        { eventType: 'RELEASE_ESTERO', cost: 0, income: 5, newSalary: null, previousSalary: null },
      ])
      mockPrisma.playerContract.findMany.mockResolvedValue([
        { salary: 20 },
        { salary: 30 },
        { salary: 25 },
      ])

      const result = await contractHistoryService.getManagerSessionSummary('session-1', 'member-1', 'user-1')

      expect(result.success).toBe(true)
      const data = result.data as Record<string, unknown>
      expect(data.managerName).toBe('manager1')
      expect(data.teamName).toBe('Team Alpha')
      expect(data.initialBudget).toBe(200)
      expect(data.totalIndemnities).toBe(5)
      expect(data.totalReleaseCosts).toBe(15)
      expect(data.totalRenewalCosts).toBe(10) // newSalary(20) - previousSalary(10)
      expect(data.currentSalaries).toBe(75) // 20+30+25
      expect(data.currentBalance).toBe(105) // 180-75
      expect(data.currentContractCount).toBe(3)
      expect(data.releasedCount).toBe(2)
      expect(data.renewedCount).toBe(1)
      expect(data.spalmaCount).toBe(0)
    })
  })

  // ==================== getContractPhaseProspetto ====================

  describe('getContractPhaseProspetto', () => {
    it('returns error when user is not a member', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue(null)

      const result = await contractHistoryService.getContractPhaseProspetto('league-1', 'user-1')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non sei membro di questa lega')
    })

    it('returns error when not in CONTRATTI phase', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'member-1' })
      mockPrisma.marketSession.findFirst.mockResolvedValue(null)

      const result = await contractHistoryService.getContractPhaseProspetto('league-1', 'user-1')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non siamo in fase CONTRATTI')
    })

    it('returns prospetto with computed values', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({
        id: 'member-1',
        currentBudget: 180,
      })
      mockPrisma.marketSession.findFirst.mockResolvedValue({
        id: 'session-1',
      })
      mockPrisma.managerSessionSnapshot.findMany.mockResolvedValue([
        {
          snapshotType: 'PHASE_START',
          budget: 200,
          totalSalaries: 100,
          contractCount: 10,
        },
      ])
      mockPrisma.contractHistory.findMany.mockResolvedValue([
        {
          id: 'e1',
          eventType: 'RELEASE_NORMAL',
          cost: 15,
          income: null,
          player: { name: 'Theo' },
          createdAt: new Date('2025-01-01'),
        },
        {
          id: 'e2',
          eventType: 'RENEWAL',
          cost: 5,
          income: null,
          previousSalary: 10,
          newSalary: 15,
          player: { name: 'Leao' },
          createdAt: new Date('2025-01-02'),
        },
      ])
      mockPrisma.playerContract.findMany.mockResolvedValue([
        {
          id: 'c1',
          salary: 15,
          duration: 2,
          draftReleased: false,
          draftSalary: null,
          draftDuration: null,
          roster: { player: { name: 'Leao', team: 'Milan', position: 'A' } },
        },
        {
          id: 'c2',
          salary: 20,
          duration: 3,
          draftReleased: false,
          draftSalary: null,
          draftDuration: null,
          roster: { player: { name: 'Lautaro', team: 'Inter', position: 'A' } },
        },
      ])

      const result = await contractHistoryService.getContractPhaseProspetto('league-1', 'user-1')

      expect(result.success).toBe(true)
      const data = result.data as Record<string, unknown>
      expect(data.budgetIniziale).toBe(200)
      expect(data.costiTagli).toBe(15)
      expect(data.costiRinnovi).toBe(5)
      expect(data.budgetAttuale).toBe(180)
      expect(data.ingaggiIniziali).toBe(100)
      expect(data.ingaggiAttuali).toBe(35) // 15+20
      expect(data.contrattiIniziali).toBe(10)
      expect(data.contrattiAttuali).toBe(2)
      expect(data.giocatoriTagliati).toBe(1)
      expect(data.contrattiRinnovati).toBe(1)
      expect(data.contrattiSpalmati).toBe(0)
    })

    it('includes draft release line items', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({
        id: 'member-1',
        currentBudget: 200,
      })
      mockPrisma.marketSession.findFirst.mockResolvedValue({ id: 'session-1' })
      mockPrisma.managerSessionSnapshot.findMany.mockResolvedValue([])
      mockPrisma.contractHistory.findMany.mockResolvedValue([])
      mockPrisma.playerContract.findMany.mockResolvedValue([
        {
          id: 'c1',
          salary: 20,
          duration: 2,
          draftReleased: true,
          draftSalary: null,
          draftDuration: null,
          roster: { player: { name: 'Theo', team: 'Milan', position: 'D' } },
        },
      ])

      const result = await contractHistoryService.getContractPhaseProspetto('league-1', 'user-1')

      expect(result.success).toBe(true)
      const data = result.data as Record<string, unknown>
      const lineItems = data.lineItems as Array<Record<string, unknown>>
      expect(lineItems).toHaveLength(1)
      expect(lineItems[0].description).toContain('[BOZZA] Taglio Theo')
      // calculateReleaseCost(20, 2) = ceil((20*2)/2) = 20
      expect(lineItems[0].debit).toBe(20)
    })
  })

  // ==================== getHistoricalSessionSummaries ====================

  describe('getHistoricalSessionSummaries', () => {
    it('returns error when user is not a member', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue(null)

      const result = await contractHistoryService.getHistoricalSessionSummaries('league-1', 'user-1')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non sei membro di questa lega')
    })

    it('returns historical session summaries with computed changes', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'member-1' })
      mockPrisma.marketSession.findMany.mockResolvedValue([
        { id: 'session-1', season: 2, semester: 1 },
      ])
      mockPrisma.managerSessionSnapshot.findMany.mockResolvedValue([
        { snapshotType: 'PHASE_START', budget: 200, totalSalaries: 100, balance: 100 },
        { snapshotType: 'PHASE_END', budget: 180, totalSalaries: 90, balance: 90 },
      ])
      mockPrisma.contractHistory.findMany.mockResolvedValue([
        {
          id: 'h1',
          eventType: 'RENEWAL',
          player: { id: 'p1', name: 'Leao', team: 'Milan', position: 'A' },
        },
      ])

      const result = await contractHistoryService.getHistoricalSessionSummaries('league-1', 'user-1')

      expect(result.success).toBe(true)
      const data = result.data as Array<Record<string, unknown>>
      expect(data).toHaveLength(1)
      expect(data[0].sessionName).toBe('Stagione 2 - Estate')
      expect(data[0].budgetChange).toBe(-20) // 180 - 200
      expect(data[0].salariesChange).toBe(-10) // 90 - 100
      expect(data[0].netChange).toBe(-10) // 90 - 100
    })

    it('returns zero changes when no snapshots available', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'member-1' })
      mockPrisma.marketSession.findMany.mockResolvedValue([
        { id: 'session-1', season: 1, semester: 2 },
      ])
      mockPrisma.managerSessionSnapshot.findMany.mockResolvedValue([])
      mockPrisma.contractHistory.findMany.mockResolvedValue([])

      const result = await contractHistoryService.getHistoricalSessionSummaries('league-1', 'user-1')

      expect(result.success).toBe(true)
      const data = result.data as Array<Record<string, unknown>>
      expect(data).toHaveLength(1)
      expect(data[0].sessionName).toBe('Stagione 1 - Inverno')
      expect(data[0].budgetChange).toBe(0)
      expect(data[0].salariesChange).toBe(0)
      expect(data[0].netChange).toBe(0)
    })
  })

  // ==================== createPhaseStartSnapshot ====================

  describe('createPhaseStartSnapshot', () => {
    it('creates PHASE_START snapshots for all active members', async () => {
      mockPrisma.leagueMember.findMany.mockResolvedValue([
        { id: 'member-1', currentBudget: 200 },
        { id: 'member-2', currentBudget: 150 },
      ])
      mockPrisma.playerContract.findMany.mockResolvedValue([{ salary: 30 }])
      mockPrisma.managerSessionSnapshot.upsert.mockResolvedValue({ id: 'snap-1' })

      const result = await contractHistoryService.createPhaseStartSnapshot('session-1', 'league-1')

      expect(result.created).toBe(2)
      expect(result.failed).toBe(0)
    })

    it('handles mixed success and failure', async () => {
      mockPrisma.leagueMember.findMany.mockResolvedValue([
        { id: 'member-1', currentBudget: 200 },
        { id: 'member-2', currentBudget: 150 },
      ])
      mockPrisma.playerContract.findMany.mockResolvedValue([])
      mockPrisma.managerSessionSnapshot.upsert
        .mockResolvedValueOnce({ id: 'snap-1' })
        .mockRejectedValueOnce(new Error('DB error'))

      const result = await contractHistoryService.createPhaseStartSnapshot('session-1', 'league-1')

      expect(result.created).toBe(1)
      expect(result.failed).toBe(1)
    })
  })

  // ==================== createPhaseEndSnapshot ====================

  describe('createPhaseEndSnapshot', () => {
    it('returns null when member not found', async () => {
      mockPrisma.leagueMember.findUnique.mockResolvedValue(null)

      const result = await contractHistoryService.createPhaseEndSnapshot('session-1', 'member-1')

      expect(result).toBeNull()
    })

    it('creates PHASE_END snapshot with computed totals', async () => {
      mockPrisma.leagueMember.findUnique.mockResolvedValue({
        id: 'member-1',
        currentBudget: 180,
      })
      mockPrisma.playerContract.findMany.mockResolvedValue([
        { salary: 20 },
        { salary: 25 },
      ])
      mockPrisma.contractHistory.findMany.mockResolvedValue([
        { eventType: 'RELEASE_ESTERO', cost: 0, income: 10, newSalary: null, previousSalary: null },
        { eventType: 'RELEASE_NORMAL', cost: 15, income: null, newSalary: null, previousSalary: null },
        { eventType: 'RENEWAL', cost: null, income: null, newSalary: 25, previousSalary: 20 },
        { eventType: 'AUTO_RELEASE_EXPIRED', cost: 0, income: null, newSalary: null, previousSalary: null },
      ])
      mockPrisma.managerSessionSnapshot.upsert.mockResolvedValue({ id: 'snap-end' })

      const result = await contractHistoryService.createPhaseEndSnapshot('session-1', 'member-1')

      expect(result).toBe('snap-end')
      // Verify the snapshot was created with correct computed values
      const upsertCall = mockPrisma.managerSessionSnapshot.upsert.mock.calls[0][0]
      expect(upsertCall.create.totalSalaries).toBe(45) // 20+25
      expect(upsertCall.create.balance).toBe(135) // 180-45
      expect(upsertCall.create.totalIndemnities).toBe(10) // only RELEASE_ESTERO income
      expect(upsertCall.create.totalReleaseCosts).toBe(15) // RELEASE_NORMAL cost
      expect(upsertCall.create.totalRenewalCosts).toBe(5) // 25-20
      expect(upsertCall.create.releasedCount).toBe(3) // RELEASE_ESTERO + RELEASE_NORMAL + AUTO_RELEASE_EXPIRED
      expect(upsertCall.create.renewedCount).toBe(1) // RENEWAL only
    })

    it('returns null on database error', async () => {
      mockPrisma.leagueMember.findUnique.mockRejectedValue(new Error('DB error'))

      const result = await contractHistoryService.createPhaseEndSnapshot('session-1', 'member-1')

      expect(result).toBeNull()
    })
  })
})
