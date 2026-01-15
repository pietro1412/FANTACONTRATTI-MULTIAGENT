/**
 * User Repository Interface - Domain Layer
 *
 * Defines the contract for user persistence operations.
 * Implementations can use any data source (database, API, etc.)
 */

import type { User, UserWithCredentials, CreateUserData } from '../entities/user.entity'

export interface IUserRepository {
  /**
   * Find a user by their unique ID
   * @param id - The user's unique identifier
   * @returns The user without credentials or null if not found
   */
  findById(id: string): Promise<User | null>

  /**
   * Find a user by their email address
   * Includes password hash for authentication purposes
   * @param email - The user's email address
   * @returns The user with credentials or null if not found
   */
  findByEmail(email: string): Promise<UserWithCredentials | null>

  /**
   * Create a new user in the system
   * @param data - The data required to create the user
   * @returns The created user without credentials
   */
  create(data: CreateUserData): Promise<User>

  /**
   * Update the last login timestamp for a user
   * @param userId - The user's unique identifier
   */
  updateLastLogin(userId: string): Promise<void>
}
