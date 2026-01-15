/**
 * Get Roster Use Case Tests
 * TDD: Tests written first to define expected behavior
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { GetRosterUseCase } from '../../application/use-cases/get-roster.use-case'
import type { IRosterRepository } from '../../domain/repositories/roster.repository.interface'
import type { PlayerRoster } from '../../domain/entities/roster.entity'
import type { PlayerContract } from '../../domain/entities/contract.entity'

describe('GetRosterUseCase', () => {
  let useCase: GetRosterUseCase
  let mockRepository: IRosterRepository

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
    duration: 3,
    clausola: 90,
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

    useCase = new GetRosterUseCase(mockRepository)
  })

  describe('execute', () => {
    it('should return all active players for a member', async () => {
      const mockRosterWithContract = {
        roster: mockRoster,
        contract: mockContract,
      }
      vi.mocked(mockRepository.findContractsByMemberId).mockResolvedValue([mockRosterWithContract])

      const result = await useCase.execute('member-1')

      expect(result.isSuccess).toBe(true)
      if (result.isSuccess) {
        expect(result.value).toHaveLength(1)
        expect(result.value[0].roster.id).toBe('roster-1')
        expect(result.value[0].contract.salary).toBe(10)
      }
    })

    it('should include contract details for each player', async () => {
      const mockRosterWithContract = {
        roster: mockRoster,
        contract: mockContract,
      }
      vi.mocked(mockRepository.findContractsByMemberId).mockResolvedValue([mockRosterWithContract])

      const result = await useCase.execute('member-1')

      expect(result.isSuccess).toBe(true)
      if (result.isSuccess) {
        expect(result.value[0].contract).toBeDefined()
        expect(result.value[0].contract.duration).toBe(3)
        expect(result.value[0].contract.clausola).toBe(90)
      }
    })

    it('should return empty array if no players', async () => {
      vi.mocked(mockRepository.findContractsByMemberId).mockResolvedValue([])

      const result = await useCase.execute('member-1')

      expect(result.isSuccess).toBe(true)
      if (result.isSuccess) {
        expect(result.value).toEqual([])
      }
    })

    it('should handle multiple players', async () => {
      const roster2: PlayerRoster = {
        ...mockRoster,
        id: 'roster-2',
        playerId: 'player-2',
      }
      const contract2: PlayerContract = {
        ...mockContract,
        id: 'contract-2',
        rosterId: 'roster-2',
        salary: 15,
      }

      vi.mocked(mockRepository.findContractsByMemberId).mockResolvedValue([
        { roster: mockRoster, contract: mockContract },
        { roster: roster2, contract: contract2 },
      ])

      const result = await useCase.execute('member-1')

      expect(result.isSuccess).toBe(true)
      if (result.isSuccess) {
        expect(result.value).toHaveLength(2)
        expect(result.value[0].roster.id).toBe('roster-1')
        expect(result.value[1].roster.id).toBe('roster-2')
      }
    })

    it('should return failure on repository error', async () => {
      vi.mocked(mockRepository.findContractsByMemberId).mockRejectedValue(new Error('DB Error'))

      const result = await useCase.execute('member-1')

      expect(result.isFailure).toBe(true)
      if (result.isFailure) {
        expect(result.error.message).toContain('DB Error')
      }
    })
  })
})
