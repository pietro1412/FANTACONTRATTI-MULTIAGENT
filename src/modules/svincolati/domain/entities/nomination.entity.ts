/**
 * Nomination Entity - Domain Layer
 *
 * Represents a player nomination in a svincolati session.
 * Tracks the lifecycle of a nomination from creation through auction to completion.
 */

/**
 * Possible states of a nomination
 */
export type NominationStatus =
  | 'PENDING'     // Nominated but not yet confirmed by nominator
  | 'CONFIRMED'   // Nominator confirmed, waiting for others to ready up
  | 'IN_AUCTION'  // Active auction in progress
  | 'SOLD'        // Player was sold to a bidder
  | 'UNSOLD'      // No bids, player remains free agent

/**
 * Svincolati Nomination Entity
 * Represents a nomination of a free agent player
 */
export interface SvincolatiNomination {
  /** Unique identifier for this nomination */
  id: string

  /** ID of the svincolati/market session */
  sessionId: string

  /** ID of the nominated player */
  playerId: string

  /** ID of the member who nominated the player */
  nominatorId: string

  /** Round number when this nomination was made */
  round: number

  /** Current status of the nomination */
  status: NominationStatus

  /** When the nomination was created */
  createdAt: Date

  /** ID of the auction (set when auction starts) */
  auctionId: string | null

  /** ID of the winner (set when sold) */
  winnerId: string | null

  /** Final price (set when sold) */
  finalPrice: number | null
}

/**
 * Data for creating a new nomination
 */
export interface CreateNominationData {
  sessionId: string
  playerId: string
  nominatorId: string
  round: number
}

/**
 * Data for updating a nomination
 */
export interface UpdateNominationData {
  status?: NominationStatus
  auctionId?: string | null
  winnerId?: string | null
  finalPrice?: number | null
}

/**
 * Result of a nomination attempt
 */
export interface NominateResult {
  success: boolean
  nomination?: SvincolatiNomination
  error?: NominationError
}

/**
 * Possible errors when attempting to nominate
 */
export type NominationError =
  | 'NOT_YOUR_TURN'
  | 'PLAYER_ALREADY_OWNED'
  | 'PLAYER_ALREADY_NOMINATED'
  | 'INSUFFICIENT_BUDGET'
  | 'INVALID_PLAYER'
  | 'SESSION_NOT_ACTIVE'
  | 'WRONG_PHASE'

/**
 * Validates that a status value is a valid NominationStatus
 */
export function isValidNominationStatus(status: string): status is NominationStatus {
  return ['PENDING', 'CONFIRMED', 'IN_AUCTION', 'SOLD', 'UNSOLD'].includes(status)
}

/**
 * Checks if a nomination can be cancelled
 * Only PENDING nominations can be cancelled
 */
export function canCancelNomination(nomination: SvincolatiNomination): boolean {
  return nomination.status === 'PENDING'
}

/**
 * Checks if a nomination can be confirmed
 */
export function canConfirmNomination(nomination: SvincolatiNomination): boolean {
  return nomination.status === 'PENDING'
}

/**
 * Checks if a nomination is terminal (completed)
 */
export function isNominationComplete(nomination: SvincolatiNomination): boolean {
  return nomination.status === 'SOLD' || nomination.status === 'UNSOLD'
}
