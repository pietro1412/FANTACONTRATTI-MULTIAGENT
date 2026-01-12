/**
 * Svincolati Module - Public API
 *
 * This file exports the public API of the Svincolati module.
 * External modules should only import from this file.
 *
 * The Svincolati module handles turn-based free agent auctions where:
 * - Turn order is calculated by budget (lowest first)
 * - Members take turns nominating players
 * - All members confirm before auction starts
 * - After auction, turn advances to next member
 * - Members can pass their turn
 * - Session ends when all members pass
 */

// ==================== DOMAIN ENTITIES ====================

export type {
  SvincolatiSession,
  SvincolatiStatus,
  CreateSvincolatiSessionData,
  UpdateSvincolatiSessionData
} from './domain/entities/svincolati-session.entity'

export {
  isValidSvincolatiStatus,
  DEFAULT_SVINCOLATI_TIMER_SECONDS,
  DEFAULT_SVINCOLATI_ROUNDS
} from './domain/entities/svincolati-session.entity'

export type {
  SvincolatiTurnOrder,
  CreateTurnOrderData,
  UpdateTurnOrderData,
  MemberWithBudget
} from './domain/entities/turn-order.entity'

export {
  calculateTurnOrderByBudget,
  getNextActiveMemeber,
  allMembersPassed,
  allMembersFinished
} from './domain/entities/turn-order.entity'

export type {
  SvincolatiNomination,
  NominationStatus,
  CreateNominationData,
  UpdateNominationData,
  NominateResult,
  NominationError
} from './domain/entities/nomination.entity'

export {
  isValidNominationStatus,
  canCancelNomination,
  canConfirmNomination,
  isNominationComplete
} from './domain/entities/nomination.entity'

// ==================== DOMAIN REPOSITORY INTERFACES ====================

export type {
  ISvincolatiRepository,
  Player,
  NominateAtomicData
} from './domain/repositories/svincolati.repository.interface'

// ==================== APPLICATION DTOS ====================

export type {
  // Setup
  SetupSvincolatiDto,
  SetupSvincolatiResultDto,

  // Nomination
  NominatePlayerDto,
  NominatePlayerResultDto,
  ConfirmNominationDto,
  CancelNominationDto,

  // Turn management
  PassTurnDto,
  PassTurnResultDto,
  MarkReadyDto,
  MarkReadyResultDto,

  // State queries
  GetSvincolatiStateDto,
  SvincolatiStateDto,

  // Advance turn
  AdvanceTurnDto,
  AdvanceTurnResultDto,

  // Declare finished
  DeclareFinishedDto,
  DeclareFinishedResultDto,

  // Helper DTOs
  TurnOrderMemberDto,
  NominationDto,
  PendingNominationDto,
  ActiveAuctionDto,
  AuctionBidDto,
  PlayerDto
} from './application/dto/svincolati.dto'

// ==================== APPLICATION USE CASES ====================

export { SetupSvincolatiUseCase } from './application/use-cases/setup-svincolati.use-case'

export {
  NominatePlayerUseCase,
  PlayerAlreadyOwnedError,
  PlayerAlreadyNominatedError,
  WrongPhaseError
} from './application/use-cases/nominate-player.use-case'
export type { NominatePlayerError } from './application/use-cases/nominate-player.use-case'

export {
  PassTurnUseCase,
  CannotPassNowError,
  AlreadyPassedError
} from './application/use-cases/pass-turn.use-case'
export type { PassTurnError } from './application/use-cases/pass-turn.use-case'

export {
  AdvanceTurnUseCase,
  CannotAdvanceError
} from './application/use-cases/advance-turn.use-case'
export type { AdvanceTurnError } from './application/use-cases/advance-turn.use-case'

export { GetSvincolatiStateUseCase } from './application/use-cases/get-svincolati-state.use-case'
export type { GetSvincolatiStateError } from './application/use-cases/get-svincolati-state.use-case'

// =====================================================
// PRESENTATION LAYER EXPORTS
// =====================================================

// Re-export presentation layer
export * from './presentation'
