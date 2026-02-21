/**
 * Movement Prisma Repository - Infrastructure Layer
 *
 * Implements IMovementRepository and IProphecyRepository interfaces using Prisma ORM.
 * Maps between Prisma database models and domain entities.
 */

import { prisma } from '@/lib/prisma'
import type {
  IMovementRepository,
  IProphecyRepository,
  FormattedMovement,
} from '../../domain/repositories/movement.repository.interface'
import type {
  PlayerMovementWithDetails,
  ProphecyWithDetails,
  CreateMovementData,
  CreateProphecyData,
  MovementHistoryFilter,
} from '../../domain/entities/movement.entity'

export class MovementPrismaRepository implements IMovementRepository {
  /**
   * Create a new movement record
   */
  async create(data: CreateMovementData): Promise<string | null> {
    try {
      const movement = await prisma.playerMovement.create({
        data: {
          leagueId: data.leagueId,
          playerId: data.playerId,
          movementType: data.movementType as 'FIRST_MARKET' | 'TRADE' | 'RUBATA' | 'SVINCOLATI' | 'RELEASE' | 'CONTRACT_RENEW',
          fromMemberId: data.fromMemberId,
          toMemberId: data.toMemberId,
          price: data.price,
          oldSalary: data.oldSalary,
          oldDuration: data.oldDuration,
          oldClause: data.oldClause,
          newSalary: data.newSalary,
          newDuration: data.newDuration,
          newClause: data.newClause,
          auctionId: data.auctionId,
          tradeId: data.tradeId,
          marketSessionId: data.marketSessionId,
        },
      })
      return movement.id
    } catch {
      return null
    }
  }

  /**
   * Find a movement by ID with details
   */
  async findById(id: string): Promise<PlayerMovementWithDetails | null> {
    const movement = await prisma.playerMovement.findUnique({
      where: { id },
      include: {
        player: true,
        fromMember: {
          include: {
            user: { select: { username: true } },
          },
        },
        toMember: {
          include: {
            user: { select: { username: true } },
          },
        },
      },
    })
    if (!movement) return null
    return this.mapToMovementWithDetails(movement)
  }

