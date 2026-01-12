/**
 * League DTOs (Data Transfer Objects)
 *
 * These DTOs define the shape of data transferred between
 * application layers and external interfaces.
 */

import type { League, MaxPlayersPerRole } from '../../domain/entities/league.entity'
import type { LeagueMemberWithUser } from '../../domain/entities/league-member.entity'

/**
 * DTO for creating a new league
 */
export interface CreateLeagueDto {
  name: string
  teamName: string
  description?: string
  maxMembers?: number
  initialBudget?: number
  maxPlayersPerRole?: Partial<MaxPlayersPerRole>
}

/**
 * Input for the CreateLeague use case
 */
export interface CreateLeagueInput {
  userId: string
  data: CreateLeagueDto
}

/**
 * DTO for joining a league
 */
export interface JoinLeagueDto {
  inviteCode: string
  teamName: string
}

/**
 * Input for the JoinLeague use case
 */
export interface JoinLeagueInput {
  userId: string
  leagueId: string
  teamName: string
}

/**
 * DTO for league details response
 */
export interface LeagueDetailDto {
  league: League
  members: LeagueMemberWithUser[]
  isAdmin: boolean
  currentUserMemberId?: string
}

/**
 * Input for GetLeagueDetails use case
 */
export interface GetLeagueDetailsInput {
  leagueId: string
  userId: string
}

/**
 * DTO for league summary (for list views)
 */
export interface LeagueSummaryDto {
  id: string
  name: string
  description?: string
  memberCount: number
  maxMembers: number
  status: string
  isAdmin: boolean
}

/**
 * Result of CreateLeague use case
 */
export interface CreateLeagueResult {
  league: League
  inviteCode: string
}

/**
 * Result of JoinLeague use case
 */
export interface JoinLeagueResult {
  leagueId: string
  memberId: string
  teamName: string
  budget: number
}
