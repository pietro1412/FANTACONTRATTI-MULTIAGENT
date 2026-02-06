/**
 * Test integration — formule contrattuali con DB reale
 * Verifica Sprint 1-4: salary, duration, rescission, budget, bilancio
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { PrismaClient, Position } from '@prisma/client'
import {
  cleanDatabase,
  seedTestData,
  createContrattiSession,
  createTestRosterAndContract,
  type TestContext,
} from './helpers'
import {
  calculateDefaultSalary,
  calculateRescissionClause,
  renewContract,
} from '../../src/services/contract.service'

const prisma = new PrismaClient({ log: ['error'] })

describe('Contract Formulas — DB Integration', () => {
  let ctx: TestContext

  beforeAll(async () => {
    await cleanDatabase()
    ctx = await seedTestData(4)
  })

  afterAll(async () => {
    await cleanDatabase()
    await prisma.$disconnect()
  })

  // ======================================================
  // Sprint 1: formule base
  // ======================================================
  describe('Sprint 1 — Formule base', () => {
    it('calculateDefaultSalary: intero, minimo 1', () => {
      expect(calculateDefaultSalary(10)).toBe(1)
      expect(calculateDefaultSalary(14)).toBe(1)
      expect(calculateDefaultSalary(15)).toBe(2)
      expect(calculateDefaultSalary(50)).toBe(5)
      expect(calculateDefaultSalary(1)).toBe(1)
      expect(calculateDefaultSalary(0)).toBe(1)
    })

    it('calculateDefaultSalary: nessun arrotondamento a 0.5', () => {
      const salary = calculateDefaultSalary(25) // 25/10 = 2.5 → round = 3
      expect(Number.isInteger(salary)).toBe(true)
      expect(salary).toBe(3)
    })

    it('calculateRescissionClause: moltiplicatori corretti', () => {
      expect(calculateRescissionClause(5, 4)).toBe(55) // 5 * 11
      expect(calculateRescissionClause(5, 3)).toBe(45) // 5 * 9
      expect(calculateRescissionClause(5, 2)).toBe(35) // 5 * 7
      expect(calculateRescissionClause(5, 1)).toBe(15) // 5 * 3
    })

    it('calculateRescissionClause: moltiplicatore 1:3 (non 1:4)', () => {
      expect(calculateRescissionClause(10, 1)).toBe(30) // 10 * 3
    })
  })

  // ======================================================
  // Sprint 1: contratto creato con formule corrette nel DB
  // ======================================================
  describe('Sprint 1 — Contratto post-asta nel DB', () => {
    it('contratto creato con duration=3, salary intero, clausola corretta', async () => {
      const auctionPrice = 47
      const expectedSalary = calculateDefaultSalary(auctionPrice) // round(4.7) = 5
      const duration = 3
      const expectedClause = calculateRescissionClause(expectedSalary, duration) // 5 * 9 = 45

      const { contract } = await createTestRosterAndContract({
        memberId: ctx.admin.id,
        leagueId: ctx.league.id,
        playerId: ctx.players[0]!.id,
        playerName: ctx.players[0]!.name,
        position: ctx.players[0]!.position,
        acquisitionPrice: auctionPrice,
        salary: expectedSalary,
        duration,
        rescissionClause: expectedClause,
      })

      // Verifica in DB
      const fromDb = await prisma.playerContract.findUnique({ where: { id: contract.id } })
      expect(fromDb!.salary).toBe(5)
      expect(fromDb!.duration).toBe(3)
      expect(fromDb!.rescissionClause).toBe(45)
      expect(Number.isInteger(fromDb!.salary)).toBe(true)
    })
  })

  // ======================================================
  // Sprint 2: rinnovo non decrementa budget
  // ======================================================
  describe('Sprint 2 — Renewal budget', () => {
    let contractId: string

    beforeEach(async () => {
      // Reset: pulisci sessioni e contratti, poi ricrea
      await prisma.contractConsolidation.deleteMany({})
      await prisma.playerContract.deleteMany({})
      await prisma.playerRoster.deleteMany({})
      await prisma.marketSession.deleteMany({ where: { leagueId: ctx.league.id } })

      await prisma.leagueMember.update({
        where: { id: ctx.admin.id },
        data: { currentBudget: 500 },
      })

      await createContrattiSession(ctx.league.id)

      const player = ctx.players[1]!
      const { contract } = await createTestRosterAndContract({
        memberId: ctx.admin.id,
        leagueId: ctx.league.id,
        playerId: player.id,
        playerName: player.name,
        position: player.position,
        acquisitionPrice: 30,
        salary: 3,
        duration: 3,
        rescissionClause: 27,
      })
      contractId = contract.id
    })

    it('renewContract: budget rimane invariato dopo rinnovo', async () => {
      const budgetBefore = (await prisma.leagueMember.findUnique({
        where: { id: ctx.admin.id },
      }))!.currentBudget

      // Rinnova: salary 3→5, duration 3→4
      const result = await renewContract(contractId, ctx.admin.userId, 5, 4)
      expect(result.success).toBe(true)

      const budgetAfter = (await prisma.leagueMember.findUnique({
        where: { id: ctx.admin.id },
      }))!.currentBudget

      // P0-3 FIX: budget NON decrementato
      expect(budgetAfter).toBe(budgetBefore)
    })

    it('renewContract: clausola rescissoria aggiornata correttamente', async () => {
      const result = await renewContract(contractId, ctx.admin.userId, 5, 4)
      expect(result.success).toBe(true)

      const updated = await prisma.playerContract.findUnique({ where: { id: contractId } })
      expect(updated!.rescissionClause).toBe(55) // 5 * 11
      expect(updated!.salary).toBe(5)
      expect(updated!.duration).toBe(4)
    })
  })

  // ======================================================
  // Sprint 3: consolidation guard
  // ======================================================
  describe('Sprint 3 — Consolidation guard', () => {
    it('renewContract bloccato dopo consolidamento', async () => {
      await prisma.contractConsolidation.deleteMany({})
      await prisma.playerContract.deleteMany({})
      await prisma.playerRoster.deleteMany({})
      await prisma.marketSession.deleteMany({ where: { leagueId: ctx.league.id } })

      const session = await createContrattiSession(ctx.league.id)

      const player = ctx.players[2]!
      const { contract } = await createTestRosterAndContract({
        memberId: ctx.admin.id,
        leagueId: ctx.league.id,
        playerId: player.id,
        playerName: player.name,
        position: player.position,
        acquisitionPrice: 20,
        salary: 2,
        duration: 3,
        rescissionClause: 18,
      })

      // Simula consolidamento
      await prisma.contractConsolidation.create({
        data: {
          sessionId: session.id,
          memberId: ctx.admin.id,
        },
      })

      // Prova rinnovo → deve fallire
      const result = await renewContract(contract.id, ctx.admin.userId, 4, 4)
      expect(result.success).toBe(false)
      expect(result.message).toContain('consolidamento')
    })
  })

  // ======================================================
  // Sprint 4: bilancio = budget - monte ingaggi
  // ======================================================
  describe('Sprint 4 — Bilancio calculation', () => {
    it('bilancio = currentBudget - SUM(salary) dei contratti attivi', async () => {
      await prisma.contractConsolidation.deleteMany({})
      await prisma.playerContract.deleteMany({})
      await prisma.playerRoster.deleteMany({})

      const memberId = ctx.members[0]!.id
      await prisma.leagueMember.update({
        where: { id: memberId },
        data: { currentBudget: 500 },
      })

      // Crea 2 contratti con salary 10 e 15
      for (const [i, salary] of [10, 15].entries()) {
        const player = ctx.players[i]!
        await createTestRosterAndContract({
          memberId,
          leagueId: ctx.league.id,
          playerId: player.id,
          playerName: player.name,
          position: player.position,
          acquisitionPrice: salary * 10,
          salary,
          duration: 3,
          rescissionClause: calculateRescissionClause(salary, 3),
        })
      }

      // Calcola monte ingaggi da DB
      const monteIngaggi = await prisma.playerContract.aggregate({
        where: { leagueMemberId: memberId },
        _sum: { salary: true },
      })

      const member = await prisma.leagueMember.findUnique({ where: { id: memberId } })

      const bilancio = member!.currentBudget - (monteIngaggi._sum.salary || 0)

      expect(monteIngaggi._sum.salary).toBe(25)
      expect(bilancio).toBe(475)
    })
  })
})
