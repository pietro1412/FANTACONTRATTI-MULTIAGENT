/**
 * Admin Module - Public API
 *
 * This file exports the public API of the Admin module.
 * External modules should only import from this file.
 */

// Domain Entities
export type {
  AuditLog,
  AuditLogWithDetails,
  CreateAuditLogData,
  AuditLogFilter,
  LeagueStatistics,
  SessionStatistics,
  MarketPhase,
  ManagePhaseData,
  PlayerImportData,
  ImportResult,
} from './domain/entities/audit-log.entity'

// Domain Repository Interfaces
export type {
  IAuditLogRepository,
  IAdminRepository,
  AdminVerificationResult,
} from './domain/repositories/admin.repository.interface'

// Application DTOs
export type {
  GetStatisticsDto,
  GetSessionStatisticsDto,
  ManagePhaseDto,
  ImportPlayersDto,
  GetAuditLogDto,
  LeagueStatisticsResultDto,
  SessionStatisticsResultDto,
  ManagePhaseResultDto,
  ImportPlayersResultDto,
  AuditLogResultDto,
} from './application/dto/admin.dto'

// Application Use Cases
export { GetStatisticsUseCase } from './application/use-cases/get-statistics.use-case'
export { ManagePhaseUseCase } from './application/use-cases/manage-phase.use-case'
export { ImportPlayersUseCase } from './application/use-cases/import-players.use-case'
