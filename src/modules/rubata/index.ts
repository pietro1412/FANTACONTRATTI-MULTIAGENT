/**
 * Rubata Module - Public API
 *
 * This file exports the public API of the Rubata module.
 * External modules should only import from this file.
 *
 * The Rubata module handles the "mercato ricorrente" (recurring market) phase
 * where managers can "steal" players from other managers' rosters.
 */

// =============================================================================
// Domain Entities
// =============================================================================

export type {
  RubataSession,
  RubataStatus,
  RubataPhase,
  CreateRubataSessionData,
} from './domain/entities/rubata-session.entity'
export { createRubataSession } from './domain/entities/rubata-session.entity'

export type {
  RubataBoardEntry,
  RubataBoardStatus,
  RubataBoardEntryWithDetails,
  CreateBoardEntryData,
} from './domain/entities/rubata-board.entity'
export {
  createBoardEntry,
  canTransitionBoardStatus,
} from './domain/entities/rubata-board.entity'

export type {
  RubataOffer,
  OfferStatus,
  CreateOfferData,
} from './domain/entities/rubata-offer.entity'
export {
  createOffer,
  isValidOfferAmount,
  isHigherOffer,
} from './domain/entities/rubata-offer.entity'

export type {
  RubataReadyStatus,
  CreateReadyStatusData,
} from './domain/entities/rubata-ready.entity'
export {
  createReadyStatus,
  markAsReady,
  resetReady,
  areAllMembersReady,
  getNotReadyMembers,
  getReadyCount,
} from './domain/entities/rubata-ready.entity'

// =============================================================================
// Domain Repository Interfaces
// =============================================================================

export type {
  IRubataRepository,
  AddToBoardData,
  PlaceOfferData,
  PlaceOfferResult,
  UpdateSessionPhaseData,
  BoardEntriesFilter,
} from './domain/repositories/rubata.repository.interface'

// =============================================================================
// Application DTOs
// =============================================================================

export type {
  // Input DTOs
  SetupRubataDto,
  AddToBoardDto,
  RemoveFromBoardDto,
  PlaceOfferDto,
  SetReadyDto,
  StartAuctionDto,
  // Output DTOs
  SetupRubataResultDto,
  RubataBoardDto,
  AddToBoardResultDto,
  PlaceOfferResultDto,
  ReadyStatusDto,
  StartAuctionResultDto,
  // Query DTOs
  GetBoardQueryDto,
  GetOffersQueryDto,
  GetMemberEntriesQueryDto,
} from './application/dto/rubata.dto'

// =============================================================================
// Application Use Cases
// =============================================================================

export { SetupRubataUseCase } from './application/use-cases/setup-rubata.use-case'
export { AddToBoardUseCase } from './application/use-cases/add-to-board.use-case'
export { PlaceOfferUseCase } from './application/use-cases/place-offer.use-case'
export { StartRubataAuctionUseCase, type IAuctionService } from './application/use-cases/start-rubata-auction.use-case'
export { CheckReadyUseCase } from './application/use-cases/check-ready.use-case'

// =====================================================
// PRESENTATION LAYER EXPORTS
// =====================================================

// Re-export presentation layer
export * from './presentation'
