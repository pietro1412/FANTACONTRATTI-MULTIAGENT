/**
 * Auction Module - Public API
 *
 * This module handles all auction-related functionality for FANTACONTRATTI.
 * This is a CRITICAL module for real-time performance.
 *
 * Layer Structure:
 * - Domain: Entities, Repository interfaces
 * - Application: Use cases, DTOs
 * - Infrastructure: Repository implementations (outside this module)
 *
 * Features:
 * - Real-time auction management
 * - Atomic bid placement with race condition prevention
 * - Timer-based auction lifecycle
 * - Appeal handling system
 */

// =====================================================
// DOMAIN LAYER EXPORTS
// =====================================================

// Auction Entity
export type {
  Auction,
  AuctionStatus,
  AuctionType,
  CreateAuctionData,
} from './domain/entities/auction.entity'

export {
  isValidAuctionStatus,
  isValidAuctionType,
  isAuctionActive,
  isTimerExpired,
  isValidBidAmount,
} from './domain/entities/auction.entity'

// Bid Entity
export type {
  AuctionBid,
  CreateBidData,
} from './domain/entities/bid.entity'

export {
  BidAmount,
  tryCreateBidAmount,
  isOutbid,
  getMinimumBid,
} from './domain/entities/bid.entity'

// Appeal Entity
export type {
  AuctionAppeal,
  AppealStatus,
  CreateAppealData,
  ResolveAppealData,
} from './domain/entities/appeal.entity'

export {
  isValidAppealStatus,
  isPending,
  isAccepted,
  isRejected,
  isResolved,
} from './domain/entities/appeal.entity'

// Repository Interface
export type {
  IAuctionRepository,
  PlaceBidData,
  PlaceBidResult,
  CloseAuctionResult,
  AuctionFilter,
} from './domain/repositories/auction.repository.interface'

// =====================================================
// APPLICATION LAYER EXPORTS
// =====================================================

// DTOs
export type {
  // Create Auction
  CreateAuctionDto,
  CreateAuctionResultDto,
  // Place Bid
  PlaceBidDto,
  BidResultDto,
  BidEventDto,
  // Close Auction
  CloseAuctionDto,
  CloseAuctionResultDto,
  AuctionClosedEventDto,
  // Appeals
  CreateAppealDto,
  ResolveAppealDto,
  AppealResultDto,
  // State
  AuctionStateDto,
  BidValidationDto,
} from './application/dto/auction.dto'

// Use Cases
export { PlaceBidUseCase } from './application/use-cases/place-bid.use-case'
export type { IBudgetService } from './application/use-cases/place-bid.use-case'

export { CreateAuctionUseCase } from './application/use-cases/create-auction.use-case'
export type {
  ISessionService,
  IPlayerService,
} from './application/use-cases/create-auction.use-case'

export { CloseAuctionUseCase } from './application/use-cases/close-auction.use-case'
export type {
  IRosterService,
  IPlayerService as ICloseAuctionPlayerService,
  IMemberService,
} from './application/use-cases/close-auction.use-case'

export {
  HandleAppealUseCase,
  CreateAppealUseCase,
  ResolveAppealUseCase,
} from './application/use-cases/handle-appeal.use-case'
export type {
  INotificationService,
  IAuthorizationService,
} from './application/use-cases/handle-appeal.use-case'

// =====================================================
// PRESENTATION LAYER EXPORTS
// =====================================================

// Re-export presentation layer
export * from './presentation'
