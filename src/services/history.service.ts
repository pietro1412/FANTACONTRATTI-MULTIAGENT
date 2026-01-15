import { PrismaClient, MemberStatus, TradeStatus } from '@prisma/client'

const prisma = new PrismaClient()

export interface ServiceResult {
  success: boolean
  message?: string
  data?: unknown
}

// ==================== SESSIONI OVERVIEW ====================

/**
 * Ottieni l'overview di tutte le sessioni di mercato per una lega
 * Include conteggi per ogni tipo di evento
 */
export async function getSessionsOverview(
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

  const sessions = await prisma.marketSession.findMany({
    where: { leagueId },
    include: {
      _count: {
        select: {
          auctions: true,
          movements: true,
          prizeCategories: true,
        },
      },
      prizePhaseConfig: {
        select: { isFinalized: true, finalizedAt: true },
      },
    },
    orderBy: [{ season: 'desc' }, { createdAt: 'desc' }],
  })

  // Get trade counts per session
  const tradeCounts = await prisma.tradeOffer.groupBy({
    by: ['marketSessionId'],
    _count: { id: true },
    where: {
      marketSession: { leagueId },
    },
  })

  const tradeCountMap = new Map(
    tradeCounts.map(t => [t.marketSessionId, t._count.id])
  )

  const formattedSessions = sessions.map(s => ({
    id: s.id,
    type: s.type,
    season: s.season,
    semester: s.semester,
    status: s.status,
    currentPhase: s.currentPhase,
    createdAt: s.createdAt,
    startsAt: s.startsAt,
    endsAt: s.endsAt,
    counts: {
      auctions: s._count.auctions,
      movements: s._count.movements,
      trades: tradeCountMap.get(s.id) ?? 0,
      prizes: s._count.prizeCategories,
    },
    prizesFinalized: s.prizePhaseConfig?.isFinalized ?? false,
    prizesFinalizedAt: s.prizePhaseConfig?.finalizedAt,
  }))

  return {
    success: true,
    data: { sessions: formattedSessions },
  }
}

// ==================== DETTAGLI SESSIONE ====================

/**
 * Ottieni i dettagli completi di una sessione
 */
export async function getSessionDetails(
  leagueId: string,
  sessionId: string,
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

  const session = await prisma.marketSession.findFirst({
    where: {
      id: sessionId,
      leagueId,
    },
    include: {
      prizePhaseConfig: true,
    },
  })

  if (!session) {
    return { success: false, message: 'Sessione non trovata' }
  }

  // Get summary counts
  const [auctionCounts, tradeCounts, movementCounts] = await Promise.all([
    prisma.auction.groupBy({
      by: ['type'],
      _count: { id: true },
      where: { marketSessionId: sessionId },
    }),
    prisma.tradeOffer.groupBy({
      by: ['status'],
      _count: { id: true },
      where: { marketSessionId: sessionId },
    }),
    prisma.playerMovement.groupBy({
      by: ['movementType'],
      _count: { id: true },
      where: { marketSessionId: sessionId },
    }),
  ])

  return {
    success: true,
    data: {
      session: {
        id: session.id,
        type: session.type,
        season: session.season,
        semester: session.semester,
        status: session.status,
        currentPhase: session.currentPhase,
        createdAt: session.createdAt,
        startsAt: session.startsAt,
        endsAt: session.endsAt,
      },
      summary: {
        auctions: Object.fromEntries(
          auctionCounts.map(a => [a.type, a._count.id])
        ),
        trades: Object.fromEntries(
          tradeCounts.map(t => [t.status, t._count.id])
        ),
        movements: Object.fromEntries(
          movementCounts.map(m => [m.movementType, m._count.id])
        ),
        prizesFinalized: session.prizePhaseConfig?.isFinalized ?? false,
      },
    },
  }
}

// ==================== PRIMO MERCATO ====================

/**
 * Ottieni lo storico del primo mercato: aste, vincitori, composizione rose
 */
