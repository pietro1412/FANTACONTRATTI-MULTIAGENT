/**
 * Advance Turn Use Case Tests - TDD
 *
 * Tests for the advance turn use case following TDD principles.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AdvanceTurnUseCase } from '../../application/use-cases/advance-turn.use-case'
import type { ISvincolatiRepository } from '../../domain/repositories/svincolati.repository.interface'
import type { SvincolatiSession } from '../../domain/entities/svincolati-session.entity'
import type { SvincolatiTurnOrder } from '../../domain/entities/turn-order.entity'

describe('AdvanceTurnUseCase', () => {
  let useCase: AdvanceTurnUseCase
  let mockRepository: ISvincolatiRepository

  const mockSession: SvincolatiSession = {
    marketSessionId: 'session-123',
    status: 'PENDING_ACK',
    currentNominatorId: 'member-1',
    currentRound: 1,
    totalRounds: 99,
    timerSeconds: 30
  }

  const mockTurnOrder: SvincolatiTurnOrder[] = [
    { id: 'turn-1', sessionId: 'session-123', memberId: 'member-1', orderIndex: 0, hasPassed: false, hasFinished: false },
    { id: 'turn-2', sessionId: 'session-123', memberId: 'member-2', orderIndex: 1, hasPassed: false, hasFinished: false },
    { id: 'turn-3', sessionId: 'session-123', memberId: 'member-3', orderIndex: 2, hasPassed: false, hasFinished: false },
  ]

  const mockMembers = [
    { id: 'member-1', userId: 'user-1', username: 'Team A', currentBudget: 100, isAdmin: true },
    { id: 'member-2', userId: 'user-2', username: 'Team B', currentBudget: 80, isAdmin: false },
    { id: 'member-3', userId: 'user-3', username: 'Team C', currentBudget: 120, isAdmin: false },
  ]

  beforeEach(() => {
    mockRepository = {
      getSession: vi.fn().mockResolvedValue(mockSession),
      getActiveSessionByLeagueId: vi.fn(),
      updateSession: vi.fn(),
      getTurnOrder: vi.fn().mockResolvedValue(mockTurnOrder),
      setTurnOrder: vi.fn(),
      markPassed: vi.fn(),
      resetPasses: vi.fn(),
      markFinished: vi.fn(),
      unmarkFinished: vi.fn(),
      getCurrentTurnMemberId: vi.fn().mockResolvedValue('member-1'),
      advanceToNextMember: vi.fn().mockResolvedValue(mockTurnOrder[1]),
      nominatePlayerAtomic: vi.fn(),
      getNominations: vi.fn().mockResolvedValue([]),
      getPendingNomination: vi.fn().mockResolvedValue(null),
      updateNomination: vi.fn(),
      cancelNomination: vi.fn(),
      getAvailablePlayers: vi.fn().mockResolvedValue([]),
      isPlayerOwned: vi.fn().mockResolvedValue(false),
      isPlayerNominated: vi.fn().mockResolvedValue(false),
      getMemberBudget: vi.fn().mockResolvedValue(100),
      getActiveMembers: vi.fn().mockResolvedValue(mockMembers),
      getReadyMembers: vi.fn().mockResolvedValue([]),
      markReady: vi.fn(),
      clearReadyMarks: vi.fn(),
      areAllReady: vi.fn().mockResolvedValue(false),
    }

    useCase = new AdvanceTurnUseCase(mockRepository)
  })

  describe('execute', () => {
    it('should return failure if session not found', async () => {
      // Arrange
      vi.mocked(mockRepository.getSession).mockResolvedValue(null)

      // Act
      const result = await useCase.execute({
        sessionId: 'nonexistent',
        auctionId: 'auction-123'
      })

      // Assert
      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toBe('Sessione non trovata')
      }
    })

    it('should return failure if not in PENDING_ACK or AUCTION phase', async () => {
      // Arrange
      vi.mocked(mockRepository.getSession).mockResolvedValue({
        ...mockSession,
        status: 'READY_CHECK'
      })

      // Act
      const result = await useCase.execute({
        sessionId: 'session-123',
        auctionId: 'auction-123'
      })

      // Assert
      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toContain('Non è possibile avanzare')
      }
    })

    it('should advance to next member in turn order', async () => {
      // Act
      const result = await useCase.execute({
        sessionId: 'session-123',
        auctionId: 'auction-123'
      })

      // Assert
      expect(result.isSuccess).toBe(true)
      if (result.isSuccess) {
        expect(result.value.nextMemberId).toBe('member-2')
        expect(result.value.nextMemberUsername).toBe('Team B')
        expect(result.value.newRoundStarted).toBe(false)
        expect(result.value.sessionCompleted).toBe(false)
      }

      expect(mockRepository.updateSession).toHaveBeenCalledWith(
        'session-123',
        { status: 'READY_CHECK', currentNominatorId: 'member-2' }
      )
    })

    it('should complete session when all members have finished', async () => {
      // Arrange
      vi.mocked(mockRepository.getTurnOrder).mockResolvedValue([
        { ...mockTurnOrder[0], hasFinished: true },
        { ...mockTurnOrder[1], hasFinished: true },
        { ...mockTurnOrder[2], hasFinished: true },
      ])

      // Act
      const result = await useCase.execute({
        sessionId: 'session-123',
        auctionId: 'auction-123'
      })

      // Assert
      expect(result.isSuccess).toBe(true)
      if (result.isSuccess) {
        expect(result.value.sessionCompleted).toBe(true)
        expect(result.value.nextMemberId).toBeNull()
      }

      expect(mockRepository.updateSession).toHaveBeenCalledWith(
        'session-123',
        { status: 'COMPLETED', currentNominatorId: null }
      )
    })

    it('should start new round when all members have passed', async () => {
      // Arrange
      vi.mocked(mockRepository.getTurnOrder)
        .mockResolvedValueOnce([
          { ...mockTurnOrder[0], hasPassed: true },
          { ...mockTurnOrder[1], hasPassed: true },
          { ...mockTurnOrder[2], hasPassed: true },
        ])
        .mockResolvedValueOnce(mockTurnOrder) // After reset

      vi.mocked(mockRepository.advanceToNextMember).mockResolvedValue(null) // All passed

      // Act
      const result = await useCase.execute({
        sessionId: 'session-123',
        auctionId: 'auction-123'
      })

      // Assert
      expect(result.isSuccess).toBe(true)
      if (result.isSuccess) {
        expect(result.value.newRoundStarted).toBe(true)
        expect(result.value.currentRound).toBe(2)
      }

      expect(mockRepository.resetPasses).toHaveBeenCalledWith('session-123')
    })

    it('should complete session when max rounds reached', async () => {
      // Arrange
      vi.mocked(mockRepository.getSession).mockResolvedValue({
        ...mockSession,
        currentRound: 99,
        totalRounds: 99
      })

      vi.mocked(mockRepository.getTurnOrder).mockResolvedValue([
        { ...mockTurnOrder[0], hasPassed: true },
        { ...mockTurnOrder[1], hasPassed: true },
        { ...mockTurnOrder[2], hasPassed: true },
      ])

      vi.mocked(mockRepository.advanceToNextMember).mockResolvedValue(null)

      // Act
      const result = await useCase.execute({
        sessionId: 'session-123',
        auctionId: 'auction-123'
      })

      // Assert
      expect(result.isSuccess).toBe(true)
      if (result.isSuccess) {
        expect(result.value.sessionCompleted).toBe(true)
      }
    })

    it('should skip members who have passed and find next active', async () => {
      // Arrange
      vi.mocked(mockRepository.getTurnOrder).mockResolvedValue([
        mockTurnOrder[0],
        { ...mockTurnOrder[1], hasPassed: true },
        mockTurnOrder[2],
      ])

      vi.mocked(mockRepository.advanceToNextMember).mockResolvedValue(mockTurnOrder[2])

      // Act
      const result = await useCase.execute({
        sessionId: 'session-123',
        auctionId: 'auction-123'
      })

      // Assert
      expect(result.isSuccess).toBe(true)
      if (result.isSuccess) {
        expect(result.value.nextMemberId).toBe('member-3')
      }
    })

    it('should work in AUCTION phase', async () => {
      // Arrange
      vi.mocked(mockRepository.getSession).mockResolvedValue({
        ...mockSession,
        status: 'AUCTION'
      })

      // Act
      const result = await useCase.execute({
        sessionId: 'session-123',
        auctionId: 'auction-123'
      })

      // Assert
      expect(result.isSuccess).toBe(true)
    })

    it('should return correct round number', async () => {
      // Arrange
      vi.mocked(mockRepository.getSession).mockResolvedValue({
        ...mockSession,
        currentRound: 3
      })

      // Act
      const result = await useCase.execute({
        sessionId: 'session-123',
        auctionId: 'auction-123'
      })

      // Assert
      expect(result.isSuccess).toBe(true)
      if (result.isSuccess) {
        expect(result.value.currentRound).toBe(3)
      }
    })

    it('should handle empty turn order gracefully', async () => {
      // Arrange
      vi.mocked(mockRepository.getTurnOrder).mockResolvedValue([])

      // Act
      const result = await useCase.execute({
        sessionId: 'session-123',
        auctionId: 'auction-123'
      })

      // Assert
      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toContain('Nessun ordine turni')
      }
    })
  })
})
