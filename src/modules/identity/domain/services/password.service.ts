/**
 * Password Service Interface - Domain Layer
 *
 * Defines the contract for password hashing and verification.
 * Implementations can use any hashing algorithm (bcrypt, argon2, etc.)
 */

export interface IPasswordService {
  /**
   * Hash a plain text password
   * @param password - The plain text password to hash
   * @returns The hashed password
   */
  hash(password: string): Promise<string>

  /**
   * Verify a plain text password against a hash
   * @param password - The plain text password to verify
   * @param hash - The hash to compare against
   * @returns True if the password matches, false otherwise
   */
  verify(password: string, hash: string): Promise<boolean>
}
