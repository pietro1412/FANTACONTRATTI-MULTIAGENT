/**
 * Counter Offer Use Case - Application Layer
 * Handles creating a counter offer in response to a trade offer
 */

import type { ITradeRepository } from '../../domain/repositories/trade.repository.interface'
import type { ITradeValidator } from '../../domain/services/trade-validator.service'
import type { TradeOffer } from '../../domain/entities/trade-offer.entity'
import { canRespondToTrade, isTradeExpired } from '../../domain/entities/trade-offer.entity'
import type { Result} from '@/shared/infrastructure/http/result';
import { ok, fail } from '@/shared/infrastructure/http/result'
import { ValidationError, NotFoundError, InternalError, ForbiddenError } from '@/shared/infrastructure/http/errors'

/**
 * Input for creating a counter offer
 */
export interface CounterOfferInput {
  originalTradeId: string
  senderId: string           // The one making the counter (original receiver)
  senderPlayers: string[]    // rosterId[]
  receiverPlayers: string[]  // rosterId[]
  senderBudget: number
  receiverBudget: number
  message?: string
  durationHours?: number
}

/**
 * Output of successful counter offer creation
 */
export interface CounterOfferOutput {
  originalTradeId: string
  counterOffer: TradeOffer
  message: string
}

/**
 * Domain event for counter offer made
 */
export interface CounterOfferMadeEvent {
  type: 'COUNTER_OFFER_MADE'
  originalTradeId: string
  counterOfferId: string
  leagueId: string
  senderId: string
  receiverId: string
  timestamp: Date
}

/**
 * Use case for creating a counter offer
 *
 * Business rules:
 * - Validates original trade exists and is pending
 * - Validates sender was the original receiver
 * - Creates new trade offer linked to original
 * - Marks original as COUNTERED
 * - Publishes CounterOfferMade domain event
 */
export class CounterOfferUseCase {
  private eventHandler?: (event: CounterOfferMadeEvent) => void

  constructor(
    private readonly tradeRepository: ITradeRepository,
    private readonly tradeValidator: ITradeValidator
  ) {}

  /**
   * Set event handler for CounterOfferMade events
   */
  onCounterOfferMade(handler: (event: CounterOfferMadeEvent) => void): void {
    this.eventHandler = handler
  }

  /**
   * Execute the counter offer creation
   * @param input - The counter offer parameters
   * @returns Result containing the counter offer or error
   */
  async execute(
    input: CounterOfferInput
  ): Promise<Result<CounterOfferOutput, ValidationError | NotFoundError | ForbiddenError | InternalError>> {
    try {
      // Find the original trade offer
      const originalTrade = await this.tradeRepository.findById(input.originalTradeId)
      if (!originalTrade) {
        return fail(new NotFoundError('Offerta originale non trovata'))
      }

      // Validate sender was the original receiver
      if (originalTrade.receiverId !== input.senderId) {
        return fail(new ForbiddenError('Non sei autorizzato a controffertare'))
      }

      // Validate original trade can be responded to
      if (!canRespondToTrade(originalTrade)) {
        return fail(new ValidationError('Questa offerta non è più valida'))
      }

      // Check if original trade has expired
      if (isTradeExpired(originalTrade)) {
        await this.tradeRepository.updateStatus(input.originalTradeId, 'EXPIRED')
        return fail(new ValidationError('Questa offerta è scaduta'))
      }

      // Check if trade window is still open
      const isWindowOpen = await this.tradeValidator.isTradeWindowOpen(originalTrade.leagueId)
      if (!isWindowOpen) {
        return fail(new ForbiddenError('Puoi controffertare solo durante la fase SCAMBI/OFFERTE'))
      }

      // Create temporary trade object for validation (with swapped sender/receiver)
      const tempTrade: TradeOffer = {
        id: 'temp',
        leagueId: originalTrade.leagueId,
        senderId: input.senderId,
        receiverId: originalTrade.senderId, // Original sender becomes receiver
        senderPlayers: input.senderPlayers,
        receiverPlayers: input.receiverPlayers,
        senderBudget: input.senderBudget,
        receiverBudget: input.receiverBudget,
        status: 'PENDING',
        message: input.message,
        createdAt: new Date(),
        respondedAt: null,
        expiresAt: null,
        counterOfferId: null,
        marketSessionId: originalTrade.marketSessionId,
      }

      // Validate assets for the counter offer
      const assetValidation = await this.tradeValidator.validateAssets(tempTrade)
      if (!assetValidation.isValid) {
        return fail(new ValidationError(assetValidation.errors[0]))
      }

      // Mark original trade as countered
      await this.tradeRepository.updateStatus(input.originalTradeId, 'COUNTERED', new Date())

      // Calculate expiration date for counter offer
      const durationHours = input.durationHours ?? 24
      const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000)

      // Create the counter offer (swapped sender/receiver)
      const counterOffer = await this.tradeRepository.create({
        leagueId: originalTrade.leagueId,
        senderId: input.senderId,
        receiverId: originalTrade.senderId, // Original sender becomes receiver
        senderPlayers: input.senderPlayers,
        receiverPlayers: input.receiverPlayers,
        senderBudget: input.senderBudget,
        receiverBudget: input.receiverBudget,
        message: input.message || `Controofferta a offerta #${input.originalTradeId.slice(-6)}`,
        expiresAt,
        marketSessionId: originalTrade.marketSessionId ?? undefined,
      })

      // Link the counter offer to the original
      await this.tradeRepository.setCounterOffer(input.originalTradeId, counterOffer.id)

      // Publish domain event
      if (this.eventHandler) {
        this.eventHandler({
          type: 'COUNTER_OFFER_MADE',
          originalTradeId: originalTrade.id,
          counterOfferId: counterOffer.id,
          leagueId: originalTrade.leagueId,
          senderId: input.senderId,
          receiverId: originalTrade.senderId,
          timestamp: new Date(),
        })
      }

      return ok({
        originalTradeId: originalTrade.id,
        counterOffer,
        message: 'Controofferta inviata',
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Errore nella creazione della controofferta'
      return fail(new InternalError(message))
    }
  }
}
