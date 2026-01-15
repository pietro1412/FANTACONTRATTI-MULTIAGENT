/**
 * Calculate Rescission Use Case Tests
 * TDD: Tests written first to define expected behavior
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CalculateRescissionUseCase } from '../../application/use-cases/calculate-rescission.use-case'
import type { IRosterRepository } from '../../domain/repositories/roster.repository.interface'
import type { IContractCalculator } from '../../domain/services/contract-calculator.service'
import type { PlayerRoster } from '../../domain/entities/roster.entity'
import type { PlayerContract } from '../../domain/entities/contract.entity'

describe('CalculateRescissionUseCase', () => {
  let useCase: CalculateRescissionUseCase
  let mockRepository: IRosterRepository
  let mockCalculator: IContractCalculator

  const mockRoster: PlayerRoster = {
    id: 'roster-1',
    leagueMemberId: 'member-1',
    playerId: 'player-1',
    acquisitionType: 'AUCTION',
    acquisitionPrice: 50,
    status: 'ACTIVE',
    acquiredAt: new Date('2024-01-01'),
  }

  const mockContract: PlayerContract = {
    id: 'contract-1',
    rosterId: 'roster-1',
    salary: 10,
    duration: 4,
    clausola: 110,
    status: 'ACTIVE',
    renewedAt: null,
    consolidatedAt: null,
  }

  beforeEach(() => {
    mockRepository = {
      findByMemberId: vi.fn(),
      findById: vi.fn(),
      getContract: vi.fn(),
      createRoster: vi.fn(),
      createContract: vi.fn(),
      updateContract: vi.fn(),
      releasePlayer: vi.fn(),
      findContractsByMemberId: vi.fn(),
      findConsolidationEligible: vi.fn(),
      getMemberBudget: vi.fn(),
      updateMemberBudget: vi.fn(),
    }

    mockCalculator = {
      calculateRescission: vi.fn(),
      calculateRenewalCost: vi.fn(),
      calculateConsolidationBonus: vi.fn(),
      calculateReleaseCost: vi.fn(),
    }

    useCase = new CalculateRescissionUseCase(mockRepository, mockCalculator)
  })

  describe('execute', () => {
    it('should calculate correct rescission cost for duration 4', async () => {
      vi.mocked(mockRepository.findById).mockResolvedValue(mockRoster)
      vi.mocked(mockRepository.getContract).mockResolvedValue(mockContract)
      vi.mocked(mockCalculator.calculateRescission).mockReturnValue(110)

      const result = await useCase.execute('roster-1')

      expect(result.isSuccess).toBe(true)
      if (result.isSuccess) {
        expect(result.value.rescissionCost).toBe(110)
      }
    })

    it('should calculate correct rescission cost for duration 2', async () => {
      const contract2: PlayerContract = {
        ...mockContract,
        duration: 2,
      }
      vi.mocked(mockRepository.findById).mockResolvedValue(mockRoster)
      vi.mocked(mockRepository.getContract).mockResolvedValue(contract2)
      vi.mocked(mockCalculator.calculateRescission).mockReturnValue(70)

      const result = await useCase.execute('roster-1')

      expect(result.isSuccess).toBe(true)
      if (result.isSuccess) {
        expect(result.value.rescissionCost).toBe(70)
      }
      expect(mockCalculator.calculateRescission).toHaveBeenCalledWith(10, 2)
    })

    it('should return failure if roster not found', async () => {
      vi.mocked(mockRepository.findById).mockResolvedValue(null)

      const result = await useCase.execute('non-existent')

      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toContain('Roster non trovato')
      }
    })

    it('should return failure if contract not found', async () => {
      vi.mocked(mockRepository.findById).mockResolvedValue(mockRoster)
      vi.mocked(mockRepository.getContract).mockResolvedValue(null)

      const result = await useCase.execute('roster-1')

      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toContain('Contratto non trovato')
      }
    })

    it('should return cost breakdown', async () => {
      vi.mocked(mockRepository.findById).mockResolvedValue(mockRoster)
      vi.mocked(mockRepository.getContract).mockResolvedValue(mockContract)
      vi.mocked(mockCalculator.calculateRescission).mockReturnValue(110)

      const result = await useCase.execute('roster-1')

      expect(result.isSuccess).toBe(true)
      if (result.isSuccess) {
        expect(result.value.rosterId).toBe('roster-1')
        expect(result.value.salary).toBe(10)
        expect(result.value.duration).toBe(4)
        expect(result.value.multiplier).toBe(11)
        expect(result.value.rescissionCost).toBe(110)
      }
    })

    it('should use correct multiplier for each duration', async () => {
      const testCases = [
        { duration: 4, multiplier: 11, expectedCost: 110 },
        { duration: 3, multiplier: 9, expectedCost: 90 },
        { duration: 2, multiplier: 7, expectedCost: 70 },
        { duration: 1, multiplier: 4, expectedCost: 40 },
      ]

      for (const testCase of testCases) {
        const contract: PlayerContract = {
          ...mockContract,
          duration: testCase.duration,
        }
        vi.mocked(mockRepository.findById).mockResolvedValue(mockRoster)
        vi.mocked(mockRepository.getContract).mockResolvedValue(contract)
        vi.mocked(mockCalculator.calculateRescission).mockReturnValue(testCase.expectedCost)

        const result = await useCase.execute('roster-1')

        expect(result.isSuccess).toBe(true)
        if (result.isSuccess) {
          expect(result.value.multiplier).toBe(testCase.multiplier)
          expect(result.value.rescissionCost).toBe(testCase.expectedCost)
        }
      }
    })
  })
})
