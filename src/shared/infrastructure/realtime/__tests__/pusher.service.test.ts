import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  BatchedPusherService,
  type PusherEvent,
  type BatchedEventPayload,
  type Member,
  type TimerResetData,
} from '../pusher.service'

// Mock Pusher module
vi.mock('pusher', () => {
  const mockTrigger = vi.fn().mockResolvedValue(undefined)

  class MockPusher {
    trigger = mockTrigger
  }

  return {
    default: MockPusher,
    __mockTrigger: mockTrigger,
  }
})

// Get the mocked trigger function
const getMockTrigger = async () => {
  const pusherModule = await import('pusher')
  return (pusherModule as unknown as { __mockTrigger: ReturnType<typeof vi.fn> }).__mockTrigger
}

describe('BatchedPusherService', () => {
  let service: BatchedPusherService
  let mockTrigger: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    vi.useFakeTimers()
    mockTrigger = await getMockTrigger()
    mockTrigger.mockClear()

    service = new BatchedPusherService({
      appId: 'test-app-id',
      key: 'test-key',
      secret: 'test-secret',
      cluster: 'eu',
      batchIntervalMs: 100,
      maxBatchSize: 100,
    })
  })

  afterEach(() => {
    service.dispose()
    vi.useRealTimers()
  })

  describe('Event Batching', () => {
    it('should queue events and not send immediately', async () => {
      service.queueEvent('test-channel', 'test-event', { data: 'value1' })
      service.queueEvent('test-channel', 'test-event', { data: 'value2' })

      // Events should not be sent yet
      expect(mockTrigger).not.toHaveBeenCalled()
    })

    it('should batch events within 100ms window', async () => {
      service.queueEvent('test-channel', 'event-1', { data: 'value1' })

      // Advance 50ms
      await vi.advanceTimersByTimeAsync(50)

      service.queueEvent('test-channel', 'event-2', { data: 'value2' })

      // Still within batch window, should not have sent
      expect(mockTrigger).not.toHaveBeenCalled()

      // Advance another 100ms (timer resets on each queue)
      await vi.advanceTimersByTimeAsync(100)

      // Now the batch should be flushed
      expect(mockTrigger).toHaveBeenCalledTimes(1)
      expect(mockTrigger).toHaveBeenCalledWith(
        'test-channel',
        'batched-events',
        expect.objectContaining({
          events: expect.arrayContaining([
            expect.objectContaining({ type: 'event-1', payload: { data: 'value1' } }),
            expect.objectContaining({ type: 'event-2', payload: { data: 'value2' } }),
          ]),
          batchId: expect.stringMatching(/^batch-/),
          batchTimestamp: expect.any(Number),
        })
      )
    })

    it('should flush batch after 100ms', async () => {
      service.queueEvent('test-channel', 'test-event', { data: 'value' })

      // Advance time by 99ms - should not flush yet
      await vi.advanceTimersByTimeAsync(99)
      expect(mockTrigger).not.toHaveBeenCalled()

      // Advance 1 more ms to reach 100ms - should flush now
      await vi.advanceTimersByTimeAsync(1)
      expect(mockTrigger).toHaveBeenCalledTimes(1)

      const call = mockTrigger.mock.calls[0]
      const payload = call[2] as BatchedEventPayload
      expect(payload.events).toHaveLength(1)
      expect(payload.events[0].type).toBe('test-event')
    })

    it('should reset timer when new event is added', async () => {
      service.queueEvent('test-channel', 'event-1', { data: '1' })

      // Advance 80ms
      await vi.advanceTimersByTimeAsync(80)
      expect(mockTrigger).not.toHaveBeenCalled()

      // Add another event - timer should reset
      service.queueEvent('test-channel', 'event-2', { data: '2' })

      // Advance 80ms more (160ms total from first event, 80ms from second)
      await vi.advanceTimersByTimeAsync(80)
      expect(mockTrigger).not.toHaveBeenCalled()

      // Advance 20 more ms (100ms from second event)
      await vi.advanceTimersByTimeAsync(20)
      expect(mockTrigger).toHaveBeenCalledTimes(1)

      const payload = mockTrigger.mock.calls[0][2] as BatchedEventPayload
      expect(payload.events).toHaveLength(2)
    })

    it('should include timestamp in each event', async () => {
      const beforeTime = Date.now()
      service.queueEvent('test-channel', 'test-event', { data: 'value' })
      const afterTime = Date.now()

      await vi.advanceTimersByTimeAsync(100)

      const payload = mockTrigger.mock.calls[0][2] as BatchedEventPayload
      expect(payload.events[0].timestamp).toBeGreaterThanOrEqual(beforeTime)
      expect(payload.events[0].timestamp).toBeLessThanOrEqual(afterTime)
    })
  })

  describe('sendImmediate', () => {
    it('should bypass batching and send immediately', async () => {
      await service.sendImmediate('test-channel', 'urgent-event', { urgent: true })

      expect(mockTrigger).toHaveBeenCalledTimes(1)
      expect(mockTrigger).toHaveBeenCalledWith(
        'test-channel',
        'urgent-event',
        expect.objectContaining({
          urgent: true,
          timestamp: expect.any(Number),
          immediate: true,
        })
      )
    })

    it('should not affect pending batched events', async () => {
      service.queueEvent('test-channel', 'batched-event', { batched: true })

      await service.sendImmediate('test-channel', 'urgent-event', { urgent: true })

      // Immediate event sent, but batched event still pending
      expect(mockTrigger).toHaveBeenCalledTimes(1)
      expect(mockTrigger).toHaveBeenCalledWith(
        'test-channel',
        'urgent-event',
        expect.anything()
      )

      // Advance time to flush the batched event
      await vi.advanceTimersByTimeAsync(100)

      expect(mockTrigger).toHaveBeenCalledTimes(2)
    })
  })

  describe('Multiple Channels', () => {
    it('should maintain separate queues for different channels', async () => {
      service.queueEvent('channel-1', 'event-a', { channel: '1' })
      service.queueEvent('channel-2', 'event-b', { channel: '2' })

      await vi.advanceTimersByTimeAsync(100)

      // Both channels should have flushed
      expect(mockTrigger).toHaveBeenCalledTimes(2)

      const calls = mockTrigger.mock.calls
      const channel1Call = calls.find((c: unknown[]) => c[0] === 'channel-1')
      const channel2Call = calls.find((c: unknown[]) => c[0] === 'channel-2')

      expect(channel1Call).toBeDefined()
      expect(channel2Call).toBeDefined()

      expect((channel1Call![2] as BatchedEventPayload).events[0].type).toBe('event-a')
      expect((channel2Call![2] as BatchedEventPayload).events[0].type).toBe('event-b')
    })

    it('should have independent timers for each channel', async () => {
      service.queueEvent('channel-1', 'event-1', { data: '1' })

      // Advance 60ms
      await vi.advanceTimersByTimeAsync(60)

      service.queueEvent('channel-2', 'event-2', { data: '2' })

      // Advance 40ms more - channel-1 should flush
      await vi.advanceTimersByTimeAsync(40)
      expect(mockTrigger).toHaveBeenCalledTimes(1)
      expect(mockTrigger).toHaveBeenCalledWith('channel-1', 'batched-events', expect.anything())

      // Advance 60ms more - channel-2 should flush
      await vi.advanceTimersByTimeAsync(60)
      expect(mockTrigger).toHaveBeenCalledTimes(2)
    })

    it('should flush all channels with flushAll', async () => {
      service.queueEvent('channel-1', 'event-1', { data: '1' })
      service.queueEvent('channel-2', 'event-2', { data: '2' })
      service.queueEvent('channel-3', 'event-3', { data: '3' })

      expect(mockTrigger).not.toHaveBeenCalled()

      await service.flushAll()

      expect(mockTrigger).toHaveBeenCalledTimes(3)
    })
  })

  describe('Max Batch Size', () => {
    it('should flush immediately when max batch size is reached', async () => {
      const smallBatchService = new BatchedPusherService({
        appId: 'test-app-id',
        key: 'test-key',
        secret: 'test-secret',
        cluster: 'eu',
        batchIntervalMs: 100,
        maxBatchSize: 3,
      })

      smallBatchService.queueEvent('test-channel', 'event-1', { n: 1 })
      smallBatchService.queueEvent('test-channel', 'event-2', { n: 2 })

      expect(mockTrigger).not.toHaveBeenCalled()

      smallBatchService.queueEvent('test-channel', 'event-3', { n: 3 })

      // Should flush immediately when hitting max batch size
      // Need to wait for the promise to resolve
      await vi.advanceTimersByTimeAsync(0)
      expect(mockTrigger).toHaveBeenCalledTimes(1)

      const payload = mockTrigger.mock.calls[0][2] as BatchedEventPayload
      expect(payload.events).toHaveLength(3)

      smallBatchService.dispose()
    })
  })

  describe('Timer Reset', () => {
    it('should send timer reset immediately', async () => {
      const timerData: TimerResetData = {
        auctionId: 'auction-123',
        remainingSeconds: 30,
        totalSeconds: 60,
        resetReason: 'bid',
        triggeredBy: 'user-456',
        timestamp: Date.now(),
      }

      await service.sendTimerReset('auction-channel', timerData)

      expect(mockTrigger).toHaveBeenCalledTimes(1)
      expect(mockTrigger).toHaveBeenCalledWith(
        'auction-channel',
        'timer-reset',
        expect.objectContaining({
          auctionId: 'auction-123',
          remainingSeconds: 30,
          immediate: true,
        })
      )
    })
  })

  describe('Presence Channel Management', () => {
    it('should subscribe to presence channel and track callbacks', () => {
      const onJoin = vi.fn()
      const onLeave = vi.fn()

      service.subscribePresence('auction-123', onJoin, onLeave)

      const members = service.getOnlineMembers('auction-123')
      expect(members).toEqual([])
    })

    it('should add presence- prefix if not present', () => {
      const onJoin = vi.fn()
      const onLeave = vi.fn()

      service.subscribePresence('auction-123', onJoin, onLeave)

      // Should work with both formats
      const members1 = service.getOnlineMembers('auction-123')
      const members2 = service.getOnlineMembers('presence-auction-123')

      expect(members1).toEqual(members2)
    })

    it('should track members when added', () => {
      const onJoin = vi.fn()
      const onLeave = vi.fn()

      service.subscribePresence('auction-123', onJoin, onLeave)

      const member: Member = {
        id: 'user-1',
        info: { username: 'Player1' },
      }

      service.addPresenceMember('auction-123', member)

      expect(onJoin).toHaveBeenCalledWith(member)

      const members = service.getOnlineMembers('auction-123')
      expect(members).toHaveLength(1)
      expect(members[0].id).toBe('user-1')
    })

    it('should not add duplicate members', () => {
      const onJoin = vi.fn()
      const onLeave = vi.fn()

      service.subscribePresence('auction-123', onJoin, onLeave)

      const member: Member = {
        id: 'user-1',
        info: { username: 'Player1' },
      }

      service.addPresenceMember('auction-123', member)
      service.addPresenceMember('auction-123', member)

      expect(onJoin).toHaveBeenCalledTimes(1)
      expect(service.getOnlineMembers('auction-123')).toHaveLength(1)
    })

    it('should remove members and call onLeave', () => {
      const onJoin = vi.fn()
      const onLeave = vi.fn()

      service.subscribePresence('auction-123', onJoin, onLeave)

      const member: Member = {
        id: 'user-1',
        info: { username: 'Player1' },
      }

      service.addPresenceMember('auction-123', member)
      service.removePresenceMember('auction-123', 'user-1')

      expect(onLeave).toHaveBeenCalledWith(member)
      expect(service.getOnlineMembers('auction-123')).toHaveLength(0)
    })

    it('should unsubscribe and clear channel state', () => {
      const onJoin = vi.fn()
      const onLeave = vi.fn()

      service.subscribePresence('auction-123', onJoin, onLeave)

      const member: Member = {
        id: 'user-1',
        info: { username: 'Player1' },
      }

      service.addPresenceMember('auction-123', member)
      service.unsubscribePresence('auction-123')

      expect(service.getOnlineMembers('auction-123')).toEqual([])

      // Adding a member after unsubscribe should not trigger callbacks
      service.addPresenceMember('auction-123', member)
      expect(onJoin).toHaveBeenCalledTimes(1) // Only first add
    })
  })

  describe('Service State', () => {
    it('should report ready status when configured', () => {
      expect(service.isReady()).toBe(true)
    })

    it('should report not ready when not configured', () => {
      const unconfiguredService = new BatchedPusherService({
        appId: '',
        key: '',
        secret: '',
        cluster: '',
      })

      expect(unconfiguredService.isReady()).toBe(false)
      unconfiguredService.dispose()
    })

    it('should clean up on dispose', async () => {
      service.queueEvent('channel-1', 'event', { data: 'test' })
      service.subscribePresence('presence-test', vi.fn(), vi.fn())

      service.dispose()

      // Advancing timer should not cause flush
      await vi.advanceTimersByTimeAsync(100)
      expect(mockTrigger).not.toHaveBeenCalled()
    })
  })

  describe('Batch ID Generation', () => {
    it('should generate unique batch IDs', async () => {
      service.queueEvent('channel-1', 'event-1', {})
      await vi.advanceTimersByTimeAsync(100)

      service.queueEvent('channel-1', 'event-2', {})
      await vi.advanceTimersByTimeAsync(100)

      const batchId1 = (mockTrigger.mock.calls[0][2] as BatchedEventPayload).batchId
      const batchId2 = (mockTrigger.mock.calls[1][2] as BatchedEventPayload).batchId

      expect(batchId1).not.toBe(batchId2)
      expect(batchId1).toMatch(/^batch-\d+-\d+$/)
      expect(batchId2).toMatch(/^batch-\d+-\d+$/)
    })
  })
})
