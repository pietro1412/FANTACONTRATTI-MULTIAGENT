/**
 * Assign Prize Use Case - Application Layer
 * Assigns a prize to a member in a specific category
 */

import type { IPrizeRepository } from '../../domain/repositories/prize.repository.interface'
import type { AssignPrizeDto, AssignPrizeResultDto } from '../dto/prize.dto'
import { isValidPrizeAmount } from '../../domain/entities/prize.entity'
import type { Result} from '@/shared/infrastructure/http/result';
import { ok, fail } from '@/shared/infrastructure/http/result'
import {
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
  InternalError,
} from '@/shared/infrastructure/http/errors'

/**
 * Error type union for this use case
 */
export type AssignPrizeError =
  | ForbiddenError
  | NotFoundError
  | ConflictError
  | ValidationError
  | InternalError

/**
 * Use case for assigning a prize to a member
 *
 * Business rules:
 * - Only admin can assign prizes
 * - Prize phase must be initialized and not finalized
 * - Category must exist for the session
 * - Member must be active in the league
 * - Amount must be a non-negative integer
 * - Upserts the prize (creates or updates existing)
 */
export class AssignPrizeUseCase {
  constructor(private readonly prizeRepository: IPrizeRepository) {}

  /**
   * Execute the use case
   * @param dto - Assign prize request data
   * @returns Result containing assignment result or error
   */
  async execute(dto: AssignPrizeDto): Promise<Result<AssignPrizeResultDto, AssignPrizeError>> {
    try {
      const { sessionId, categoryId, memberId, amount, adminUserId } = dto

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

      // 4. Validate amount
      if (!isValidPrizeAmount(amount)) {
        return fail(new ValidationError("L'importo deve essere un numero intero >= 0"))
      }

      // 5. Verify category exists
      const category = await this.prizeRepository.getCategoryById(categoryId)
      if (!category) {
        return fail(new NotFoundError('Categoria non trovata'))
      }

      // 6. Verify target member exists and is active
      const members = await this.prizeRepository.getActiveMembers(session.leagueId)
      const targetMember = members.find(m => m.id === memberId)
      if (!targetMember) {
        return fail(new NotFoundError('Manager non trovato'))
      }

      // 7. Assign the prize (upsert)
      const prize = await this.prizeRepository.assignPrize({
        categoryId,
        memberId,
        amount,
        assignedBy: adminUserId,
      })

      return ok({
        prizeId: prize.id,
        categoryId: prize.categoryId,
        categoryName: category.name,
        memberId: prize.memberId,
        teamName: targetMember.teamName,
        amount: prize.amount,
        assignedAt: prize.assignedAt ?? new Date(),
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "Errore nell'assegnazione premio"
      return fail(new InternalError(message))
    }
  }
}
