/**
 * Unassign Prize Use Case - Application Layer
 * Removes a prize assignment from a member
 */

import type { IPrizeRepository } from '../../domain/repositories/prize.repository.interface'
import type { UnassignPrizeDto, UnassignPrizeResultDto } from '../dto/prize.dto'
import type { Result} from '@/shared/infrastructure/http/result';
import { ok, fail } from '@/shared/infrastructure/http/result'
import {
  ForbiddenError,
  NotFoundError,
  ConflictError,
  InternalError,
} from '@/shared/infrastructure/http/errors'

/**
 * Error type union for this use case
 */
export type UnassignPrizeError = ForbiddenError | NotFoundError | ConflictError | InternalError

/**
 * Use case for unassigning a prize from a member
 *
 * Business rules:
 * - Only admin can unassign prizes
 * - Prize phase must not be finalized
 * - Prize must exist for the member/category combination
 * - Returns the budget to the pool
 */
export class UnassignPrizeUseCase {
  constructor(private readonly prizeRepository: IPrizeRepository) {}

  /**
   * Execute the use case
   * @param dto - Unassign prize request data
   * @returns Result containing unassignment result or error
   */
  async execute(dto: UnassignPrizeDto): Promise<Result<UnassignPrizeResultDto, UnassignPrizeError>> {
    try {
      const { sessionId, categoryId, memberId, adminUserId } = dto

      // 1. Verify session exists
      const session = await this.prizeRepository.getSession(sessionId)
      if (!session) {
        return fail(new NotFoundError('Sessione non trovata'))
      }

      // 2. Verify admin permission
      const adminMember = await this.prizeRepository.getMemberByUserId(adminUserId, session.leagueId)
      if (!adminMember || adminMember.role !== 'ADMIN') {
        return fail(new ForbiddenError('Non autorizzato'))
      }

      // 3. Verify prize phase is initialized and not finalized
      const config = await this.prizeRepository.getConfig(sessionId)
      if (!config) {
        return fail(new NotFoundError('Fase premi non inizializzata'))
      }

      if (config.status === 'FINALIZED') {
        return fail(new ConflictError('La fase premi è già stata finalizzata'))
      }

      // 4. Verify the prize exists
      const existingPrize = await this.prizeRepository.getPrize(categoryId, memberId)
      if (!existingPrize) {
        return fail(new NotFoundError('Premio non trovato'))
      }

      const amountReturned = existingPrize.amount

      // 5. Unassign the prize
      await this.prizeRepository.unassignPrize(categoryId, memberId)

      return ok({
        categoryId,
        memberId,
        amountReturned,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Errore nella rimozione premio'
      return fail(new InternalError(message))
    }
  }
}
