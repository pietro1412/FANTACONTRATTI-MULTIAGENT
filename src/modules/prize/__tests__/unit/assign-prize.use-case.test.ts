/**
 * Assign Prize Use Case Tests
 * TDD: Tests written first to define expected behavior
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AssignPrizeUseCase } from '../../application/use-cases/assign-prize.use-case'
import type { IPrizeRepository, MemberInfo, SessionInfo } from '../../domain/repositories/prize.repository.interface'
import type { PrizePhaseConfig, PrizeCategory, SessionPrize } from '../../domain/entities/prize.entity'

describe('AssignPrizeUseCase', () => {
  let useCase: AssignPrizeUseCase
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
    remainingBudget: 800,
    baseReincrement: 100,
    startedAt: new Date(),
    finalizedAt: null,
  }

  const mockFinalizedConfig: PrizePhaseConfig = {
    ...mockConfig,
    status: 'FINALIZED',
    finalizedAt: new Date(),
  }

  const mockCategory: PrizeCategory = {
    id: 'category-1',
    name: 'Capocannoniere',
    description: 'Best scorer',
    defaultAmount: 50,
    isCustom: true,
  }

  const mockPrize: SessionPrize = {
    id: 'prize-1',
    categoryId: 'category-1',
    memberId: 'regular-member-1',
    amount: 75,
    assignedAt: new Date(),
    assignedBy: 'admin-user-1',
  }

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

    useCase = new AssignPrizeUseCase(mockRepository)
  })

  describe('execute', () => {
    it('should assign prize successfully for admin', async () => {
      vi.mocked(mockRepository.getSession).mockResolvedValue(mockSession)
      vi.mocked(mockRepository.getMemberByUserId).mockResolvedValue(mockAdminMember)
      vi.mocked(mockRepository.getConfig).mockResolvedValue(mockConfig)
      vi.mocked(mockRepository.getCategoryById).mockResolvedValue(mockCategory)
      vi.mocked(mockRepository.getActiveMembers).mockResolvedValue(mockMembers)
      vi.mocked(mockRepository.assignPrize).mockResolvedValue(mockPrize)

      const result = await useCase.execute({
        sessionId: 'session-1',
        categoryId: 'category-1',
        memberId: 'regular-member-1',
        amount: 75,
        adminUserId: 'admin-user-1',
      })

      expect(result.isSuccess).toBe(true)
      if (result.isSuccess) {
        expect(result.value.prizeId).toBe('prize-1')
        expect(result.value.categoryName).toBe('Capocannoniere')
        expect(result.value.teamName).toBe('Regular Team')
        expect(result.value.amount).toBe(75)
      }
    })

    it('should fail when session not found', async () => {
      vi.mocked(mockRepository.getSession).mockResolvedValue(null)

      const result = await useCase.execute({
        sessionId: 'non-existent',
        categoryId: 'category-1',
        memberId: 'regular-member-1',
        amount: 75,
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
        categoryId: 'category-1',
        memberId: 'regular-member-1',
        amount: 75,
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
        categoryId: 'category-1',
        memberId: 'regular-member-1',
        amount: 75,
        adminUserId: 'admin-user-1',
      })

      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toBe('Fase premi non inizializzata')
      }
    })

    it('should fail when prize phase is finalized', async () => {
      vi.mocked(mockRepository.getSession).mockResolvedValue(mockSession)
      vi.mocked(mockRepository.getMemberByUserId).mockResolvedValue(mockAdminMember)
      vi.mocked(mockRepository.getConfig).mockResolvedValue(mockFinalizedConfig)

      const result = await useCase.execute({
        sessionId: 'session-1',
        categoryId: 'category-1',
        memberId: 'regular-member-1',
        amount: 75,
        adminUserId: 'admin-user-1',
      })

      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toBe('La fase premi è già stata finalizzata')
      }
    })

    it('should fail when amount is negative', async () => {
      vi.mocked(mockRepository.getSession).mockResolvedValue(mockSession)
      vi.mocked(mockRepository.getMemberByUserId).mockResolvedValue(mockAdminMember)
      vi.mocked(mockRepository.getConfig).mockResolvedValue(mockConfig)

      const result = await useCase.execute({
        sessionId: 'session-1',
        categoryId: 'category-1',
        memberId: 'regular-member-1',
        amount: -10,
        adminUserId: 'admin-user-1',
      })

      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toBe("L'importo deve essere un numero intero >= 0")
      }
    })

    it('should fail when amount is not an integer', async () => {
      vi.mocked(mockRepository.getSession).mockResolvedValue(mockSession)
      vi.mocked(mockRepository.getMemberByUserId).mockResolvedValue(mockAdminMember)
      vi.mocked(mockRepository.getConfig).mockResolvedValue(mockConfig)

      const result = await useCase.execute({
        sessionId: 'session-1',
        categoryId: 'category-1',
        memberId: 'regular-member-1',
        amount: 75.5,
        adminUserId: 'admin-user-1',
      })

      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toBe("L'importo deve essere un numero intero >= 0")
      }
    })

    it('should fail when category not found', async () => {
      vi.mocked(mockRepository.getSession).mockResolvedValue(mockSession)
      vi.mocked(mockRepository.getMemberByUserId).mockResolvedValue(mockAdminMember)
      vi.mocked(mockRepository.getConfig).mockResolvedValue(mockConfig)
      vi.mocked(mockRepository.getCategoryById).mockResolvedValue(null)

      const result = await useCase.execute({
        sessionId: 'session-1',
        categoryId: 'non-existent',
        memberId: 'regular-member-1',
        amount: 75,
        adminUserId: 'admin-user-1',
      })

      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toBe('Categoria non trovata')
      }
    })

    it('should fail when target member not found', async () => {
      vi.mocked(mockRepository.getSession).mockResolvedValue(mockSession)
      vi.mocked(mockRepository.getMemberByUserId).mockResolvedValue(mockAdminMember)
      vi.mocked(mockRepository.getConfig).mockResolvedValue(mockConfig)
      vi.mocked(mockRepository.getCategoryById).mockResolvedValue(mockCategory)
      vi.mocked(mockRepository.getActiveMembers).mockResolvedValue([mockAdminMember]) // Only admin

      const result = await useCase.execute({
        sessionId: 'session-1',
        categoryId: 'category-1',
        memberId: 'non-existent',
        amount: 75,
        adminUserId: 'admin-user-1',
      })

      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toBe('Manager non trovato')
      }
    })

    it('should allow zero amount prize', async () => {
      vi.mocked(mockRepository.getSession).mockResolvedValue(mockSession)
      vi.mocked(mockRepository.getMemberByUserId).mockResolvedValue(mockAdminMember)
      vi.mocked(mockRepository.getConfig).mockResolvedValue(mockConfig)
      vi.mocked(mockRepository.getCategoryById).mockResolvedValue(mockCategory)
      vi.mocked(mockRepository.getActiveMembers).mockResolvedValue(mockMembers)
      vi.mocked(mockRepository.assignPrize).mockResolvedValue({ ...mockPrize, amount: 0 })

      const result = await useCase.execute({
        sessionId: 'session-1',
        categoryId: 'category-1',
        memberId: 'regular-member-1',
        amount: 0,
        adminUserId: 'admin-user-1',
      })

      expect(result.isSuccess).toBe(true)
      if (result.isSuccess) {
        expect(result.value.amount).toBe(0)
      }
    })

    it('should handle repository errors gracefully', async () => {
      vi.mocked(mockRepository.getSession).mockRejectedValue(new Error('Database error'))

      const result = await useCase.execute({
        sessionId: 'session-1',
        categoryId: 'category-1',
        memberId: 'regular-member-1',
        amount: 75,
        adminUserId: 'admin-user-1',
      })

      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toContain('Database error')
      }
    })
  })
})
