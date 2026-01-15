/**
 * CheckReadyUseCase
 *
 * Application layer use case for marking a member as ready and checking
 * if all members are ready to proceed to the next phase.
 */

import type { Result } from '@/shared/infrastructure/http/result'
import { ok, fail } from '@/shared/infrastructure/http/result'
import { ValidationError, NotFoundError } from '@/shared/infrastructure/http/errors'
import type { IRubataRepository } from '../../domain/repositories/rubata.repository.interface'
import type { SetReadyDto, ReadyStatusDto } from '../dto/rubata.dto'
import { areAllMembersReady, getNotReadyMembers, getReadyCount } from '../../domain/entities/rubata-ready.entity'

/**
 * Transition rules for when all members are ready
 */
const PHASE_TRANSITIONS = {
  WAITING_READY: 'BOARD_SELECTION',
  BOARD_SELECTION: 'OFFERS',
  OFFERS: 'AUCTION',
  AUCTION: 'DONE',
  DONE: 'DONE',
} as const

/**
 * CheckReadyUseCase
 *
 * Handles marking a member as ready with the following responsibilities:
 * - Validates the session exists
 * - Marks the member as ready
 * - Checks if all members are now ready
 * - If all ready, transitions to the next phase
 * - Returns the current ready status
 */
export class CheckReadyUseCase {
  constructor(private readonly rubataRepository: IRubataRepository) {}

  /**
   * Execute the check ready use case
   * @param input - The input containing session ID and member ID
   * @returns A Result containing the ready status or an error
   */
  async execute(
    input: SetReadyDto
  ): Promise<Result<ReadyStatusDto & { phaseTransitioned: boolean }, ValidationError | NotFoundError>> {
    try {
      const { sessionId, memberId } = input

      // Validate input
      const validationError = this.validateInput(input)
      if (validationError) {
        return fail(validationError)
      }

      // Check session exists
      const session = await this.rubataRepository.getSession(sessionId)
      if (!session) {
        return fail(new NotFoundError('Sessione rubata non trovata'))
      }

      // Mark the member as ready
      await this.rubataRepository.setReady(sessionId, memberId)

      // Get all ready statuses
      const statuses = await this.rubataRepository.getReadyStatus(sessionId)

      // Calculate ready status
      const allReady = areAllMembersReady(statuses)
      const pendingMembers = getNotReadyMembers(statuses)
      const { ready: readyCount, total: totalCount } = getReadyCount(statuses)

      let phaseTransitioned = false

      // If all members are ready, transition to next phase
      if (allReady) {
        const nextPhase = PHASE_TRANSITIONS[session.currentPhase]
        if (nextPhase !== session.currentPhase) {
          await this.rubataRepository.updateSessionPhase(sessionId, nextPhase)
          // Reset ready statuses for next phase
          await this.rubataRepository.resetAllReady(sessionId)
          phaseTransitioned = true
        }
      }

      return ok({
        statuses,
        readyCount,
        totalCount,
        allReady,
        pendingMembers,
        phaseTransitioned,
      })
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Errore durante il controllo dello stato pronto'
      return fail(new ValidationError(errorMessage))
    }
  }

  /**
   * Validates the input data
   */
  private validateInput(input: SetReadyDto): ValidationError | null {
    if (!input.sessionId || input.sessionId.trim().length === 0) {
      return new ValidationError('ID sessione obbligatorio')
    }

    if (!input.memberId || input.memberId.trim().length === 0) {
      return new ValidationError('ID membro obbligatorio')
    }

    return null
  }
}
