/**
 * JWT Token Service - Infrastructure Layer
 *
 * Implements ITokenService interface using jsonwebtoken.
 * Provides secure JWT token generation and verification.
 */

import jwt from 'jsonwebtoken'
import type { StringValue } from 'ms'
import type { ITokenService, TokenPayload } from '../../domain/services/token.service'

/**
 * Default token expiration times
 */
const ACCESS_TOKEN_EXPIRY = '15m'  // 15 minutes
const REFRESH_TOKEN_EXPIRY = '7d'  // 7 days

/**
 * Environment variables for JWT secrets
 * Falls back to development secrets if not set
 */
const getAccessTokenSecret = (): string => {
  return process.env.JWT_ACCESS_SECRET || 'dev-access-secret-change-in-production'
}

const getRefreshTokenSecret = (): string => {
  return process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-in-production'
}

export class JwtTokenService implements ITokenService {
  private readonly accessTokenSecret: string
  private readonly refreshTokenSecret: string
  private readonly accessTokenExpiry: string
  private readonly refreshTokenExpiry: string

  constructor(options?: {
    accessTokenSecret?: string
    refreshTokenSecret?: string
    accessTokenExpiry?: string
    refreshTokenExpiry?: string
  }) {
    this.accessTokenSecret = options?.accessTokenSecret || getAccessTokenSecret()
    this.refreshTokenSecret = options?.refreshTokenSecret || getRefreshTokenSecret()
    this.accessTokenExpiry = options?.accessTokenExpiry || ACCESS_TOKEN_EXPIRY
    this.refreshTokenExpiry = options?.refreshTokenExpiry || REFRESH_TOKEN_EXPIRY
  }

  /**
   * Generate an access token for a user
   * @param userId - The user's unique identifier
   * @returns The signed access token
   */
  generateAccessToken(userId: string): string {
    const payload: TokenPayload = { userId }
    return jwt.sign(payload as object, this.accessTokenSecret, {
      expiresIn: this.accessTokenExpiry as StringValue
    })
  }

  /**
   * Generate a refresh token for a user
   * @param userId - The user's unique identifier
   * @returns The signed refresh token
   */
  generateRefreshToken(userId: string): string {
    const payload: TokenPayload = { userId }
    return jwt.sign(payload as object, this.refreshTokenSecret, {
      expiresIn: this.refreshTokenExpiry as StringValue
    })
  }

  /**
   * Verify an access token and extract the payload
   * @param token - The token to verify
   * @returns The token payload or null if invalid
   */
  verifyAccessToken(token: string): TokenPayload | null {
    try {
      const decoded = jwt.verify(token, this.accessTokenSecret) as TokenPayload
      return decoded
    } catch {
      return null
    }
  }

  /**
   * Verify a refresh token and extract the payload
   * @param token - The token to verify
   * @returns The token payload or null if invalid
   */
  verifyRefreshToken(token: string): TokenPayload | null {
    try {
      const decoded = jwt.verify(token, this.refreshTokenSecret) as TokenPayload
      return decoded
    } catch {
      return null
    }
  }
}
