/**
 * Setup Prizes Use Case Tests
 * TDD: Tests written first to define expected behavior
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SetupPrizesUseCase, DEFAULT_BASE_REINCREMENT, DEFAULT_INDENNIZZO_AMOUNT, SYSTEM_CATEGORY_INDENNIZZO } from '../../application/use-cases/setup-prizes.use-case'
import type { IPrizeRepository, MemberInfo, SessionInfo } from '../../domain/repositories/prize.repository.interface'
import type { PrizePhaseConfig, PrizeCategory, SessionPrize } from '../../domain/entities/prize.entity'

describe('SetupPrizesUseCase', () => {
  let useCase: SetupPrizesUseCase
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
    totalBudget: 0,
    remainingBudget: 0,
    baseReincrement: DEFAULT_BASE_REINCREMENT,
    startedAt: new Date(),
    finalizedAt: null,
  }

  const mockCategory: PrizeCategory = {
    id: 'category-1',
    name: SYSTEM_CATEGORY_INDENNIZZO,
    description: 'Premio automatico per tutti i manager',
    defaultAmount: DEFAULT_INDENNIZZO_AMOUNT,
    isCustom: false,
  }

  const mockPrize: SessionPrize = {
    id: 'prize-1',
    categoryId: 'category-1',
    memberId: 'admin-member-1',
    amount: DEFAULT_INDENNIZZO_AMOUNT,
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

    useCase = new SetupPrizesUseCase(mockRepository)
  })

  describe('execute', () => {
    it('should setup prize phase successfully for admin', async () => {
      vi.mocked(mockRepository.getSession).mockResolvedValue(mockSession)
      vi.mocked(mockRepository.getMemberByUserId).mockResolvedValue(mockAdminMember)
      vi.mocked(mockRepository.getConfig).mockResolvedValue(null)
      vi.mocked(mockRepository.getActiveMembers).mockResolvedValue(mockMembers)
      vi.mocked(mockRepository.createConfig).mockResolvedValue(mockConfig)
      vi.mocked(mockRepository.createCategory).mockResolvedValue(mockCategory)
      vi.mocked(mockRepository.assignPrize).mockResolvedValue(mockPrize)

      const result = await useCase.execute({
        sessionId: 'session-1',
        adminUserId: 'admin-user-1',
      })

      expect(result.isSuccess).toBe(true)
      if (result.isSuccess) {
        expect(result.value.configId).toBe('config-1')
        expect(result.value.baseReincrement).toBe(DEFAULT_BASE_REINCREMENT)
        expect(result.value.categoriesCreated).toBe(1)
      }
    })

    it('should use custom base reincrement when provided', async () => {
      vi.mocked(mockRepository.getSession).mockResolvedValue(mockSession)
      vi.mocked(mockRepository.getMemberByUserId).mockResolvedValue(mockAdminMember)
      vi.mocked(mockRepository.getConfig).mockResolvedValue(null)
      vi.mocked(mockRepository.getActiveMembers).mockResolvedValue(mockMembers)
      vi.mocked(mockRepository.createConfig).mockResolvedValue({
        ...mockConfig,
        baseReincrement: 150,
      })
      vi.mocked(mockRepository.createCategory).mockResolvedValue(mockCategory)
      vi.mocked(mockRepository.assignPrize).mockResolvedValue(mockPrize)

      const result = await useCase.execute({
        sessionId: 'session-1',
        adminUserId: 'admin-user-1',
        baseReincrement: 150,
      })

      expect(result.isSuccess).toBe(true)
      if (result.isSuccess) {
        expect(result.value.baseReincrement).toBe(150)
      }
      expect(mockRepository.createConfig).toHaveBeenCalledWith({
        sessionId: 'session-1',
        baseReincrement: 150,
        totalBudget: 0,
      })
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

    it('should fail when user is not a member', async () => {
      vi.mocked(mockRepository.getSession).mockResolvedValue(mockSession)
      vi.mocked(mockRepository.getMemberByUserId).mockResolvedValue(null)

      const result = await useCase.execute({
        sessionId: 'session-1',
        adminUserId: 'unknown-user',
      })

      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toBe('Non autorizzato')
      }
    })

    it('should fail when prize phase already initialized', async () => {
      vi.mocked(mockRepository.getSession).mockResolvedValue(mockSession)
      vi.mocked(mockRepository.getMemberByUserId).mockResolvedValue(mockAdminMember)
      vi.mocked(mockRepository.getConfig).mockResolvedValue(mockConfig)

      const result = await useCase.execute({
        sessionId: 'session-1',
        adminUserId: 'admin-user-1',
      })

      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toBe('Fase premi già inizializzata')
      }
    })

    it('should create Indennizzo category for all members', async () => {
      vi.mocked(mockRepository.getSession).mockResolvedValue(mockSession)
      vi.mocked(mockRepository.getMemberByUserId).mockResolvedValue(mockAdminMember)
      vi.mocked(mockRepository.getConfig).mockResolvedValue(null)
      vi.mocked(mockRepository.getActiveMembers).mockResolvedValue(mockMembers)
      vi.mocked(mockRepository.createConfig).mockResolvedValue(mockConfig)
      vi.mocked(mockRepository.createCategory).mockResolvedValue(mockCategory)
      vi.mocked(mockRepository.assignPrize).mockResolvedValue(mockPrize)

      await useCase.execute({
        sessionId: 'session-1',
        adminUserId: 'admin-user-1',
      })

      // Should create category with correct name
      expect(mockRepository.createCategory).toHaveBeenCalledWith({
        sessionId: 'session-1',
        name: SYSTEM_CATEGORY_INDENNIZZO,
        description: 'Premio automatico per tutti i manager',
        defaultAmount: DEFAULT_INDENNIZZO_AMOUNT,
        isCustom: false,
      })

      // Should assign prize to all members (2 in this case)
      expect(mockRepository.assignPrize).toHaveBeenCalledTimes(2)
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
