/**
 * RubataSession Entity
 *
 * Represents the state of a rubata (steal) phase within a market session.
 * The rubata phase allows managers to declare interest in other managers' players.
 */

/**
 * Possible statuses for a rubata session
 * - SETUP: Initial state, admin preparing the rubata board
 * - BOARD_SELECTION: Members are selecting players for the board
 * - AUCTION: Auctions are in progress
 * - COMPLETED: Rubata phase is finished
 */
export type RubataStatus = 'SETUP' | 'BOARD_SELECTION' | 'AUCTION' | 'COMPLETED'

/**
 * Detailed phase states within the rubata session
 * - WAITING_READY: Waiting for all members to be ready
 * - BOARD_SELECTION: Board is being populated with players
 * - OFFERS: Offer phase for current player on the board
 * - AUCTION: Active auction for a player
 * - DONE: All players have been processed
 */
export type RubataPhase = 'WAITING_READY' | 'BOARD_SELECTION' | 'OFFERS' | 'AUCTION' | 'DONE'

/**
 * RubataSession represents the aggregate root for rubata operations
 */
export interface RubataSession {
  /** The ID of the market session this rubata belongs to */
  marketSessionId: string
  /** Current high-level status */
  status: RubataStatus
  /** Current detailed phase */
  currentPhase: RubataPhase
  /** Deadline for board setup (null if not in setup phase) */
  boardSetupDeadline: Date | null
  /** When the auction phase started (null if not in auction) */
  auctionStartedAt: Date | null
}

/**
 * Data required to create a new rubata session
 */
export interface CreateRubataSessionData {
  marketSessionId: string
}

/**
 * Factory function to create a new RubataSession in initial state
 */
export function createRubataSession(data: CreateRubataSessionData): RubataSession {
  return {
    marketSessionId: data.marketSessionId,
    status: 'SETUP',
    currentPhase: 'WAITING_READY',
    boardSetupDeadline: null,
    auctionStartedAt: null,
  }
}