export async function getFirstMarketHistory(
  leagueId: string,
  sessionId: string,
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

  // Get all completed auctions for this session
  const auctions = await prisma.auction.findMany({
    where: {
      marketSessionId: sessionId,
      type: 'FREE_BID',
      status: 'COMPLETED',
    },
    include: {
      player: true,
      winner: {
        include: { user: { select: { username: true } } },
      },
      bids: {
        orderBy: { placedAt: 'desc' },
        include: {
          bidder: {
            include: { user: { select: { username: true } } },
          },
        },
      },
      acknowledgments: {
        where: { prophecy: { not: null } },
        include: {
          member: {
            include: { user: { select: { username: true } } },
          },
        },
      },
    },
    orderBy: { endsAt: 'asc' },
  })

  // Get prophecies from the Prophecy table (linked via movements)
  const playerIds = auctions.map(a => a.playerId)
  const propheciesFromTable = await prisma.prophecy.findMany({
    where: {
      leagueId,
      playerId: { in: playerIds },
    },
    include: {
      author: {
        include: { user: { select: { username: true } } },
      },
    },
  })

  // Group prophecies by playerId
  const propheciesByPlayer = new Map<string, typeof propheciesFromTable>()
  for (const p of propheciesFromTable) {
    const existing = propheciesByPlayer.get(p.playerId) || []
    existing.push(p)
    propheciesByPlayer.set(p.playerId, existing)
  }

  // Get members' final budgets and roster stats after first market
  const members = await prisma.leagueMember.findMany({
    where: {
      leagueId,
      status: MemberStatus.ACTIVE,
    },
    include: {
      user: { select: { username: true } },
      roster: {
        where: {
          acquisitionType: 'FIRST_MARKET',
        },
        include: {
          player: true,
          contract: true,
        },
      },
    },
    orderBy: { teamName: 'asc' },
  })

  const formattedAuctions = auctions.map(a => ({
    id: a.id,
    player: {
      id: a.player.id,
      name: a.player.name,
      position: a.player.position,
      team: a.player.team,
    },
    basePrice: a.basePrice,
    finalPrice: a.currentPrice,
    winner: a.winner
      ? {
          memberId: a.winner.id,
          username: a.winner.user.username,
          teamName: a.winner.teamName,
        }
      : null,
    bidCount: a.bids.length,
    bids: a.bids.slice(0, 10).map(b => ({
      amount: b.amount,
      bidder: {
        username: b.bidder.user.username,
        teamName: b.bidder.teamName,
      },
      placedAt: b.placedAt,
      isWinning: b.isWinning,
    })),
    prophecies: [
      // From acknowledgments (temporary storage during auction)
      ...a.acknowledgments
        .filter(ack => ack.prophecy)
        .map(ack => ({
          content: ack.prophecy as string,
          author: {
            username: ack.member.user.username,
            teamName: ack.member.teamName,
          },
        })),
      // From Prophecy table (permanent storage)
      ...(propheciesByPlayer.get(a.playerId) || []).map(p => ({
        content: p.content,
        author: {
          username: p.author.user.username,
          teamName: p.author.teamName,
        },
      })),
    ].filter((p, idx, arr) =>
      // Remove duplicates based on content
      arr.findIndex(x => x.content === p.content && x.author.username === p.author.username) === idx
    ),
    endedAt: a.endsAt,
  }))

  const formattedMembers = members.map(m => {
    const rosterByPosition = {
      P: m.roster.filter(r => r.player.position === 'P'),
      D: m.roster.filter(r => r.player.position === 'D'),
      C: m.roster.filter(r => r.player.position === 'C'),
      A: m.roster.filter(r => r.player.position === 'A'),
    }

    const totalSpent = m.roster.reduce((sum, r) => {
      // Find the auction for this player to get the price
      const auction = auctions.find(a => a.playerId === r.playerId && a.winnerId === m.id)
      return sum + (auction?.currentPrice ?? 0)
    }, 0)

    return {
      memberId: m.id,
      username: m.user.username,
      teamName: m.teamName,
      currentBudget: m.currentBudget,
      totalSpent,
      roster: Object.entries(rosterByPosition).map(([position, players]) => ({
        position,
        players: players.map(r => ({
          id: r.player.id,
          name: r.player.name,
          team: r.player.team,
          contract: r.contract
            ? {
                salary: r.contract.salary,
                duration: r.contract.duration,
              }
            : null,
        })),
      })),
      rosterCount: m.roster.length,
    }
  })

  return {
    success: true,
    data: {
      auctions: formattedAuctions,
      members: formattedMembers,
      stats: {
        totalAuctions: auctions.length,
        avgPrice: auctions.length > 0
          ? Math.round(auctions.reduce((sum, a) => sum + a.currentPrice, 0) / auctions.length)
          : 0,
        maxPrice: auctions.length > 0
          ? Math.max(...auctions.map(a => a.currentPrice))
          : 0,
      },
    },
  }
}

