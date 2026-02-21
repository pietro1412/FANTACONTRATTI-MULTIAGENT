/**
 * Setup Svincolati Use Case Tests - TDD
 *
 * Tests for the setup svincolati use case following TDD principles.
 * These tests define the expected behavior.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SetupSvincolatiUseCase } from '../../application/use-cases/setup-svincolati.use-case'
import type { ISvincolatiRepository } from '../../domain/repositories/svincolati.repository.interface'
import type { SvincolatiSession } from '../../domain/entities/svincolati-session.entity'

describe('SetupSvincolatiUseCase', () => {
  let useCase: SetupSvincolatiUseCase
  let mockRepository: ISvincolatiRepository

  const mockSession: SvincolatiSession = {
    marketSessionId: 'session-123',
    status: 'SETUP',
    currentNominatorId: null,
    currentRound: 0,
    totalRounds: 99,
    timerSeconds: 30
  }

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
      getTurnOrder: vi.fn().mockResolvedValue([]),
      setTurnOrder: vi.fn(),
      markPassed: vi.fn(),
      resetPasses: vi.fn(),
      markFinished: vi.fn(),
      unmarkFinished: vi.fn(),
      getCurrentTurnMemberId: vi.fn(),
      advanceToNextMember: vi.fn(),
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

    useCase = new SetupSvincolatiUseCase(mockRepository)
  })

  describe('execute', () => {
    it('should return failure if session not found', async () => {
      // Arrange
      vi.mocked(mockRepository.getSession).mockResolvedValue(null)

      // Act
      const result = await useCase.execute({ sessionId: 'nonexistent' })

      // Assert
      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toBe('Sessione non trovata')
      }
    })

    it('should return failure if session is not in SETUP status', async () => {
      // Arrange
      vi.mocked(mockRepository.getSession).mockResolvedValue({
        ...mockSession,
        status: 'READY_CHECK'
      })

      // Act
      const result = await useCase.execute({ sessionId: 'session-123' })

      // Assert
      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toContain('già stata configurata')
      }
    })

    it('should return failure if less than 2 active members', async () => {
      // Arrange
      vi.mocked(mockRepository.getActiveMembers).mockResolvedValue([mockMembers[0]!])

      // Act
      const result = await useCase.execute({ sessionId: 'session-123' })

      // Assert
      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toContain('almeno 2 membri')
      }
    })

    it('should calculate turn order by budget (lowest first)', async () => {
      // Act
      const result = await useCase.execute({ sessionId: 'session-123' })

      // Assert
      expect(result.isSuccess).toBe(true)
      if (result.isSuccess) {
        // Budget order: member-2 (80) < member-1 (100) < member-3 (120)
        expect(result.value.turnOrder[0]!.memberId).toBe('member-2')
        expect(result.value.turnOrder[1]!.memberId).toBe('member-1')
        expect(result.value.turnOrder[2]!.memberId).toBe('member-3')
        expect(result.value.firstNominatorId).toBe('member-2')
      }

      expect(mockRepository.setTurnOrder).toHaveBeenCalledWith(
        'session-123',
        ['member-2', 'member-1', 'member-3']
      )
    })

    it('should use custom turn order if provided', async () => {
      // Arrange
      const customOrder = ['member-3', 'member-1', 'member-2']

      // Act
      const result = await useCase.execute({
        sessionId: 'session-123',
        customTurnOrder: customOrder
      })

      // Assert
      expect(result.isSuccess).toBe(true)
      if (result.isSuccess) {
        expect(result.value.turnOrder[0]!.memberId).toBe('member-3')
        expect(result.value.firstNominatorId).toBe('member-3')
      }

      expect(mockRepository.setTurnOrder).toHaveBeenCalledWith(
        'session-123',
        customOrder
      )
    })

    it('should return failure if custom turn order contains invalid member IDs', async () => {
      // Act
      const result = await useCase.execute({
        sessionId: 'session-123',
        customTurnOrder: ['member-1', 'invalid-id', 'member-3']
      })

      // Assert
      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toContain('non sono validi')
      }
    })

    it('should return failure if custom turn order does not include all members', async () => {
      // Act
      const result = await useCase.execute({
        sessionId: 'session-123',
        customTurnOrder: ['member-1', 'member-2'] // Missing member-3
      })

      // Assert
      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toContain('tutti i membri')
      }
    })

    it('should update session to READY_CHECK status', async () => {
      // Act
      await useCase.execute({ sessionId: 'session-123' })

      // Assert
      expect(mockRepository.updateSession).toHaveBeenCalledWith(
        'session-123',
        expect.objectContaining({
          status: 'READY_CHECK',
          currentRound: 1
        })
      )
    })

    it('should use custom timer seconds if provided', async () => {
      // Act
      const result = await useCase.execute({
        sessionId: 'session-123',
        timerSeconds: 45
      })

      // Assert
      expect(result.isSuccess).toBe(true)
      if (result.isSuccess) {
        expect(result.value.timerSeconds).toBe(45)
      }

      expect(mockRepository.updateSession).toHaveBeenCalledWith(
        'session-123',
        expect.objectContaining({
          timerSeconds: 45
        })
      )
    })

    it('should use default timer seconds if not provided', async () => {
      // Act
      const result = await useCase.execute({ sessionId: 'session-123' })

      // Assert
      expect(result.isSuccess).toBe(true)
      if (result.isSuccess) {
        expect(result.value.timerSeconds).toBe(30) // DEFAULT_SVINCOLATI_TIMER_SECONDS
      }
    })

    it('should return complete setup result with all details', async () => {
      // Act
      const result = await useCase.execute({ sessionId: 'session-123' })

      // Assert
      expect(result.isSuccess).toBe(true)
      if (result.isSuccess) {
        expect(result.value.sessionId).toBe('session-123')
        expect(result.value.turnOrder).toHaveLength(3)
        expect(result.value.firstNominatorId).toBeDefined()
        expect(result.value.firstNominatorUsername).toBeDefined()
        expect(result.value.timerSeconds).toBeDefined()

        // Check turn order structure
        result.value.turnOrder.forEach((member, index) => {
          expect(member.memberId).toBeDefined()
          expect(member.username).toBeDefined()
          expect(member.budget).toBeDefined()
          expect(member.orderIndex).toBe(index)
          expect(member.hasPassed).toBe(false)
          expect(member.hasFinished).toBe(false)
        })
      }
    })
  })
})
