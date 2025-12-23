import { PrismaClient, MemberStatus, AuctionStatus, Position, Prisma } from '@prisma/client'
import { recordMovement } from './movement.service'

const prisma = new PrismaClient()

export interface ServiceResult {
  success: boolean
  message?: string
  data?: unknown
}

// ==================== PHASE CHECK ====================

async function isInSvincolatiPhase(leagueId: string): Promise<boolean> {
  const activeSession = await prisma.marketSession.findFirst({
    where: {
      leagueId,
      status: 'ACTIVE',
      currentPhase: 'SVINCOLATI',
    },
  })
  return !!activeSession
}

// ==================== GET FREE AGENTS POOL ====================

interface FreeAgentFilters {
  position?: Position
  team?: string
  search?: string
  minQuotation?: number
  maxQuotation?: number
}

export async function getFreeAgents(
  leagueId: string,
  userId: string,
  filters?: FreeAgentFilters
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

  // Get all active players in rosters for this league
  const rostersInLeague = await prisma.playerRoster.findMany({
    where: {
      leagueMember: { leagueId },
      status: 'ACTIVE',
    },
    select: { playerId: true },
  })

  const assignedPlayerIds = rostersInLeague.map(r => r.playerId)

  // Build filter conditions
  const whereConditions: Prisma.SerieAPlayerWhereInput = {
    id: { notIn: assignedPlayerIds },
    isActive: true,
    listStatus: 'IN_LIST', // Exclude players not in current list
  }

  if (filters?.position) {
    whereConditions.position = filters.position
  }

  if (filters?.team) {
    whereConditions.team = filters.team
  }

  if (filters?.search) {
    whereConditions.name = { contains: filters.search, mode: 'insensitive' }
  }

  if (filters?.minQuotation !== undefined || filters?.maxQuotation !== undefined) {
    whereConditions.quotation = {}
    if (filters?.minQuotation !== undefined) {
      whereConditions.quotation.gte = filters.minQuotation
    }
    if (filters?.maxQuotation !== undefined) {
      whereConditions.quotation.lte = filters.maxQuotation
    }
  }

  // Get free agents (players not in any roster in this league)
  const freeAgents = await prisma.serieAPlayer.findMany({
    where: whereConditions,
    orderBy: [{ position: 'asc' }, { quotation: 'desc' }, { name: 'asc' }],
  })

  return {
    success: true,
    data: freeAgents,
  }
}

// ==================== GET TEAMS LIST ====================

export async function getTeams(): Promise<ServiceResult> {
  const teams = await prisma.serieAPlayer.findMany({
    where: { isActive: true, listStatus: 'IN_LIST' },
    select: { team: true },
    distinct: ['team'],
    orderBy: { team: 'asc' },
  })

  return {
    success: true,
    data: teams.map(t => t.team),
  }
}

// ==================== START FREE AGENT AUCTION ====================

export async function startFreeAgentAuction(
  leagueId: string,
  playerId: string,
  adminUserId: string,
  _basePrice?: number // Not used - base price is always 1 per requirements
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

  // Check if in SVINCOLATI phase
  const inSvincolatiPhase = await isInSvincolatiPhase(leagueId)
  if (!inSvincolatiPhase) {
    return { success: false, message: 'Puoi avviare aste per svincolati solo in fase SVINCOLATI' }
  }

  // Get player
  const player = await prisma.serieAPlayer.findUnique({
    where: { id: playerId },
  })

  if (!player) {
    return { success: false, message: 'Giocatore non trovato' }
  }

  // Verify player is not in any roster
  const existingRoster = await prisma.playerRoster.findFirst({
    where: {
      playerId,
      leagueMember: { leagueId },
      status: 'ACTIVE',
    },
  })

  if (existingRoster) {
    return { success: false, message: 'Questo giocatore è già in una rosa' }
  }

  // Check no active auction
  const activeSession = await prisma.marketSession.findFirst({
    where: {
      leagueId,
      status: 'ACTIVE',
    },
  })

  if (!activeSession) {
    return { success: false, message: 'Nessuna sessione di mercato attiva' }
  }

  const existingAuction = await prisma.auction.findFirst({
    where: {
      marketSessionId: activeSession.id,
      type: 'FREE_BID',
      status: { in: ['PENDING', 'ACTIVE'] },
    },
  })

  if (existingAuction) {
    return { success: false, message: 'C\'è già un\'asta in corso' }
  }

  // Base price = SEMPRE 1 (come da requisiti)
  const auctionBasePrice = 1

  // Get timer from session
  const timerSeconds = activeSession.auctionTimerSeconds
  const timerExpires = new Date(Date.now() + timerSeconds * 1000)

  // Create auction
  const auction = await prisma.auction.create({
    data: {
      leagueId,
      marketSessionId: activeSession.id,
      playerId,
      type: 'FREE_BID',
      basePrice: auctionBasePrice,
      currentPrice: auctionBasePrice,
      timerExpiresAt: timerExpires,
      timerSeconds,
      status: AuctionStatus.ACTIVE,
      startsAt: new Date(),
    },
    include: {
      player: true,
    },
  })

  return {
    success: true,
    message: `Asta per ${player.name} avviata a ${auctionBasePrice}`,
    data: {
      auction: {
        id: auction.id,
        player: auction.player,
        basePrice: auction.basePrice,
        currentPrice: auction.currentPrice,
      },
    },
  }
}

