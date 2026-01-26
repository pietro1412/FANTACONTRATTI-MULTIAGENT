/**
 * objectives.service.test.ts - Unit Tests for Objectives Service
 *
 * Tests for the auction objectives service functions.
 *
 * Creato il: 25/01/2026
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Hoist mock before imports
const { mockPrisma, MockPrismaClient } = vi.hoisted(() => {
  const mock = {
    marketSession: {
      findUnique: vi.fn()
    },
    leagueMember: {
      findFirst: vi.fn()
    },
    serieAPlayer: {
      findUnique: vi.fn()
    },
    auctionObjective: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      groupBy: vi.fn()
    }
  }

  // Create a proper class constructor
  const MockClass = function(this: typeof mock) {
    Object.assign(this, mock)
  } as unknown as new () => typeof mock

  return { mockPrisma: mock, MockPrismaClient: MockClass }
})

// Mock Prisma with hoisted mock
vi.mock('@prisma/client', () => ({
  PrismaClient: MockPrismaClient,
  ObjectiveStatus: {
    ACTIVE: 'ACTIVE',
    ACQUIRED: 'ACQUIRED',
    MISSED: 'MISSED',
    REMOVED: 'REMOVED'
  }
}))

// Import after mocking
import * as objectivesService from '../services/objectives.service'

describe('Objectives Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getObjectives', () => {
    it('returns error when session not found', async () => {
      mockPrisma.marketSession.findUnique.mockResolvedValue(null)

      const result = await objectivesService.getObjectives('session-1', 'user-1')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Sessione non trovata')
    })

    it('returns error when user is not a member', async () => {
      mockPrisma.marketSession.findUnique.mockResolvedValue({ leagueId: 'league-1' })
      mockPrisma.leagueMember.findFirst.mockResolvedValue(null)

      const result = await objectivesService.getObjectives('session-1', 'user-1')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non sei membro di questa lega')
    })

    it('returns objectives when valid', async () => {
      mockPrisma.marketSession.findUnique.mockResolvedValue({ leagueId: 'league-1' })
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'member-1' })
      mockPrisma.auctionObjective.findMany.mockResolvedValue([
        {
          id: 'obj-1',
          playerId: 'player-1',
          priority: 1,
          status: 'ACTIVE',
          player: { name: 'Leao', team: 'Milan', position: 'A', quotation: 30 }
        }
      ])

      const result = await objectivesService.getObjectives('session-1', 'user-1')

      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(1)
    })
  })

  describe('createObjective', () => {
    it('returns error when session not found', async () => {
      mockPrisma.marketSession.findUnique.mockResolvedValue(null)

      const result = await objectivesService.createObjective('user-1', {
        sessionId: 'session-1',
        playerId: 'player-1'
      })

      expect(result.success).toBe(false)
      expect(result.message).toBe('Sessione non trovata')
    })

    it('returns error when session is completed', async () => {
      mockPrisma.marketSession.findUnique.mockResolvedValue({
        id: 'session-1',
        leagueId: 'league-1',
        status: 'COMPLETED'
      })

      const result = await objectivesService.createObjective('user-1', {
        sessionId: 'session-1',
        playerId: 'player-1'
      })

      expect(result.success).toBe(false)
      expect(result.message).toBe('Sessione non attiva')
    })

    it('returns error when player not found', async () => {
      mockPrisma.marketSession.findUnique.mockResolvedValue({
        id: 'session-1',
        leagueId: 'league-1',
        status: 'ACTIVE'
      })
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'member-1' })
      mockPrisma.serieAPlayer.findUnique.mockResolvedValue(null)

      const result = await objectivesService.createObjective('user-1', {
        sessionId: 'session-1',
        playerId: 'player-invalid'
      })

      expect(result.success).toBe(false)
      expect(result.message).toBe('Giocatore non trovato')
    })

    it('returns error when objective already exists', async () => {
      mockPrisma.marketSession.findUnique.mockResolvedValue({
        id: 'session-1',
        leagueId: 'league-1',
        status: 'ACTIVE'
      })
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'member-1' })
      mockPrisma.serieAPlayer.findUnique.mockResolvedValue({ id: 'player-1', name: 'Leao' })
      mockPrisma.auctionObjective.findUnique.mockResolvedValue({ id: 'existing-obj' })

      const result = await objectivesService.createObjective('user-1', {
        sessionId: 'session-1',
        playerId: 'player-1'
      })

      expect(result.success).toBe(false)
      expect(result.message).toBe('Obiettivo già esistente per questo giocatore')
    })

    it('returns error when priority is invalid', async () => {
      mockPrisma.marketSession.findUnique.mockResolvedValue({
        id: 'session-1',
        leagueId: 'league-1',
        status: 'ACTIVE'
      })
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'member-1' })
      mockPrisma.serieAPlayer.findUnique.mockResolvedValue({ id: 'player-1', name: 'Leao' })
      mockPrisma.auctionObjective.findUnique.mockResolvedValue(null)

      const result = await objectivesService.createObjective('user-1', {
        sessionId: 'session-1',
        playerId: 'player-1',
        priority: 5 // Invalid
      })

      expect(result.success).toBe(false)
      expect(result.message).toBe('Priorità deve essere 1, 2 o 3')
    })

    it('creates objective successfully', async () => {
      mockPrisma.marketSession.findUnique.mockResolvedValue({
        id: 'session-1',
        leagueId: 'league-1',
        status: 'ACTIVE'
      })
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'member-1' })
      mockPrisma.serieAPlayer.findUnique.mockResolvedValue({ id: 'player-1', name: 'Leao' })
      mockPrisma.auctionObjective.findUnique.mockResolvedValue(null)
      mockPrisma.auctionObjective.create.mockResolvedValue({
        id: 'new-obj',
        sessionId: 'session-1',
        memberId: 'member-1',
        playerId: 'player-1',
        priority: 1,
        player: { name: 'Leao', team: 'Milan', position: 'A', quotation: 30 }
      })

      const result = await objectivesService.createObjective('user-1', {
        sessionId: 'session-1',
        playerId: 'player-1',
        priority: 1
      })

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
    })
  })

  describe('updateObjective', () => {
    it('returns error when objective not found', async () => {
      mockPrisma.auctionObjective.findUnique.mockResolvedValue(null)

      const result = await objectivesService.updateObjective('obj-1', 'user-1', { priority: 2 })

      expect(result.success).toBe(false)
      expect(result.message).toBe('Obiettivo non trovato')
    })

    it('returns error when user is not owner', async () => {
      mockPrisma.auctionObjective.findUnique.mockResolvedValue({
        id: 'obj-1',
        member: { userId: 'other-user' },
        session: { status: 'ACTIVE' }
      })

      const result = await objectivesService.updateObjective('obj-1', 'user-1', { priority: 2 })

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non autorizzato')
    })

    it('updates objective successfully', async () => {
      mockPrisma.auctionObjective.findUnique.mockResolvedValue({
        id: 'obj-1',
        member: { userId: 'user-1', leagueId: 'league-1' },
        session: { status: 'ACTIVE' }
      })
      mockPrisma.auctionObjective.update.mockResolvedValue({
        id: 'obj-1',
        priority: 2,
        player: { name: 'Leao', team: 'Milan', position: 'A', quotation: 30 }
      })

      const result = await objectivesService.updateObjective('obj-1', 'user-1', { priority: 2 })

      expect(result.success).toBe(true)
    })
  })

  describe('deleteObjective', () => {
    it('returns error when objective not found', async () => {
      mockPrisma.auctionObjective.findUnique.mockResolvedValue(null)

      const result = await objectivesService.deleteObjective('obj-1', 'user-1')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Obiettivo non trovato')
    })

    it('deletes objective successfully', async () => {
      mockPrisma.auctionObjective.findUnique.mockResolvedValue({
        id: 'obj-1',
        member: { userId: 'user-1' },
        session: { status: 'ACTIVE' }
      })
      mockPrisma.auctionObjective.delete.mockResolvedValue({})

      const result = await objectivesService.deleteObjective('obj-1', 'user-1')

      expect(result.success).toBe(true)
      expect(result.message).toBe('Obiettivo eliminato')
    })
  })

  describe('getObjectivesSummary', () => {
    it('returns summary of objectives', async () => {
      mockPrisma.marketSession.findUnique.mockResolvedValue({ leagueId: 'league-1' })
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'member-1' })
      mockPrisma.auctionObjective.groupBy.mockResolvedValue([
        { status: 'ACTIVE', _count: 3 },
        { status: 'ACQUIRED', _count: 2 },
        { status: 'MISSED', _count: 1 }
      ])

      const result = await objectivesService.getObjectivesSummary('session-1', 'user-1')

      expect(result.success).toBe(true)
      expect(result.data).toEqual({
        active: 3,
        acquired: 2,
        missed: 1,
        removed: 0,
        total: 6
      })
    })
  })
})
