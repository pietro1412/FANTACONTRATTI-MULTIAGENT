/**
 * contract.service.test.ts - Unit Tests for Contract Service
 *
 * Tests for the core contract management functions:
 * - Pure calculation functions (calculateRescissionClause, calculateReleaseCost, isValidRenewal, etc.)
 * - getContracts (returns contracts for a league member)
 * - saveDrafts (saves draft renewals, new contracts, releases)
 * - consolidateContracts (finalizes all drafts for a league member)
 * - createContract / renewContract / releasePlayer
 *
 * Creato il: 19/02/2026
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Hoist mock before imports
const { mockPrisma, MockPrismaClient } = vi.hoisted(() => {
  const mock = {
    leagueMember: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    marketSession: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    contractConsolidation: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
    },
    playerRoster: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    playerContract: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    draftContract: {
      upsert: vi.fn(),
    },
    prizeCategory: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    contractHistory: {
      findMany: vi.fn(),
    },
    playerMovement: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn((cb: unknown) => {
      if (typeof cb === 'function') {
        return (cb as (tx: typeof mock) => Promise<unknown>)(mock)
      }
      return Promise.resolve()
    }),
  }

  const MockClass = function (this: typeof mock) {
    Object.assign(this, mock)
  } as unknown as new () => typeof mock

  return { mockPrisma: mock, MockPrismaClient: MockClass }
})

// Mock Prisma
vi.mock('@prisma/client', () => ({
  PrismaClient: MockPrismaClient,
  MemberStatus: { ACTIVE: 'ACTIVE', INACTIVE: 'INACTIVE' },
  RosterStatus: { ACTIVE: 'ACTIVE', RELEASED: 'RELEASED' },
  AcquisitionType: { FIRST_MARKET: 'FIRST_MARKET', AUCTION: 'AUCTION', TRADE: 'TRADE', RUBATA: 'RUBATA', SVINCOLATI: 'SVINCOLATI' },
  MovementType: {
    RELEASE: 'RELEASE',
    CONTRACT_RENEW: 'CONTRACT_RENEW',
    ABROAD_COMPENSATION: 'ABROAD_COMPENSATION',
    RELEGATION_RELEASE: 'RELEGATION_RELEASE',
    ABROAD_KEEP: 'ABROAD_KEEP',
    RELEGATION_KEEP: 'RELEGATION_KEEP',
  },
}))

// Mock dependent services
vi.mock('../services/movement.service', () => ({
  recordMovement: vi.fn().mockResolvedValue('movement-1'),
}))

vi.mock('../services/contract-history.service', () => ({
  createContractHistoryEntries: vi.fn().mockResolvedValue(undefined),
  createPhaseEndSnapshot: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../services/player-stats.service', () => ({
  computeSeasonStatsBatch: vi.fn().mockResolvedValue(new Map()),
}))

// Import after mocking
import * as contractService from '../services/contract.service'

describe('Contract Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ==================== PURE FUNCTIONS ====================

  describe('calculateRescissionClause', () => {
    it('should return salary * 11 for duration=4', () => {
      expect(contractService.calculateRescissionClause(10, 4)).toBe(110)
    })

    it('should return salary * 9 for duration=3', () => {
      expect(contractService.calculateRescissionClause(10, 3)).toBe(90)
    })

    it('should return salary * 7 for duration=2', () => {
      expect(contractService.calculateRescissionClause(10, 2)).toBe(70)
    })

    it('should return salary * 3 for duration=1', () => {
      expect(contractService.calculateRescissionClause(10, 1)).toBe(30)
    })

    it('should fallback to multiplier 3 for unknown duration', () => {
      expect(contractService.calculateRescissionClause(10, 5)).toBe(30)
    })
  })

  describe('calculateDefaultSalary', () => {
    it('should return auctionPrice / 10 rounded', () => {
      expect(contractService.calculateDefaultSalary(100)).toBe(10)
    })

    it('should return at least 1 for small auction prices', () => {
      expect(contractService.calculateDefaultSalary(5)).toBe(1)
    })

    it('should return 1 for auctionPrice=0', () => {
      expect(contractService.calculateDefaultSalary(0)).toBe(1)
    })
  })

  describe('calculateReleaseCost', () => {
    it('should return (salary * duration) / 2 rounded up', () => {
      expect(contractService.calculateReleaseCost(10, 3)).toBe(15)
    })

    it('should round up odd values', () => {
      // (7 * 3) / 2 = 10.5 => ceil = 11
      expect(contractService.calculateReleaseCost(7, 3)).toBe(11)
    })

    it('should return 0 for salary=0', () => {
      expect(contractService.calculateReleaseCost(0, 4)).toBe(0)
    })
  })

  describe('isValidRenewal', () => {
    it('should reject duration > 4', () => {
      const result = contractService.isValidRenewal(10, 2, 12, 5, 10)
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('Durata massima')
    })

    // SPALMA case (currentDuration === 1)
    it('should allow spalma when newSalary * newDuration >= initialSalary', () => {
      // current: salary=20, duration=1, initial=20
      // new: salary=7, duration=3 => 7*3=21 >= 20
      const result = contractService.isValidRenewal(20, 1, 7, 3, 20)
      expect(result.valid).toBe(true)
    })

    it('should reject spalma when total is less than initialSalary', () => {
      // current: salary=20, duration=1, initial=20
      // new: salary=6, duration=3 => 6*3=18 < 20
      const result = contractService.isValidRenewal(20, 1, 6, 3, 20)
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('Spalma non valido')
    })

    // Normal renewal cases
    it('should reject salary decrease in normal renewal', () => {
      const result = contractService.isValidRenewal(10, 2, 8, 2, 10)
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('Ingaggio non può diminuire')
    })

    it('should reject duration decrease in normal renewal', () => {
      const result = contractService.isValidRenewal(10, 3, 10, 2, 10)
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('Durata non può diminuire')
    })

    it('should reject duration increase without salary increase', () => {
      const result = contractService.isValidRenewal(10, 2, 10, 3, 10)
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('Per aumentare la durata')
    })

    it('should allow salary increase with same duration', () => {
      const result = contractService.isValidRenewal(10, 2, 15, 2, 10)
      expect(result.valid).toBe(true)
    })

    it('should allow salary + duration increase together', () => {
      const result = contractService.isValidRenewal(10, 2, 15, 3, 10)
      expect(result.valid).toBe(true)
    })

    it('should allow keeping same salary and duration (no change)', () => {
      const result = contractService.isValidRenewal(10, 2, 10, 2, 10)
      expect(result.valid).toBe(true)
    })
  })

  // ==================== validateBudgetNotNegative ====================

  describe('validateBudgetNotNegative', () => {
    it('should return true when budget is positive', async () => {
      mockPrisma.leagueMember.findUnique.mockResolvedValue({ currentBudget: 100 })
      const result = await contractService.validateBudgetNotNegative('member-1')
      expect(result).toBe(true)
    })

    it('should return false when budget is negative', async () => {
      mockPrisma.leagueMember.findUnique.mockResolvedValue({ currentBudget: -5 })
      const result = await contractService.validateBudgetNotNegative('member-1')
      expect(result).toBe(false)
    })

    it('should return true when member not found', async () => {
      mockPrisma.leagueMember.findUnique.mockResolvedValue(null)
      const result = await contractService.validateBudgetNotNegative('nonexistent')
      expect(result).toBe(true)
    })
  })

  // ==================== getContracts ====================

  describe('getContracts', () => {
    it('should return error when user is not a member', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue(null)

      const result = await contractService.getContracts('league-1', 'user-1')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non sei membro di questa lega')
    })

    it('should return contracts successfully when not in CONTRATTI phase', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({
        id: 'member-1',
        currentBudget: 500,
        preConsolidationBudget: null,
      })
      mockPrisma.marketSession.findFirst.mockResolvedValue(null) // Not in CONTRATTI
      mockPrisma.playerRoster.findMany.mockResolvedValue([])

      const result = await contractService.getContracts('league-1', 'user-1')

      expect(result.success).toBe(true)
      const data = result.data as { contracts: unknown[]; pendingContracts: unknown[]; inContrattiPhase: boolean; memberBudget: number }
      expect(data.contracts).toEqual([])
      expect(data.pendingContracts).toEqual([])
      expect(data.inContrattiPhase).toBe(false)
      expect(data.memberBudget).toBe(500)
    })

    it('should return contracts with draft values during CONTRATTI phase', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({
        id: 'member-1',
        currentBudget: 500,
        preConsolidationBudget: null,
      })
      mockPrisma.marketSession.findFirst.mockResolvedValue({ id: 'session-1' })
      mockPrisma.contractConsolidation.findUnique.mockResolvedValue(null) // Not consolidated
      mockPrisma.prizeCategory.findFirst.mockResolvedValue(null)
      mockPrisma.prizeCategory.findMany.mockResolvedValue([])
      mockPrisma.playerRoster.findMany.mockResolvedValue([
        {
          id: 'roster-1',
          playerId: 'player-1',
          acquisitionPrice: 50,
          acquisitionType: 'AUCTION',
          player: { id: 'player-1', name: 'Leao', position: 'A', team: 'Milan', listStatus: 'IN_LIST', exitReason: null },
          contract: {
            id: 'contract-1',
            salary: 10,
            duration: 2,
            initialSalary: 10,
            initialDuration: 2,
            rescissionClause: 70,
            draftSalary: 12,
            draftDuration: 3,
            draftReleased: false,
            draftExitDecision: null,
            preConsolidationSalary: null,
            preConsolidationDuration: null,
          },
          draftContract: null,
        },
      ])

      const result = await contractService.getContracts('league-1', 'user-1')

      expect(result.success).toBe(true)
      const data = result.data as { contracts: Array<{ id: string; salary: number; draftSalary: number | null }>; inContrattiPhase: boolean }
      expect(data.inContrattiPhase).toBe(true)
      expect(data.contracts).toHaveLength(1)
      expect(data.contracts[0]!.salary).toBe(10)
      expect(data.contracts[0]!.draftSalary).toBe(12)
    })

    it('should show preConsolidationBudget after consolidation', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({
        id: 'member-1',
        currentBudget: 450,
        preConsolidationBudget: 500,
      })
      mockPrisma.marketSession.findFirst.mockResolvedValue({ id: 'session-1' })
      mockPrisma.contractConsolidation.findUnique.mockResolvedValue({ consolidatedAt: new Date() })
      mockPrisma.prizeCategory.findFirst.mockResolvedValue(null)
      mockPrisma.prizeCategory.findMany.mockResolvedValue([])
      mockPrisma.contractHistory.findMany.mockResolvedValue([]) // called multiple times
      mockPrisma.playerRoster.findMany.mockResolvedValue([])

      const result = await contractService.getContracts('league-1', 'user-1')

      expect(result.success).toBe(true)
      const data = result.data as { memberBudget: number; isConsolidated: boolean }
      expect(data.isConsolidated).toBe(true)
      expect(data.memberBudget).toBe(500) // preConsolidationBudget
    })

    it('should compute pending contracts with correct minSalary for FIRST_MARKET', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({
        id: 'member-1',
        currentBudget: 500,
        preConsolidationBudget: null,
      })
      mockPrisma.marketSession.findFirst.mockResolvedValue(null) // Not in CONTRATTI
      mockPrisma.playerRoster.findMany.mockResolvedValue([
        {
          id: 'roster-2',
          playerId: 'player-2',
          acquisitionPrice: 100,
          acquisitionType: 'FIRST_MARKET',
          player: { id: 'player-2', name: 'Theo', position: 'D', team: 'Milan', listStatus: 'IN_LIST', exitReason: null },
          contract: null,
          draftContract: null,
        },
      ])

      const result = await contractService.getContracts('league-1', 'user-1')

      expect(result.success).toBe(true)
      const data = result.data as { pendingContracts: Array<{ minSalary: number }> }
      expect(data.pendingContracts).toHaveLength(1)
      expect(data.pendingContracts[0]!.minSalary).toBe(1) // FIRST_MARKET always has min 1
    })

    it('should compute pending contracts with 10% minSalary for non-FIRST_MARKET', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({
        id: 'member-1',
        currentBudget: 500,
        preConsolidationBudget: null,
      })
      mockPrisma.marketSession.findFirst.mockResolvedValue(null)
      mockPrisma.playerRoster.findMany.mockResolvedValue([
        {
          id: 'roster-3',
          playerId: 'player-3',
          acquisitionPrice: 45,
          acquisitionType: 'AUCTION',
          player: { id: 'player-3', name: 'Barella', position: 'C', team: 'Inter', listStatus: 'IN_LIST', exitReason: null },
          contract: null,
          draftContract: null,
        },
      ])

      const result = await contractService.getContracts('league-1', 'user-1')

      expect(result.success).toBe(true)
      const data = result.data as { pendingContracts: Array<{ minSalary: number }> }
      expect(data.pendingContracts).toHaveLength(1)
      expect(data.pendingContracts[0]!.minSalary).toBe(5) // ceil(45 * 0.1) = 5
    })
  })

  // ==================== getContractById ====================

  describe('getContractById', () => {
    it('should return error when contract not found', async () => {
      mockPrisma.playerContract.findUnique.mockResolvedValue(null)

      const result = await contractService.getContractById('contract-x', 'user-1')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Contratto non trovato')
    })

    it('should return error when user is not the owner', async () => {
      mockPrisma.playerContract.findUnique.mockResolvedValue({
        id: 'contract-1',
        salary: 10,
        duration: 2,
        initialSalary: 10,
        roster: {
          leagueMember: {
            leagueId: 'league-1',
            user: { id: 'other-user', username: 'other' },
          },
        },
      })

      const result = await contractService.getContractById('contract-1', 'user-1')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non sei il proprietario di questo contratto')
    })

    it('should return contract with computed fields', async () => {
      mockPrisma.playerContract.findUnique.mockResolvedValue({
        id: 'contract-1',
        salary: 10,
        duration: 2,
        initialSalary: 10,
        roster: {
          leagueMember: {
            leagueId: 'league-1',
            currentBudget: 500,
            user: { id: 'user-1', username: 'test' },
          },
        },
      })
      // Mock isInContrattiPhase
      mockPrisma.marketSession.findFirst.mockResolvedValue(null) // Not in CONTRATTI phase

      const result = await contractService.getContractById('contract-1', 'user-1')

      expect(result.success).toBe(true)
      const data = result.data as { contract: { rescissionClause: number; canRenew: boolean; canSpalmare: boolean; maxDuration: number }; memberBudget: number; inContrattiPhase: boolean }
      expect(data.contract.rescissionClause).toBe(70) // 10 * 7
      expect(data.contract.canRenew).toBe(true)
      expect(data.contract.canSpalmare).toBe(false) // duration != 1
      expect(data.contract.maxDuration).toBe(4)
      expect(data.memberBudget).toBe(500)
      expect(data.inContrattiPhase).toBe(false)
    })
  })

  // ==================== createContract ====================

  describe('createContract', () => {
    it('should return error when roster not found', async () => {
      mockPrisma.playerRoster.findUnique.mockResolvedValue(null)

      const result = await contractService.createContract('roster-x', 'user-1', 10, 2)

      expect(result.success).toBe(false)
      expect(result.message).toBe('Giocatore non trovato nella rosa')
    })

    it('should return error when user is not the owner', async () => {
      mockPrisma.playerRoster.findUnique.mockResolvedValue({
        id: 'roster-1',
        contract: null,
        player: { name: 'Leao' },
        leagueMember: {
          id: 'member-1',
          leagueId: 'league-1',
          user: { id: 'other-user' },
          league: {},
        },
      })

      const result = await contractService.createContract('roster-1', 'user-1', 10, 2)

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non sei il proprietario di questo giocatore')
    })

    it('should return error when player already has contract', async () => {
      mockPrisma.playerRoster.findUnique.mockResolvedValue({
        id: 'roster-1',
        contract: { id: 'existing-contract' },
        player: { name: 'Leao' },
        leagueMember: {
          id: 'member-1',
          leagueId: 'league-1',
          user: { id: 'user-1' },
          league: {},
        },
      })

      const result = await contractService.createContract('roster-1', 'user-1', 10, 2)

      expect(result.success).toBe(false)
      expect(result.message).toBe('Questo giocatore ha già un contratto')
    })

    it('should return error when not in CONTRATTI phase', async () => {
      mockPrisma.playerRoster.findUnique.mockResolvedValue({
        id: 'roster-1',
        contract: null,
        player: { name: 'Leao' },
        leagueMember: {
          id: 'member-1',
          leagueId: 'league-1',
          user: { id: 'user-1' },
          league: {},
        },
      })
      mockPrisma.marketSession.findFirst.mockResolvedValue(null) // Not in CONTRATTI

      const result = await contractService.createContract('roster-1', 'user-1', 10, 2)

      expect(result.success).toBe(false)
      expect(result.message).toContain('fase CONTRATTI')
    })

    it('should return error for invalid duration', async () => {
      mockPrisma.playerRoster.findUnique.mockResolvedValue({
        id: 'roster-1',
        contract: null,
        acquisitionPrice: 50,
        acquisitionType: 'AUCTION',
        player: { name: 'Leao' },
        leagueMember: {
          id: 'member-1',
          leagueId: 'league-1',
          user: { id: 'user-1' },
          league: {},
        },
      })
      mockPrisma.marketSession.findFirst.mockResolvedValue({ id: 'session-1' })

      const result = await contractService.createContract('roster-1', 'user-1', 10, 5)

      expect(result.success).toBe(false)
      expect(result.message).toContain('Durata deve essere tra 1 e 4')
    })

    it('should return error when salary below minimum for non-FIRST_MARKET', async () => {
      mockPrisma.playerRoster.findUnique.mockResolvedValue({
        id: 'roster-1',
        contract: null,
        acquisitionPrice: 100,
        acquisitionType: 'AUCTION',
        player: { name: 'Leao' },
        leagueMember: {
          id: 'member-1',
          leagueId: 'league-1',
          user: { id: 'user-1' },
          league: {},
        },
      })
      mockPrisma.marketSession.findFirst.mockResolvedValue({ id: 'session-1' })

      // minSalary = ceil(100 * 0.1) = 10, salary=5 < 10
      const result = await contractService.createContract('roster-1', 'user-1', 5, 2)

      expect(result.success).toBe(false)
      expect(result.message).toContain('Ingaggio minimo per questo giocatore')
    })

    it('should create contract successfully', async () => {
      mockPrisma.playerRoster.findUnique.mockResolvedValue({
        id: 'roster-1',
        contract: null,
        acquisitionPrice: 50,
        acquisitionType: 'FIRST_MARKET',
        player: { name: 'Leao' },
        leagueMember: {
          id: 'member-1',
          leagueId: 'league-1',
          user: { id: 'user-1' },
          league: {},
        },
      })
      mockPrisma.marketSession.findFirst.mockResolvedValue({ id: 'session-1' })
      mockPrisma.playerContract.create.mockResolvedValue({
        id: 'new-contract',
        rosterId: 'roster-1',
        salary: 10,
        duration: 2,
        initialSalary: 10,
        initialDuration: 2,
        rescissionClause: 70,
        roster: { player: { name: 'Leao' } },
      })

      const result = await contractService.createContract('roster-1', 'user-1', 10, 2)

      expect(result.success).toBe(true)
      expect(result.message).toContain('Leao')
      expect(result.message).toContain('10/sem x 2 semestri')
    })
  })

  // ==================== saveDrafts ====================

  describe('saveDrafts', () => {
    it('should return error when user is not a member', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue(null)

      const result = await contractService.saveDrafts('league-1', 'user-1', [], [])

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non sei membro di questa lega')
    })

    it('should return error when not in CONTRATTI phase', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'member-1' })
      mockPrisma.marketSession.findFirst.mockResolvedValue(null)

      const result = await contractService.saveDrafts('league-1', 'user-1', [], [])

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non siamo in fase CONTRATTI')
    })

    it('should return error when already consolidated', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'member-1' })
      mockPrisma.marketSession.findFirst.mockResolvedValue({ id: 'session-1' })
      mockPrisma.contractConsolidation.findUnique.mockResolvedValue({ id: 'consolidation-1' })

      const result = await contractService.saveDrafts('league-1', 'user-1', [], [])

      expect(result.success).toBe(false)
      expect(result.message).toBe('Hai già consolidato i tuoi contratti')
    })

    it('should save empty drafts successfully', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'member-1' })
      mockPrisma.marketSession.findFirst.mockResolvedValue({ id: 'session-1' })
      mockPrisma.contractConsolidation.findUnique.mockResolvedValue(null)

      // Transaction mocks for empty operation
      mockPrisma.playerContract.updateMany.mockResolvedValue({ count: 0 })

      const result = await contractService.saveDrafts('league-1', 'user-1', [], [])

      expect(result.success).toBe(true)
      expect(result.message).toBe('Bozze salvate con successo')
    })

    it('should save renewals and releases correctly', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'member-1' })
      mockPrisma.marketSession.findFirst.mockResolvedValue({ id: 'session-1' })
      mockPrisma.contractConsolidation.findUnique.mockResolvedValue(null)

      // Mock renewal validation inside transaction
      mockPrisma.playerContract.findMany.mockResolvedValue([
        { id: 'contract-1', leagueMemberId: 'member-1' },
      ])
      mockPrisma.playerContract.update.mockResolvedValue({})
      mockPrisma.playerContract.updateMany.mockResolvedValue({ count: 1 })

      const result = await contractService.saveDrafts(
        'league-1',
        'user-1',
        [{ contractId: 'contract-1', salary: 15, duration: 3 }],
        [],
        ['contract-2'],
      )

      expect(result.success).toBe(true)
      expect(result.message).toBe('Bozze salvate con successo')
    })

    it('should return error when renewal references invalid contract', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'member-1' })
      mockPrisma.marketSession.findFirst.mockResolvedValue({ id: 'session-1' })
      mockPrisma.contractConsolidation.findUnique.mockResolvedValue(null)

      // Transaction: contract not found
      mockPrisma.playerContract.findMany.mockResolvedValue([]) // No valid contracts found
      mockPrisma.playerContract.updateMany.mockResolvedValue({ count: 0 })

      // Override $transaction to propagate errors
      mockPrisma.$transaction.mockImplementationOnce(async (cb: unknown) => {
        if (typeof cb === 'function') {
          await (cb as (tx: typeof mockPrisma) => Promise<unknown>)(mockPrisma)
        }
      })

      const result = await contractService.saveDrafts(
        'league-1',
        'user-1',
        [{ contractId: 'invalid-contract', salary: 15, duration: 3 }],
        [],
      )

      expect(result.success).toBe(false)
      expect(result.message).toContain('non valido')
    })
  })

  // ==================== consolidateContracts ====================

  describe('consolidateContracts', () => {
    it('should return error when user is not a member', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue(null)

      const result = await contractService.consolidateContracts('league-1', 'user-1')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non sei membro di questa lega')
    })

    it('should return error when not in CONTRATTI phase', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'member-1' })
      mockPrisma.marketSession.findFirst.mockResolvedValue(null)

      const result = await contractService.consolidateContracts('league-1', 'user-1')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non siamo in fase CONTRATTI')
    })

    it('should return error when already consolidated', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'member-1' })
      mockPrisma.marketSession.findFirst.mockResolvedValue({ id: 'session-1' })
      mockPrisma.contractConsolidation.findUnique.mockResolvedValue({ id: 'consolidation-1' })

      const result = await contractService.consolidateContracts('league-1', 'user-1')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Hai già consolidato i tuoi contratti')
    })

    it('should consolidate successfully with no renewals, no new contracts, no releases', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({
        id: 'member-1',
        currentBudget: 500,
      })
      mockPrisma.marketSession.findFirst.mockResolvedValue({ id: 'session-1' })
      mockPrisma.contractConsolidation.findUnique.mockResolvedValue(null)

      // Transaction mocks
      mockPrisma.leagueMember.update.mockResolvedValue({})
      mockPrisma.playerContract.findMany
        .mockResolvedValueOnce([]) // undecidedExited
        .mockResolvedValueOnce([]) // contractsToRelease
        .mockResolvedValueOnce([]) // keptExitedPlayers
        .mockResolvedValueOnce([]) // postConsolidationContracts
      mockPrisma.prizeCategory.findFirst.mockResolvedValue(null)
      mockPrisma.prizeCategory.findMany.mockResolvedValue([])
      mockPrisma.playerRoster.findMany.mockResolvedValue([]) // all active roster (no players = ok)
      mockPrisma.leagueMember.findUnique.mockResolvedValue({ id: 'member-1', currentBudget: 500 })
      mockPrisma.contractConsolidation.create.mockResolvedValue({})

      const result = await contractService.consolidateContracts('league-1', 'user-1')

      expect(result.success).toBe(true)
      expect(result.message).toBe('Contratti consolidati con successo')
    })

    it('should fail if players remain without contract after consolidation', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({
        id: 'member-1',
        currentBudget: 500,
      })
      mockPrisma.marketSession.findFirst.mockResolvedValue({ id: 'session-1' })
      mockPrisma.contractConsolidation.findUnique.mockResolvedValue(null)

      // Transaction mocks
      mockPrisma.leagueMember.update.mockResolvedValue({})
      mockPrisma.playerContract.findMany
        .mockResolvedValueOnce([]) // undecidedExited
        .mockResolvedValueOnce([]) // contractsToRelease
        .mockResolvedValueOnce([]) // keptExitedPlayers
      mockPrisma.prizeCategory.findFirst.mockResolvedValue(null)
      mockPrisma.prizeCategory.findMany.mockResolvedValue([])
      // Roster has a player without contract
      mockPrisma.playerRoster.findMany.mockResolvedValue([
        { id: 'roster-1', contract: null, player: { name: 'Leao' } },
      ])

      const result = await contractService.consolidateContracts('league-1', 'user-1')

      expect(result.success).toBe(false)
      expect(result.message).toContain('giocatori senza contratto')
      expect(result.message).toContain('Leao')
    })

    it('should fail if roster exceeds 29 players', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({
        id: 'member-1',
        currentBudget: 500,
      })
      mockPrisma.marketSession.findFirst.mockResolvedValue({ id: 'session-1' })
      mockPrisma.contractConsolidation.findUnique.mockResolvedValue(null)

      mockPrisma.leagueMember.update.mockResolvedValue({})
      mockPrisma.playerContract.findMany
        .mockResolvedValueOnce([]) // undecidedExited
        .mockResolvedValueOnce([]) // contractsToRelease
        .mockResolvedValueOnce([]) // keptExitedPlayers
      mockPrisma.prizeCategory.findFirst.mockResolvedValue(null)
      mockPrisma.prizeCategory.findMany.mockResolvedValue([])

      // 30 players in roster (exceeds 29)
      const bigRoster = Array.from({ length: 30 }, (_, i) => ({
        id: `roster-${i}`,
        contract: { id: `contract-${i}` },
        player: { name: `Player ${i}` },
      }))
      mockPrisma.playerRoster.findMany.mockResolvedValue(bigRoster)

      const result = await contractService.consolidateContracts('league-1', 'user-1')

      expect(result.success).toBe(false)
      expect(result.message).toContain('Rosa troppo grande')
    })

    it('should fail if undecided exited players remain', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({
        id: 'member-1',
        currentBudget: 500,
      })
      mockPrisma.marketSession.findFirst.mockResolvedValue({ id: 'session-1' })
      mockPrisma.contractConsolidation.findUnique.mockResolvedValue(null)

      mockPrisma.leagueMember.update.mockResolvedValue({})
      // First findMany call: undecidedExited returns a player
      mockPrisma.playerContract.findMany.mockResolvedValueOnce([
        { roster: { player: { name: 'Osimhen' } } },
      ])

      const result = await contractService.consolidateContracts('league-1', 'user-1')

      expect(result.success).toBe(false)
      expect(result.message).toContain('Osimhen')
      expect(result.message).toContain('Devi decidere')
    })
  })

  // ==================== getConsolidationStatus ====================

  describe('getConsolidationStatus', () => {
    it('should return error when user is not a member', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue(null)

      const result = await contractService.getConsolidationStatus('league-1', 'user-1')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non sei membro di questa lega')
    })

    it('should return not-in-phase when no CONTRATTI session', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'member-1' })
      mockPrisma.marketSession.findFirst.mockResolvedValue(null)

      const result = await contractService.getConsolidationStatus('league-1', 'user-1')

      expect(result.success).toBe(true)
      const data = result.data as { inContrattiPhase: boolean; isConsolidated: boolean }
      expect(data.inContrattiPhase).toBe(false)
      expect(data.isConsolidated).toBe(false)
    })

    it('should return consolidated status when consolidation exists', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'member-1' })
      mockPrisma.marketSession.findFirst.mockResolvedValue({ id: 'session-1' })
      const now = new Date()
      mockPrisma.contractConsolidation.findUnique.mockResolvedValue({
        consolidatedAt: now,
      })

      const result = await contractService.getConsolidationStatus('league-1', 'user-1')

      expect(result.success).toBe(true)
      const data = result.data as { inContrattiPhase: boolean; isConsolidated: boolean; consolidatedAt: Date }
      expect(data.inContrattiPhase).toBe(true)
      expect(data.isConsolidated).toBe(true)
      expect(data.consolidatedAt).toBe(now)
    })
  })

  // ==================== canAdvanceFromContratti ====================

  describe('canAdvanceFromContratti', () => {
    it('should return false when session not found', async () => {
      mockPrisma.marketSession.findUnique.mockResolvedValue(null)

      const result = await contractService.canAdvanceFromContratti('session-x')

      expect(result.canAdvance).toBe(false)
      expect(result.reason).toBe('Sessione non trovata')
    })

    it('should return true when not in CONTRATTI phase', async () => {
      mockPrisma.marketSession.findUnique.mockResolvedValue({
        id: 'session-1',
        currentPhase: 'RUBATA',
        leagueId: 'league-1',
      })

      const result = await contractService.canAdvanceFromContratti('session-1')

      expect(result.canAdvance).toBe(true)
    })

    it('should return false when some managers have not consolidated', async () => {
      mockPrisma.marketSession.findUnique.mockResolvedValue({
        id: 'session-1',
        currentPhase: 'CONTRATTI',
        leagueId: 'league-1',
      })
      mockPrisma.leagueMember.findMany.mockResolvedValue([
        { id: 'member-1', roster: [{ id: 'r1' }], user: { username: 'manager1' } },
        { id: 'member-2', roster: [{ id: 'r2' }], user: { username: 'manager2' } },
      ])
      mockPrisma.contractConsolidation.findMany.mockResolvedValue([
        { memberId: 'member-1' }, // Only member-1 consolidated
      ])

      const result = await contractService.canAdvanceFromContratti('session-1')

      expect(result.canAdvance).toBe(false)
      expect(result.reason).toContain('manager2')
    })

    it('should return true when all managers have consolidated', async () => {
      mockPrisma.marketSession.findUnique.mockResolvedValue({
        id: 'session-1',
        currentPhase: 'CONTRATTI',
        leagueId: 'league-1',
      })
      mockPrisma.leagueMember.findMany.mockResolvedValue([
        { id: 'member-1', roster: [{ id: 'r1' }], user: { username: 'manager1' } },
        { id: 'member-2', roster: [{ id: 'r2' }], user: { username: 'manager2' } },
      ])
      mockPrisma.contractConsolidation.findMany.mockResolvedValue([
        { memberId: 'member-1' },
        { memberId: 'member-2' },
      ])

      const result = await contractService.canAdvanceFromContratti('session-1')

      expect(result.canAdvance).toBe(true)
    })
  })

  // ==================== modifyContractPostAcquisition ====================

  describe('modifyContractPostAcquisition', () => {
    it('should return error when contract not found', async () => {
      mockPrisma.playerContract.findUnique.mockResolvedValue(null)

      const result = await contractService.modifyContractPostAcquisition('contract-x', 'user-1', 10, 2)

      expect(result.success).toBe(false)
      expect(result.message).toBe('Contratto non trovato')
    })

    it('should return error when user is not owner', async () => {
      mockPrisma.playerContract.findUnique.mockResolvedValue({
        id: 'contract-1',
        salary: 10,
        duration: 2,
        rescissionClause: 70,
        renewalHistory: null,
        roster: {
          player: { name: 'Leao', id: 'p1', position: 'A', team: 'Milan' },
          leagueMember: { user: { id: 'other-user', username: 'other' }, league: {} },
        },
      })

      const result = await contractService.modifyContractPostAcquisition('contract-1', 'user-1', 12, 3)

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non sei il proprietario di questo contratto')
    })

    it('should reject salary decrease', async () => {
      mockPrisma.playerContract.findUnique.mockResolvedValue({
        id: 'contract-1',
        salary: 10,
        duration: 2,
        rescissionClause: 70,
        renewalHistory: null,
        roster: {
          player: { name: 'Leao', id: 'p1', position: 'A', team: 'Milan' },
          leagueMember: { user: { id: 'user-1', username: 'test' }, league: {} },
        },
      })

      const result = await contractService.modifyContractPostAcquisition('contract-1', 'user-1', 8, 2)

      expect(result.success).toBe(false)
      expect(result.message).toContain('Ingaggio non può diminuire')
    })

    it('should reject duration decrease', async () => {
      mockPrisma.playerContract.findUnique.mockResolvedValue({
        id: 'contract-1',
        salary: 10,
        duration: 3,
        rescissionClause: 90,
        renewalHistory: null,
        roster: {
          player: { name: 'Leao', id: 'p1', position: 'A', team: 'Milan' },
          leagueMember: { user: { id: 'user-1', username: 'test' }, league: {} },
        },
      })

      const result = await contractService.modifyContractPostAcquisition('contract-1', 'user-1', 10, 2)

      expect(result.success).toBe(false)
      expect(result.message).toContain('Durata non può diminuire')
    })

    it('should reject duration increase without salary increase', async () => {
      mockPrisma.playerContract.findUnique.mockResolvedValue({
        id: 'contract-1',
        salary: 10,
        duration: 2,
        rescissionClause: 70,
        renewalHistory: null,
        roster: {
          player: { name: 'Leao', id: 'p1', position: 'A', team: 'Milan' },
          leagueMember: { user: { id: 'user-1', username: 'test' }, league: {} },
        },
      })

      const result = await contractService.modifyContractPostAcquisition('contract-1', 'user-1', 10, 3)

      expect(result.success).toBe(false)
      expect(result.message).toContain('Per aumentare la durata')
    })

    it('should reject duration > 4', async () => {
      mockPrisma.playerContract.findUnique.mockResolvedValue({
        id: 'contract-1',
        salary: 10,
        duration: 2,
        rescissionClause: 70,
        renewalHistory: null,
        roster: {
          player: { name: 'Leao', id: 'p1', position: 'A', team: 'Milan' },
          leagueMember: { user: { id: 'user-1', username: 'test' }, league: {} },
        },
      })

      const result = await contractService.modifyContractPostAcquisition('contract-1', 'user-1', 15, 5)

      expect(result.success).toBe(false)
      expect(result.message).toContain('Durata massima')
    })

    it('should return success without DB update when no changes', async () => {
      mockPrisma.playerContract.findUnique.mockResolvedValue({
        id: 'contract-1',
        salary: 10,
        duration: 2,
        rescissionClause: 70,
        renewalHistory: null,
        roster: {
          player: { name: 'Leao', id: 'p1', position: 'A', team: 'Milan' },
          leagueMember: { user: { id: 'user-1', username: 'test' }, league: {} },
        },
      })

      const result = await contractService.modifyContractPostAcquisition('contract-1', 'user-1', 10, 2)

      expect(result.success).toBe(true)
      expect(mockPrisma.playerContract.update).not.toHaveBeenCalled()
    })

    it('should update contract successfully with salary and duration increase', async () => {
      mockPrisma.playerContract.findUnique.mockResolvedValue({
        id: 'contract-1',
        salary: 10,
        duration: 2,
        initialSalary: 10,
        initialDuration: 2,
        rescissionClause: 70,
        renewalHistory: null,
        roster: {
          player: { name: 'Leao', id: 'p1', position: 'A', team: 'Milan' },
          leagueMember: { user: { id: 'user-1', username: 'test' }, league: {} },
        },
      })
      mockPrisma.playerContract.update.mockResolvedValue({
        id: 'contract-1',
        salary: 15,
        duration: 3,
        initialSalary: 10,
        initialDuration: 2,
        rescissionClause: 135, // 15 * 9
        roster: {
          player: { name: 'Leao', id: 'p1', position: 'A', team: 'Milan' },
        },
      })

      const result = await contractService.modifyContractPostAcquisition('contract-1', 'user-1', 15, 3)

      expect(result.success).toBe(true)
      expect(result.message).toContain('Leao')
      expect(result.message).toContain('modificato con successo')
    })
  })
})
