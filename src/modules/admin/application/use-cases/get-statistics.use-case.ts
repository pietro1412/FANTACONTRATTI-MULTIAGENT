/**
 * Get Statistics Use Case - Application Layer
 *
 * Returns league or session statistics.
 */

import type { Result} from '@/shared/infrastructure/http/result';
import { ok, fail } from '@/shared/infrastructure/http/result'
import { ForbiddenError, ValidationError, NotFoundError } from '@/shared/infrastructure/http/errors'
import type { IAdminRepository } from '../../domain/repositories/admin.repository.interface'
import type { GetStatisticsDto, LeagueStatisticsResultDto } from '../dto/admin.dto'

export class GetStatisticsUseCase {
  constructor(
    private readonly adminRepository: IAdminRepository
  ) {}

  async execute(dto: GetStatisticsDto): Promise<Result<LeagueStatisticsResultDto, ForbiddenError | ValidationError | NotFoundError>> {
    // Validate required fields
    if (!dto.leagueId) {
      return fail(new ValidationError('League ID is required'))
    }

    if (!dto.userId) {
      return fail(new ValidationError('User ID is required'))
    }

    // Check membership (any member can view statistics)
    const memberId = await this.adminRepository.checkMembership(dto.leagueId, dto.userId)
    if (!memberId) {
      return fail(new ForbiddenError('Non sei membro di questa lega'))
    }

    // Get league statistics
    const statistics = await this.adminRepository.getLeagueStatistics(dto.leagueId)
    if (!statistics) {
      return fail(new NotFoundError('Lega non trovata'))
    }

    return ok(statistics)
  }
}
