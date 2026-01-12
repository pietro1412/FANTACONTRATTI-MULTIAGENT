/**
 * PlaceOfferUseCase - CRITICAL PERFORMANCE
 *
 * Application layer use case for placing an offer on a rubata board entry.
 * This is a performance-critical operation that must handle race conditions.
 *
 * TDD Requirements:
 * - Returns failure if board entry not found
 * - Returns failure if entry already in auction
 * - Returns failure if bidder has insufficient budget
 * - Returns failure if bidder is the player's owner
 * - Uses atomic transaction to prevent race conditions
 * - Updates offer amount if higher than current
 * - Publishes RubataOfferPlaced domain event
 */

import type { Result } from '@/shared/infrastructure/http/result'
import { ok, fail } from '@/shared/infrastructure/http/result'
import {
  ValidationError,
  NotFoundError,
  ConflictError,
  ForbiddenError,
} from '@/shared/infrastructure/http/errors'
import type { EventBus } from '@/shared/infrastructure/events'
import { DomainEventTypes, type RubataOfferPlaced } from '@/shared/infrastructure/events'
import type { IRubataRepository } from '../../domain/repositories/rubata.repository.interface'
import type { PlaceOfferDto, PlaceOfferResultDto } from '../dto/rubata.dto'
import { isValidOfferAmount } from '../../domain/entities/rubata-offer.entity'

/**
 * Error codes mapped to error types
 */
const ERROR_MAP = {
  ENTRY_NOT_FOUND: (msg: string) => new NotFoundError(msg),
  ENTRY_ALREADY_IN_AUCTION: (msg: string) => new ConflictError(msg),
  INSUFFICIENT_BUDGET: (msg: string) => new ValidationError(msg),
  OFFER_TOO_LOW: (msg: string) => new ValidationError(msg),
  CANNOT_BID_OWN_PLAYER: (msg: string) => new ForbiddenError(msg),
} as const

/**
 * PlaceOfferUseCase
 *
 * Handles placing an offer on a rubata board entry with atomic transaction.
 * This ensures that concurrent offers are handled correctly without race conditions.
 */
export class PlaceOfferUseCase {
  constructor(
    private readonly rubataRepository: IRubataRepository,
    private readonly eventBus: EventBus
  ) {}

  /**
   * Execute the place offer use case
   * @param input - The input containing board entry ID, bidder ID, and amount
   * @returns A Result containing the offer result or an error
   */
  async execute(
    input: PlaceOfferDto
  ): Promise<
    Result<
      PlaceOfferResultDto,
      ValidationError | NotFoundError | ConflictError | ForbiddenError
    >
  > {
    try {
      const { boardEntryId, offeredById, amount } = input

      // Validate input
      const validationError = this.validateInput(input)
      if (validationError) {
        return fail(validationError)
      }

      // Place offer atomically (repository handles all validations in transaction)
      const result = await this.rubataRepository.placeOfferAtomic({
        boardEntryId,
        offeredByMemberId: offeredById,
        amount,
      })

      // Handle failure cases
      if (!result.success) {
        return this.handleOfferError(result.errorCode!)
      }

      // Get the board entry to get player ID for event
      const boardEntry = await this.rubataRepository.getBoardEntry(boardEntryId)

      // Publish domain event
      if (boardEntry) {
        const event: RubataOfferPlaced = {
          sessionId: boardEntry.sessionId,
          playerId: boardEntry.playerId,
          offeredById,
        }
        await this.eventBus.publish(DomainEventTypes.RUBATA_OFFER_PLACED, event)
      }

      return ok({
        offer: result.offer!,
        highestOffer: result.highestOffer!,
        isHighest: result.offer!.amount === result.highestOffer!,
      })
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Errore durante il piazzamento dell\'offerta'
      return fail(new ValidationError(errorMessage))
    }
  }

  /**
   * Validates the input data
   */
  private validateInput(input: PlaceOfferDto): ValidationError | null {
    if (!input.boardEntryId || input.boardEntryId.trim().length === 0) {
      return new ValidationError('ID voce tabellone obbligatorio')
    }

    if (!input.offeredById || input.offeredById.trim().length === 0) {
      return new ValidationError('ID offerente obbligatorio')
    }

    if (!isValidOfferAmount(input.amount)) {
      return new ValidationError('L\'offerta deve essere un numero intero positivo')
    }

    return null
  }

  /**
   * Maps repository error codes to appropriate errors
   */
  private handleOfferError(
    errorCode: NonNullable<
      Awaited<ReturnType<IRubataRepository['placeOfferAtomic']>>['errorCode']
    >
  ): ReturnType<typeof fail> {
    const errorMessages = {
      ENTRY_NOT_FOUND: 'Voce tabellone non trovata',
      ENTRY_ALREADY_IN_AUCTION: 'Questa voce è già in asta',
      INSUFFICIENT_BUDGET: 'Budget insufficiente per questa offerta',
      OFFER_TOO_LOW: 'L\'offerta deve essere superiore all\'offerta corrente',
      CANNOT_BID_OWN_PLAYER: 'Non puoi fare offerte per un tuo giocatore',
    }

    const message = errorMessages[errorCode]
    const errorFactory = ERROR_MAP[errorCode]
    return fail(errorFactory(message))
  }
}
