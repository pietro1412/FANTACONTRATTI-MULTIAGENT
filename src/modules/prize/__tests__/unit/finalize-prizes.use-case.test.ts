/**
 * Finalize Prizes Use Case Tests
 * TDD: Tests written first to define expected behavior
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { FinalizePrizesUseCase } from '../../application/use-cases/finalize-prizes.use-case'
import type { IPrizeRepository, MemberInfo, SessionInfo } from '../../domain/repositories/prize.repository.interface'
import type { PrizePhaseConfig, SessionPrize } from '../../domain/entities/prize.entity'

describe('FinalizePrizesUseCase', () => {
  let useCase: FinalizePrizesUseCase
  let mockRepository: IPrizeRepository

  const mockSession: SessionInfo = {
    id: 'session-1',
    leagueId: 'league-1',
    status: 'ACTIVE',
  }

  const mockAdminMember: MemberInfo = {
    id: 'admin-member-1',
    teamName: 'Admin Team',
    username: 'admin',
    currentBudget: 500,
    role: 'ADMIN',
  }

  const mockRegularMember: MemberInfo = {
    id: 'regular-member-1',
    teamName: 'Regular Team',
    username: 'regular',
    currentBudget: 500,
    role: 'MEMBER',
  }

  const mockMembers: MemberInfo[] = [mockAdminMember, mockRegularMember]

  const mockConfig: PrizePhaseConfig = {
    id: 'config-1',
    sessionId: 'session-1',
    status: 'IN_PROGRESS',
    totalBudget: 1000,
    remainingBudget: 600,
    baseReincrement: 100,
    startedAt: new Date(),
    finalizedAt: null,
  }

  const mockFinalizedConfig: PrizePhaseConfig = {
    ...mockConfig,
    status: 'FINALIZED',
    finalizedAt: new Date(),
  }

  const mockPrizes: SessionPrize[] = [
    {
      id: 'prize-1',
      categoryId: 'category-1',
      memberId: 'admin-member-1',
      amount: 50,
      assignedAt: new Date(),
      assignedBy: 'admin-user-1',
    },
    {
      id: 'prize-2',
      categoryId: 'category-1',
      memberId: 'regular-member-1',
      amount: 50,
      assignedAt: new Date(),
      assignedBy: 'admin-user-1',
    },
    {
      id: 'prize-3',
      categoryId: 'category-2',
      memberId: 'regular-member-1',
      amount: 75,
      assignedAt: new Date(),
      assignedBy: 'admin-user-1',
    },
  ]

  beforeEach(() => {
    mockRepository = {
      getConfig: vi.fn(),
      createConfig: vi.fn(),
      updateConfig: vi.fn(),
      getCategories: vi.fn(),
      getCategoriesForSession: vi.fn(),
      createCategory: vi.fn(),
      deleteCategory: vi.fn(),
      getCategoryById: vi.fn(),
      getPrizes: vi.fn(),
      getPrizesByCategory: vi.fn(),
      assignPrize: vi.fn(),
      unassignPrize: vi.fn(),
      getPrize: vi.fn(),
      getSession: vi.fn(),
      getActiveMembers: vi.fn(),
      getMemberByUserId: vi.fn(),
      updateMemberBudget: vi.fn(),
      finalizeSession: vi.fn(),
      areAllRequiredCategoriesAssigned: vi.fn(),
    }

    useCase = new FinalizePrizesUseCase(mockRepository)
  })

  describe('execute', () => {
    it('should finalize prizes successfully for admin', async () => {
      vi.mocked(mockRepository.getSession).mockResolvedValue(mockSession)
      vi.mocked(mockRepository.getMemberByUserId).mockResolvedValue(mockAdminMember)
      vi.mocked(mockRepository.getConfig).mockResolvedValue(mockConfig)
      vi.mocked(mockRepository.getActiveMembers).mockResolvedValue(mockMembers)
      vi.mocked(mockRepository.getPrizes).mockResolvedValue(mockPrizes)
      vi.mocked(mockRepository.updateMemberBudget).mockImplementation(async (memberId, amount) => {
        const member = mockMembers.find(m => m.id === memberId)
        return (member?.currentBudget ?? 0) + amount
      })
      vi.mocked(mockRepository.updateConfig).mockResolvedValue(undefined)

      const result = await useCase.execute({
        sessionId: 'session-1',
        adminUserId: 'admin-user-1',
      })

      expect(result.isSuccess).toBe(true)
      if (result.isSuccess) {
        expect(result.value.sessionId).toBe('session-1')
        expect(result.value.finalizedAt).toBeInstanceOf(Date)
        expect(result.value.membersUpdated).toHaveLength(2)

        // Admin: base 100 + category-1 prize 50 = 150
        const adminUpdate = result.value.membersUpdated.find(m => m.memberId === 'admin-member-1')
        expect(adminUpdate?.totalPrizeReceived).toBe(150)
        expect(adminUpdate?.newBudget).toBe(650) // 500 + 150

        // Regular: base 100 + category-1 prize 50 + category-2 prize 75 = 225
        const regularUpdate = result.value.membersUpdated.find(m => m.memberId === 'regular-member-1')
        expect(regularUpdate?.totalPrizeReceived).toBe(225)
        expect(regularUpdate?.newBudget).toBe(725) // 500 + 225
      }
    })

    it('should update config to FINALIZED status', async () => {
      vi.mocked(mockRepository.getSession).mockResolvedValue(mockSession)
      vi.mocked(mockRepository.getMemberByUserId).mockResolvedValue(mockAdminMember)
      vi.mocked(mockRepository.getConfig).mockResolvedValue(mockConfig)
      vi.mocked(mockRepository.getActiveMembers).mockResolvedValue(mockMembers)
      vi.mocked(mockRepository.getPrizes).mockResolvedValue(mockPrizes)
      vi.mocked(mockRepository.updateMemberBudget).mockResolvedValue(650)
      vi.mocked(mockRepository.updateConfig).mockResolvedValue(undefined)

      await useCase.execute({
        sessionId: 'session-1',
        adminUserId: 'admin-user-1',
      })

      expect(mockRepository.updateConfig).toHaveBeenCalledWith(
        'session-1',
        expect.objectContaining({
          status: 'FINALIZED',
          finalizedAt: expect.any(Date),
        })
      )
    })

    it('should fail when session not found', async () => {
      vi.mocked(mockRepository.getSession).mockResolvedValue(null)

      const result = await useCase.execute({
        sessionId: 'non-existent',
        adminUserId: 'admin-user-1',
      })

      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toBe('Sessione non trovata')
      }
    })

    it('should fail when user is not admin', async () => {
      vi.mocked(mockRepository.getSession).mockResolvedValue(mockSession)
      vi.mocked(mockRepository.getMemberByUserId).mockResolvedValue(mockRegularMember)

      const result = await useCase.execute({
        sessionId: 'session-1',
        adminUserId: 'regular-user-1',
      })

      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toBe('Non autorizzato')
      }
    })

    it('should fail when prize phase not initialized', async () => {
      vi.mocked(mockRepository.getSession).mockResolvedValue(mockSession)
      vi.mocked(mockRepository.getMemberByUserId).mockResolvedValue(mockAdminMember)
      vi.mocked(mockRepository.getConfig).mockResolvedValue(null)

      const result = await useCase.execute({
        sessionId: 'session-1',
        adminUserId: 'admin-user-1',
      })

      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toBe('Fase premi non inizializzata')
      }
    })

    it('should fail when prize phase already finalized', async () => {
      vi.mocked(mockRepository.getSession).mockResolvedValue(mockSession)
      vi.mocked(mockRepository.getMemberByUserId).mockResolvedValue(mockAdminMember)
      vi.mocked(mockRepository.getConfig).mockResolvedValue(mockFinalizedConfig)

      const result = await useCase.execute({
        sessionId: 'session-1',
        adminUserId: 'admin-user-1',
      })

      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toBe('La fase premi è già stata finalizzata')
      }
    })

    it('should apply base reincrement to members without prizes', async () => {
      vi.mocked(mockRepository.getSession).mockResolvedValue(mockSession)
      vi.mocked(mockRepository.getMemberByUserId).mockResolvedValue(mockAdminMember)
      vi.mocked(mockRepository.getConfig).mockResolvedValue(mockConfig)
      vi.mocked(mockRepository.getActiveMembers).mockResolvedValue(mockMembers)
      vi.mocked(mockRepository.getPrizes).mockResolvedValue([]) // No prizes assigned
      vi.mocked(mockRepository.updateMemberBudget).mockImplementation(async (memberId, amount) => {
        const member = mockMembers.find(m => m.id === memberId)
        return (member?.currentBudget ?? 0) + amount
      })
      vi.mocked(mockRepository.updateConfig).mockResolvedValue(undefined)

      const result = await useCase.execute({
        sessionId: 'session-1',
        adminUserId: 'admin-user-1',
      })

      expect(result.isSuccess).toBe(true)
      if (result.isSuccess) {
        // All members should get base reincrement (100)
        for (const update of result.value.membersUpdated) {
          expect(update.totalPrizeReceived).toBe(100)
          expect(update.newBudget).toBe(600) // 500 + 100
        }
      }
    })

    it('should call updateMemberBudget for each member', async () => {
      vi.mocked(mockRepository.getSession).mockResolvedValue(mockSession)
      vi.mocked(mockRepository.getMemberByUserId).mockResolvedValue(mockAdminMember)
      vi.mocked(mockRepository.getConfig).mockResolvedValue(mockConfig)
      vi.mocked(mockRepository.getActiveMembers).mockResolvedValue(mockMembers)
      vi.mocked(mockRepository.getPrizes).mockResolvedValue(mockPrizes)
      vi.mocked(mockRepository.updateMemberBudget).mockResolvedValue(650)
      vi.mocked(mockRepository.updateConfig).mockResolvedValue(undefined)

      await useCase.execute({
        sessionId: 'session-1',
        adminUserId: 'admin-user-1',
      })

      expect(mockRepository.updateMemberBudget).toHaveBeenCalledTimes(2)
      expect(mockRepository.updateMemberBudget).toHaveBeenCalledWith('admin-member-1', 150)
      expect(mockRepository.updateMemberBudget).toHaveBeenCalledWith('regular-member-1', 225)
    })

    it('should handle repository errors gracefully', async () => {
      vi.mocked(mockRepository.getSession).mockRejectedValue(new Error('Database error'))

      const result = await useCase.execute({
        sessionId: 'session-1',
        adminUserId: 'admin-user-1',
      })

      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toContain('Database error')
      }
    })
  })
})
