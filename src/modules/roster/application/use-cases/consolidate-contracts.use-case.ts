/**
 * Consolidate Contracts Use Case - Application Layer
 * Handles contract consolidation for year 4+ contracts
 */

import type { IRosterRepository } from '../../domain/repositories/roster.repository.interface'
import type { IContractCalculator } from '../../domain/services/contract-calculator.service'

import type { Result} from '@/shared/infrastructure/http/result';
import { ok, fail } from '@/shared/infrastructure/http/result'
import { InternalError } from '@/shared/infrastructure/http/errors'

/**
 * Result of a single contract consolidation
 */
export interface ConsolidatedContractResult {
  contractId: string
  bonus: number
  newStatus: 'CONSOLIDATED'
}

/**
 * Output of consolidation operation
 */
export interface ConsolidateContractsOutput {
  memberId: string
  consolidatedContracts: ConsolidatedContractResult[]
  totalBonus: number
}

/**
 * Use case for consolidating eligible contracts
 *
 * Business rules:
 * - Finds all contracts in year 4+
 * - Calculates bonus for each
 * - Updates contracts as consolidated
 * - Returns summary of consolidation
 */
export class ConsolidateContractsUseCase {
  constructor(
    private readonly rosterRepository: IRosterRepository,
    private readonly calculator: IContractCalculator
  ) {}

  /**
   * Execute the consolidation
   * @param memberId - The league member ID
   * @returns Result containing consolidation summary or error
   */
  async execute(
    memberId: string
  ): Promise<Result<ConsolidateContractsOutput, InternalError>> {
    try {
      // Find all eligible contracts (year 4+)
      const eligibleContracts = await this.rosterRepository.findConsolidationEligible(memberId)

      const consolidatedContracts: ConsolidatedContractResult[] = []
      let totalBonus = 0

      for (const contract of eligibleContracts) {
        // Calculate consolidation bonus
        const bonus = this.calculator.calculateConsolidationBonus(contract.salary)
        totalBonus += bonus

        // Update contract as consolidated
        await this.rosterRepository.updateContract(contract.id, {
          status: 'CONSOLIDATED',
          consolidatedAt: new Date(),
        })

        consolidatedContracts.push({
          contractId: contract.id,
          bonus,
          newStatus: 'CONSOLIDATED',
        })
      }

      // Add total bonus to member budget
      if (totalBonus > 0) {
        await this.rosterRepository.updateMemberBudget(memberId, totalBonus)
      }

      return ok({
        memberId,
        consolidatedContracts,
        totalBonus,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Errore nel consolidamento dei contratti'
      return fail(new InternalError(message))
    }
  }
}
