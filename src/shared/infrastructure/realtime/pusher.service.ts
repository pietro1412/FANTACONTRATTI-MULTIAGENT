import * as PusherModule from 'pusher'

// Handle both ESM and CJS module formats
const Pusher = (PusherModule as { default?: typeof PusherModule }).default || PusherModule
type PusherInstance = InstanceType<typeof Pusher>

// ==================== TYPES ====================

/**
 * Represents a single event to be sent via Pusher
 */
export interface PusherEvent {
  type: string
  payload: unknown
  timestamp: number
}

/**
 * Represents a member in a presence channel
 */
export interface Member {
  id: string
  info: {
    username: string
    [key: string]: unknown
  }
}

/**
 * Presence channel callbacks
 */
export interface PresenceCallbacks {
  onJoin: (member: Member) => void
  onLeave: (member: Member) => void
}

/**
 * Batched event structure sent over the wire
 */
export interface BatchedEventPayload {
  events: PusherEvent[]
  batchId: string
  batchTimestamp: number
}

/**
 * Configuration options for the batched Pusher service
 */
export interface BatchedPusherConfig {
  appId: string
  key: string
  secret: string
  cluster: string
  useTLS?: boolean
  batchIntervalMs?: number // Default: 100ms
  maxBatchSize?: number // Default: 100 events
}

/**
 * Interface for the BatchedPusherService
 */
export interface IBatchedPusherService {
  // Queue an event to be batched and sent
  queueEvent(channel: string, eventType: string, payload: unknown): void

  // Force flush all queued events immediately
  flushAll(): Promise<void>

  // Send event immediately without batching (for critical events)
  sendImmediate(channel: string, eventType: string, payload: unknown): Promise<void>

  // Presence channel management
  subscribePresence(
    channel: string,
    onJoin: (member: Member) => void,
    onLeave: (member: Member) => void
  ): void

  // Unsubscribe from presence channel
  unsubscribePresence(channel: string): void

  // Get online members in a channel
  getOnlineMembers(channel: string): Member[]

  // Timer reset notification (bypasses batching for time-sensitive updates)
  sendTimerReset(channel: string, timerData: TimerResetData): Promise<void>

  // Check if service is configured and ready
  isReady(): boolean

  // Dispose resources and clear timers
  dispose(): void
}

/**
 * Timer reset notification data
 */
export interface TimerResetData {
  auctionId: string
  remainingSeconds: number
  totalSeconds: number
  resetReason: 'bid' | 'nomination' | 'manual'
  triggeredBy?: string
  timestamp: number
}

// ==================== IMPLEMENTATION ====================

/**
 * Enhanced Pusher service with event batching for real-time performance optimization.
 *
 * Features:
 * - Event batching: queues events and flushes every 100ms instead of sending individually
 * - Batch format: sends array of events in single Pusher message
 * - Support for Presence channels (online status tracking)
 * - Timer reset notifications (immediate, bypasses batching)
 */
export class BatchedPusherService implements IBatchedPusherService {
  private pusher: PusherInstance | null = null
  private readonly config: Required<BatchedPusherConfig>

  // Event queues per channel
  private eventQueues: Map<string, PusherEvent[]> = new Map()

  // Flush timers per channel
  private flushTimers: Map<string, ReturnType<typeof setTimeout>> = new Map()

  // Presence channel state
  private presenceMembers: Map<string, Member[]> = new Map()
  private presenceCallbacks: Map<string, PresenceCallbacks> = new Map()

  // Batch counter for unique IDs
  private batchCounter = 0

  constructor(config: BatchedPusherConfig) {
    this.config = {
      appId: config.appId,
      key: config.key,
      secret: config.secret,
      cluster: config.cluster,
      useTLS: config.useTLS ?? true,
      batchIntervalMs: config.batchIntervalMs ?? 100,
      maxBatchSize: config.maxBatchSize ?? 100,
    }

    this.initializePusher()
  }

  /**
   * Initialize the Pusher instance
   */
  private initializePusher(): void {
    const isPusherConfigured = Boolean(
      this.config.appId &&
      this.config.key &&
      this.config.secret &&
      this.config.cluster
    )

    if (isPusherConfigured) {
      this.pusher = new Pusher({
        appId: this.config.appId,
        key: this.config.key,
        secret: this.config.secret,
        cluster: this.config.cluster,
        useTLS: this.config.useTLS,
      })
      console.log('[BatchedPusher] Initialized successfully')
    } else {
      console.warn('[BatchedPusher] Not configured - missing credentials')
    }
  }

  /**
   * Check if the service is ready to send events
   */
  isReady(): boolean {
    return this.pusher !== null
  }

  /**
   * Generate a unique batch ID
   */
  private generateBatchId(): string {
    return `batch-${Date.now()}-${++this.batchCounter}`
  }

