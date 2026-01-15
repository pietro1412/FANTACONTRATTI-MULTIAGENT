/**
 * Create Trade Use Case - Application Layer
 * Handles the creation of a new trade offer with validation
 */

import type { ITradeRepository } from '../../domain/repositories/trade.repository.interface'
import type { ITradeValidator } from '../../domain/services/trade-validator.service'
import type { TradeOffer } from '../../domain/entities/trade-offer.entity'
import type { CreateTradeOfferDto, CreateTradeResultDto } from '../dto/trade.dto'
import { Result, ok, fail } from '../../../../shared/infrastructure/http/result'
import { ValidationError, NotFoundError, InternalError, ForbiddenError } from '../../../../shared/infrastructure/http/errors'

/**
 * Input for creating a trade offer
 */
export interface CreateTradeInput {
  leagueId: string
  senderId: string        // LeagueMemberId
  receiverId: string      // LeagueMemberId
  senderPlayers: string[] // rosterId[]
  receiverPlayers: string[]
  senderBudget: number
  receiverBudget: number
  message?: string
  durationHours?: number
}

/**
 * Output of successful trade creation
 */
export interface CreateTradeOutput {
  trade: TradeOffer
  message: string
}

/**
 * Domain event for trade offered
 */
export interface TradeOfferedEvent {
  type: 'TRADE_OFFERED'
  tradeId: string
  leagueId: string
  senderId: string
  receiverId: string
  timestamp: Date
}

/**
 * Use case for creating a new trade offer
 *
 * Business rules:
 * - Validates sender owns offered players
 * - Validates sender has offered budget
 * - Validates trade window is open
 * - Validates no anti-loop violation
 * - Creates pending trade offer
 * - Publishes TradeOffered domain event
 */
export class CreateTradeUseCase {
  private eventHandler?: (event: TradeOfferedEvent) => void

  constructor(
    private readonly tradeRepository: ITradeRepository,
    private readonly tradeValidator: ITradeValidator
  ) {}

  /**
   * Set event handler for TradeOffered events
   */
  onTradeOffered(handler: (event: TradeOfferedEvent) => void): void {
    this.eventHandler = handler
  }

  /**
   * Execute the trade creation
   * @param input - The trade creation parameters
   * @returns Result containing the created trade or error
   */
  async execute(
    input: CreateTradeInput
  ): Promise<Result<CreateTradeOutput, ValidationError | NotFoundError | ForbiddenError | InternalError>> {
    try {
      // Validate sender and receiver are different
      if (input.senderId === input.receiverId) {
        return fail(new ValidationError('Non puoi fare offerte a te stesso'))
      }

      // Check if trade window is open
      const isWindowOpen = await this.tradeValidator.isTradeWindowOpen(input.leagueId)
      if (!isWindowOpen) {
        return fail(new ForbiddenError('Puoi fare scambi solo durante la fase SCAMBI/OFFERTE'))
      }

      // Get active market session
      const marketSessionId = await this.tradeRepository.getActiveMarketSessionId(input.leagueId)

      // Create temporary trade object for validation
      const tempTrade: TradeOffer = {
        id: 'temp',
        leagueId: input.leagueId,
        senderId: input.senderId,
        receiverId: input.receiverId,
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
        marketSessionId,
      }

      // Validate assets (players and budget)
      const assetValidation = await this.tradeValidator.validateAssets(tempTrade)
      if (!assetValidation.isValid) {
        return fail(new ValidationError(assetValidation.errors[0]))
      }

      // Validate anti-loop rule
      const isAntiLoopValid = await this.tradeValidator.validateAntiLoop(tempTrade)
      if (!isAntiLoopValid) {
        return fail(new ValidationError('Non puoi fare uno scambio inverso nella stessa sessione di mercato'))
      }

      // Calculate expiration date
      const durationHours = input.durationHours ?? 24
      const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000)

      // Create the trade offer
      const trade = await this.tradeRepository.create({
        leagueId: input.leagueId,
        senderId: input.senderId,
        receiverId: input.receiverId,
        senderPlayers: input.senderPlayers,
        receiverPlayers: input.receiverPlayers,
        senderBudget: input.senderBudget,
        receiverBudget: input.receiverBudget,
        message: input.message,
        expiresAt,
        marketSessionId: marketSessionId ?? undefined,
      })

      // Publish domain event
      if (this.eventHandler) {
        this.eventHandler({
          type: 'TRADE_OFFERED',
          tradeId: trade.id,
          leagueId: trade.leagueId,
          senderId: trade.senderId,
          receiverId: trade.receiverId,
          timestamp: new Date(),
        })
      }

      return ok({
        trade,
        message: 'Offerta inviata',
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Errore nella creazione dell\'offerta'
      return fail(new InternalError(message))
    }
  }
}
