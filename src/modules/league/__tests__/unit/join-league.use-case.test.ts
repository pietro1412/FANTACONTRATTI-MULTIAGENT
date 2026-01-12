/**
 * JoinLeagueUseCase Unit Tests (TDD)
 *
 * Following TDD methodology, these tests are written BEFORE the implementation.
 * Tests define the expected behavior of the JoinLeagueUseCase.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { JoinLeagueUseCase } from '../../application/use-cases/join-league.use-case'
import type { ILeagueRepository } from '../../domain/repositories/league.repository.interface'
import type { League } from '../../domain/entities/league.entity'
import type { LeagueMember } from '../../domain/entities/league-member.entity'
import { EventBus } from '@/shared/infrastructure/events'
import { DomainEventTypes } from '@/shared/infrastructure/events'

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

// Mock league member factory
const createMockMember = (overrides: Partial<LeagueMember> = {}): LeagueMember => ({
  id: 'member-456',
  leagueId: 'league-123',
  userId: 'user-456',
  teamName: 'Joining Team',
  budget: 500,
  role: 'MANAGER',
  status: 'PENDING',
  joinType: 'REQUEST',
  joinedAt: new Date('2024-01-01'),
  ...overrides,
})

describe('JoinLeagueUseCase', () => {
  let useCase: JoinLeagueUseCase
  let mockRepository: ILeagueRepository
  let mockEventBus: EventBus

  beforeEach(() => {
    mockRepository = createMockRepository()
    mockEventBus = new EventBus()
    useCase = new JoinLeagueUseCase(mockRepository, mockEventBus)
    vi.clearAllMocks()
  })

  describe('execute', () => {
    it('should return failure if league not found', async () => {
      // Arrange
      const input = {
        userId: 'user-456',
        leagueId: 'non-existent-league',
        teamName: 'My Team',
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

    it('should return failure if league is full', async () => {
      // Arrange
      const input = {
        userId: 'user-456',
        leagueId: 'league-123',
        teamName: 'My Team',
      }

      const fullLeague = createMockLeague({ maxMembers: 10 })
      vi.mocked(mockRepository.findById).mockResolvedValue(fullLeague)
      vi.mocked(mockRepository.getActiveMemberCount).mockResolvedValue(10)
      vi.mocked(mockRepository.memberExists).mockResolvedValue(false)

      // Act
      const result = await useCase.execute(input)

      // Assert
      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toContain('completo')
      }
    })

    it('should return failure if user is already a member', async () => {
      // Arrange
      const input = {
        userId: 'user-456',
        leagueId: 'league-123',
        teamName: 'My Team',
      }

      const league = createMockLeague()
      vi.mocked(mockRepository.findById).mockResolvedValue(league)
      vi.mocked(mockRepository.memberExists).mockResolvedValue(true)

      // Act
      const result = await useCase.execute(input)

      // Assert
      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toContain('membro')
      }
    })

    it('should add user as MANAGER with PENDING status', async () => {
      // Arrange
      const input = {
        userId: 'user-456',
        leagueId: 'league-123',
        teamName: 'New Team',
      }

      const league = createMockLeague()
      const newMember = createMockMember({
        userId: input.userId,
        teamName: input.teamName,
        role: 'MANAGER',
        status: 'PENDING',
      })

      vi.mocked(mockRepository.findById).mockResolvedValue(league)
      vi.mocked(mockRepository.memberExists).mockResolvedValue(false)
      vi.mocked(mockRepository.getActiveMemberCount).mockResolvedValue(5)
      vi.mocked(mockRepository.addMember).mockResolvedValue(newMember)

      // Act
      await useCase.execute(input)

      // Assert
      expect(mockRepository.addMember).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: input.userId,
          leagueId: input.leagueId,
          teamName: input.teamName,
          role: 'MANAGER',
          status: 'PENDING',
          joinType: 'REQUEST',
        })
      )
    })

    it('should publish MemberJoined domain event on success', async () => {
      // Arrange
      const input = {
        userId: 'user-456',
        leagueId: 'league-123',
        teamName: 'Event Team',
      }

      const league = createMockLeague()
      const newMember = createMockMember({
        id: 'member-new-123',
        userId: input.userId,
        leagueId: input.leagueId,
      })

      vi.mocked(mockRepository.findById).mockResolvedValue(league)
      vi.mocked(mockRepository.memberExists).mockResolvedValue(false)
      vi.mocked(mockRepository.getActiveMemberCount).mockResolvedValue(5)
      vi.mocked(mockRepository.addMember).mockResolvedValue(newMember)

      const eventHandler = vi.fn()
      mockEventBus.subscribe(DomainEventTypes.MEMBER_JOINED, eventHandler)

      // Act
      await useCase.execute(input)

      // Assert
      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          leagueId: input.leagueId,
          memberId: 'member-new-123',
          userId: input.userId,
        })
      )
    })

    it('should return success result with member info', async () => {
      // Arrange
      const input = {
        userId: 'user-456',
        leagueId: 'league-123',
        teamName: 'Success Team',
      }

      const league = createMockLeague({ initialBudget: 500 })
      const newMember = createMockMember({
        id: 'member-success',
        userId: input.userId,
        leagueId: input.leagueId,
        teamName: input.teamName,
        budget: 0, // Budget is 0 until approved
      })

      vi.mocked(mockRepository.findById).mockResolvedValue(league)
      vi.mocked(mockRepository.memberExists).mockResolvedValue(false)
      vi.mocked(mockRepository.getActiveMemberCount).mockResolvedValue(5)
      vi.mocked(mockRepository.addMember).mockResolvedValue(newMember)

      // Act
      const result = await useCase.execute(input)

      // Assert
      expect(result.isSuccess).toBe(true)
      if (result.isSuccess) {
        expect(result.value.leagueId).toBe(input.leagueId)
        expect(result.value.memberId).toBe('member-success')
        expect(result.value.teamName).toBe(input.teamName)
      }
    })

    it('should return failure if league is not in DRAFT status', async () => {
      // Arrange
      const input = {
        userId: 'user-456',
        leagueId: 'league-123',
        teamName: 'Late Team',
      }

      const activeLeague = createMockLeague({ status: 'ACTIVE' })
      vi.mocked(mockRepository.findById).mockResolvedValue(activeLeague)
      vi.mocked(mockRepository.memberExists).mockResolvedValue(false)

      // Act
      const result = await useCase.execute(input)

      // Assert
      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toContain('avviata')
      }
    })

    it('should return failure if team name is empty', async () => {
      // Arrange
      const input = {
        userId: 'user-456',
        leagueId: 'league-123',
        teamName: '',
      }

      const league = createMockLeague()
      vi.mocked(mockRepository.findById).mockResolvedValue(league)

      // Act
      const result = await useCase.execute(input)

      // Assert
      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toContain('squadra')
      }
    })

    it('should return failure if team name is too short', async () => {
      // Arrange
      const input = {
        userId: 'user-456',
        leagueId: 'league-123',
        teamName: 'A',
      }

      const league = createMockLeague()
      vi.mocked(mockRepository.findById).mockResolvedValue(league)

      // Act
      const result = await useCase.execute(input)

      // Assert
      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toContain('2 caratteri')
      }
    })

    it('should return failure if repository throws an error', async () => {
      // Arrange
      const input = {
        userId: 'user-456',
        leagueId: 'league-123',
        teamName: 'Error Team',
      }

      vi.mocked(mockRepository.findById).mockRejectedValue(new Error('Database error'))

      // Act
      const result = await useCase.execute(input)

      // Assert
      expect(result.isFailure).toBe(true)
    })
  })
})