// ==================== SCAMBI SESSIONE ====================

/**
 * Ottieni tutti gli scambi di una sessione (accettati e rifiutati)
 */
export async function getSessionTrades(
  leagueId: string,
  sessionId: string,
  userId: string,
  options?: {
    status?: 'ALL' | 'ACCEPTED' | 'REJECTED' | 'PENDING' | 'COUNTERED'
    limit?: number
    offset?: number
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

  // Build status filter
  let statusFilter: TradeStatus[] | undefined
  if (options?.status && options.status !== 'ALL') {
    statusFilter = [options.status as TradeStatus]
  }

  const trades = await prisma.tradeOffer.findMany({
    where: {
      marketSessionId: sessionId,
      ...(statusFilter ? { status: { in: statusFilter } } : {}),
    },
    include: {
      sender: { select: { id: true, username: true } },
      receiver: { select: { id: true, username: true } },
      parentOffer: {
        select: { id: true, status: true },
      },
      counterOffers: {
        select: { id: true, status: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: options?.limit ?? 100,
    skip: options?.offset ?? 0,
  })

  // Get sender and receiver member info
  const userIds = [...new Set(trades.flatMap(t => [t.senderId, t.receiverId]))]
  const membersByUserId = await prisma.leagueMember.findMany({
    where: {
      leagueId,
      userId: { in: userIds },
    },
    include: {
      user: { select: { username: true } },
    },
  })
  const memberMap = new Map(membersByUserId.map(m => [m.userId, m]))

  // Enrich with player details
  const enrichedTrades = await Promise.all(
    trades.map(async trade => {
      const offeredPlayerIds = trade.offeredPlayers as string[]
      const requestedPlayerIds = trade.requestedPlayers as string[]

      const [offeredPlayers, requestedPlayers] = await Promise.all([
        prisma.playerRoster.findMany({
          where: { id: { in: offeredPlayerIds } },
          include: { player: true, contract: true },
        }),
        prisma.playerRoster.findMany({
          where: { id: { in: requestedPlayerIds } },
          include: { player: true, contract: true },
        }),
      ])

      const senderMember = memberMap.get(trade.senderId)
      const receiverMember = memberMap.get(trade.receiverId)

      return {
        id: trade.id,
        status: trade.status,
        sender: {
          userId: trade.senderId,
          username: trade.sender.username,
          memberId: senderMember?.id,
          teamName: senderMember?.teamName,
        },
        receiver: {
          userId: trade.receiverId,
          username: trade.receiver.username,
          memberId: receiverMember?.id,
          teamName: receiverMember?.teamName,
        },
        offeredBudget: trade.offeredBudget,
        requestedBudget: trade.requestedBudget,
        message: trade.message,
        offeredPlayers: offeredPlayers.map(r => ({
          id: r.player.id,
          name: r.player.name,
          position: r.player.position,
          team: r.player.team,
          contract: r.contract
            ? {
                salary: r.contract.salary,
                duration: r.contract.duration,
                rescissionClause: r.contract.rescissionClause,
              }
            : null,
        })),
        requestedPlayers: requestedPlayers.map(r => ({
          id: r.player.id,
          name: r.player.name,
          position: r.player.position,
          team: r.player.team,
          contract: r.contract
            ? {
                salary: r.contract.salary,
                duration: r.contract.duration,
                rescissionClause: r.contract.rescissionClause,
              }
            : null,
        })),
        createdAt: trade.createdAt,
        respondedAt: trade.respondedAt,
        expiresAt: trade.expiresAt,
        isCounterOffer: !!trade.parentOfferId,
        counterOfferCount: trade.counterOffers.length,
      }
    })
  )

  return {
    success: true,
    data: {
      trades: enrichedTrades,
      counts: {
        total: enrichedTrades.length,
        accepted: enrichedTrades.filter(t => t.status === 'ACCEPTED').length,
        rejected: enrichedTrades.filter(t => t.status === 'REJECTED').length,
        pending: enrichedTrades.filter(t => t.status === 'PENDING').length,
      },
    },
  }
}

// ==================== PREMI SESSIONE ====================

/**
 * Ottieni i premi assegnati in una sessione
 */
export async function getSessionPrizes(
  leagueId: string,
  sessionId: string,
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

  const session = await prisma.marketSession.findFirst({
    where: {
      id: sessionId,
      leagueId,
    },
    include: {
      prizePhaseConfig: true,
    },
  })

  if (!session) {
    return { success: false, message: 'Sessione non trovata' }
  }

  // Get categories with prizes
  const categories = await prisma.prizeCategory.findMany({
    where: { marketSessionId: sessionId },
    include: {
      managerPrizes: {
        include: {
          leagueMember: {
            include: { user: { select: { username: true } } },
          },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  // Get all members
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

  // Calculate totals per member
  const memberTotals: Record<string, number> = {}
  const baseReincrement = session.prizePhaseConfig?.baseReincrement ?? 0

  for (const m of members) {
    memberTotals[m.id] = baseReincrement
    for (const cat of categories) {
      const prize = cat.managerPrizes.find(p => p.leagueMemberId === m.id)
      if (prize) {
        memberTotals[m.id] += prize.amount
      }
    }
  }

  return {
    success: true,
    data: {
      config: {
        baseReincrement,
        isFinalized: session.prizePhaseConfig?.isFinalized ?? false,
        finalizedAt: session.prizePhaseConfig?.finalizedAt,
      },
      categories: categories.map(cat => ({
        id: cat.id,
        name: cat.name,
        isSystemPrize: cat.isSystemPrize,
        prizes: cat.managerPrizes.map(p => ({
          memberId: p.leagueMemberId,
          teamName: p.leagueMember.teamName,
          username: p.leagueMember.user.username,
          amount: p.amount,
        })),
      })),
      members: members.map(m => ({
        id: m.id,
        username: m.user.username,
        teamName: m.teamName,
        totalPrize: memberTotals[m.id],
      })),
    },
  }
}

// ==================== RUBATA SESSIONE ====================

/**
 * Ottieni lo storico delle aste rubata di una sessione
 */
export async function getSessionRubataHistory(
  leagueId: string,
  sessionId: string,
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

  const auctions = await prisma.auction.findMany({
    where: {
      marketSessionId: sessionId,
      type: 'RUBATA',
      status: { in: ['COMPLETED', 'NO_BIDS'] },
    },
    include: {
      player: true,
      winner: {
        include: { user: { select: { username: true } } },
      },
      seller: {
        include: { user: { select: { username: true } } },
      },
      bids: {
        orderBy: { amount: 'desc' },
        take: 5,
        include: {
          bidder: {
            include: { user: { select: { username: true } } },
          },
        },
      },
    },
    orderBy: { endsAt: 'asc' },
  })

  const formattedAuctions = auctions.map(a => ({
    id: a.id,
    player: {
      id: a.player.id,
      name: a.player.name,
      position: a.player.position,
      team: a.player.team,
    },
    basePrice: a.basePrice,
    finalPrice: a.currentPrice,
    seller: a.seller
      ? {
          memberId: a.seller.id,
          username: a.seller.user.username,
          teamName: a.seller.teamName,
        }
      : null,
    winner: a.winner
      ? {
          memberId: a.winner.id,
          username: a.winner.user.username,
          teamName: a.winner.teamName,
        }
      : null,
    wasStolen: a.winner && a.seller && a.winner.id !== a.seller.id,
    noBids: a.status === 'NO_BIDS',
    topBids: a.bids.map(b => ({
      amount: b.amount,
      bidder: {
        username: b.bidder.user.username,
        teamName: b.bidder.teamName,
      },
    })),
    endedAt: a.endsAt,
  }))

  // Stats
  const stolen = formattedAuctions.filter(a => a.wasStolen).length
  const retained = formattedAuctions.filter(a => a.winner && !a.wasStolen).length
  const noBids = formattedAuctions.filter(a => a.noBids).length

  return {
    success: true,
    data: {
      auctions: formattedAuctions,
      stats: {
        total: formattedAuctions.length,
        stolen,
        retained,
        noBids,
      },
    },
  }
}

// ==================== SVINCOLATI SESSIONE ====================

/**
 * Ottieni lo storico delle aste svincolati di una sessione
 */
export async function getSessionSvincolatiHistory(
  leagueId: string,
  sessionId: string,
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

  // Get movements of type SVINCOLATI for this session
  const movements = await prisma.playerMovement.findMany({
    where: {
      marketSessionId: sessionId,
      movementType: 'SVINCOLATI',
    },
    include: {
      player: true,
      toMember: {
        include: { user: { select: { username: true } } },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  // Also get auctions for this session with svincolati phase
  const auctions = await prisma.auction.findMany({
    where: {
      marketSessionId: sessionId,
      type: 'FREE_BID',
      status: { in: ['COMPLETED', 'NO_BIDS'] },
    },
    include: {
      player: true,
      winner: {
        include: { user: { select: { username: true } } },
      },
      nominator: {
        include: { user: { select: { username: true } } },
      },
      bids: {
        orderBy: { amount: 'desc' },
        take: 5,
        include: {
          bidder: {
            include: { user: { select: { username: true } } },
          },
        },
      },
    },
    orderBy: { endsAt: 'asc' },
  })

  // Filter auctions that are from svincolati phase (by checking movements)
  const svincolatiPlayerIds = new Set(movements.map(m => m.playerId))
  const svincolatiAuctions = auctions.filter(a => svincolatiPlayerIds.has(a.playerId))

  const formattedAuctions = svincolatiAuctions.map(a => ({
    id: a.id,
    player: {
      id: a.player.id,
      name: a.player.name,
      position: a.player.position,
      team: a.player.team,
    },
    basePrice: a.basePrice,
    finalPrice: a.currentPrice,
    nominator: a.nominator
      ? {
          memberId: a.nominator.id,
          username: a.nominator.user.username,
          teamName: a.nominator.teamName,
        }
      : null,
    winner: a.winner
      ? {
          memberId: a.winner.id,
          username: a.winner.user.username,
          teamName: a.winner.teamName,
        }
      : null,
    noBids: a.status === 'NO_BIDS',
    topBids: a.bids.map(b => ({
      amount: b.amount,
      bidder: {
        username: b.bidder.user.username,
        teamName: b.bidder.teamName,
      },
    })),
    endedAt: a.endsAt,
  }))

  // Get stats by member
  const memberStats: Record<string, { acquired: number; spent: number }> = {}
  for (const a of svincolatiAuctions) {
    if (a.winner) {
      if (!memberStats[a.winner.id]) {
        memberStats[a.winner.id] = { acquired: 0, spent: 0 }
      }
      memberStats[a.winner.id].acquired++
      memberStats[a.winner.id].spent += a.currentPrice
    }
  }

  return {
    success: true,
    data: {
      auctions: formattedAuctions,
      stats: {
        total: formattedAuctions.length,
        totalSpent: formattedAuctions.reduce((sum, a) => sum + a.finalPrice, 0),
        avgPrice: formattedAuctions.length > 0
          ? Math.round(
              formattedAuctions.reduce((sum, a) => sum + a.finalPrice, 0) /
                formattedAuctions.length
            )
          : 0,
      },
    },
  }
}

// ==================== TIMELINE EVENTI ====================

/**
 * Ottieni gli eventi in ordine cronologico con filtri
 */
export async function getTimelineEvents(
  leagueId: string,
  userId: string,
  options?: {
    limit?: number
    offset?: number
    eventTypes?: string[]
    sessionId?: string
    playerId?: string
    startDate?: Date
    endDate?: Date
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

  const limit = options?.limit ?? 50
  const offset = options?.offset ?? 0

  // Build where conditions for movements
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const movementWhere: any = { leagueId }
  if (options?.sessionId) {
    movementWhere.marketSessionId = options.sessionId
  }
  if (options?.playerId) {
    movementWhere.playerId = options.playerId
  }
  if (options?.startDate || options?.endDate) {
    movementWhere.createdAt = {}
    if (options.startDate) movementWhere.createdAt.gte = options.startDate
    if (options.endDate) movementWhere.createdAt.lte = options.endDate
  }
  if (options?.eventTypes && options.eventTypes.length > 0) {
    movementWhere.movementType = { in: options.eventTypes }
  }

  // Get movements as base events
  const movements = await prisma.playerMovement.findMany({
    where: movementWhere,
    include: {
      player: true,
      fromMember: {
        include: { user: { select: { username: true } } },
      },
      toMember: {
        include: { user: { select: { username: true } } },
      },
      marketSession: {
        select: { type: true, season: true, semester: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
  })

  const events = movements.map(m => ({
    id: m.id,
    type: m.movementType,
    createdAt: m.createdAt,
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
    contract: m.newSalary
      ? {
          salary: m.newSalary,
          duration: m.newDuration,
          clause: m.newClause,
        }
      : null,
    session: m.marketSession
      ? {
          type: m.marketSession.type,
          season: m.marketSession.season,
          semester: m.marketSession.semester,
        }
      : null,
  }))

  return {
    success: true,
    data: {
      events,
      hasMore: events.length === limit,
    },
  }
}

// ==================== CARRIERA GIOCATORE ====================

/**
 * Ottieni la carriera completa di un giocatore nella lega
 */
export async function getPlayerCareer(
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

  // Get all movements for this player in the league
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

  // Calculate stats
  const trades = movements.filter(m => m.movementType === 'TRADE').length
  const acquisitions = movements.filter(m =>
    ['FIRST_MARKET', 'RUBATA', 'SVINCOLATI'].includes(m.movementType)
  ).length
  const renewals = movements.filter(m => m.movementType === 'CONTRACT_RENEW').length
  const totalValue = movements
    .filter(m => m.price)
    .reduce((sum, m) => sum + (m.price ?? 0), 0)

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
      timeline: movements.map(m => ({
        id: m.id,
        type: m.movementType,
        date: m.createdAt,
        from: m.fromMember
          ? {
              username: m.fromMember.user.username,
              teamName: m.fromMember.teamName,
            }
          : null,
        to: m.toMember
          ? {
              username: m.toMember.user.username,
              teamName: m.toMember.teamName,
            }
          : null,
        price: m.price,
        oldContract: m.oldSalary
          ? { salary: m.oldSalary, duration: m.oldDuration, clause: m.oldClause }
          : null,
        newContract: m.newSalary
          ? { salary: m.newSalary, duration: m.newDuration, clause: m.newClause }
          : null,
        session: m.marketSession
          ? `${m.marketSession.type} S${m.marketSession.season}`
          : null,
      })),
      stats: {
        totalMovements: movements.length,
        trades,
        acquisitions,
        renewals,
        totalValue,
        teams: [...new Set(movements.map(m => m.toMember?.teamName).filter(Boolean))],
      },
    },
  }
}

// ==================== PROFEZIE ====================

/**
 * Ottieni tutte le profezie della lega con filtri
 */
export async function getProphecies(
  leagueId: string,
  userId: string,
  options?: {
    playerId?: string
    authorId?: string
    search?: string
    limit?: number
    offset?: number
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

  // Build where clause
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { leagueId }

  if (options?.playerId) {
    where.playerId = options.playerId
  }

  if (options?.authorId) {
    where.authorId = options.authorId
  }

  if (options?.search) {
    where.OR = [
      { content: { contains: options.search, mode: 'insensitive' } },
      { player: { name: { contains: options.search, mode: 'insensitive' } } },
      { author: { user: { username: { contains: options.search, mode: 'insensitive' } } } },
      { author: { teamName: { contains: options.search, mode: 'insensitive' } } },
    ]
  }

  const limit = options?.limit ?? 50
  const offset = options?.offset ?? 0

  // Get total count
  const total = await prisma.prophecy.count({ where })

  // Get prophecies
  const prophecies = await prisma.prophecy.findMany({
    where,
    include: {
      player: true,
      author: {
        include: { user: { select: { username: true } } },
      },
      movement: {
        include: {
          marketSession: {
            select: { type: true, season: true, semester: true },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
  })

  const formatted = prophecies.map(p => ({
    id: p.id,
    content: p.content,
    authorRole: p.authorRole,
    createdAt: p.createdAt,
    player: {
      id: p.player.id,
      name: p.player.name,
      position: p.player.position,
      team: p.player.team,
    },
    author: {
      memberId: p.author.id,
      username: p.author.user.username,
      teamName: p.author.teamName,
    },
    session: p.movement?.marketSession
      ? {
          type: p.movement.marketSession.type,
          season: p.movement.marketSession.season,
          semester: p.movement.marketSession.semester,
        }
      : null,
    movementType: p.movement?.movementType ?? null,
    movementPrice: p.movement?.price ?? null,
  }))

  return {
    success: true,
    data: {
      prophecies: formatted,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + prophecies.length < total,
      },
    },
  }
}

/**
 * Ottieni statistiche profezie per la lega
 */
export async function getProphecyStats(
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

  // Get counts by author
  const byAuthor = await prisma.prophecy.groupBy({
    by: ['authorId'],
    _count: { id: true },
    where: { leagueId },
    orderBy: { _count: { id: 'desc' } },
  })

  // Get author details
  const authorIds = byAuthor.map(a => a.authorId)
  const authors = await prisma.leagueMember.findMany({
    where: { id: { in: authorIds } },
    include: { user: { select: { username: true } } },
  })
  const authorMap = new Map(authors.map(a => [a.id, a]))

  // Get counts by player
  const byPlayer = await prisma.prophecy.groupBy({
    by: ['playerId'],
    _count: { id: true },
    where: { leagueId },
    orderBy: { _count: { id: 'desc' } },
    take: 10,
  })

  // Get player details
  const playerIds = byPlayer.map(p => p.playerId)
  const players = await prisma.serieAPlayer.findMany({
    where: { id: { in: playerIds } },
  })
  const playerMap = new Map(players.map(p => [p.id, p]))

  // Total count
  const total = await prisma.prophecy.count({ where: { leagueId } })

  return {
    success: true,
    data: {
      total,
      byAuthor: byAuthor.map(a => ({
        memberId: a.authorId,
        username: authorMap.get(a.authorId)?.user.username ?? 'Unknown',
        teamName: authorMap.get(a.authorId)?.teamName,
        count: a._count.id,
      })),
      topPlayers: byPlayer.map(p => ({
        playerId: p.playerId,
        name: playerMap.get(p.playerId)?.name ?? 'Unknown',
        position: playerMap.get(p.playerId)?.position,
        team: playerMap.get(p.playerId)?.team,
        count: p._count.id,
      })),
    },
  }
}

// ==================== RICERCA GIOCATORI ====================

/**
 * Cerca giocatori per il filtro storico
 */
export async function searchPlayersForHistory(
  leagueId: string,
  userId: string,
  search?: string,
  options?: {
    includeReleased?: boolean
    limit?: number
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

  // Get players that have been in this league (via movements or rosters)
  const playerIds = await prisma.playerMovement.findMany({
    where: { leagueId },
    select: { playerId: true },
    distinct: ['playerId'],
  })

  const uniquePlayerIds = [...new Set(playerIds.map(p => p.playerId))]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerWhere: any = {
    id: { in: uniquePlayerIds },
  }

  if (search) {
    playerWhere.name = { contains: search, mode: 'insensitive' }
  }

  const players = await prisma.serieAPlayer.findMany({
    where: playerWhere,
    take: options?.limit ?? 20,
    orderBy: { name: 'asc' },
  })

  // Get current roster status for each player
  const currentRosters = await prisma.playerRoster.findMany({
    where: {
      playerId: { in: players.map(p => p.id) },
      leagueMember: { leagueId },
      status: 'ACTIVE',
    },
    include: {
      leagueMember: {
        include: { user: { select: { username: true } } },
      },
    },
  })

  const rosterMap = new Map(currentRosters.map(r => [r.playerId, r]))

  const formattedPlayers = players.map(p => {
    const roster = rosterMap.get(p.id)
    return {
      id: p.id,
      name: p.name,
      position: p.position,
      team: p.team,
      currentOwner: roster
        ? {
            username: roster.leagueMember.user.username,
            teamName: roster.leagueMember.teamName,
          }
        : null,
      isActive: !!roster,
    }
  })

  // Filter out released players if not requested
  const result = options?.includeReleased
    ? formattedPlayers
    : formattedPlayers.filter(p => p.isActive)

  return {
    success: true,
    data: { players: result },
  }
}
