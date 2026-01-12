/**
 * Auction DTOs - Application Layer
 *
 * Data Transfer Objects for auction use cases.
 * These define the shape of data flowing in and out of use cases.
 */

import type { AuctionType, AuctionStatus } from '../../domain/entities/auction.entity'
import type { AppealStatus } from '../../domain/entities/appeal.entity'

// ==================== CREATE AUCTION ====================

/**
 * Input DTO for creating an auction
 */
export interface CreateAuctionDto {
  /** Market session ID */
  sessionId: string
  /** Player ID to auction */
  playerId: string
  /** Starting price (minimum bid) */
  startingPrice: number
  /** ID of the member nominating the player */
  nominatorId: string
  /** Type of auction */
  type?: AuctionType
}

/**
 * Result DTO after creating an auction
 */
export interface CreateAuctionResultDto {
  /** Created auction ID */
  auctionId: string
  /** Player ID */
  playerId: string
  /** Player name */
  playerName: string
  /** Starting price */
  startingPrice: number
  /** Timer duration in seconds */
  timerDuration: number
  /** When timer expires */
  timerExpiresAt: Date
}

// ==================== PLACE BID ====================

/**
 * Input DTO for placing a bid
 */
export interface PlaceBidDto {
  /** Auction ID */
  auctionId: string
  /** Bidder's league member ID */
  bidderId: string
  /** Bid amount in credits */
  amount: number
}

/**
 * Result DTO after placing a bid
 */
export interface BidResultDto {
  /** Whether the bid was successful */
  success: boolean
  /** Current highest price after the bid */
  currentPrice: number
  /** When the timer will expire */
  timerExpiresAt: Date
  /** Whether the bidder was outbid (returned to previous winner) */
  outbid: boolean
  /** ID of the previous winner (if any) */
  previousWinnerId?: string | null
  /** Error message if not successful */
  errorMessage?: string
}

/**
 * Real-time bid event for Pusher/WebSocket
 */
export interface BidEventDto {
  /** Auction ID */
  auctionId: string
  /** Bidder member ID */
  bidderId: string
  /** Bidder display name */
  bidderName: string
  /** Bid amount */
  amount: number
  /** Player ID being auctioned */
  playerId: string
  /** Player name */
  playerName: string
  /** New timer expiration */
  timerExpiresAt: Date
  /** Event timestamp */
  timestamp: Date
}

// ==================== CLOSE AUCTION ====================

/**
 * Input DTO for closing an auction
 */
export interface CloseAuctionDto {
  /** Auction ID */
  auctionId: string
  /** Admin's user ID (for authorization) */
  adminUserId: string
}

/**
 * Result DTO after closing an auction
 */
export interface CloseAuctionResultDto {
  /** Whether close was successful */
  success: boolean
  /** Winner's member ID (null if no bids) */
  winnerId: string | null
  /** Winner's display name */
  winnerName: string | null
  /** Final winning amount */
  finalAmount: number
  /** Player ID */
  playerId: string
  /** Player name */
  playerName: string
  /** Whether player was acquired (true) or unsold (false) */
  wasAcquired: boolean
}

/**
 * Real-time auction closed event for Pusher/WebSocket
 */
export interface AuctionClosedEventDto {
  /** Auction ID */
  auctionId: string
  /** Player ID */
  playerId: string
  /** Player name */
  playerName: string
  /** Winner member ID (null if unsold) */
  winnerId: string | null
  /** Winner name (null if unsold) */
  winnerName: string | null
  /** Final price (0 if unsold) */
  finalPrice: number
  /** Whether the player was unsold */
  wasUnsold: boolean
  /** Event timestamp */
  timestamp: Date
}

// ==================== APPEALS ====================

/**
 * Input DTO for creating an appeal
 */
export interface CreateAppealDto {
  /** Auction ID being appealed */
  auctionId: string
  /** Complainant's member ID */
  complainantId: string
  /** Reason for the appeal */
  reason: string
}

/**
 * Input DTO for resolving an appeal
 */
export interface ResolveAppealDto {
  /** Appeal ID */
  appealId: string
  /** Resolution decision */
  resolution: 'ACCEPTED' | 'REJECTED'
  /** Admin's resolution notes */
  notes: string
  /** Admin's user ID (for authorization) */
  adminUserId: string
}

/**
 * Result DTO for appeal operations
 */
export interface AppealResultDto {
  /** Appeal ID */
  appealId: string
  /** Current status */
  status: AppealStatus
  /** Resolution notes (if resolved) */
  resolution: string | null
  /** Whether action was taken (e.g., auction reopened) */
  actionTaken?: string
}

// ==================== AUCTION STATE ====================

/**
 * Full auction state DTO for frontend display
 */
export interface AuctionStateDto {
  /** Auction ID */
  id: string
  /** Market session ID */
  sessionId: string
  /** Player details */
  player: {
    id: string
    name: string
    position: string
    team: string
    quotation: number
  }
  /** Current status */
  status: AuctionStatus
  /** Starting price */
  startingPrice: number
  /** Current highest price */
  currentPrice: number
  /** Current winning bidder */
  currentWinner: {
    id: string
    name: string
  } | null
  /** Timer info */
  timer: {
    duration: number
    expiresAt: Date | null
    remainingSeconds: number | null
  }
  /** Recent bids */
  recentBids: {
    bidderId: string
    bidderName: string
    amount: number
    placedAt: Date
    isWinning: boolean
  }[]
  /** Auction type */
  type: AuctionType
}

// ==================== VALIDATION ====================

/**
 * DTO for bid validation result
 */
export interface BidValidationDto {
  isValid: boolean
  errors: string[]
  minimumBid: number
  availableBudget: number
  hasSlotAvailable: boolean
}
