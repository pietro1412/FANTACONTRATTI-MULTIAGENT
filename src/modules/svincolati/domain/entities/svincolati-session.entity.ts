/**
 * Svincolati Session Entity - Domain Layer
 *
 * Represents the state of a free agent auction session.
 * This is the core domain entity for managing turn-based svincolati auctions.
 */

/**
 * Possible states of a svincolati session
 */
export type SvincolatiStatus =
  | 'SETUP'          // Initial state, turn order being set
  | 'READY_CHECK'    // Waiting for members to confirm they're ready
  | 'NOMINATION'     // Current nominator is selecting a player
  | 'AUCTION'        // Active auction in progress
  | 'PENDING_ACK'    // Waiting for all members to acknowledge auction result
  | 'COMPLETED'      // Session has ended

/**
 * Svincolati Session Entity
 * Represents the current state of a free agent auction round
 */
export interface SvincolatiSession {
  /** ID of the market session this svincolati belongs to */
  marketSessionId: string

  /** Current status/phase of the svincolati session */
  status: SvincolatiStatus

  /** ID of the member whose turn it is to nominate (null if no one) */
  currentNominatorId: string | null

  /** Current round number (starts at 1) */
  currentRound: number

  /** Maximum number of rounds before session ends */
  totalRounds: number

  /** Timer duration in seconds for each auction */
  timerSeconds: number
}

/**
 * Data for creating a new svincolati session
 */
export interface CreateSvincolatiSessionData {
  marketSessionId: string
  timerSeconds?: number
  totalRounds?: number
}

/**
 * Data for updating a svincolati session
 */
export interface UpdateSvincolatiSessionData {
  status?: SvincolatiStatus
  currentNominatorId?: string | null
  currentRound?: number
  timerSeconds?: number
}

/**
 * Validates that a status value is a valid SvincolatiStatus
 */
export function isValidSvincolatiStatus(status: string): status is SvincolatiStatus {
  return [
    'SETUP',
    'READY_CHECK',
    'NOMINATION',
    'AUCTION',
    'PENDING_ACK',
    'COMPLETED'
  ].includes(status)
}

/**
 * Default timer duration in seconds
 */
export const DEFAULT_SVINCOLATI_TIMER_SECONDS = 30

/**
 * Default number of rounds
 */
export const DEFAULT_SVINCOLATI_ROUNDS = 99 // Effectively unlimited
