/**
 * movement.service.test.ts - Unit Tests for Movement Service
 *
 * Tests for player movement recording, history retrieval, prophecies, and related functions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Hoist mock before imports
const { mockPrisma, MockPrismaClient } = vi.hoisted(() => {
  const mock = {
    playerMovement: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    leagueMember: {
      findFirst: vi.fn(),
    },
    serieAPlayer: {
      findUnique: vi.fn(),
    },
    playerRoster: {
      findFirst: vi.fn(),
    },
    auctionAcknowledgment: {
      findMany: vi.fn(),
    },
    prophecy: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
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
  ProphecyRole: {
    BUYER: 'BUYER',
    SELLER: 'SELLER',
  },
}))

// Import after mocking
import * as movementService from '../services/movement.service'

describe('Movement Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ==================== recordMovement ====================

  describe('recordMovement', () => {
    it('creates a movement and returns its id', async () => {
      mockPrisma.playerMovement.create.mockResolvedValue({ id: 'movement-1' })

      const result = await movementService.recordMovement({
        leagueId: 'league-1',
        playerId: 'player-1',
        movementType: 'ACQUISTO_ASTA' as never,
        toMemberId: 'member-1',
        price: 25,
        newSalary: 10,
        newDuration: 3,
      })

      expect(result).toBe('movement-1')
      expect(mockPrisma.playerMovement.create).toHaveBeenCalledOnce()
    })

    it('returns null on database error', async () => {
      mockPrisma.playerMovement.create.mockRejectedValue(new Error('DB error'))

      const result = await movementService.recordMovement({
        leagueId: 'league-1',
        playerId: 'player-1',
        movementType: 'ACQUISTO_ASTA' as never,
      })

      expect(result).toBeNull()
    })

    it('records movement with all optional fields', async () => {
      mockPrisma.playerMovement.create.mockResolvedValue({ id: 'movement-2' })

      const result = await movementService.recordMovement({
        leagueId: 'league-1',
        playerId: 'player-1',
        movementType: 'SCAMBIO' as never,
        fromMemberId: 'member-1',
        toMemberId: 'member-2',
        price: 30,
        oldSalary: 10,
        oldDuration: 2,
        oldClause: 5,
        newSalary: 15,
        newDuration: 3,
        newClause: 8,
        auctionId: 'auction-1',
        tradeId: 'trade-1',
        marketSessionId: 'session-1',
      })

      expect(result).toBe('movement-2')
      const createCall = mockPrisma.playerMovement.create.mock.calls[0][0]
      expect(createCall.data.fromMemberId).toBe('member-1')
      expect(createCall.data.toMemberId).toBe('member-2')
      expect(createCall.data.oldSalary).toBe(10)
      expect(createCall.data.newSalary).toBe(15)
    })
  })

  // ==================== getLeagueMovements ====================

  describe('getLeagueMovements', () => {
    it('returns error when user is not a member', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue(null)

      const result = await movementService.getLeagueMovements('league-1', 'user-1')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non sei membro di questa lega')
    })

    it('returns formatted movements when authorized', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'member-1' })
      mockPrisma.playerMovement.findMany.mockResolvedValue([
        {
          id: 'mov-1',
          movementType: 'ACQUISTO_ASTA',
          auctionId: null,
          toMemberId: 'member-1',
          fromMemberId: null,
          player: { id: 'p1', name: 'Leao', position: 'A', team: 'Milan' },
          fromMember: null,
          toMember: {
            id: 'member-1',
            teamName: 'Team Alpha',
            user: { username: 'manager1' },
          },
          prophecies: [],
          price: 25,
          oldSalary: null,
          oldDuration: null,
          oldClause: null,
          newSalary: 10,
          newDuration: 3,
          newClause: null,
          createdAt: new Date('2025-01-15'),
        },
      ])
      mockPrisma.auctionAcknowledgment.findMany.mockResolvedValue([])

      const result = await movementService.getLeagueMovements('league-1', 'user-1')

      expect(result.success).toBe(true)
      const data = result.data as Array<Record<string, unknown>>
      expect(data).toHaveLength(1)
      expect(data[0].type).toBe('ACQUISTO_ASTA')
      expect((data[0].player as Record<string, unknown>).name).toBe('Leao')
      expect(data[0].from).toBeNull()
      expect(data[0].to).toBeDefined()
    })

    it('applies optional filters for movementType and playerId', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'member-1' })
      mockPrisma.playerMovement.findMany.mockResolvedValue([])
      mockPrisma.auctionAcknowledgment.findMany.mockResolvedValue([])

      await movementService.getLeagueMovements('league-1', 'user-1', {
        movementType: 'SCAMBIO' as never,
        playerId: 'player-1',
        limit: 10,
        offset: 5,
      })

      const findManyCall = mockPrisma.playerMovement.findMany.mock.calls[0][0]
      expect(findManyCall.where.movementType).toBe('SCAMBIO')
      expect(findManyCall.where.playerId).toBe('player-1')
      expect(findManyCall.take).toBe(10)
      expect(findManyCall.skip).toBe(5)
    })

    it('applies semester filter correctly', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'member-1' })
      mockPrisma.playerMovement.findMany.mockResolvedValue([])
      mockPrisma.auctionAcknowledgment.findMany.mockResolvedValue([])

      await movementService.getLeagueMovements('league-1', 'user-1', {
        semester: 1,
      })

      const findManyCall = mockPrisma.playerMovement.findMany.mock.calls[0][0]
      expect(findManyCall.where.marketSession).toEqual({ semester: 1 })
    })

    it('merges prophecies from both Prophecy model and AuctionAcknowledgment', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'member-1' })
      mockPrisma.playerMovement.findMany.mockResolvedValue([
        {
          id: 'mov-1',
          movementType: 'ACQUISTO_ASTA',
          auctionId: 'auction-1',
          toMemberId: 'member-1',
          fromMemberId: null,
          player: { id: 'p1', name: 'Leao', position: 'A', team: 'Milan' },
          fromMember: null,
          toMember: { id: 'member-1', teamName: 'Team Alpha', user: { username: 'manager1' } },
          prophecies: [
            {
              id: 'proph-1',
              content: 'Fara bene',
              authorRole: 'BUYER',
              authorId: 'member-1',
              author: { id: 'member-1', teamName: 'Team Alpha', user: { username: 'manager1' } },
              createdAt: new Date('2025-01-15'),
            },
          ],
          price: 25,
          oldSalary: null,
          oldDuration: null,
          oldClause: null,
          newSalary: 10,
          newDuration: 3,
          newClause: null,
          createdAt: new Date('2025-01-15'),
        },
      ])
      mockPrisma.auctionAcknowledgment.findMany.mockResolvedValue([
        {
          id: 'ack-1',
          auctionId: 'auction-1',
          memberId: 'member-2', // different from prophecy authorId
          prophecy: 'Pago troppo',
          acknowledgedAt: new Date('2025-01-16'),
          member: { id: 'member-2', teamName: 'Team Beta', user: { username: 'manager2' } },
          auction: {},
        },
      ])

      const result = await movementService.getLeagueMovements('league-1', 'user-1')

      expect(result.success).toBe(true)
      const data = result.data as Array<Record<string, unknown>>
      const prophecies = data[0].prophecies as Array<Record<string, unknown>>
      expect(prophecies).toHaveLength(2) // 1 from model + 1 from ack
      expect(prophecies[0].source).toBe('prophecy')
      expect(prophecies[1].source).toBe('acknowledgment')
      expect(prophecies[1].content).toBe('Pago troppo')
    })
  })

  // ==================== getPlayerHistory ====================

  describe('getPlayerHistory', () => {
    it('returns error when user is not a member', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue(null)

      const result = await movementService.getPlayerHistory('league-1', 'player-1', 'user-1')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non sei membro di questa lega')
    })

    it('returns error when player not found', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'member-1' })
      mockPrisma.serieAPlayer.findUnique.mockResolvedValue(null)

      const result = await movementService.getPlayerHistory('league-1', 'player-1', 'user-1')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Giocatore non trovato')
    })

    it('returns player history with current owner', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'member-1' })
      mockPrisma.serieAPlayer.findUnique.mockResolvedValue({
        id: 'player-1',
        name: 'Leao',
        position: 'A',
        team: 'Milan',
        quotation: 30,
      })
      mockPrisma.playerMovement.findMany.mockResolvedValue([
        {
          id: 'mov-1',
          movementType: 'ACQUISTO_ASTA',
          fromMember: null,
          toMember: { user: { username: 'manager1' } },
          prophecies: [],
          price: 25,
          oldSalary: null,
          oldDuration: null,
          oldClause: null,
          newSalary: 10,
          newDuration: 3,
          newClause: null,
          marketSession: { type: 'MERCATO_RICORRENTE', season: 1, semester: 1 },
          createdAt: new Date('2025-01-15'),
        },
      ])
      mockPrisma.playerRoster.findFirst.mockResolvedValue({
        leagueMember: {
          id: 'member-1',
          teamName: 'Team Alpha',
          user: { username: 'manager1' },
        },
        contract: { salary: 10, duration: 3, rescissionClause: null },
      })

      const result = await movementService.getPlayerHistory('league-1', 'player-1', 'user-1')

      expect(result.success).toBe(true)
      const data = result.data as Record<string, unknown>
      const player = data.player as Record<string, unknown>
      expect(player.name).toBe('Leao')
      expect(player.quotation).toBe(30)
      const currentOwner = data.currentOwner as Record<string, unknown>
      expect(currentOwner.username).toBe('manager1')
      const movements = data.movements as Array<Record<string, unknown>>
      expect(movements).toHaveLength(1)
      expect(movements[0].session).toBe('MERCATO_RICORRENTE S1/1')
    })

    it('returns null currentOwner when player is free agent', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'member-1' })
      mockPrisma.serieAPlayer.findUnique.mockResolvedValue({
        id: 'player-1',
        name: 'Leao',
        position: 'A',
        team: 'Milan',
        quotation: 30,
      })
      mockPrisma.playerMovement.findMany.mockResolvedValue([])
      mockPrisma.playerRoster.findFirst.mockResolvedValue(null)

      const result = await movementService.getPlayerHistory('league-1', 'player-1', 'user-1')

      expect(result.success).toBe(true)
      const data = result.data as Record<string, unknown>
      expect(data.currentOwner).toBeNull()
      expect(data.movements).toEqual([])
    })
  })

  // ==================== addProphecy ====================

  describe('addProphecy', () => {
    it('returns error when movement not found', async () => {
      mockPrisma.playerMovement.findUnique.mockResolvedValue(null)

      const result = await movementService.addProphecy('movement-1', 'user-1', 'Fara bene')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Movimento non trovato')
    })

    it('returns error when user is not a member', async () => {
      mockPrisma.playerMovement.findUnique.mockResolvedValue({
        id: 'movement-1',
        leagueId: 'league-1',
        fromMember: null,
        toMember: { id: 'member-1' },
        toMemberId: 'member-1',
        fromMemberId: null,
      })
      mockPrisma.leagueMember.findFirst.mockResolvedValue(null)

      const result = await movementService.addProphecy('movement-1', 'user-1', 'Fara bene')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non sei membro di questa lega')
    })

    it('returns error when user is not involved in the movement', async () => {
      mockPrisma.playerMovement.findUnique.mockResolvedValue({
        id: 'movement-1',
        leagueId: 'league-1',
        fromMember: { id: 'member-2' },
        toMember: { id: 'member-3' },
        toMemberId: 'member-3',
        fromMemberId: 'member-2',
      })
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'member-99' })

      const result = await movementService.addProphecy('movement-1', 'user-1', 'Fara bene')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Solo chi acquista o chi cede può fare una profezia')
    })

    it('returns error when prophecy already exists', async () => {
      mockPrisma.playerMovement.findUnique.mockResolvedValue({
        id: 'movement-1',
        leagueId: 'league-1',
        fromMember: null,
        toMember: { id: 'member-1' },
        toMemberId: 'member-1',
        fromMemberId: null,
      })
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'member-1' })
      mockPrisma.prophecy.findUnique.mockResolvedValue({ id: 'existing-prophecy' })

      const result = await movementService.addProphecy('movement-1', 'user-1', 'Fara bene')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Hai già fatto una profezia per questo movimento')
    })

    it('returns error when content is empty', async () => {
      mockPrisma.playerMovement.findUnique.mockResolvedValue({
        id: 'movement-1',
        leagueId: 'league-1',
        fromMember: null,
        toMember: { id: 'member-1' },
        toMemberId: 'member-1',
        fromMemberId: null,
      })
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'member-1' })
      mockPrisma.prophecy.findUnique.mockResolvedValue(null)

      const result = await movementService.addProphecy('movement-1', 'user-1', '   ')

      expect(result.success).toBe(false)
      expect(result.message).toBe('La profezia non può essere vuota')
    })

    it('returns error when content exceeds 500 characters', async () => {
      mockPrisma.playerMovement.findUnique.mockResolvedValue({
        id: 'movement-1',
        leagueId: 'league-1',
        fromMember: null,
        toMember: { id: 'member-1' },
        toMemberId: 'member-1',
        fromMemberId: null,
      })
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'member-1' })
      mockPrisma.prophecy.findUnique.mockResolvedValue(null)

      const result = await movementService.addProphecy('movement-1', 'user-1', 'x'.repeat(501))

      expect(result.success).toBe(false)
      expect(result.message).toBe('La profezia non può superare i 500 caratteri')
    })

    it('creates prophecy successfully as buyer', async () => {
      mockPrisma.playerMovement.findUnique.mockResolvedValue({
        id: 'movement-1',
        leagueId: 'league-1',
        playerId: 'player-1',
        fromMember: null,
        toMember: { id: 'member-1' },
        toMemberId: 'member-1',
        fromMemberId: null,
      })
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'member-1' })
      mockPrisma.prophecy.findUnique.mockResolvedValue(null)
      mockPrisma.prophecy.create.mockResolvedValue({
        id: 'prophecy-1',
        content: 'Fara bene',
        authorRole: 'BUYER',
        player: { name: 'Leao' },
        author: { user: { username: 'manager1' } },
      })

      const result = await movementService.addProphecy('movement-1', 'user-1', 'Fara bene')

      expect(result.success).toBe(true)
      expect(result.message).toBe('Profezia registrata')
      const data = result.data as Record<string, unknown>
      expect(data.content).toBe('Fara bene')
      expect(data.authorRole).toBe('BUYER')
      expect(data.playerName).toBe('Leao')
    })

    it('creates prophecy as seller when fromMemberId matches', async () => {
      mockPrisma.playerMovement.findUnique.mockResolvedValue({
        id: 'movement-1',
        leagueId: 'league-1',
        playerId: 'player-1',
        fromMember: { id: 'member-1' },
        toMember: { id: 'member-2' },
        toMemberId: 'member-2',
        fromMemberId: 'member-1',
      })
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'member-1' })
      mockPrisma.prophecy.findUnique.mockResolvedValue(null)
      mockPrisma.prophecy.create.mockResolvedValue({
        id: 'prophecy-2',
        content: 'Non vale niente',
        authorRole: 'SELLER',
        player: { name: 'Theo' },
        author: { user: { username: 'manager1' } },
      })

      const result = await movementService.addProphecy('movement-1', 'user-1', 'Non vale niente')

      expect(result.success).toBe(true)
      // Verify SELLER role is used in create call
      const createCall = mockPrisma.prophecy.create.mock.calls[0][0]
      expect(createCall.data.authorRole).toBe('SELLER')
    })
  })

  // ==================== getPlayerProphecies ====================

  describe('getPlayerProphecies', () => {
    it('returns error when user is not a member', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue(null)

      const result = await movementService.getPlayerProphecies('league-1', 'player-1', 'user-1')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non sei membro di questa lega')
    })

    it('returns formatted prophecies', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'member-1' })
      mockPrisma.prophecy.findMany.mockResolvedValue([
        {
          id: 'proph-1',
          content: 'Fara bene',
          authorRole: 'BUYER',
          author: { id: 'member-1', teamName: 'Team Alpha', user: { username: 'manager1' } },
          movement: { movementType: 'ACQUISTO_ASTA' },
          createdAt: new Date('2025-01-15'),
        },
      ])

      const result = await movementService.getPlayerProphecies('league-1', 'player-1', 'user-1')

      expect(result.success).toBe(true)
      const data = result.data as Array<Record<string, unknown>>
      expect(data).toHaveLength(1)
      expect(data[0].content).toBe('Fara bene')
      expect(data[0].movementType).toBe('ACQUISTO_ASTA')
      const author = data[0].author as Record<string, unknown>
      expect(author.username).toBe('manager1')
    })
  })

  // ==================== canMakeProphecy ====================

  describe('canMakeProphecy', () => {
    it('returns error when movement not found', async () => {
      mockPrisma.playerMovement.findUnique.mockResolvedValue(null)

      const result = await movementService.canMakeProphecy('movement-1', 'user-1')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Movimento non trovato')
    })

    it('returns error when user is not a member', async () => {
      mockPrisma.playerMovement.findUnique.mockResolvedValue({
        id: 'movement-1',
        leagueId: 'league-1',
        toMemberId: 'member-1',
        fromMemberId: null,
        player: { name: 'Leao' },
      })
      mockPrisma.leagueMember.findFirst.mockResolvedValue(null)

      const result = await movementService.canMakeProphecy('movement-1', 'user-1')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non sei membro di questa lega')
    })

    it('returns canMakeProphecy=false when user is not involved', async () => {
      mockPrisma.playerMovement.findUnique.mockResolvedValue({
        id: 'movement-1',
        leagueId: 'league-1',
        toMemberId: 'member-2',
        fromMemberId: 'member-3',
        player: { name: 'Leao' },
      })
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'member-99' })

      const result = await movementService.canMakeProphecy('movement-1', 'user-1')

      expect(result.success).toBe(true)
      const data = result.data as Record<string, unknown>
      expect(data.canMakeProphecy).toBe(false)
      expect(data.reason).toBe('Non sei coinvolto in questo movimento')
    })

    it('returns canMakeProphecy=false when prophecy already exists', async () => {
      mockPrisma.playerMovement.findUnique.mockResolvedValue({
        id: 'movement-1',
        leagueId: 'league-1',
        toMemberId: 'member-1',
        fromMemberId: null,
        player: { name: 'Leao' },
      })
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'member-1' })
      mockPrisma.prophecy.findUnique.mockResolvedValue({
        content: 'Fara bene',
        createdAt: new Date('2025-01-15'),
      })

      const result = await movementService.canMakeProphecy('movement-1', 'user-1')

      expect(result.success).toBe(true)
      const data = result.data as Record<string, unknown>
      expect(data.canMakeProphecy).toBe(false)
      expect(data.reason).toBe('Hai già fatto una profezia per questo movimento')
      expect(data.existingProphecy).toBeDefined()
    })

    it('returns canMakeProphecy=true with BUYER role', async () => {
      mockPrisma.playerMovement.findUnique.mockResolvedValue({
        id: 'movement-1',
        leagueId: 'league-1',
        toMemberId: 'member-1',
        fromMemberId: 'member-2',
        player: { name: 'Leao' },
      })
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'member-1' })
      mockPrisma.prophecy.findUnique.mockResolvedValue(null)

      const result = await movementService.canMakeProphecy('movement-1', 'user-1')

      expect(result.success).toBe(true)
      const data = result.data as Record<string, unknown>
      expect(data.canMakeProphecy).toBe(true)
      expect(data.role).toBe('BUYER')
      expect(data.playerName).toBe('Leao')
    })

    it('returns canMakeProphecy=true with SELLER role', async () => {
      mockPrisma.playerMovement.findUnique.mockResolvedValue({
        id: 'movement-1',
        leagueId: 'league-1',
        toMemberId: 'member-2',
        fromMemberId: 'member-1',
        player: { name: 'Theo' },
      })
      mockPrisma.leagueMember.findFirst.mockResolvedValue({ id: 'member-1' })
      mockPrisma.prophecy.findUnique.mockResolvedValue(null)

      const result = await movementService.canMakeProphecy('movement-1', 'user-1')

      expect(result.success).toBe(true)
      const data = result.data as Record<string, unknown>
      expect(data.canMakeProphecy).toBe(true)
      expect(data.role).toBe('SELLER')
      expect(data.playerName).toBe('Theo')
    })
  })
})
