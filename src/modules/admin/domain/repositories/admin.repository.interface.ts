/**
 * Admin Repository Interface - Domain Layer
 *
 * Defines the contract for admin persistence operations.
 * Implementations can use any data source (database, API, etc.)
 */

import type {
  AuditLog,
  AuditLogWithDetails,
  CreateAuditLogData,
  AuditLogFilter,
  LeagueStatistics,
  SessionStatistics,
  MarketPhase,
  PlayerImportData,
  ImportResult,
} from '../entities/audit-log.entity'

/**
 * Admin member verification result
 */
export interface AdminVerificationResult {
  isAdmin: boolean
  memberId: string | null
}

/**
 * Audit log repository interface
 */
export interface IAuditLogRepository {
  /**
   * Create a new audit log entry
   * @param data - The audit log data
   */
  create(data: CreateAuditLogData): Promise<void>

  /**
   * Get audit logs with filters
   * @param filter - Filter options
   * @returns Array of audit logs
   */
  findMany(filter: AuditLogFilter): Promise<AuditLogWithDetails[]>

  /**
   * Find an audit log by ID
   * @param id - The audit log ID
   * @returns The audit log or null
   */
  findById(id: string): Promise<AuditLog | null>
}

/**
 * Admin repository interface
 */
export interface IAdminRepository {
  /**
   * Verify if a user is an admin of a league
   * @param leagueId - The league ID
   * @param userId - The user ID
   * @returns Verification result
   */
  verifyAdmin(leagueId: string, userId: string): Promise<AdminVerificationResult>

  /**
   * Check if a user is a member of a league
   * @param leagueId - The league ID
   * @param userId - The user ID
   * @returns The member ID if active member, null otherwise
   */
  checkMembership(leagueId: string, userId: string): Promise<string | null>

  /**
   * Get league statistics
   * @param leagueId - The league ID
   * @returns League statistics
   */
  getLeagueStatistics(leagueId: string): Promise<LeagueStatistics | null>

  /**
   * Get session statistics
   * @param sessionId - The session ID
   * @returns Session statistics
   */
  getSessionStatistics(sessionId: string): Promise<SessionStatistics | null>

  /**
   * Update market phase for a session
   * @param sessionId - The session ID
   * @param newPhase - The new phase
   * @returns Success indicator
   */
  updateMarketPhase(sessionId: string, newPhase: MarketPhase): Promise<boolean>

  /**
   * Get session by ID with league info
   * @param sessionId - The session ID
   * @returns Session with league ID
   */
  getSessionWithLeague(sessionId: string): Promise<{ id: string; leagueId: string; status: string; currentPhase: string | null } | null>

  /**
   * Check if prize phase is finalized for a session
   * @param sessionId - The session ID
   * @returns true if finalized, false otherwise
   */
  isPrizePhaseFinalized(sessionId: string): Promise<boolean>

  /**
   * Import players from data
   * @param players - Array of player data
   * @returns Import result
   */
  importPlayers(players: PlayerImportData[]): Promise<ImportResult>
}
