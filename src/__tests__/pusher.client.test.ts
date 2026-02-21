import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// Use vi.hoisted to define mocks that are hoisted with vi.mock
const {
  mockBind,
  mockUnbind,
  mockUnbindAll,
  mockSubscribe,
  mockUnsubscribe,
  mockConnect,
  mockDisconnect,
  mockConnectionBind,
  mockChannel,
  MockPusherClient,
} = vi.hoisted(() => {
  const mockBind = vi.fn()
  const mockUnbind = vi.fn()
  const mockUnbindAll = vi.fn()
  const mockSubscribe = vi.fn()
  const mockUnsubscribe = vi.fn()
  const mockConnect = vi.fn()
  const mockDisconnect = vi.fn()
  const mockConnectionBind = vi.fn()
  const mockConnectionUnbind = vi.fn()

  const mockChannel = {
    bind: mockBind,
    unbind: mockUnbind,
    unbind_all: mockUnbindAll,
  }

  // Create a mock class that can be instantiated with `new`
  class MockPusherClient {
    subscribe = mockSubscribe.mockReturnValue(mockChannel)
    unsubscribe = mockUnsubscribe
    connect = mockConnect
    disconnect = mockDisconnect
    connection = {
      bind: mockConnectionBind,
      unbind: mockConnectionUnbind,
      state: 'connected',
    }
    static logToConsole = false
  }

  return {
    mockBind,
    mockUnbind,
    mockUnbindAll,
    mockSubscribe,
    mockUnsubscribe,
    mockConnect,
    mockDisconnect,
    mockConnectionBind,
    mockConnectionUnbind,
    mockChannel,
    MockPusherClient,
  }
})

vi.mock('pusher-js', () => {
  return {
    default: MockPusherClient,
    __esModule: true,
  }
})

import {
  subscribeToAuction,
  unsubscribeFromAuction,
  unbindAuctionHandlers,
  disconnectPusher,
  reconnectPusher,
  usePusherAuction,
} from '../services/pusher.client'

