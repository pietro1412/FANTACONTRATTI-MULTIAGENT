/**
 * JoinLeagueUseCase
 *
 * Application layer use case for joining an existing fantasy football league.
 * Following Clean Architecture, this use case orchestrates the domain logic
 * and infrastructure interactions.
 */

import type { Result } from '@/shared/infrastructure/http/result'
import { ok, fail } from '@/shared/infrastructure/http/result'
import { ValidationError, NotFoundError, ConflictError } from '@/shared/infrastructure/http/errors'
import type { EventBus } from '@/shared/infrastructure/events'
import { DomainEventTypes, type MemberJoined } from '@/shared/infrastructure/events'
import type { ILeagueRepository } from '../../domain/repositories/league.repository.interface'
import type { JoinLeagueInput, JoinLeagueResult } from '../dto/league.dto'

/**
 * JoinLeagueUseCase
 *
 * Handles a user's request to join a league with the following responsibilities:
 * - Validates the league exists and is accepting members
 * - Checks if the user is already a member
 * - Checks if the league is full
 * - Adds the user as a pending member
 * - Publishes MemberJoined domain event
 */
export class JoinLeagueUseCase {
  constructor(
    private readonly leagueRepository: ILeagueRepository,
    private readonly eventBus: EventBus
  ) {}

  /**
   * Execute the join league use case
   * @param input - The input data containing userId, leagueId, and teamName
   * @returns A Result containing the join result or an error
   */
  async execute(
    input: JoinLeagueInput
  ): Promise<Result<JoinLeagueResult, ValidationError | NotFoundError | ConflictError>> {
    try {
      const { userId, leagueId, teamName } = input

      // Validate team name first
      const validationError = this.validateInput(input)
      if (validationError) {
        return fail(validationError)
      }

      // Find the league
      const league = await this.leagueRepository.findById(leagueId)
      if (!league) {
        return fail(new NotFoundError('Lega non trovata'))
      }

      // Check if league is in DRAFT status
      if (league.status !== 'DRAFT') {
        return fail(new ConflictError('La lega è già stata avviata, non puoi richiedere di partecipare'))
      }

      // Check if user is already a member
      const isMember = await this.leagueRepository.memberExists(leagueId, userId)
      if (isMember) {
        return fail(new ConflictError('Sei già membro di questa lega'))
      }

      // Check if league is full
      const memberCount = await this.leagueRepository.getActiveMemberCount(leagueId)
      if (memberCount >= league.maxMembers) {
        return fail(new ConflictError('La lega è al completo'))
      }

      // Add user as pending member
      const member = await this.leagueRepository.addMember({
        leagueId,
        userId,
        teamName: teamName.trim(),
        role: 'MANAGER',
        status: 'PENDING',
        joinType: 'REQUEST',
        initialBudget: 0, // Budget will be set when approved
      })

      // Publish domain event
      const event: MemberJoined = {
        leagueId,
        memberId: member.id,
        userId,
      }
      await this.eventBus.publish(DomainEventTypes.MEMBER_JOINED, event)

      return ok({
        leagueId,
        memberId: member.id,
        teamName: member.teamName,
        budget: member.budget,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Errore durante la richiesta di partecipazione'
      return fail(new ValidationError(errorMessage))
    }
  }

  /**
   * Validate the input data for joining a league
   * @param input - The input to validate
   * @returns ValidationError if validation fails, null otherwise
   */
  private validateInput(input: JoinLeagueInput): ValidationError | null {
    const { teamName } = input

    // Validate team name
    if (!teamName || teamName.trim().length === 0) {
      return new ValidationError('Il nome della squadra è obbligatorio')
    }

    if (teamName.trim().length < 2) {
      return new ValidationError('Il nome della squadra deve avere almeno 2 caratteri')
    }

    return null
  }
}
