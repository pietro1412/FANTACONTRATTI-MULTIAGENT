import { PrismaClient, MemberStatus, ProphecyRole, Prisma } from '@prisma/client'

const prisma = new PrismaClient()

export interface ServiceResult {
  success: boolean
  message?: string
  data?: unknown
}

// ==================== EXPORT ALL ROSTERS ====================

export async function exportAllRosters(
  leagueId: string,
  adminUserId: string
): Promise<ServiceResult> {
  // Verify admin
  const adminMember = await prisma.leagueMember.findFirst({
    where: {
      leagueId,
      userId: adminUserId,
      role: 'ADMIN',
      status: MemberStatus.ACTIVE,
    },
  })

  if (!adminMember) {
    return { success: false, message: 'Non autorizzato' }
  }

  // Get all members with their rosters
  const members = await prisma.leagueMember.findMany({
    where: {
      leagueId,
      status: MemberStatus.ACTIVE,
    },
    include: {
      user: { select: { username: true } },
      roster: {
        where: { status: 'ACTIVE' },
        include: {
          player: true,
          contract: true,
        },
      },
    },
  })

  const exportData = members.map(member => ({
    username: member.user.username,
    teamName: member.teamName,
    budget: member.currentBudget,
    players: member.roster.map(r => ({
      name: r.player.name,
      team: r.player.team,
      position: r.player.position,
      quotation: r.player.quotation,
      acquisitionPrice: r.acquisitionPrice,
      acquisitionType: r.acquisitionType,
      salary: r.contract?.salary || null,
      duration: r.contract?.duration || null,
      rescissionClause: r.contract?.rescissionClause || null,
    })),
  }))

  return {
    success: true,
    data: exportData,
  }
}

// ==================== AUDIT LOG ====================

export async function getAuditLog(
  leagueId: string,
  adminUserId: string,
  options?: {
    limit?: number
    offset?: number
    action?: string
  }
): Promise<ServiceResult> {
  // Verify admin
  const adminMember = await prisma.leagueMember.findFirst({
    where: {
      leagueId,
      userId: adminUserId,
      role: 'ADMIN',
      status: MemberStatus.ACTIVE,
    },
  })

  if (!adminMember) {
    return { success: false, message: 'Non autorizzato' }
  }

  const whereConditions: Prisma.AuditLogWhereInput = {
    leagueId,
  }

  if (options?.action) {
    whereConditions.action = options.action
  }

  const logs = await prisma.auditLog.findMany({
    where: whereConditions,
    include: {
      user: { select: { username: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: options?.limit || 100,
    skip: options?.offset || 0,
  })

  return {
    success: true,
    data: logs,
  }
}

// ==================== LOG ACTION ====================

export async function logAction(
  userId: string | null,
  leagueId: string | null,
  action: string,
  entityType?: string,
  entityId?: string,
  oldValues?: object,
  newValues?: object,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        leagueId,
        action,
        entityType,
        entityId,
        oldValues: oldValues as never,
        newValues: newValues as never,
        ipAddress,
        userAgent,
      },
    })
  } catch (error) {
    console.error('Failed to log action:', error)
  }
}

// ==================== LEAGUE STATISTICS ====================

export async function getLeagueStatistics(
  leagueId: string,
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

  // Get all data for statistics
  const [
    league,
    members,
    totalPlayers,
    completedAuctions,
    completedTrades,
  ] = await Promise.all([
    prisma.league.findUnique({ where: { id: leagueId } }),
    prisma.leagueMember.findMany({
      where: { leagueId, status: MemberStatus.ACTIVE },
      include: {
        user: { select: { username: true } },
        roster: { where: { status: 'ACTIVE' } },
      },
    }),
    prisma.playerRoster.count({
      where: {
        leagueMember: { leagueId },
        status: 'ACTIVE',
      },
    }),
    prisma.auction.count({
      where: {
        leagueId,
        status: 'COMPLETED',
      },
    }),
    prisma.tradeOffer.count({
      where: {
        marketSession: { leagueId },
        status: 'ACCEPTED',
      },
    }),
  ])

  const memberStats = members.map(m => ({
    username: m.user.username,
    teamName: m.teamName,
    budget: m.currentBudget,
    playerCount: m.roster.length,
  }))

  // Sort by player count for leaderboard
  memberStats.sort((a, b) => b.playerCount - a.playerCount)

  return {
    success: true,
    data: {
      league: {
        name: league?.name,
        status: league?.status,
        maxParticipants: league?.maxParticipants,
        initialBudget: league?.initialBudget,
      },
      memberCount: members.length,
      totalPlayersAssigned: totalPlayers,
      completedAuctions,
      completedTrades,
      memberStats,
    },
  }
}

// ==================== RESET AUCTION SESSION ====================

