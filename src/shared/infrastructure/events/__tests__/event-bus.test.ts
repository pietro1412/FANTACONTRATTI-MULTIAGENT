import { describe, it, expect, beforeEach, vi } from 'vitest'
import { EventBus } from '../event-bus'

describe('EventBus', () => {
  let eventBus: EventBus

  beforeEach(() => {
    eventBus = new EventBus()
  })

  describe('subscribe', () => {
    it('should subscribe to an event', () => {
      const handler = vi.fn()

      eventBus.subscribe('test.event', handler)

      expect(eventBus.getHandlerCount('test.event')).toBe(1)
    })

    it('should allow multiple handlers for the same event', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      eventBus.subscribe('test.event', handler1)
      eventBus.subscribe('test.event', handler2)

      expect(eventBus.getHandlerCount('test.event')).toBe(2)
    })

    it('should track multiple event types', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      eventBus.subscribe('event.one', handler1)
      eventBus.subscribe('event.two', handler2)

      expect(eventBus.getEventTypes()).toEqual(['event.one', 'event.two'])
    })
  })

  describe('publish', () => {
    it('should trigger all handlers for an event', async () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()
      const event = { message: 'test' }

      eventBus.subscribe('test.event', handler1)
      eventBus.subscribe('test.event', handler2)

      await eventBus.publish('test.event', event)

      expect(handler1).toHaveBeenCalledTimes(1)
      expect(handler1).toHaveBeenCalledWith(event)
      expect(handler2).toHaveBeenCalledTimes(1)
      expect(handler2).toHaveBeenCalledWith(event)
    })

    it('should not throw when publishing to non-existent event type', async () => {
      await expect(
        eventBus.publish('non.existent', { data: 'test' })
      ).resolves.toBeUndefined()
    })

    it('should only trigger handlers for the specific event type', async () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      eventBus.subscribe('event.one', handler1)
      eventBus.subscribe('event.two', handler2)

      await eventBus.publish('event.one', { data: 'test' })

      expect(handler1).toHaveBeenCalledTimes(1)
      expect(handler2).not.toHaveBeenCalled()
    })

    it('should pass the correct event payload to handlers', async () => {
      interface TestEvent {
        id: string
        value: number
      }

      const handler = vi.fn<[TestEvent], void>()
      const event: TestEvent = { id: 'test-123', value: 42 }

      eventBus.subscribe<TestEvent>('test.event', handler)
      await eventBus.publish('test.event', event)

      expect(handler).toHaveBeenCalledWith(event)
      const receivedEvent = handler.mock.calls[0][0]
      expect(receivedEvent.id).toBe('test-123')
      expect(receivedEvent.value).toBe(42)
    })
  })

  describe('unsubscribe', () => {
    it('should remove handler when unsubscribe is called', async () => {
      const handler = vi.fn()

      const unsubscribe = eventBus.subscribe('test.event', handler)
      unsubscribe()

      await eventBus.publish('test.event', { data: 'test' })

      expect(handler).not.toHaveBeenCalled()
      expect(eventBus.getHandlerCount('test.event')).toBe(0)
    })

    it('should only remove the specific handler', async () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      const unsubscribe1 = eventBus.subscribe('test.event', handler1)
      eventBus.subscribe('test.event', handler2)

      unsubscribe1()

      await eventBus.publish('test.event', { data: 'test' })

      expect(handler1).not.toHaveBeenCalled()
      expect(handler2).toHaveBeenCalledTimes(1)
    })

    it('should handle multiple unsubscribe calls gracefully', () => {
      const handler = vi.fn()

      const unsubscribe = eventBus.subscribe('test.event', handler)
      unsubscribe()
      unsubscribe() // Second call should not throw

      expect(eventBus.getHandlerCount('test.event')).toBe(0)
    })

    it('should remove event type from map when last handler is removed', () => {
      const handler = vi.fn()

      const unsubscribe = eventBus.subscribe('test.event', handler)
      expect(eventBus.getEventTypes()).toContain('test.event')

      unsubscribe()

      expect(eventBus.getEventTypes()).not.toContain('test.event')
    })
  })

  describe('async handlers', () => {
    it('should work with async handlers', async () => {
      const results: string[] = []

      const asyncHandler = async (event: { value: string }) => {
        await new Promise((resolve) => setTimeout(resolve, 10))
        results.push(event.value)
      }

      eventBus.subscribe('test.event', asyncHandler)

      await eventBus.publish('test.event', { value: 'async-result' })

      expect(results).toContain('async-result')
    })

    it('should wait for all async handlers to complete', async () => {
      const results: number[] = []

      const slowHandler = async (event: { order: number }) => {
        await new Promise((resolve) => setTimeout(resolve, 30))
        results.push(event.order)
      }

      const fastHandler = async (event: { order: number }) => {
        await new Promise((resolve) => setTimeout(resolve, 10))
        results.push(event.order + 10)
      }

      eventBus.subscribe('test.event', slowHandler)
      eventBus.subscribe('test.event', fastHandler)

      await eventBus.publish('test.event', { order: 1 })

      // Both handlers should have completed
      expect(results).toHaveLength(2)
      expect(results).toContain(1)
      expect(results).toContain(11)
    })

    it('should work with mixed sync and async handlers', async () => {
      const results: string[] = []

      const syncHandler = (event: { value: string }) => {
        results.push(`sync-${event.value}`)
      }

      const asyncHandler = async (event: { value: string }) => {
        await new Promise((resolve) => setTimeout(resolve, 10))
        results.push(`async-${event.value}`)
      }

      eventBus.subscribe('test.event', syncHandler)
      eventBus.subscribe('test.event', asyncHandler)

      await eventBus.publish('test.event', { value: 'test' })

      expect(results).toHaveLength(2)
      expect(results).toContain('sync-test')
      expect(results).toContain('async-test')
    })

    it('should handle async handler errors', async () => {
      const errorHandler = async () => {
        await new Promise((resolve) => setTimeout(resolve, 5))
        throw new Error('Async handler error')
      }

      eventBus.subscribe('test.event', errorHandler)

      await expect(
        eventBus.publish('test.event', { data: 'test' })
      ).rejects.toThrow('Async handler error')
    })
  })

  describe('clear', () => {
    it('should remove all handlers', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      eventBus.subscribe('event.one', handler1)
      eventBus.subscribe('event.two', handler2)

      eventBus.clear()

      expect(eventBus.getEventTypes()).toHaveLength(0)
      expect(eventBus.getHandlerCount('event.one')).toBe(0)
      expect(eventBus.getHandlerCount('event.two')).toBe(0)
    })

    it('should not trigger cleared handlers on publish', async () => {
      const handler = vi.fn()

      eventBus.subscribe('test.event', handler)
      eventBus.clear()

      await eventBus.publish('test.event', { data: 'test' })

      expect(handler).not.toHaveBeenCalled()
    })

    it('should allow new subscriptions after clear', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      eventBus.subscribe('test.event', handler1)
      eventBus.clear()
      eventBus.subscribe('test.event', handler2)

      expect(eventBus.getHandlerCount('test.event')).toBe(1)
    })
  })

  describe('type safety', () => {
    it('should maintain type safety for events', async () => {
      interface UserCreatedEvent {
        userId: string
        email: string
        createdAt: Date
      }

      const handler = vi.fn<[UserCreatedEvent], void>()
      const event: UserCreatedEvent = {
        userId: 'user-123',
        email: 'test@example.com',
        createdAt: new Date('2024-01-01'),
      }

      eventBus.subscribe<UserCreatedEvent>('user.created', handler)
      await eventBus.publish('user.created', event)

      const receivedEvent = handler.mock.calls[0][0]
      expect(receivedEvent.userId).toBe('user-123')
      expect(receivedEvent.email).toBe('test@example.com')
      expect(receivedEvent.createdAt).toEqual(new Date('2024-01-01'))
    })
  })
})
