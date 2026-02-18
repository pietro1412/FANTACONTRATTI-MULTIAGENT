/**
 * auth.service.test.ts - Unit Tests for Auth Service
 *
 * Tests for registerUser, loginUser, and getUserById.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Hoist mock before imports
const { mockPrisma, MockPrismaClient } = vi.hoisted(() => {
  const mock = {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  }

  const MockClass = function (this: typeof mock) {
    Object.assign(this, mock)
  } as unknown as new () => typeof mock

  return { mockPrisma: mock, MockPrismaClient: MockClass }
})

const { mockHashPassword, mockVerifyPassword } = vi.hoisted(() => ({
  mockHashPassword: vi.fn(),
  mockVerifyPassword: vi.fn(),
}))

const { mockGenerateTokens } = vi.hoisted(() => ({
  mockGenerateTokens: vi.fn(),
}))

// Mock Prisma
vi.mock('@prisma/client', () => ({
  PrismaClient: MockPrismaClient,
}))

// Mock password utils
vi.mock('../utils/password', () => ({
  hashPassword: mockHashPassword,
  verifyPassword: mockVerifyPassword,
}))

// Mock JWT utils
vi.mock('../utils/jwt', () => ({
  generateTokens: mockGenerateTokens,
}))

// Import after mocking
import * as authService from '../services/auth.service'

describe('Auth Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('registerUser', () => {
    it('returns error when email already exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'existing-user' })

      const result = await authService.registerUser({
        email: 'existing@test.it',
        username: 'newuser',
        password: 'Password1!',
      })

      expect(result.success).toBe(false)
      expect(result.message).toBe('Email già registrata')
    })

    it('returns error when username already exists', async () => {
      // First call (email check) returns null, second call (username check) returns a user
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'existing-user' })

      const result = await authService.registerUser({
        email: 'new@test.it',
        username: 'existinguser',
        password: 'Password1!',
      })

      expect(result.success).toBe(false)
      expect(result.message).toBe('Username già in uso')
    })

    it('creates user successfully with hashed password', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(null) // email check
        .mockResolvedValueOnce(null) // username check
      mockHashPassword.mockResolvedValue('hashed-password-123')
      mockPrisma.user.create.mockResolvedValue({
        id: 'new-user-id',
        email: 'new@test.it',
        username: 'newuser',
      })

      const result = await authService.registerUser({
        email: 'new@test.it',
        username: 'newuser',
        password: 'Password1!',
      })

      expect(result.success).toBe(true)
      expect(result.message).toBe('Registrazione completata')
      expect(result.user).toEqual({
        id: 'new-user-id',
        email: 'new@test.it',
        username: 'newuser',
      })
      expect(mockHashPassword).toHaveBeenCalledWith('Password1!')
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          email: 'new@test.it',
          username: 'newuser',
          passwordHash: 'hashed-password-123',
        },
        select: {
          id: true,
          email: true,
          username: true,
        },
      })
    })
  })

  describe('loginUser', () => {
    it('returns error when user is not found', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null)

      const result = await authService.loginUser({
        emailOrUsername: 'nonexistent@test.it',
        password: 'Password1!',
      })

      expect(result.success).toBe(false)
      expect(result.message).toBe('Credenziali non valide')
    })

    it('returns error when account is locked', async () => {
      const futureDate = new Date(Date.now() + 30 * 60 * 1000) // 30 min in the future
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        email: 'locked@test.it',
        username: 'lockeduser',
        passwordHash: 'hash',
        lockedUntil: futureDate,
        failedLoginAttempts: 5,
      })

      const result = await authService.loginUser({
        emailOrUsername: 'locked@test.it',
        password: 'Password1!',
      })

      expect(result.success).toBe(false)
      expect(result.message).toMatch(/Account bloccato/)
    })

    it('returns error and increments attempts on wrong password', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        email: 'user@test.it',
        username: 'testuser',
        passwordHash: 'hash',
        lockedUntil: null,
        failedLoginAttempts: 0,
      })
      mockVerifyPassword.mockResolvedValue(false)
      mockPrisma.user.update.mockResolvedValue({})

      const result = await authService.loginUser({
        emailOrUsername: 'user@test.it',
        password: 'WrongPassword1!',
      })

      expect(result.success).toBe(false)
      expect(result.message).toBe('Credenziali non valide')
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({
            failedLoginAttempts: 1,
          }),
        })
      )
    })

    it('locks account after 5 failed attempts (15 min)', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        email: 'user@test.it',
        username: 'testuser',
        passwordHash: 'hash',
        lockedUntil: null,
        failedLoginAttempts: 4, // Will become 5
      })
      mockVerifyPassword.mockResolvedValue(false)
      mockPrisma.user.update.mockResolvedValue({})

      const result = await authService.loginUser({
        emailOrUsername: 'user@test.it',
        password: 'WrongPassword1!',
      })

      expect(result.success).toBe(false)
      expect(result.message).toMatch(/Troppi tentativi falliti/)
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            failedLoginAttempts: 5,
            lockedUntil: expect.any(Date),
          }),
        })
      )
    })

    it('locks account after 10 failed attempts (1 hour)', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        email: 'user@test.it',
        username: 'testuser',
        passwordHash: 'hash',
        lockedUntil: null,
        failedLoginAttempts: 9, // Will become 10
      })
      mockVerifyPassword.mockResolvedValue(false)
      mockPrisma.user.update.mockResolvedValue({})

      const result = await authService.loginUser({
        emailOrUsername: 'user@test.it',
        password: 'WrongPassword1!',
      })

      expect(result.success).toBe(false)
      expect(result.message).toMatch(/Troppi tentativi falliti/)
    })

    it('locks account after 20 failed attempts (24 hours)', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        email: 'user@test.it',
        username: 'testuser',
        passwordHash: 'hash',
        lockedUntil: null,
        failedLoginAttempts: 19, // Will become 20
      })
      mockVerifyPassword.mockResolvedValue(false)
      mockPrisma.user.update.mockResolvedValue({})

      const result = await authService.loginUser({
        emailOrUsername: 'user@test.it',
        password: 'WrongPassword1!',
      })

      expect(result.success).toBe(false)
      expect(result.message).toMatch(/Troppi tentativi falliti/)
    })

    it('resets failed attempts on successful login', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        email: 'user@test.it',
        username: 'testuser',
        passwordHash: 'correct-hash',
        lockedUntil: null,
        failedLoginAttempts: 3,
      })
      mockVerifyPassword.mockResolvedValue(true)
      mockPrisma.user.update.mockResolvedValue({})
      mockGenerateTokens.mockReturnValue({
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-123',
      })

      const result = await authService.loginUser({
        emailOrUsername: 'user@test.it',
        password: 'CorrectPassword1!',
      })

      expect(result.success).toBe(true)
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { failedLoginAttempts: 0, lockedUntil: null, lastFailedLogin: null },
      })
    })

    it('returns tokens on successful login', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        email: 'user@test.it',
        username: 'testuser',
        passwordHash: 'correct-hash',
        lockedUntil: null,
        failedLoginAttempts: 0,
      })
      mockVerifyPassword.mockResolvedValue(true)
      mockGenerateTokens.mockReturnValue({
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-123',
      })

      const result = await authService.loginUser({
        emailOrUsername: 'testuser',
        password: 'CorrectPassword1!',
      })

      expect(result.success).toBe(true)
      expect(result.user).toEqual({
        id: 'user-1',
        email: 'user@test.it',
        username: 'testuser',
      })
      expect(result.tokens).toEqual({
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-123',
      })
      expect(mockGenerateTokens).toHaveBeenCalledWith({
        userId: 'user-1',
        email: 'user@test.it',
        username: 'testuser',
      })
    })

    it('does not reset attempts when failedLoginAttempts is 0', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        email: 'user@test.it',
        username: 'testuser',
        passwordHash: 'correct-hash',
        lockedUntil: null,
        failedLoginAttempts: 0,
      })
      mockVerifyPassword.mockResolvedValue(true)
      mockGenerateTokens.mockReturnValue({
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-123',
      })

      const result = await authService.loginUser({
        emailOrUsername: 'user@test.it',
        password: 'CorrectPassword1!',
      })

      expect(result.success).toBe(true)
      // update should NOT be called because failedLoginAttempts is 0
      expect(mockPrisma.user.update).not.toHaveBeenCalled()
    })

    it('allows login when lock has expired', async () => {
      const pastDate = new Date(Date.now() - 60 * 1000) // 1 minute in the past
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        email: 'user@test.it',
        username: 'testuser',
        passwordHash: 'correct-hash',
        lockedUntil: pastDate,
        failedLoginAttempts: 5,
      })
      mockVerifyPassword.mockResolvedValue(true)
      mockPrisma.user.update.mockResolvedValue({})
      mockGenerateTokens.mockReturnValue({
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-123',
      })

      const result = await authService.loginUser({
        emailOrUsername: 'user@test.it',
        password: 'CorrectPassword1!',
      })

      expect(result.success).toBe(true)
      expect(result.tokens).toBeDefined()
    })
  })

  describe('getUserById', () => {
    it('returns user when found', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'user@test.it',
        username: 'testuser',
        emailVerified: true,
        createdAt: new Date('2025-01-01'),
      }
      mockPrisma.user.findUnique.mockResolvedValue(mockUser)

      const result = await authService.getUserById('user-1')

      expect(result).toEqual(mockUser)
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: {
          id: true,
          email: true,
          username: true,
          emailVerified: true,
          createdAt: true,
        },
      })
    })

    it('returns null when user is not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)

      const result = await authService.getUserById('nonexistent')

      expect(result).toBeNull()
    })
  })
})
