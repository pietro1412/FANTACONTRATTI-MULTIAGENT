/**
 * Token Service Interface - Domain Layer
 *
 * Defines the contract for JWT token generation and verification.
 * Implementations can use any JWT library.
 */

export interface TokenPayload {
  userId: string
}

export interface ITokenService {
  /**
   * Generate an access token for a user
   * @param userId - The user's unique identifier
   * @returns The signed access token
   */
  generateAccessToken(userId: string): string

  /**
   * Generate a refresh token for a user
   * @param userId - The user's unique identifier
   * @returns The signed refresh token
   */
  generateRefreshToken(userId: string): string

  /**
   * Verify an access token and extract the payload
   * @param token - The token to verify
   * @returns The token payload or null if invalid
   */
  verifyAccessToken(token: string): TokenPayload | null

  /**
   * Verify a refresh token and extract the payload
   * @param token - The token to verify
   * @returns The token payload or null if invalid
   */
  verifyRefreshToken(token: string): TokenPayload | null
}
