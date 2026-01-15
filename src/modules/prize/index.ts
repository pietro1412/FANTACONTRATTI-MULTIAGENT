/**
 * Prize Module - Public API
 *
 * This module handles prize management and budget rewards following Clean Architecture.
 *
 * Layer Structure:
 * - Domain: Entities, Repository interfaces
 * - Application: Use cases, DTOs
 * - Infrastructure: Repository implementations (outside this module)
 */

// =====================================================
// DOMAIN LAYER EXPORTS
// =====================================================

// Entities
export type {
  Prize,
  PrizeCategory,
  PrizePhaseConfig,
  PrizePhaseStatus,
  SessionPrize,
  MemberPrizeSummary,
} from './domain/entities/prize.entity'

export {
  isValidPrizePhaseStatus,
  isValidPrizeAmount,
  calculateMemberTotalPrize,
} from './domain/entities/prize.entity'

// Repository Interface
export type {
  IPrizeRepository,
  CreateConfigData,
  UpdateConfigData,
  AssignPrizeData,
  CreateCategoryData,
  MemberInfo,
  SessionInfo,
} from './domain/repositories/prize.repository.interface'

// =====================================================
// APPLICATION LAYER EXPORTS
// =====================================================

// DTOs
export type {
  // Input DTOs
  SetupPrizesDto,
  AssignPrizeDto,
  UnassignPrizeDto,
  FinalizePrizesDto,
  GetPrizeStatusDto,
  CreateCategoryDto,
  UpdateBaseReincrementDto,
  // Output DTOs
  SetupPrizesResultDto,
  AssignPrizeResultDto,
  UnassignPrizeResultDto,
  FinalizePrizesResultDto,
  CategoryWithPrizesDto,
  MemberPrizeInfoDto,
  PrizeStatusResultDto,
  CreateCategoryResultDto,
  UpdateBaseReincrementResultDto,
} from './application/dto/prize.dto'

// Use Cases
export { SetupPrizesUseCase } from './application/use-cases/setup-prizes.use-case'
export type { SetupPrizesError } from './application/use-cases/setup-prizes.use-case'
export {
  DEFAULT_BASE_REINCREMENT,
  DEFAULT_INDENNIZZO_AMOUNT,
  SYSTEM_CATEGORY_INDENNIZZO,
} from './application/use-cases/setup-prizes.use-case'

export { AssignPrizeUseCase } from './application/use-cases/assign-prize.use-case'
export type { AssignPrizeError } from './application/use-cases/assign-prize.use-case'

export { UnassignPrizeUseCase } from './application/use-cases/unassign-prize.use-case'
export type { UnassignPrizeError } from './application/use-cases/unassign-prize.use-case'

export { FinalizePrizesUseCase } from './application/use-cases/finalize-prizes.use-case'
export type { FinalizePrizesError } from './application/use-cases/finalize-prizes.use-case'

export { GetPrizeStatusUseCase } from './application/use-cases/get-prize-status.use-case'
export type { GetPrizeStatusError } from './application/use-cases/get-prize-status.use-case'

// =====================================================
// PRESENTATION LAYER EXPORTS
// =====================================================

// Re-export presentation layer
export * from './presentation'
