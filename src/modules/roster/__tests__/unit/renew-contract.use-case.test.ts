/**
 * Renew Contract Use Case Tests
 * TDD: Tests written first to define expected behavior
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { RenewContractUseCase } from '../../application/use-cases/renew-contract.use-case'
import type { IRosterRepository } from '../../domain/repositories/roster.repository.interface'
import type { IContractCalculator } from '../../domain/services/contract-calculator.service'
import type { PlayerRoster } from '../../domain/entities/roster.entity'
import type { PlayerContract } from '../../domain/entities/contract.entity'

describe('RenewContractUseCase', () => {
  let useCase: RenewContractUseCase
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
    duration: 2,
    clausola: 70,
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

    useCase = new RenewContractUseCase(mockRepository, mockCalculator)
  })

  describe('execute', () => {
    it('should return failure if roster not found', async () => {
      vi.mocked(mockRepository.findById).mockResolvedValue(null)

      const result = await useCase.execute({
        rosterId: 'non-existent',
        newSalary: 15,
        newDuration: 4,
      })

      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toContain('Roster non trovato')
      }
    })

    it('should return failure if contract not found', async () => {
      vi.mocked(mockRepository.findById).mockResolvedValue(mockRoster)
      vi.mocked(mockRepository.getContract).mockResolvedValue(null)

      const result = await useCase.execute({
        rosterId: 'roster-1',
        newSalary: 15,
        newDuration: 4,
      })

      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toContain('Contratto non trovato')
      }
    })

    it('should return failure if insufficient budget', async () => {
      vi.mocked(mockRepository.findById).mockResolvedValue(mockRoster)
      vi.mocked(mockRepository.getContract).mockResolvedValue(mockContract)
      vi.mocked(mockRepository.getMemberBudget).mockResolvedValue(5) // Only 5 budget
      vi.mocked(mockCalculator.calculateRenewalCost).mockReturnValue(20) // Need 20

      const result = await useCase.execute({
        rosterId: 'roster-1',
        newSalary: 15,
        newDuration: 4,
      })

      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toContain('Budget insufficiente')
      }
    })

    it('should return failure if already at max duration', async () => {
      const maxDurationContract: PlayerContract = {
        ...mockContract,
        duration: 4, // Already at max
      }
      vi.mocked(mockRepository.findById).mockResolvedValue(mockRoster)
      vi.mocked(mockRepository.getContract).mockResolvedValue(maxDurationContract)

      const result = await useCase.execute({
        rosterId: 'roster-1',
        newSalary: 15,
        newDuration: 5, // Trying to go beyond max
      })

      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toContain('Durata massima')
      }
    })

    it('should return failure if new salary is less than current', async () => {
      vi.mocked(mockRepository.findById).mockResolvedValue(mockRoster)
      vi.mocked(mockRepository.getContract).mockResolvedValue(mockContract) // salary = 10

      const result = await useCase.execute({
        rosterId: 'roster-1',
        newSalary: 5, // Less than current 10
        newDuration: 3,
      })

      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toContain('non può diminuire')
      }
    })

    it('should update contract duration and salary on success', async () => {
      // Current contract: salary=10, duration=2 => value=20
      // New contract: salary=15, duration=4 => value=60
      // Renewal cost: 60 - 20 = 40
      const updatedContract: PlayerContract = {
        ...mockContract,
        salary: 15,
        duration: 4,
        clausola: 165,
        renewedAt: new Date(),
      }

      vi.mocked(mockRepository.findById).mockResolvedValue(mockRoster)
      vi.mocked(mockRepository.getContract).mockResolvedValue(mockContract)
      vi.mocked(mockRepository.getMemberBudget).mockResolvedValue(100)
      vi.mocked(mockCalculator.calculateRescission).mockReturnValue(165)
      vi.mocked(mockRepository.updateContract).mockResolvedValue(updatedContract)
      vi.mocked(mockRepository.updateMemberBudget).mockResolvedValue(60)

      const result = await useCase.execute({
        rosterId: 'roster-1',
        newSalary: 15,
        newDuration: 4,
      })

      expect(result.isSuccess).toBe(true)
      if (result.isSuccess) {
        expect(result.value.contract.salary).toBe(15)
        expect(result.value.contract.duration).toBe(4)
        expect(result.value.renewalCost).toBe(40) // (15*4) - (10*2) = 60 - 20 = 40
      }
    })

    it('should deduct cost from member budget', async () => {
      // Current contract: salary=10, duration=2 => value=20
      // New contract: salary=15, duration=4 => value=60
      // Renewal cost: 60 - 20 = 40
      const updatedContract: PlayerContract = {
        ...mockContract,
        salary: 15,
        duration: 4,
      }

      vi.mocked(mockRepository.findById).mockResolvedValue(mockRoster)
      vi.mocked(mockRepository.getContract).mockResolvedValue(mockContract)
      vi.mocked(mockRepository.getMemberBudget).mockResolvedValue(100)
      vi.mocked(mockCalculator.calculateRescission).mockReturnValue(165)
      vi.mocked(mockRepository.updateContract).mockResolvedValue(updatedContract)
      vi.mocked(mockRepository.updateMemberBudget).mockResolvedValue(60)

      await useCase.execute({
        rosterId: 'roster-1',
        newSalary: 15,
        newDuration: 4,
      })

      expect(mockRepository.updateMemberBudget).toHaveBeenCalledWith('member-1', -40)
    })

    it('should return new budget in result', async () => {
      // Current contract: salary=10, duration=2 => value=20
      // New contract: salary=15, duration=4 => value=60
      // Renewal cost: 60 - 20 = 40
      // New budget: 100 - 40 = 60
      const updatedContract: PlayerContract = {
        ...mockContract,
        salary: 15,
        duration: 4,
      }

      vi.mocked(mockRepository.findById).mockResolvedValue(mockRoster)
      vi.mocked(mockRepository.getContract).mockResolvedValue(mockContract)
      vi.mocked(mockRepository.getMemberBudget).mockResolvedValue(100)
      vi.mocked(mockCalculator.calculateRescission).mockReturnValue(165)
      vi.mocked(mockRepository.updateContract).mockResolvedValue(updatedContract)
      vi.mocked(mockRepository.updateMemberBudget).mockResolvedValue(60)

      const result = await useCase.execute({
        rosterId: 'roster-1',
        newSalary: 15,
        newDuration: 4,
      })

      expect(result.isSuccess).toBe(true)
      if (result.isSuccess) {
        expect(result.value.newBudget).toBe(60) // 100 - 40 = 60
      }
    })
  })
})
