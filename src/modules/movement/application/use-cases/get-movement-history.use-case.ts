/**
 * Get Movement History Use Case - Application Layer
 *
 * Returns movement history for league/player/member.
 */

import { Result, ok, fail } from '../../../../shared/infrastructure/http/result'
import { ForbiddenError, ValidationError } from '../../../../shared/infrastructure/http/errors'
import type { IMovementRepository, FormattedMovement } from '../../domain/repositories/movement.repository.interface'
import type { GetMovementHistoryDto, MovementHistoryResultDto } from '../dto/movement.dto'

export class GetMovementHistoryUseCase {
  constructor(
    private readonly movementRepository: IMovementRepository
  ) {}

  async execute(dto: GetMovementHistoryDto): Promise<Result<MovementHistoryResultDto, ForbiddenError | ValidationError>> {
    // Validate required fields
    if (!dto.leagueId) {
      return fail(new ValidationError('League ID is required'))
    }

    if (!dto.userId) {
      return fail(new ValidationError('User ID is required'))
    }

    // Check membership
    const memberId = await this.movementRepository.checkMembership(dto.leagueId, dto.userId)
    if (!memberId) {
      return fail(new ForbiddenError('Non sei membro di questa lega'))
    }

    // Get movements with filters
    const movements: FormattedMovement[] = await this.movementRepository.findMany({
      leagueId: dto.leagueId,
      playerId: dto.playerId,
      movementType: dto.movementType,
      semester: dto.semester,
      limit: dto.limit ?? 100,
      offset: dto.offset ?? 0,
    })

    return ok({
      movements,
    })
  }
}
