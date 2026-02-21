/**
 * pusher.service.extra.test.ts - Additional Unit Tests for Pusher Service
 *
 * Covers uncovered lines: 199, 295, 324-527
 * - triggerPauseRequested (line 295)
 * - Rubata trigger functions (lines 324-355)
 * - Svincolati trigger functions (lines 390-425)
 * - Indemnity trigger functions (lines 445-460)
 * - League/Trade trigger functions (lines 464-528)
 * - triggerEvent returning false when pusher is null (line 199)
 * - triggerLeagueEvent error handling (line 486)
 */

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'

// Mock pusher module with a class-based mock
const mockTrigger = vi.fn().mockResolvedValue({})

class MockPusher {
  trigger = mockTrigger
}

vi.mock('pusher', () => {
  return {
    default: MockPusher,
    __esModule: true,
  }
})

// Set environment variables BEFORE any imports
beforeAll(() => {
  process.env.PUSHER_APP_ID = 'test-app-id'
  process.env.VITE_PUSHER_KEY = 'test-key'
  process.env.PUSHER_SECRET = 'test-secret'
  process.env.VITE_PUSHER_CLUSTER = 'eu'
})

// Helper to get a fresh module instance with pusher configured
async function freshImport() {
  vi.resetModules()
  process.env.PUSHER_APP_ID = 'test-app-id'
  process.env.VITE_PUSHER_KEY = 'test-key'
  process.env.PUSHER_SECRET = 'test-secret'
  process.env.VITE_PUSHER_CLUSTER = 'eu'
  return await import('../services/pusher.service')
}

