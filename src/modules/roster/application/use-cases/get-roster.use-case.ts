/**
 * Get Roster Use Case - Application Layer
 * Returns all active players with their contracts for a league member
 */

import type { IRosterRepository } from '../../domain/repositories/roster.repository.interface'
import type { PlayerRoster } from '../../domain/entities/roster.entity'
import type { PlayerContract } from '../../domain/entities/contract.entity'
import { Result, ok, fail } from '../../../../shared/infrastructure/http/result'
import { InternalError } from '../../../../shared/infrastructure/http/errors'

/**
 * Output type for roster entries with contracts
 */
export interface RosterWithContract {
  roster: PlayerRoster
  contract: PlayerContract
}

/**
 * Use case for retrieving a member's roster with contract details
 *
 * Business rules:
 * - Returns all active players for a member
 * - Includes contract details for each player
 * - Returns empty array if no players
 */
export class GetRosterUseCase {
  constructor(private readonly rosterRepository: IRosterRepository) {}

  /**
   * Execute the use case
   * @param memberId - The league member ID
   * @returns Result containing array of roster entries with contracts
   */
  async execute(memberId: string): Promise<Result<RosterWithContract[], InternalError>> {
    try {
      const rostersWithContracts = await this.rosterRepository.findContractsByMemberId(memberId)

      // Map to our output format
      const result: RosterWithContract[] = rostersWithContracts.map(entry => ({
        roster: entry.roster,
        contract: entry.contract,
      }))

      return ok(result)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Errore nel recupero della rosa'
      return fail(new InternalError(message))
    }
  }
}
