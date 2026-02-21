/**
 * Get Statistics Use Case Tests - TDD
 *
 * Tests for the get statistics use case following TDD principles.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GetStatisticsUseCase } from '../../application/use-cases/get-statistics.use-case'
import type { IAdminRepository } from '../../domain/repositories/admin.repository.interface'
import type { LeagueStatistics } from '../../domain/entities/audit-log.entity'

describe('GetStatisticsUseCase', () => {
  let getStatisticsUseCase: GetStatisticsUseCase
  let mockAdminRepository: IAdminRepository

  const mockStatistics: LeagueStatistics = {
    league: {
      name: 'Test League',
      status: 'ACTIVE',
      maxParticipants: 10,
      initialBudget: 500,
    },
    memberCount: 8,
    totalPlayersAssigned: 200,
    completedAuctions: 150,
    completedTrades: 25,
    memberStats: [
      {
        username: 'user1',
        teamName: 'Team Alpha',
        budget: 120,
        playerCount: 25,
      },
      {
        username: 'user2',
        teamName: 'Team Beta',
        budget: 100,
        playerCount: 25,
      },
    ],
  }

  beforeEach(() => {
    mockAdminRepository = {
      verifyAdmin: vi.fn(),
      checkMembership: vi.fn(),
      getLeagueStatistics: vi.fn(),
      getSessionStatistics: vi.fn(),
      updateMarketPhase: vi.fn(),
      getSessionWithLeague: vi.fn(),
      importPlayers: vi.fn(),
      isPrizePhaseFinalized: vi.fn(),
    }

    getStatisticsUseCase = new GetStatisticsUseCase(mockAdminRepository)
  })

  describe('execute', () => {
    it('should return failure if leagueId is missing', async () => {
      const result = await getStatisticsUseCase.execute({
        leagueId: '',
        userId: 'user-123',
      })

      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toBe('League ID is required')
      }
    })

    it('should return failure if userId is missing', async () => {
      const result = await getStatisticsUseCase.execute({
        leagueId: 'league-123',
        userId: '',
      })

      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toBe('User ID is required')
      }
    })

    it('should return failure if user is not a member of the league', async () => {
      vi.mocked(mockAdminRepository.checkMembership).mockResolvedValue(null)

      const result = await getStatisticsUseCase.execute({
        leagueId: 'league-123',
        userId: 'user-123',
      })

      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toBe('Non sei membro di questa lega')
      }
    })

    it('should return failure if league is not found', async () => {
      vi.mocked(mockAdminRepository.checkMembership).mockResolvedValue('member-123')
      vi.mocked(mockAdminRepository.getLeagueStatistics).mockResolvedValue(null)

      const result = await getStatisticsUseCase.execute({
        leagueId: 'league-123',
        userId: 'user-123',
      })

      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toBe('Lega non trovata')
      }
    })

    it('should return statistics for a valid member', async () => {
      vi.mocked(mockAdminRepository.checkMembership).mockResolvedValue('member-123')
      vi.mocked(mockAdminRepository.getLeagueStatistics).mockResolvedValue(mockStatistics)

      const result = await getStatisticsUseCase.execute({
        leagueId: 'league-123',
        userId: 'user-123',
      })

      expect(result.isSuccess).toBe(true)
      if (result.isSuccess) {
        expect(result.value.league.name).toBe('Test League')
        expect(result.value.memberCount).toBe(8)
        expect(result.value.totalPlayersAssigned).toBe(200)
        expect(result.value.completedAuctions).toBe(150)
        expect(result.value.completedTrades).toBe(25)
        expect(result.value.memberStats).toHaveLength(2)
      }
    })

    it('should allow non-admin members to view statistics', async () => {
      vi.mocked(mockAdminRepository.checkMembership).mockResolvedValue('member-123')
      vi.mocked(mockAdminRepository.getLeagueStatistics).mockResolvedValue(mockStatistics)

      const result = await getStatisticsUseCase.execute({
        leagueId: 'league-123',
        userId: 'user-123',
      })

      expect(result.isSuccess).toBe(true)
      // Note: verifyAdmin is not called because any member can view statistics
      expect(mockAdminRepository.verifyAdmin).not.toHaveBeenCalled()
    })
  })
})
