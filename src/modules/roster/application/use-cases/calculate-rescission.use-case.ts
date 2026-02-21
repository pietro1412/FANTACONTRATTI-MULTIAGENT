/**
 * Calculate Rescission Use Case - Application Layer
 * Calculates the rescission (release clause) cost for a contract
 */

import type { IRosterRepository } from '../../domain/repositories/roster.repository.interface'
import type { IContractCalculator } from '../../domain/services/contract-calculator.service'
import { DURATION_MULTIPLIERS } from '../../domain/services/contract-calculator.service'
import type { Result} from '@/shared/infrastructure/http/result';
import { ok, fail } from '@/shared/infrastructure/http/result'
import { NotFoundError, InternalError } from '@/shared/infrastructure/http/errors'

/**
 * Output of rescission calculation
 */
export interface RescissionCalculationOutput {
  rosterId: string
  salary: number
  duration: number
  multiplier: number
  rescissionCost: number
}

/**
 * Use case for calculating rescission cost
 *
 * Business rules:
 * - Calculates correct rescission cost based on salary and duration
 * - Returns failure if roster not found
 * - Returns failure if contract not found
 * - Returns detailed cost breakdown
 */
export class CalculateRescissionUseCase {
  constructor(
    private readonly rosterRepository: IRosterRepository,
    private readonly calculator: IContractCalculator
  ) {}

  /**
   * Execute the calculation
   * @param rosterId - The roster entry ID
   * @returns Result containing the rescission breakdown or error
   */
  async execute(
    rosterId: string
  ): Promise<Result<RescissionCalculationOutput, NotFoundError | InternalError>> {
    try {
      // Find roster
      const roster = await this.rosterRepository.findById(rosterId)
      if (!roster) {
        return fail(new NotFoundError('Roster non trovato'))
      }

      // Find contract
      const contract = await this.rosterRepository.getContract(rosterId)
      if (!contract) {
        return fail(new NotFoundError('Contratto non trovato'))
      }

      // Get multiplier for this duration
      const multiplier = DURATION_MULTIPLIERS[contract.duration] ?? 4

      // Calculate rescission cost
      const rescissionCost = this.calculator.calculateRescission(contract.salary, contract.duration)

      return ok({
        rosterId,
        salary: contract.salary,
        duration: contract.duration,
        multiplier,
        rescissionCost,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Errore nel calcolo della rescissione'
      return fail(new InternalError(message))
    }
  }
}
