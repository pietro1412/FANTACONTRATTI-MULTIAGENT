/**
 * League Prisma Repository - Infrastructure Layer
 *
 * Implements ILeagueRepository interface using Prisma ORM.
 * Maps between Prisma database models and domain entities.
 */

import { prisma } from '@/lib/prisma'
import type { ILeagueRepository } from '../../domain/repositories/league.repository.interface'
import type { League, CreateLeagueData, MaxPlayersPerRole, LeagueStatus, LEAGUE_DEFAULTS } from '../../domain/entities/league.entity'
import type { LeagueMember, AddMemberData, LeagueMemberWithUser, MemberRole, MemberStatus, JoinType } from '../../domain/entities/league-member.entity'
import type { LeagueStatus as PrismaLeagueStatus, MemberRole as PrismaMemberRole, MemberStatus as PrismaMemberStatus, JoinType as PrismaJoinType } from '@prisma/client'

/**
 * Default values for league creation (duplicated from entity for use in mapping)
 */
const DEFAULTS = {
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
}

export class LeaguePrismaRepository implements ILeagueRepository {
  /**
   * Find a league by its unique identifier
   */
  async findById(id: string): Promise<League | null> {
    const league = await prisma.league.findUnique({ where: { id } })
    return league ? this.mapToLeague(league) : null
  }

  /**
   * Find a league by its invite code
   */
  async findByInviteCode(code: string): Promise<League | null> {
    const league = await prisma.league.findUnique({ where: { inviteCode: code } })
    return league ? this.mapToLeague(league) : null
  }

  /**
   * Find all leagues that a user is a member of
   */
  async findByUserId(userId: string): Promise<League[]> {
    const memberships = await prisma.leagueMember.findMany({
      where: { userId },
      include: { league: true }
    })
    return memberships.map(m => this.mapToLeague(m.league))
  }

  /**
   * Create a new league
   */
  async create(data: CreateLeagueData): Promise<League> {
    const maxPlayersPerRole = {
      ...DEFAULTS.maxPlayersPerRole,
      ...data.maxPlayersPerRole
    }

    const league = await prisma.league.create({
      data: {
        name: data.name,
        description: data.description,
        maxParticipants: data.maxMembers || DEFAULTS.maxMembers,
        minParticipants: data.minMembers || DEFAULTS.minMembers,
        initialBudget: data.initialBudget || DEFAULTS.initialBudget,
        goalkeeperSlots: maxPlayersPerRole.P,
        defenderSlots: maxPlayersPerRole.D,
        midfielderSlots: maxPlayersPerRole.C,
        forwardSlots: maxPlayersPerRole.A,
        status: 'DRAFT',
        currentSeason: DEFAULTS.currentSeason,
      }
    })
    return this.mapToLeague(league, data.adminId)
  }

  /**
   * Add a member to a league
   */
  async addMember(data: AddMemberData): Promise<LeagueMember> {
    const member = await prisma.leagueMember.create({
      data: {
        leagueId: data.leagueId,
        userId: data.userId,
        teamName: data.teamName,
        role: data.role as PrismaMemberRole,
        status: data.status as PrismaMemberStatus,
        joinType: data.joinType as PrismaJoinType,
        currentBudget: data.initialBudget,
      }
    })
    return this.mapToLeagueMember(member)
  }

  /**
   * Get a specific member of a league
   */
  async getMember(leagueId: string, userId: string): Promise<LeagueMember | null> {
    const member = await prisma.leagueMember.findUnique({
      where: {
        userId_leagueId: {
          userId,
          leagueId
        }
      }
    })
    return member ? this.mapToLeagueMember(member) : null
  }

  /**
   * Get all members of a league
   */
  async getMembers(leagueId: string): Promise<LeagueMemberWithUser[]> {
    const members = await prisma.leagueMember.findMany({
      where: { leagueId },
      include: { user: true }
    })
    return members.map(m => this.mapToLeagueMemberWithUser(m, m.user))
  }

  /**
   * Get count of active members in a league
   */
  async getActiveMemberCount(leagueId: string): Promise<number> {
    return prisma.leagueMember.count({
      where: {
        leagueId,
        status: 'ACTIVE'
      }
    })
  }

  /**
   * Update a member's budget
   */
  async updateMemberBudget(memberId: string, budget: number): Promise<void> {
    await prisma.leagueMember.update({
      where: { id: memberId },
      data: { currentBudget: budget }
    })
  }

  /**
   * Check if a user is already a member of a league (any status)
   */
  async memberExists(leagueId: string, userId: string): Promise<boolean> {
    const member = await prisma.leagueMember.findUnique({
      where: {
        userId_leagueId: {
          userId,
          leagueId
        }
      }
    })
    return member !== null
  }

  /**
   * Map Prisma League model to domain League entity
   */
  private mapToLeague(prismaLeague: {
    id: string
    name: string
    description: string | null
    maxParticipants: number
    minParticipants: number
    initialBudget: number
    goalkeeperSlots: number
    defenderSlots: number
    midfielderSlots: number
    forwardSlots: number
    status: PrismaLeagueStatus
    currentSeason: number
    inviteCode: string
    createdAt: Date
  }, adminId?: string): League {
    return {
      id: prismaLeague.id,
      name: prismaLeague.name,
      description: prismaLeague.description || undefined,
      adminId: adminId || '', // Will be resolved from members when needed
      maxMembers: prismaLeague.maxParticipants,
      minMembers: prismaLeague.minParticipants,
      initialBudget: prismaLeague.initialBudget,
      maxPlayersPerRole: {
        P: prismaLeague.goalkeeperSlots,
        D: prismaLeague.defenderSlots,
        C: prismaLeague.midfielderSlots,
        A: prismaLeague.forwardSlots,
      },
      status: prismaLeague.status as LeagueStatus,
      currentSeason: prismaLeague.currentSeason,
      inviteCode: prismaLeague.inviteCode,
      createdAt: prismaLeague.createdAt,
    }
  }

  /**
   * Map Prisma LeagueMember model to domain LeagueMember entity
   */
  private mapToLeagueMember(prismaMember: {
    id: string
    leagueId: string
    userId: string
    teamName: string | null
    currentBudget: number
    role: PrismaMemberRole
    status: PrismaMemberStatus
    joinType: PrismaJoinType
    joinedAt: Date
  }): LeagueMember {
    return {
      id: prismaMember.id,
      leagueId: prismaMember.leagueId,
      userId: prismaMember.userId,
      teamName: prismaMember.teamName || '',
      budget: prismaMember.currentBudget,
      role: prismaMember.role as MemberRole,
      status: prismaMember.status as MemberStatus,
      joinType: prismaMember.joinType as JoinType,
      joinedAt: prismaMember.joinedAt,
    }
  }

  /**
   * Map Prisma LeagueMember with User to domain LeagueMemberWithUser entity
   */
  private mapToLeagueMemberWithUser(
    prismaMember: {
      id: string
      leagueId: string
      userId: string
      teamName: string | null
      currentBudget: number
      role: PrismaMemberRole
      status: PrismaMemberStatus
      joinType: PrismaJoinType
      joinedAt: Date
    },
    prismaUser: {
      id: string
      username: string
      email: string
      profilePhoto: string | null
    }
  ): LeagueMemberWithUser {
    return {
      ...this.mapToLeagueMember(prismaMember),
      user: {
        id: prismaUser.id,
        username: prismaUser.username,
        email: prismaUser.email,
        profilePhoto: prismaUser.profilePhoto || undefined,
      }
    }
  }
}