  /**
   * Get movement history with filters
   */
  async findMany(filter: MovementHistoryFilter): Promise<FormattedMovement[]> {
    const where: Record<string, unknown> = {
      leagueId: filter.leagueId,
    }

    if (filter.playerId) {
      where.playerId = filter.playerId
    }
    if (filter.memberId) {
      where.OR = [
        { fromMemberId: filter.memberId },
        { toMemberId: filter.memberId },
      ]
    }
    if (filter.movementType) {
      where.movementType = filter.movementType
    }
    if (filter.semester) {
      where.marketSession = { semester: filter.semester }
    }

    const movements = await prisma.playerMovement.findMany({
      where,
      include: {
        player: true,
        fromMember: {
          include: {
            user: { select: { username: true } },
          },
        },
        toMember: {
          include: {
            user: { select: { username: true } },
          },
        },
        prophecies: {
          include: {
            author: {
              include: {
                user: { select: { username: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: filter.limit || 50,
      skip: filter.offset || 0,
    })

    return movements.map((m) => this.mapToFormattedMovement(m))
  }

  /**
   * Get all movements for a specific player in a league
   */
  async findByPlayer(leagueId: string, playerId: string): Promise<PlayerMovementWithDetails[]> {
    const movements = await prisma.playerMovement.findMany({
      where: {
        leagueId,
        playerId,
      },
      include: {
        player: true,
        fromMember: {
          include: {
            user: { select: { username: true } },
          },
        },
        toMember: {
          include: {
            user: { select: { username: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
    return movements.map((m) => this.mapToMovementWithDetails(m))
  }

  /**
   * Get movements for a specific member (as buyer or seller)
   */
  async findByMember(leagueId: string, memberId: string): Promise<PlayerMovementWithDetails[]> {
    const movements = await prisma.playerMovement.findMany({
      where: {
        leagueId,
        OR: [{ fromMemberId: memberId }, { toMemberId: memberId }],
      },
      include: {
        player: true,
        fromMember: {
          include: {
            user: { select: { username: true } },
          },
        },
        toMember: {
          include: {
            user: { select: { username: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
    return movements.map((m) => this.mapToMovementWithDetails(m))
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
   * Map Prisma movement to domain entity with details
   */
  private mapToMovementWithDetails(movement: {
    id: string
    playerId: string
    leagueId: string
    fromMemberId: string | null
    toMemberId: string | null
    movementType: string
    price: number | null
    marketSessionId: string | null
    createdAt: Date
    oldSalary: number | null
    oldDuration: number | null
    oldClause: number | null
    newSalary: number | null
    newDuration: number | null
    newClause: number | null
    auctionId: string | null
    tradeId: string | null
  }): PlayerMovementWithDetails {
    return {
      id: movement.id,
      playerId: movement.playerId,
      leagueId: movement.leagueId,
      fromMemberId: movement.fromMemberId,
      toMemberId: movement.toMemberId,
      type: movement.movementType as 'AUCTION' | 'RUBATA' | 'SVINCOLATI' | 'TRADE' | 'RELEASE' | 'INITIAL',
      amount: movement.price || 0,
      sessionId: movement.marketSessionId,
      createdAt: movement.createdAt,
      oldContract: movement.oldSalary !== null
        ? {
            salary: movement.oldSalary,
            duration: movement.oldDuration || 0,
            clause: movement.oldClause,
          }
        : null,
      newContract: movement.newSalary !== null
        ? {
            salary: movement.newSalary,
            duration: movement.newDuration || 0,
            clause: movement.newClause,
          }
        : null,
      auctionId: movement.auctionId,
      tradeId: movement.tradeId,
    }
  }

  /**
   * Map Prisma movement to formatted movement for API response
   */
  private mapToFormattedMovement(movement: {
    id: string
    movementType: string
    price: number | null
    createdAt: Date
    oldSalary: number | null
    oldDuration: number | null
    oldClause: number | null
    newSalary: number | null
    newDuration: number | null
    newClause: number | null
    player: {
      id: string
      name: string
      position: string
      team: string
    }
    fromMember: {
      id: string
      teamName: string | null
      user: { username: string }
    } | null
    toMember: {
      id: string
      teamName: string | null
      user: { username: string }
    } | null
    prophecies: Array<{
      id: string
      content: string
      authorRole: string
      createdAt: Date
      author: {
        id: string
        teamName: string | null
        user: { username: string }
      }
    }>
  }): FormattedMovement {
    return {
      id: movement.id,
      type: movement.movementType,
      player: {
        id: movement.player.id,
        name: movement.player.name,
        position: movement.player.position,
        team: movement.player.team,
      },
      from: movement.fromMember
        ? {
            memberId: movement.fromMember.id,
            username: movement.fromMember.user.username,
            teamName: movement.fromMember.teamName || movement.fromMember.user.username,
          }
        : null,
      to: movement.toMember
        ? {
            memberId: movement.toMember.id,
            username: movement.toMember.user.username,
            teamName: movement.toMember.teamName || movement.toMember.user.username,
          }
        : null,
      price: movement.price,
      oldContract: movement.oldSalary !== null
        ? {
            salary: movement.oldSalary,
            duration: movement.oldDuration,
            clause: movement.oldClause,
          }
        : null,
      newContract: movement.newSalary !== null
        ? {
            salary: movement.newSalary,
            duration: movement.newDuration,
            clause: movement.newClause,
          }
        : null,
      prophecies: movement.prophecies.map((p) => ({
        id: p.id,
        content: p.content,
        authorRole: p.authorRole,
        author: {
          memberId: p.author.id,
          username: p.author.user.username,
          teamName: p.author.teamName || p.author.user.username,
        },
        createdAt: p.createdAt,
        source: 'movement',
      })),
      createdAt: movement.createdAt,
    }
  }
}

export class ProphecyPrismaRepository implements IProphecyRepository {
  /**
   * Create a new prophecy
   */
  async create(data: CreateProphecyData): Promise<ProphecyWithDetails> {
    const prophecy = await prisma.prophecy.create({
      data: {
        leagueId: data.leagueId,
        playerId: data.playerId,
        authorId: data.authorId,
        movementId: data.movementId,
        authorRole: data.authorRole,
        content: data.content,
      },
      include: {
        author: {
          include: {
            user: { select: { username: true } },
          },
        },
      },
    })
    return this.mapToProphecyWithDetails(prophecy)
  }

  /**
   * Find a prophecy by movement and author
   */
  async findByMovementAndAuthor(movementId: string, authorId: string): Promise<ProphecyWithDetails | null> {
    const prophecy = await prisma.prophecy.findUnique({
      where: {
        movementId_authorId: {
          movementId,
          authorId,
        },
      },
      include: {
        author: {
          include: {
            user: { select: { username: true } },
          },
        },
      },
    })
    return prophecy ? this.mapToProphecyWithDetails(prophecy) : null
  }

  /**
   * Get all prophecies for a player in a league
   */
  async findByPlayer(leagueId: string, playerId: string): Promise<ProphecyWithDetails[]> {
    const prophecies = await prisma.prophecy.findMany({
      where: {
        leagueId,
        playerId,
      },
      include: {
        author: {
          include: {
            user: { select: { username: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
    return prophecies.map((p) => this.mapToProphecyWithDetails(p))
  }

  /**
   * Get all prophecies for a movement
   */
  async findByMovement(movementId: string): Promise<ProphecyWithDetails[]> {
    const prophecies = await prisma.prophecy.findMany({
      where: { movementId },
      include: {
        author: {
          include: {
            user: { select: { username: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    })
    return prophecies.map((p) => this.mapToProphecyWithDetails(p))
  }

  /**
   * Map Prisma prophecy to domain entity with details
   */
  private mapToProphecyWithDetails(prophecy: {
    id: string
    leagueId: string
    playerId: string
    authorId: string
    movementId: string
    authorRole: string
    content: string
    createdAt: Date
  }): ProphecyWithDetails {
    return {
      id: prophecy.id,
      leagueId: prophecy.leagueId,
      playerId: prophecy.playerId,
      predictorId: prophecy.authorId,
      predictedRole: prophecy.authorRole as 'P' | 'D' | 'C' | 'A',
      createdAt: prophecy.createdAt,
      resolvedAt: null,
      wasCorrect: null,
      content: prophecy.content,
      authorRole: prophecy.authorRole as 'BUYER' | 'SELLER',
      movementId: prophecy.movementId,
    }
  }
}
