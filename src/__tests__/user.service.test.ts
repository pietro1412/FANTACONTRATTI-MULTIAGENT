/**
 * user.service.test.ts - Unit Tests for User Service
 *
 * Tests for getProfile, updateProfile, updateProfilePhoto,
 * removeProfilePhoto, and changePassword.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Hoist mock before imports
const { mockPrisma, MockPrismaClient } = vi.hoisted(() => {
  const mock = {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
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

// Mock Prisma
vi.mock('@prisma/client', () => ({
  PrismaClient: MockPrismaClient,
}))

// Mock password utils
vi.mock('../utils/password', () => ({
  hashPassword: mockHashPassword,
  verifyPassword: mockVerifyPassword,
}))

// Import after mocking
import * as userService from '../services/user.service'

describe('User Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getProfile', () => {
    it('returns error when user is not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)

      const result = await userService.getProfile('nonexistent')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Utente non trovato')
    })

    it('returns user profile with league memberships', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'user@test.it',
        username: 'testuser',
        emailVerified: true,
        profilePhoto: null,
        createdAt: new Date('2025-01-01'),
        leagueMemberships: [
          {
            id: 'member-1',
            role: 'MANAGER',
            teamName: 'FC Test',
            status: 'ACTIVE',
            currentBudget: 450,
            league: {
              id: 'league-1',
              name: 'Lega Test',
              status: 'ACTIVE',
            },
          },
        ],
      }
      mockPrisma.user.findUnique.mockResolvedValue(mockUser)

      const result = await userService.getProfile('user-1')

      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockUser)
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
        })
      )
    })
  })

  describe('updateProfile', () => {
    it('returns error when new email already exists', async () => {
      mockPrisma.user.findFirst.mockResolvedValueOnce({ id: 'other-user' })

      const result = await userService.updateProfile('user-1', {
        email: 'taken@test.it',
      })

      expect(result.success).toBe(false)
      expect(result.message).toBe('Email già in uso')
    })

    it('returns error when new username already exists', async () => {
      // email check passes (not provided or not found), username check finds existing
      mockPrisma.user.findFirst.mockResolvedValueOnce({ id: 'other-user' })

      const result = await userService.updateProfile('user-1', {
        username: 'takenuser',
      })

      expect(result.success).toBe(false)
      expect(result.message).toBe('Username già in uso')
    })

    it('returns error when no data to update', async () => {
      const result = await userService.updateProfile('user-1', {})

      expect(result.success).toBe(false)
      expect(result.message).toBe('Nessun dato da aggiornare')
    })

    it('updates email successfully', async () => {
      mockPrisma.user.findFirst.mockResolvedValueOnce(null) // email not taken
      mockPrisma.user.update.mockResolvedValue({
        id: 'user-1',
        email: 'new@test.it',
        username: 'testuser',
      })

      const result = await userService.updateProfile('user-1', {
        email: 'new@test.it',
      })

      expect(result.success).toBe(true)
      expect(result.message).toBe('Profilo aggiornato')
      expect(result.data).toBeDefined()
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: { email: 'new@test.it' },
        })
      )
    })

    it('updates username successfully', async () => {
      mockPrisma.user.findFirst.mockResolvedValueOnce(null) // username not taken
      mockPrisma.user.update.mockResolvedValue({
        id: 'user-1',
        email: 'user@test.it',
        username: 'newusername',
      })

      const result = await userService.updateProfile('user-1', {
        username: 'newusername',
      })

      expect(result.success).toBe(true)
      expect(result.message).toBe('Profilo aggiornato')
    })

    it('updates both email and username successfully', async () => {
      mockPrisma.user.findFirst
        .mockResolvedValueOnce(null) // email not taken
        .mockResolvedValueOnce(null) // username not taken
      mockPrisma.user.update.mockResolvedValue({
        id: 'user-1',
        email: 'new@test.it',
        username: 'newusername',
      })

      const result = await userService.updateProfile('user-1', {
        email: 'new@test.it',
        username: 'newusername',
      })

      expect(result.success).toBe(true)
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { email: 'new@test.it', username: 'newusername' },
        })
      )
    })
  })

  describe('updateProfilePhoto', () => {
    it('returns error when no photo data provided', async () => {
      const result = await userService.updateProfilePhoto('user-1', '')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Nessuna foto fornita')
    })

    it('returns error when photo format is invalid', async () => {
      const result = await userService.updateProfilePhoto('user-1', 'not-a-valid-image')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Formato immagine non valido')
    })

    it('returns error when photo is too large', async () => {
      // Create a string > 700000 chars
      const largePhoto = 'data:image/' + 'a'.repeat(700001)

      const result = await userService.updateProfilePhoto('user-1', largePhoto)

      expect(result.success).toBe(false)
      expect(result.message).toBe('Immagine troppo grande (max 500KB)')
    })

    it('updates profile photo successfully', async () => {
      const validPhoto = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=='
      mockPrisma.user.update.mockResolvedValue({
        id: 'user-1',
        email: 'user@test.it',
        username: 'testuser',
        profilePhoto: validPhoto,
      })

      const result = await userService.updateProfilePhoto('user-1', validPhoto)

      expect(result.success).toBe(true)
      expect(result.message).toBe('Foto profilo aggiornata')
      expect(result.data).toBeDefined()
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { profilePhoto: validPhoto },
        select: {
          id: true,
          email: true,
          username: true,
          profilePhoto: true,
        },
      })
    })
  })

  describe('removeProfilePhoto', () => {
    it('removes profile photo successfully', async () => {
      mockPrisma.user.update.mockResolvedValue({})

      const result = await userService.removeProfilePhoto('user-1')

      expect(result.success).toBe(true)
      expect(result.message).toBe('Foto profilo rimossa')
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { profilePhoto: null },
      })
    })
  })

  describe('changePassword', () => {
    it('returns error when user is not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)

      const result = await userService.changePassword('nonexistent', {
        currentPassword: 'OldPassword1!',
        newPassword: 'NewPassword1!',
      })

      expect(result.success).toBe(false)
      expect(result.message).toBe('Utente non trovato')
    })

    it('returns error when current password is incorrect', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        passwordHash: 'old-hash',
      })
      mockVerifyPassword.mockResolvedValue(false)

      const result = await userService.changePassword('user-1', {
        currentPassword: 'WrongPassword1!',
        newPassword: 'NewPassword1!',
      })

      expect(result.success).toBe(false)
      expect(result.message).toBe('Password attuale non corretta')
    })

    it('changes password successfully', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        passwordHash: 'old-hash',
      })
      mockVerifyPassword.mockResolvedValue(true)
      mockHashPassword.mockResolvedValue('new-hashed-password')
      mockPrisma.user.update.mockResolvedValue({})

      const result = await userService.changePassword('user-1', {
        currentPassword: 'OldPassword1!',
        newPassword: 'NewPassword1!',
      })

      expect(result.success).toBe(true)
      expect(result.message).toBe('Password aggiornata')
      expect(mockVerifyPassword).toHaveBeenCalledWith('OldPassword1!', 'old-hash')
      expect(mockHashPassword).toHaveBeenCalledWith('NewPassword1!')
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { passwordHash: 'new-hashed-password' },
      })
    })
  })
})
