/**
 * Audit Log Entity - Domain Layer
 *
 * Represents an audit log entry in the FANTACONTRATTI system.
 * Audit logs track all administrative and significant system actions.
 */

/**
 * Audit Log entity
 */
export interface AuditLog {
  id: string
  userId: string
  action: string
  targetType: string
  targetId: string
  details: Record<string, unknown>
  createdAt: Date
}

/**
 * Audit Log with user details
 */
export interface AuditLogWithDetails extends AuditLog {
  user: {
    username: string
  } | null
  league: {
    name: string
  } | null
}

/**
 * Data for creating an audit log
 */
export interface CreateAuditLogData {
  userId: string | null
  leagueId: string | null
  action: string
  entityType?: string
  entityId?: string
  oldValues?: Record<string, unknown>
  newValues?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
}

/**
 * Audit log filter options
 */
export interface AuditLogFilter {
  leagueId: string
  action?: string
  limit?: number
  offset?: number
}

/**
 * League statistics data
 */
export interface LeagueStatistics {
  league: {
    name: string | undefined
    status: string | undefined
    maxParticipants: number | undefined
    initialBudget: number | undefined
  }
  memberCount: number
  totalPlayersAssigned: number
  completedAuctions: number
  completedTrades: number
  memberStats: Array<{
    username: string
    teamName: string
    budget: number
    playerCount: number
  }>
}

/**
 * Session statistics data
 */
export interface SessionStatistics {
  session: {
    id: string
    type: string
    status: string
    currentPhase: string | null
  }
  totalAuctions: number
  completedAuctions: number
  activeAuctions: number
  totalBids: number
  averageBidCount: number
}

/**
 * Market phase types
 */
export type MarketPhase =
  | 'ASTA_LIBERA'
  | 'OFFERTE_PRE_RINNOVO'
  | 'PREMI'
  | 'CONTRATTI'
  | 'RUBATA'
  | 'ASTA_SVINCOLATI'
  | 'OFFERTE_POST_ASTA_SVINCOLATI'

/**
 * Data for phase management
 */
export interface ManagePhaseData {
  sessionId: string
  newPhase: MarketPhase
  adminUserId: string
}

/**
 * Player import data
 */
export interface PlayerImportData {
  name: string
  team: string
  position: string
  quotation: number
}

/**
 * Import result
 */
export interface ImportResult {
  imported: number
  updated: number
  errors: string[]
}
