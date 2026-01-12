/**
 * Create Prophecy Use Case - Application Layer
 *
 * Creates a prophecy prediction for a player movement.
 * Validates that the prediction window is open and user is involved in the movement.
 */

import { Result, ok, fail } from '../../../../shared/infrastructure/http/result'
import { ForbiddenError, ValidationError, NotFoundError } from '../../../../shared/infrastructure/http/errors'
import type { IMovementRepository, IProphecyRepository } from '../../domain/repositories/movement.repository.interface'
import type { CreateProphecyDto, ProphecyResultDto } from '../dto/movement.dto'

/**
 * Extended movement repository interface for prophecy creation
 */
export interface IMovementRepositoryWithDetails extends IMovementRepository {
  findByIdWithParties(id: string): Promise<{
    id: string
    leagueId: string
    playerId: string
    fromMemberId: string | null
    toMemberId: string | null
    player: {
      name: string
    }
  } | null>
}

export class CreateProphecyUseCase {
  constructor(
    private readonly movementRepository: IMovementRepositoryWithDetails,
    private readonly prophecyRepository: IProphecyRepository
  ) {}

  async execute(dto: CreateProphecyDto): Promise<Result<ProphecyResultDto, ForbiddenError | ValidationError | NotFoundError>> {
    // Validate content
    if (!dto.content || dto.content.trim().length === 0) {
      return fail(new ValidationError('La profezia non puo essere vuota'))
    }

    if (dto.content.length > 500) {
      return fail(new ValidationError('La profezia non puo superare i 500 caratteri'))
    }

    // Find the movement
    const movement = await this.movementRepository.findByIdWithParties(dto.movementId)
    if (!movement) {
      return fail(new NotFoundError('Movimento non trovato'))
    }

    // Check membership
    const memberId = await this.movementRepository.checkMembership(movement.leagueId, dto.userId)
    if (!memberId) {
      return fail(new ForbiddenError('Non sei membro di questa lega'))
    }

    // Check if user is involved in this movement
    const isBuyer = movement.toMemberId === memberId
    const isSeller = movement.fromMemberId === memberId

    if (!isBuyer && !isSeller) {
      return fail(new ForbiddenError('Solo chi acquista o chi cede puo fare una profezia'))
    }

    // Check if user already made a prophecy for this movement
    const existingProphecy = await this.prophecyRepository.findByMovementAndAuthor(dto.movementId, memberId)
    if (existingProphecy) {
      return fail(new ValidationError('Hai gia fatto una profezia per questo movimento'))
    }

    // Create prophecy
    const prophecy = await this.prophecyRepository.create({
      leagueId: movement.leagueId,
      playerId: movement.playerId,
      authorId: memberId,
      movementId: dto.movementId,
      authorRole: isBuyer ? 'BUYER' : 'SELLER',
      content: dto.content.trim(),
    })

    return ok({
      id: prophecy.id,
      content: prophecy.content,
      authorRole: prophecy.authorRole,
      playerName: movement.player.name,
      author: memberId,
    })
  }
}
