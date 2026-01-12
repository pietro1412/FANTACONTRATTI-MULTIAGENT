/**
 * Nominate Player Use Case Tests - TDD
 *
 * CRITICAL tests for the nominate player use case.
 * Focus on turn validation and race condition prevention.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NominatePlayerUseCase } from '../../application/use-cases/nominate-player.use-case'
import type { ISvincolatiRepository, Player } from '../../domain/repositories/svincolati.repository.interface'
import type { SvincolatiSession } from '../../domain/entities/svincolati-session.entity'
import type { SvincolatiTurnOrder } from '../../domain/entities/turn-order.entity'
import type { SvincolatiNomination } from '../../domain/entities/nomination.entity'

describe('NominatePlayerUseCase', () => {
  let useCase: NominatePlayerUseCase
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

  const mockPlayer: Player = {
    id: 'player-123',
    name: 'Mario Rossi',
    team: 'Juventus',
    position: 'C',
    quotation: 15,
    isActive: true
  }

  const mockNomination: SvincolatiNomination = {
    id: 'nom-123',
    sessionId: 'session-123',
    playerId: 'player-123',
    nominatorId: 'member-1',
    round: 1,
    status: 'PENDING',
    createdAt: new Date(),
    auctionId: null,
    winnerId: null,
    finalPrice: null
  }

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
      advanceToNextMember: vi.fn(),
      nominatePlayerAtomic: vi.fn().mockResolvedValue({ success: true, nomination: mockNomination }),
      getNominations: vi.fn().mockResolvedValue([]),
      getPendingNomination: vi.fn().mockResolvedValue(null),
      updateNomination: vi.fn(),
      cancelNomination: vi.fn(),
      getAvailablePlayers: vi.fn().mockResolvedValue([mockPlayer]),
      isPlayerOwned: vi.fn().mockResolvedValue(false),
      isPlayerNominated: vi.fn().mockResolvedValue(false),
      getMemberBudget: vi.fn().mockResolvedValue(100),
      getActiveMembers: vi.fn().mockResolvedValue(mockMembers),
      getReadyMembers: vi.fn().mockResolvedValue([]),
      markReady: vi.fn(),
      clearReadyMarks: vi.fn(),
      areAllReady: vi.fn().mockResolvedValue(false),
    }

    useCase = new NominatePlayerUseCase(mockRepository)
  })

  describe('execute', () => {
    it('should return failure if session not found', async () => {
      // Arrange
      vi.mocked(mockRepository.getSession).mockResolvedValue(null)

      // Act
      const result = await useCase.execute({
        sessionId: 'nonexistent',
        nominatorId: 'member-1',
        playerId: 'player-123'
      })

      // Assert
      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toBe('Sessione non trovata')
      }
    })

    it('should return failure if not nominator\'s turn', async () => {
      // Act - member-2 tries to nominate when it's member-1's turn
      const result = await useCase.execute({
        sessionId: 'session-123',
        nominatorId: 'member-2',
        playerId: 'player-123'
      })

      // Assert
      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.statusCode).toBe(403) // ForbiddenError
      }
    })

    it('should return failure if session is in wrong phase', async () => {
      // Arrange - session in AUCTION phase
      vi.mocked(mockRepository.getSession).mockResolvedValue({
        ...mockSession,
        status: 'AUCTION'
      })

      // Act
      const result = await useCase.execute({
        sessionId: 'session-123',
        nominatorId: 'member-1',
        playerId: 'player-123'
      })

      // Assert
      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toContain('Non è il momento')
      }
    })

    it('should return failure if player is already owned', async () => {
      // Arrange
      vi.mocked(mockRepository.getAvailablePlayers).mockResolvedValue([])
      vi.mocked(mockRepository.isPlayerOwned).mockResolvedValue(true)

      // Act
      const result = await useCase.execute({
        sessionId: 'session-123',
        nominatorId: 'member-1',
        playerId: 'player-123'
      })

      // Assert
      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toContain('già in una rosa')
      }
    })

    it('should return failure if player is already nominated', async () => {
      // Arrange
      vi.mocked(mockRepository.getAvailablePlayers).mockResolvedValue([])
      vi.mocked(mockRepository.isPlayerOwned).mockResolvedValue(false)
      vi.mocked(mockRepository.isPlayerNominated).mockResolvedValue(true)

      // Act
      const result = await useCase.execute({
        sessionId: 'session-123',
        nominatorId: 'member-1',
        playerId: 'player-123'
      })

      // Assert
      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toContain('già stato nominato')
      }
    })

    it('should return failure if nominator has insufficient budget', async () => {
      // Arrange
      vi.mocked(mockRepository.getMemberBudget).mockResolvedValue(0)

      // Act
      const result = await useCase.execute({
        sessionId: 'session-123',
        nominatorId: 'member-1',
        playerId: 'player-123'
      })

      // Assert
      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toContain('Budget insufficiente')
      }
    })

    it('should return failure if player not found', async () => {
      // Arrange
      vi.mocked(mockRepository.getAvailablePlayers).mockResolvedValue([])
      vi.mocked(mockRepository.isPlayerOwned).mockResolvedValue(false)
      vi.mocked(mockRepository.isPlayerNominated).mockResolvedValue(false)

      // Act
      const result = await useCase.execute({
        sessionId: 'session-123',
        nominatorId: 'member-1',
        playerId: 'nonexistent-player'
      })

      // Assert
      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toContain('non trovato')
      }
    })

    it('should use atomic transaction for nomination', async () => {
      // Act
      await useCase.execute({
        sessionId: 'session-123',
        nominatorId: 'member-1',
        playerId: 'player-123'
      })

      // Assert
      expect(mockRepository.nominatePlayerAtomic).toHaveBeenCalledWith({
        sessionId: 'session-123',
        playerId: 'player-123',
        nominatorId: 'member-1',
        round: 1
      })
    })

    it('should update session status to NOMINATION on success', async () => {
      // Act
      await useCase.execute({
        sessionId: 'session-123',
        nominatorId: 'member-1',
        playerId: 'player-123'
      })

      // Assert
      expect(mockRepository.updateSession).toHaveBeenCalledWith(
        'session-123',
        { status: 'NOMINATION' }
      )
    })

    it('should clear ready marks on new nomination', async () => {
      // Act
      await useCase.execute({
        sessionId: 'session-123',
        nominatorId: 'member-1',
        playerId: 'player-123'
      })

      // Assert
      expect(mockRepository.clearReadyMarks).toHaveBeenCalledWith('session-123')
    })

    it('should return nomination result with player details', async () => {
      // Act
      const result = await useCase.execute({
        sessionId: 'session-123',
        nominatorId: 'member-1',
        playerId: 'player-123'
      })

      // Assert
      expect(result.isSuccess).toBe(true)
      if (result.isSuccess) {
        expect(result.value.nominationId).toBe('nom-123')
        expect(result.value.player.id).toBe('player-123')
        expect(result.value.player.name).toBe('Mario Rossi')
        expect(result.value.nominatorId).toBe('member-1')
        expect(result.value.nominatorUsername).toBe('Team A')
        expect(result.value.status).toBe('PENDING')
      }
    })

    it('should handle atomic nomination errors correctly', async () => {
      // Arrange
      vi.mocked(mockRepository.nominatePlayerAtomic).mockResolvedValue({
        success: false,
        error: 'PLAYER_ALREADY_OWNED'
      })

      // Act
      const result = await useCase.execute({
        sessionId: 'session-123',
        nominatorId: 'member-1',
        playerId: 'player-123'
      })

      // Assert
      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toContain('già in una rosa')
      }
    })

    it('should allow nomination in READY_CHECK phase', async () => {
      // Arrange - session in READY_CHECK phase
      vi.mocked(mockRepository.getSession).mockResolvedValue({
        ...mockSession,
        status: 'READY_CHECK'
      })

      // Act
      const result = await useCase.execute({
        sessionId: 'session-123',
        nominatorId: 'member-1',
        playerId: 'player-123'
      })

      // Assert
      expect(result.isSuccess).toBe(true)
    })

    it('should allow nomination in NOMINATION phase', async () => {
      // Arrange - session in NOMINATION phase (for changing nomination)
      vi.mocked(mockRepository.getSession).mockResolvedValue({
        ...mockSession,
        status: 'NOMINATION'
      })

      // Act
      const result = await useCase.execute({
        sessionId: 'session-123',
        nominatorId: 'member-1',
        playerId: 'player-123'
      })

      // Assert
      expect(result.isSuccess).toBe(true)
    })

    it('should not allow nomination in COMPLETED phase', async () => {
      // Arrange
      vi.mocked(mockRepository.getSession).mockResolvedValue({
        ...mockSession,
        status: 'COMPLETED'
      })

      // Act
      const result = await useCase.execute({
        sessionId: 'session-123',
        nominatorId: 'member-1',
        playerId: 'player-123'
      })

      // Assert
      expect(result.isFailure).toBe(true)
    })
  })
})
