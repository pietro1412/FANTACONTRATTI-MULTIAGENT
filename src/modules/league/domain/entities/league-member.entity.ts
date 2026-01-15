/**
 * League Member Entity
 *
 * Represents a member (manager) of a fantasy football league.
 * This is a pure domain entity with no dependencies on infrastructure.
 */

/**
 * Member role in the league
 */
export type MemberRole = 'ADMIN' | 'MANAGER'

/**
 * Member status in the league
 */
export type MemberStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'LEFT'

/**
 * How the member joined the league
 */
export type JoinType = 'CREATOR' | 'INVITE' | 'REQUEST'

/**
 * League member entity representing a participant in a league
 */
export interface LeagueMember {
  id: string
  leagueId: string
  userId: string
  teamName: string
  budget: number
  role: MemberRole
  status: MemberStatus
  joinType: JoinType
  joinedAt: Date
}

/**
 * Data required to add a new member to a league
 */
export interface AddMemberData {
  leagueId: string
  userId: string
  teamName: string
  role: MemberRole
  status: MemberStatus
  joinType: JoinType
  initialBudget: number
}

/**
 * User information associated with a league member
 */
export interface MemberUser {
  id: string
  username: string
  email?: string
  profilePhoto?: string
}

/**
 * League member with user information
 */
export interface LeagueMemberWithUser extends LeagueMember {
  user: MemberUser
}
