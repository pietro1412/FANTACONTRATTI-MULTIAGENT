/**
 * Movement Repository Interface - Domain Layer
 *
 * Defines the contract for movement persistence operations.
 * Implementations can use any data source (database, API, etc.)
 */

import type {
  PlayerMovement,
  PlayerMovementWithDetails,
  Prophecy,
  ProphecyWithDetails,
  CreateMovementData,
  CreateProphecyData,
  MovementHistoryFilter,
} from '../entities/movement.entity'

/**
 * Movement formatted for API response
 */
export interface FormattedMovement {
  id: string
  type: string
  player: {
    id: string
    name: string
    position: string
    team: string
  }
  from: {
    memberId: string
    username: string
    teamName: string
  } | null
  to: {
    memberId: string
    username: string
    teamName: string
  } | null
  price: number | null
  oldContract: {
    salary: number
    duration: number | null
    clause: number | null
  } | null
  newContract: {
    salary: number
    duration: number | null
    clause: number | null
  } | null
  prophecies: Array<{
    id: string
    content: string
    authorRole: string
    author: {
      memberId: string
      username: string
      teamName: string
    }
    createdAt: Date
    source: string
  }>
  createdAt: Date
}

/**
 * Movement repository interface
 */
export interface IMovementRepository {
  /**
   * Create a new movement record
   * @param data - The movement data
   * @returns The created movement ID
   */
  create(data: CreateMovementData): Promise<string | null>

  /**
   * Find a movement by ID
   * @param id - The movement ID
   * @returns The movement or null if not found
   */
  findById(id: string): Promise<PlayerMovementWithDetails | null>

  /**
   * Get movement history with filters
   * @param filter - Filter options
   * @returns Array of formatted movements
   */
  findMany(filter: MovementHistoryFilter): Promise<FormattedMovement[]>

  /**
   * Get all movements for a specific player in a league
   * @param leagueId - The league ID
   * @param playerId - The player ID
   * @returns Array of movements
   */
  findByPlayer(leagueId: string, playerId: string): Promise<PlayerMovementWithDetails[]>

  /**
   * Get movements for a specific member (as buyer or seller)
   * @param leagueId - The league ID
   * @param memberId - The member ID
   * @returns Array of movements
   */
  findByMember(leagueId: string, memberId: string): Promise<PlayerMovementWithDetails[]>

  /**
   * Check if a user is a member of a league
   * @param leagueId - The league ID
   * @param userId - The user ID
   * @returns The member ID if active member, null otherwise
   */
  checkMembership(leagueId: string, userId: string): Promise<string | null>
}

/**
 * Prophecy repository interface
 */
export interface IProphecyRepository {
  /**
   * Create a new prophecy
   * @param data - The prophecy data
   * @returns The created prophecy
   */
  create(data: CreateProphecyData): Promise<ProphecyWithDetails>

  /**
   * Find a prophecy by movement and author
   * @param movementId - The movement ID
   * @param authorId - The author (member) ID
   * @returns The prophecy or null if not found
   */
  findByMovementAndAuthor(movementId: string, authorId: string): Promise<ProphecyWithDetails | null>

  /**
   * Get all prophecies for a player in a league
   * @param leagueId - The league ID
   * @param playerId - The player ID
   * @returns Array of prophecies
   */
  findByPlayer(leagueId: string, playerId: string): Promise<ProphecyWithDetails[]>

  /**
   * Get all prophecies for a movement
   * @param movementId - The movement ID
   * @returns Array of prophecies
   */
  findByMovement(movementId: string): Promise<ProphecyWithDetails[]>
}
