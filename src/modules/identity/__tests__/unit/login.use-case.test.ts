/**
 * Login Use Case Tests - TDD
 *
 * Tests for the login use case following TDD principles.
 * These tests define the expected behavior before implementation.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { LoginUseCase } from '../../application/use-cases/login.use-case'
import type { IUserRepository } from '../../domain/repositories/user.repository.interface'
import type { IPasswordService } from '../../domain/services/password.service'
import type { ITokenService } from '../../domain/services/token.service'
import type { UserWithCredentials } from '../../domain/entities/user.entity'

describe('LoginUseCase', () => {
  let loginUseCase: LoginUseCase
  let mockUserRepository: IUserRepository
  let mockPasswordService: IPasswordService
  let mockTokenService: ITokenService

  const mockUser: UserWithCredentials = {
    id: 'user-123',
    email: 'test@example.com',
    teamName: 'Test Team',
    passwordHash: 'hashed-password',
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
    }

    mockPasswordService = {
      hash: vi.fn(),
      verify: vi.fn(),
    }

    mockTokenService = {
      generateAccessToken: vi.fn().mockReturnValue('access-token'),
      generateRefreshToken: vi.fn().mockReturnValue('refresh-token'),
      verifyAccessToken: vi.fn(),
      verifyRefreshToken: vi.fn(),
    }

    loginUseCase = new LoginUseCase(
      mockUserRepository,
      mockPasswordService,
      mockTokenService
    )
  })

  describe('execute', () => {
    it('should return failure if user not found', async () => {
      // Arrange
      vi.mocked(mockUserRepository.findByEmail).mockResolvedValue(null)

      // Act
      const result = await loginUseCase.execute({
        email: 'nonexistent@example.com',
        password: 'password123',
      })

      // Assert
      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toBe('Credenziali non valide')
      }
      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith('nonexistent@example.com')
    })

    it('should return failure if password is incorrect', async () => {
      // Arrange
      vi.mocked(mockUserRepository.findByEmail).mockResolvedValue(mockUser)
      vi.mocked(mockPasswordService.verify).mockResolvedValue(false)

      // Act
      const result = await loginUseCase.execute({
        email: 'test@example.com',
        password: 'wrong-password',
      })

      // Assert
      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toBe('Credenziali non valide')
      }
      expect(mockPasswordService.verify).toHaveBeenCalledWith('wrong-password', 'hashed-password')
    })

    it('should return success with tokens on valid credentials', async () => {
      // Arrange
      vi.mocked(mockUserRepository.findByEmail).mockResolvedValue(mockUser)
      vi.mocked(mockPasswordService.verify).mockResolvedValue(true)

      // Act
      const result = await loginUseCase.execute({
        email: 'test@example.com',
        password: 'correct-password',
      })

      // Assert
      expect(result.isSuccess).toBe(true)
      if (result.isSuccess) {
        expect(result.value.user).toEqual({
          id: mockUser.id,
          email: mockUser.email,
          teamName: mockUser.teamName,
          createdAt: mockUser.createdAt,
          updatedAt: mockUser.updatedAt,
          isSuperAdmin: mockUser.isSuperAdmin,
        })
        expect(result.value.accessToken).toBe('access-token')
        expect(result.value.refreshToken).toBe('refresh-token')
      }
      expect(mockTokenService.generateAccessToken).toHaveBeenCalledWith('user-123')
      expect(mockTokenService.generateRefreshToken).toHaveBeenCalledWith('user-123')
    })

    it('should update last login timestamp on successful login', async () => {
      // Arrange
      vi.mocked(mockUserRepository.findByEmail).mockResolvedValue(mockUser)
      vi.mocked(mockPasswordService.verify).mockResolvedValue(true)

      // Act
      await loginUseCase.execute({
        email: 'test@example.com',
        password: 'correct-password',
      })

      // Assert
      expect(mockUserRepository.updateLastLogin).toHaveBeenCalledWith('user-123')
    })

    it('should not expose password hash in the returned user', async () => {
      // Arrange
      vi.mocked(mockUserRepository.findByEmail).mockResolvedValue(mockUser)
      vi.mocked(mockPasswordService.verify).mockResolvedValue(true)

      // Act
      const result = await loginUseCase.execute({
        email: 'test@example.com',
        password: 'correct-password',
      })

      // Assert
      expect(result.isSuccess).toBe(true)
      if (result.isSuccess) {
        expect('passwordHash' in result.value.user).toBe(false)
      }
    })
  })
})
