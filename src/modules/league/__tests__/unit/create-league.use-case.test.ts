/**
 * CreateLeagueUseCase Unit Tests (TDD)
 *
 * Following TDD methodology, these tests are written BEFORE the implementation.
 * Tests define the expected behavior of the CreateLeagueUseCase.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CreateLeagueUseCase } from '../../application/use-cases/create-league.use-case'
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
  adminId: 'user-123',
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
  id: 'member-123',
  leagueId: 'league-123',
  userId: 'user-123',
  teamName: 'My Team',
  budget: 500,
  role: 'ADMIN',
  status: 'ACTIVE',
  joinType: 'CREATOR',
  joinedAt: new Date('2024-01-01'),
  ...overrides,
})

describe('CreateLeagueUseCase', () => {
  let useCase: CreateLeagueUseCase
  let mockRepository: ILeagueRepository
  let mockEventBus: EventBus

  beforeEach(() => {
    mockRepository = createMockRepository()
    mockEventBus = new EventBus()
    useCase = new CreateLeagueUseCase(mockRepository, mockEventBus)
    vi.clearAllMocks()
  })

  describe('execute', () => {
    it('should create a league with user as admin', async () => {
      // Arrange
      const userId = 'user-123'
      const input = {
        userId,
        data: {
          name: 'My Fantasy League',
          teamName: 'Champions FC',
          description: 'A competitive league',
        },
      }

      const mockLeague = createMockLeague({
        name: input.data.name,
        description: input.data.description,
        adminId: userId,
      })

      const mockMember = createMockMember({
        userId,
        teamName: input.data.teamName,
        leagueId: mockLeague.id,
      })

      vi.mocked(mockRepository.create).mockResolvedValue(mockLeague)
      vi.mocked(mockRepository.addMember).mockResolvedValue(mockMember)

      // Act
      const result = await useCase.execute(input)

      // Assert
      expect(result.isSuccess).toBe(true)
      if (result.isSuccess) {
        expect(result.value.league.name).toBe('My Fantasy League')
        expect(result.value.league.adminId).toBe(userId)
        expect(result.value.inviteCode).toBeDefined()
      }
    })

    it('should generate a unique invite code', async () => {
      // Arrange
      const input = {
        userId: 'user-123',
        data: {
          name: 'Test League',
          teamName: 'Test Team',
        },
      }

      const mockLeague = createMockLeague({
        inviteCode: 'unique-invite-code',
      })

      vi.mocked(mockRepository.create).mockResolvedValue(mockLeague)
      vi.mocked(mockRepository.addMember).mockResolvedValue(createMockMember())

      // Act
      const result = await useCase.execute(input)

      // Assert
      expect(result.isSuccess).toBe(true)
      if (result.isSuccess) {
        expect(result.value.inviteCode).toBe('unique-invite-code')
      }
    })

    it('should add creator as first member with ADMIN role', async () => {
      // Arrange
      const userId = 'user-123'
      const teamName = 'Admin Team'
      const input = {
        userId,
        data: {
          name: 'Test League',
          teamName,
        },
      }

      const mockLeague = createMockLeague({ adminId: userId })
      vi.mocked(mockRepository.create).mockResolvedValue(mockLeague)
      vi.mocked(mockRepository.addMember).mockResolvedValue(createMockMember())

      // Act
      await useCase.execute(input)

      // Assert
      expect(mockRepository.addMember).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          teamName,
          role: 'ADMIN',
          status: 'ACTIVE',
          joinType: 'CREATOR',
        })
      )
    })

    it('should publish LeagueCreated domain event', async () => {
      // Arrange
      const userId = 'user-123'
      const input = {
        userId,
        data: {
          name: 'Event Test League',
          teamName: 'Test Team',
        },
      }

      const mockLeague = createMockLeague({
        id: 'league-event-123',
        name: input.data.name,
        adminId: userId,
      })

      vi.mocked(mockRepository.create).mockResolvedValue(mockLeague)
      vi.mocked(mockRepository.addMember).mockResolvedValue(createMockMember())

      const eventHandler = vi.fn()
      mockEventBus.subscribe(DomainEventTypes.LEAGUE_CREATED, eventHandler)

      // Act
      await useCase.execute(input)

      // Assert
      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          leagueId: 'league-event-123',
          adminId: userId,
          name: 'Event Test League',
        })
      )
    })

    it('should use default values when not provided', async () => {
      // Arrange
      const input = {
        userId: 'user-123',
        data: {
          name: 'Minimal League',
          teamName: 'Test Team',
        },
      }

      const mockLeague = createMockLeague({
        name: input.data.name,
        maxMembers: 20,
        initialBudget: 500,
      })

      vi.mocked(mockRepository.create).mockResolvedValue(mockLeague)
      vi.mocked(mockRepository.addMember).mockResolvedValue(createMockMember())

      // Act
      const result = await useCase.execute(input)

      // Assert
      expect(result.isSuccess).toBe(true)
      if (result.isSuccess) {
        expect(result.value.league.maxMembers).toBe(20)
        expect(result.value.league.initialBudget).toBe(500)
      }
    })

    it('should return failure if league name is empty', async () => {
      // Arrange
      const input = {
        userId: 'user-123',
        data: {
          name: '',
          teamName: 'Test Team',
        },
      }

      // Act
      const result = await useCase.execute(input)

      // Assert
      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toContain('nome')
      }
    })

    it('should return failure if team name is empty', async () => {
      // Arrange
      const input = {
        userId: 'user-123',
        data: {
          name: 'Test League',
          teamName: '',
        },
      }

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
        userId: 'user-123',
        data: {
          name: 'Test League',
          teamName: 'A',
        },
      }

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
        userId: 'user-123',
        data: {
          name: 'Test League',
          teamName: 'Test Team',
        },
      }

      vi.mocked(mockRepository.create).mockRejectedValue(new Error('Database error'))

      // Act
      const result = await useCase.execute(input)

      // Assert
      expect(result.isFailure).toBe(true)
    })
  })
})
