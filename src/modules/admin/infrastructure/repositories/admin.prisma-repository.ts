/**
 * Admin Prisma Repository - Infrastructure Layer
 *
 * Implements IAdminRepository and IAuditLogRepository interfaces using Prisma ORM.
 * Maps between Prisma database models and domain entities.
 */

import { prisma } from '@/lib/prisma'
import type {
  IAdminRepository,
  IAuditLogRepository,
  AdminVerificationResult,
} from '../../domain/repositories/admin.repository.interface'
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
} from '../../domain/entities/audit-log.entity'

export class AdminPrismaRepository implements IAdminRepository {
  /**
   * Verify if a user is an admin of a league
   */
  async verifyAdmin(leagueId: string, userId: string): Promise<AdminVerificationResult> {
    const member = await prisma.leagueMember.findUnique({
      where: {
        userId_leagueId: {
          userId,
          leagueId,
        },
      },
      select: {
        id: true,
        role: true,
        status: true,
      },
    })

    if (!member || member.status !== 'ACTIVE') {
      return { isAdmin: false, memberId: null }
    }

    return {
      isAdmin: member.role === 'ADMIN',
      memberId: member.id,
    }
  }

  /**
   * Check if a user is a member of a league
   */
  async checkMembership(leagueId: string, userId: string): Promise<string | null> {
    const member = await prisma.leagueMember.findUnique({
      where: {
        userId_leagueId: {
          userId,
          leagueId,
        },
      },
      select: { id: true, status: true },
    })
    if (!member || member.status !== 'ACTIVE') return null
    return member.id
  }

  /**
   * Get league statistics with aggregation queries
   */
  async getLeagueStatistics(leagueId: string): Promise<LeagueStatistics | null> {
    const league = await prisma.league.findUnique({
      where: { id: leagueId },
      include: {
        members: {
          where: { status: 'ACTIVE' },
          include: {
            user: { select: { username: true } },
            roster: { where: { status: 'ACTIVE' } },
          },
        },
        auctions: {
          where: { status: 'COMPLETED' },
        },
      },
    })

    if (!league) return null

    // Count completed trades
    const completedTrades = await prisma.tradeOffer.count({
      where: {
        marketSession: { leagueId },
        status: 'ACCEPTED',
      },
    })

    // Calculate total players assigned
    const totalPlayersAssigned = league.members.reduce(
      (sum, member) => sum + member.roster.length,
      0
    )

    // Build member stats
    const memberStats = league.members.map((member) => ({
      username: member.user.username,
      teamName: member.teamName || member.user.username,
      budget: member.currentBudget,
      playerCount: member.roster.length,
    }))

    return {
      league: {
        name: league.name,
        status: league.status,
        maxParticipants: league.maxParticipants,
        initialBudget: league.initialBudget,
      },
      memberCount: league.members.length,
      totalPlayersAssigned,
      completedAuctions: league.auctions.length,
      completedTrades,
      memberStats,
    }
  }

  /**
   * Get session statistics with aggregation queries
   */
  async getSessionStatistics(sessionId: string): Promise<SessionStatistics | null> {
    const session = await prisma.marketSession.findUnique({
      where: { id: sessionId },
      include: {
        auctions: {
          include: {
            _count: {
              select: { bids: true },
            },
          },
        },
      },
    })

    if (!session) return null

    const totalAuctions = session.auctions.length
    const completedAuctions = session.auctions.filter((a) => a.status === 'COMPLETED').length
    const activeAuctions = session.auctions.filter((a) => a.status === 'ACTIVE').length
    const totalBids = session.auctions.reduce((sum, a) => sum + a._count.bids, 0)
    const averageBidCount = totalAuctions > 0 ? totalBids / totalAuctions : 0

    return {
      session: {
        id: session.id,
        type: session.type,
        status: session.status,
        currentPhase: session.currentPhase,
      },
      totalAuctions,
      completedAuctions,
      activeAuctions,
      totalBids,
      averageBidCount,
    }
  }

  /**
   * Update market phase for a session
   */
  async updateMarketPhase(sessionId: string, newPhase: MarketPhase): Promise<boolean> {
    try {
      await prisma.marketSession.update({
        where: { id: sessionId },
        data: {
          currentPhase: newPhase,
          phaseStartedAt: new Date(),
        },
      })
      return true
    } catch {
      return false
    }
  }

