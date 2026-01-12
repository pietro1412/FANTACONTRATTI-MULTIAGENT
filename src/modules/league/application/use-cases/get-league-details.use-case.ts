/**
 * GetLeagueDetailsUseCase
 *
 * Application layer use case for retrieving league details with members.
 * Following Clean Architecture, this use case orchestrates the domain logic
 * and infrastructure interactions.
 */

import type { Result } from '@/shared/infrastructure/http/result'
import { ok, fail } from '@/shared/infrastructure/http/result'
import { ValidationError, NotFoundError } from '@/shared/infrastructure/http/errors'
import type { ILeagueRepository } from '../../domain/repositories/league.repository.interface'
import type { GetLeagueDetailsInput, LeagueDetailDto } from '../dto/league.dto'

/**
 * GetLeagueDetailsUseCase
 *
 * Retrieves detailed information about a league including:
 * - League data
 * - List of members with user information
 * - Whether the requesting user is an admin
 * - The requesting user's member ID (if they are a member)
 */
export class GetLeagueDetailsUseCase {
  constructor(private readonly leagueRepository: ILeagueRepository) {}

  /**
   * Execute the get league details use case
   * @param input - The input data containing leagueId and userId
   * @returns A Result containing the league details or an error
   */
  async execute(input: GetLeagueDetailsInput): Promise<Result<LeagueDetailDto, NotFoundError | ValidationError>> {
    try {
      const { leagueId, userId } = input

      // Find the league
      const league = await this.leagueRepository.findById(leagueId)
      if (!league) {
        return fail(new NotFoundError('Lega non trovata'))
      }

      // Get all members with user information
      const members = await this.leagueRepository.getMembers(leagueId)

      // Get the current user's membership
      const currentUserMember = await this.leagueRepository.getMember(leagueId, userId)

      // Determine if user is admin
      const isAdmin = currentUserMember?.role === 'ADMIN'

      return ok({
        league,
        members,
        isAdmin,
        currentUserMemberId: currentUserMember?.id,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Errore durante il recupero dei dettagli della lega'
      return fail(new ValidationError(errorMessage))
    }
  }
}
