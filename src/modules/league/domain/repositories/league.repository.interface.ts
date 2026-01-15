/**
 * League Repository Interface
 *
 * Defines the contract for league data persistence operations.
 * This interface is part of the domain layer and should be implemented
 * by infrastructure adapters (e.g., PrismaLeagueRepository).
 */

import type { League, CreateLeagueData } from '../entities/league.entity'
import type { LeagueMember, AddMemberData, LeagueMemberWithUser } from '../entities/league-member.entity'

/**
 * League Repository Interface
 *
 * Following Clean Architecture principles, this interface defines
 * the contract for data access without specifying implementation details.
 */
export interface ILeagueRepository {
  /**
   * Find a league by its unique identifier
   * @param id - The league ID
   * @returns The league if found, null otherwise
   */
  findById(id: string): Promise<League | null>

  /**
   * Find a league by its invite code
   * @param code - The invite code
   * @returns The league if found, null otherwise
   */
  findByInviteCode(code: string): Promise<League | null>

  /**
   * Find all leagues that a user is a member of
   * @param userId - The user ID
   * @returns Array of leagues the user belongs to
   */
  findByUserId(userId: string): Promise<League[]>

  /**
   * Create a new league
   * @param data - The data required to create a league
   * @returns The created league
   */
  create(data: CreateLeagueData): Promise<League>

  /**
   * Add a member to a league
   * @param data - The data required to add a member
   * @returns The created league member
   */
  addMember(data: AddMemberData): Promise<LeagueMember>

  /**
   * Get a specific member of a league
   * @param leagueId - The league ID
   * @param userId - The user ID
   * @returns The league member if found, null otherwise
   */
  getMember(leagueId: string, userId: string): Promise<LeagueMember | null>

  /**
   * Get all members of a league
   * @param leagueId - The league ID
   * @returns Array of league members with user information
   */
  getMembers(leagueId: string): Promise<LeagueMemberWithUser[]>

  /**
   * Get count of active members in a league
   * @param leagueId - The league ID
   * @returns The number of active members
   */
  getActiveMemberCount(leagueId: string): Promise<number>

  /**
   * Update a member's budget
   * @param memberId - The member ID
   * @param budget - The new budget value
   */
  updateMemberBudget(memberId: string, budget: number): Promise<void>

  /**
   * Check if a user is already a member of a league (any status)
   * @param leagueId - The league ID
   * @param userId - The user ID
   * @returns True if the user has any membership in the league
   */
  memberExists(leagueId: string, userId: string): Promise<boolean>
}