// ==================== BID ON FREE AGENT ====================

export async function bidOnFreeAgent(
  auctionId: string,
  userId: string,
  amount: number
): Promise<ServiceResult> {
  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    include: {
      player: true,
      bids: {
        orderBy: { amount: 'desc' },
        take: 1,
      },
    },
  })

  if (!auction) {
    return { success: false, message: 'Asta non trovata' }
  }

  if (auction.type !== 'FREE_BID') {
    return { success: false, message: 'Non è un\'asta per svincolati' }
  }

  if (auction.status !== 'ACTIVE') {
    return { success: false, message: 'Asta non attiva' }
  }

  // Get bidder member
  const bidder = await prisma.leagueMember.findFirst({
    where: {
      leagueId: auction.leagueId,
      userId,
      status: MemberStatus.ACTIVE,
    },
  })

  if (!bidder) {
    return { success: false, message: 'Non sei membro di questa lega' }
  }

  // Check bid amount
  if (amount <= auction.currentPrice) {
    return { success: false, message: `L'offerta deve essere maggiore di ${auction.currentPrice}` }
  }

  // Check budget
  if (amount > bidder.currentBudget) {
    return { success: false, message: `Budget insufficiente. Disponibile: ${bidder.currentBudget}` }
  }

  // Check roster slot availability
  const position = auction.player.position
  const league = await prisma.league.findUnique({
    where: { id: auction.leagueId },
  })

  if (!league) {
    return { success: false, message: 'Lega non trovata' }
  }

  const currentRoster = await prisma.playerRoster.findMany({
    where: {
      leagueMemberId: bidder.id,
      status: 'ACTIVE',
    },
    include: { player: true },
  })

  const slotMap: Record<Position, number> = {
    P: league.goalkeeperSlots,
    D: league.defenderSlots,
    C: league.midfielderSlots,
    A: league.forwardSlots,
  }

  const currentCount = currentRoster.filter(r => r.player.position === position).length
  if (currentCount >= slotMap[position]) {
    return { success: false, message: `Slot ${position} pieni. Non puoi fare offerte per questo ruolo.` }
  }

  // Place bid
  await prisma.$transaction(async (tx) => {
    // Mark previous bids as not winning
    await tx.auctionBid.updateMany({
      where: { auctionId },
      data: { isWinning: false },
    })

    // Create new bid
    await tx.auctionBid.create({
      data: {
        auctionId,
        bidderId: bidder.id,
        userId,
        amount,
        isWinning: true,
      },
    })

    // Update auction current price
    await tx.auction.update({
      where: { id: auctionId },
      data: { currentPrice: amount },
    })
  })

  return {
    success: true,
    message: `Offerta di ${amount} registrata`,
    data: { currentPrice: amount },
  }
}

// ==================== CLOSE FREE AGENT AUCTION ====================

