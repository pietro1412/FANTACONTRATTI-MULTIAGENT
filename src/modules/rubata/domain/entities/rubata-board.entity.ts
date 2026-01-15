/**
 * RubataBoardEntry Entity
 *
 * Represents a player entry on the rubata board.
 * This is a normalized entity that replaces the JSON field in MarketSession.
 * Each entry represents a player that can be "rubato" (stolen) during the rubata phase.
 */

/**
 * Possible statuses for a board entry
 * - PENDING: Entry has not been examined yet
 * - IN_AUCTION: Currently in auction
 * - SOLD: Player has been sold to a new owner
 * - RETURNED: Player returned to original owner (no offers or auction failed)
 */
export type RubataBoardStatus = 'PENDING' | 'IN_AUCTION' | 'SOLD' | 'RETURNED'

/**
 * RubataBoardEntry - a single player on the rubata board
 */
export interface RubataBoardEntry {
  /** Unique identifier for this board entry */
  id: string
  /** The session this entry belongs to */
  sessionId: string
  /** The roster entry for this player */
  rosterId: string
  /** The member who currently owns this player */
  memberId: string
  /** The player being put on the board */
  playerId: string
  /** Current status of this board entry */
  status: RubataBoardStatus
  /** When this entry was added to the board */
  createdAt: Date
}

/**
 * Data required to create a new board entry
 */
export interface CreateBoardEntryData {
  sessionId: string
  rosterId: string
  memberId: string
  playerId: string
}

/**
 * Extended board entry with player and contract details
 * Used for display purposes
 */
export interface RubataBoardEntryWithDetails extends RubataBoardEntry {
  playerName: string
  playerPosition: string
  playerTeam: string
  ownerUsername: string
  ownerTeamName: string | null
  contractSalary: number
  contractDuration: number
  contractClause: number
  /** Base price for rubata = clausola + ingaggio */
  rubataBasePrice: number
}

/**
 * Factory function to create a new board entry
 */
export function createBoardEntry(id: string, data: CreateBoardEntryData): RubataBoardEntry {
  return {
    id,
    sessionId: data.sessionId,
    rosterId: data.rosterId,
    memberId: data.memberId,
    playerId: data.playerId,
    status: 'PENDING',
    createdAt: new Date(),
  }
}

/**
 * Validates if a board entry can be transitioned to a new status
 */
export function canTransitionBoardStatus(
  currentStatus: RubataBoardStatus,
  newStatus: RubataBoardStatus
): boolean {
  const validTransitions: Record<RubataBoardStatus, RubataBoardStatus[]> = {
    PENDING: ['IN_AUCTION', 'RETURNED'],
    IN_AUCTION: ['SOLD', 'RETURNED'],
    SOLD: [], // Terminal state
    RETURNED: [], // Terminal state
  }

  return validTransitions[currentStatus].includes(newStatus)
}
