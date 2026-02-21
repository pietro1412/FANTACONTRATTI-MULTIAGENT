/**
 * Admin DTOs - Application Layer
 *
 * Data Transfer Objects for the admin module.
 */

import type { MarketPhase, LeagueStatistics, SessionStatistics, ImportResult } from '../../domain/entities/audit-log.entity'

/**
 * DTO for getting statistics
 */
export interface GetStatisticsDto {
  leagueId: string
  userId: string
}

/**
 * DTO for getting session statistics
 */
export interface GetSessionStatisticsDto {
  sessionId: string
  userId: string
}

/**
 * DTO for managing market phase
 */
export interface ManagePhaseDto {
  sessionId: string
  adminUserId: string
  newPhase: MarketPhase
}

/**
 * DTO for importing players
 */
export interface ImportPlayersDto {
  adminUserId: string
  fileContent: string
  leagueId?: string
}

/**
 * DTO for getting audit log
 */
export interface GetAuditLogDto {
  leagueId: string
  adminUserId: string
  action?: string
  limit?: number
  offset?: number
}

/**
 * Result DTO for league statistics
 */
export type LeagueStatisticsResultDto = LeagueStatistics

/**
 * Result DTO for session statistics
 */
export type SessionStatisticsResultDto = SessionStatistics

/**
 * Result DTO for phase management
 */
export interface ManagePhaseResultDto {
  sessionId: string
  previousPhase: string | null
  newPhase: MarketPhase
  updatedAt: Date
}

/**
 * Result DTO for player import
 */
export type ImportPlayersResultDto = ImportResult

/**
 * Result DTO for audit log
 */
export interface AuditLogResultDto {
  logs: Array<{
    id: string
    userId: string | null
    action: string
    entityType: string | null
    entityId: string | null
    oldValues: Record<string, unknown> | null
    newValues: Record<string, unknown> | null
    ipAddress: string | null
    userAgent: string | null
    createdAt: Date
    user: { username: string } | null
  }>
}
