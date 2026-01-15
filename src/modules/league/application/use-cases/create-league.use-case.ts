/**
 * CreateLeagueUseCase
 *
 * Application layer use case for creating a new fantasy football league.
 * Following Clean Architecture, this use case orchestrates the domain logic
 * and infrastructure interactions.
 */

import type { Result } from '@/shared/infrastructure/http/result'
import { ok, fail } from '@/shared/infrastructure/http/result'
import { ValidationError } from '@/shared/infrastructure/http/errors'
import type { EventBus } from '@/shared/infrastructure/events'
import { DomainEventTypes, type LeagueCreated } from '@/shared/infrastructure/events'
import type { ILeagueRepository } from '../../domain/repositories/league.repository.interface'
import { LEAGUE_DEFAULTS } from '../../domain/entities/league.entity'
import type { CreateLeagueInput, CreateLeagueResult } from '../dto/league.dto'

/**
 * CreateLeagueUseCase
 *
 * Handles the creation of a new league with the following responsibilities:
 * - Validates input data
 * - Creates the league in the repository
 * - Adds the creator as the first member with ADMIN role
 * - Publishes LeagueCreated domain event
 */
export class CreateLeagueUseCase {
  constructor(
    private readonly leagueRepository: ILeagueRepository,
    private readonly eventBus: EventBus
  ) {}

  /**
   * Execute the create league use case
   * @param input - The input data containing userId and league creation data
   * @returns A Result containing the created league or an error
   */
  async execute(input: CreateLeagueInput): Promise<Result<CreateLeagueResult, ValidationError>> {
    try {
      // Validate input
      const validationError = this.validateInput(input)
      if (validationError) {
        return fail(validationError)
      }

      const { userId, data } = input

      // Create the league
      const league = await this.leagueRepository.create({
        name: data.name.trim(),
        description: data.description?.trim(),
        adminId: userId,
        maxMembers: data.maxMembers ?? LEAGUE_DEFAULTS.maxMembers,
        minMembers: LEAGUE_DEFAULTS.minMembers,
        initialBudget: data.initialBudget ?? LEAGUE_DEFAULTS.initialBudget,
        maxPlayersPerRole: {
          ...LEAGUE_DEFAULTS.maxPlayersPerRole,
          ...data.maxPlayersPerRole,
        },
      })

      // Add creator as admin member
      await this.leagueRepository.addMember({
        leagueId: league.id,
        userId,
        teamName: data.teamName.trim(),
        role: 'ADMIN',
        status: 'ACTIVE',
        joinType: 'CREATOR',
        initialBudget: league.initialBudget,
      })

      // Publish domain event
      const event: LeagueCreated = {
        leagueId: league.id,
        adminId: userId,
        name: league.name,
      }
      await this.eventBus.publish(DomainEventTypes.LEAGUE_CREATED, event)

      return ok({
        league,
        inviteCode: league.inviteCode,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Errore durante la creazione della lega'
      return fail(new ValidationError(errorMessage))
    }
  }

  /**
   * Validate the input data for league creation
   * @param input - The input to validate
   * @returns ValidationError if validation fails, null otherwise
   */
  private validateInput(input: CreateLeagueInput): ValidationError | null {
    const { data } = input

    // Validate league name
    if (!data.name || data.name.trim().length === 0) {
      return new ValidationError('Il nome della lega è obbligatorio')
    }

    // Validate team name
    if (!data.teamName || data.teamName.trim().length === 0) {
      return new ValidationError('Il nome della squadra è obbligatorio')
    }

    if (data.teamName.trim().length < 2) {
      return new ValidationError('Il nome della squadra deve avere almeno 2 caratteri')
    }

    return null
  }
}
