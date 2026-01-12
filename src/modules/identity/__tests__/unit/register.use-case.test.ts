/**
 * Register Use Case Tests - TDD
 *
 * Tests for the register use case following TDD principles.
 * These tests define the expected behavior before implementation.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { RegisterUseCase } from '../../application/use-cases/register.use-case'
import type { IUserRepository } from '../../domain/repositories/user.repository.interface'
import type { IPasswordService } from '../../domain/services/password.service'
import type { ITokenService } from '../../domain/services/token.service'
import type { User, UserWithCredentials } from '../../domain/entities/user.entity'

describe('RegisterUseCase', () => {
  let registerUseCase: RegisterUseCase
  let mockUserRepository: IUserRepository
  let mockPasswordService: IPasswordService
  let mockTokenService: ITokenService

  const existingUser: UserWithCredentials = {
    id: 'existing-user-123',
    email: 'existing@example.com',
    teamName: 'Existing Team',
    passwordHash: 'hashed-password',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    isSuperAdmin: false,
  }

  const newUser: User = {
    id: 'new-user-456',
    email: 'new@example.com',
    teamName: 'New Team',
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15'),
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
      hash: vi.fn().mockResolvedValue('hashed-new-password'),
      verify: vi.fn(),
    }

    mockTokenService = {
      generateAccessToken: vi.fn().mockReturnValue('access-token'),
      generateRefreshToken: vi.fn().mockReturnValue('refresh-token'),
      verifyAccessToken: vi.fn(),
      verifyRefreshToken: vi.fn(),
    }

    registerUseCase = new RegisterUseCase(
      mockUserRepository,
      mockPasswordService,
      mockTokenService
    )
  })

  describe('execute', () => {
    it('should return failure if email already exists', async () => {
      // Arrange
      vi.mocked(mockUserRepository.findByEmail).mockResolvedValue(existingUser)

      // Act
      const result = await registerUseCase.execute({
        email: 'existing@example.com',
        password: 'password123',
        teamName: 'My Team',
      })

      // Assert
      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toBe('Email gia registrata')
      }
      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith('existing@example.com')
      expect(mockUserRepository.create).not.toHaveBeenCalled()
    })

    it('should return success with new user and tokens on valid registration', async () => {
      // Arrange
      vi.mocked(mockUserRepository.findByEmail).mockResolvedValue(null)
      vi.mocked(mockUserRepository.create).mockResolvedValue(newUser)

      // Act
      const result = await registerUseCase.execute({
        email: 'new@example.com',
        password: 'password123',
        teamName: 'New Team',
      })

      // Assert
      expect(result.isSuccess).toBe(true)
      if (result.isSuccess) {
        expect(result.value.user).toEqual(newUser)
        expect(result.value.accessToken).toBe('access-token')
        expect(result.value.refreshToken).toBe('refresh-token')
      }
    })

    it('should hash the password before creating the user', async () => {
      // Arrange
      vi.mocked(mockUserRepository.findByEmail).mockResolvedValue(null)
      vi.mocked(mockUserRepository.create).mockResolvedValue(newUser)

      // Act
      await registerUseCase.execute({
        email: 'new@example.com',
        password: 'plain-password',
        teamName: 'New Team',
      })

      // Assert
      expect(mockPasswordService.hash).toHaveBeenCalledWith('plain-password')
      expect(mockUserRepository.create).toHaveBeenCalledWith({
        email: 'new@example.com',
        teamName: 'New Team',
        passwordHash: 'hashed-new-password',
      })
    })

    it('should generate tokens with the new user ID', async () => {
      // Arrange
      vi.mocked(mockUserRepository.findByEmail).mockResolvedValue(null)
      vi.mocked(mockUserRepository.create).mockResolvedValue(newUser)

      // Act
      await registerUseCase.execute({
        email: 'new@example.com',
        password: 'password123',
        teamName: 'New Team',
      })

      // Assert
      expect(mockTokenService.generateAccessToken).toHaveBeenCalledWith('new-user-456')
      expect(mockTokenService.generateRefreshToken).toHaveBeenCalledWith('new-user-456')
    })

    it('should not expose password hash in the returned user', async () => {
      // Arrange
      vi.mocked(mockUserRepository.findByEmail).mockResolvedValue(null)
      vi.mocked(mockUserRepository.create).mockResolvedValue(newUser)

      // Act
      const result = await registerUseCase.execute({
        email: 'new@example.com',
        password: 'password123',
        teamName: 'New Team',
      })

      // Assert
      expect(result.isSuccess).toBe(true)
      if (result.isSuccess) {
        expect('passwordHash' in result.value.user).toBe(false)
      }
    })

    it('should normalize email to lowercase', async () => {
      // Arrange
      vi.mocked(mockUserRepository.findByEmail).mockResolvedValue(null)
      vi.mocked(mockUserRepository.create).mockResolvedValue(newUser)

      // Act
      await registerUseCase.execute({
        email: 'NEW@EXAMPLE.COM',
        password: 'password123',
        teamName: 'New Team',
      })

      // Assert
      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith('new@example.com')
      expect(mockUserRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'new@example.com',
        })
      )
    })
  })
})
