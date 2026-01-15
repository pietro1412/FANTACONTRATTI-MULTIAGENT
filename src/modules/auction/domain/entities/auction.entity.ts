/**
 * Auction Entity - Domain Layer
 *
 * Represents an auction for a player in a market session.
 * An auction has a lifecycle: ACTIVE -> (CLOSED | CANCELLED)
 */

/**
 * Auction status represents the lifecycle state of an auction
 */
export type AuctionStatus = 'ACTIVE' | 'CLOSED' | 'CANCELLED'

/**
 * Auction type represents the kind of auction based on market phase
 * - FREE: Standard free-bid auction (Primo Mercato or Asta Svincolati)
 * - RUBATA: Steal auction during RUBATA phase
 * - SVINCOLATI: Free agent auction
 */
export type AuctionType = 'FREE' | 'RUBATA' | 'SVINCOLATI'

/**
 * Core auction entity representing the domain model
 */
export interface Auction {
  /** Unique identifier */
  id: string
  /** Market session this auction belongs to */
  marketSessionId: string
  /** Player being auctioned */
  playerId: string
  /** Starting price for the auction */
  startingPrice: number
  /** Current highest bid amount */
  currentPrice: number
  /** Current winning bidder's LeagueMemberId (null if no bids) */
  currentWinnerId: string | null
  /** Current state of the auction */
  status: AuctionStatus
  /** Duration of the countdown timer in seconds */
  timerDuration: number
  /** When the timer will expire (null if auction not active) */
  timerExpiresAt: Date | null
  /** When the auction was created */
  createdAt: Date
  /** When the auction was closed (null if still active) */
  closedAt: Date | null
  /** Type of auction */
  type: AuctionType
}

/**
 * Data required to create a new auction
 */
export interface CreateAuctionData {
  marketSessionId: string
  playerId: string
  startingPrice: number
  timerDuration: number
  type: AuctionType
  nominatorId: string
}

/**
 * Type guard to check if a status is a valid AuctionStatus
 */
export const isValidAuctionStatus = (status: string): status is AuctionStatus => {
  return ['ACTIVE', 'CLOSED', 'CANCELLED'].includes(status)
}

/**
 * Type guard to check if a type is a valid AuctionType
 */
export const isValidAuctionType = (type: string): type is AuctionType => {
  return ['FREE', 'RUBATA', 'SVINCOLATI'].includes(type)
}

/**
 * Check if an auction is active and accepting bids
 */
export const isAuctionActive = (auction: Auction): boolean => {
  return auction.status === 'ACTIVE'
}

/**
 * Check if an auction timer has expired
 */
export const isTimerExpired = (auction: Auction): boolean => {
  if (!auction.timerExpiresAt) return false
  return new Date() > auction.timerExpiresAt
}

/**
 * Check if a bid amount is valid for the auction
 */
export const isValidBidAmount = (auction: Auction, amount: number): boolean => {
  return amount > auction.currentPrice
}
