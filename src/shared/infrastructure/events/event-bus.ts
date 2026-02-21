/**
 * Event Bus Infrastructure for FANTACONTRATTI
 *
 * A typed, in-memory event bus implementation for domain event handling.
 * Supports both synchronous and asynchronous event handlers with proper
 * subscription management.
 */

/**
 * Event handler function type that can be sync or async
 */
export type EventHandler<T> = (event: T) => void | Promise<void>

/**
 * Unsubscribe function returned by subscribe()
 */
export type Unsubscribe = () => void

/**
 * EventBus class - In-memory publish/subscribe event bus
 *
 * Features:
 * - Type-safe event handling
 * - Support for async handlers
 * - Clean unsubscribe mechanism
 * - Clear all handlers functionality
 */
export class EventBus {
  private handlers: Map<string, EventHandler<unknown>[]>

  constructor() {
    this.handlers = new Map()
  }

  /**
   * Subscribe to an event type with a handler
   *
   * @param eventType - The event type string to subscribe to
   * @param handler - The handler function to be called when event is published
   * @returns Unsubscribe function to remove the handler
   */
  subscribe<T>(eventType: string, handler: EventHandler<T>): Unsubscribe {
    const existingHandlers = this.handlers.get(eventType) || []
    const typedHandler = handler as EventHandler<unknown>
    this.handlers.set(eventType, [...existingHandlers, typedHandler])

    // Return unsubscribe function
    return () => {
      const currentHandlers = this.handlers.get(eventType)
      if (currentHandlers) {
        const index = currentHandlers.indexOf(typedHandler)
        if (index > -1) {
          currentHandlers.splice(index, 1)
          if (currentHandlers.length === 0) {
            this.handlers.delete(eventType)
          }
        }
      }
    }
  }

  /**
   * Publish an event to all subscribed handlers
   *
   * @param eventType - The event type string
   * @param event - The event payload
   * @returns Promise that resolves when all handlers have completed
   */
  async publish(eventType: string, event: unknown): Promise<void> {
    const handlers = this.handlers.get(eventType)
    if (!handlers || handlers.length === 0) {
      return
    }

    // Execute all handlers, awaiting any that return promises
    const promises = handlers.map((handler) => {
      const result = handler(event)
      // If handler returns a promise, await it
      if (result instanceof Promise) {
        return result
      }
      return Promise.resolve()
    })

    await Promise.all(promises)
  }

  /**
   * Clear all handlers from the event bus
   * Useful for testing and cleanup
   */
  clear(): void {
    this.handlers.clear()
  }

  /**
   * Get the number of handlers for a specific event type
   * Useful for testing and debugging
   */
  getHandlerCount(eventType: string): number {
    return this.handlers.get(eventType)?.length ?? 0
  }

  /**
   * Get all registered event types
   * Useful for testing and debugging
   */
  getEventTypes(): string[] {
    return Array.from(this.handlers.keys())
  }
}

/**
 * Singleton instance of the EventBus for application-wide use
 */
export const eventBus = new EventBus()