  /**
   * Queue an event to be batched and sent
   */
  queueEvent(channel: string, eventType: string, payload: unknown): void {
    const event: PusherEvent = {
      type: eventType,
      payload,
      timestamp: Date.now(),
    }

    // Get or create queue for this channel
    if (!this.eventQueues.has(channel)) {
      this.eventQueues.set(channel, [])
    }

    const queue = this.eventQueues.get(channel)!
    queue.push(event)

    // Check if we've hit max batch size
    if (queue.length >= this.config.maxBatchSize) {
      // Flush immediately if batch is full
      this.flushChannel(channel).catch(err => {
        console.error(`[BatchedPusher] Error flushing full batch for channel ${channel}:`, err)
      })
      return
    }

    // Start/reset flush timer for this channel
    this.scheduleFlush(channel)
  }

  /**
   * Schedule a flush for a specific channel
   */
  private scheduleFlush(channel: string): void {
    // Clear existing timer if any
    const existingTimer = this.flushTimers.get(channel)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    // Set new timer
    const timer = setTimeout(() => {
      this.flushChannel(channel).catch(err => {
        console.error(`[BatchedPusher] Error flushing channel ${channel}:`, err)
      })
    }, this.config.batchIntervalMs)

    this.flushTimers.set(channel, timer)
  }

  /**
   * Flush all events for a specific channel
   */
  private async flushChannel(channel: string): Promise<void> {
    // Clear timer
    const timer = this.flushTimers.get(channel)
    if (timer) {
      clearTimeout(timer)
      this.flushTimers.delete(channel)
    }

    // Get and clear queue
    const queue = this.eventQueues.get(channel)
    if (!queue || queue.length === 0) {
      return
    }

    const events = [...queue]
    queue.length = 0

    // Send batched events
    await this.sendBatch(channel, events)
  }

  /**
   * Send a batch of events to a channel
   */
  private async sendBatch(channel: string, events: PusherEvent[]): Promise<void> {
    if (!this.pusher) {
      console.warn(`[BatchedPusher] Cannot send batch - Pusher not configured`)
      return
    }

    if (events.length === 0) {
      return
    }

    const batchPayload: BatchedEventPayload = {
      events,
      batchId: this.generateBatchId(),
      batchTimestamp: Date.now(),
    }

    try {
      await this.pusher.trigger(channel, 'batched-events', batchPayload)
      console.log(`[BatchedPusher] Sent batch of ${events.length} events to channel '${channel}'`)
    } catch (error) {
      console.error(`[BatchedPusher] Failed to send batch to channel '${channel}':`, error)
      throw error
    }
  }

  /**
   * Force flush all queued events immediately across all channels
   */
  async flushAll(): Promise<void> {
    const channels = Array.from(this.eventQueues.keys())
    await Promise.all(channels.map(channel => this.flushChannel(channel)))
  }

  /**
   * Send event immediately without batching (for critical events)
   */
  async sendImmediate(channel: string, eventType: string, payload: unknown): Promise<void> {
    if (!this.pusher) {
      console.warn(`[BatchedPusher] Cannot send immediate event - Pusher not configured`)
      return
    }

    try {
      await this.pusher.trigger(channel, eventType, {
        ...payload as object,
        timestamp: Date.now(),
        immediate: true,
      })
      console.log(`[BatchedPusher] Sent immediate event '${eventType}' to channel '${channel}'`)
    } catch (error) {
      console.error(`[BatchedPusher] Failed to send immediate event '${eventType}':`, error)
      throw error
    }
  }

  /**
   * Send timer reset notification (bypasses batching for time-sensitive updates)
   */
  async sendTimerReset(channel: string, timerData: TimerResetData): Promise<void> {
    await this.sendImmediate(channel, 'timer-reset', timerData)
  }

  /**
   * Subscribe to presence channel events
   * Note: Server-side Pusher can't subscribe to channels, but can track state
   * This method is for tracking presence state on the server
   */
  subscribePresence(
    channel: string,
    onJoin: (member: Member) => void,
    onLeave: (member: Member) => void
  ): void {
    // Ensure channel has presence- prefix
    const presenceChannel = channel.startsWith('presence-') ? channel : `presence-${channel}`

    this.presenceCallbacks.set(presenceChannel, { onJoin, onLeave })

    if (!this.presenceMembers.has(presenceChannel)) {
      this.presenceMembers.set(presenceChannel, [])
    }

    console.log(`[BatchedPusher] Subscribed to presence channel '${presenceChannel}'`)
  }

