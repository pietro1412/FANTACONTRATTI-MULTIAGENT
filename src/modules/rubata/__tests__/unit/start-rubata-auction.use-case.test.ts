/**
 * StartRubataAuction Use Case Tests - TDD
 *
 * Tests for the start rubata auction use case following TDD principles.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { StartRubataAuctionUseCase, type IAuctionService } from '../../application/use-cases/start-rubata-auction.use-case'
import type { IRubataRepository } from '../../domain/repositories/rubata.repository.interface'
import type { EventBus } from '@/shared/infrastructure/events'
import { DomainEventTypes } from '@/shared/infrastructure/events'
import type { RubataBoardEntry, RubataBoardEntryWithDetails } from '../../domain/entities/rubata-board.entity'
import type { RubataOffer } from '../../domain/entities/rubata-offer.entity'

describe('StartRubataAuctionUseCase', () => {
  let startAuctionUseCase: StartRubataAuctionUseCase
  let mockRepository: IRubataRepository
  let mockAuctionService: IAuctionService
  let mockEventBus: EventBus

  const mockBoardEntry: RubataBoardEntry = {
    id: 'entry-1',
    sessionId: 'session-123',
    rosterId: 'roster-1',
    memberId: 'member-1',
    playerId: 'player-1',
    status: 'PENDING',
    createdAt: new Date(),
  }

  const mockDetailedEntry: RubataBoardEntryWithDetails = {
    ...mockBoardEntry,
    playerName: 'Mario Rossi',
    playerPosition: 'A',
    playerTeam: 'Juventus',
    ownerUsername: 'owner1',
    ownerTeamName: 'Team Alpha',
    contractSalary: 10,
    contractDuration: 2,
    contractClause: 30,
    rubataBasePrice: 40,
  }

  const mockHighestOffer: RubataOffer = {
    id: 'offer-1',
    boardEntryId: 'entry-1',
    offeredByMemberId: 'member-2',
    amount: 50,
    status: 'PENDING',
    placedAt: new Date(),
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

    // Create mock auction service
    mockAuctionService = {
      createRubataAuction: vi.fn().mockResolvedValue({ auctionId: 'auction-1' }),
    }

    // Create mock event bus
    mockEventBus = {
      publish: vi.fn(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    } as unknown as EventBus

    startAuctionUseCase = new StartRubataAuctionUseCase(
      mockRepository,
      mockAuctionService,
      mockEventBus
    )
  })

  describe('input validation', () => {
    it('should return failure if session ID is empty', async () => {
      // Act
      const result = await startAuctionUseCase.execute({
        sessionId: '',
        boardEntryId: 'entry-1',
      })

      // Assert
      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toBe('ID sessione obbligatorio')
      }
    })

    it('should return failure if board entry ID is empty', async () => {
      // Act
      const result = await startAuctionUseCase.execute({
        sessionId: 'session-123',
        boardEntryId: '',
      })

      // Assert
      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toBe('ID voce tabellone obbligatorio')
      }
    })
  })

  describe('board entry validation', () => {
    it('should return failure if board entry not found', async () => {
      // Arrange
      vi.mocked(mockRepository.getBoardEntry).mockResolvedValue(null)

      // Act
      const result = await startAuctionUseCase.execute({
        sessionId: 'session-123',
        boardEntryId: 'entry-999',
      })

      // Assert
      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.statusCode).toBe(404)
        expect(result.error.message).toBe('Voce tabellone non trovata')
      }
    })

    it('should return failure if entry does not belong to session', async () => {
      // Arrange
      vi.mocked(mockRepository.getBoardEntry).mockResolvedValue({
        ...mockBoardEntry,
        sessionId: 'different-session',
      })

      // Act
      const result = await startAuctionUseCase.execute({
        sessionId: 'session-123',
        boardEntryId: 'entry-1',
      })

      // Assert
      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toContain('non appartiene')
      }
    })

    it('should return failure if entry is not in PENDING status', async () => {
      // Arrange
      vi.mocked(mockRepository.getBoardEntry).mockResolvedValue({
        ...mockBoardEntry,
        status: 'IN_AUCTION',
      })

      // Act
      const result = await startAuctionUseCase.execute({
        sessionId: 'session-123',
        boardEntryId: 'entry-1',
      })

      // Assert
      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.statusCode).toBe(409)
        expect(result.error.message).toContain('stato valido')
      }
    })
  })

  describe('offer validation', () => {
    it('should return failure if no offers exist', async () => {
      // Arrange
      vi.mocked(mockRepository.getBoardEntry).mockResolvedValue(mockBoardEntry)
      vi.mocked(mockRepository.getHighestOffer).mockResolvedValue(null)

      // Act
      const result = await startAuctionUseCase.execute({
        sessionId: 'session-123',
        boardEntryId: 'entry-1',
      })

      // Assert
      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toContain('Nessuna offerta')
      }
    })
  })

  describe('successful auction start', () => {
    beforeEach(() => {
      vi.mocked(mockRepository.getBoardEntry).mockResolvedValue(mockBoardEntry)
      vi.mocked(mockRepository.getHighestOffer).mockResolvedValue(mockHighestOffer)
      vi.mocked(mockRepository.getCurrentBoardEntry).mockResolvedValue(mockDetailedEntry)
    })

    it('should start auction successfully', async () => {
      // Act
      const result = await startAuctionUseCase.execute({
        sessionId: 'session-123',
        boardEntryId: 'entry-1',
      })

      // Assert
      expect(result.isSuccess).toBe(true)
      if (result.isSuccess) {
        expect(result.value.auctionId).toBe('auction-1')
        expect(result.value.boardEntry).toEqual(mockDetailedEntry)
        expect(result.value.startingPrice).toBe(50)
        expect(result.value.initialBidderId).toBe('member-2')
      }
    })

    it('should update board entry status to IN_AUCTION', async () => {
      // Act
      await startAuctionUseCase.execute({
        sessionId: 'session-123',
        boardEntryId: 'entry-1',
      })

      // Assert
      expect(mockRepository.updateBoardEntryStatus).toHaveBeenCalledWith(
        'entry-1',
        'IN_AUCTION'
      )
    })

    it('should cancel all pending offers for the entry', async () => {
      // Act
      await startAuctionUseCase.execute({
        sessionId: 'session-123',
        boardEntryId: 'entry-1',
      })

      // Assert
      expect(mockRepository.cancelPendingOffers).toHaveBeenCalledWith('entry-1')
    })

    it('should create auction via auction service', async () => {
      // Act
      await startAuctionUseCase.execute({
        sessionId: 'session-123',
        boardEntryId: 'entry-1',
      })

      // Assert
      expect(mockAuctionService.createRubataAuction).toHaveBeenCalledWith({
        sessionId: 'session-123',
        playerId: 'player-1',
        sellerId: 'member-1',
        basePrice: 40,
        initialBidderId: 'member-2',
      })
    })

    it('should update session phase to AUCTION', async () => {
      // Act
      await startAuctionUseCase.execute({
        sessionId: 'session-123',
        boardEntryId: 'entry-1',
      })

      // Assert
      expect(mockRepository.updateSessionPhase).toHaveBeenCalledWith(
        'session-123',
        'AUCTION'
      )
    })

    it('should publish RubataAuctionStarted event', async () => {
      // Act
      await startAuctionUseCase.execute({
        sessionId: 'session-123',
        boardEntryId: 'entry-1',
      })

      // Assert
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        DomainEventTypes.RUBATA_AUCTION_STARTED,
        {
          sessionId: 'session-123',
          playerId: 'player-1',
        }
      )
    })
  })
})