/**
 * Reset the first market auction to initial state
 * - Deletes all auctions, bids, acknowledgments
 * - Removes all roster entries
 * - Resets all budgets to initial
 * - Resets session turn order
 */
export async function resetFirstMarket(
  leagueId: string,
  adminUserId: string
): Promise<ServiceResult> {
  // Verify admin
  const adminMember = await prisma.leagueMember.findFirst({
    where: {
      leagueId,
      userId: adminUserId,
      role: 'ADMIN',
      status: MemberStatus.ACTIVE,
    },
  })

  if (!adminMember) {
    return { success: false, message: 'Non autorizzato' }
  }

  // Get league info
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
  })

  if (!league) {
    return { success: false, message: 'Lega non trovata' }
  }

  // Get active market session
  const session = await prisma.marketSession.findFirst({
    where: {
      leagueId,
      type: 'PRIMO_MERCATO',
    },
    orderBy: { createdAt: 'desc' },
  })

  if (!session) {
    return { success: false, message: 'Nessuna sessione PRIMO MERCATO trovata' }
  }

  // Delete all auction appeals for this session's auctions
  await prisma.auctionAppeal.deleteMany({
    where: {
      auction: {
        marketSessionId: session.id,
      },
    },
  })

  // Delete all auction acknowledgments for this session's auctions
  await prisma.auctionAcknowledgment.deleteMany({
    where: {
      auction: {
        marketSessionId: session.id,
      },
    },
  })

  // Delete all bids for this session's auctions
  await prisma.auctionBid.deleteMany({
    where: {
      auction: {
        marketSessionId: session.id,
      },
    },
  })

  // Delete all auctions for this session
  await prisma.auction.deleteMany({
    where: {
      marketSessionId: session.id,
    },
  })

  // Delete all prophecies for this league
  await prisma.prophecy.deleteMany({
    where: { leagueId },
  })

  // Delete all player movements for this league
  await prisma.playerMovement.deleteMany({
    where: { leagueId },
  })

  // Delete all contracts for players in this league
  await prisma.playerContract.deleteMany({
    where: {
      roster: {
        leagueMember: { leagueId },
      },
    },
  })

  // Delete all roster entries for this league
  await prisma.playerRoster.deleteMany({
    where: {
      leagueMember: { leagueId },
    },
  })

  // Reset all member budgets to initial
  await prisma.leagueMember.updateMany({
    where: {
      leagueId,
      status: MemberStatus.ACTIVE,
    },
    data: {
      currentBudget: league.initialBudget,
    },
  })

  // Reset session
  await prisma.marketSession.update({
    where: { id: session.id },
    data: {
      currentTurnIndex: 0,
      currentRole: 'P',
      pendingNominationPlayerId: null,
      pendingNominatorId: null,
      nominatorConfirmed: false,
      readyMembers: Prisma.JsonNull,
      status: 'ACTIVE',
    },
  })

  return {
    success: true,
    message: 'Primo Mercato resettato. Pronto per ricominciare.',
    data: {
      sessionId: session.id,
      initialBudget: league.initialBudget,
    },
  }
}

// ==================== MIGRATE PROPHECIES ====================

/**
 * Migrate prophecies from AuctionAcknowledgment to Prophecy model
 * This is a one-time migration for existing prophecies
 */
export async function migrateProphecies(
  leagueId: string,
  adminUserId: string
): Promise<ServiceResult> {
  // Verify admin
  const adminMember = await prisma.leagueMember.findFirst({
    where: {
      leagueId,
      userId: adminUserId,
      role: 'ADMIN',
      status: MemberStatus.ACTIVE,
    },
  })

  if (!adminMember) {
    return { success: false, message: 'Non autorizzato' }
  }

  // Get all auction acknowledgments with prophecies for this league
  const acknowledgments = await prisma.auctionAcknowledgment.findMany({
    where: {
      prophecy: { not: null },
      auction: { leagueId },
    },
    include: {
      auction: {
        include: {
          player: true,
        },
      },
      member: true,
    },
  })

  let migrated = 0
  let skipped = 0
  const errors: string[] = []

  for (const ack of acknowledgments) {
    if (!ack.prophecy?.trim()) {
      skipped++
      continue
    }

    // Find the movement associated with this auction
    const movement = await prisma.playerMovement.findFirst({
      where: {
        auctionId: ack.auctionId,
      },
    })

    if (!movement) {
      errors.push(`Nessun movimento trovato per asta ${ack.auctionId}`)
      continue
    }

    // Determine role
    const isBuyer = movement.toMemberId === ack.memberId
    const isSeller = movement.fromMemberId === ack.memberId

    if (!isBuyer && !isSeller) {
      // User is not buyer or seller, skip
      skipped++
      continue
    }

    // Check if prophecy already exists
    const existingProphecy = await prisma.prophecy.findUnique({
      where: {
        movementId_authorId: {
          movementId: movement.id,
          authorId: ack.memberId,
        },
      },
    })

    if (existingProphecy) {
      skipped++
      continue
    }

    // Create prophecy
    try {
      await prisma.prophecy.create({
        data: {
          leagueId,
          playerId: ack.auction.playerId,
          authorId: ack.memberId,
          movementId: movement.id,
          authorRole: isBuyer ? ProphecyRole.BUYER : ProphecyRole.SELLER,
          content: ack.prophecy.trim(),
          createdAt: ack.acknowledgedAt,
        },
      })
      migrated++
    } catch (error) {
      errors.push(`Errore migrazione profezia per asta ${ack.auctionId}: ${error}`)
    }
  }

  return {
    success: true,
    message: `Migrazione completata: ${migrated} profezie migrate, ${skipped} saltate`,
    data: {
      migrated,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
    },
  }
}

