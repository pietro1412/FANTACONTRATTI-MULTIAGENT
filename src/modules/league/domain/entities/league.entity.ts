/**
 * League Entity
 *
 * Represents a fantasy football league in the domain.
 * This is a pure domain entity with no dependencies on infrastructure.
 */

/**
 * League status enum
 */
export type LeagueStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED'

/**
 * Maximum players per role configuration
 */
export interface MaxPlayersPerRole {
  P: number // Portiere (Goalkeeper)
  D: number // Difensore (Defender)
  C: number // Centrocampista (Midfielder)
  A: number // Attaccante (Forward)
}

/**
 * League entity representing a fantasy football league
 */
export interface League {
  id: string
  name: string
  description?: string
  adminId: string
  maxMembers: number
  minMembers: number
  initialBudget: number
  maxPlayersPerRole: MaxPlayersPerRole
  createdAt: Date
  inviteCode: string
  status: LeagueStatus
  currentSeason: number
}

/**
 * Data required to create a new league
 */
export interface CreateLeagueData {
  name: string
  description?: string
  adminId: string
  maxMembers?: number
  minMembers?: number
  initialBudget?: number
  maxPlayersPerRole?: Partial<MaxPlayersPerRole>
}

/**
 * Default values for league creation
 */
export const LEAGUE_DEFAULTS = {
  maxMembers: 20,
  minMembers: 6,
  initialBudget: 500,
  maxPlayersPerRole: {
    P: 3,
    D: 8,
    C: 8,
    A: 6,
  },
  status: 'DRAFT' as LeagueStatus,
  currentSeason: 1,
} as const
