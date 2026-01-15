/**
 * Movement Module - Public API
 *
 * This file exports the public API of the Movement module.
 * External modules should only import from this file.
 */

// Domain Entities
export type {
  PlayerMovement,
  PlayerMovementWithDetails,
  Prophecy,
  ProphecyWithDetails,
  MovementType,
  ProphecyRole,
  ContractSnapshot,
  CreateMovementData,
  CreateProphecyData,
  MovementHistoryFilter,
} from './domain/entities/movement.entity'

// Domain Repository Interfaces
export type {
  IMovementRepository,
  IProphecyRepository,
  FormattedMovement,
} from './domain/repositories/movement.repository.interface'

// Application DTOs
export type {
  RecordMovementDto,
  GetMovementHistoryDto,
  GetPlayerHistoryDto,
  CreateProphecyDto,
  MovementHistoryResultDto,
  PlayerHistoryResultDto,
  ProphecyResultDto,
  CanMakeProphecyResultDto,
} from './application/dto/movement.dto'

// Application Use Cases
export { RecordMovementUseCase } from './application/use-cases/record-movement.use-case'
export { GetMovementHistoryUseCase } from './application/use-cases/get-movement-history.use-case'
export { CreateProphecyUseCase } from './application/use-cases/create-prophecy.use-case'

// =====================================================
// PRESENTATION LAYER EXPORTS
// =====================================================

// Re-export presentation layer
export * from './presentation'
