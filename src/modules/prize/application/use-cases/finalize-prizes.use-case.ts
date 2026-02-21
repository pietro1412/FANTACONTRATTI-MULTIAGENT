/**
 * Finalize Prizes Use Case - Application Layer
 * Finalizes the prize phase, applies all prizes to member budgets
 */

import type { IPrizeRepository } from '../../domain/repositories/prize.repository.interface'
import type { FinalizePrizesDto, FinalizePrizesResultDto } from '../dto/prize.dto'
import { calculateMemberTotalPrize } from '../../domain/entities/prize.entity'
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
export type FinalizePrizesError = ForbiddenError | NotFoundError | ConflictError | InternalError

/**
 * Use case for finalizing the prize phase
 *
 * Business rules:
 * - Only admin can finalize prizes
 * - Prize phase must be initialized
 * - Prize phase must not already be finalized
 * - Calculates total prize per member (base + all category prizes)
 * - Updates member budgets
 * - Marks phase as finalized
 */
export class FinalizePrizesUseCase {
  constructor(private readonly prizeRepository: IPrizeRepository) {}

  /**
   * Execute the use case
   * @param dto - Finalize prizes request data
   * @returns Result containing finalization result or error
   */
  async execute(dto: FinalizePrizesDto): Promise<Result<FinalizePrizesResultDto, FinalizePrizesError>> {
    try {
      const { sessionId, adminUserId } = dto

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

      // 3. Verify prize phase is initialized
      const config = await this.prizeRepository.getConfig(sessionId)
      if (!config) {
        return fail(new NotFoundError('Fase premi non inizializzata'))
      }

      // 4. Verify not already finalized
      if (config.status === 'FINALIZED') {
        return fail(new ConflictError('La fase premi è già stata finalizzata'))
      }

      // 5. Get all members and prizes
      const members = await this.prizeRepository.getActiveMembers(session.leagueId)
      const prizes = await this.prizeRepository.getPrizes(sessionId)

      // 6. Calculate totals per member
      const memberTotals: Map<string, number> = new Map()

      for (const member of members) {
        // Base reincrement applies to all
        const memberPrizes = prizes.filter(p => p.memberId === member.id)
        const total = calculateMemberTotalPrize(
          config.baseReincrement,
          memberPrizes.map(p => ({ amount: p.amount }))
        )
        memberTotals.set(member.id, total)
      }

      // 7. Update each member's budget
      const membersUpdated: FinalizePrizesResultDto['membersUpdated'] = []

      for (const member of members) {
        const totalPrize = memberTotals.get(member.id) ?? config.baseReincrement
        const newBudget = await this.prizeRepository.updateMemberBudget(member.id, totalPrize)

        membersUpdated.push({
          memberId: member.id,
          teamName: member.teamName,
          totalPrizeReceived: totalPrize,
          newBudget,
        })
      }

      // 8. Mark phase as finalized
      const finalizedAt = new Date()
      await this.prizeRepository.updateConfig(sessionId, {
        status: 'FINALIZED',
        finalizedAt,
      })

      return ok({
        sessionId,
        finalizedAt,
        membersUpdated,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Errore nella finalizzazione premi'
      return fail(new InternalError(message))
    }
  }
}
