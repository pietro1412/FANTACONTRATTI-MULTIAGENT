/**
 * Auction Repository Interface - Domain Layer
 *
 * Defines the contract for auction persistence operations.
 * Implementations should handle database transactions and concurrency.
 */

import type { Auction, CreateAuctionData, AuctionStatus } from '../entities/auction.entity'
import type { AuctionBid, CreateBidData } from '../entities/bid.entity'
import type { AuctionAppeal, CreateAppealData, ResolveAppealData } from '../entities/appeal.entity'

/**
 * Data required to place a bid
 */
export interface PlaceBidData {
  auctionId: string
  bidderId: string
  amount: number
  newTimerExpiresAt: Date
}

/**
 * Result of placing a bid atomically
 */
export interface PlaceBidResult {
  success: boolean
  bid?: AuctionBid
  previousWinnerId?: string | null
  error?: 'AUCTION_NOT_FOUND' | 'AUCTION_NOT_ACTIVE' | 'BID_TOO_LOW' | 'CONCURRENT_BID'
}

/**
 * Result of closing an auction
 */
export interface CloseAuctionResult {
  winnerId: string | null
  finalAmount: number
  wasSuccessful: boolean
}

/**
 * Filter options for finding auctions
 */
export interface AuctionFilter {
  sessionId?: string
  status?: AuctionStatus
  playerId?: string
}

/**
 * Auction Repository Interface
 *
 * All methods that modify data should be transactional.
 * Methods that need concurrency control are clearly marked.
 */
export interface IAuctionRepository {
  /**
   * Find an auction by ID
   */
  findById(id: string): Promise<Auction | null>

  /**
   * Find the active auction in a session (only one can be active at a time)
   */
  findActiveBySession(sessionId: string): Promise<Auction | null>

  /**
   * Find auctions matching the filter criteria
   */
  findMany(filter: AuctionFilter): Promise<Auction[]>

  /**
   * Create a new auction
   * Should validate that no other active auction exists in the session
   */
  create(data: CreateAuctionData): Promise<Auction>

  /**
   * Place a bid atomically using SELECT FOR UPDATE
   *
   * CRITICAL: This method must use database-level locking to prevent race conditions.
   * The implementation should:
   * 1. SELECT the auction FOR UPDATE to acquire a lock
   * 2. Validate the bid amount > currentPrice
   * 3. Update previous winning bid to isWinning = false
   * 4. Insert new bid with isWinning = true
   * 5. Update auction currentPrice, currentWinnerId, and timerExpiresAt
   * 6. COMMIT the transaction
   *
   * If any step fails, the entire operation should rollback.
   *
   * @param auctionId - ID of the auction
   * @param bid - Bid data including new timer expiration
   * @returns PlaceBidResult indicating success or specific failure reason
   */
  placeBidAtomic(auctionId: string, bid: PlaceBidData): Promise<PlaceBidResult>

  /**
   * Close an auction with the winner
   */
  close(auctionId: string, winnerId: string | null, finalAmount: number): Promise<void>

  /**
   * Cancel an auction (e.g., admin cancellation)
   */
  cancel(auctionId: string): Promise<void>

  /**
   * Reset the auction timer
   */
  resetTimer(auctionId: string, expiresAt: Date): Promise<void>

  /**
   * Update auction status
   */
  updateStatus(auctionId: string, status: AuctionStatus): Promise<void>

  // ==================== BID OPERATIONS ====================

  /**
   * Get all bids for an auction, ordered by amount descending
   */
  getBids(auctionId: string): Promise<AuctionBid[]>

  /**
   * Get the winning bid for an auction
   */
  getWinningBid(auctionId: string): Promise<AuctionBid | null>

  /**
   * Create a bid (use placeBidAtomic for concurrent-safe bidding)
   */
  createBid(data: CreateBidData): Promise<AuctionBid>

  // ==================== APPEAL OPERATIONS ====================

  /**
   * Get the appeal for an auction (if any)
   */
  getAppeal(auctionId: string): Promise<AuctionAppeal | null>

  /**
   * Create an appeal for an auction
   */
  createAppeal(data: CreateAppealData): Promise<AuctionAppeal>

  /**
   * Resolve an appeal
   */
  resolveAppeal(appealId: string, data: ResolveAppealData): Promise<AuctionAppeal>

  /**
   * Get pending appeals (for admin dashboard)
   */
  getPendingAppeals(leagueId: string): Promise<AuctionAppeal[]>
}
