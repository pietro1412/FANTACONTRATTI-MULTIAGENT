/**
 * Bcrypt Password Service - Infrastructure Layer
 *
 * Implements IPasswordService interface using bcryptjs.
 * Provides secure password hashing and verification.
 */

import bcrypt from 'bcryptjs'
import type { IPasswordService } from '../../domain/services/password.service'

/**
 * Number of salt rounds for bcrypt hashing
 * Higher = more secure but slower
 */
const SALT_ROUNDS = 12

export class BcryptPasswordService implements IPasswordService {
  /**
   * Hash a plain text password using bcrypt
   * @param password - The plain text password to hash
   * @returns The hashed password
   */
  async hash(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(SALT_ROUNDS)
    return bcrypt.hash(password, salt)
  }

  /**
   * Verify a plain text password against a bcrypt hash
   * @param password - The plain text password to verify
   * @param hash - The hash to compare against
   * @returns True if the password matches, false otherwise
   */
  async verify(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash)
  }
}
