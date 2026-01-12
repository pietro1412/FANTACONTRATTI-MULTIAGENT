/**
 * PlaceOffer Use Case Tests - TDD
 *
 * CRITICAL: Tests for the place offer use case with focus on race conditions.
 * These tests define the expected behavior for atomic offer placement.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PlaceOfferUseCase } from '../../application/use-cases/place-offer.use-case'
import type { IRubataRepository, PlaceOfferResult } from '../../domain/repositories/rubata.repository.interface'
import type { EventBus } from '@/shared/infrastructure/events'
import { DomainEventTypes } from '@/shared/infrastructure/events'
import type { RubataOffer } from '../../domain/entities/rubata-offer.entity'
import type { RubataBoardEntry } from '../../domain/entities/rubata-board.entity'

describe('PlaceOfferUseCase', () => {
  let placeOfferUseCase: PlaceOfferUseCase
  let mockRepository: IRubataRepository
  let mockEventBus: EventBus

  const mockOffer: RubataOffer = {
    id: 'offer-1',
    boardEntryId: 'entry-1',
    offeredByMemberId: 'member-2',
    amount: 100,
    status: 'PENDING',
    placedAt: new Date(),
  }

  const mockBoardEntry: RubataBoardEntry = {
    id: 'entry-1',
    sessionId: 'session-123',
    rosterId: 'roster-1',
    memberId: 'member-1',
    playerId: 'player-1',
    status: 'PENDING',
    createdAt: new Date(),
  }

  beforeEach(() => {
    // Create mock repository
    mockRepository = {
      getSession: vi.fn(),
      updateSessionStatus: vi.fn(),
      updateSessionPhase: vi.fn(),
      getSessionMembers: vi.fn(),
      getBoardEntries: vi.fn(),
      getBoardEntriesWithDetails: vi.fn(),
      getBoardEntry: vi.fn(),
      getCurrentBoardEntry: vi.fn(),
      addToBoardAtomic: vi.fn(),
      removeFromBoard: vi.fn(),
      updateBoardEntryStatus: vi.fn(),
      getMemberBoardCount: vi.fn(),
      getReadyStatus: vi.fn(),
      setReady: vi.fn(),
      resetAllReady: vi.fn(),
      initializeReadyStatuses: vi.fn(),
      placeOfferAtomic: vi.fn(),
      getOffers: vi.fn(),
      getHighestOffer: vi.fn(),
      cancelPendingOffers: vi.fn(),
      getMemberBudget: vi.fn(),
    }

    // Create mock event bus
    mockEventBus = {
      publish: vi.fn(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    } as unknown as EventBus

    placeOfferUseCase = new PlaceOfferUseCase(mockRepository, mockEventBus)
  })

  describe('input validation', () => {
    it('should return failure if board entry ID is empty', async () => {
      // Act
      const result = await placeOfferUseCase.execute({
        boardEntryId: '',
        offeredById: 'member-2',
        amount: 100,
      })

      // Assert
      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toBe('ID voce tabellone obbligatorio')
      }
    })

    it('should return failure if offered by ID is empty', async () => {
      // Act
      const result = await placeOfferUseCase.execute({
        boardEntryId: 'entry-1',
        offeredById: '',
        amount: 100,
      })

      // Assert
      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toBe('ID offerente obbligatorio')
      }
    })

    it('should return failure if amount is not a positive integer', async () => {
      // Act
      const result = await placeOfferUseCase.execute({
        boardEntryId: 'entry-1',
        offeredById: 'member-2',
        amount: -10,
      })

      // Assert
      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toContain('numero intero positivo')
      }
    })

    it('should return failure if amount is zero', async () => {
      // Act
      const result = await placeOfferUseCase.execute({
        boardEntryId: 'entry-1',
        offeredById: 'member-2',
        amount: 0,
      })

      // Assert
      expect(result.isFailure).toBe(true)
    })

    it('should return failure if amount is not an integer', async () => {
      // Act
      const result = await placeOfferUseCase.execute({
        boardEntryId: 'entry-1',
        offeredById: 'member-2',
        amount: 100.5,
      })

      // Assert
      expect(result.isFailure).toBe(true)
    })
  })

  describe('atomic operation failures', () => {
    it('should return failure if board entry not found', async () => {
      // Arrange
      const failureResult: PlaceOfferResult = {
        success: false,
        errorCode: 'ENTRY_NOT_FOUND',
      }
      vi.mocked(mockRepository.placeOfferAtomic).mockResolvedValue(failureResult)

      // Act
      const result = await placeOfferUseCase.execute({
        boardEntryId: 'entry-999',
        offeredById: 'member-2',
        amount: 100,
      })

      // Assert
      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.statusCode).toBe(404) // NotFoundError
        expect(result.error.message).toBe('Voce tabellone non trovata')
      }
    })

    it('should return failure if entry already in auction', async () => {
      // Arrange
      const failureResult: PlaceOfferResult = {
        success: false,
        errorCode: 'ENTRY_ALREADY_IN_AUCTION',
      }
      vi.mocked(mockRepository.placeOfferAtomic).mockResolvedValue(failureResult)

      // Act
      const result = await placeOfferUseCase.execute({
        boardEntryId: 'entry-1',
        offeredById: 'member-2',
        amount: 100,
      })

      // Assert
      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.statusCode).toBe(409) // ConflictError
        expect(result.error.message).toBe('Questa voce è già in asta')
      }
    })

    it('should return failure if bidder has insufficient budget', async () => {
      // Arrange
      const failureResult: PlaceOfferResult = {
        success: false,
        errorCode: 'INSUFFICIENT_BUDGET',
      }
      vi.mocked(mockRepository.placeOfferAtomic).mockResolvedValue(failureResult)

      // Act
      const result = await placeOfferUseCase.execute({
        boardEntryId: 'entry-1',
        offeredById: 'member-2',
        amount: 1000,
      })

      // Assert
      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.statusCode).toBe(400) // ValidationError
        expect(result.error.message).toBe('Budget insufficiente per questa offerta')
      }
    })

    it('should return failure if offer is too low', async () => {
      // Arrange
      const failureResult: PlaceOfferResult = {
        success: false,
        errorCode: 'OFFER_TOO_LOW',
      }
      vi.mocked(mockRepository.placeOfferAtomic).mockResolvedValue(failureResult)

      // Act
      const result = await placeOfferUseCase.execute({
        boardEntryId: 'entry-1',
        offeredById: 'member-2',
        amount: 50,
      })

      // Assert
      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.statusCode).toBe(400) // ValidationError
        expect(result.error.message).toContain('superiore')
      }
    })

    it('should return failure if bidder is the player owner', async () => {
      // Arrange
      const failureResult: PlaceOfferResult = {
        success: false,
        errorCode: 'CANNOT_BID_OWN_PLAYER',
      }
      vi.mocked(mockRepository.placeOfferAtomic).mockResolvedValue(failureResult)

      // Act
      const result = await placeOfferUseCase.execute({
        boardEntryId: 'entry-1',
        offeredById: 'member-1', // Same as owner
        amount: 100,
      })

      // Assert
      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.statusCode).toBe(403) // ForbiddenError
        expect(result.error.message).toContain('tuo giocatore')
      }
    })
  })

  describe('successful offer placement', () => {
    it('should place offer successfully and return result', async () => {
      // Arrange
      const successResult: PlaceOfferResult = {
        success: true,
        offer: mockOffer,
        highestOffer: 100,
      }
      vi.mocked(mockRepository.placeOfferAtomic).mockResolvedValue(successResult)
      vi.mocked(mockRepository.getBoardEntry).mockResolvedValue(mockBoardEntry)

      // Act
      const result = await placeOfferUseCase.execute({
        boardEntryId: 'entry-1',
        offeredById: 'member-2',
        amount: 100,
      })

      // Assert
      expect(result.isSuccess).toBe(true)
      if (result.isSuccess) {
        expect(result.value.offer).toEqual(mockOffer)
        expect(result.value.highestOffer).toBe(100)
        expect(result.value.isHighest).toBe(true)
      }
    })

    it('should indicate if offer is not the highest', async () => {
      // Arrange
      const lowerOffer = { ...mockOffer, amount: 80 }
      const successResult: PlaceOfferResult = {
        success: true,
        offer: lowerOffer,
        highestOffer: 100, // Someone else has 100
      }
      vi.mocked(mockRepository.placeOfferAtomic).mockResolvedValue(successResult)
      vi.mocked(mockRepository.getBoardEntry).mockResolvedValue(mockBoardEntry)

      // Act
      const result = await placeOfferUseCase.execute({
        boardEntryId: 'entry-1',
        offeredById: 'member-2',
        amount: 80,
      })

      // Assert
      expect(result.isSuccess).toBe(true)
      if (result.isSuccess) {
        expect(result.value.isHighest).toBe(false)
      }
    })

    it('should publish RubataOfferPlaced event on success', async () => {
      // Arrange
      const successResult: PlaceOfferResult = {
        success: true,
        offer: mockOffer,
        highestOffer: 100,
      }
      vi.mocked(mockRepository.placeOfferAtomic).mockResolvedValue(successResult)
      vi.mocked(mockRepository.getBoardEntry).mockResolvedValue(mockBoardEntry)

      // Act
      await placeOfferUseCase.execute({
        boardEntryId: 'entry-1',
        offeredById: 'member-2',
        amount: 100,
      })

      // Assert
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        DomainEventTypes.RUBATA_OFFER_PLACED,
        {
          sessionId: 'session-123',
          playerId: 'player-1',
          offeredById: 'member-2',
        }
      )
    })
  })

  describe('race condition handling', () => {
    it('should use atomic transaction for offer placement', async () => {
      // Arrange
      const successResult: PlaceOfferResult = {
        success: true,
        offer: mockOffer,
        highestOffer: 100,
      }
      vi.mocked(mockRepository.placeOfferAtomic).mockResolvedValue(successResult)
      vi.mocked(mockRepository.getBoardEntry).mockResolvedValue(mockBoardEntry)

      // Act
      await placeOfferUseCase.execute({
        boardEntryId: 'entry-1',
        offeredById: 'member-2',
        amount: 100,
      })

      // Assert - verify atomic method was called, not separate read/write operations
      expect(mockRepository.placeOfferAtomic).toHaveBeenCalledWith({
        boardEntryId: 'entry-1',
        offeredByMemberId: 'member-2',
        amount: 100,
      })
      expect(mockRepository.placeOfferAtomic).toHaveBeenCalledTimes(1)
    })

    it('should not publish event if atomic operation fails', async () => {
      // Arrange
      const failureResult: PlaceOfferResult = {
        success: false,
        errorCode: 'INSUFFICIENT_BUDGET',
      }
      vi.mocked(mockRepository.placeOfferAtomic).mockResolvedValue(failureResult)

      // Act
      await placeOfferUseCase.execute({
        boardEntryId: 'entry-1',
        offeredById: 'member-2',
        amount: 100,
      })

      // Assert
      expect(mockEventBus.publish).not.toHaveBeenCalled()
    })
  })
})
