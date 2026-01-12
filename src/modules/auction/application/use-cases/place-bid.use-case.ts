/**
 * Place Bid Use Case - Application Layer
 *
 * CRITICAL: This is a performance-critical use case for real-time auctions.
 *
 * Handles placing a bid on an active auction with:
 * - Race condition prevention via atomic transactions
 * - Budget validation
 * - Timer reset logic
 * - Outbid detection
 * - Domain event publishing
 */

import { Result, ok, fail } from '../../../../shared/infrastructure/http/result'
import {
  ValidationError,
  NotFoundError,
  ConflictError,
  InsufficientBudgetError,
  AuctionClosedError,
  OutbidError,
} from '../../../../shared/infrastructure/http/errors'
import { DomainEventTypes } from '../../../../shared/infrastructure/events/domain-events'
import type { EventBus } from '../../../../shared/infrastructure/events/event-bus'
import type { IAuctionRepository, PlaceBidData } from '../../domain/repositories/auction.repository.interface'
import { BidAmount } from '../../domain/entities/bid.entity'
import type { PlaceBidDto, BidResultDto } from '../dto/auction.dto'

/**
 * Budget service interface for checking member budget and slot availability
 */
export interface IBudgetService {
  getBudget(memberId: string): Promise<number>
  hasSlotAvailable(memberId: string, playerId: string): Promise<boolean>
}

/**
 * Place Bid Use Case
 *
 * Validates and processes a bid on an active auction.
 * Uses atomic database operations to prevent race conditions.
 */
export class PlaceBidUseCase {
  constructor(
    private readonly auctionRepository: IAuctionRepository,
    private readonly eventBus: EventBus,
    private readonly budgetService: IBudgetService
  ) {}

  /**
   * Execute the place bid use case
   *
   * @param dto - PlaceBidDto containing auction, bidder, and amount
   * @returns Result with BidResultDto on success, AppError on failure
   */
  async execute(
    dto: PlaceBidDto
  ): Promise<Result<BidResultDto, ValidationError | NotFoundError | ConflictError | InsufficientBudgetError>> {
    const { auctionId, bidderId, amount } = dto

    // ==================== VALIDATE BID AMOUNT ====================
    // Early validation before any DB calls for performance
    try {
      new BidAmount(amount)
    } catch (error) {
      if (error instanceof ValidationError) {
        return fail(error)
      }
      return fail(new ValidationError('Importo offerta non valido'))
    }

    // ==================== FIND AUCTION ====================
    const auction = await this.auctionRepository.findById(auctionId)

    if (!auction) {
      return fail(new NotFoundError('Asta non trovata', { auctionId }))
    }

    // ==================== CHECK AUCTION STATUS ====================
    if (auction.status !== 'ACTIVE') {
      return fail(new AuctionClosedError({ auctionId, status: auction.status }))
    }

    // ==================== VALIDATE BID > CURRENT PRICE ====================
    if (amount <= auction.currentPrice) {
      return fail(
        new ValidationError(
          `Offerta minima: ${auction.currentPrice + 1}`,
          { currentPrice: auction.currentPrice, bidAmount: amount }
        )
      )
    }

    // ==================== CHECK BUDGET ====================
    const budget = await this.budgetService.getBudget(bidderId)

    if (amount > budget) {
      return fail(
        new InsufficientBudgetError({
          budget,
          bidAmount: amount,
          shortfall: amount - budget,
        })
      )
    }

    // ==================== CHECK SLOT AVAILABILITY ====================
    const hasSlot = await this.budgetService.hasSlotAvailable(bidderId, auction.playerId)

    if (!hasSlot) {
      return fail(
        new ValidationError(
          'Hai già raggiunto il limite di giocatori in questo ruolo',
          { bidderId, playerId: auction.playerId }
        )
      )
    }

    // ==================== CALCULATE NEW TIMER ====================
    const newTimerExpiresAt = new Date(Date.now() + auction.timerDuration * 1000)

    // ==================== PLACE BID ATOMICALLY ====================
    const bidData: PlaceBidData = {
      auctionId,
      bidderId,
      amount,
      newTimerExpiresAt,
    }

    const placeBidResult = await this.auctionRepository.placeBidAtomic(auctionId, bidData)

    // ==================== HANDLE ATOMIC OPERATION RESULT ====================
    if (!placeBidResult.success) {
      switch (placeBidResult.error) {
        case 'AUCTION_NOT_FOUND':
          return fail(new NotFoundError('Asta non trovata', { auctionId }))

        case 'AUCTION_NOT_ACTIVE':
          return fail(new AuctionClosedError({ auctionId }))

        case 'BID_TOO_LOW':
          return fail(
            new OutbidError({
              message: 'La tua offerta è stata superata da un altro giocatore',
              auctionId,
            })
          )

        case 'CONCURRENT_BID':
          return fail(
            new ConflictError(
              'Offerta concorrente rilevata. Riprova.',
              { auctionId, bidderId }
            )
          )

        default:
          return fail(new ConflictError('Errore durante il piazzamento dell\'offerta'))
      }
    }

    // ==================== PUBLISH DOMAIN EVENT ====================
    await this.eventBus.publish(DomainEventTypes.BID_PLACED, {
      auctionId,
      bidderId,
      amount,
    })

    // ==================== RETURN SUCCESS RESULT ====================
    const outbid = placeBidResult.previousWinnerId !== null

    return ok({
      success: true,
      currentPrice: amount,
      timerExpiresAt: newTimerExpiresAt,
      outbid,
      previousWinnerId: placeBidResult.previousWinnerId,
    })
  }
}
