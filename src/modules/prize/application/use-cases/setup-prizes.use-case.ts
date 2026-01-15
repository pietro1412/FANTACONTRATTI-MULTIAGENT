/**
 * Setup Prizes Use Case - Application Layer
 * Initializes the prize phase for a market session
 */

import type { IPrizeRepository } from '../../domain/repositories/prize.repository.interface'
import type { SetupPrizesDto, SetupPrizesResultDto } from '../dto/prize.dto'
import { Result, ok, fail } from '../../../../shared/infrastructure/http/result'
import {
  ForbiddenError,
  NotFoundError,
  ConflictError,
  InternalError,
} from '../../../../shared/infrastructure/http/errors'

/**
 * Default base reincrement value (100M)
 */
export const DEFAULT_BASE_REINCREMENT = 100

/**
 * Default prize amount for system category "Indennizzo Partenza Estero"
 */
export const DEFAULT_INDENNIZZO_AMOUNT = 50

/**
 * System category name
 */
export const SYSTEM_CATEGORY_INDENNIZZO = 'Indennizzo Partenza Estero'

/**
 * Error type union for this use case
 */
export type SetupPrizesError = ForbiddenError | NotFoundError | ConflictError | InternalError

/**
 * Use case for setting up the prize phase
 *
 * Business rules:
 * - Only admin can initialize prize phase
 * - Session must exist
 * - Phase cannot be initialized twice
 * - Creates default "Indennizzo Partenza Estero" category
 * - Initializes prizes for all active members
 */
export class SetupPrizesUseCase {
  constructor(private readonly prizeRepository: IPrizeRepository) {}

  /**
   * Execute the use case
   * @param dto - Setup prizes request data
   * @returns Result containing setup result or error
   */
  async execute(dto: SetupPrizesDto): Promise<Result<SetupPrizesResultDto, SetupPrizesError>> {
    try {
      const { sessionId, adminUserId, baseReincrement, totalBudget } = dto

      // 1. Verify session exists
      const session = await this.prizeRepository.getSession(sessionId)
      if (!session) {
        return fail(new NotFoundError('Sessione non trovata'))
      }

      // 2. Verify admin permission
      const member = await this.prizeRepository.getMemberByUserId(adminUserId, session.leagueId)
      if (!member || member.role !== 'ADMIN') {
        return fail(new ForbiddenError('Non autorizzato'))
      }

      // 3. Check if already initialized
      const existingConfig = await this.prizeRepository.getConfig(sessionId)
      if (existingConfig) {
        return fail(new ConflictError('Fase premi già inizializzata'))
      }

      // 4. Get all active members
      const members = await this.prizeRepository.getActiveMembers(session.leagueId)

      // 5. Create prize phase config
      const effectiveBaseReincrement = baseReincrement ?? DEFAULT_BASE_REINCREMENT
      const effectiveTotalBudget = totalBudget ?? 0

      const config = await this.prizeRepository.createConfig({
        sessionId,
        baseReincrement: effectiveBaseReincrement,
        totalBudget: effectiveTotalBudget,
      })

      // 6. Create default system category "Indennizzo Partenza Estero"
      const indennizzoCategory = await this.prizeRepository.createCategory({
        sessionId,
        name: SYSTEM_CATEGORY_INDENNIZZO,
        description: 'Premio automatico per tutti i manager',
        defaultAmount: DEFAULT_INDENNIZZO_AMOUNT,
        isCustom: false,
      })

      // 7. Initialize default prizes for all members in Indennizzo category
      let categoriesCreated = 1
      for (const m of members) {
        await this.prizeRepository.assignPrize({
          categoryId: indennizzoCategory.id,
          memberId: m.id,
          amount: DEFAULT_INDENNIZZO_AMOUNT,
          assignedBy: adminUserId,
        })
      }

      return ok({
        configId: config.id,
        sessionId: config.sessionId,
        status: config.status,
        baseReincrement: config.baseReincrement,
        totalBudget: config.totalBudget,
        categoriesCreated,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Errore nella configurazione premi'
      return fail(new InternalError(message))
    }
  }
}
