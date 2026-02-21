/**
 * Renew Contract Use Case - Application Layer
 * Handles contract renewal with validation and budget management
 */

import type { IRosterRepository } from '../../domain/repositories/roster.repository.interface'
import type { IContractCalculator } from '../../domain/services/contract-calculator.service'
import type { PlayerContract } from '../../domain/entities/contract.entity'
import { MAX_CONTRACT_DURATION } from '../../domain/entities/contract.entity'
import type { Result} from '@/shared/infrastructure/http/result';
import { ok, fail } from '@/shared/infrastructure/http/result'
import { ValidationError, NotFoundError, InternalError } from '@/shared/infrastructure/http/errors'

/**
 * Input for renewal operation
 */
export interface RenewContractInput {
  rosterId: string
  newSalary: number
  newDuration: number
}

/**
 * Output of successful renewal
 */
export interface RenewContractOutput {
  contract: PlayerContract
  renewalCost: number
  newBudget: number
}

/**
 * Use case for renewing a player contract
 *
 * Business rules:
 * - Returns failure if roster not found
 * - Returns failure if insufficient budget
 * - Returns failure if already at max duration
 * - Returns failure if salary decreases
 * - Updates contract duration and salary
 * - Deducts cost from member budget
 */
export class RenewContractUseCase {
  constructor(
    private readonly rosterRepository: IRosterRepository,
    private readonly calculator: IContractCalculator
  ) {}

  /**
   * Execute the renewal
   * @param input - The renewal parameters
   * @returns Result containing the updated contract or error
   */
  async execute(
    input: RenewContractInput
  ): Promise<Result<RenewContractOutput, ValidationError | NotFoundError | InternalError>> {
    try {
      // Find roster
      const roster = await this.rosterRepository.findById(input.rosterId)
      if (!roster) {
        return fail(new NotFoundError('Roster non trovato'))
      }

      // Find contract
      const contract = await this.rosterRepository.getContract(input.rosterId)
      if (!contract) {
        return fail(new NotFoundError('Contratto non trovato'))
      }

      // Validate max duration
      if (input.newDuration > MAX_CONTRACT_DURATION) {
        return fail(new ValidationError(`Durata massima: ${MAX_CONTRACT_DURATION} semestri`))
      }

      // Validate salary doesn't decrease (except for spalmaingaggi)
      if (contract.duration !== 1 && input.newSalary < contract.salary) {
        return fail(new ValidationError('Ingaggio non può diminuire'))
      }

      // Calculate renewal cost
      const currentValue = contract.salary * contract.duration
      const newValue = input.newSalary * input.newDuration
      const renewalCost = Math.max(0, newValue - currentValue)

      // Check budget
      const currentBudget = await this.rosterRepository.getMemberBudget(roster.leagueMemberId)
      if (renewalCost > currentBudget) {
        return fail(
          new ValidationError(
            `Budget insufficiente. Costo rinnovo: ${renewalCost}, Budget: ${currentBudget}`
          )
        )
      }

      // Calculate new rescission clause
      const newClausola = this.calculator.calculateRescission(input.newSalary, input.newDuration)

      // Update contract
      const updatedContract = await this.rosterRepository.updateContract(contract.id, {
        salary: input.newSalary,
        duration: input.newDuration,
        clausola: newClausola,
        renewedAt: new Date(),
      })

      // Deduct budget
      const newBudget = await this.rosterRepository.updateMemberBudget(
        roster.leagueMemberId,
        -renewalCost
      )

      return ok({
        contract: updatedContract,
        renewalCost,
        newBudget,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Errore nel rinnovo del contratto'
      return fail(new InternalError(message))
    }
  }
}
