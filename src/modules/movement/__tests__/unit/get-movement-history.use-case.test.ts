/**
 * Get Movement History Use Case Tests - TDD
 *
 * Tests for the get movement history use case following TDD principles.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GetMovementHistoryUseCase } from '../../application/use-cases/get-movement-history.use-case'
import type { IMovementRepository, FormattedMovement } from '../../domain/repositories/movement.repository.interface'

describe('GetMovementHistoryUseCase', () => {
  let getMovementHistoryUseCase: GetMovementHistoryUseCase
  let mockMovementRepository: IMovementRepository

  const mockMovements: FormattedMovement[] = [
    {
      id: 'movement-1',
      type: 'FIRST_MARKET',
      player: {
        id: 'player-1',
        name: 'Mario Rossi',
        position: 'A',
        team: 'Inter',
      },
      from: null,
      to: {
        memberId: 'member-1',
        username: 'user1',
        teamName: 'Team Alpha',
      },
      price: 25,
      oldContract: null,
      newContract: {
        salary: 10,
        duration: 3,
        clause: 30,
      },
      prophecies: [],
      createdAt: new Date('2024-01-15'),
    },
    {
      id: 'movement-2',
      type: 'TRADE',
      player: {
        id: 'player-2',
        name: 'Luca Bianchi',
        position: 'C',
        team: 'Milan',
      },
      from: {
        memberId: 'member-2',
        username: 'user2',
        teamName: 'Team Beta',
      },
      to: {
        memberId: 'member-1',
        username: 'user1',
        teamName: 'Team Alpha',
      },
      price: 15,
      oldContract: {
        salary: 5,
        duration: 2,
        clause: 15,
      },
      newContract: {
        salary: 7,
        duration: 3,
        clause: 20,
      },
      prophecies: [
        {
          id: 'prophecy-1',
          content: 'Grande acquisto!',
          authorRole: 'BUYER',
          author: {
            memberId: 'member-1',
            username: 'user1',
            teamName: 'Team Alpha',
          },
          createdAt: new Date('2024-01-16'),
          source: 'prophecy',
        },
      ],
      createdAt: new Date('2024-01-16'),
    },
  ]

  beforeEach(() => {
    mockMovementRepository = {
      create: vi.fn(),
      findById: vi.fn(),
      findMany: vi.fn(),
      findByPlayer: vi.fn(),
      findByMember: vi.fn(),
      checkMembership: vi.fn(),
    }

    getMovementHistoryUseCase = new GetMovementHistoryUseCase(mockMovementRepository)
  })

  describe('execute', () => {
    it('should return failure if leagueId is missing', async () => {
      const result = await getMovementHistoryUseCase.execute({
        leagueId: '',
        userId: 'user-123',
      })

      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toBe('League ID is required')
      }
    })

    it('should return failure if userId is missing', async () => {
      const result = await getMovementHistoryUseCase.execute({
        leagueId: 'league-123',
        userId: '',
      })

      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toBe('User ID is required')
      }
    })

    it('should return failure if user is not a member of the league', async () => {
      vi.mocked(mockMovementRepository.checkMembership).mockResolvedValue(null)

      const result = await getMovementHistoryUseCase.execute({
        leagueId: 'league-123',
        userId: 'user-123',
      })

      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toBe('Non sei membro di questa lega')
      }
    })

    it('should return movements for a valid member', async () => {
      vi.mocked(mockMovementRepository.checkMembership).mockResolvedValue('member-123')
      vi.mocked(mockMovementRepository.findMany).mockResolvedValue(mockMovements)

      const result = await getMovementHistoryUseCase.execute({
        leagueId: 'league-123',
        userId: 'user-123',
      })

      expect(result.isSuccess).toBe(true)
      if (result.isSuccess) {
        expect(result.value.movements).toHaveLength(2)
        expect(result.value.movements[0].id).toBe('movement-1')
        expect(result.value.movements[1].prophecies).toHaveLength(1)
      }
    })

    it('should pass filter options to repository', async () => {
      vi.mocked(mockMovementRepository.checkMembership).mockResolvedValue('member-123')
      vi.mocked(mockMovementRepository.findMany).mockResolvedValue([])

      await getMovementHistoryUseCase.execute({
        leagueId: 'league-123',
        userId: 'user-123',
        playerId: 'player-456',
        movementType: 'TRADE',
        semester: 1,
        limit: 50,
        offset: 10,
      })

      expect(mockMovementRepository.findMany).toHaveBeenCalledWith({
        leagueId: 'league-123',
        playerId: 'player-456',
        movementType: 'TRADE',
        semester: 1,
        limit: 50,
        offset: 10,
      })
    })

    it('should use default limit and offset if not provided', async () => {
      vi.mocked(mockMovementRepository.checkMembership).mockResolvedValue('member-123')
      vi.mocked(mockMovementRepository.findMany).mockResolvedValue([])

      await getMovementHistoryUseCase.execute({
        leagueId: 'league-123',
        userId: 'user-123',
      })

      expect(mockMovementRepository.findMany).toHaveBeenCalledWith({
        leagueId: 'league-123',
        playerId: undefined,
        movementType: undefined,
        semester: undefined,
        limit: 100,
        offset: 0,
      })
    })

    it('should return empty array if no movements found', async () => {
      vi.mocked(mockMovementRepository.checkMembership).mockResolvedValue('member-123')
      vi.mocked(mockMovementRepository.findMany).mockResolvedValue([])

      const result = await getMovementHistoryUseCase.execute({
        leagueId: 'league-123',
        userId: 'user-123',
      })

      expect(result.isSuccess).toBe(true)
      if (result.isSuccess) {
        expect(result.value.movements).toHaveLength(0)
      }
    })
  })
})
