/**
 * GetLeagueDetailsUseCase Unit Tests (TDD)
 *
 * Following TDD methodology, these tests are written BEFORE the implementation.
 * Tests define the expected behavior of the GetLeagueDetailsUseCase.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GetLeagueDetailsUseCase } from '../../application/use-cases/get-league-details.use-case'
import type { ILeagueRepository } from '../../domain/repositories/league.repository.interface'
import type { League } from '../../domain/entities/league.entity'
import type { LeagueMemberWithUser } from '../../domain/entities/league-member.entity'

// Mock repository factory
const createMockRepository = (): ILeagueRepository => ({
  findById: vi.fn(),
  findByInviteCode: vi.fn(),
  findByUserId: vi.fn(),
  create: vi.fn(),
  addMember: vi.fn(),
  getMember: vi.fn(),
  getMembers: vi.fn(),
  getActiveMemberCount: vi.fn(),
  updateMemberBudget: vi.fn(),
  memberExists: vi.fn(),
})

// Mock league factory
const createMockLeague = (overrides: Partial<League> = {}): League => ({
  id: 'league-123',
  name: 'Test League',
  description: 'A test league',
  adminId: 'admin-user',
  maxMembers: 20,
  minMembers: 6,
  initialBudget: 500,
  maxPlayersPerRole: { P: 3, D: 8, C: 8, A: 6 },
  createdAt: new Date('2024-01-01'),
  inviteCode: 'invite-abc123',
  status: 'DRAFT',
  currentSeason: 1,
  ...overrides,
})

// Mock league member with user factory
const createMockMemberWithUser = (overrides: Partial<LeagueMemberWithUser> = {}): LeagueMemberWithUser => ({
  id: 'member-123',
  leagueId: 'league-123',
  userId: 'user-123',
  teamName: 'Test Team',
  budget: 500,
  role: 'MANAGER',
  status: 'ACTIVE',
  joinType: 'REQUEST',
  joinedAt: new Date('2024-01-01'),
  user: {
    id: 'user-123',
    username: 'testuser',
    email: 'test@example.com',
  },
  ...overrides,
})

describe('GetLeagueDetailsUseCase', () => {
  let useCase: GetLeagueDetailsUseCase
  let mockRepository: ILeagueRepository

  beforeEach(() => {
    mockRepository = createMockRepository()
    useCase = new GetLeagueDetailsUseCase(mockRepository)
    vi.clearAllMocks()
  })

  describe('execute', () => {
    it('should return league with members list', async () => {
      // Arrange
      const input = {
        leagueId: 'league-123',
        userId: 'user-123',
      }

      const mockLeague = createMockLeague()
      const mockMembers: LeagueMemberWithUser[] = [
        createMockMemberWithUser({
          id: 'member-1',
          userId: 'admin-user',
          role: 'ADMIN',
          user: { id: 'admin-user', username: 'admin', email: 'admin@test.com' },
        }),
        createMockMemberWithUser({
          id: 'member-2',
          userId: 'user-123',
          role: 'MANAGER',
          user: { id: 'user-123', username: 'user1', email: 'user1@test.com' },
        }),
        createMockMemberWithUser({
          id: 'member-3',
          userId: 'user-456',
          role: 'MANAGER',
          user: { id: 'user-456', username: 'user2', email: 'user2@test.com' },
        }),
      ]

      vi.mocked(mockRepository.findById).mockResolvedValue(mockLeague)
      vi.mocked(mockRepository.getMembers).mockResolvedValue(mockMembers)
      vi.mocked(mockRepository.getMember).mockResolvedValue(mockMembers[1]!)

      // Act
      const result = await useCase.execute(input)

      // Assert
      expect(result.isSuccess).toBe(true)
      if (result.isSuccess) {
        expect(result.value.league).toEqual(mockLeague)
        expect(result.value.members).toHaveLength(3)
        expect(result.value.members[0]!.user.username).toBe('admin')
      }
    })

    it('should return isAdmin flag as true when user is admin', async () => {
      // Arrange
      const adminUserId = 'admin-user'
      const input = {
        leagueId: 'league-123',
        userId: adminUserId,
      }

      const mockLeague = createMockLeague({ adminId: adminUserId })
      const adminMember = createMockMemberWithUser({
        userId: adminUserId,
        role: 'ADMIN',
      })

      vi.mocked(mockRepository.findById).mockResolvedValue(mockLeague)
      vi.mocked(mockRepository.getMembers).mockResolvedValue([adminMember])
      vi.mocked(mockRepository.getMember).mockResolvedValue(adminMember)

      // Act
      const result = await useCase.execute(input)

      // Assert
      expect(result.isSuccess).toBe(true)
      if (result.isSuccess) {
        expect(result.value.isAdmin).toBe(true)
      }
    })

    it('should return isAdmin flag as false when user is not admin', async () => {
      // Arrange
      const regularUserId = 'regular-user'
      const input = {
        leagueId: 'league-123',
        userId: regularUserId,
      }

      const mockLeague = createMockLeague({ adminId: 'admin-user' })
      const regularMember = createMockMemberWithUser({
        userId: regularUserId,
        role: 'MANAGER',
      })

      vi.mocked(mockRepository.findById).mockResolvedValue(mockLeague)
      vi.mocked(mockRepository.getMembers).mockResolvedValue([regularMember])
      vi.mocked(mockRepository.getMember).mockResolvedValue(regularMember)

      // Act
      const result = await useCase.execute(input)

      // Assert
      expect(result.isSuccess).toBe(true)
      if (result.isSuccess) {
        expect(result.value.isAdmin).toBe(false)
      }
    })

    it('should return failure if league not found', async () => {
      // Arrange
      const input = {
        leagueId: 'non-existent-league',
        userId: 'user-123',
      }

      vi.mocked(mockRepository.findById).mockResolvedValue(null)

      // Act
      const result = await useCase.execute(input)

      // Assert
      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toContain('non trovata')
      }
    })

    it('should return currentUserMemberId when user is a member', async () => {
      // Arrange
      const input = {
        leagueId: 'league-123',
        userId: 'user-123',
      }

      const mockLeague = createMockLeague()
      const userMember = createMockMemberWithUser({
        id: 'member-user-123',
        userId: 'user-123',
      })

      vi.mocked(mockRepository.findById).mockResolvedValue(mockLeague)
      vi.mocked(mockRepository.getMembers).mockResolvedValue([userMember])
      vi.mocked(mockRepository.getMember).mockResolvedValue(userMember)

      // Act
      const result = await useCase.execute(input)

      // Assert
      expect(result.isSuccess).toBe(true)
      if (result.isSuccess) {
        expect(result.value.currentUserMemberId).toBe('member-user-123')
      }
    })

    it('should return undefined currentUserMemberId when user is not a member', async () => {
      // Arrange
      const input = {
        leagueId: 'league-123',
        userId: 'non-member-user',
      }

      const mockLeague = createMockLeague()
      const otherMember = createMockMemberWithUser({
        id: 'member-other',
        userId: 'other-user',
      })

      vi.mocked(mockRepository.findById).mockResolvedValue(mockLeague)
      vi.mocked(mockRepository.getMembers).mockResolvedValue([otherMember])
      vi.mocked(mockRepository.getMember).mockResolvedValue(null)

      // Act
      const result = await useCase.execute(input)

      // Assert
      expect(result.isSuccess).toBe(true)
      if (result.isSuccess) {
        expect(result.value.currentUserMemberId).toBeUndefined()
      }
    })

    it('should return failure if repository throws an error', async () => {
      // Arrange
      const input = {
        leagueId: 'league-123',
        userId: 'user-123',
      }

      vi.mocked(mockRepository.findById).mockRejectedValue(new Error('Database error'))

      // Act
      const result = await useCase.execute(input)

      // Assert
      expect(result.isFailure).toBe(true)
    })

    it('should call repository methods with correct parameters', async () => {
      // Arrange
      const input = {
        leagueId: 'league-123',
        userId: 'user-123',
      }

      const mockLeague = createMockLeague()
      const mockMember = createMockMemberWithUser()

      vi.mocked(mockRepository.findById).mockResolvedValue(mockLeague)
      vi.mocked(mockRepository.getMembers).mockResolvedValue([mockMember])
      vi.mocked(mockRepository.getMember).mockResolvedValue(mockMember)

      // Act
      await useCase.execute(input)

      // Assert
      expect(mockRepository.findById).toHaveBeenCalledWith('league-123')
      expect(mockRepository.getMembers).toHaveBeenCalledWith('league-123')
      expect(mockRepository.getMember).toHaveBeenCalledWith('league-123', 'user-123')
    })
  })
})
