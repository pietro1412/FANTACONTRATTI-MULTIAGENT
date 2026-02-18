/**
 * User Prisma Repository Tests
 *
 * Tests for the UserPrismaRepository implementation using mocked Prisma client.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { UserPrismaRepository } from '../repositories/user.prisma-repository'

// Mock the Prisma client
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'

describe('UserPrismaRepository', () => {
  let repository: UserPrismaRepository

  const mockPrismaUser = {
    id: 'user-123',
    email: 'test@example.com',
    username: 'testuser',
    passwordHash: 'hashed-password-123',
    passwordResetToken: null,
    passwordResetExpires: null,
    emailVerified: false,
    isSuperAdmin: false,
    profilePhoto: null,
    failedLoginAttempts: 0,
    lockedUntil: null,
    lastFailedLogin: null,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
  }

  beforeEach(() => {
    repository = new UserPrismaRepository()
    vi.clearAllMocks()
  })

  describe('findById', () => {
    it('should return user when found', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockPrismaUser)

      const result = await repository.findById('user-123')

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' }
      })
      expect(result).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        teamName: 'testuser', // Falls back to username
        createdAt: mockPrismaUser.createdAt,
        updatedAt: mockPrismaUser.updatedAt,
        isSuperAdmin: false,
      })
    })

    it('should return null when user not found', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

      const result = await repository.findById('nonexistent-id')

      expect(result).toBeNull()
    })
  })

  describe('findByEmail', () => {
    it('should return user with credentials when found', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockPrismaUser)

      const result = await repository.findByEmail('test@example.com')

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' }
      })
      expect(result).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        teamName: 'testuser',
        passwordHash: 'hashed-password-123',
        createdAt: mockPrismaUser.createdAt,
        updatedAt: mockPrismaUser.updatedAt,
        isSuperAdmin: false,
      })
    })

    it('should return null when user not found', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

      const result = await repository.findByEmail('nonexistent@example.com')

      expect(result).toBeNull()
    })
  })

  describe('create', () => {
    it('should create a new user', async () => {
      vi.mocked(prisma.user.create).mockResolvedValue(mockPrismaUser)

      const result = await repository.create({
        email: 'test@example.com',
        teamName: 'My Team',
        passwordHash: 'hashed-password-123',
      })

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: 'test@example.com',
          username: 'test@example.com', // Uses email as username
          passwordHash: 'hashed-password-123',
        }
      })
      expect(result).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        teamName: 'My Team', // Uses provided teamName
        createdAt: mockPrismaUser.createdAt,
        updatedAt: mockPrismaUser.updatedAt,
        isSuperAdmin: false,
      })
    })
  })

  describe('updateLastLogin', () => {
    it('should update the updatedAt timestamp', async () => {
      vi.mocked(prisma.user.update).mockResolvedValue(mockPrismaUser)

      await repository.updateLastLogin('user-123')

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { updatedAt: expect.any(Date) }
      })
    })
  })
})