  /**
   * Get session by ID with league info
   */
  async getSessionWithLeague(sessionId: string): Promise<{ id: string; leagueId: string; status: string; currentPhase: string | null } | null> {
    const session = await prisma.marketSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        leagueId: true,
        status: true,
        currentPhase: true,
      },
    })
    return session
  }

  /**
   * Check if prize phase is finalized for a session
   */
  async isPrizePhaseFinalized(sessionId: string): Promise<boolean> {
    const config = await prisma.prizePhaseConfig.findUnique({
      where: { marketSessionId: sessionId },
      select: { isFinalized: true },
    })
    return config?.isFinalized ?? false
  }

  /**
   * Import players from data
   */
  async importPlayers(players: PlayerImportData[]): Promise<ImportResult> {
    let imported = 0
    let updated = 0
    const errors: string[] = []

    for (const player of players) {
      try {
        // Normalize position
        const position = this.normalizePosition(player.position)
        if (!position) {
          errors.push(`Invalid position for player ${player.name}: ${player.position}`)
          continue
        }

        // Try to find existing player by name and team
        const existing = await prisma.serieAPlayer.findFirst({
          where: {
            name: player.name,
            team: player.team,
          },
        })

        if (existing) {
          // Update existing player
          await prisma.serieAPlayer.update({
            where: { id: existing.id },
            data: {
              position,
              quotation: player.quotation,
              isActive: true,
            },
          })
          updated++
        } else {
          // Create new player
          await prisma.serieAPlayer.create({
            data: {
              name: player.name,
              team: player.team,
              position,
              quotation: player.quotation,
              isActive: true,
            },
          })
          imported++
        }
      } catch (error) {
        errors.push(`Failed to import player ${player.name}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    return { imported, updated, errors }
  }

  /**
   * Normalize position string to Position enum value
   */
  private normalizePosition(position: string): 'P' | 'D' | 'C' | 'A' | null {
    const normalized = position.toUpperCase().trim()
    switch (normalized) {
      case 'P':
      case 'POR':
      case 'PORTIERE':
        return 'P'
      case 'D':
      case 'DIF':
      case 'DIFENSORE':
        return 'D'
      case 'C':
      case 'CEN':
      case 'CENTROCAMPISTA':
        return 'C'
      case 'A':
      case 'ATT':
      case 'ATTACCANTE':
        return 'A'
      default:
        return null
    }
  }
}

export class AuditLogPrismaRepository implements IAuditLogRepository {
  /**
   * Create a new audit log entry
   */
  async create(data: CreateAuditLogData): Promise<void> {
    await prisma.auditLog.create({
      data: {
        userId: data.userId,
        leagueId: data.leagueId,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        oldValues: data.oldValues ? (data.oldValues as Record<string, string | number | boolean | null>) : undefined,
        newValues: data.newValues ? (data.newValues as Record<string, string | number | boolean | null>) : undefined,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      },
    })
  }

  /**
   * Get audit logs with filters
   */
  async findMany(filter: AuditLogFilter): Promise<AuditLogWithDetails[]> {
    const where: Record<string, unknown> = {
      leagueId: filter.leagueId,
    }

    if (filter.action) {
      where.action = filter.action
    }

    const logs = await prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: { username: true },
        },
        league: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: filter.limit || 50,
      skip: filter.offset || 0,
    })

    return logs.map((log) => this.mapToAuditLogWithDetails(log))
  }

  /**
   * Find an audit log by ID
   */
  async findById(id: string): Promise<AuditLog | null> {
    const log = await prisma.auditLog.findUnique({
      where: { id },
    })
    return log ? this.mapToAuditLog(log) : null
  }

  /**
   * Map Prisma AuditLog to domain entity
   */
  private mapToAuditLog(log: {
    id: string
    userId: string | null
    action: string
    entityType: string | null
    entityId: string | null
    oldValues: unknown
    newValues: unknown
    createdAt: Date
  }): AuditLog {
    return {
      id: log.id,
      userId: log.userId || '',
      action: log.action,
      targetType: log.entityType || '',
      targetId: log.entityId || '',
      details: {
        oldValues: log.oldValues as Record<string, unknown>,
        newValues: log.newValues as Record<string, unknown>,
      },
      createdAt: log.createdAt,
    }
  }

  /**
   * Map Prisma AuditLog to domain entity with details
   */
  private mapToAuditLogWithDetails(log: {
    id: string
    userId: string | null
    action: string
    entityType: string | null
    entityId: string | null
    oldValues: unknown
    newValues: unknown
    createdAt: Date
    user: { username: string } | null
    league: { name: string } | null
  }): AuditLogWithDetails {
    return {
      id: log.id,
      userId: log.userId || '',
      action: log.action,
      targetType: log.entityType || '',
      targetId: log.entityId || '',
      details: {
        oldValues: log.oldValues as Record<string, unknown>,
        newValues: log.newValues as Record<string, unknown>,
      },
      createdAt: log.createdAt,
      user: log.user ? { username: log.user.username } : null,
      league: log.league ? { name: log.league.name } : null,
    }
  }
}
