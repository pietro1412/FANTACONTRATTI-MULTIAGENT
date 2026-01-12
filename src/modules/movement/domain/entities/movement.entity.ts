/**
 * Movement Entity - Domain Layer
 *
 * Represents a player movement in the FANTACONTRATTI system.
 * Movements track all player transfers between teams.
 */

/**
 * Movement types
 */
export type MovementType = 'AUCTION' | 'RUBATA' | 'SVINCOLATI' | 'TRADE' | 'RELEASE' | 'INITIAL'

/**
 * Prophecy role types
 */
export type ProphecyRole = 'P' | 'D' | 'C' | 'A'

/**
 * Contract snapshot for movement history
 */
export interface ContractSnapshot {
  salary: number
  duration: number
  clause: number | null
}

/**
 * Player Movement entity
 */
export interface PlayerMovement {
  id: string
  playerId: string
  leagueId: string
  fromMemberId: string | null
  toMemberId: string | null
  type: MovementType
  amount: number
  sessionId: string | null
  createdAt: Date
}

/**
 * Extended movement with contract details
 */
export interface PlayerMovementWithDetails extends PlayerMovement {
  oldContract: ContractSnapshot | null
  newContract: ContractSnapshot | null
  auctionId: string | null
  tradeId: string | null
}

/**
 * Prophecy entity
 */
export interface Prophecy {
  id: string
  leagueId: string
  predictorId: string
  playerId: string
  predictedRole: ProphecyRole
  createdAt: Date
  resolvedAt: Date | null
  wasCorrect: boolean | null
}

/**
 * Prophecy with author details
 */
export interface ProphecyWithDetails extends Prophecy {
  content: string
  authorRole: 'BUYER' | 'SELLER'
  movementId: string
}

/**
 * Data for creating a new movement
 */
export interface CreateMovementData {
  leagueId: string
  playerId: string
  movementType: string
  fromMemberId?: string | null
  toMemberId?: string | null
  price?: number
  oldSalary?: number | null
  oldDuration?: number | null
  oldClause?: number | null
  newSalary?: number | null
  newDuration?: number | null
  newClause?: number | null
  auctionId?: string | null
  tradeId?: string | null
  marketSessionId?: string | null
}

/**
 * Data for creating a prophecy
 */
export interface CreateProphecyData {
  leagueId: string
  playerId: string
  authorId: string
  movementId: string
  authorRole: 'BUYER' | 'SELLER'
  content: string
}

/**
 * Movement history filter options
 */
export interface MovementHistoryFilter {
  leagueId: string
  playerId?: string
  memberId?: string
  movementType?: string
  semester?: number
  limit?: number
  offset?: number
}
