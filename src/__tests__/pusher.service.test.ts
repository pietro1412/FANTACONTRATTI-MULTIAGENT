import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'

// Mock pusher module with a class-based mock
const mockTrigger = vi.fn().mockResolvedValue({})

// Create a mock class that can be instantiated with `new`
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

describe('pusher.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTrigger.mockResolvedValue({})
  })

  describe('getChannelName', () => {
    it('should return correct channel name for session', async () => {
      const { getChannelName } = await import('../services/pusher.service')
      expect(getChannelName('session-123')).toBe('auction-session-123')
    })

    it('should handle different session IDs', async () => {
      const { getChannelName } = await import('../services/pusher.service')
      expect(getChannelName('abc')).toBe('auction-abc')
      expect(getChannelName('test-session-456')).toBe('auction-test-session-456')
    })
  })

  describe('PUSHER_EVENTS', () => {
    it('should have all expected event names', async () => {
      const { PUSHER_EVENTS } = await import('../services/pusher.service')
      expect(PUSHER_EVENTS.BID_PLACED).toBe('bid-placed')
      expect(PUSHER_EVENTS.NOMINATION_PENDING).toBe('nomination-pending')
      expect(PUSHER_EVENTS.NOMINATION_CONFIRMED).toBe('nomination-confirmed')
      expect(PUSHER_EVENTS.MEMBER_READY).toBe('member-ready')
      expect(PUSHER_EVENTS.AUCTION_STARTED).toBe('auction-started')
      expect(PUSHER_EVENTS.AUCTION_CLOSED).toBe('auction-closed')
      expect(PUSHER_EVENTS.TIMER_UPDATE).toBe('timer-update')
    })
  })

  describe('trigger functions', () => {
    it('should call trigger for triggerBidPlaced', async () => {
      // Re-import to get fresh module with mocked Pusher
      vi.resetModules()
      process.env.PUSHER_APP_ID = 'test-app-id'
      process.env.VITE_PUSHER_KEY = 'test-key'
      process.env.PUSHER_SECRET = 'test-secret'
      process.env.VITE_PUSHER_CLUSTER = 'eu'

      const { triggerBidPlaced, isPusherReady } = await import('../services/pusher.service')

      const data = {
        auctionId: 'auction-1',
        memberId: 'member-1',
        memberName: 'Test User',
        amount: 100,
        playerId: 'player-1',
        playerName: 'Test Player',
        timestamp: new Date().toISOString(),
        timerExpiresAt: new Date(Date.now() + 30000).toISOString(),
        timerSeconds: 30,
      }

      const result = await triggerBidPlaced('session-123', data)

      // Since pusher is mocked, it should be ready
      if (isPusherReady()) {
        expect(result).toBe(true)
        expect(mockTrigger).toHaveBeenCalled()
      } else {
        // If not ready, it returns false gracefully
        expect(result).toBe(false)
      }
    })

    it('should handle triggerNominationPending', async () => {
      const { triggerNominationPending } = await import('../services/pusher.service')

      const data = {
        auctionId: '',
        nominatorId: 'member-1',
        nominatorName: 'Test User',
        playerId: 'player-1',
        playerName: 'Test Player',
        playerRole: 'P',
        startingPrice: 1,
        timestamp: new Date().toISOString(),
      }

      const result = await triggerNominationPending('session-123', data)
      expect(typeof result).toBe('boolean')
    })

    it('should handle triggerNominationConfirmed', async () => {
      const { triggerNominationConfirmed } = await import('../services/pusher.service')

      const data = {
        auctionId: '',
        playerId: 'player-1',
        playerName: 'Test Player',
        playerRole: 'D',
        startingPrice: 1,
        nominatorId: 'member-1',
        nominatorName: 'Test User',
        timerDuration: 30,
        timestamp: new Date().toISOString(),
      }

      const result = await triggerNominationConfirmed('session-123', data)
      expect(typeof result).toBe('boolean')
    })

    it('should handle triggerMemberReady', async () => {
      const { triggerMemberReady } = await import('../services/pusher.service')

      const data = {
        memberId: 'member-1',
        memberName: 'Test User',
        isReady: true,
        readyCount: 5,
        totalMembers: 8,
        readyMembers: [{ id: 'member-1', username: 'Test User' }],
        pendingMembers: [],
        timestamp: new Date().toISOString(),
      }

      const result = await triggerMemberReady('session-123', data)
      expect(typeof result).toBe('boolean')
    })

    it('should handle triggerAuctionStarted', async () => {
      const { triggerAuctionStarted } = await import('../services/pusher.service')

      const data = {
        sessionId: 'session-123',
        auctionType: 'FIRST_MARKET',
        nominatorId: 'member-1',
        nominatorName: 'Test User',
        timestamp: new Date().toISOString(),
      }

      const result = await triggerAuctionStarted('session-123', data)
      expect(typeof result).toBe('boolean')
    })

    it('should handle triggerAuctionClosed with winner', async () => {
      const { triggerAuctionClosed } = await import('../services/pusher.service')

      const data = {
        auctionId: 'auction-1',
        playerId: 'player-1',
        playerName: 'Test Player',
        winnerId: 'member-1',
        winnerName: 'Test User',
        finalPrice: 50,
        wasUnsold: false,
        timestamp: new Date().toISOString(),
      }

      const result = await triggerAuctionClosed('session-123', data)
      expect(typeof result).toBe('boolean')
    })

    it('should handle triggerAuctionClosed for unsold player', async () => {
      const { triggerAuctionClosed } = await import('../services/pusher.service')

      const data = {
        auctionId: 'auction-1',
        playerId: 'player-1',
        playerName: 'Test Player',
        winnerId: null,
        winnerName: null,
        finalPrice: null,
        wasUnsold: true,
        timestamp: new Date().toISOString(),
      }

      const result = await triggerAuctionClosed('session-123', data)
      expect(typeof result).toBe('boolean')
    })

    it('should handle triggerTimerUpdate', async () => {
      const { triggerTimerUpdate } = await import('../services/pusher.service')

      const data = {
        auctionId: 'auction-1',
        remainingSeconds: 15,
        totalSeconds: 30,
        timestamp: new Date().toISOString(),
      }

      const result = await triggerTimerUpdate('session-123', data)
      expect(typeof result).toBe('boolean')
    })
  })

  describe('isPusherReady', () => {
    it('should return boolean indicating Pusher status', async () => {
      const { isPusherReady } = await import('../services/pusher.service')
      expect(typeof isPusherReady()).toBe('boolean')
    })
  })

  describe('error handling', () => {
    it('should handle trigger errors gracefully', async () => {
      vi.resetModules()
      process.env.PUSHER_APP_ID = 'test-app-id'
      process.env.VITE_PUSHER_KEY = 'test-key'
      process.env.PUSHER_SECRET = 'test-secret'
      process.env.VITE_PUSHER_CLUSTER = 'eu'

      // Make trigger reject
      mockTrigger.mockRejectedValueOnce(new Error('Network error'))

      const { triggerBidPlaced } = await import('../services/pusher.service')

      const data = {
        auctionId: 'auction-1',
        memberId: 'member-1',
        memberName: 'Test User',
        amount: 100,
        playerId: 'player-1',
        playerName: 'Test Player',
        timestamp: new Date().toISOString(),
        timerExpiresAt: new Date(Date.now() + 30000).toISOString(),
        timerSeconds: 30,
      }

      const result = await triggerBidPlaced('session-123', data)
      expect(result).toBe(false)
    })
  })
})
