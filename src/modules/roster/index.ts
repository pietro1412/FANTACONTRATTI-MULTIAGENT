/**
 * Roster Module - Public API
 *
 * This module handles player rosters and contracts following Clean Architecture.
 *
 * Layer Structure:
 * - Domain: Entities, Repository interfaces, Domain services
 * - Application: Use cases, DTOs
 * - Infrastructure: Repository implementations (outside this module)
 */

// =====================================================
// DOMAIN LAYER EXPORTS
// =====================================================

// Entities
export type {
  PlayerRoster,
  AcquisitionType,
  RosterStatus,
  CreateRosterData,
} from './domain/entities/roster.entity'

export {
  isValidAcquisitionType,
  isValidRosterStatus,
} from './domain/entities/roster.entity'

export type {
  PlayerContract,
  ContractStatus,
  CreateContractData,
  UpdateContractData,
} from './domain/entities/contract.entity'

export {
  MAX_CONTRACT_DURATION,
  MIN_CONTRACT_DURATION,
  isValidContractStatus,
  isValidDuration,
  canRenew,
} from './domain/entities/contract.entity'

// Repository Interface
export type { IRosterRepository } from './domain/repositories/roster.repository.interface'

// Domain Services
export type {
  IContractCalculator,
  RescissionBreakdown,
} from './domain/services/contract-calculator.service'

export {
  ContractCalculator,
  DURATION_MULTIPLIERS,
  getRescissionBreakdown,
} from './domain/services/contract-calculator.service'

// =====================================================
// APPLICATION LAYER EXPORTS
// =====================================================

// DTOs
export type {
  PlayerInfo,
  RosterDetailDto,
  RenewContractDto,
  RenewContractWithSalaryDto,
  RescindContractDto,
  RescissionCalculationDto,
  RenewalResultDto,
  ConsolidationResultDto,
  ConsolidateContractsDto,
  RosterSummaryDto,
  RenewalValidationDto,
} from './application/dto/roster.dto'

// Use Cases
export { GetRosterUseCase } from './application/use-cases/get-roster.use-case'
export type { RosterWithContract } from './application/use-cases/get-roster.use-case'

export { RenewContractUseCase } from './application/use-cases/renew-contract.use-case'
export type {
  RenewContractInput,
  RenewContractOutput,
} from './application/use-cases/renew-contract.use-case'

export { CalculateRescissionUseCase } from './application/use-cases/calculate-rescission.use-case'
export type { RescissionCalculationOutput } from './application/use-cases/calculate-rescission.use-case'

export { ConsolidateContractsUseCase } from './application/use-cases/consolidate-contracts.use-case'
export type {
  ConsolidatedContractResult,
  ConsolidateContractsOutput,
} from './application/use-cases/consolidate-contracts.use-case'

// =====================================================
// PRESENTATION LAYER EXPORTS
// =====================================================

// Re-export presentation layer
export * from './presentation'
