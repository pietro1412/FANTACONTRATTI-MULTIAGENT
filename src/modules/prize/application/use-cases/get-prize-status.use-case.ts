/**
 * Get Prize Status Use Case - Application Layer
 * Returns the current state of the prize phase
 */

import type { IPrizeRepository } from '../../domain/repositories/prize.repository.interface'
import type { GetPrizeStatusDto, PrizeStatusResultDto, CategoryWithPrizesDto, MemberPrizeInfoDto } from '../dto/prize.dto'
import { calculateMemberTotalPrize } from '../../domain/entities/prize.entity'
import type { Result} from '@/shared/infrastructure/http/result';
import { ok, fail } from '@/shared/infrastructure/http/result'
import {
  ForbiddenError,
  NotFoundError,
  InternalError,
} from '@/shared/infrastructure/http/errors'

/**
 * Error type union for this use case
 */
export type GetPrizeStatusError = ForbiddenError | NotFoundError | InternalError

/**
 * Use case for getting the current prize phase status
 *
 * Business rules:
 * - User must be a member of the league
 * - Returns config, categories, and member info
 * - Admins see all categories and prizes
 * - Non-admins only see categories/prizes after finalization
 * - Total prizes visible to non-admins only after finalization
 */
export class GetPrizeStatusUseCase {
  constructor(private readonly prizeRepository: IPrizeRepository) {}

  /**
   * Execute the use case
   * @param dto - Get prize status request data
   * @returns Result containing prize status or error
   */
  async execute(dto: GetPrizeStatusDto): Promise<Result<PrizeStatusResultDto, GetPrizeStatusError>> {
    try {
      const { sessionId, userId } = dto

      // 1. Verify session exists
      const session = await this.prizeRepository.getSession(sessionId)
      if (!session) {
        return fail(new NotFoundError('Sessione non trovata'))
      }

      // 2. Verify membership
      const member = await this.prizeRepository.getMemberByUserId(userId, session.leagueId)
      if (!member) {
        return fail(new ForbiddenError('Non sei membro di questa lega'))
      }

      const isAdmin = member.role === 'ADMIN'

      // 3. Get config
      const config = await this.prizeRepository.getConfig(sessionId)
      if (!config) {
        return fail(new NotFoundError('Fase premi non inizializzata'))
      }

      // 4. Get categories and prizes
      const categories = await this.prizeRepository.getCategoriesForSession(sessionId)
      const allPrizes = await this.prizeRepository.getPrizes(sessionId)

      // 5. Get all members
      const members = await this.prizeRepository.getActiveMembers(session.leagueId)

      // 6. Build categories with prizes (admin only or after finalization)
      const categoriesWithPrizes: CategoryWithPrizesDto[] = []

      if (isAdmin || config.status === 'FINALIZED') {
        for (const cat of categories) {
          const categoryPrizes = allPrizes.filter(p => p.categoryId === cat.id)
          categoriesWithPrizes.push({
            id: cat.id,
            name: cat.name,
            description: cat.description,
            isCustom: cat.isCustom,
            prizes: categoryPrizes.map(p => {
              const targetMember = members.find(m => m.id === p.memberId)
              return {
                memberId: p.memberId,
                teamName: targetMember?.teamName ?? '',
                username: targetMember?.username ?? '',
                amount: p.amount,
              }
            }),
          })
        }
      }

      // 7. Build member info with totals
      const memberInfoList: MemberPrizeInfoDto[] = []

      for (const m of members) {
        const memberPrizes = allPrizes.filter(p => p.memberId === m.id)
        const totalPrize = calculateMemberTotalPrize(
          config.baseReincrement,
          memberPrizes.map(p => ({ amount: p.amount }))
        )

        // Show total only to admins or after finalization
        const showTotal = isAdmin || config.status === 'FINALIZED'

        memberInfoList.push({
          id: m.id,
          teamName: m.teamName,
          username: m.username,
          currentBudget: m.currentBudget,
          totalPrize: showTotal ? totalPrize : null,
          baseOnly: !showTotal,
        })
      }

      return ok({
        config: {
          id: config.id,
          sessionId: config.sessionId,
          status: config.status,
          baseReincrement: config.baseReincrement,
          totalBudget: config.totalBudget,
          remainingBudget: config.remainingBudget,
          isFinalized: config.status === 'FINALIZED',
          finalizedAt: config.finalizedAt,
        },
        categories: categoriesWithPrizes,
        members: memberInfoList,
        isAdmin,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Errore nel recupero stato premi'
      return fail(new InternalError(message))
    }
  }
}
