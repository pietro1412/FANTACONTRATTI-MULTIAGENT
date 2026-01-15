/**
 * User Entity - Domain Layer
 *
 * Represents a user in the FANTACONTRATTI system.
 * This is the core domain entity for identity management.
 */

/**
 * Base User entity without sensitive credentials
 */
export interface User {
  id: string
  email: string
  teamName: string
  createdAt: Date
  updatedAt: Date
  isSuperAdmin: boolean
}

/**
 * User entity with password hash for authentication
 * Used internally by the identity module for credential verification
 */
export interface UserWithCredentials extends User {
  passwordHash: string
}

/**
 * Data required to create a new user
 */
export interface CreateUserData {
  email: string
  teamName: string
  passwordHash: string
}
