import jwt from 'jsonwebtoken'
import crypto from 'crypto'

const ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_SECRET || 'access-secret-change-in-production'
const REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET || 'refresh-secret-change-in-production'

const ACCESS_TOKEN_EXPIRY = '15m'
const REFRESH_TOKEN_EXPIRY = '7d'

export interface TokenPayload {
  userId: string
  email: string
  username: string
}

export interface RefreshTokenPayload extends TokenPayload {
  jti: string      // Unique token ID
  familyId: string // Token family for reuse detection
}

export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, ACCESS_TOKEN_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY })
}

export function generateRefreshToken(payload: TokenPayload, familyId?: string): string {
  const jti = crypto.randomUUID()
  const family = familyId || crypto.randomUUID()
  return jwt.sign({ ...payload, jti, familyId: family }, REFRESH_TOKEN_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY })
}

export function verifyAccessToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, ACCESS_TOKEN_SECRET) as TokenPayload
  } catch {
    return null
  }
}

export function verifyRefreshToken(token: string): RefreshTokenPayload | null {
  try {
    return jwt.verify(token, REFRESH_TOKEN_SECRET) as RefreshTokenPayload
  } catch {
    return null
  }
}

export function generateTokens(payload: TokenPayload, familyId?: string): { accessToken: string; refreshToken: string } {
  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload, familyId),
  }
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}
