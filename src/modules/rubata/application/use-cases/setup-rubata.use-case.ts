/**
 * SetupRubataUseCase
 *
 * Application layer use case for setting up a rubata session.
 * This initializes the rubata phase for a market session.
 */

import type { Result } from '@/shared/infrastructure/http/result'
import { ok, fail } from '@/shared/infrastructure/http/result'
import { ValidationError, NotFoundError } from '@/shared/infrastructure/http/errors'
import type { EventBus } from '@/shared/infrastructure/events'
import { DomainEventTypes, type RubataStarted } from '@/shared/infrastructure/events'
import type { IRubataRepository } from '../../domain/repositories/rubata.repository.interface'
import type { SetupRubataDto, SetupRubataResultDto } from '../dto/rubata.dto'
import { createRubataSession } from '../../domain/entities/rubata-session.entity'

/**
 * SetupRubataUseCase
 *
 * Handles the initialization of a rubata session with the following responsibilities:
 * - Validates the session exists and is in correct phase
 * - Creates the rubata session state
 * - Initializes ready statuses for all members
 * - Publishes RubataStarted domain event
 */
export class SetupRubataUseCase {
  constructor(
    private readonly rubataRepository: IRubataRepository,
    private readonly eventBus: EventBus
  ) {}

  /**
   * Execute the setup rubata use case
   * @param input - The input containing session ID
   * @returns A Result containing the setup result or an error
   */
  async execute(
    input: SetupRubataDto
  ): Promise<Result<SetupRubataResultDto, ValidationError | NotFoundError>> {
    try {
      const { sessionId } = input

      // Validate input
      if (!sessionId || sessionId.trim().length === 0) {
        return fail(new ValidationError('ID sessione obbligatorio'))
      }

      // Check if session already has rubata setup
      const existingSession = await this.rubataRepository.getSession(sessionId)
      if (existingSession) {
        return fail(new ValidationError('Sessione rubata già inizializzata'))
      }

      // Get all members in the session
      const memberIds = await this.rubataRepository.getSessionMembers(sessionId)
      if (memberIds.length === 0) {
        return fail(new NotFoundError('Nessun membro trovato nella sessione'))
      }

      // Create the rubata session
      const session = createRubataSession({ marketSessionId: sessionId })

      // Update session status in repository
      await this.rubataRepository.updateSessionStatus(sessionId, session.status)
      await this.rubataRepository.updateSessionPhase(sessionId, session.currentPhase)

      // Initialize ready statuses for all members
      await this.rubataRepository.initializeReadyStatuses(sessionId, memberIds)

      // Publish domain event
      const event: RubataStarted = {
        sessionId,
      }
      await this.eventBus.publish(DomainEventTypes.RUBATA_STARTED, event)

      return ok({
        session,
        memberCount: memberIds.length,
      })
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Errore durante l\'inizializzazione della rubata'
      return fail(new ValidationError(errorMessage))
    }
  }
}
