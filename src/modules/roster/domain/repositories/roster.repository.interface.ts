/**
 * Roster Repository Interface - Domain Layer
 * Defines the contract for roster data persistence operations
 */

import type { PlayerRoster, CreateRosterData } from '../entities/roster.entity'
import type { PlayerContract, CreateContractData, UpdateContractData } from '../entities/contract.entity'

/**
 * Interface for roster repository operations
 * Implementations can use different data sources (Prisma, in-memory, etc.)
 */
export interface IRosterRepository {
  /**
   * Find all roster entries for a league member
   * @param memberId - The league member ID
   * @returns Promise resolving to array of player rosters
   */
  findByMemberId(memberId: string): Promise<PlayerRoster[]>

  /**
   * Find a specific roster entry by ID
   * @param id - The roster entry ID
   * @returns Promise resolving to the roster entry or null if not found
   */
  findById(id: string): Promise<PlayerRoster | null>

  /**
   * Get the contract associated with a roster entry
   * @param rosterId - The roster entry ID
   * @returns Promise resolving to the contract or null if no contract exists
   */
  getContract(rosterId: string): Promise<PlayerContract | null>

  /**
   * Create a new roster entry
   * @param data - The roster creation data
   * @returns Promise resolving to the created roster entry
   */
  createRoster(data: CreateRosterData): Promise<PlayerRoster>

  /**
   * Create a new contract for a roster entry
   * @param data - The contract creation data
   * @returns Promise resolving to the created contract
   */
  createContract(data: CreateContractData): Promise<PlayerContract>

  /**
   * Update an existing contract
   * @param id - The contract ID
   * @param data - The update data
   * @returns Promise resolving to the updated contract
   */
  updateContract(id: string, data: UpdateContractData): Promise<PlayerContract>

  /**
   * Release a player from the roster
   * Marks the roster entry as RELEASED
   * @param rosterId - The roster entry ID
   */
  releasePlayer(rosterId: string): Promise<void>

  /**
   * Find all contracts for a league member
   * @param memberId - The league member ID
   * @returns Promise resolving to array of contracts with their roster info
   */
  findContractsByMemberId(memberId: string): Promise<Array<{
    roster: PlayerRoster
    contract: PlayerContract
  }>>

  /**
   * Find contracts eligible for consolidation (year 4+)
   * @param memberId - The league member ID
   * @returns Promise resolving to array of contracts ready for consolidation
   */
  findConsolidationEligible(memberId: string): Promise<PlayerContract[]>

  /**
   * Get member's current budget
   * @param memberId - The league member ID
   * @returns Promise resolving to the current budget
   */
  getMemberBudget(memberId: string): Promise<number>

  /**
   * Update member's budget
   * @param memberId - The league member ID
   * @param amount - The amount to add (negative to subtract)
   * @returns Promise resolving to the new budget
   */
  updateMemberBudget(memberId: string, amount: number): Promise<number>
}
