/**
 * Accept Trade Use Case - Application Layer
 * Handles the acceptance of a trade offer with validation and execution
 */

import type { ITradeRepository } from '../../domain/repositories/trade.repository.interface'
import type { ITradeValidator } from '../../domain/services/trade-validator.service'
import { canRespondToTrade, isTradeExpired } from '../../domain/entities/trade-offer.entity'
import type { Result} from '@/shared/infrastructure/http/result';
import { ok, fail } from '@/shared/infrastructure/http/result'
import { ValidationError, NotFoundError, InternalError, ForbiddenError } from '@/shared/infrastructure/http/errors'

/**
 * Input for accepting a trade offer
 */
export interface AcceptTradeInput {
  tradeId: string
  receiverId: string  // The member accepting the trade
}

/**
 * Output of successful trade acceptance
 */
export interface AcceptTradeOutput {
  tradeId: string
  message: string
}

/**
 * Domain event for trade accepted
 */
export interface TradeAcceptedEvent {
  type: 'TRADE_ACCEPTED'
  tradeId: string
  leagueId: string
  senderId: string
  receiverId: string
  senderPlayers: string[]
  receiverPlayers: string[]
  senderBudget: number
  receiverBudget: number
  timestamp: Date
}

/**
 * Use case for accepting a trade offer
 *
 * Business rules:
 * - Validates trade exists and is still pending
 * - Validates receiver is authorized to accept
 * - Validates trade has not expired
 * - Validates trade window is still open
 * - Validates receiver owns requested players
 * - Validates receiver has requested budget
 * - Executes trade (swaps players and budgets)
 * - Updates rosters via Roster module events
 * - Publishes TradeAccepted domain event
 */
export class AcceptTradeUseCase {
  private eventHandler?: (event: TradeAcceptedEvent) => void

  constructor(
    private readonly tradeRepository: ITradeRepository,
    private readonly tradeValidator: ITradeValidator
  ) {}

  /**
   * Set event handler for TradeAccepted events
   */
  onTradeAccepted(handler: (event: TradeAcceptedEvent) => void): void {
    this.eventHandler = handler
  }

  /**
   * Execute the trade acceptance
   * @param input - The trade acceptance parameters
   * @returns Result containing the acceptance confirmation or error
   */
  async execute(
    input: AcceptTradeInput
  ): Promise<Result<AcceptTradeOutput, ValidationError | NotFoundError | ForbiddenError | InternalError>> {
    try {
      // Find the trade offer
      const trade = await this.tradeRepository.findById(input.tradeId)
      if (!trade) {
        return fail(new NotFoundError('Offerta non trovata'))
      }

      // Validate receiver is authorized
      if (trade.receiverId !== input.receiverId) {
        return fail(new ForbiddenError('Non sei autorizzato ad accettare questa offerta'))
      }

      // Validate trade can be responded to (status is PENDING)
      if (!canRespondToTrade(trade)) {
        return fail(new ValidationError('Questa offerta non è più valida'))
      }

      // Check if trade has expired
      if (isTradeExpired(trade)) {
        // Mark as expired
        await this.tradeRepository.updateStatus(input.tradeId, 'EXPIRED')
        return fail(new ValidationError('Questa offerta è scaduta'))
      }

      // Check if trade window is still open
      const isWindowOpen = await this.tradeValidator.isTradeWindowOpen(trade.leagueId)
      if (!isWindowOpen) {
        return fail(new ForbiddenError('Puoi accettare scambi solo durante la fase SCAMBI/OFFERTE'))
      }

      // Re-validate assets at acceptance time
      // This ensures nothing has changed since the offer was created
      const assetValidation = await this.tradeValidator.validateAssets(trade)
      if (!assetValidation.isValid) {
        return fail(new ValidationError(assetValidation.errors[0] ?? 'Validazione asset fallita'))
      }

      // Execute the trade (swap players and budgets)
      await this.tradeRepository.executeTrade(
        trade.id,
        trade.senderId,
        trade.receiverId,
        trade.senderPlayers,
        trade.receiverPlayers,
        trade.senderBudget,
        trade.receiverBudget
      )

      // Mark trade as accepted
      await this.tradeRepository.updateStatus(input.tradeId, 'ACCEPTED', new Date())

      // Publish domain event
      if (this.eventHandler) {
        this.eventHandler({
          type: 'TRADE_ACCEPTED',
          tradeId: trade.id,
          leagueId: trade.leagueId,
          senderId: trade.senderId,
          receiverId: trade.receiverId,
          senderPlayers: trade.senderPlayers,
          receiverPlayers: trade.receiverPlayers,
          senderBudget: trade.senderBudget,
          receiverBudget: trade.receiverBudget,
          timestamp: new Date(),
        })
      }

      return ok({
        tradeId: trade.id,
        message: 'Scambio completato!',
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Errore nell\'accettazione dell\'offerta'
      return fail(new InternalError(message))
    }
  }
}