export async function closeFreeAgentAuction(
  auctionId: string,
  adminUserId: string
): Promise<ServiceResult> {
  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    include: {
      player: true,
      bids: {
        where: { isWinning: true },
        include: {
          bidder: {
            include: { user: { select: { username: true } } },
          },
        },
      },
    },
  })

  if (!auction) {
    return { success: false, message: 'Asta non trovata' }
  }

  if (auction.type !== 'FREE_BID') {
    return { success: false, message: 'Non è un\'asta per svincolati' }
  }

  if (auction.status !== 'ACTIVE') {
    return { success: false, message: 'Asta non attiva' }
  }

  // Verify admin
  const adminMember = await prisma.leagueMember.findFirst({
    where: {
      leagueId: auction.leagueId,
      userId: adminUserId,
      role: 'ADMIN',
      status: MemberStatus.ACTIVE,
    },
  })

  if (!adminMember) {
    return { success: false, message: 'Non autorizzato' }
  }

  const winningBid = auction.bids[0]

  if (!winningBid) {
    // No bids - auction ends with no winner
    await prisma.auction.update({
      where: { id: auctionId },
      data: {
        status: AuctionStatus.NO_BIDS,
        endsAt: new Date(),
      },
    })

    return {
      success: true,
      message: 'Nessuna offerta. Il giocatore rimane svincolato.',
      data: { noBids: true },
    }
  }

  // Assign player to winner
  await prisma.$transaction(async (tx) => {
    // Deduct budget from winner
    await tx.leagueMember.update({
      where: { id: winningBid.bidderId },
      data: { currentBudget: { decrement: auction.currentPrice } },
    })

    // Create roster entry
    await tx.playerRoster.create({
      data: {
        leagueMemberId: winningBid.bidderId,
        playerId: auction.playerId,
        acquisitionPrice: auction.currentPrice,
        acquisitionType: 'SVINCOLATI',
        status: 'ACTIVE',
      },
    })

    // Complete auction
    await tx.auction.update({
      where: { id: auctionId },
      data: {
        status: AuctionStatus.COMPLETED,
        winnerId: winningBid.bidderId,
        endsAt: new Date(),
      },
    })
  })

  // Record movement
  await recordMovement({
    leagueId: auction.leagueId,
    playerId: auction.playerId,
    movementType: 'SVINCOLATI',
    toMemberId: winningBid.bidderId,
    price: auction.currentPrice,
    auctionId,
    marketSessionId: auction.marketSessionId ?? undefined,
  })

  return {
    success: true,
    message: `${auction.player.name} assegnato a ${winningBid.bidder.user.username} per ${auction.currentPrice}`,
    data: {
      player: auction.player,
      winnerId: winningBid.bidderId,
      winnerUsername: winningBid.bidder.user.username,
      finalPrice: auction.currentPrice,
    },
  }
}

// ==================== GET CURRENT FREE AGENT AUCTION ====================

export async function getCurrentFreeAgentAuction(
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

  const activeSession = await prisma.marketSession.findFirst({
    where: {
      leagueId,
      status: 'ACTIVE',
    },
  })

  if (!activeSession) {
    return { success: false, message: 'Nessuna sessione attiva' }
  }

  const activeAuction = await prisma.auction.findFirst({
    where: {
      marketSessionId: activeSession.id,
      type: 'FREE_BID',
      status: { in: ['PENDING', 'ACTIVE'] },
    },
    include: {
      player: true,
      bids: {
        orderBy: { amount: 'desc' },
        take: 10,
        include: {
          bidder: {
            include: { user: { select: { username: true } } },
          },
        },
      },
    },
  })

  return {
    success: true,
    data: {
      isSvincolatiPhase: activeSession.currentPhase === 'SVINCOLATI',
      currentPhase: activeSession.currentPhase,
      activeAuction: activeAuction
        ? {
            id: activeAuction.id,
            player: activeAuction.player,
            basePrice: activeAuction.basePrice,
            currentPrice: activeAuction.currentPrice,
            bids: activeAuction.bids.map(b => ({
              amount: b.amount,
              bidder: b.bidder.user.username,
              isWinning: b.isWinning,
            })),
          }
        : null,
      myBudget: member.currentBudget,
    },
  }
}

// ==================== GET FREE AGENTS AUCTION HISTORY ====================

export async function getFreeAgentsHistory(
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

  const completedAuctions = await prisma.auction.findMany({
    where: {
      leagueId,
      type: 'FREE_BID',
      status: AuctionStatus.COMPLETED,
    },
    include: {
      player: true,
      winner: {
        include: { user: { select: { username: true } } },
      },
    },
    orderBy: { endsAt: 'desc' },
    take: 50,
  })

  return {
    success: true,
    data: completedAuctions.map(a => ({
      id: a.id,
      player: a.player,
      winner: a.winner?.user.username,
      finalPrice: a.currentPrice,
      closedAt: a.endsAt,
    })),
  }
}
