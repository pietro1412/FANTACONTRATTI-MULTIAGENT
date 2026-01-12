/**
 * IRubataRepository Interface
 *
 * Repository interface for rubata operations following Repository pattern.
 * This interface abstracts the data access layer from business logic.
 */

import type {
  RubataSession,
  RubataStatus,
  RubataPhase,
} from '../entities/rubata-session.entity'
import type { RubataBoardEntry, RubataBoardEntryWithDetails } from '../entities/rubata-board.entity'
import type { RubataOffer } from '../entities/rubata-offer.entity'
import type { RubataReadyStatus } from '../entities/rubata-ready.entity'

// =============================================================================
// Data Transfer Types for Repository Methods
// =============================================================================

/**
 * Data required to add a player to the rubata board
 */
export interface AddToBoardData {
  sessionId: string
  rosterId: string
  memberId: string
  playerId: string
}

/**
 * Data required to place an offer
 */
export interface PlaceOfferData {
  boardEntryId: string
  offeredByMemberId: string
  amount: number
}

/**
 * Result of placing an offer (atomic transaction)
 */
export interface PlaceOfferResult {
  success: boolean
  offer?: RubataOffer
  /** The new highest offer amount */
  highestOffer?: number
  /** Error reason if failed */
  errorCode?:
    | 'ENTRY_NOT_FOUND'
    | 'ENTRY_ALREADY_IN_AUCTION'
    | 'INSUFFICIENT_BUDGET'
    | 'OFFER_TOO_LOW'
    | 'CANNOT_BID_OWN_PLAYER'
}

/**
 * Data for updating session phase
 */
export interface UpdateSessionPhaseData {
  sessionId: string
  status: RubataStatus
  phase: RubataPhase
}

/**
 * Filter options for getting board entries
 */
export interface BoardEntriesFilter {
  sessionId: string
  status?: RubataBoardEntry['status']
  memberId?: string
}

// =============================================================================
// Repository Interface
// =============================================================================

export interface IRubataRepository {
  // =============================================
  // Session Management
  // =============================================

  /**
   * Gets the rubata session for a market session
   * @param sessionId - The market session ID
   * @returns The rubata session or null if not found
   */
  getSession(sessionId: string): Promise<RubataSession | null>

  /**
   * Updates the status of a rubata session
   * @param sessionId - The session to update
   * @param status - The new status
   */
  updateSessionStatus(sessionId: string, status: RubataStatus): Promise<void>

  /**
   * Updates the phase of a rubata session
   * @param sessionId - The session to update
   * @param phase - The new phase
   */
  updateSessionPhase(sessionId: string, phase: RubataPhase): Promise<void>

  /**
   * Gets all active members in a session's league
   * @param sessionId - The session ID
   * @returns Array of member IDs
   */
  getSessionMembers(sessionId: string): Promise<string[]>

  // =============================================
  // Board Management
  // =============================================

  /**
   * Gets all board entries for a session
   * @param sessionId - The session ID
   * @returns Array of board entries
   */
  getBoardEntries(sessionId: string): Promise<RubataBoardEntry[]>

  /**
   * Gets board entries with player/owner details
   * @param sessionId - The session ID
   * @returns Array of detailed board entries
   */
  getBoardEntriesWithDetails(sessionId: string): Promise<RubataBoardEntryWithDetails[]>

  /**
   * Gets a specific board entry by ID
   * @param entryId - The board entry ID
   * @returns The board entry or null
   */
  getBoardEntry(entryId: string): Promise<RubataBoardEntry | null>

  /**
   * Gets the current board entry (the one being processed)
   * @param sessionId - The session ID
   * @returns The current pending board entry or null
   */
  getCurrentBoardEntry(sessionId: string): Promise<RubataBoardEntryWithDetails | null>

  /**
   * Atomically adds a player to the rubata board
   * Validates player ownership and board limits
   * @param data - The data for the new board entry
   * @returns The created board entry
   * @throws If validation fails
   */
  addToBoardAtomic(data: AddToBoardData): Promise<RubataBoardEntry>

  /**
   * Removes a player from the rubata board
   * @param entryId - The entry to remove
   */
  removeFromBoard(entryId: string): Promise<void>

  /**
   * Updates the status of a board entry
   * @param entryId - The entry to update
   * @param status - The new status
   */
  updateBoardEntryStatus(
    entryId: string,
    status: RubataBoardEntry['status']
  ): Promise<void>

  /**
   * Gets the count of board entries for a member
   * @param sessionId - The session ID
   * @param memberId - The member ID
   * @returns The count of entries
   */
  getMemberBoardCount(sessionId: string, memberId: string): Promise<number>

  // =============================================
  // Ready Status
  // =============================================

  /**
   * Gets the ready status for all members in a session
   * @param sessionId - The session ID
   * @returns Array of ready statuses
   */
  getReadyStatus(sessionId: string): Promise<RubataReadyStatus[]>

  /**
   * Sets a member as ready
   * @param sessionId - The session ID
   * @param memberId - The member to mark as ready
   */
  setReady(sessionId: string, memberId: string): Promise<void>

  /**
   * Resets all ready statuses for a session
   * @param sessionId - The session ID
   */
  resetAllReady(sessionId: string): Promise<void>

  /**
   * Initializes ready statuses for all members in a session
   * @param sessionId - The session ID
   * @param memberIds - Array of member IDs
   */
  initializeReadyStatuses(sessionId: string, memberIds: string[]): Promise<void>

  // =============================================
  // Offers - CRITICAL: Atomic Operations
  // =============================================

  /**
   * Places an offer atomically with validation
   * This is a CRITICAL operation that must:
   * - Check board entry exists and is valid
   * - Check entry is not already in auction
   * - Check bidder has sufficient budget
   * - Check offer is higher than current highest
   * - All within a single transaction to prevent race conditions
   *
   * @param data - The offer data
   * @returns The result of the operation
   */
  placeOfferAtomic(data: PlaceOfferData): Promise<PlaceOfferResult>

  /**
   * Gets all offers for a board entry
   * @param boardEntryId - The board entry ID
   * @returns Array of offers, ordered by amount descending
   */
  getOffers(boardEntryId: string): Promise<RubataOffer[]>

  /**
   * Gets the highest offer for a board entry
   * @param boardEntryId - The board entry ID
   * @returns The highest offer or null if none
   */
  getHighestOffer(boardEntryId: string): Promise<RubataOffer | null>

  /**
   * Cancels all pending offers for a board entry
   * Called when auction starts
   * @param boardEntryId - The board entry ID
   */
  cancelPendingOffers(boardEntryId: string): Promise<void>

  /**
   * Gets the member's budget
   * @param memberId - The member ID
   * @returns The current budget
   */
  getMemberBudget(memberId: string): Promise<number>
}
