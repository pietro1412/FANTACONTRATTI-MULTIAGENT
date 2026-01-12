/**
 * Record Movement Use Case - Application Layer
 *
 * Records a player movement when players change hands.
 * Called by event handlers when: AuctionClosed, RubataCompleted,
 * SvincolatiAuctionClosed, TradeAccepted
 */

import { Result, ok, fail } from '../../../../shared/infrastructure/http/result'
import { ValidationError } from '../../../../shared/infrastructure/http/errors'
import type { IMovementRepository } from '../../domain/repositories/movement.repository.interface'
import type { RecordMovementDto } from '../dto/movement.dto'

/**
 * Result type for movement recording
 */
export interface RecordMovementResultDto {
  movementId: string
}

export class RecordMovementUseCase {
  constructor(
    private readonly movementRepository: IMovementRepository
  ) {}

  async execute(dto: RecordMovementDto): Promise<Result<RecordMovementResultDto, ValidationError>> {
    // Validate required fields
    if (!dto.leagueId) {
      return fail(new ValidationError('League ID is required'))
    }

    if (!dto.playerId) {
      return fail(new ValidationError('Player ID is required'))
    }

    if (!dto.movementType) {
      return fail(new ValidationError('Movement type is required'))
    }

    // Validate movement type
    const validTypes = ['FIRST_MARKET', 'TRADE', 'RUBATA', 'SVINCOLATI', 'RELEASE', 'CONTRACT_RENEW']
    if (!validTypes.includes(dto.movementType)) {
      return fail(new ValidationError(`Invalid movement type: ${dto.movementType}`))
    }

    // For transfers, at least one of fromMemberId or toMemberId should be present
    if (!dto.fromMemberId && !dto.toMemberId) {
      // Only allow if it's a RELEASE type (player becomes free agent)
      if (dto.movementType !== 'RELEASE') {
        return fail(new ValidationError('At least one party (from/to) must be specified'))
      }
    }

    // Create the movement
    const movementId = await this.movementRepository.create({
      leagueId: dto.leagueId,
      playerId: dto.playerId,
      movementType: dto.movementType,
      fromMemberId: dto.fromMemberId,
      toMemberId: dto.toMemberId,
      price: dto.price,
      oldSalary: dto.oldSalary,
      oldDuration: dto.oldDuration,
      oldClause: dto.oldClause,
      newSalary: dto.newSalary,
      newDuration: dto.newDuration,
      newClause: dto.newClause,
      auctionId: dto.auctionId,
      tradeId: dto.tradeId,
      marketSessionId: dto.marketSessionId,
    })

    if (!movementId) {
      return fail(new ValidationError('Failed to record movement'))
    }

    return ok({ movementId })
  }
}
