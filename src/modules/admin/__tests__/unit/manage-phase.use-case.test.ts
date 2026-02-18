/**
 * Manage Phase Use Case Tests - TDD
 *
 * Tests for the manage phase use case following TDD principles.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ManagePhaseUseCase } from '../../application/use-cases/manage-phase.use-case'
import type { IAdminRepository, IAuditLogRepository } from '../../domain/repositories/admin.repository.interface'
import type { MarketPhase } from '../../domain/entities/audit-log.entity'

describe('ManagePhaseUseCase', () => {
  let managePhaseUseCase: ManagePhaseUseCase
  let mockAdminRepository: IAdminRepository
  let mockAuditLogRepository: IAuditLogRepository

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

    mockAuditLogRepository = {
      create: vi.fn(),
      findMany: vi.fn(),
      findById: vi.fn(),
    }

    managePhaseUseCase = new ManagePhaseUseCase(mockAdminRepository, mockAuditLogRepository)
  })

  describe('execute', () => {
    it('should return failure if sessionId is missing', async () => {
      const result = await managePhaseUseCase.execute({
        sessionId: '',
        adminUserId: 'admin-123',
        newPhase: 'RUBATA',
      })

      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toBe('Session ID is required')
      }
    })

    it('should return failure if adminUserId is missing', async () => {
      const result = await managePhaseUseCase.execute({
        sessionId: 'session-123',
        adminUserId: '',
        newPhase: 'RUBATA',
      })

      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toBe('Admin user ID is required')
      }
    })

    it('should return failure if newPhase is missing', async () => {
      const result = await managePhaseUseCase.execute({
        sessionId: 'session-123',
        adminUserId: 'admin-123',
        newPhase: '' as unknown as MarketPhase,
      })

      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toBe('New phase is required')
      }
    })

    it('should return failure if phase is invalid', async () => {
      const result = await managePhaseUseCase.execute({
        sessionId: 'session-123',
        adminUserId: 'admin-123',
        newPhase: 'INVALID_PHASE' as unknown as MarketPhase,
      })

      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toContain('Invalid phase')
      }
    })

    it('should return failure if session is not found', async () => {
      vi.mocked(mockAdminRepository.getSessionWithLeague).mockResolvedValue(null)

      const result = await managePhaseUseCase.execute({
        sessionId: 'invalid-session',
        adminUserId: 'admin-123',
        newPhase: 'RUBATA',
      })

      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toBe('Sessione non trovata')
      }
    })

    it('should return failure if user is not an admin', async () => {
      vi.mocked(mockAdminRepository.getSessionWithLeague).mockResolvedValue({
        id: 'session-123',
        leagueId: 'league-456',
        status: 'ACTIVE',
        currentPhase: null,
      })
      vi.mocked(mockAdminRepository.verifyAdmin).mockResolvedValue({
        isAdmin: false,
        memberId: null,
      })

      const result = await managePhaseUseCase.execute({
        sessionId: 'session-123',
        adminUserId: 'user-123',
        newPhase: 'RUBATA',
      })

      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toBe('Non autorizzato. Solo gli admin possono gestire le fasi.')
      }
    })

    it('should return failure if session is not active', async () => {
      vi.mocked(mockAdminRepository.getSessionWithLeague).mockResolvedValue({
        id: 'session-123',
        leagueId: 'league-456',
        status: 'COMPLETED',
        currentPhase: null,
      })
      vi.mocked(mockAdminRepository.verifyAdmin).mockResolvedValue({
        isAdmin: true,
        memberId: 'member-123',
      })

      const result = await managePhaseUseCase.execute({
        sessionId: 'session-123',
        adminUserId: 'admin-123',
        newPhase: 'RUBATA',
      })

      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toBe('La sessione deve essere attiva per cambiare fase')
      }
    })

    it('should successfully change phase', async () => {
      vi.mocked(mockAdminRepository.getSessionWithLeague).mockResolvedValue({
        id: 'session-123',
        leagueId: 'league-456',
        status: 'ACTIVE',
        currentPhase: null,
      })
      vi.mocked(mockAdminRepository.verifyAdmin).mockResolvedValue({
        isAdmin: true,
        memberId: 'member-123',
      })
      vi.mocked(mockAdminRepository.getSessionStatistics).mockResolvedValue({
        session: {
          id: 'session-123',
          type: 'MERCATO_RICORRENTE',
          status: 'ACTIVE',
          currentPhase: 'CONTRATTI',
        },
        totalAuctions: 50,
        completedAuctions: 45,
        activeAuctions: 5,
        totalBids: 200,
        averageBidCount: 4,
      })
      vi.mocked(mockAdminRepository.updateMarketPhase).mockResolvedValue(true)

      const result = await managePhaseUseCase.execute({
        sessionId: 'session-123',
        adminUserId: 'admin-123',
        newPhase: 'RUBATA',
      })

      expect(result.isSuccess).toBe(true)
      if (result.isSuccess) {
        expect(result.value.sessionId).toBe('session-123')
        expect(result.value.previousPhase).toBe('CONTRATTI')
        expect(result.value.newPhase).toBe('RUBATA')
        expect(result.value.updatedAt).toBeInstanceOf(Date)
      }
    })

    it('should log the phase change action', async () => {
      vi.mocked(mockAdminRepository.getSessionWithLeague).mockResolvedValue({
        id: 'session-123',
        leagueId: 'league-456',
        status: 'ACTIVE',
        currentPhase: null,
      })
      vi.mocked(mockAdminRepository.verifyAdmin).mockResolvedValue({
        isAdmin: true,
        memberId: 'member-123',
      })
      vi.mocked(mockAdminRepository.getSessionStatistics).mockResolvedValue({
        session: {
          id: 'session-123',
          type: 'MERCATO_RICORRENTE',
          status: 'ACTIVE',
          currentPhase: 'CONTRATTI',
        },
        totalAuctions: 50,
        completedAuctions: 45,
        activeAuctions: 5,
        totalBids: 200,
        averageBidCount: 4,
      })
      vi.mocked(mockAdminRepository.updateMarketPhase).mockResolvedValue(true)

      await managePhaseUseCase.execute({
        sessionId: 'session-123',
        adminUserId: 'admin-123',
        newPhase: 'RUBATA',
      })

      expect(mockAuditLogRepository.create).toHaveBeenCalledWith({
        userId: 'admin-123',
        leagueId: 'league-456',
        action: 'PHASE_CHANGE',
        entityType: 'MarketSession',
        entityId: 'session-123',
        oldValues: { phase: 'CONTRATTI' },
        newValues: { phase: 'RUBATA' },
      })
    })

    it('should return failure if update fails', async () => {
      vi.mocked(mockAdminRepository.getSessionWithLeague).mockResolvedValue({
        id: 'session-123',
        leagueId: 'league-456',
        status: 'ACTIVE',
        currentPhase: null,
      })
      vi.mocked(mockAdminRepository.verifyAdmin).mockResolvedValue({
        isAdmin: true,
        memberId: 'member-123',
      })
      vi.mocked(mockAdminRepository.getSessionStatistics).mockResolvedValue(null)
      vi.mocked(mockAdminRepository.updateMarketPhase).mockResolvedValue(false)

      const result = await managePhaseUseCase.execute({
        sessionId: 'session-123',
        adminUserId: 'admin-123',
        newPhase: 'RUBATA',
      })

      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toBe('Errore durante il cambio di fase')
      }
    })
  })
})
