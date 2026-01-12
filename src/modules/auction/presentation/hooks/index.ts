/**
 * Auction Module - Presentation Hooks
 *
 * Exports all hooks for the auction module.
 */

export { useAuction } from './useAuction'
export type {
  AuctionPlayer,
  CurrentAuction,
  AuctionState,
  UseAuctionOptions,
  UseAuctionResult,
} from './useAuction'

export { useAuctionSession } from './useAuctionSession'
export type { AuctionSession, UseAuctionSessionResult } from './useAuctionSession'

// Re-export Pusher hook for direct usage
export { usePusherAuction } from '@/services/pusher.client'
export type {
  BidPlacedData,
  NominationPendingData,
  NominationConfirmedData,
  MemberReadyData,
  AuctionClosedData,
  TimerUpdateData,
  UsePusherAuctionOptions,
  UsePusherAuctionResult,
} from '@/services/pusher.client'
