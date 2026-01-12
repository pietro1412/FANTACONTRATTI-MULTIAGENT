/**
 * Record Movement Use Case Tests - TDD
 *
 * Tests for the record movement use case following TDD principles.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { RecordMovementUseCase } from '../../application/use-cases/record-movement.use-case'
import type { IMovementRepository } from '../../domain/repositories/movement.repository.interface'

describe('RecordMovementUseCase', () => {
  let recordMovementUseCase: RecordMovementUseCase
  let mockMovementRepository: IMovementRepository

  beforeEach(() => {
    mockMovementRepository = {
      create: vi.fn(),
      findById: vi.fn(),
      findMany: vi.fn(),
      findByPlayer: vi.fn(),
      findByMember: vi.fn(),
      checkMembership: vi.fn(),
    }

    recordMovementUseCase = new RecordMovementUseCase(mockMovementRepository)
  })

  describe('execute', () => {
    it('should return failure if leagueId is missing', async () => {
      const result = await recordMovementUseCase.execute({
        leagueId: '',
        playerId: 'player-123',
        movementType: 'FIRST_MARKET',
        toMemberId: 'member-456',
      })

      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toBe('League ID is required')
      }
    })

    it('should return failure if playerId is missing', async () => {
      const result = await recordMovementUseCase.execute({
        leagueId: 'league-123',
        playerId: '',
        movementType: 'FIRST_MARKET',
        toMemberId: 'member-456',
      })

      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toBe('Player ID is required')
      }
    })

    it('should return failure if movementType is missing', async () => {
      const result = await recordMovementUseCase.execute({
        leagueId: 'league-123',
        playerId: 'player-123',
        movementType: '',
        toMemberId: 'member-456',
      })

      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toBe('Movement type is required')
      }
    })

    it('should return failure if movementType is invalid', async () => {
      const result = await recordMovementUseCase.execute({
        leagueId: 'league-123',
        playerId: 'player-123',
        movementType: 'INVALID_TYPE',
        toMemberId: 'member-456',
      })

      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toContain('Invalid movement type')
      }
    })

    it('should return failure if no party is specified for non-RELEASE type', async () => {
      const result = await recordMovementUseCase.execute({
        leagueId: 'league-123',
        playerId: 'player-123',
        movementType: 'FIRST_MARKET',
      })

      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toBe('At least one party (from/to) must be specified')
      }
    })

    it('should allow RELEASE type without parties', async () => {
      vi.mocked(mockMovementRepository.create).mockResolvedValue('movement-123')

      const result = await recordMovementUseCase.execute({
        leagueId: 'league-123',
        playerId: 'player-123',
        movementType: 'RELEASE',
        fromMemberId: 'member-456',
      })

      expect(result.isSuccess).toBe(true)
      if (result.isSuccess) {
        expect(result.value.movementId).toBe('movement-123')
      }
    })

    it('should successfully record a first market movement', async () => {
      vi.mocked(mockMovementRepository.create).mockResolvedValue('movement-123')

      const result = await recordMovementUseCase.execute({
        leagueId: 'league-123',
        playerId: 'player-123',
        movementType: 'FIRST_MARKET',
        toMemberId: 'member-456',
        price: 10,
        newSalary: 5,
        newDuration: 3,
        newClause: 20,
        auctionId: 'auction-789',
        marketSessionId: 'session-101',
      })

      expect(result.isSuccess).toBe(true)
      if (result.isSuccess) {
        expect(result.value.movementId).toBe('movement-123')
      }
      expect(mockMovementRepository.create).toHaveBeenCalledWith({
        leagueId: 'league-123',
        playerId: 'player-123',
        movementType: 'FIRST_MARKET',
        fromMemberId: undefined,
        toMemberId: 'member-456',
        price: 10,
        oldSalary: undefined,
        oldDuration: undefined,
        oldClause: undefined,
        newSalary: 5,
        newDuration: 3,
        newClause: 20,
        auctionId: 'auction-789',
        tradeId: undefined,
        marketSessionId: 'session-101',
      })
    })

    it('should successfully record a trade movement', async () => {
      vi.mocked(mockMovementRepository.create).mockResolvedValue('movement-456')

      const result = await recordMovementUseCase.execute({
        leagueId: 'league-123',
        playerId: 'player-123',
        movementType: 'TRADE',
        fromMemberId: 'member-111',
        toMemberId: 'member-222',
        price: 15,
        oldSalary: 5,
        oldDuration: 2,
        oldClause: 10,
        newSalary: 8,
        newDuration: 3,
        newClause: 25,
        tradeId: 'trade-333',
      })

      expect(result.isSuccess).toBe(true)
      if (result.isSuccess) {
        expect(result.value.movementId).toBe('movement-456')
      }
    })

    it('should return failure if repository fails to create', async () => {
      vi.mocked(mockMovementRepository.create).mockResolvedValue(null)

      const result = await recordMovementUseCase.execute({
        leagueId: 'league-123',
        playerId: 'player-123',
        movementType: 'FIRST_MARKET',
        toMemberId: 'member-456',
      })

      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toBe('Failed to record movement')
      }
    })
  })
})