describe('pusher.service (extra coverage)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTrigger.mockResolvedValue({})
  })

  // ==================== triggerPauseRequested (line 295) ====================

  describe('triggerPauseRequested', () => {
    it('should trigger pause-requested event with nomination type', async () => {
      const mod = await freshImport()

      const data = {
        memberId: 'member-1',
        username: 'TestUser',
        type: 'nomination' as const,
      }

      const result = await mod.triggerPauseRequested('session-abc', data)

      expect(result).toBe(true)
      expect(mockTrigger).toHaveBeenCalledWith(
        'auction-session-abc',
        mod.PUSHER_EVENTS.PAUSE_REQUESTED,
        expect.objectContaining({
          memberId: 'member-1',
          username: 'TestUser',
          type: 'nomination',
          serverTimestamp: expect.any(Number),
        })
      )
    })

    it('should trigger pause-requested event with auction type', async () => {
      const mod = await freshImport()

      const data = {
        memberId: 'member-2',
        username: 'AnotherUser',
        type: 'auction' as const,
      }

      const result = await mod.triggerPauseRequested('session-xyz', data)

      expect(result).toBe(true)
      expect(mockTrigger).toHaveBeenCalledWith(
        'auction-session-xyz',
        'pause-requested',
        expect.objectContaining({ type: 'auction' })
      )
    })
  })

  // ==================== Rubata trigger functions (lines 320-355) ====================

  describe('triggerRubataStealDeclared', () => {
    it('should trigger rubata-steal-declared event', async () => {
      const mod = await freshImport()

      const data = {
        sessionId: 'session-1',
        bidderId: 'bidder-1',
        bidderUsername: 'Bidder',
        playerId: 'player-1',
        playerName: 'Leao',
        playerTeam: 'Milan',
        playerPosition: 'A',
        ownerUsername: 'Owner',
        basePrice: 25,
        timestamp: '2026-01-01T00:00:00.000Z',
      }

      const result = await mod.triggerRubataStealDeclared('session-1', data)

      expect(result).toBe(true)
      expect(mockTrigger).toHaveBeenCalledWith(
        'auction-session-1',
        mod.PUSHER_EVENTS.RUBATA_STEAL_DECLARED,
        expect.objectContaining({
          bidderId: 'bidder-1',
          playerName: 'Leao',
          basePrice: 25,
          serverTimestamp: expect.any(Number),
        })
      )
    })
  })

  describe('triggerRubataBidPlaced', () => {
    it('should trigger rubata-bid-placed event', async () => {
      const mod = await freshImport()

      const data = {
        sessionId: 'session-1',
        auctionId: 'auction-1',
        bidderId: 'bidder-1',
        bidderUsername: 'Bidder',
        amount: 30,
        playerName: 'Leao',
        timestamp: '2026-01-01T00:00:00.000Z',
      }

      const result = await mod.triggerRubataBidPlaced('session-1', data)

      expect(result).toBe(true)
      expect(mockTrigger).toHaveBeenCalledWith(
        'auction-session-1',
        mod.PUSHER_EVENTS.RUBATA_BID_PLACED,
        expect.objectContaining({
          auctionId: 'auction-1',
          amount: 30,
          serverTimestamp: expect.any(Number),
        })
      )
    })
  })

  describe('triggerRubataStateChanged', () => {
    it('should trigger rubata-state-changed event', async () => {
      const mod = await freshImport()

      const data = {
        sessionId: 'session-1',
        newState: 'BIDDING',
        currentIndex: 3,
        timestamp: '2026-01-01T00:00:00.000Z',
      }

      const result = await mod.triggerRubataStateChanged('session-1', data)

      expect(result).toBe(true)
      expect(mockTrigger).toHaveBeenCalledWith(
        'auction-session-1',
        mod.PUSHER_EVENTS.RUBATA_STATE_CHANGED,
        expect.objectContaining({
          newState: 'BIDDING',
          currentIndex: 3,
        })
      )
    })
  })

  describe('triggerRubataReadyChanged', () => {
    it('should trigger rubata-ready-changed event', async () => {
      const mod = await freshImport()

      const data = {
        sessionId: 'session-1',
        memberId: 'member-1',
        memberUsername: 'TestUser',
        isReady: true,
        readyCount: 5,
        totalMembers: 8,
        timestamp: '2026-01-01T00:00:00.000Z',
      }

      const result = await mod.triggerRubataReadyChanged('session-1', data)

      expect(result).toBe(true)
      expect(mockTrigger).toHaveBeenCalledWith(
        'auction-session-1',
        mod.PUSHER_EVENTS.RUBATA_READY_CHANGED,
        expect.objectContaining({
          memberId: 'member-1',
          isReady: true,
          readyCount: 5,
        })
      )
    })
  })

  // ==================== Svincolati trigger functions (lines 390-425) ====================

  describe('triggerSvincolatiStateChanged', () => {
    it('should trigger svincolati-state-changed event', async () => {
      const mod = await freshImport()

      const data = {
        state: 'NOMINATING',
        currentTurnMemberId: 'member-1',
        currentTurnUsername: 'TestUser',
        passedMembers: ['member-2', 'member-3'],
      }

      const result = await mod.triggerSvincolatiStateChanged('session-1', data)

      expect(result).toBe(true)
      expect(mockTrigger).toHaveBeenCalledWith(
        'auction-session-1',
        mod.PUSHER_EVENTS.SVINCOLATI_STATE_CHANGED,
        expect.objectContaining({
          state: 'NOMINATING',
          currentTurnMemberId: 'member-1',
          passedMembers: ['member-2', 'member-3'],
        })
      )
    })

    it('should handle null current turn member', async () => {
      const mod = await freshImport()

      const data = {
        state: 'WAITING',
        currentTurnMemberId: null,
        currentTurnUsername: null,
        passedMembers: [],
      }

      const result = await mod.triggerSvincolatiStateChanged('session-1', data)

      expect(result).toBe(true)
      expect(mockTrigger).toHaveBeenCalledWith(
        'auction-session-1',
        mod.PUSHER_EVENTS.SVINCOLATI_STATE_CHANGED,
        expect.objectContaining({
          currentTurnMemberId: null,
          currentTurnUsername: null,
        })
      )
    })
  })

  describe('triggerSvincolatiNomination', () => {
    it('should trigger svincolati-nomination event', async () => {
      const mod = await freshImport()

      const data = {
        playerId: 'player-1',
        playerName: 'Leao',
        nominatorId: 'member-1',
        nominatorUsername: 'TestUser',
        confirmed: true,
      }

      const result = await mod.triggerSvincolatiNomination('session-1', data)

      expect(result).toBe(true)
      expect(mockTrigger).toHaveBeenCalledWith(
        'auction-session-1',
        mod.PUSHER_EVENTS.SVINCOLATI_NOMINATION,
        expect.objectContaining({
          playerName: 'Leao',
          confirmed: true,
        })
      )
    })
  })

  describe('triggerSvincolatiBidPlaced', () => {
    it('should trigger svincolati-bid-placed event', async () => {
      const mod = await freshImport()

      const data = {
        auctionId: 'auction-1',
        playerId: 'player-1',
        bidderId: 'member-1',
        bidderUsername: 'TestUser',
        amount: 15,
      }

      const result = await mod.triggerSvincolatiBidPlaced('session-1', data)

      expect(result).toBe(true)
      expect(mockTrigger).toHaveBeenCalledWith(
        'auction-session-1',
        mod.PUSHER_EVENTS.SVINCOLATI_BID_PLACED,
        expect.objectContaining({
          auctionId: 'auction-1',
          amount: 15,
        })
      )
    })
  })

  describe('triggerSvincolatiReadyChanged', () => {
    it('should trigger svincolati-ready-changed event', async () => {
      const mod = await freshImport()

      const data = {
        readyMembers: ['member-1', 'member-2'],
        totalMembers: 8,
      }

      const result = await mod.triggerSvincolatiReadyChanged('session-1', data)

      expect(result).toBe(true)
      expect(mockTrigger).toHaveBeenCalledWith(
        'auction-session-1',
        mod.PUSHER_EVENTS.SVINCOLATI_READY_CHANGED,
        expect.objectContaining({
          readyMembers: ['member-1', 'member-2'],
          totalMembers: 8,
        })
      )
    })
  })

  // ==================== Indemnity trigger functions (lines 445-460) ====================

  describe('triggerIndemnityDecisionSubmitted', () => {
    it('should trigger indemnity-decision-submitted event', async () => {
      const mod = await freshImport()

      const data = {
        memberId: 'member-1',
        memberUsername: 'TestUser',
        decidedCount: 3,
        totalCount: 5,
        timestamp: '2026-01-01T00:00:00.000Z',
      }

      const result = await mod.triggerIndemnityDecisionSubmitted('session-1', data)

      expect(result).toBe(true)
      expect(mockTrigger).toHaveBeenCalledWith(
        'auction-session-1',
        mod.PUSHER_EVENTS.INDEMNITY_DECISION_SUBMITTED,
        expect.objectContaining({
          memberId: 'member-1',
          decidedCount: 3,
          totalCount: 5,
        })
      )
    })
  })

  describe('triggerIndemnityAllDecided', () => {
    it('should trigger indemnity-all-decided event', async () => {
      const mod = await freshImport()

      const data = {
        totalMembers: 8,
        timestamp: '2026-01-01T00:00:00.000Z',
      }

      const result = await mod.triggerIndemnityAllDecided('session-1', data)

      expect(result).toBe(true)
      expect(mockTrigger).toHaveBeenCalledWith(
        'auction-session-1',
        mod.PUSHER_EVENTS.INDEMNITY_ALL_DECIDED,
        expect.objectContaining({
          totalMembers: 8,
        })
      )
    })
  })

  // ==================== League/Trade trigger functions (lines 464-528) ====================

  describe('getLeagueChannelName', () => {
    it('should return correct league channel name', async () => {
      const mod = await freshImport()
      expect(mod.getLeagueChannelName('league-123')).toBe('league-league-123')
    })

    it('should handle different league IDs', async () => {
      const mod = await freshImport()
      expect(mod.getLeagueChannelName('abc')).toBe('league-abc')
      expect(mod.getLeagueChannelName('my-league-456')).toBe('league-my-league-456')
    })
  })

  describe('triggerTradeOfferReceived', () => {
    it('should trigger trade-offer-received on the league channel', async () => {
      const mod = await freshImport()

      const data = {
        tradeId: 'trade-1',
        senderUsername: 'Sender',
        receiverUserId: 'user-2',
        timestamp: '2026-01-01T00:00:00.000Z',
      }

      const result = await mod.triggerTradeOfferReceived('league-1', data)

      expect(result).toBe(true)
      expect(mockTrigger).toHaveBeenCalledWith(
        'league-league-1',
        mod.PUSHER_EVENTS.TRADE_OFFER_RECEIVED,
        expect.objectContaining({
          tradeId: 'trade-1',
          senderUsername: 'Sender',
          receiverUserId: 'user-2',
          serverTimestamp: expect.any(Number),
        })
      )
    })
  })

  describe('triggerTradeUpdated', () => {
    it('should trigger trade-updated on the league channel', async () => {
      const mod = await freshImport()

      const data = {
        tradeId: 'trade-1',
        newStatus: 'ACCEPTED',
        timestamp: '2026-01-01T00:00:00.000Z',
      }

      const result = await mod.triggerTradeUpdated('league-1', data)

      expect(result).toBe(true)
      expect(mockTrigger).toHaveBeenCalledWith(
        'league-league-1',
        mod.PUSHER_EVENTS.TRADE_UPDATED,
        expect.objectContaining({
          tradeId: 'trade-1',
          newStatus: 'ACCEPTED',
          serverTimestamp: expect.any(Number),
        })
      )
    })

    it('should handle rejected status', async () => {
      const mod = await freshImport()

      const data = {
        tradeId: 'trade-2',
        newStatus: 'REJECTED',
        timestamp: '2026-02-01T00:00:00.000Z',
      }

      const result = await mod.triggerTradeUpdated('league-2', data)

      expect(result).toBe(true)
      expect(mockTrigger).toHaveBeenCalledWith(
        'league-league-2',
        mod.PUSHER_EVENTS.TRADE_UPDATED,
        expect.objectContaining({ newStatus: 'REJECTED' })
      )
    })
  })

  // ==================== Error handling for league events (line 486) ====================

  describe('triggerLeagueEvent error handling', () => {
    it('should return false when trigger throws on league channel', async () => {
      const mod = await freshImport()
      mockTrigger.mockRejectedValueOnce(new Error('Pusher league error'))

      const data = {
        tradeId: 'trade-1',
        senderUsername: 'Sender',
        receiverUserId: 'user-2',
        timestamp: '2026-01-01T00:00:00.000Z',
      }

      const result = await mod.triggerTradeOfferReceived('league-1', data)

      expect(result).toBe(false)
    })

    it('should return false when triggerTradeUpdated throws', async () => {
      const mod = await freshImport()
      mockTrigger.mockRejectedValueOnce(new Error('Network failure'))

      const data = {
        tradeId: 'trade-1',
        newStatus: 'CANCELLED',
        timestamp: '2026-01-01T00:00:00.000Z',
      }

      const result = await mod.triggerTradeUpdated('league-1', data)

      expect(result).toBe(false)
    })
  })

  // ==================== triggerEvent returns false when pusher is null (line 199) ====================

  describe('triggerEvent when pusher is not configured', () => {
    it('should return false for triggerRubataStealDeclared when pusher is null', async () => {
      vi.resetModules()
      // Clear env vars so pusher instance is null
      delete process.env.PUSHER_APP_ID
      delete process.env.VITE_PUSHER_KEY
      delete process.env.PUSHER_SECRET

      const mod = await import('../services/pusher.service')

      expect(mod.isPusherReady()).toBe(false)

      const result = await mod.triggerRubataStealDeclared('session-1', {
        sessionId: 'session-1',
        bidderId: 'bidder-1',
        bidderUsername: 'Bidder',
        playerId: 'player-1',
        playerName: 'Leao',
        playerTeam: 'Milan',
        playerPosition: 'A',
        ownerUsername: 'Owner',
        basePrice: 25,
        timestamp: '2026-01-01T00:00:00.000Z',
      })

      expect(result).toBe(false)
      expect(mockTrigger).not.toHaveBeenCalled()
    })

    it('should return false for triggerTradeOfferReceived when pusher is null', async () => {
      vi.resetModules()
      delete process.env.PUSHER_APP_ID
      delete process.env.VITE_PUSHER_KEY
      delete process.env.PUSHER_SECRET

      const mod = await import('../services/pusher.service')

      expect(mod.isPusherReady()).toBe(false)

      const result = await mod.triggerTradeOfferReceived('league-1', {
        tradeId: 'trade-1',
        senderUsername: 'Sender',
        receiverUserId: 'user-2',
        timestamp: '2026-01-01T00:00:00.000Z',
      })

      expect(result).toBe(false)
      expect(mockTrigger).not.toHaveBeenCalled()
    })
  })

  // ==================== PUSHER_EVENTS completeness (extra events) ====================

  describe('PUSHER_EVENTS (extra event names)', () => {
    it('should have rubata event names', async () => {
      const mod = await freshImport()
      expect(mod.PUSHER_EVENTS.RUBATA_STEAL_DECLARED).toBe('rubata-steal-declared')
      expect(mod.PUSHER_EVENTS.RUBATA_BID_PLACED).toBe('rubata-bid-placed')
      expect(mod.PUSHER_EVENTS.RUBATA_STATE_CHANGED).toBe('rubata-state-changed')
      expect(mod.PUSHER_EVENTS.RUBATA_READY_CHANGED).toBe('rubata-ready-changed')
    })

    it('should have svincolati event names', async () => {
      const mod = await freshImport()
      expect(mod.PUSHER_EVENTS.SVINCOLATI_STATE_CHANGED).toBe('svincolati-state-changed')
      expect(mod.PUSHER_EVENTS.SVINCOLATI_NOMINATION).toBe('svincolati-nomination')
      expect(mod.PUSHER_EVENTS.SVINCOLATI_BID_PLACED).toBe('svincolati-bid-placed')
      expect(mod.PUSHER_EVENTS.SVINCOLATI_READY_CHANGED).toBe('svincolati-ready-changed')
    })

    it('should have indemnity and trade event names', async () => {
      const mod = await freshImport()
      expect(mod.PUSHER_EVENTS.INDEMNITY_DECISION_SUBMITTED).toBe('indemnity-decision-submitted')
      expect(mod.PUSHER_EVENTS.INDEMNITY_ALL_DECIDED).toBe('indemnity-all-decided')
      expect(mod.PUSHER_EVENTS.TRADE_OFFER_RECEIVED).toBe('trade-offer-received')
      expect(mod.PUSHER_EVENTS.TRADE_UPDATED).toBe('trade-updated')
      expect(mod.PUSHER_EVENTS.PAUSE_REQUESTED).toBe('pause-requested')
    })
  })
})