  /**
   * Unsubscribe from presence channel
   */
  unsubscribePresence(channel: string): void {
    const presenceChannel = channel.startsWith('presence-') ? channel : `presence-${channel}`

    this.presenceCallbacks.delete(presenceChannel)
    this.presenceMembers.delete(presenceChannel)

    console.log(`[BatchedPusher] Unsubscribed from presence channel '${presenceChannel}'`)
  }

  /**
   * Get online members in a presence channel
   */
  getOnlineMembers(channel: string): Member[] {
    const presenceChannel = channel.startsWith('presence-') ? channel : `presence-${channel}`
    return this.presenceMembers.get(presenceChannel) || []
  }

  /**
   * Add a member to a presence channel (called by webhook handlers)
   */
  addPresenceMember(channel: string, member: Member): void {
    const presenceChannel = channel.startsWith('presence-') ? channel : `presence-${channel}`

    const members = this.presenceMembers.get(presenceChannel) || []

    // Check if member already exists
    if (!members.find(m => m.id === member.id)) {
      members.push(member)
      this.presenceMembers.set(presenceChannel, members)

      // Notify callbacks
      const callbacks = this.presenceCallbacks.get(presenceChannel)
      if (callbacks) {
        callbacks.onJoin(member)
      }
    }
  }

  /**
   * Remove a member from a presence channel (called by webhook handlers)
   */
  removePresenceMember(channel: string, memberId: string): void {
    const presenceChannel = channel.startsWith('presence-') ? channel : `presence-${channel}`

    const members = this.presenceMembers.get(presenceChannel) || []
    const memberIndex = members.findIndex(m => m.id === memberId)

    if (memberIndex !== -1) {
      const [removedMember] = members.splice(memberIndex, 1)
      this.presenceMembers.set(presenceChannel, members)

      // Notify callbacks
      const callbacks = this.presenceCallbacks.get(presenceChannel)
      if (callbacks) {
        callbacks.onLeave(removedMember)
      }
    }
  }

  /**
   * Dispose resources and clear all timers
   */
  dispose(): void {
    // Clear all flush timers
    for (const timer of this.flushTimers.values()) {
      clearTimeout(timer)
    }
    this.flushTimers.clear()

    // Clear all queues
    this.eventQueues.clear()

    // Clear presence state
    this.presenceMembers.clear()
    this.presenceCallbacks.clear()

    console.log('[BatchedPusher] Disposed all resources')
  }
}

// ==================== SINGLETON INSTANCE ====================

/**
 * Create a singleton instance using environment variables
 */
function createBatchedPusherService(): BatchedPusherService {
  return new BatchedPusherService({
    appId: process.env.PUSHER_APP_ID || '',
    key: process.env.VITE_PUSHER_KEY || '',
    secret: process.env.PUSHER_SECRET || '',
    cluster: process.env.VITE_PUSHER_CLUSTER || 'eu',
    useTLS: true,
    batchIntervalMs: 100,
    maxBatchSize: 100,
  })
}

// Export singleton instance
export const batchedPusherService = createBatchedPusherService()

// ==================== HELPER FUNCTIONS ====================

/**
 * Get the channel name for auction sessions
 */
export function getAuctionChannel(sessionId: string): string {
  return `auction-${sessionId}`
}

/**
 * Get the presence channel name for auction sessions
 */
export function getAuctionPresenceChannel(sessionId: string): string {
  return `presence-auction-${sessionId}`
}

// ==================== PUSHER EVENTS ====================

export const BATCHED_PUSHER_EVENTS = {
  // Batch event type
  BATCHED_EVENTS: 'batched-events',

  // Timer events (sent immediately)
  TIMER_RESET: 'timer-reset',
  TIMER_UPDATE: 'timer-update',

  // Auction events (batched)
  BID_PLACED: 'bid-placed',
  NOMINATION_PENDING: 'nomination-pending',
  NOMINATION_CONFIRMED: 'nomination-confirmed',
  MEMBER_READY: 'member-ready',
  AUCTION_STARTED: 'auction-started',
  AUCTION_CLOSED: 'auction-closed',

  // Rubata events (batched)
  RUBATA_STEAL_DECLARED: 'rubata-steal-declared',
  RUBATA_BID_PLACED: 'rubata-bid-placed',
  RUBATA_STATE_CHANGED: 'rubata-state-changed',
  RUBATA_READY_CHANGED: 'rubata-ready-changed',

  // Svincolati events (batched)
  SVINCOLATI_STATE_CHANGED: 'svincolati-state-changed',
  SVINCOLATI_NOMINATION: 'svincolati-nomination',
  SVINCOLATI_BID_PLACED: 'svincolati-bid-placed',
  SVINCOLATI_READY_CHANGED: 'svincolati-ready-changed',

  // Presence events
  MEMBER_JOINED: 'pusher:member_added',
  MEMBER_LEFT: 'pusher:member_removed',
} as const