// ==================== ASSIGN PRIZE (INCREMENT BUDGET) ====================

export async function assignPrize(
  leagueId: string,
  adminUserId: string,
  memberId: string,
  amount: number,
  reason?: string
): Promise<ServiceResult> {
  // Verify admin
  const adminMember = await prisma.leagueMember.findFirst({
    where: {
      leagueId,
      userId: adminUserId,
      role: 'ADMIN',
      status: MemberStatus.ACTIVE,
    },
  })

  if (!adminMember) {
    return { success: false, message: 'Non autorizzato' }
  }

  // Validate amount
  if (!Number.isInteger(amount) || amount <= 0) {
    return { success: false, message: 'L\'importo deve essere un numero intero positivo' }
  }

  // Get target member
  const targetMember = await prisma.leagueMember.findFirst({
    where: {
      id: memberId,
      leagueId,
      status: MemberStatus.ACTIVE,
    },
    include: {
      user: { select: { username: true } },
    },
  })

  if (!targetMember) {
    return { success: false, message: 'Manager non trovato' }
  }

  // Update budget and create prize record
  const [updatedMember, prize] = await prisma.$transaction([
    prisma.leagueMember.update({
      where: { id: memberId },
      data: {
        currentBudget: { increment: amount },
      },
    }),
    prisma.prize.create({
      data: {
        leagueId,
        memberId,
        adminId: adminMember.id,
        amount,
        reason: reason || null,
      },
    }),
  ])

  return {
    success: true,
    message: `Premio di ${amount}M assegnato a ${targetMember.teamName}${reason ? ` (${reason})` : ''}`,
    data: {
      memberId,
      teamName: targetMember.teamName,
      username: targetMember.user.username,
      amount,
      reason,
      newBudget: updatedMember.currentBudget,
      prizeId: prize.id,
    },
  }
}

// ==================== GET PRIZE HISTORY ====================

export async function getPrizeHistory(
  leagueId: string,
  adminUserId: string
): Promise<ServiceResult> {
  // Verify admin
  const adminMember = await prisma.leagueMember.findFirst({
    where: {
      leagueId,
      userId: adminUserId,
      role: 'ADMIN',
      status: MemberStatus.ACTIVE,
    },
  })

  if (!adminMember) {
    return { success: false, message: 'Non autorizzato' }
  }

  // Get all prizes for this league
  const prizes = await prisma.prize.findMany({
    where: { leagueId },
    include: {
      member: {
        include: {
          user: { select: { username: true } },
        },
      },
      admin: {
        include: {
          user: { select: { username: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return {
    success: true,
    data: prizes.map(p => ({
      id: p.id,
      memberId: p.memberId,
      teamName: p.member.teamName,
      username: p.member.user.username,
      adminUsername: p.admin.user.username,
      amount: p.amount,
      reason: p.reason,
      createdAt: p.createdAt,
    })),
  }
}

// ==================== GET ALL MEMBERS FOR PRIZES ====================

export async function getMembersForPrizes(
  leagueId: string,
  adminUserId: string
): Promise<ServiceResult> {
  // Verify admin
  const adminMember = await prisma.leagueMember.findFirst({
    where: {
      leagueId,
      userId: adminUserId,
      role: 'ADMIN',
      status: MemberStatus.ACTIVE,
    },
  })

  if (!adminMember) {
    return { success: false, message: 'Non autorizzato' }
  }

  // Get all active members
  const members = await prisma.leagueMember.findMany({
    where: {
      leagueId,
      status: MemberStatus.ACTIVE,
    },
    include: {
      user: { select: { username: true } },
    },
    orderBy: { teamName: 'asc' },
  })

  return {
    success: true,
    data: members.map(m => ({
      id: m.id,
      teamName: m.teamName,
      username: m.user.username,
      currentBudget: m.currentBudget,
    })),
  }
}
