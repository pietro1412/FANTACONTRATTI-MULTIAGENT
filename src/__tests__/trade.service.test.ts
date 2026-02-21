/**
 * trade.service.test.ts - Unit Tests for Trade Service
 *
 * Tests for trade offer creation, acceptance, rejection, cancellation,
 * retrieval, counter offers, trade history, and stale offer invalidation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Hoist mock before imports
const { mockPrisma, MockPrismaClient } = vi.hoisted(() => {
  const mock = {
    leagueMember: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    tradeOffer: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    playerRoster: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    playerContract: {
      updateMany: vi.fn(),
    },
    marketSession: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    league: {
      findUnique: vi.fn(),
    },
    movement: {
      create: vi.fn(),
    },
    $transaction: vi.fn((cb: unknown) => (cb as (tx: typeof mock) => unknown)(mock)),
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
  TradeStatus: {
    PENDING: 'PENDING',
    ACCEPTED: 'ACCEPTED',
    REJECTED: 'REJECTED',
    COUNTERED: 'COUNTERED',
    CANCELLED: 'CANCELLED',
    INVALIDATED: 'INVALIDATED',
    EXPIRED: 'EXPIRED',
  },
}))

// Mock dependent services
vi.mock('../services/movement.service', () => ({
  recordMovement: vi.fn().mockResolvedValue('movement-id'),
}))

vi.mock('../services/notification.service', () => ({
  notifyTradeOffer: vi.fn().mockResolvedValue(undefined),
  notifyTradeInvalidated: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../services/pusher.service', () => ({
  triggerTradeOfferReceived: vi.fn().mockResolvedValue(undefined),
  triggerTradeUpdated: vi.fn().mockResolvedValue(undefined),
}))

// Import after mocking
import * as tradeService from '../services/trade.service'
import { notifyTradeOffer, notifyTradeInvalidated } from '../services/notification.service'
import { triggerTradeOfferReceived, triggerTradeUpdated } from '../services/pusher.service'
import { recordMovement } from '../services/movement.service'

// Cast mocked imports for re-setup in beforeEach
const mockNotifyTradeOffer = vi.mocked(notifyTradeOffer)
const mockNotifyTradeInvalidated = vi.mocked(notifyTradeInvalidated)
const mockTriggerTradeOfferReceived = vi.mocked(triggerTradeOfferReceived)
const mockTriggerTradeUpdated = vi.mocked(triggerTradeUpdated)
const mockRecordMovement = vi.mocked(recordMovement)

// --------------- HELPERS ---------------

function makeMember(overrides = {}) {
  return {
    id: 'member-sender',
    leagueId: 'league-1',
    userId: 'user-sender',
    status: 'ACTIVE',
    currentBudget: 100,
    ...overrides,
  }
}

function makeActiveSession(overrides = {}) {
  return {
    id: 'session-1',
    leagueId: 'league-1',
    status: 'ACTIVE',
    currentPhase: 'OFFERTE_PRE_RINNOVO',
    ...overrides,
  }
}

function makeTrade(overrides = {}) {
  return {
    id: 'trade-1',
    marketSessionId: 'session-1',
    senderId: 'user-sender',
    receiverId: 'user-receiver',
    offeredPlayers: ['roster-a'],
    requestedPlayers: ['roster-b'],
    involvedPlayers: ['roster-a', 'roster-b'],
    offeredBudget: 0,
    requestedBudget: 0,
    message: null,
    status: 'PENDING',
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 86400000),
    respondedAt: null,
    sender: { id: 'user-sender', username: 'senderUser' },
    receiver: { id: 'user-receiver', username: 'receiverUser' },
    marketSession: { leagueId: 'league-1' },
    ...overrides,
  }
}

// --------------- TESTS ---------------

describe('Trade Service', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    // Restore $transaction passthrough after reset clears implementations
    mockPrisma.$transaction.mockImplementation((cb: unknown) =>
      (cb as (tx: typeof mockPrisma) => unknown)(mockPrisma)
    )
    // Restore fire-and-forget service mocks (must return Promises for .catch())
    mockNotifyTradeOffer.mockResolvedValue(undefined)
    mockNotifyTradeInvalidated.mockResolvedValue(undefined)
    mockTriggerTradeOfferReceived.mockResolvedValue(undefined)
    mockTriggerTradeUpdated.mockResolvedValue(undefined)
    mockRecordMovement.mockResolvedValue('movement-id')
  })

  // ==================== createTradeOffer ====================

  describe('createTradeOffer', () => {
    it('should return error when sender is not a league member', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue(null)

      const result = await tradeService.createTradeOffer(
        'league-1', 'user-sender', 'member-receiver',
        ['roster-a'], ['roster-b'], 0, 0
      )

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non sei membro di questa lega')
    })

    it('should return error when receiver is invalid', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue(makeMember())
      mockPrisma.leagueMember.findUnique.mockResolvedValue(null)

      const result = await tradeService.createTradeOffer(
        'league-1', 'user-sender', 'member-receiver',
        ['roster-a'], ['roster-b'], 0, 0
      )

      expect(result.success).toBe(false)
      expect(result.message).toBe('Destinatario non valido')
    })

    it('should return error when sender tries to trade with self', async () => {
      const sender = makeMember({ id: 'member-sender' })
      mockPrisma.leagueMember.findFirst.mockResolvedValue(sender)
      mockPrisma.leagueMember.findUnique.mockResolvedValue({
        id: 'member-sender', leagueId: 'league-1', status: 'ACTIVE', userId: 'user-receiver', user: {},
      })

      const result = await tradeService.createTradeOffer(
        'league-1', 'user-sender', 'member-sender',
        ['roster-a'], ['roster-b'], 0, 0
      )

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non puoi fare offerte a te stesso')
    })

    it('should return error when not in trade phase', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue(makeMember())
      mockPrisma.leagueMember.findUnique.mockResolvedValue({
        id: 'member-receiver', leagueId: 'league-1', status: 'ACTIVE', userId: 'user-receiver', user: {},
      })
      // No active session in trade phase
      mockPrisma.marketSession.findFirst.mockResolvedValue(null)

      const result = await tradeService.createTradeOffer(
        'league-1', 'user-sender', 'member-receiver',
        ['roster-a'], ['roster-b'], 0, 0
      )

      expect(result.success).toBe(false)
      expect(result.message).toBe('Puoi fare scambi solo durante la fase SCAMBI/OFFERTE')
    })

    it('should return error when offered players do not belong to sender', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue(makeMember())
      mockPrisma.leagueMember.findUnique.mockResolvedValue({
        id: 'member-receiver', leagueId: 'league-1', status: 'ACTIVE', userId: 'user-receiver', user: {},
      })
      // First call = isInTradePhase, second = get active session
      mockPrisma.marketSession.findFirst
        .mockResolvedValueOnce(makeActiveSession()) // isInTradePhase
        .mockResolvedValueOnce(makeActiveSession()) // active session lookup in createTradeOffer
      // Offered players check - returns fewer than sent
      mockPrisma.playerRoster.findMany.mockResolvedValue([])

      const result = await tradeService.createTradeOffer(
        'league-1', 'user-sender', 'member-receiver',
        ['roster-a'], [], 0, 0
      )

      expect(result.success).toBe(false)
      expect(result.message).toBe('Alcuni giocatori offerti non sono nella tua rosa')
    })

    it('should return error when requested players do not belong to receiver', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue(makeMember())
      mockPrisma.leagueMember.findUnique.mockResolvedValue({
        id: 'member-receiver', leagueId: 'league-1', status: 'ACTIVE', userId: 'user-receiver', user: {},
      })
      mockPrisma.marketSession.findFirst
        .mockResolvedValueOnce(makeActiveSession())
        .mockResolvedValueOnce(makeActiveSession())
      // Offered rosters valid (empty offered)
      // Requested rosters check returns fewer than sent
      mockPrisma.playerRoster.findMany.mockResolvedValue([])

      const result = await tradeService.createTradeOffer(
        'league-1', 'user-sender', 'member-receiver',
        [], ['roster-b'], 0, 0
      )

      expect(result.success).toBe(false)
      expect(result.message).toBe('Alcuni giocatori richiesti non sono nella rosa del destinatario')
    })

    it('should return error when offered budget is negative', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue(makeMember())
      mockPrisma.leagueMember.findUnique.mockResolvedValue({
        id: 'member-receiver', leagueId: 'league-1', status: 'ACTIVE', userId: 'user-receiver', user: {},
      })
      mockPrisma.marketSession.findFirst
        .mockResolvedValueOnce(makeActiveSession())
        .mockResolvedValueOnce(makeActiveSession())

      const result = await tradeService.createTradeOffer(
        'league-1', 'user-sender', 'member-receiver',
        [], [], -5, 0
      )

      expect(result.success).toBe(false)
      expect(result.message).toBe('I budget devono essere positivi')
    })

    it('should return error when offered budget exceeds sender budget', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue(makeMember({ currentBudget: 10 }))
      mockPrisma.leagueMember.findUnique.mockResolvedValue({
        id: 'member-receiver', leagueId: 'league-1', status: 'ACTIVE', userId: 'user-receiver', user: {},
      })
      mockPrisma.marketSession.findFirst
        .mockResolvedValueOnce(makeActiveSession())
        .mockResolvedValueOnce(makeActiveSession())

      const result = await tradeService.createTradeOffer(
        'league-1', 'user-sender', 'member-receiver',
        [], [], 50, 0
      )

      expect(result.success).toBe(false)
      expect(result.message).toContain('Non hai abbastanza budget')
    })

    it('should return error when a reverse trade already exists in same session', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue(makeMember())
      mockPrisma.leagueMember.findUnique.mockResolvedValue({
        id: 'member-receiver', leagueId: 'league-1', status: 'ACTIVE', userId: 'user-receiver', user: {},
      })
      mockPrisma.marketSession.findFirst
        .mockResolvedValueOnce(makeActiveSession())
        .mockResolvedValueOnce(makeActiveSession())
      // Reverse trade exists
      mockPrisma.tradeOffer.findFirst.mockResolvedValue({ id: 'reverse-trade' })

      const result = await tradeService.createTradeOffer(
        'league-1', 'user-sender', 'member-receiver',
        [], [], 0, 0
      )

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non puoi fare uno scambio inverso nella stessa sessione di mercato')
    })

    it('should create trade offer successfully', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue(makeMember())
      mockPrisma.leagueMember.findUnique.mockResolvedValue({
        id: 'member-receiver', leagueId: 'league-1', status: 'ACTIVE', userId: 'user-receiver', user: {},
      })
      mockPrisma.marketSession.findFirst
        .mockResolvedValueOnce(makeActiveSession())
        .mockResolvedValueOnce(makeActiveSession())
      // No reverse trade
      mockPrisma.tradeOffer.findFirst.mockResolvedValue(null)
      // No pending overlapping offers
      mockPrisma.tradeOffer.findMany.mockResolvedValue([])
      // Trade created
      const createdTrade = makeTrade()
      mockPrisma.tradeOffer.create.mockResolvedValue(createdTrade)
      mockPrisma.league.findUnique.mockResolvedValue({ name: 'Test League' })

      const result = await tradeService.createTradeOffer(
        'league-1', 'user-sender', 'member-receiver',
        [], [], 0, 0, 'Hello'
      )

      expect(result.success).toBe(true)
      expect(result.message).toBe('Offerta inviata')
      expect(result.data).toBeDefined()
    })

    it('should include warnings when players are in other pending offers', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue(makeMember())
      mockPrisma.leagueMember.findUnique.mockResolvedValue({
        id: 'member-receiver', leagueId: 'league-1', status: 'ACTIVE', userId: 'user-receiver', user: {},
      })
      mockPrisma.marketSession.findFirst
        .mockResolvedValueOnce(makeActiveSession())
        .mockResolvedValueOnce(makeActiveSession())
      mockPrisma.tradeOffer.findFirst.mockResolvedValue(null)
      // Offered player roster validates ok
      mockPrisma.playerRoster.findMany.mockResolvedValue([{ id: 'roster-a' }])
      // Existing pending offer with overlapping player
      mockPrisma.tradeOffer.findMany.mockResolvedValue([
        { id: 'other-trade', involvedPlayers: ['roster-a', 'roster-c'], status: 'PENDING' },
      ])
      const createdTrade = makeTrade()
      mockPrisma.tradeOffer.create.mockResolvedValue(createdTrade)
      mockPrisma.league.findUnique.mockResolvedValue({ name: 'Test League' })

      const result = await tradeService.createTradeOffer(
        'league-1', 'user-sender', 'member-receiver',
        ['roster-a'], [], 0, 0
      )

      expect(result.success).toBe(true)
      expect(result.warnings).toBeDefined()
      expect(result.warnings![0]).toContain('offerta/e in corso')
    })
  })

  // ==================== getReceivedOffers ====================

  describe('getReceivedOffers', () => {
    it('should return error when user is not a league member', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue(null)

      const result = await tradeService.getReceivedOffers('league-1', 'user-1')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non sei membro di questa lega')
    })

    it('should return enriched received offers successfully', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue(makeMember({ userId: 'user-1' }))
      mockPrisma.marketSession.findFirst.mockResolvedValue(makeActiveSession())
      mockPrisma.tradeOffer.findMany.mockResolvedValue([
        {
          id: 'trade-1',
          senderId: 'user-sender',
          receiverId: 'user-1',
          offeredPlayers: ['roster-a'],
          requestedPlayers: ['roster-b'],
          offeredBudget: 5,
          requestedBudget: 0,
          message: 'Offer msg',
          status: 'PENDING',
          createdAt: new Date(),
          expiresAt: new Date(),
          sender: { id: 'user-sender', username: 'senderUser' },
        },
      ])
      // First call: offeredPlayers enrichment, second: requestedPlayers enrichment
      mockPrisma.playerRoster.findMany
        .mockResolvedValueOnce([{
          id: 'roster-a',
          player: { id: 'p1', name: 'Leao', team: 'Milan', position: 'A' },
          contract: { salary: 10, duration: 3, rescissionClause: 20 },
        }])
        .mockResolvedValueOnce([{
          id: 'roster-b',
          player: { id: 'p2', name: 'Lautaro', team: 'Inter', position: 'A' },
          contract: { salary: 15, duration: 2, rescissionClause: 30 },
        }])

      const result = await tradeService.getReceivedOffers('league-1', 'user-1')

      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(1)
      const offer = (result.data as Array<Record<string, unknown>>)[0]
      expect(offer.offeredPlayerDetails).toBeDefined()
      expect(offer.requestedPlayerDetails).toBeDefined()
    })
  })

  // ==================== getSentOffers ====================

  describe('getSentOffers', () => {
    it('should return error when user is not a league member', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue(null)

      const result = await tradeService.getSentOffers('league-1', 'user-1')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non sei membro di questa lega')
    })

    it('should return enriched sent offers successfully', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue(makeMember({ userId: 'user-1' }))
      mockPrisma.marketSession.findFirst.mockResolvedValue(makeActiveSession())
      mockPrisma.tradeOffer.findMany.mockResolvedValue([
        {
          id: 'trade-2',
          senderId: 'user-1',
          receiverId: 'user-receiver',
          offeredPlayers: [],
          requestedPlayers: [],
          offeredBudget: 0,
          requestedBudget: 10,
          message: null,
          status: 'PENDING',
          createdAt: new Date(),
          expiresAt: new Date(),
          receiver: { id: 'user-receiver', username: 'receiverUser' },
        },
      ])
      mockPrisma.playerRoster.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])

      const result = await tradeService.getSentOffers('league-1', 'user-1')

      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(1)
    })
  })

  // ==================== acceptTrade ====================

  describe('acceptTrade', () => {
    it('should return error when trade not found', async () => {
      mockPrisma.tradeOffer.findUnique.mockResolvedValue(null)

      const result = await tradeService.acceptTrade('trade-999', 'user-receiver')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Offerta non trovata')
    })

    it('should return error when user is not the receiver', async () => {
      mockPrisma.tradeOffer.findUnique.mockResolvedValue(
        makeTrade({ receiverId: 'user-other' })
      )

      const result = await tradeService.acceptTrade('trade-1', 'user-receiver')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non sei autorizzato ad accettare questa offerta')
    })

    it('should return error when trade is not pending', async () => {
      mockPrisma.tradeOffer.findUnique.mockResolvedValue(
        makeTrade({ status: 'ACCEPTED' })
      )

      const result = await tradeService.acceptTrade('trade-1', 'user-receiver')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Questa offerta non è più valida')
    })

    it('should return error when not in trade phase at accept time', async () => {
      mockPrisma.tradeOffer.findUnique.mockResolvedValue(makeTrade())
      // isInTradePhase returns false
      mockPrisma.marketSession.findFirst.mockResolvedValue(null)

      const result = await tradeService.acceptTrade('trade-1', 'user-receiver')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Puoi accettare scambi solo durante la fase SCAMBI/OFFERTE')
    })

    it('should return error when one of the members is no longer active', async () => {
      mockPrisma.tradeOffer.findUnique.mockResolvedValue(makeTrade())
      mockPrisma.marketSession.findFirst.mockResolvedValue(makeActiveSession())
      // Sender not found
      mockPrisma.leagueMember.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(makeMember({ id: 'member-receiver', userId: 'user-receiver' }))

      const result = await tradeService.acceptTrade('trade-1', 'user-receiver')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Uno dei membri non è più attivo nella lega')
    })

    it('should return error when receiver budget insufficient for requested amount', async () => {
      mockPrisma.tradeOffer.findUnique.mockResolvedValue(
        makeTrade({ requestedBudget: 50 })
      )
      mockPrisma.marketSession.findFirst.mockResolvedValue(makeActiveSession())
      mockPrisma.leagueMember.findFirst
        .mockResolvedValueOnce(makeMember({ id: 'member-sender', userId: 'user-sender', currentBudget: 100 }))
        .mockResolvedValueOnce(makeMember({ id: 'member-receiver', userId: 'user-receiver', currentBudget: 10 }))

      const result = await tradeService.acceptTrade('trade-1', 'user-receiver')

      expect(result.success).toBe(false)
      expect(result.message).toContain('Budget insufficiente')
    })

    it('should invalidate trade when offered players are no longer in sender roster', async () => {
      mockPrisma.tradeOffer.findUnique.mockResolvedValue(
        makeTrade({ offeredPlayers: ['roster-a'] })
      )
      mockPrisma.marketSession.findFirst.mockResolvedValue(makeActiveSession())
      mockPrisma.leagueMember.findFirst
        .mockResolvedValueOnce(makeMember({ id: 'member-sender', userId: 'user-sender' }))
        .mockResolvedValueOnce(makeMember({ id: 'member-receiver', userId: 'user-receiver' }))
      // Player re-validation fails (no roster returned)
      mockPrisma.playerRoster.findMany.mockResolvedValue([])
      mockPrisma.tradeOffer.update.mockResolvedValue({})

      const result = await tradeService.acceptTrade('trade-1', 'user-receiver')

      expect(result.success).toBe(false)
      expect(result.message).toContain('giocatori offerti non sono più nella rosa del mittente')
      expect(mockPrisma.tradeOffer.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'INVALIDATED' }),
        })
      )
    })

    it('should accept trade and execute player/budget transfers', async () => {
      const trade = makeTrade({
        offeredPlayers: ['roster-a'],
        requestedPlayers: ['roster-b'],
        offeredBudget: 5,
        requestedBudget: 3,
      })
      mockPrisma.tradeOffer.findUnique.mockResolvedValue(trade)
      mockPrisma.marketSession.findFirst.mockResolvedValue(makeActiveSession())
      mockPrisma.leagueMember.findFirst
        .mockResolvedValueOnce(makeMember({ id: 'member-sender', userId: 'user-sender', currentBudget: 100 }))
        .mockResolvedValueOnce(makeMember({ id: 'member-receiver', userId: 'user-receiver', currentBudget: 100 }))
      // Re-validate offered and requested players
      mockPrisma.playerRoster.findMany
        .mockResolvedValueOnce([{ id: 'roster-a' }])   // offered validation
        .mockResolvedValueOnce([{ id: 'roster-b' }])   // requested validation
        .mockResolvedValueOnce([{ id: 'roster-a', playerId: 'p1', contract: { salary: 10, duration: 2, rescissionClause: 20 } }]) // offeredRosters for movements
        .mockResolvedValueOnce([{ id: 'roster-b', playerId: 'p2', contract: { salary: 15, duration: 3, rescissionClause: 30 } }]) // requestedRosters for movements
        .mockResolvedValueOnce([{   // receivedPlayers for modification
          id: 'roster-a', playerId: 'p1',
          player: { id: 'p1', name: 'Leao', team: 'Milan', position: 'A' },
          contract: { id: 'c1', salary: 10, duration: 2, initialSalary: 8, rescissionClause: 20 },
        }])
      // Transaction mocks (tx delegates to the same mock)
      mockPrisma.playerRoster.update.mockResolvedValue({})
      mockPrisma.playerContract.updateMany.mockResolvedValue({})
      mockPrisma.leagueMember.update.mockResolvedValue({})
      mockPrisma.tradeOffer.update.mockResolvedValue({})
      // Conflicting offers
      mockPrisma.tradeOffer.findMany.mockResolvedValue([])
      mockPrisma.tradeOffer.updateMany.mockResolvedValue({})

      const result = await tradeService.acceptTrade('trade-1', 'user-receiver')

      expect(result.success).toBe(true)
      expect(result.message).toBe('Scambio completato!')
      expect(result.data).toBeDefined()
    })
  })

  // ==================== rejectTrade ====================

  describe('rejectTrade', () => {
    it('should return error when trade not found', async () => {
      mockPrisma.tradeOffer.findUnique.mockResolvedValue(null)

      const result = await tradeService.rejectTrade('trade-999', 'user-receiver')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Offerta non trovata')
    })

    it('should return error when user is not the receiver', async () => {
      mockPrisma.tradeOffer.findUnique.mockResolvedValue(
        makeTrade({ receiverId: 'user-other' })
      )

      const result = await tradeService.rejectTrade('trade-1', 'user-receiver')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non sei autorizzato a rifiutare questa offerta')
    })

    it('should return error when trade is not pending', async () => {
      mockPrisma.tradeOffer.findUnique.mockResolvedValue(
        makeTrade({ status: 'REJECTED' })
      )

      const result = await tradeService.rejectTrade('trade-1', 'user-receiver')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Questa offerta non è più valida')
    })

    it('should reject trade successfully', async () => {
      mockPrisma.tradeOffer.findUnique.mockResolvedValue(makeTrade())
      mockPrisma.tradeOffer.update.mockResolvedValue({
        ...makeTrade({ status: 'REJECTED' }),
        marketSession: { leagueId: 'league-1' },
      })

      const result = await tradeService.rejectTrade('trade-1', 'user-receiver')

      expect(result.success).toBe(true)
      expect(result.message).toBe('Offerta rifiutata')
      expect(mockPrisma.tradeOffer.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'REJECTED' }),
        })
      )
    })
  })

  // ==================== cancelTradeOffer ====================

  describe('cancelTradeOffer', () => {
    it('should return error when trade not found', async () => {
      mockPrisma.tradeOffer.findUnique.mockResolvedValue(null)

      const result = await tradeService.cancelTradeOffer('trade-999', 'user-sender')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Offerta non trovata')
    })

    it('should return error when user is not the sender', async () => {
      mockPrisma.tradeOffer.findUnique.mockResolvedValue(
        makeTrade({ senderId: 'user-other' })
      )

      const result = await tradeService.cancelTradeOffer('trade-1', 'user-sender')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non sei autorizzato a cancellare questa offerta')
    })

    it('should return error when trade is not pending', async () => {
      mockPrisma.tradeOffer.findUnique.mockResolvedValue(
        makeTrade({ status: 'ACCEPTED' })
      )

      const result = await tradeService.cancelTradeOffer('trade-1', 'user-sender')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Questa offerta non può essere cancellata')
    })

    it('should cancel trade offer successfully', async () => {
      mockPrisma.tradeOffer.findUnique.mockResolvedValue(makeTrade())
      mockPrisma.tradeOffer.update.mockResolvedValue({
        ...makeTrade({ status: 'CANCELLED' }),
        marketSession: { leagueId: 'league-1' },
      })

      const result = await tradeService.cancelTradeOffer('trade-1', 'user-sender')

      expect(result.success).toBe(true)
      expect(result.message).toBe('Offerta cancellata')
      expect(mockPrisma.tradeOffer.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'CANCELLED' }),
        })
      )
    })
  })

  // ==================== getTradeHistory ====================

  describe('getTradeHistory', () => {
    it('should return error when user is not a league member', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue(null)

      const result = await tradeService.getTradeHistory('league-1', 'user-1')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Non sei membro di questa lega')
    })

    it('should return enriched trade history successfully', async () => {
      mockPrisma.leagueMember.findFirst.mockResolvedValue(makeMember({ userId: 'user-1' }))
      mockPrisma.tradeOffer.findMany.mockResolvedValue([
        {
          id: 'trade-hist-1',
          senderId: 'user-sender',
          receiverId: 'user-1',
          offeredPlayers: [],
          requestedPlayers: [],
          offeredBudget: 0,
          requestedBudget: 0,
          message: null,
          status: 'ACCEPTED',
          createdAt: new Date(),
          respondedAt: new Date(),
          sender: { id: 'user-sender', username: 'senderUser' },
          receiver: { id: 'user-1', username: 'user1' },
        },
      ])
      mockPrisma.playerRoster.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])

      const result = await tradeService.getTradeHistory('league-1', 'user-1')

      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(1)
    })
  })
})
