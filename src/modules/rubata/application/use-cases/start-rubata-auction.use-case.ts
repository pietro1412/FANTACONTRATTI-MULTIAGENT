/**
 * StartRubataAuctionUseCase
 *
 * Application layer use case for starting an auction for a rubata board entry.
 * This is triggered when the offer phase ends and there's a highest offer.
 */

import type { Result } from '@/shared/infrastructure/http/result'
import { ok, fail } from '@/shared/infrastructure/http/result'
import {
  ValidationError,
  NotFoundError,
  ConflictError,
} from '@/shared/infrastructure/http/errors'
import type { EventBus } from '@/shared/infrastructure/events'
import { DomainEventTypes, type RubataAuctionStarted } from '@/shared/infrastructure/events'
import type { IRubataRepository } from '../../domain/repositories/rubata.repository.interface'
import type { StartAuctionDto, StartAuctionResultDto } from '../dto/rubata.dto'

/**
 * Interface for the Auction module integration
 * This abstracts the auction creation to maintain module boundaries
 */
export interface IAuctionService {
  createRubataAuction(data: {
    sessionId: string
    playerId: string
    sellerId: string
    basePrice: number
    initialBidderId: string
  }): Promise<{ auctionId: string }>
}

/**
 * StartRubataAuctionUseCase
 *
 * Handles starting an auction for a rubata entry with the following responsibilities:
 * - Selects the entry with the highest offer
 * - Creates an auction using the Auction module
 * - Locks the entry from further offers
 * - Publishes RubataAuctionStarted domain event
 */
export class StartRubataAuctionUseCase {
  constructor(
    private readonly rubataRepository: IRubataRepository,
    private readonly auctionService: IAuctionService,
    private readonly eventBus: EventBus
  ) {}

  /**
   * Execute the start rubata auction use case
   * @param input - The input containing session ID and board entry ID
   * @returns A Result containing the auction result or an error
   */
  async execute(
    input: StartAuctionDto
  ): Promise<Result<StartAuctionResultDto, ValidationError | NotFoundError | ConflictError>> {
    try {
      const { sessionId, boardEntryId } = input

      // Validate input
      const validationError = this.validateInput(input)
      if (validationError) {
        return fail(validationError)
      }

      // Get the board entry with details
      const boardEntry = await this.rubataRepository.getBoardEntry(boardEntryId)
      if (!boardEntry) {
        return fail(new NotFoundError('Voce tabellone non trovata'))
      }

      // Verify entry belongs to this session
      if (boardEntry.sessionId !== sessionId) {
        return fail(new ValidationError('La voce non appartiene a questa sessione'))
      }

      // Check entry is in correct status
      if (boardEntry.status !== 'PENDING') {
        return fail(
          new ConflictError(
            'Questa voce non è in stato valido per iniziare un\'asta'
          )
        )
      }

      // Get the highest offer
      const highestOffer = await this.rubataRepository.getHighestOffer(boardEntryId)
      if (!highestOffer) {
        return fail(new ValidationError('Nessuna offerta presente per questa voce'))
      }

      // Get detailed board entry for auction creation
      const detailedEntry = await this.rubataRepository.getCurrentBoardEntry(sessionId)
      if (!detailedEntry) {
        return fail(new NotFoundError('Dettagli voce tabellone non trovati'))
      }

      // Lock the entry (update status to IN_AUCTION)
      await this.rubataRepository.updateBoardEntryStatus(boardEntryId, 'IN_AUCTION')

      // Cancel all other pending offers for this entry
      await this.rubataRepository.cancelPendingOffers(boardEntryId)

      // Create the auction via auction service
      const { auctionId } = await this.auctionService.createRubataAuction({
        sessionId,
        playerId: boardEntry.playerId,
        sellerId: boardEntry.memberId,
        basePrice: detailedEntry.rubataBasePrice,
        initialBidderId: highestOffer.offeredByMemberId,
      })

      // Update session phase
      await this.rubataRepository.updateSessionPhase(sessionId, 'AUCTION')

      // Publish domain event
      const event: RubataAuctionStarted = {
        sessionId,
        playerId: boardEntry.playerId,
      }
      await this.eventBus.publish(DomainEventTypes.RUBATA_AUCTION_STARTED, event)

      return ok({
        auctionId,
        boardEntry: detailedEntry,
        startingPrice: highestOffer.amount,
        initialBidderId: highestOffer.offeredByMemberId,
      })
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Errore durante l\'avvio dell\'asta rubata'
      return fail(new ValidationError(errorMessage))
    }
  }

  /**
   * Validates the input data
   */
  private validateInput(input: StartAuctionDto): ValidationError | null {
    if (!input.sessionId || input.sessionId.trim().length === 0) {
      return new ValidationError('ID sessione obbligatorio')
    }

    if (!input.boardEntryId || input.boardEntryId.trim().length === 0) {
      return new ValidationError('ID voce tabellone obbligatorio')
    }

    return null
  }
}
