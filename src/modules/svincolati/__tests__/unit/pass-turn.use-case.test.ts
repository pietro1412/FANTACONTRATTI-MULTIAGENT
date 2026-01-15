/**
 * Pass Turn Use Case Tests - TDD
 *
 * Tests for the pass turn use case following TDD principles.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PassTurnUseCase } from '../../application/use-cases/pass-turn.use-case'
import type { ISvincolatiRepository } from '../../domain/repositories/svincolati.repository.interface'
import type { SvincolatiSession } from '../../domain/entities/svincolati-session.entity'
import type { SvincolatiTurnOrder } from '../../domain/entities/turn-order.entity'

describe('PassTurnUseCase', () => {
  let useCase: PassTurnUseCase
  let mockRepository: ISvincolatiRepository

  const mockSession: SvincolatiSession = {
    marketSessionId: 'session-123',
    status: 'READY_CHECK',
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

    useCase = new PassTurnUseCase(mockRepository)
  })

  describe('execute', () => {
    it('should return failure if session not found', async () => {
      // Arrange
      vi.mocked(mockRepository.getSession).mockResolvedValue(null)

      // Act
      const result = await useCase.execute({
        sessionId: 'nonexistent',
        memberId: 'member-1'
      })

      // Assert
      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toBe('Sessione non trovata')
      }
    })

    it('should return failure if not in READY_CHECK phase', async () => {
      // Arrange
      vi.mocked(mockRepository.getSession).mockResolvedValue({
        ...mockSession,
        status: 'AUCTION'
      })

      // Act
      const result = await useCase.execute({
        sessionId: 'session-123',
        memberId: 'member-1'
      })

      // Assert
      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toContain('Non puoi passare')
      }
    })

    it('should return failure if not member\'s turn', async () => {
      // Act - member-2 tries to pass when it's member-1's turn
      const result = await useCase.execute({
        sessionId: 'session-123',
        memberId: 'member-2'
      })

      // Assert
      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.statusCode).toBe(403)
      }
    })

    it('should return failure if member already passed', async () => {
      // Arrange
      vi.mocked(mockRepository.getTurnOrder).mockResolvedValue([
        { ...mockTurnOrder[0], hasPassed: true },
        mockTurnOrder[1],
        mockTurnOrder[2],
      ])

      // Act
      const result = await useCase.execute({
        sessionId: 'session-123',
        memberId: 'member-1'
      })

      // Assert
      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toContain('già passato')
      }
    })

    it('should mark member as passed', async () => {
      // Arrange - after marking passed, return updated turn order
      vi.mocked(mockRepository.getTurnOrder)
        .mockResolvedValueOnce(mockTurnOrder) // First call
        .mockResolvedValueOnce([ // After marking passed
          { ...mockTurnOrder[0], hasPassed: true },
          mockTurnOrder[1],
          mockTurnOrder[2],
        ])

      // Act
      await useCase.execute({
        sessionId: 'session-123',
        memberId: 'member-1'
      })

      // Assert
      expect(mockRepository.markPassed).toHaveBeenCalledWith('session-123', 'member-1')
    })

    it('should advance to next member', async () => {
      // Arrange
      vi.mocked(mockRepository.getTurnOrder)
        .mockResolvedValueOnce(mockTurnOrder)
        .mockResolvedValueOnce([
          { ...mockTurnOrder[0], hasPassed: true },
          mockTurnOrder[1],
          mockTurnOrder[2],
        ])

      // Act
      const result = await useCase.execute({
        sessionId: 'session-123',
        memberId: 'member-1'
      })

      // Assert
      expect(result.isSuccess).toBe(true)
      if (result.isSuccess) {
        expect(result.value.nextMemberId).toBe('member-2')
        expect(result.value.nextMemberUsername).toBe('Team B')
        expect(result.value.allPassed).toBe(false)
      }

      expect(mockRepository.updateSession).toHaveBeenCalledWith(
        'session-123',
        { currentNominatorId: 'member-2' }
      )
    })

    it('should complete session when all members have passed', async () => {
      // Arrange - all members have passed after this pass
      vi.mocked(mockRepository.getTurnOrder)
        .mockResolvedValueOnce(mockTurnOrder)
        .mockResolvedValueOnce([
          { ...mockTurnOrder[0], hasPassed: true },
          { ...mockTurnOrder[1], hasPassed: true },
          { ...mockTurnOrder[2], hasPassed: true },
        ])

      // Act
      const result = await useCase.execute({
        sessionId: 'session-123',
        memberId: 'member-1'
      })

      // Assert
      expect(result.isSuccess).toBe(true)
      if (result.isSuccess) {
        expect(result.value.allPassed).toBe(true)
        expect(result.value.nextMemberId).toBeNull()
        expect(result.value.passedCount).toBe(3)
        expect(result.value.totalMembers).toBe(3)
      }

      expect(mockRepository.updateSession).toHaveBeenCalledWith(
        'session-123',
        { status: 'COMPLETED', currentNominatorId: null }
      )
    })

    it('should skip members who have already passed', async () => {
      // Arrange - member-2 already passed
      vi.mocked(mockRepository.getTurnOrder)
        .mockResolvedValueOnce([
          mockTurnOrder[0],
          { ...mockTurnOrder[1], hasPassed: true },
          mockTurnOrder[2],
        ])
        .mockResolvedValueOnce([
          { ...mockTurnOrder[0], hasPassed: true },
          { ...mockTurnOrder[1], hasPassed: true },
          mockTurnOrder[2],
        ])

      vi.mocked(mockRepository.advanceToNextMember).mockResolvedValue(mockTurnOrder[2])

      // Act
      const result = await useCase.execute({
        sessionId: 'session-123',
        memberId: 'member-1'
      })

      // Assert
      expect(result.isSuccess).toBe(true)
      if (result.isSuccess) {
        expect(result.value.nextMemberId).toBe('member-3')
        expect(result.value.passedCount).toBe(2) // member-1 and member-2
      }
    })

    it('should skip members who have finished', async () => {
      // Arrange - member-2 finished
      vi.mocked(mockRepository.getTurnOrder)
        .mockResolvedValueOnce([
          mockTurnOrder[0],
          { ...mockTurnOrder[1], hasFinished: true },
          mockTurnOrder[2],
        ])
        .mockResolvedValueOnce([
          { ...mockTurnOrder[0], hasPassed: true },
          { ...mockTurnOrder[1], hasFinished: true },
          mockTurnOrder[2],
        ])

      vi.mocked(mockRepository.advanceToNextMember).mockResolvedValue(mockTurnOrder[2])

      // Act
      const result = await useCase.execute({
        sessionId: 'session-123',
        memberId: 'member-1'
      })

      // Assert
      expect(result.isSuccess).toBe(true)
      if (result.isSuccess) {
        expect(result.value.nextMemberId).toBe('member-3')
      }
    })

    it('should return pass counts in result', async () => {
      // Arrange
      vi.mocked(mockRepository.getTurnOrder)
        .mockResolvedValueOnce(mockTurnOrder)
        .mockResolvedValueOnce([
          { ...mockTurnOrder[0], hasPassed: true },
          mockTurnOrder[1],
          mockTurnOrder[2],
        ])

      // Act
      const result = await useCase.execute({
        sessionId: 'session-123',
        memberId: 'member-1'
      })

      // Assert
      expect(result.isSuccess).toBe(true)
      if (result.isSuccess) {
        expect(result.value.passedCount).toBe(1)
        expect(result.value.totalMembers).toBe(3)
      }
    })
  })
})
