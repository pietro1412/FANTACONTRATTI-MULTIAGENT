/**
 * Close Auction Use Case - Application Layer
 *
 * Handles closing an auction, awarding the player to the winner,
 * deducting budget, and publishing domain events.
 */

import type { Result} from '@/shared/infrastructure/http/result';
import { ok, fail } from '@/shared/infrastructure/http/result'
import type {
  ConflictError} from '@/shared/infrastructure/http/errors';
import {
  NotFoundError,
  AuctionClosedError,
} from '@/shared/infrastructure/http/errors'
import { DomainEventTypes } from '@/shared/infrastructure/events/domain-events'
import type { EventBus } from '@/shared/infrastructure/events/event-bus'
import type { IAuctionRepository } from '../../domain/repositories/auction.repository.interface'
import type { CloseAuctionDto, CloseAuctionResultDto } from '../dto/auction.dto'

/**
 * Roster service interface for player assignment
 */
export interface IRosterService {
  awardPlayer(memberId: string, playerId: string, acquisitionPrice: number): Promise<void>
  deductBudget(memberId: string, amount: number): Promise<void>
}

/**
 * Player service interface for getting player information
 */
export interface IPlayerService {
  getPlayer(playerId: string): Promise<{
    id: string
    name: string
    position: string
    team: string
  } | null>
}

/**
 * Member service interface for getting member information
 */
export interface IMemberService {
  getMemberName(memberId: string): Promise<string | null>
}

/**
 * Close Auction Use Case
 *
 * Closes an auction and handles all side effects:
 * - Awards player to winner (if any)
 * - Deducts budget from winner
 * - Updates auction status
 * - Publishes domain event
 */
export class CloseAuctionUseCase {
  constructor(
    private readonly auctionRepository: IAuctionRepository,
    private readonly eventBus: EventBus,
    private readonly rosterService: IRosterService,
    private readonly playerService: IPlayerService,
    private readonly memberService: IMemberService
  ) {}

  /**
   * Execute the close auction use case
   *
   * @param dto - CloseAuctionDto containing auction ID and admin user ID
   * @returns Result with CloseAuctionResultDto on success, AppError on failure
   */
  async execute(
    dto: CloseAuctionDto
  ): Promise<Result<CloseAuctionResultDto, NotFoundError | ConflictError>> {
    const { auctionId } = dto

    // ==================== FIND AUCTION ====================
    const auction = await this.auctionRepository.findById(auctionId)

    if (!auction) {
      return fail(new NotFoundError('Asta non trovata', { auctionId }))
    }

    // ==================== CHECK AUCTION STATUS ====================
    if (auction.status !== 'ACTIVE') {
      return fail(new AuctionClosedError({ auctionId, status: auction.status }))
    }

    // ==================== GET WINNING BID ====================
    const winningBid = await this.auctionRepository.getWinningBid(auctionId)

    // ==================== GET PLAYER INFO ====================
    const player = await this.playerService.getPlayer(auction.playerId)
    const playerName = player?.name ?? 'Unknown Player'

    // ==================== DETERMINE WINNER ====================
    const winnerId = winningBid?.bidderId ?? null
    const finalAmount = winningBid?.amount ?? 0
    const wasAcquired = winnerId !== null

    // ==================== GET WINNER NAME ====================
    let winnerName: string | null = null
    if (winnerId) {
      winnerName = await this.memberService.getMemberName(winnerId)
    }

    // ==================== AWARD PLAYER AND DEDUCT BUDGET ====================
    if (winnerId && wasAcquired) {
      await this.rosterService.awardPlayer(winnerId, auction.playerId, finalAmount)
      await this.rosterService.deductBudget(winnerId, finalAmount)
    }

    // ==================== CLOSE AUCTION IN REPOSITORY ====================
    await this.auctionRepository.close(auctionId, winnerId, finalAmount)

    // ==================== PUBLISH DOMAIN EVENT ====================
    await this.eventBus.publish(DomainEventTypes.AUCTION_CLOSED, {
      auctionId,
      winnerId,
      finalAmount,
    })

    // ==================== RETURN SUCCESS RESULT ====================
    return ok({
      success: true,
      winnerId,
      winnerName,
      finalAmount,
      playerId: auction.playerId,
      playerName,
      wasAcquired,
    })
  }
}
