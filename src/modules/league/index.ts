/**
 * League Module - Public API
 *
 * This module handles all league-related functionality in FANTACONTRATTI.
 * Following Clean Architecture, this index file exports only the public API
 * that should be used by other modules and layers.
 *
 * Module Structure:
 * - domain/entities: Domain entities (League, LeagueMember)
 * - domain/repositories: Repository interfaces
 * - application/dto: Data Transfer Objects
 * - application/use-cases: Application use cases
 */

// =============================================================================
// Domain Layer Exports
// =============================================================================

// Entities
export type {
  League,
  LeagueStatus,
  MaxPlayersPerRole,
  CreateLeagueData,
} from './domain/entities/league.entity'

export { LEAGUE_DEFAULTS } from './domain/entities/league.entity'

export type {
  LeagueMember,
  MemberRole,
  MemberStatus,
  JoinType,
  AddMemberData,
  MemberUser,
  LeagueMemberWithUser,
} from './domain/entities/league-member.entity'

// Repository Interface
export type { ILeagueRepository } from './domain/repositories/league.repository.interface'

// =============================================================================
// Application Layer Exports
// =============================================================================

// DTOs
export type {
  CreateLeagueDto,
  CreateLeagueInput,
  JoinLeagueDto,
  JoinLeagueInput,
  LeagueDetailDto,
  GetLeagueDetailsInput,
  LeagueSummaryDto,
  CreateLeagueResult,
  JoinLeagueResult,
} from './application/dto/league.dto'

// Use Cases
export { CreateLeagueUseCase } from './application/use-cases/create-league.use-case'
export { JoinLeagueUseCase } from './application/use-cases/join-league.use-case'
export { GetLeagueDetailsUseCase } from './application/use-cases/get-league-details.use-case'

// Infrastructure (re-export for convenience)
export { leagueRoutes } from './infrastructure'

// =====================================================
// PRESENTATION LAYER EXPORTS
// =====================================================

// Re-export presentation layer
export * from './presentation'
