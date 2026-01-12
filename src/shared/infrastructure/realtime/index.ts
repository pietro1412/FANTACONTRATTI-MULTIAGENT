/**
 * Real-time infrastructure module
 *
 * Provides enhanced Pusher service with event batching for optimized real-time communication.
 */

export {
  // Main service class
  BatchedPusherService,

  // Singleton instance
  batchedPusherService,

  // Types
  type PusherEvent,
  type Member,
  type PresenceCallbacks,
  type BatchedEventPayload,
  type BatchedPusherConfig,
  type IBatchedPusherService,
  type TimerResetData,

  // Helper functions
  getAuctionChannel,
  getAuctionPresenceChannel,

  // Event constants
  BATCHED_PUSHER_EVENTS,
} from './pusher.service'
