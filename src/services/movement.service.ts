import type { MovementType} from '@prisma/client';
import { MemberStatus, ProphecyRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { ServiceResult } from '@/shared/types/service-result'

// ==================== REGISTRA MOVIMENTO ====================

interface MovementData {
  leagueId: string
  playerId: string
  movementType: MovementType
  fromMemberId?: string | null
  toMemberId?: string | null
  price?: number
  oldSalary?: number
  oldDuration?: number
  oldClause?: number
  newSalary?: number
  newDuration?: number
  newClause?: number
  auctionId?: string
  tradeId?: string
  marketSessionId?: string
}

export async function recordMovement(data: MovementData): Promise<string | null> {
  try {
    const movement = await prisma.playerMovement.create({
      data: {
        leagueId: data.leagueId,
        playerId: data.playerId,
        movementType: data.movementType,
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

// ==================== OTTIENI STORICO MOVIMENTI LEGA ====================

export async function getLeagueMovements(
  leagueId: string,
  userId: string,
  options?: {
    limit?: number
    offset?: number
    movementType?: MovementType
    playerId?: string
    semester?: number
  }
): Promise<ServiceResult> {
  // Verify membership
  const member = await prisma.leagueMember.findFirst({
    where: {
      leagueId,
      userId,
      status: MemberStatus.ACTIVE,
    },
  })

  if (!member) {
    return { success: false, message: 'Non sei membro di questa lega' }
  }

  const whereConditions: Record<string, unknown> = {
    leagueId,
  }

  if (options?.movementType) {
    whereConditions.movementType = options.movementType
  }

  if (options?.playerId) {
    whereConditions.playerId = options.playerId
  }

  if (options?.semester) {
    whereConditions.marketSession = {
      semester: options.semester,
    }
  }

  const movements = await prisma.playerMovement.findMany({
    where: whereConditions,
    include: {
      player: true,
      fromMember: {
        include: { user: { select: { username: true } } },
      },
      toMember: {
        include: { user: { select: { username: true } } },
      },
      prophecies: {
        include: {
          author: {
            include: { user: { select: { username: true } } },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: options?.limit ?? 100,
    skip: options?.offset ?? 0,
  })

  // Also get prophecies from AuctionAcknowledgment for movements with auctionId
  const auctionIds = movements.filter(m => m.auctionId).map(m => m.auctionId as string)

  const auctionAcks = auctionIds.length > 0 ? await prisma.auctionAcknowledgment.findMany({
    where: {
      auctionId: { in: auctionIds },
      prophecy: { not: null },
    },
    include: {
      member: {
        include: { user: { select: { username: true } } },
      },
      auction: true,
    },
  }) : []

  // Create a map of auctionId -> acknowledgments with prophecies
  const acksByAuction = new Map<string, typeof auctionAcks>()
  for (const ack of auctionAcks) {
    const existing = acksByAuction.get(ack.auctionId) || []
    existing.push(ack)
    acksByAuction.set(ack.auctionId, existing)
  }

  const formattedMovements = movements.map(m => {
    // Get prophecies from both Prophecy model and AuctionAcknowledgment
    const propheciesFromModel = m.prophecies.map(p => ({
      id: p.id,
      content: p.content,
      authorRole: p.authorRole,
      author: {
        memberId: p.author.id,
        username: p.author.user.username,
        teamName: p.author.teamName,
      },
      createdAt: p.createdAt,
      source: 'prophecy' as const,
    }))

    // Get prophecies from AuctionAcknowledgment (if this movement is from an auction)
    const ackProphecies = m.auctionId ? (acksByAuction.get(m.auctionId) || []) : []

    // Filter out ack prophecies that are already in the Prophecy model (avoid duplicates)
    const existingAuthorIds = new Set(m.prophecies.map(p => p.authorId))
    const propheciesFromAck = ackProphecies
      .filter(ack => !existingAuthorIds.has(ack.memberId))
      .map(ack => ({
        id: `ack-${ack.id}`,
        content: ack.prophecy!,
        authorRole: ack.memberId === m.toMemberId ? ProphecyRole.BUYER : ProphecyRole.SELLER,
        author: {
          memberId: ack.member.id,
          username: ack.member.user.username,
          teamName: ack.member.teamName,
        },
        createdAt: ack.acknowledgedAt,
        source: 'acknowledgment' as const,
      }))

    // Combine both sources
    const allProphecies = [...propheciesFromModel, ...propheciesFromAck]
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

    return {
      id: m.id,
      type: m.movementType,
      player: {
        id: m.player.id,
        name: m.player.name,
        position: m.player.position,
        team: m.player.team,
      },
      from: m.fromMember
        ? {
            memberId: m.fromMember.id,
            username: m.fromMember.user.username,
            teamName: m.fromMember.teamName,
          }
        : null,
      to: m.toMember
        ? {
            memberId: m.toMember.id,
            username: m.toMember.user.username,
            teamName: m.toMember.teamName,
          }
        : null,
      price: m.price,
      oldContract: m.oldSalary
        ? {
            salary: m.oldSalary,
            duration: m.oldDuration,
            clause: m.oldClause,
          }
        : null,
      newContract: m.newSalary
        ? {
            salary: m.newSalary,
            duration: m.newDuration,
            clause: m.newClause,
          }
        : null,
      prophecies: allProphecies,
      createdAt: m.createdAt,
    }
  })

  return {
    success: true,
    data: formattedMovements,
  }
}

// ==================== OTTIENI STORICO GIOCATORE ====================

export async function getPlayerHistory(
  leagueId: string,
  playerId: string,
  userId: string
): Promise<ServiceResult> {
  // Verify membership
  const member = await prisma.leagueMember.findFirst({
    where: {
      leagueId,
      userId,
      status: MemberStatus.ACTIVE,
    },
  })

  if (!member) {
    return { success: false, message: 'Non sei membro di questa lega' }
  }

  const player = await prisma.serieAPlayer.findUnique({
    where: { id: playerId },
  })

  if (!player) {
    return { success: false, message: 'Giocatore non trovato' }
  }

  const movements = await prisma.playerMovement.findMany({
    where: {
      leagueId,
      playerId,
    },
    include: {
      fromMember: {
        include: { user: { select: { username: true } } },
      },
      toMember: {
        include: { user: { select: { username: true } } },
      },
      prophecies: {
        include: {
          author: {
            include: { user: { select: { username: true } } },
          },
        },
      },
      marketSession: {
        select: { type: true, season: true, semester: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  // Get current roster status
  const currentRoster = await prisma.playerRoster.findFirst({
    where: {
      playerId,
      leagueMember: { leagueId },
      status: 'ACTIVE',
    },
    include: {
      leagueMember: {
        include: { user: { select: { username: true } } },
      },
      contract: true,
    },
  })

  return {
    success: true,
    data: {
      player: {
        id: player.id,
        name: player.name,
        position: player.position,
        team: player.team,
        quotation: player.quotation,
      },
      currentOwner: currentRoster
        ? {
            memberId: currentRoster.leagueMember.id,
            username: currentRoster.leagueMember.user.username,
            teamName: currentRoster.leagueMember.teamName,
            contract: currentRoster.contract
              ? {
                  salary: currentRoster.contract.salary,
                  duration: currentRoster.contract.duration,
                  rescissionClause: currentRoster.contract.rescissionClause,
                }
              : null,
          }
        : null,
      movements: movements.map(m => ({
        id: m.id,
        type: m.movementType,
        from: m.fromMember?.user.username || 'Svincolato',
        to: m.toMember?.user.username || 'Svincolato',
        price: m.price,
        oldContract: m.oldSalary
          ? { salary: m.oldSalary, duration: m.oldDuration, clause: m.oldClause }
          : null,
        newContract: m.newSalary
          ? { salary: m.newSalary, duration: m.newDuration, clause: m.newClause }
          : null,
        session: m.marketSession
          ? `${m.marketSession.type} S${m.marketSession.season}/${m.marketSession.semester}`
          : null,
        prophecies: m.prophecies.map(p => ({
          content: p.content,
          authorRole: p.authorRole,
          author: p.author.user.username,
        })),
        date: m.createdAt,
      })),
      allProphecies: movements.flatMap(m =>
        m.prophecies.map(p => ({
          content: p.content,
          authorRole: p.authorRole,
          author: p.author.user.username,
          date: p.createdAt,
        }))
      ),
    },
  }
}

// ==================== AGGIUNGI PROFEZIA ====================

export async function addProphecy(
  movementId: string,
  userId: string,
  content: string
): Promise<ServiceResult> {
  const movement = await prisma.playerMovement.findUnique({
    where: { id: movementId },
    include: {
      fromMember: true,
      toMember: true,
    },
  })

  if (!movement) {
    return { success: false, message: 'Movimento non trovato' }
  }

  // Get user's membership in this league
  const member = await prisma.leagueMember.findFirst({
    where: {
      leagueId: movement.leagueId,
      userId,
      status: MemberStatus.ACTIVE,
    },
  })

  if (!member) {
    return { success: false, message: 'Non sei membro di questa lega' }
  }

  // Check if user is involved in this movement
  const isBuyer = movement.toMemberId === member.id
  const isSeller = movement.fromMemberId === member.id

  if (!isBuyer && !isSeller) {
    return { success: false, message: 'Solo chi acquista o chi cede può fare una profezia' }
  }

  // Check if user already made a prophecy for this movement
  const existingProphecy = await prisma.prophecy.findUnique({
    where: {
      movementId_authorId: {
        movementId,
        authorId: member.id,
      },
    },
  })

  if (existingProphecy) {
    return { success: false, message: 'Hai già fatto una profezia per questo movimento' }
  }

  // Validate content
  if (!content || content.trim().length === 0) {
    return { success: false, message: 'La profezia non può essere vuota' }
  }

  if (content.length > 500) {
    return { success: false, message: 'La profezia non può superare i 500 caratteri' }
  }

  // Create prophecy
  const prophecy = await prisma.prophecy.create({
    data: {
      leagueId: movement.leagueId,
      playerId: movement.playerId,
      authorId: member.id,
      movementId,
      authorRole: isBuyer ? ProphecyRole.BUYER : ProphecyRole.SELLER,
      content: content.trim(),
    },
    include: {
      player: true,
      author: {
        include: { user: { select: { username: true } } },
      },
    },
  })

  return {
    success: true,
    message: 'Profezia registrata',
    data: {
      id: prophecy.id,
      content: prophecy.content,
      authorRole: prophecy.authorRole,
      playerName: prophecy.player.name,
      author: prophecy.author.user.username,
    },
  }
}

// ==================== OTTIENI PROFEZIE GIOCATORE ====================

export async function getPlayerProphecies(
  leagueId: string,
  playerId: string,
  userId: string
): Promise<ServiceResult> {
  // Verify membership
  const member = await prisma.leagueMember.findFirst({
    where: {
      leagueId,
      userId,
      status: MemberStatus.ACTIVE,
    },
  })

  if (!member) {
    return { success: false, message: 'Non sei membro di questa lega' }
  }

  const prophecies = await prisma.prophecy.findMany({
    where: {
      leagueId,
      playerId,
    },
    include: {
      author: {
        include: { user: { select: { username: true } } },
      },
      movement: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  return {
    success: true,
    data: prophecies.map(p => ({
      id: p.id,
      content: p.content,
      authorRole: p.authorRole,
      author: {
        memberId: p.author.id,
        username: p.author.user.username,
        teamName: p.author.teamName,
      },
      movementType: p.movement.movementType,
      createdAt: p.createdAt,
    })),
  }
}

// ==================== CHECK SE PUO' FARE PROFEZIA ====================

export async function canMakeProphecy(
  movementId: string,
  userId: string
): Promise<ServiceResult> {
  const movement = await prisma.playerMovement.findUnique({
    where: { id: movementId },
    include: {
      player: true,
    },
  })

  if (!movement) {
    return { success: false, message: 'Movimento non trovato' }
  }

  // Get user's membership in this league
  const member = await prisma.leagueMember.findFirst({
    where: {
      leagueId: movement.leagueId,
      userId,
      status: MemberStatus.ACTIVE,
    },
  })

  if (!member) {
    return { success: false, message: 'Non sei membro di questa lega' }
  }

  const isBuyer = movement.toMemberId === member.id
  const isSeller = movement.fromMemberId === member.id

  if (!isBuyer && !isSeller) {
    return {
      success: true,
      data: {
        canMakeProphecy: false,
        reason: 'Non sei coinvolto in questo movimento',
      },
    }
  }

  // Check if already made prophecy
  const existingProphecy = await prisma.prophecy.findUnique({
    where: {
      movementId_authorId: {
        movementId,
        authorId: member.id,
      },
    },
  })

  if (existingProphecy) {
    return {
      success: true,
      data: {
        canMakeProphecy: false,
        reason: 'Hai già fatto una profezia per questo movimento',
        existingProphecy: {
          content: existingProphecy.content,
          createdAt: existingProphecy.createdAt,
        },
      },
    }
  }

  return {
    success: true,
    data: {
      canMakeProphecy: true,
      role: isBuyer ? 'BUYER' : 'SELLER',
      playerName: movement.player.name,
    },
  }
}