describe('pusher.client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('subscribeToAuction', () => {
    it('should subscribe to the correct channel', () => {
      const handlers = {}
      subscribeToAuction('session-123', handlers)

      expect(mockSubscribe).toHaveBeenCalledWith('auction-session-123')
    })

    it('should bind event handlers', () => {
      const onBidPlaced = vi.fn()
      const onNominationPending = vi.fn()
      const handlers = {
        onBidPlaced,
        onNominationPending,
      }

      subscribeToAuction('session-456', handlers)

      expect(mockBind).toHaveBeenCalledWith('bid-placed', onBidPlaced)
      expect(mockBind).toHaveBeenCalledWith('nomination-pending', onNominationPending)
    })

    it('should bind all event handlers when provided', () => {
      const handlers = {
        onBidPlaced: vi.fn(),
        onNominationPending: vi.fn(),
        onNominationConfirmed: vi.fn(),
        onMemberReady: vi.fn(),
        onAuctionStarted: vi.fn(),
        onAuctionClosed: vi.fn(),
        onTimerUpdate: vi.fn(),
      }

      subscribeToAuction('session-789', handlers)

      expect(mockBind).toHaveBeenCalledTimes(7)
    })

    it('should return the channel', () => {
      const handlers = {}
      const channel = subscribeToAuction('session-123', handlers)

      expect(channel).toBe(mockChannel)
    })
  })

  describe('unsubscribeFromAuction', () => {
    it('should unbind all events and unsubscribe', () => {
      // First subscribe
      subscribeToAuction('session-123', {})

      // Then unsubscribe
      unsubscribeFromAuction('session-123')

      expect(mockUnbindAll).toHaveBeenCalled()
      expect(mockUnsubscribe).toHaveBeenCalledWith('auction-session-123')
    })
  })

  describe('unbindAuctionHandlers', () => {
    it('should unbind specific handlers', () => {
      const onBidPlaced = vi.fn()
      const handlers = { onBidPlaced }

      // First subscribe
      subscribeToAuction('session-123', handlers)

      // Then unbind
      unbindAuctionHandlers('session-123', handlers)

      expect(mockUnbind).toHaveBeenCalledWith('bid-placed', onBidPlaced)
    })
  })

  describe('disconnectPusher', () => {
    it('should unsubscribe from all channels and disconnect', () => {
      // Subscribe to a channel first
      subscribeToAuction('session-123', {})

      // Disconnect
      disconnectPusher()

      expect(mockDisconnect).toHaveBeenCalled()
    })
  })

  describe('reconnectPusher', () => {
    it('should call connect on the pusher client', () => {
      reconnectPusher()

      expect(mockConnect).toHaveBeenCalled()
    })
  })

  describe('usePusherAuction hook', () => {
    it('should subscribe when sessionId is provided', () => {
      const { result } = renderHook(() =>
        usePusherAuction('session-123', {
          onBidPlaced: vi.fn(),
        })
      )

      expect(mockSubscribe).toHaveBeenCalledWith('auction-session-123')
      expect(result.current.connectionStatus).toBeDefined()
    })

    it('should not subscribe when sessionId is null', () => {
      mockSubscribe.mockClear()

      const { result } = renderHook(() =>
        usePusherAuction(null, {})
      )

      expect(mockSubscribe).not.toHaveBeenCalled()
      expect(result.current.channel).toBeNull()
    })

    it('should unsubscribe on unmount', () => {
      const { unmount } = renderHook(() =>
        usePusherAuction('session-123', {})
      )

      unmount()

      expect(mockUnbindAll).toHaveBeenCalled()
    })

    it('should return connection status', () => {
      const { result } = renderHook(() =>
        usePusherAuction('session-123', {})
      )

      expect(result.current.connectionStatus).toBe('connected')
      expect(result.current.isConnected).toBe(true)
    })

    it('should resubscribe when sessionId changes', () => {
      const { rerender } = renderHook(
        ({ sessionId }) => usePusherAuction(sessionId, {}),
        { initialProps: { sessionId: 'session-1' } }
      )

      expect(mockSubscribe).toHaveBeenCalledWith('auction-session-1')

      rerender({ sessionId: 'session-2' })

      expect(mockSubscribe).toHaveBeenCalledWith('auction-session-2')
    })

    it('should call handler callbacks when events fire', () => {
      const onBidPlaced = vi.fn()
      const onNominationPending = vi.fn()
      const onNominationConfirmed = vi.fn()
      const onMemberReady = vi.fn()
      const onAuctionStarted = vi.fn()
      const onAuctionClosed = vi.fn()
      const onTimerUpdate = vi.fn()

      renderHook(() =>
        usePusherAuction('session-123', {
          onBidPlaced,
          onNominationPending,
          onNominationConfirmed,
          onMemberReady,
          onAuctionStarted,
          onAuctionClosed,
          onTimerUpdate,
        })
      )

      // Get the bound handlers from mockBind calls and invoke them
      const bindings = mockBind.mock.calls

      // Each event should have been bound
      expect(bindings.length).toBeGreaterThanOrEqual(7)

      // Find and invoke each handler
      ;(bindings as [string, (data: unknown) => void][]).forEach(([_eventName, handler]) => {
        const testData = { test: 'data' }
        handler(testData)
      })

      // All handlers should have been called
      expect(onBidPlaced).toHaveBeenCalled()
      expect(onNominationPending).toHaveBeenCalled()
      expect(onNominationConfirmed).toHaveBeenCalled()
      expect(onMemberReady).toHaveBeenCalled()
      expect(onAuctionStarted).toHaveBeenCalled()
      expect(onAuctionClosed).toHaveBeenCalled()
      expect(onTimerUpdate).toHaveBeenCalled()
    })

    it('should handle connection state changes', () => {
      const { result } = renderHook(() =>
        usePusherAuction('session-123', {})
      )

      // Find the state_change handler that was bound
      const connectionBindCalls = mockConnectionBind.mock.calls as [string, (...args: unknown[]) => void][]
      const stateChangeBinding = connectionBindCalls.find(
        ([event]) => event === 'state_change'
      )

      expect(stateChangeBinding).toBeDefined()

      // Simulate a state change
      if (stateChangeBinding) {
        const stateChangeHandler = stateChangeBinding[1]
        act(() => {
          stateChangeHandler({ current: 'disconnected', previous: 'connected' })
        })

        expect(result.current.connectionStatus).toBe('disconnected')
        expect(result.current.isConnected).toBe(false)
      }
    })
  })
})
