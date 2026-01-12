/**
 * AddToBoard Use Case Tests - TDD
 *
 * Tests for the add to board use case following TDD principles.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AddToBoardUseCase } from '../../application/use-cases/add-to-board.use-case'
import type { IRubataRepository } from '../../domain/repositories/rubata.repository.interface'
import type { RubataSession } from '../../domain/entities/rubata-session.entity'

describe('AddToBoardUseCase', () => {
  let addToBoardUseCase: AddToBoardUseCase
  let mockRepository: IRubataRepository

  const mockSession: RubataSession = {
    marketSessionId: 'session-123',
    status: 'BOARD_SELECTION',
    currentPhase: 'BOARD_SELECTION',
    boardSetupDeadline: null,
    auctionStartedAt: null,
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

    addToBoardUseCase = new AddToBoardUseCase(mockRepository)
  })

  describe('execute', () => {
    it('should return failure if session ID is empty', async () => {
      // Act
      const result = await addToBoardUseCase.execute({
        sessionId: '',
        rosterId: 'roster-1',
        memberId: 'member-1',
      })

      // Assert
      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toBe('ID sessione obbligatorio')
      }
    })

    it('should return failure if roster ID is empty', async () => {
      // Act
      const result = await addToBoardUseCase.execute({
        sessionId: 'session-123',
        rosterId: '',
        memberId: 'member-1',
      })

      // Assert
      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toBe('ID roster obbligatorio')
      }
    })

    it('should return failure if member ID is empty', async () => {
      // Act
      const result = await addToBoardUseCase.execute({
        sessionId: 'session-123',
        rosterId: 'roster-1',
        memberId: '',
      })

      // Assert
      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toBe('ID membro obbligatorio')
      }
    })

    it('should return failure if session not found', async () => {
      // Arrange
      vi.mocked(mockRepository.getSession).mockResolvedValue(null)

      // Act
      const result = await addToBoardUseCase.execute({
        sessionId: 'session-123',
        rosterId: 'roster-1',
        memberId: 'member-1',
      })

      // Assert
      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toBe('Sessione rubata non trovata')
      }
    })

    it('should return failure if not in board selection phase', async () => {
      // Arrange
      vi.mocked(mockRepository.getSession).mockResolvedValue({
        ...mockSession,
        status: 'AUCTION',
      })

      // Act
      const result = await addToBoardUseCase.execute({
        sessionId: 'session-123',
        rosterId: 'roster-1',
        memberId: 'member-1',
      })

      // Assert
      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toContain('Non è possibile aggiungere')
      }
    })

    it('should return failure if member has reached board limit', async () => {
      // Arrange
      vi.mocked(mockRepository.getSession).mockResolvedValue(mockSession)
      vi.mocked(mockRepository.getMemberBoardCount).mockResolvedValue(3)

      // Act
      const result = await addToBoardUseCase.execute({
        sessionId: 'session-123',
        rosterId: 'roster-1',
        memberId: 'member-1',
      })

      // Assert
      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toContain('limite massimo')
      }
    })

    it('should add player to board successfully', async () => {
      // Arrange
      const mockEntry = {
        id: 'entry-1',
        sessionId: 'session-123',
        rosterId: 'roster-1',
        memberId: 'member-1',
        playerId: 'player-1',
        status: 'PENDING' as const,
        createdAt: new Date(),
      }

      vi.mocked(mockRepository.getSession).mockResolvedValue(mockSession)
      vi.mocked(mockRepository.getMemberBoardCount).mockResolvedValue(1)
      vi.mocked(mockRepository.addToBoardAtomic).mockResolvedValue(mockEntry)

      // Act
      const result = await addToBoardUseCase.execute({
        sessionId: 'session-123',
        rosterId: 'roster-1',
        memberId: 'member-1',
      })

      // Assert
      expect(result.isSuccess).toBe(true)
      if (result.isSuccess) {
        expect(result.value.entry).toEqual(mockEntry)
        expect(result.value.memberEntryCount).toBe(2)
      }
    })

    it('should allow adding during SETUP phase', async () => {
      // Arrange
      const mockEntry = {
        id: 'entry-1',
        sessionId: 'session-123',
        rosterId: 'roster-1',
        memberId: 'member-1',
        playerId: 'player-1',
        status: 'PENDING' as const,
        createdAt: new Date(),
      }

      vi.mocked(mockRepository.getSession).mockResolvedValue({
        ...mockSession,
        status: 'SETUP',
      })
      vi.mocked(mockRepository.getMemberBoardCount).mockResolvedValue(0)
      vi.mocked(mockRepository.addToBoardAtomic).mockResolvedValue(mockEntry)

      // Act
      const result = await addToBoardUseCase.execute({
        sessionId: 'session-123',
        rosterId: 'roster-1',
        memberId: 'member-1',
      })

      // Assert
      expect(result.isSuccess).toBe(true)
    })

    it('should return forbidden error if player does not belong to member', async () => {
      // Arrange
      vi.mocked(mockRepository.getSession).mockResolvedValue(mockSession)
      vi.mocked(mockRepository.getMemberBoardCount).mockResolvedValue(0)
      vi.mocked(mockRepository.addToBoardAtomic).mockRejectedValue(
        new Error('Giocatore non appartiene a questo membro')
      )

      // Act
      const result = await addToBoardUseCase.execute({
        sessionId: 'session-123',
        rosterId: 'roster-1',
        memberId: 'member-1',
      })

      // Assert
      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.statusCode).toBe(403)
      }
    })
  })
})
