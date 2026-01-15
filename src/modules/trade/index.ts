/**
 * Trade Module - Public API
 *
 * This module handles trade operations between league members following Clean Architecture.
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
  TradeOffer,
  TradeStatus,
  CreateTradeOfferData,
} from './domain/entities/trade-offer.entity'

export {
  isValidTradeStatus,
  canRespondToTrade,
  isTradeExpired,
  canCancelTrade,
} from './domain/entities/trade-offer.entity'

// Repository Interface
export type {
  ITradeRepository,
  RosterInfo,
  MemberBudgetInfo,
} from './domain/repositories/trade.repository.interface'

// Domain Services
export type {
  ITradeValidator,
  ValidationResult,
} from './domain/services/trade-validator.service'

export { TradeValidatorService } from './domain/services/trade-validator.service'

// =====================================================
// APPLICATION LAYER EXPORTS
// =====================================================

// DTOs
export type {
  TradePlayerInfo,
  CreateTradeOfferDto,
  RespondTradeDto,
  CounterOfferDto,
  CancelTradeDto,
  TradeOfferDetailDto,
  CreateTradeResultDto,
  AcceptTradeResultDto,
  RejectTradeResultDto,
  CounterOfferResultDto,
  CancelTradeResultDto,
  AntiLoopValidationDto,
  TradeHistoryDto,
} from './application/dto/trade.dto'

// Use Cases
export { CreateTradeUseCase } from './application/use-cases/create-trade.use-case'
export type {
  CreateTradeInput,
  CreateTradeOutput,
  TradeOfferedEvent,
} from './application/use-cases/create-trade.use-case'

export { AcceptTradeUseCase } from './application/use-cases/accept-trade.use-case'
export type {
  AcceptTradeInput,
  AcceptTradeOutput,
  TradeAcceptedEvent,
} from './application/use-cases/accept-trade.use-case'

export { CounterOfferUseCase } from './application/use-cases/counter-offer.use-case'
export type {
  CounterOfferInput,
  CounterOfferOutput,
  CounterOfferMadeEvent,
} from './application/use-cases/counter-offer.use-case'

export { ValidateAntiLoopUseCase, checkAntiLoopSimple } from './application/use-cases/validate-anti-loop.use-case'
export type {
  ValidateAntiLoopInput,
  ValidateAntiLoopOutput,
} from './application/use-cases/validate-anti-loop.use-case'

// =====================================================
// PRESENTATION LAYER EXPORTS
// =====================================================

// Re-export presentation layer
export * from './presentation'
