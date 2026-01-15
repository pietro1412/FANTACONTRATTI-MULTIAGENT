/**
 * SetupRubata Use Case Tests - TDD
 *
 * Tests for the setup rubata use case following TDD principles.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SetupRubataUseCase } from '../../application/use-cases/setup-rubata.use-case'
import type { IRubataRepository } from '../../domain/repositories/rubata.repository.interface'
import type { EventBus } from '@/shared/infrastructure/events'
import { DomainEventTypes } from '@/shared/infrastructure/events'

describe('SetupRubataUseCase', () => {
  let setupRubataUseCase: SetupRubataUseCase
  let mockRepository: IRubataRepository
  let mockEventBus: EventBus

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

    setupRubataUseCase = new SetupRubataUseCase(mockRepository, mockEventBus)
  })

  describe('execute', () => {
    it('should return failure if session ID is empty', async () => {
      // Act
      const result = await setupRubataUseCase.execute({ sessionId: '' })

      // Assert
      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toBe('ID sessione obbligatorio')
      }
    })

    it('should return failure if session already has rubata setup', async () => {
      // Arrange
      vi.mocked(mockRepository.getSession).mockResolvedValue({
        marketSessionId: 'session-123',
        status: 'SETUP',
        currentPhase: 'WAITING_READY',
        boardSetupDeadline: null,
        auctionStartedAt: null,
      })

      // Act
      const result = await setupRubataUseCase.execute({ sessionId: 'session-123' })

      // Assert
      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toBe('Sessione rubata già inizializzata')
      }
    })

    it('should return failure if no members found', async () => {
      // Arrange
      vi.mocked(mockRepository.getSession).mockResolvedValue(null)
      vi.mocked(mockRepository.getSessionMembers).mockResolvedValue([])

      // Act
      const result = await setupRubataUseCase.execute({ sessionId: 'session-123' })

      // Assert
      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toBe('Nessun membro trovato nella sessione')
      }
    })

    it('should setup rubata session successfully', async () => {
      // Arrange
      const memberIds = ['member-1', 'member-2', 'member-3']
      vi.mocked(mockRepository.getSession).mockResolvedValue(null)
      vi.mocked(mockRepository.getSessionMembers).mockResolvedValue(memberIds)

      // Act
      const result = await setupRubataUseCase.execute({ sessionId: 'session-123' })

      // Assert
      expect(result.isSuccess).toBe(true)
      if (result.isSuccess) {
        expect(result.value.session.marketSessionId).toBe('session-123')
        expect(result.value.session.status).toBe('SETUP')
        expect(result.value.session.currentPhase).toBe('WAITING_READY')
        expect(result.value.memberCount).toBe(3)
      }
    })

    it('should initialize ready statuses for all members', async () => {
      // Arrange
      const memberIds = ['member-1', 'member-2', 'member-3']
      vi.mocked(mockRepository.getSession).mockResolvedValue(null)
      vi.mocked(mockRepository.getSessionMembers).mockResolvedValue(memberIds)

      // Act
      await setupRubataUseCase.execute({ sessionId: 'session-123' })

      // Assert
      expect(mockRepository.initializeReadyStatuses).toHaveBeenCalledWith(
        'session-123',
        memberIds
      )
    })

    it('should publish RubataStarted event on success', async () => {
      // Arrange
      const memberIds = ['member-1', 'member-2']
      vi.mocked(mockRepository.getSession).mockResolvedValue(null)
      vi.mocked(mockRepository.getSessionMembers).mockResolvedValue(memberIds)

      // Act
      await setupRubataUseCase.execute({ sessionId: 'session-123' })

      // Assert
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        DomainEventTypes.RUBATA_STARTED,
        { sessionId: 'session-123' }
      )
    })

    it('should update session status and phase', async () => {
      // Arrange
      const memberIds = ['member-1']
      vi.mocked(mockRepository.getSession).mockResolvedValue(null)
      vi.mocked(mockRepository.getSessionMembers).mockResolvedValue(memberIds)

      // Act
      await setupRubataUseCase.execute({ sessionId: 'session-123' })

      // Assert
      expect(mockRepository.updateSessionStatus).toHaveBeenCalledWith(
        'session-123',
        'SETUP'
      )
      expect(mockRepository.updateSessionPhase).toHaveBeenCalledWith(
        'session-123',
        'WAITING_READY'
      )
    })
  })
})
