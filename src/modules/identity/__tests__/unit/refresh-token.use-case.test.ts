/**
 * Refresh Token Use Case Tests - TDD
 *
 * Tests for the refresh token use case following TDD principles.
 * These tests define the expected behavior before implementation.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { RefreshTokenUseCase } from '../../application/use-cases/refresh-token.use-case'
import type { IUserRepository } from '../../domain/repositories/user.repository.interface'
import type { ITokenService } from '../../domain/services/token.service'
import type { User } from '../../domain/entities/user.entity'

describe('RefreshTokenUseCase', () => {
  let refreshTokenUseCase: RefreshTokenUseCase
  let mockUserRepository: IUserRepository
  let mockTokenService: ITokenService

  const mockUser: User = {
    id: 'user-123',
    email: 'test@example.com',
    teamName: 'Test Team',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    isSuperAdmin: false,
  }

  beforeEach(() => {
    // Create mock implementations
    mockUserRepository = {
      findById: vi.fn(),
      findByEmail: vi.fn(),
      create: vi.fn(),
      updateLastLogin: vi.fn(),
      setPasswordResetToken: vi.fn(),
      findByPasswordResetToken: vi.fn(),
      clearPasswordResetToken: vi.fn(),
      updatePassword: vi.fn(),
    }

    mockTokenService = {
      generateAccessToken: vi.fn().mockReturnValue('new-access-token'),
      generateRefreshToken: vi.fn().mockReturnValue('new-refresh-token'),
      verifyAccessToken: vi.fn(),
      verifyRefreshToken: vi.fn(),
    }

    refreshTokenUseCase = new RefreshTokenUseCase(
      mockUserRepository,
      mockTokenService
    )
  })

  describe('execute', () => {
    it('should return failure if refresh token is invalid', async () => {
      // Arrange
      vi.mocked(mockTokenService.verifyRefreshToken).mockReturnValue(null)

      // Act
      const result = await refreshTokenUseCase.execute({
        refreshToken: 'invalid-token',
      })

      // Assert
      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toBe('Refresh token non valido o scaduto')
      }
      expect(mockTokenService.verifyRefreshToken).toHaveBeenCalledWith('invalid-token')
    })

    it('should return failure if user not found', async () => {
      // Arrange
      vi.mocked(mockTokenService.verifyRefreshToken).mockReturnValue({ userId: 'user-123' })
      vi.mocked(mockUserRepository.findById).mockResolvedValue(null)

      // Act
      const result = await refreshTokenUseCase.execute({
        refreshToken: 'valid-token',
      })

      // Assert
      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toBe('Utente non trovato')
      }
      expect(mockUserRepository.findById).toHaveBeenCalledWith('user-123')
    })

    it('should return new access token on valid refresh token', async () => {
      // Arrange
      vi.mocked(mockTokenService.verifyRefreshToken).mockReturnValue({ userId: 'user-123' })
      vi.mocked(mockUserRepository.findById).mockResolvedValue(mockUser)

      // Act
      const result = await refreshTokenUseCase.execute({
        refreshToken: 'valid-token',
      })

      // Assert
      expect(result.isSuccess).toBe(true)
      if (result.isSuccess) {
        expect(result.value.accessToken).toBe('new-access-token')
        expect(result.value.refreshToken).toBe('new-refresh-token')
      }
    })

    it('should generate new tokens with the user ID from the refresh token', async () => {
      // Arrange
      vi.mocked(mockTokenService.verifyRefreshToken).mockReturnValue({ userId: 'user-123' })
      vi.mocked(mockUserRepository.findById).mockResolvedValue(mockUser)

      // Act
      await refreshTokenUseCase.execute({
        refreshToken: 'valid-token',
      })

      // Assert
      expect(mockTokenService.generateAccessToken).toHaveBeenCalledWith('user-123')
      expect(mockTokenService.generateRefreshToken).toHaveBeenCalledWith('user-123')
    })

    it('should handle expired refresh token', async () => {
      // Arrange - expired tokens return null from verify
      vi.mocked(mockTokenService.verifyRefreshToken).mockReturnValue(null)

      // Act
      const result = await refreshTokenUseCase.execute({
        refreshToken: 'expired-token',
      })

      // Assert
      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toBe('Refresh token non valido o scaduto')
      }
    })

    it('should handle malformed refresh token', async () => {
      // Arrange - malformed tokens return null from verify
      vi.mocked(mockTokenService.verifyRefreshToken).mockReturnValue(null)

      // Act
      const result = await refreshTokenUseCase.execute({
        refreshToken: 'malformed-token-xyz',
      })

      // Assert
      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toBe('Refresh token non valido o scaduto')
      }
    })
  })
})
