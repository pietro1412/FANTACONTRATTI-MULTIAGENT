/**
 * RubataReadyStatus Entity
 *
 * Tracks whether members are ready to proceed with rubata operations.
 * Used for ready checks before starting phases or auctions.
 */

/**
 * RubataReadyStatus - tracks a member's ready state
 */
export interface RubataReadyStatus {
  /** Unique identifier */
  id: string
  /** The session this status belongs to */
  sessionId: string
  /** The member this status is for */
  memberId: string
  /** Whether the member has declared ready */
  isReady: boolean
  /** When the member became ready (null if not ready) */
  readyAt: Date | null
}

/**
 * Data required to create a ready status
 */
export interface CreateReadyStatusData {
  sessionId: string
  memberId: string
}

/**
 * Factory function to create a new ready status (initially not ready)
 */
export function createReadyStatus(id: string, data: CreateReadyStatusData): RubataReadyStatus {
  return {
    id,
    sessionId: data.sessionId,
    memberId: data.memberId,
    isReady: false,
    readyAt: null,
  }
}

/**
 * Marks a ready status as ready
 */
export function markAsReady(status: RubataReadyStatus): RubataReadyStatus {
  return {
    ...status,
    isReady: true,
    readyAt: new Date(),
  }
}

/**
 * Resets a ready status to not ready
 */
export function resetReady(status: RubataReadyStatus): RubataReadyStatus {
  return {
    ...status,
    isReady: false,
    readyAt: null,
  }
}

/**
 * Checks if all members in a list are ready
 */
export function areAllMembersReady(statuses: RubataReadyStatus[]): boolean {
  return statuses.length > 0 && statuses.every((s) => s.isReady)
}

/**
 * Gets the list of member IDs that are not yet ready
 */
export function getNotReadyMembers(statuses: RubataReadyStatus[]): string[] {
  return statuses.filter((s) => !s.isReady).map((s) => s.memberId)
}

/**
 * Gets the count of ready members
 */
export function getReadyCount(statuses: RubataReadyStatus[]): { ready: number; total: number } {
  return {
    ready: statuses.filter((s) => s.isReady).length,
    total: statuses.length,
  }
}
