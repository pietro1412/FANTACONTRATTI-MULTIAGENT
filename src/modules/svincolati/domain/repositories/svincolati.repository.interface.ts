/**
 * Svincolati Repository Interface - Domain Layer
 *
 * Defines the contract for svincolati session persistence operations.
 * Implementations can use any data source (database, API, etc.)
 */

import type {
  SvincolatiSession,
  UpdateSvincolatiSessionData
} from '../entities/svincolati-session.entity'
import type {
  SvincolatiTurnOrder,
} from '../entities/turn-order.entity'
import type {
  SvincolatiNomination,
  UpdateNominationData,
  NominateResult
} from '../entities/nomination.entity'

/**
 * Player entity for available players list
 */
export interface Player {
  id: string
  name: string
  team: string
  position: 'P' | 'D' | 'C' | 'A'
  quotation: number
  isActive: boolean
}

/**
 * Data for atomic nomination operation
 */
export interface NominateAtomicData {
  sessionId: string
  playerId: string
  nominatorId: string
  round: number
}

/**
 * Svincolati Repository Interface
 */
export interface ISvincolatiRepository {
  // ==================== SESSION OPERATIONS ====================

  /**
   * Get a svincolati session by ID
   * @param sessionId - The market session ID
   * @returns The session or null if not found
   */
  getSession(sessionId: string): Promise<SvincolatiSession | null>

  /**
   * Get a svincolati session by league ID
   * @param leagueId - The league ID
   * @returns The active session or null if not found
   */
  getActiveSessionByLeagueId(leagueId: string): Promise<SvincolatiSession | null>

  /**
   * Update session state
   * @param sessionId - The market session ID
   * @param data - Data to update
   */
  updateSession(sessionId: string, data: UpdateSvincolatiSessionData): Promise<void>

  // ==================== TURN ORDER OPERATIONS ====================

  /**
   * Get the turn order for a session
   * @param sessionId - The market session ID
   * @returns Array of turn order entries sorted by orderIndex
   */
  getTurnOrder(sessionId: string): Promise<SvincolatiTurnOrder[]>

  /**
   * Set the turn order for a session
   * Creates new turn order entries from the member IDs
   * @param sessionId - The market session ID
   * @param memberIds - Array of member IDs in desired order
   */
  setTurnOrder(sessionId: string, memberIds: string[]): Promise<void>

  /**
   * Mark a member as having passed for this round
   * @param sessionId - The market session ID
   * @param memberId - The member ID
   */
  markPassed(sessionId: string, memberId: string): Promise<void>

  /**
   * Reset all pass flags for a new round
   * @param sessionId - The market session ID
   */
  resetPasses(sessionId: string): Promise<void>

  /**
   * Mark a member as finished (no more participation)
   * @param sessionId - The market session ID
   * @param memberId - The member ID
   */
  markFinished(sessionId: string, memberId: string): Promise<void>

  /**
   * Unmark a member as finished
   * @param sessionId - The market session ID
   * @param memberId - The member ID
   */
  unmarkFinished(sessionId: string, memberId: string): Promise<void>

  /**
   * Get the current turn member ID
   * @param sessionId - The market session ID
   * @returns The member ID of the current nominator
   */
  getCurrentTurnMemberId(sessionId: string): Promise<string | null>

  /**
   * Advance to the next active member
   * @param sessionId - The market session ID
   * @returns The next turn order entry or null if all passed/finished
   */
  advanceToNextMember(sessionId: string): Promise<SvincolatiTurnOrder | null>

  // ==================== NOMINATION OPERATIONS ====================

  /**
   * Nominate a player - ATOMIC operation
   * Performs all validation and creation in a single transaction
   * to prevent race conditions
   *
   * @param data - Nomination data
   * @returns Result with nomination or error
   */
  nominatePlayerAtomic(data: NominateAtomicData): Promise<NominateResult>

  /**
   * Get all nominations for a session
   * @param sessionId - The market session ID
   * @returns Array of nominations
   */
  getNominations(sessionId: string): Promise<SvincolatiNomination[]>

  /**
   * Get the current/pending nomination for a session
   * @param sessionId - The market session ID
   * @returns The pending nomination or null
   */
  getPendingNomination(sessionId: string): Promise<SvincolatiNomination | null>

  /**
   * Update a nomination
   * @param id - The nomination ID
   * @param data - Data to update
   */
  updateNomination(id: string, data: UpdateNominationData): Promise<void>

  /**
   * Cancel a pending nomination
   * @param id - The nomination ID
   * @returns true if cancelled, false if not allowed
   */
  cancelNomination(id: string): Promise<boolean>

  // ==================== PLAYER OPERATIONS ====================

  /**
   * Get available free agents for a session
   * Players not in any roster in the league
   *
   * @param sessionId - The market session ID
   * @param filters - Optional filters
   * @returns Array of available players
   */
  getAvailablePlayers(
    sessionId: string,
    filters?: {
      position?: 'P' | 'D' | 'C' | 'A'
      team?: string
      search?: string
      minQuotation?: number
      maxQuotation?: number
    }
  ): Promise<Player[]>

  /**
   * Check if a player is already in a roster for the league
   * @param sessionId - The market session ID
   * @param playerId - The player ID
   * @returns true if player is owned
   */
  isPlayerOwned(sessionId: string, playerId: string): Promise<boolean>

  /**
   * Check if a player has already been nominated (pending or in auction)
   * @param sessionId - The market session ID
   * @param playerId - The player ID
   * @returns true if player has active nomination
   */
  isPlayerNominated(sessionId: string, playerId: string): Promise<boolean>

  // ==================== MEMBER OPERATIONS ====================

  /**
   * Get member's current budget
   * @param memberId - The member ID
   * @returns The current budget
   */
  getMemberBudget(memberId: string): Promise<number>

  /**
   * Get all active members for a session's league
   * @param sessionId - The market session ID
   * @returns Array of member info with budgets
   */
  getActiveMembers(sessionId: string): Promise<Array<{
    id: string
    userId: string
    username: string
    currentBudget: number
    isAdmin: boolean
  }>>

  // ==================== READY CHECK OPERATIONS ====================

  /**
   * Get members who have marked ready for current nomination
   * @param sessionId - The market session ID
   * @returns Array of member IDs who are ready
   */
  getReadyMembers(sessionId: string): Promise<string[]>

  /**
   * Mark a member as ready
   * @param sessionId - The market session ID
   * @param memberId - The member ID
   */
  markReady(sessionId: string, memberId: string): Promise<void>

  /**
   * Clear all ready marks (when starting new nomination)
   * @param sessionId - The market session ID
   */
  clearReadyMarks(sessionId: string): Promise<void>

  /**
   * Check if all members are ready
   * @param sessionId - The market session ID
   * @returns true if all members are ready
   */
  areAllReady(sessionId: string): Promise<boolean>
}
