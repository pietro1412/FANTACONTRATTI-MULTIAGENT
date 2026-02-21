/**
 * Create Auction Use Case - Application Layer
 *
 * Handles creating a new auction for a player in a market session.
 * Validates session state, player availability, and publishes domain events.
 */

import type { Result} from '@/shared/infrastructure/http/result';
import { ok, fail } from '@/shared/infrastructure/http/result'
import type {
  ValidationError} from '@/shared/infrastructure/http/errors';
import {
  NotFoundError,
  ConflictError,
  SessionNotActiveError,
  PlayerNotFoundError,
} from '@/shared/infrastructure/http/errors'
import { DomainEventTypes } from '@/shared/infrastructure/events/domain-events'
import type { EventBus } from '@/shared/infrastructure/events/event-bus'
import type { IAuctionRepository } from '../../domain/repositories/auction.repository.interface'

import type { CreateAuctionDto, CreateAuctionResultDto } from '../dto/auction.dto'

/**
 * Session service interface for getting session information
 */
export interface ISessionService {
  getSession(sessionId: string): Promise<{
    id: string
    leagueId: string
    status: string
    timerDuration: number
    currentPhase: string
  } | null>
  isAdmin(memberId: string, leagueId: string): Promise<boolean>
  getTimerDuration(sessionId: string): Promise<number>
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
    quotation: number
  } | null>
  isPlayerAvailable(playerId: string, leagueId: string): Promise<boolean>
}

/**
 * Create Auction Use Case
 *
 * Creates a new auction with proper validations and event publishing.
 */
export class CreateAuctionUseCase {
  constructor(
    private readonly auctionRepository: IAuctionRepository,
    private readonly eventBus: EventBus,
    private readonly sessionService: ISessionService,
    private readonly playerService: IPlayerService
  ) {}

  /**
   * Execute the create auction use case
   *
   * @param dto - CreateAuctionDto containing session, player, price, and nominator
   * @returns Result with CreateAuctionResultDto on success, AppError on failure
   */
  async execute(
    dto: CreateAuctionDto
  ): Promise<Result<CreateAuctionResultDto, ValidationError | NotFoundError | ConflictError>> {
    const { sessionId, playerId, startingPrice, nominatorId, type = 'FREE' } = dto

    // ==================== VALIDATE SESSION ====================
    const session = await this.sessionService.getSession(sessionId)

    if (!session) {
      return fail(new NotFoundError('Sessione non trovata', { sessionId }))
    }

    if (session.status !== 'ACTIVE') {
      return fail(new SessionNotActiveError({ sessionId, status: session.status }))
    }

    // ==================== CHECK FOR EXISTING ACTIVE AUCTION ====================
    const existingAuction = await this.auctionRepository.findActiveBySession(sessionId)

    if (existingAuction) {
      return fail(
        new ConflictError(
          'C\'è già un\'asta attiva. Chiudila prima di nominarne un\'altra.',
          { sessionId, existingAuctionId: existingAuction.id }
        )
      )
    }

    // ==================== VALIDATE PLAYER ====================
    const player = await this.playerService.getPlayer(playerId)

    if (!player) {
      return fail(new PlayerNotFoundError({ playerId }))
    }

    // ==================== CHECK PLAYER AVAILABILITY ====================
    const isAvailable = await this.playerService.isPlayerAvailable(playerId, session.leagueId)

    if (!isAvailable) {
      return fail(
        new ConflictError(
          'Giocatore già in una rosa',
          { playerId, playerName: player.name }
        )
      )
    }

    // ==================== GET TIMER DURATION ====================
    const timerDuration = await this.sessionService.getTimerDuration(sessionId)

    // ==================== CREATE AUCTION ====================
    const auction = await this.auctionRepository.create({
      marketSessionId: sessionId,
      playerId,
      startingPrice,
      timerDuration,
      type: type,
      nominatorId,
    })

    // ==================== PUBLISH DOMAIN EVENT ====================
    await this.eventBus.publish(DomainEventTypes.AUCTION_CREATED, {
      auctionId: auction.id,
      sessionId,
      playerId,
    })

    // ==================== RETURN SUCCESS RESULT ====================
    return ok({
      auctionId: auction.id,
      playerId: player.id,
      playerName: player.name,
      startingPrice: auction.startingPrice,
      timerDuration: auction.timerDuration,
      timerExpiresAt: auction.timerExpiresAt!,
    })
  }
}
