/**
 * AddToBoardUseCase
 *
 * Application layer use case for adding a player to the rubata board.
 * Validates ownership and board limits before adding.
 */

import type { Result } from '@/shared/infrastructure/http/result'
import { ok, fail } from '@/shared/infrastructure/http/result'
import { ValidationError, ForbiddenError, NotFoundError } from '@/shared/infrastructure/http/errors'
import type { IRubataRepository } from '../../domain/repositories/rubata.repository.interface'
import type { AddToBoardDto, AddToBoardResultDto } from '../dto/rubata.dto'

/** Maximum number of players a member can add to the board */
const MAX_BOARD_ENTRIES_PER_MEMBER = 3

/**
 * AddToBoardUseCase
 *
 * Handles adding a player to the rubata board with the following responsibilities:
 * - Validates the session exists and is in board selection phase
 * - Validates the player belongs to the member
 * - Validates the member hasn't exceeded the board limit
 * - Adds the player to the rubata board
 * - Returns the updated board entry count
 */
export class AddToBoardUseCase {
  constructor(private readonly rubataRepository: IRubataRepository) {}

  /**
   * Execute the add to board use case
   * @param input - The input containing session ID, roster ID, and member ID
   * @returns A Result containing the created entry or an error
   */
  async execute(
    input: AddToBoardDto
  ): Promise<Result<AddToBoardResultDto, ValidationError | ForbiddenError | NotFoundError>> {
    try {
      const { sessionId, rosterId, memberId } = input

      // Validate input
      const validationError = this.validateInput(input)
      if (validationError) {
        return fail(validationError)
      }

      // Check session exists and is in correct phase
      const session = await this.rubataRepository.getSession(sessionId)
      if (!session) {
        return fail(new NotFoundError('Sessione rubata non trovata'))
      }

      if (session.status !== 'BOARD_SELECTION' && session.status !== 'SETUP') {
        return fail(
          new ValidationError(
            'Non è possibile aggiungere giocatori al tabellone in questa fase'
          )
        )
      }

      // Check member hasn't exceeded board limit
      const currentCount = await this.rubataRepository.getMemberBoardCount(
        sessionId,
        memberId
      )
      if (currentCount >= MAX_BOARD_ENTRIES_PER_MEMBER) {
        return fail(
          new ValidationError(
            `Hai raggiunto il limite massimo di ${MAX_BOARD_ENTRIES_PER_MEMBER} giocatori sul tabellone`
          )
        )
      }

      // Add player to board (this will validate ownership atomically)
      const entry = await this.rubataRepository.addToBoardAtomic({
        sessionId,
        rosterId,
        memberId,
        playerId: '', // Will be resolved by repository from roster
      })

      return ok({
        entry,
        memberEntryCount: currentCount + 1,
      })
    } catch (error) {
      if (error instanceof Error) {
        // Handle specific repository errors
        if (error.message.includes('non appartiene')) {
          return fail(new ForbiddenError(error.message))
        }
        if (error.message.includes('non trovato')) {
          return fail(new NotFoundError(error.message))
        }
        return fail(new ValidationError(error.message))
      }
      return fail(
        new ValidationError('Errore durante l\'aggiunta al tabellone')
      )
    }
  }

  /**
   * Validates the input data
   */
  private validateInput(input: AddToBoardDto): ValidationError | null {
    if (!input.sessionId || input.sessionId.trim().length === 0) {
      return new ValidationError('ID sessione obbligatorio')
    }

    if (!input.rosterId || input.rosterId.trim().length === 0) {
      return new ValidationError('ID roster obbligatorio')
    }

    if (!input.memberId || input.memberId.trim().length === 0) {
      return new ValidationError('ID membro obbligatorio')
    }

    return null
  }
}
