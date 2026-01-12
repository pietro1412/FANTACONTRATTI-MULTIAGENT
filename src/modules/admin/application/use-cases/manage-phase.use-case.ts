/**
 * Manage Phase Use Case - Application Layer
 *
 * Admin control of market phases.
 * Validates admin permission before allowing phase changes.
 */

import { Result, ok, fail } from '../../../../shared/infrastructure/http/result'
import { ForbiddenError, ValidationError, NotFoundError } from '../../../../shared/infrastructure/http/errors'
import type { IAdminRepository, IAuditLogRepository } from '../../domain/repositories/admin.repository.interface'
import type { MarketPhase } from '../../domain/entities/audit-log.entity'
import type { ManagePhaseDto, ManagePhaseResultDto } from '../dto/admin.dto'

const VALID_PHASES: MarketPhase[] = [
  'ASTA_LIBERA',
  'OFFERTE_PRE_RINNOVO',
  'PREMI',
  'CONTRATTI',
  'RUBATA',
  'ASTA_SVINCOLATI',
  'OFFERTE_POST_ASTA_SVINCOLATI',
]

export class ManagePhaseUseCase {
  constructor(
    private readonly adminRepository: IAdminRepository,
    private readonly auditLogRepository?: IAuditLogRepository
  ) {}

  async execute(dto: ManagePhaseDto): Promise<Result<ManagePhaseResultDto, ForbiddenError | ValidationError | NotFoundError>> {
    // Validate required fields
    if (!dto.sessionId) {
      return fail(new ValidationError('Session ID is required'))
    }

    if (!dto.adminUserId) {
      return fail(new ValidationError('Admin user ID is required'))
    }

    if (!dto.newPhase) {
      return fail(new ValidationError('New phase is required'))
    }

    // Validate phase
    if (!VALID_PHASES.includes(dto.newPhase)) {
      return fail(new ValidationError(`Invalid phase: ${dto.newPhase}`))
    }

    // Get session to verify league
    const session = await this.adminRepository.getSessionWithLeague(dto.sessionId)
    if (!session) {
      return fail(new NotFoundError('Sessione non trovata'))
    }

    // Verify admin permission
    const adminVerification = await this.adminRepository.verifyAdmin(session.leagueId, dto.adminUserId)
    if (!adminVerification.isAdmin) {
      return fail(new ForbiddenError('Non autorizzato. Solo gli admin possono gestire le fasi.'))
    }

    // Check session status
    if (session.status !== 'ACTIVE') {
      return fail(new ValidationError('La sessione deve essere attiva per cambiare fase'))
    }

    // Get current session statistics for previous phase
    const sessionStats = await this.adminRepository.getSessionStatistics(dto.sessionId)
    const previousPhase = sessionStats?.session.currentPhase || null

    // Update phase
    const success = await this.adminRepository.updateMarketPhase(dto.sessionId, dto.newPhase)
    if (!success) {
      return fail(new ValidationError('Errore durante il cambio di fase'))
    }

    // Log the action
    if (this.auditLogRepository) {
      await this.auditLogRepository.create({
        userId: dto.adminUserId,
        leagueId: session.leagueId,
        action: 'PHASE_CHANGE',
        entityType: 'MarketSession',
        entityId: dto.sessionId,
        oldValues: { phase: previousPhase },
        newValues: { phase: dto.newPhase },
      })
    }

    return ok({
      sessionId: dto.sessionId,
      previousPhase,
      newPhase: dto.newPhase,
      updatedAt: new Date(),
    })
  }
}
