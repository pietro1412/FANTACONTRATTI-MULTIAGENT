/**
 * Turn Order Entity - Domain Layer
 *
 * Normalized entity for tracking turn order in svincolati sessions.
 * Replaces the JSON field approach for better data integrity and queries.
 */

/**
 * Svincolati Turn Order Entity
 * Represents a single member's position in the turn order
 */
export interface SvincolatiTurnOrder {
  /** Unique identifier for this turn order entry */
  id: string

  /** ID of the svincolati/market session */
  sessionId: string

  /** ID of the league member */
  memberId: string

  /** Position in turn order (0-indexed) */
  orderIndex: number

  /** Whether this member has passed for the current round */
  hasPassed: boolean

  /** Whether this member has declared they're finished for the session */
  hasFinished: boolean
}

/**
 * Data for creating a turn order entry
 */
export interface CreateTurnOrderData {
  sessionId: string
  memberId: string
  orderIndex: number
}

/**
 * Update data for a turn order entry
 */
export interface UpdateTurnOrderData {
  hasPassed?: boolean
  hasFinished?: boolean
  orderIndex?: number
}

/**
 * Member info with budget for calculating initial turn order
 */
export interface MemberWithBudget {
  id: string
  currentBudget: number
  username: string
}

/**
 * Calculates turn order based on budget (lowest budget first)
 * This gives disadvantaged teams priority in free agent selection
 *
 * @param members - Array of members with their budgets
 * @returns Array of member IDs sorted by budget (ascending)
 */
export function calculateTurnOrderByBudget(members: MemberWithBudget[]): string[] {
  return [...members]
    .sort((a, b) => a.currentBudget - b.currentBudget)
    .map(m => m.id)
}

/**
 * Gets the next member in turn order who hasn't passed
 *
 * @param turnOrder - Ordered array of turn entries
 * @param currentIndex - Current position in turn order
 * @returns The next turn order entry, or null if all have passed
 */
export function getNextActiveMemeber(
  turnOrder: SvincolatiTurnOrder[],
  currentIndex: number
): SvincolatiTurnOrder | null {
  if (turnOrder.length === 0) return null

  // Count how many we've checked to avoid infinite loop
  let checked = 0
  let index = (currentIndex + 1) % turnOrder.length

  while (checked < turnOrder.length) {
    const entry = turnOrder.find(t => t.orderIndex === index)
    if (entry && !entry.hasPassed && !entry.hasFinished) {
      return entry
    }
    index = (index + 1) % turnOrder.length
    checked++
  }

  return null
}

/**
 * Checks if all members have passed in the current round
 *
 * @param turnOrder - Array of turn order entries
 * @returns true if all members have passed
 */
export function allMembersPassed(turnOrder: SvincolatiTurnOrder[]): boolean {
  return turnOrder.every(t => t.hasPassed || t.hasFinished)
}

/**
 * Checks if all members have finished the session
 *
 * @param turnOrder - Array of turn order entries
 * @returns true if all members have declared finished
 */
export function allMembersFinished(turnOrder: SvincolatiTurnOrder[]): boolean {
  return turnOrder.every(t => t.hasFinished)
}
