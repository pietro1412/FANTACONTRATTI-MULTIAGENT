/**
 * JWT Token Service Tests
 *
 * Tests for the JwtTokenService implementation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { JwtTokenService } from '../services/jwt-token.service'

describe('JwtTokenService', () => {
  let service: JwtTokenService

  beforeEach(() => {
    service = new JwtTokenService({
      accessTokenSecret: 'test-access-secret',
      refreshTokenSecret: 'test-refresh-secret',
      accessTokenExpiry: '15m',
      refreshTokenExpiry: '7d',
    })
  })

  describe('generateAccessToken', () => {
    it('should generate a valid access token', () => {
      const token = service.generateAccessToken('user-123')

      expect(token).toBeDefined()
      expect(typeof token).toBe('string')
      expect(token.split('.')).toHaveLength(3) // JWT has 3 parts
    })

    it('should generate different tokens for different users', () => {
      const token1 = service.generateAccessToken('user-1')
      const token2 = service.generateAccessToken('user-2')

      expect(token1).not.toBe(token2)
    })
  })

  describe('generateRefreshToken', () => {
    it('should generate a valid refresh token', () => {
      const token = service.generateRefreshToken('user-123')

      expect(token).toBeDefined()
      expect(typeof token).toBe('string')
      expect(token.split('.')).toHaveLength(3)
    })
  })

  describe('verifyAccessToken', () => {
    it('should verify a valid access token', () => {
      const token = service.generateAccessToken('user-123')

      const payload = service.verifyAccessToken(token)

      expect(payload).not.toBeNull()
      expect(payload?.userId).toBe('user-123')
    })

    it('should return null for invalid token', () => {
      const payload = service.verifyAccessToken('invalid-token')

      expect(payload).toBeNull()
    })

    it('should return null for refresh token verified as access token', () => {
      const refreshToken = service.generateRefreshToken('user-123')

      const payload = service.verifyAccessToken(refreshToken)

      expect(payload).toBeNull()
    })

    it('should return null for expired token', () => {
      const expiredService = new JwtTokenService({
        accessTokenSecret: 'test-access-secret',
        refreshTokenSecret: 'test-refresh-secret',
        accessTokenExpiry: '-1s', // Already expired
        refreshTokenExpiry: '7d',
      })
      const token = expiredService.generateAccessToken('user-123')

      const payload = expiredService.verifyAccessToken(token)

      expect(payload).toBeNull()
    })
  })

  describe('verifyRefreshToken', () => {
    it('should verify a valid refresh token', () => {
      const token = service.generateRefreshToken('user-123')

      const payload = service.verifyRefreshToken(token)

      expect(payload).not.toBeNull()
      expect(payload?.userId).toBe('user-123')
    })

    it('should return null for invalid token', () => {
      const payload = service.verifyRefreshToken('invalid-token')

      expect(payload).toBeNull()
    })

    it('should return null for access token verified as refresh token', () => {
      const accessToken = service.generateAccessToken('user-123')

      const payload = service.verifyRefreshToken(accessToken)

      expect(payload).toBeNull()
    })
  })

  describe('default configuration', () => {
    it('should use environment defaults when not provided', () => {
      const defaultService = new JwtTokenService()
      const token = defaultService.generateAccessToken('user-123')

      expect(token).toBeDefined()
      expect(token.split('.')).toHaveLength(3)
    })
  })
})
